import type { EngineEvent, IncidentState } from '../engine/index.ts';
import type { Scenario } from '../scenario/index.ts';
import { formatSignalValue, humanize, signalLabel, type SignalDirectory } from './format.ts';

export type LogLevel =
  'CRITICAL' | 'OBSERVE' | 'ACTION' | 'METRIC' | 'WARN' | 'ANOMALY' | 'TEAM' | 'RESOLVED' | 'INFO';

export interface LogLine {
  readonly key: string;
  readonly atSeconds: number;
  readonly level: LogLevel;
  readonly text: string;
  /** True for lines derived from the engine event log rather than the opening page. */
  readonly fromEvent: boolean;
}

export interface WarRoomMessageLike {
  readonly sequence: number;
  readonly atSeconds: number;
  readonly sender: string;
  readonly text: string;
}

function describe(
  event: EngineEvent,
  scenario: Scenario,
  incident: IncidentState,
  directory: SignalDirectory,
  messages: ReadonlyMap<number, WarRoomMessageLike>,
): { level: LogLevel; text: string } | null {
  const actionTitle = (id: string | undefined) =>
    scenario.actions.find((action) => action.id === id)?.title ?? humanize(id ?? 'action');
  switch (event.type) {
    case 'action_completed':
      return { level: 'ACTION', text: `Completed: ${actionTitle(event.sourceId)}` };
    case 'action_unlocked':
      return { level: 'INFO', text: `New option available: ${actionTitle(event.targetId)}` };
    case 'signal_revealed': {
      const id = event.targetId ?? 'signal';
      const value = event.value ?? incident.signals[id]?.value;
      return {
        level: 'OBSERVE',
        text:
          value === undefined
            ? `New observation: ${signalLabel(id, directory)}`
            : `New observation: ${signalLabel(id, directory)} = ${formatSignalValue(id, value, directory)}`,
      };
    }
    case 'signal_changed': {
      const id = event.targetId ?? 'signal';
      const before =
        event.previousValue === undefined
          ? '—'
          : formatSignalValue(id, event.previousValue, directory);
      const after = event.value === undefined ? '—' : formatSignalValue(id, event.value, directory);
      return { level: 'METRIC', text: `${signalLabel(id, directory)}: ${before} → ${after}` };
    }
    case 'temporary_effect_started':
      return {
        level: 'INFO',
        text: 'Temporary relief applied; the underlying cause is still open',
      };
    case 'temporary_effect_expired':
      return { level: 'WARN', text: 'Temporary relief expired' };
    case 'event_fired':
      return { level: 'WARN', text: `Condition triggered: ${humanize(event.sourceId ?? 'event')}` };
    case 'evidence_revealed': {
      const evidence = scenario.evidence.find((item) => item.id === event.targetId);
      return {
        level: 'INFO',
        text: `Evidence preserved: ${evidence?.title ?? humanize(event.targetId ?? 'evidence')}`,
      };
    }
    case 'narrative_triggered': {
      const narrative = scenario.narratives.find((item) => item.id === event.sourceId);
      return {
        level: 'ANOMALY',
        text: `Log anomaly flagged: ${narrative?.title ?? humanize(event.sourceId ?? 'entry')}`,
      };
    }
    case 'war_room_message': {
      const message = messages.get(event.sequence);
      return {
        level: 'TEAM',
        text:
          message === undefined
            ? `War Room message: ${humanize(event.targetId ?? 'message')}`
            : `${message.sender}: ${message.text}`,
      };
    }
    case 'mechanism_resolved': {
      const mechanism = scenario.incident.failureMechanisms.find(
        (item) => item.id === event.targetId,
      );
      return {
        level: 'RESOLVED',
        text: `Underlying cause contained: ${mechanism?.label ?? humanize(event.targetId ?? 'mechanism')}`,
      };
    }
    case 'resolution_reached':
      return { level: 'RESOLVED', text: 'Root cause resolved' };
    case 'completion_reached':
      return { level: 'RESOLVED', text: 'Service recovery confirmed' };
    default:
      // Bookkeeping events (time, resources, flags, scheduling) stay in the
      // status views; they would only add noise to an operator log.
      return null;
  }
}

// Read-only projection of the authored opening state and the engine event log.
// Every line carries the event's own atSeconds, never the current clock.
export function buildIncidentLog(
  scenario: Scenario,
  incident: IncidentState,
  directory: SignalDirectory,
  warRoomMessages: readonly WarRoomMessageLike[],
): LogLine[] {
  const messages = new Map(warRoomMessages.map((message) => [message.sequence, message]));
  const opening: LogLine[] = [
    {
      key: 'trigger',
      atSeconds: 0,
      level: 'CRITICAL',
      text: scenario.incident.trigger.label,
      fromEvent: false,
    },
    ...scenario.incident.symptoms.map((symptom): LogLine => ({
      key: `symptom:${symptom.id}`,
      atSeconds: 0,
      level: 'OBSERVE',
      text: symptom.label,
      fromEvent: false,
    })),
    ...warRoomMessages
      .filter((message) => message.sequence < 0)
      .map((message): LogLine => ({
        key: `team:${message.sequence}`,
        atSeconds: message.atSeconds,
        level: 'TEAM',
        text: `${message.sender}: ${message.text}`,
        fromEvent: false,
      })),
  ];
  const events = incident.eventLog.flatMap((event): LogLine[] => {
    const line = describe(event, scenario, incident, directory, messages);
    return line === null
      ? []
      : [{ key: `event:${event.sequence}`, atSeconds: event.atSeconds, ...line, fromEvent: true }];
  });
  return [...opening, ...events];
}

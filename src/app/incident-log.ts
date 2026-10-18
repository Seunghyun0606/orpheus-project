import type { EngineEvent, IncidentState } from '../engine/index.ts';
import type { Scenario } from '../scenario/index.ts';
import { humanize, type SignalDirectory } from './format.ts';
import {
  englishContent,
  localizedSignals,
  type ContentTranslator,
  type LocalizedSignals,
} from './localized-format.ts';
import { incidentLogMessages } from './messages/incident-log.ts';

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

interface LogContext {
  readonly ct: ContentTranslator['ct'];
  readonly m: (typeof incidentLogMessages)['en'];
  readonly signals: LocalizedSignals;
}

function describe(
  event: EngineEvent,
  scenario: Scenario,
  incident: IncidentState,
  messages: ReadonlyMap<number, WarRoomMessageLike>,
  { ct, m, signals }: LogContext,
): { level: LogLevel; text: string } | null {
  const actionTitle = (id: string | undefined) =>
    ct(scenario.actions.find((action) => action.id === id)?.title ?? humanize(id ?? 'action'));
  switch (event.type) {
    case 'action_completed':
      return { level: 'ACTION', text: m.completed(actionTitle(event.sourceId)) };
    case 'action_unlocked':
      return { level: 'INFO', text: m.unlocked(actionTitle(event.targetId)) };
    case 'signal_revealed': {
      const id = event.targetId ?? 'signal';
      const value = event.value ?? incident.signals[id]?.value;
      return {
        level: 'OBSERVE',
        text:
          value === undefined
            ? m.observation(signals.label(id))
            : m.observationValue(signals.label(id), signals.value(id, value)),
      };
    }
    case 'signal_changed': {
      const id = event.targetId ?? 'signal';
      const before =
        event.previousValue === undefined ? '—' : signals.value(id, event.previousValue);
      const after = event.value === undefined ? '—' : signals.value(id, event.value);
      return { level: 'METRIC', text: `${signals.label(id)}: ${before} → ${after}` };
    }
    case 'temporary_effect_started':
      return { level: 'INFO', text: m.temporaryStarted };
    case 'temporary_effect_expired':
      return { level: 'WARN', text: m.temporaryExpired };
    case 'event_fired':
      return {
        level: 'WARN',
        text: m.conditionTriggered(ct(humanize(event.sourceId ?? 'event'))),
      };
    case 'evidence_revealed': {
      const evidence = scenario.evidence.find((item) => item.id === event.targetId);
      return {
        level: 'INFO',
        text: m.evidencePreserved(ct(evidence?.title ?? humanize(event.targetId ?? 'evidence'))),
      };
    }
    case 'narrative_triggered': {
      const narrative = scenario.narratives.find((item) => item.id === event.sourceId);
      return {
        level: 'ANOMALY',
        text: m.anomalyFlagged(ct(narrative?.title ?? humanize(event.sourceId ?? 'entry'))),
      };
    }
    case 'war_room_message': {
      const message = messages.get(event.sequence);
      return {
        level: 'TEAM',
        text:
          message === undefined
            ? m.warRoomMessage(ct(humanize(event.targetId ?? 'message')))
            : `${ct(message.sender)}: ${ct(message.text)}`,
      };
    }
    case 'mechanism_resolved': {
      const mechanism = scenario.incident.failureMechanisms.find(
        (item) => item.id === event.targetId,
      );
      return {
        level: 'RESOLVED',
        text: m.causeContained(ct(mechanism?.label ?? humanize(event.targetId ?? 'mechanism'))),
      };
    }
    case 'resolution_reached':
      return { level: 'RESOLVED', text: m.rootCauseResolved };
    case 'completion_reached':
      return { level: 'RESOLVED', text: m.recoveryConfirmed };
    default:
      // Bookkeeping events (time, resources, flags, scheduling) stay in the
      // status views; they would only add noise to an operator log.
      return null;
  }
}

// Read-only projection of the authored opening state and the engine event log.
// Every line carries the event's own atSeconds, never the current clock. Text is
// built in the display language; level stays the stable English key.
export function buildIncidentLog(
  scenario: Scenario,
  incident: IncidentState,
  directory: SignalDirectory,
  warRoomMessages: readonly WarRoomMessageLike[],
  i18n: ContentTranslator = englishContent,
): LogLine[] {
  const { ct } = i18n;
  const context: LogContext = {
    ct,
    m: incidentLogMessages[i18n.locale],
    signals: localizedSignals(directory, i18n),
  };
  const messages = new Map(warRoomMessages.map((message) => [message.sequence, message]));
  const opening: LogLine[] = [
    {
      key: 'trigger',
      atSeconds: 0,
      level: 'CRITICAL',
      text: ct(scenario.incident.trigger.label),
      fromEvent: false,
    },
    ...scenario.incident.symptoms.map((symptom): LogLine => ({
      key: `symptom:${symptom.id}`,
      atSeconds: 0,
      level: 'OBSERVE',
      text: ct(symptom.label),
      fromEvent: false,
    })),
    ...warRoomMessages
      .filter((message) => message.sequence < 0)
      .map((message): LogLine => ({
        key: `team:${message.sequence}`,
        atSeconds: message.atSeconds,
        level: 'TEAM',
        text: `${ct(message.sender)}: ${ct(message.text)}`,
        fromEvent: false,
      })),
  ];
  const events = incident.eventLog.flatMap((event): LogLine[] => {
    const line = describe(event, scenario, incident, messages, context);
    return line === null
      ? []
      : [{ key: `event:${event.sequence}`, atSeconds: event.atSeconds, ...line, fromEvent: true }];
  });
  return [...opening, ...events];
}

import type { Scenario } from '../../scenario/schema.ts';
import type { InvestigationPresentation, NarrativeDelivery } from '../../scenario/presentation.ts';
import type { IncidentState } from '../types.ts';
import type { CampaignRun } from './transitions.ts';
type V2 = Extract<InvestigationPresentation, { schemaVersion: 2 }>;
type Block = V2['panels'][number]['blocks'][number];
export interface RecordedNarrative {
  readonly key: string;
  readonly narrativeId: string;
  readonly eventSequence: number;
  readonly atSeconds: number;
  readonly title: string;
  readonly body: string;
  readonly delivery: NarrativeDelivery;
}
export function projectNarrativeStream(
  block: Extract<Block, { kind: 'narrative_stream' }>,
  scenario: Scenario,
  incident: IncidentState,
  run: CampaignRun,
  attemptId: string,
) {
  const messages: RecordedNarrative[] = incident.eventLog
    .filter((e) => e.type === 'narrative_triggered')
    .map((e) => {
      const narrative = scenario.narratives.find((n) => n.id === e.sourceId);
      const entry = block.entries.find((n) => n.narrativeId === e.sourceId);
      if (!narrative) throw new Error('INVALID_RUNTIME_NARRATIVE');
      if (!entry) return [];
      return [
        {
          key: JSON.stringify([
            run.operations[0]!.definitionId,
            run.operations[0]!.definitionVersion,
            run.runId,
            attemptId,
            e.sequence,
            narrative.id,
          ]),
          narrativeId: narrative.id,
          eventSequence: e.sequence,
          atSeconds: e.atSeconds,
          title: narrative.title,
          body: narrative.body,
          delivery: entry.delivery,
        },
      ];
    })
    .flat();
  return { kind: 'narrative_stream' as const, id: block.id, messages };
}
export function projectWarRoomStream(
  block: Extract<Block, { kind: 'war_room_stream' }>,
  scenario: Scenario,
  incident: IncidentState,
) {
  const role = (id: string) => {
    const found = scenario.warRoom.roles.find((r) => r.id === id);
    if (!found) throw new Error('INVALID_RUNTIME_ROLE');
    return found.name;
  };
  const messages = scenario.warRoom.messages
    .filter((m) => m.initial && block.messageIds.includes(m.id))
    .map((m) => ({ key: 'initial:' + m.id, atSeconds: 0, sender: role(m.roleId), text: m.text }));
  for (const event of incident.eventLog) {
    if (event.type !== 'war_room_message') continue;
    const m = scenario.warRoom.messages.find((m) => m.id === event.targetId);
    if (!m) throw new Error('INVALID_RUNTIME_MESSAGE');
    if (!block.messageIds.includes(m.id)) continue;
    messages.push({
      key: 'event:' + event.sequence,
      atSeconds: event.atSeconds,
      sender: role(m.roleId),
      text: m.text,
    });
  }
  const pending = incident.scheduledWork.flatMap((work) => {
    if (work.kind !== 'timer_event') return [];
    const action = scenario.actions.find((a) => a.delegation?.eventId === work.eventId);
    if (!action) return []; // Other authored timers are not delegated work.
    if (!action.delegation || !block.delegationActionIds.includes(action.id)) return [];
    return [
      {
        key: work.scheduleSequence,
        role: role(action.delegation.roleId),
        title: action.title,
        dueAtSeconds: work.dueAtSeconds,
        remainingSeconds: Math.max(0, work.dueAtSeconds - incident.elapsedSeconds),
      },
    ];
  });
  const capacity = block.capacityResourceIds.map((id) => {
    const current = incident.resources[id];
    const authored = scenario.initialState.resources.find((r) => r.id === id);
    if (!current || !authored) throw new Error('INVALID_RUNTIME_CAPACITY');
    return { id, value: current.value, max: authored.max };
  });
  return { kind: 'war_room_stream' as const, id: block.id, messages, pending, capacity };
}

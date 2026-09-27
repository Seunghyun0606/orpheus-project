import { z } from 'zod';

import { replayCommands, type IncidentState } from '../engine/index.ts';
import { effectSchema, idSchema, type Scenario } from '../scenario/schema.ts';

export const SAVE_SCHEMA_VERSION = 1;

const scalarSchema = z.union([z.number().finite(), z.string(), z.boolean()]);
const nonnegativeInteger = z.number().int().nonnegative();

const replayEntrySchema = z
  .object({
    sequence: nonnegativeInteger,
    command: z
      .object({
        type: z.literal('perform_action'),
        actionId: idSchema,
        targetId: idSchema.optional(),
        input: z.record(idSchema, scalarSchema).optional(),
      })
      .strict(),
  })
  .strict();

const eventSchema = z
  .object({
    sequence: nonnegativeInteger,
    type: z.enum([
      'action_started',
      'action_completed',
      'time_advanced',
      'signal_changed',
      'signal_revealed',
      'resource_changed',
      'flag_changed',
      'action_unlocked',
      'evidence_revealed',
      'narrative_triggered',
      'mechanism_resolved',
      'temporary_effect_started',
      'temporary_effect_expired',
      'event_scheduled',
      'event_cancelled',
      'event_fired',
      'resolution_reached',
      'completion_reached',
    ]),
    atSeconds: nonnegativeInteger,
    sourceId: idSchema.optional(),
    targetId: idSchema.optional(),
    value: scalarSchema.optional(),
    previousValue: scalarSchema.optional(),
    dueAtSeconds: nonnegativeInteger.optional(),
  })
  .strict();

const scheduledWorkSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('temporary_expiration'),
      dueAtSeconds: nonnegativeInteger,
      scheduleSequence: nonnegativeInteger,
      actionId: idSchema,
      temporaryEffectId: idSchema,
      effects: z.array(effectSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('timer_event'),
      dueAtSeconds: nonnegativeInteger,
      scheduleSequence: nonnegativeInteger,
      eventId: idSchema,
    })
    .strict(),
]);

const incidentStateSchema = z
  .object({
    scenarioId: idSchema,
    contentVersion: z.string(),
    elapsedSeconds: nonnegativeInteger,
    rng: z
      .object({
        seed: z.number().int(),
        state: z.number().int(),
        draws: nonnegativeInteger,
      })
      .strict(),
    signals: z.record(
      z.string(),
      z.object({ value: scalarSchema, revealed: z.boolean() }).strict(),
    ),
    resources: z.record(z.string(), z.object({ value: z.number().finite() }).strict()),
    flags: z.record(z.string(), z.boolean()),
    unlockedActionIds: z.array(idSchema),
    completedActionIds: z.array(idSchema),
    actionHistory: z.array(idSchema),
    revealedEvidenceIds: z.array(idSchema),
    triggeredNarrativeIds: z.array(idSchema),
    resolvedMechanismIds: z.array(idSchema),
    firedOnceEventIds: z.array(idSchema),
    latchedConditionalEventIds: z.array(idSchema),
    scheduledWork: z.array(scheduledWorkSchema),
    resolutionReached: z.boolean(),
    completionReached: z.boolean(),
    replayLog: z.array(replayEntrySchema),
    eventLog: z.array(eventSchema),
    nextEventSequence: nonnegativeInteger,
    nextScheduleSequence: nonnegativeInteger,
  })
  .strict();

const saveEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
    scenarioId: idSchema,
    contentVersion: z.string(),
    seed: z.number().int(),
    incident: incidentStateSchema,
  })
  .strict();

export type SaveErrorCode =
  | 'SAVE_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'MALFORMED_SAVE'
  | 'INCOMPATIBLE_SCHEMA'
  | 'INCOMPATIBLE_CONTENT'
  | 'SCENARIO_MISMATCH'
  | 'REPLAY_MISMATCH';

export type SaveResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: SaveErrorCode; readonly message: string };

export interface RestoredSession {
  readonly seed: number;
  readonly incident: IncidentState;
}

function fail<T>(code: SaveErrorCode, message: string): SaveResult<T> {
  return { ok: false, code, message };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function encodeSave(scenario: Scenario, seed: number, incident: IncidentState): string {
  return JSON.stringify({
    schemaVersion: SAVE_SCHEMA_VERSION,
    scenarioId: scenario.id,
    contentVersion: scenario.contentVersion,
    seed,
    incident,
  });
}

export function decodeSave(raw: string, scenario: Scenario): SaveResult<RestoredSession> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return fail('MALFORMED_SAVE', 'The saved session is not valid JSON.');
  }

  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return fail('MALFORMED_SAVE', 'The saved session has no valid envelope.');
  }

  const header = decoded as Record<string, unknown>;
  if (typeof header.schemaVersion !== 'number' || !Number.isInteger(header.schemaVersion)) {
    return fail('MALFORMED_SAVE', 'The saved session has no valid schema version.');
  }
  if (header.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return fail('INCOMPATIBLE_SCHEMA', 'This save schema version is not supported.');
  }
  if (header.scenarioId !== scenario.id) {
    return fail('SCENARIO_MISMATCH', 'This save belongs to a different incident.');
  }
  if (header.contentVersion !== scenario.contentVersion) {
    return fail('INCOMPATIBLE_CONTENT', 'This save uses a different scenario content version.');
  }

  const parsed = saveEnvelopeSchema.safeParse(decoded);
  if (!parsed.success) {
    return fail('MALFORMED_SAVE', 'The saved session has invalid or missing state fields.');
  }

  const { seed, incident } = parsed.data;
  if (
    incident.scenarioId !== scenario.id ||
    incident.contentVersion !== scenario.contentVersion ||
    incident.replayLog.some(({ sequence }, index) => sequence !== index)
  ) {
    return fail('REPLAY_MISMATCH', 'The saved state and replay metadata disagree.');
  }

  const replay = replayCommands(
    scenario,
    { seed },
    incident.replayLog.map(({ command }) => command),
  );
  if (!replay.ok || canonical(JSON.parse(JSON.stringify(replay.state))) !== canonical(incident)) {
    return fail('REPLAY_MISMATCH', 'The saved state cannot be reproduced from its action log.');
  }

  return { ok: true, value: { seed, incident } };
}

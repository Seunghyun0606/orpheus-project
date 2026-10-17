import { z } from 'zod';

import { replayCommands, type IncidentState } from '../engine/index.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { getLegacyScenarioForMigration } from '../scenario/legacy-catalog.ts';
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
      'war_room_message',
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
  | 'REPLAY_MISMATCH'
  | 'OVERWRITE_CONFIRMATION_REQUIRED';

export type SaveResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: SaveErrorCode;
      readonly message: string;
      readonly existingScenarioId?: string;
    };

export interface RestoredSession {
  readonly seed: number;
  readonly incident: IncidentState;
  readonly migratedFromContentVersion?: string;
}

function fail<T>(code: SaveErrorCode, message: string): SaveResult<T> {
  return { ok: false, code, message };
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
  const replayScenario =
    header.contentVersion === scenario.contentVersion
      ? scenario
      : typeof header.contentVersion === 'string'
        ? getLegacyScenarioForMigration(scenario.id, header.contentVersion, scenario.contentVersion)
        : undefined;
  if (replayScenario === undefined) {
    return fail('INCOMPATIBLE_CONTENT', 'This save uses an unsupported scenario content version.');
  }

  const parsed = saveEnvelopeSchema.safeParse(decoded);
  if (!parsed.success) {
    return fail('MALFORMED_SAVE', 'The saved session has invalid or missing state fields.');
  }

  const { seed, incident } = parsed.data;
  if (
    incident.scenarioId !== scenario.id ||
    incident.contentVersion !== replayScenario.contentVersion ||
    incident.replayLog.some(({ sequence }, index) => sequence !== index)
  ) {
    return fail('REPLAY_MISMATCH', 'The saved state and replay metadata disagree.');
  }

  const replay = replayCommands(
    replayScenario,
    { seed },
    incident.replayLog.map(({ command }) => command),
  );
  if (
    !replay.ok ||
    canonicalJson(JSON.parse(JSON.stringify(replay.state))) !== canonicalJson(incident)
  ) {
    return fail('REPLAY_MISMATCH', 'The saved state cannot be reproduced from its action log.');
  }

  if (replayScenario === scenario) return { ok: true, value: { seed, incident } };

  const migrated = replayCommands(
    scenario,
    { seed },
    incident.replayLog.map(({ command }) => command),
  );
  if (!migrated.ok) {
    return fail('INCOMPATIBLE_CONTENT', 'This verified save cannot replay with current content.');
  }
  return {
    ok: true,
    value: {
      seed,
      incident: migrated.state,
      migratedFromContentVersion: replayScenario.contentVersion,
    },
  };
}

export interface SavedSlot {
  readonly scenario: Scenario;
  readonly restored: RestoredSession;
}

export function inspectSavedSlot(
  raw: string,
  catalog: ReadonlyMap<string, Scenario>,
): SaveResult<SavedSlot> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('MALFORMED_SAVE', 'The saved session is not valid JSON.');
  }
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('scenarioId' in value) ||
    typeof value.scenarioId !== 'string'
  ) {
    return fail('MALFORMED_SAVE', 'The saved session has no incident identifier.');
  }
  const scenario = catalog.get(value.scenarioId);
  if (scenario === undefined) {
    return fail('INCOMPATIBLE_CONTENT', 'The saved session references an unknown incident.');
  }
  const restored = decodeSave(raw, scenario);
  return restored.ok ? { ok: true, value: { scenario, restored: restored.value } } : restored;
}

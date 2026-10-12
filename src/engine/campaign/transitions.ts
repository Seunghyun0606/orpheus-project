import { z } from 'zod';

import {
  validateCampaignDefinition,
  campaignContentVersions,
  campaignEffectTriggers,
  type CampaignDefinition,
} from '../../scenario/campaign.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import type { Scenario } from '../../scenario/schema.ts';
import { validateScenarioObject } from '../../scenario/validator.ts';
import { createIncidentState, executeCommand, replayCommands } from '../simulation.ts';
import { evaluateActionGate, selectCampaignActionIds } from './action-gates.ts';
import { protectedActionOutputs } from '../../scenario/action-gates.ts';
import type { IncidentState, EngineEvent } from '../types.ts';
import {
  createBehaviorState,
  startBehaviorAttempt,
  beginBehaviorCommand,
  consumeBehaviorEvent,
  type BehaviorState,
  type BehaviorSource,
} from '../player-model/behavior.ts';
import type { BehaviorMetricKey } from '../../scenario/behavior.ts';
import { canonicalJson } from './canonical.ts';
import {
  applyOpportunityOperation,
  associateOpportunityResponses,
  projectOpportunityMetrics,
  type OpportunityState,
} from './opportunities.ts';
import {
  evaluateCampaignCondition,
  type Observation,
  type CampaignDiagnostic,
  type Condition,
  type ConditionContext,
} from './conditions.ts';

const id = z.string().min(1);
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const command = z
  .object({
    type: z.literal('perform_action'),
    actionId: id,
    targetId: id.optional(),
    input: z.record(id, z.union([z.number().finite(), z.string(), z.boolean()])).optional(),
  })
  .strict();
const common = {
  operationId: id,
  runId: id,
  sequence,
  definitionId: id,
  definitionVersion: id,
  replayVersion: z.union([z.literal(1), z.literal(2)]),
  canonicalVersion: z.literal(1),
};
const legacySourcesSchema = z
  .object({ incident: z.string().nullable(), progress: z.string().nullable() })
  .strict();
export const campaignOperationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      replayVersion: z.literal(2),
      kind: z.literal('prepare_opportunity'),
      attemptId: id,
      priorHead: id,
      preparationId: id,
      ruleId: id,
    })
    .strict(),
  z
    .object({
      ...common,
      replayVersion: z.literal(2),
      kind: z.literal('acknowledge_presentation'),
      attemptId: id,
      priorHead: id,
      preparationId: id,
      surfaceId: id,
    })
    .strict(),
  z.object({ ...common, kind: z.literal('create') }).strict(),
  z
    .object({
      ...common,
      kind: z.literal('start'),
      attemptId: id,
      incidentId: id,
      seed: z.number().int(),
      contentVersion: id.optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('checkpoint'),
      attemptId: id,
      incidentId: id,
      sourceBytes: z.string(),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('command'),
      attemptId: id,
      inputId: id,
      commandSequence: sequence,
      priorHead: z.string(),
      command,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('adopt'),
      confirmed: z.literal(true),
      sourceBytes: z.array(z.string()).min(1),
      legacySources: legacySourcesSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('associate'),
      attemptId: id,
      priorHead: z.string(),
      sourceBytes: z.string(),
    })
    .strict(),
]);
export type CampaignOperation = z.infer<typeof campaignOperationSchema>;
export interface CampaignProjection {
  act: number;
  alignment: CampaignDefinition['initial']['alignment'];
  values: CampaignDefinition['initial']['values'];
  evidence: string[];
  narratives: string[];
  completed: string[];
  narrativeFlags: Record<string, boolean>;
  endingFlags: Record<string, boolean>;
}
export interface CampaignAttempt {
  id: string;
  incidentId: string;
  seed: number;
  scenarioAuthority: string;
  baselineCommandCount: number;
  baselineEventCount: number;
  sourceBytes: string | null;
  acceptedInputIds: string[];
  incident: IncidentState;
}
export interface EffectReceipt {
  effectId: string;
  semantics: string;
  operationId: string;
  attemptId: string;
  eventSequence: number;
}
export interface CampaignRun {
  schemaVersion: 1 | 2;
  runId: string;
  revision: number;
  definitionAuthority: string;
  operations: CampaignOperation[];
  attempts: CampaignAttempt[];
  activeAttemptId: string | null;
  projection: CampaignProjection;
  effectReceipts: EffectReceipt[];
  behavior?: BehaviorState;
  opportunities?: OpportunityState;
  checkpointAssociations?: {
    operationId: string;
    attemptId: string;
    head: string;
    sourceBytes: string;
  }[];
}
export type CampaignResult =
  | { ok: true; disposition: 'candidate' | 'duplicate'; run: CampaignRun }
  | { ok: false; diagnostics: CampaignDiagnostic[] };
type ScenarioCatalog = ReadonlyMap<string, Scenario>;
const failure = (code: string, path = '$'): Extract<CampaignResult, { ok: false }> => ({
  ok: false,
  diagnostics: [{ code, path }],
});

// Only the existing simulation's generated optional undefined fields are omitted.
// External operation payloads must pass strict canonical validation without coercion.
function simulationJson(state: IncidentState): IncidentState {
  return JSON.parse(JSON.stringify(state)) as IncidentState;
}
export function campaignAttemptHead(attempt: CampaignAttempt): string {
  return canonicalJson(attempt.incident);
}
export function campaignObservations(
  definition: CampaignDefinition,
  run: CampaignRun,
): Record<string, Observation> {
  const p = run.projection;
  const observations: Record<string, Observation> = Object.create(null) as Record<
    string,
    Observation
  >;
  for (const ref of definition.references) {
    let value: number | boolean;
    switch (ref.source) {
      case 'act':
        value = p.act;
        break;
      case 'alignment':
        value = p.alignment[ref.key as keyof typeof p.alignment];
        break;
      case 'value':
        value = p.values[ref.key as keyof typeof p.values];
        break;
      case 'evidence':
        value = p.evidence.includes(ref.key);
        break;
      case 'completed':
        value = p.completed.includes(ref.key);
        break;
      case 'narrative_flag':
        value = p.narrativeFlags[ref.key]!;
        break;
      case 'ending_flag':
        value = p.endingFlags[ref.key]!;
        break;
      case 'metric':
        {
          const metric = run.behavior?.metrics[ref.key as BehaviorMetricKey];
          observations[ref.id] =
            metric?.status === 'available'
              ? { status: 'available', value: metric.value }
              : {
                  status: 'unavailable',
                  reason: metric?.reason ?? 'No supported behavior projection in TASK-019',
                };
        }
        continue;
    }
    observations[ref.id] = { status: 'available', value };
  }
  return observations;
}
function condition(
  definition: CampaignDefinition,
  run: CampaignRun,
  tree: Condition,
  kind: 'effect' | 'progression' | 'branch',
) {
  return evaluateCampaignCondition(tree, definition.references, {
    definitionVersion: definition.version,
    kind,
    runId: run.runId,
    boundary: run.revision,
    observations: campaignObservations(definition, run),
  });
}
export function campaignActionContext(
  definition: CampaignDefinition,
  run: CampaignRun,
): ConditionContext {
  return {
    definitionVersion: definition.version,
    kind: 'action',
    runId: run.runId,
    boundary: run.revision,
    observations: campaignObservations(definition, run),
  };
}
function sourceNeedsCampaignProof(
  definition: CampaignDefinition,
  source: NonNullable<ReturnType<typeof sourceSnapshot>>,
) {
  if (!definition.actionGates) return false;
  const protectedOutputs = protectedActionOutputs(definition, source.scenario);
  return (
    source.state.replayLog.some((e) => protectedOutputs.actionIds.has(e.command.actionId)) ||
    source.state.revealedEvidenceIds.some((id) => protectedOutputs.evidence.has(id)) ||
    source.state.triggeredNarrativeIds.some((id) => protectedOutputs.narratives.has(id)) ||
    [...protectedOutputs.signals].some((id) => source.state.signals[id]?.revealed) ||
    source.state.eventLog.some(
      (e) =>
        e.type === 'war_room_message' && e.targetId && protectedOutputs.messages.has(e.targetId),
    )
  );
}
function hasOriginalSourceProof(prior: CampaignRun, bytes: string) {
  // Associations were accepted at a verified exact live head. Equality of only
  // seed/actions/state is not provenance; a caller cannot forge this receipt.
  return (prior.checkpointAssociations ?? []).some(
    (a) =>
      a.sourceBytes === bytes &&
      prior.operations.some(
        (op) =>
          op.kind === 'associate' &&
          op.operationId === a.operationId &&
          op.attemptId === a.attemptId &&
          op.sourceBytes === bytes &&
          op.priorHead === a.head,
      ),
  );
}
function incidentScenario(
  definition: CampaignDefinition,
  catalog: ScenarioCatalog,
  incidentId: string,
  contentVersion?: string,
) {
  const incident = definition.incidents.find((item) => item.id === incidentId);
  if (!incident) return undefined;
  const version = contentVersion ?? incident.contentVersion;
  return campaignContentVersions(incident).includes(version)
    ? catalog.get(scenarioVersionKey(incident.scenarioId, version))
    : undefined;
}
function eligible(definition: CampaignDefinition, run: CampaignRun, incidentId: string) {
  const incident = definition.incidents.find((item) => item.id === incidentId);
  if (!incident)
    return { ok: false as const, diagnostics: [{ code: 'UNKNOWN_INCIDENT', path: incidentId }] };
  const act = definition.acts.find((item) => item.id === incident.act)!;
  // Compose before evaluation so a decisive false cannot hide unavailable leaves.
  const result = condition(
    definition,
    run,
    { type: 'all', children: [act.eligibility, incident.eligibility] },
    'progression',
  );
  // Evaluate every authored leaf before applying the shared executable Act gate.
  return result.ok
    ? { ...result, value: result.value && incident.act === run.projection.act }
    : result;
}
function sourceSnapshot(bytes: string, catalog: ScenarioCatalog) {
  const envelope = z
    .object({
      schemaVersion: z.literal(1),
      scenarioId: id,
      contentVersion: id,
      seed: z.number().int(),
      incident: z.unknown(),
    })
    .strict();
  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes);
  } catch {
    return undefined;
  }
  const parsed = envelope.safeParse(decoded);
  if (!parsed.success) return undefined;
  const value = parsed.data;
  const scenario = catalog.get(scenarioVersionKey(value.scenarioId, value.contentVersion));
  if (
    !scenario ||
    scenario.id !== value.scenarioId ||
    scenario.contentVersion !== value.contentVersion ||
    !validateScenarioObject(scenario).success
  )
    return undefined;
  const prefix = z
    .object({
      replayLog: z.array(
        z
          .object({
            sequence,
            command,
          })
          .strict(),
      ),
    })
    .passthrough()
    .safeParse(value.incident);
  if (!prefix.success || prefix.data.replayLog.some((entry, i) => entry.sequence !== i))
    return undefined;
  const replay = replayCommands(
    scenario,
    { seed: value.seed },
    prefix.data.replayLog.map((item) => item.command),
  );
  if (!replay.ok || canonicalJson(simulationJson(replay.state)) !== canonicalJson(value.incident))
    return undefined;
  return { scenario, seed: value.seed, state: simulationJson(replay.state) };
}
export function verifyCampaignSource(bytes: string, catalog: ScenarioCatalog) {
  try {
    return sourceSnapshot(bytes, catalog);
  } catch {
    return undefined;
  }
}
export function checkCampaignSourceAdmission(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
  bytes: string,
) {
  try {
    const checked = validateCampaignDefinition(definition, catalog);
    if (!checked.ok) return checked;
    const replay = replayCampaign(checked.definition, catalog, run.operations);
    if (!replay.ok || canonicalJson(replay.run) !== canonicalJson(run))
      return failure('INVALID_PRIOR_RECORD');
    const source = sourceSnapshot(bytes, catalog);
    if (!source) return failure('INVALID_ADOPTION_SOURCE');
    if (
      sourceNeedsCampaignProof(checked.definition, source) &&
      !hasOriginalSourceProof(replay.run, bytes)
    )
      return failure('UNPROVEN_PROTECTED_SOURCE');
    return { ok: true as const };
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}
// Preserve old wrapper bytes as provenance, without treating its order as chronology.
export function legacySnapshotBytes(input: unknown): string[] | undefined {
  try {
    const sources = legacySourcesSchema.parse(input);
    const bytes: string[] = [];
    if (sources.incident !== null) bytes.push(sources.incident);
    if (sources.progress !== null) {
      const progress = z
        .object({
          schemaVersion: z.literal(1),
          incidentSaves: z.record(id, z.array(z.string()).min(1)),
        })
        .strict()
        .parse(JSON.parse(sources.progress));
      for (const key of Object.keys(progress.incidentSaves).sort())
        for (const save of progress.incidentSaves[key]!) {
          const header: unknown = JSON.parse(save);
          if (
            !header ||
            typeof header !== 'object' ||
            !('scenarioId' in header) ||
            header.scenarioId !== key
          )
            return undefined;
          bytes.push(save);
        }
    }
    return bytes;
  } catch {
    return undefined;
  }
}
const add = (items: string[], value: string): void => {
  if (!items.includes(value)) items.push(value);
};

function projectEvents(
  definition: CampaignDefinition,
  next: CampaignRun,
  before: CampaignRun,
  attempt: CampaignAttempt,
  operation: CampaignOperation,
  events: readonly EngineEvent[],
): CampaignResult | undefined {
  for (const event of events) {
    if (event.type === 'evidence_revealed') {
      for (const entry of definition.evidence)
        if (entry.scenarioId === attempt.incident.scenarioId && entry.evidenceId === event.targetId)
          add(next.projection.evidence, entry.id);
    } else if (event.type === 'narrative_triggered') {
      for (const entry of definition.narratives)
        if (
          entry.scenarioId === attempt.incident.scenarioId &&
          entry.narrativeId === event.sourceId
        )
          add(next.projection.narratives, entry.id);
    } else if (event.type === 'completion_reached')
      add(next.projection.completed, attempt.incidentId);
    for (const effect of definition.effects) {
      const eventTarget = event.type === 'narrative_triggered' ? event.sourceId : event.targetId;
      const incident = definition.incidents.find((item) => item.id === attempt.incidentId)!;
      if (
        effect.trigger.incidentId !== attempt.incidentId ||
        !campaignEffectTriggers(effect, incident).some(
          (trigger) =>
            trigger.contentVersion === attempt.incident.contentVersion &&
            trigger.type === event.type &&
            trigger.targetId === eventTarget,
        )
      )
        continue;
      const semantics = canonicalJson(effect);
      const receipt = next.effectReceipts.find((item) => item.effectId === effect.id);
      if (receipt) {
        if (receipt.semantics !== semantics) return failure('CONFLICTING_EFFECT', effect.id);
        continue;
      }
      const result = condition(
        definition,
        effect.boundary === 'pre_command' ? before : next,
        effect.condition,
        'effect',
      );
      if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
      if (!result.value) continue;
      for (const [key, amount] of Object.entries(effect.alignment))
        next.projection.alignment[key as keyof typeof next.projection.alignment] += amount;
      for (const [key, amount] of Object.entries(effect.values))
        next.projection.values[key as keyof typeof next.projection.values] += amount;
      for (const key of Object.keys(effect.narrativeFlags))
        next.projection.narrativeFlags[key] = effect.narrativeFlags[key]!;
      for (const key of Object.keys(effect.endingFlags))
        next.projection.endingFlags[key] = effect.endingFlags[key]!;
      if (effect.act !== undefined) {
        const act = definition.acts.find((item) => item.id === effect.act)!;
        const eligibility = condition(definition, next, act.eligibility, 'progression');
        if (!eligibility.ok) return { ok: false, diagnostics: eligibility.diagnostics };
        if (!eligibility.value) return failure('INELIGIBLE_ACT', String(effect.act));
        next.projection.act = effect.act;
      }
      if (
        [
          ...Object.values(next.projection.values),
          ...Object.values(next.projection.alignment),
        ].some((n) => !Number.isFinite(n))
      )
        return failure('NONFINITE_EFFECT', effect.id);
      next.effectReceipts.push({
        effectId: effect.id,
        semantics,
        operationId: operation.operationId,
        attemptId: attempt.id,
        eventSequence: event.sequence,
      });
    }
  }
  return undefined;
}

function apply(
  definition: CampaignDefinition,
  catalog: ScenarioCatalog,
  prior: CampaignRun | null,
  op: CampaignOperation,
  prefixes: ReadonlyMap<number, CampaignRun> = new Map(),
): CampaignResult {
  if (op.replayVersion !== definition.replayVersion) return failure('INCOMPATIBLE_REPLAY_VERSION');
  if (op.definitionId !== definition.id || op.definitionVersion !== definition.version)
    return failure('INCOMPATIBLE_DEFINITION');
  if (prior === null) {
    if (op.kind !== 'create' || op.sequence !== 0) return failure('MISSING_CREATION');
    const run: CampaignRun = {
      schemaVersion: definition.recordVersion ?? 1,
      runId: op.runId,
      revision: 0,
      definitionAuthority: canonicalJson(definition),
      operations: [op],
      attempts: [],
      activeAttemptId: null,
      projection: JSON.parse(canonicalJson(definition.initial)) as CampaignProjection,
      effectReceipts: [],
      ...(definition.behavior ? { behavior: createBehaviorState(definition.behavior) } : {}),
      ...(definition.recordVersion === 2
        ? { opportunities: { preparations: [], acknowledgements: [], responses: [] } }
        : {}),
    };
    projectOpportunityMetrics(definition, run);
    return { ok: true, disposition: 'candidate', run };
  }
  if (op.runId !== prior.runId || prior.definitionAuthority !== canonicalJson(definition))
    return failure('INCOMPATIBLE_AUTHORITY');
  const duplicate = prior.operations.find((item) => item.operationId === op.operationId);
  if (duplicate)
    return canonicalJson(duplicate) === canonicalJson(op)
      ? { ok: true, disposition: 'duplicate', run: prior }
      : failure('CONFLICTING_OPERATION');
  if (op.sequence !== prior.revision + 1 || op.kind === 'create')
    return failure('OUT_OF_ORDER_OPERATION');
  const next = JSON.parse(canonicalJson(prior)) as CampaignRun;
  next.revision = op.sequence;
  if (op.kind === 'prepare_opportunity' || op.kind === 'acknowledge_presentation') {
    const result = applyOpportunityOperation(definition, catalog, prior, next, op, (length) => {
      const run = prefixes.get(length - 1);
      return run
        ? { ok: true, disposition: 'candidate', run }
        : failure('MISSING_PREDICTION_PREFIX');
    });
    if (!result.ok) return result;
  } else if (op.kind === 'start' || op.kind === 'checkpoint') {
    if (next.attempts.some((item) => item.id === op.attemptId))
      return failure('CONFLICTING_ATTEMPT');
    const snapshot = op.kind === 'checkpoint' ? sourceSnapshot(op.sourceBytes, catalog) : undefined;
    if (op.kind === 'checkpoint' && (!snapshot || snapshot.state.completionReached))
      return failure('INVALID_CHECKPOINT');
    if (
      snapshot &&
      sourceNeedsCampaignProof(definition, snapshot) &&
      !hasOriginalSourceProof(prior, op.kind === 'checkpoint' ? op.sourceBytes : '')
    )
      return failure('UNPROVEN_PROTECTED_SOURCE');
    const scenario = incidentScenario(
      definition,
      catalog,
      op.incidentId,
      op.kind === 'start' ? op.contentVersion : snapshot!.scenario.contentVersion,
    );
    const content = definition.incidents.find((item) => item.id === op.incidentId);
    if (!scenario || !content) return failure('UNKNOWN_INCIDENT');
    const availability = eligible(definition, prior, op.incidentId);
    if (!availability.ok) return { ok: false, diagnostics: availability.diagnostics };
    if (!availability.value) return failure('INELIGIBLE_INCIDENT');
    if (
      op.kind === 'checkpoint' &&
      (!snapshot ||
        snapshot.scenario.id !== scenario.id ||
        snapshot.scenario.contentVersion !== scenario.contentVersion ||
        snapshot.state.completionReached)
    )
      return failure('INVALID_CHECKPOINT');
    const seed = op.kind === 'start' ? op.seed : snapshot!.seed;
    const incident = snapshot?.state ?? simulationJson(createIncidentState(scenario, { seed }));
    next.attempts.push({
      id: op.attemptId,
      incidentId: op.incidentId,
      seed,
      scenarioAuthority: canonicalJson(scenario),
      incident,
      baselineCommandCount: incident.replayLog.length,
      baselineEventCount: incident.eventLog.length,
      sourceBytes: op.kind === 'checkpoint' ? op.sourceBytes : null,
      acceptedInputIds: [],
    });
    next.activeAttemptId = op.attemptId;
    if (definition.behavior && next.behavior)
      startBehaviorAttempt(next.behavior, definition.behavior, op.attemptId, incident);
  } else if (op.kind === 'command') {
    const attempt = next.attempts.find((item) => item.id === op.attemptId);
    if (!attempt || next.activeAttemptId !== attempt.id || attempt.incident.completionReached)
      return failure('INVALID_ATTEMPT_HEAD');
    const scenario = incidentScenario(
      definition,
      catalog,
      attempt.incidentId,
      attempt.incident.contentVersion,
    )!;
    if (canonicalJson(scenario) !== attempt.scenarioAuthority)
      return failure('INCOMPATIBLE_SCENARIO');
    if (attempt.acceptedInputIds.includes(op.inputId)) return failure('CONFLICTING_INPUT');
    if (
      op.commandSequence !== attempt.incident.replayLog.length ||
      op.priorHead !== campaignAttemptHead(attempt)
    )
      return failure('INVALID_COMMAND_BOUNDARY');
    const guard = evaluateActionGate(
      definition,
      attempt.incidentId,
      attempt.incident.contentVersion,
      op.command.actionId,
      campaignActionContext(definition, prior),
    );
    if (!guard.ok) return { ok: false, diagnostics: guard.diagnostics };
    if (!guard.value) return failure('INELIGIBLE_CAMPAIGN_ACTION', op.command.actionId);
    const result = executeCommand(attempt.incident, scenario, op.command);
    if (!result.ok) return failure('REJECTED_COMMAND', op.command.actionId);
    const response = associateOpportunityResponses(definition, catalog, prior, next, op);
    if (!response.ok) return response;
    const source: BehaviorSource | undefined = definition.behavior
      ? {
          runId: op.runId,
          attemptId: op.attemptId,
          inputId: op.inputId,
          operationId: op.operationId,
          operationSequence: op.sequence,
          commandSequence: op.commandSequence,
          actionId: op.command.actionId,
          scenarioId: scenario.id,
          contentVersion: scenario.contentVersion,
          modelId: definition.behavior.id,
          modelVersion: definition.behavior.version,
          classificationVersion: definition.behavior.classificationVersion,
          formulaVersion: definition.behavior.formulaVersion,
        }
      : undefined;
    if (definition.behavior && next.behavior && source) {
      const diagnostics = beginBehaviorCommand(
        next.behavior,
        definition.behavior,
        source,
        attempt.incident,
      );
      if (diagnostics.length) return { ok: false, diagnostics };
    }
    attempt.incident = simulationJson(result.state);
    attempt.acceptedInputIds.push(op.inputId);
    const delivered = new Map<string, BehaviorSource | null>();
    for (const event of result.events) {
      if (definition.behavior && next.behavior && source)
        consumeBehaviorEvent(next.behavior, definition.behavior, source, event, delivered);
      projectOpportunityMetrics(definition, next);
      const error = projectEvents(definition, next, prior, attempt, op, [event]);
      if (error) return error;
    }
  } else if (op.kind === 'adopt') {
    if (op.legacySources !== undefined) {
      const bytes = legacySnapshotBytes(op.legacySources);
      if (!bytes || canonicalJson(bytes) !== canonicalJson(op.sourceBytes))
        return failure('INVALID_LEGACY_PROVENANCE');
    }
    const sources = op.sourceBytes.map((bytes) => sourceSnapshot(bytes, catalog));
    if (sources.some((source) => !source)) return failure('INVALID_ADOPTION_SOURCE');
    // Validate the entire batch before granting any membership. Current discovery
    // or another source in this batch does not prove original command eligibility.
    for (const [index, source] of sources.entries())
      if (
        sourceNeedsCampaignProof(definition, source!) &&
        !hasOriginalSourceProof(prior, op.sourceBytes[index]!)
      )
        return failure('UNPROVEN_PROTECTED_SOURCE');
    for (const source of sources) {
      for (const item of definition.evidence)
        if (
          item.scenarioId === source!.scenario.id &&
          source!.state.revealedEvidenceIds.includes(item.evidenceId)
        )
          add(next.projection.evidence, item.id);
      for (const item of definition.narratives)
        if (
          item.scenarioId === source!.scenario.id &&
          source!.state.triggeredNarrativeIds.includes(item.narrativeId)
        )
          add(next.projection.narratives, item.id);
    }
  } else if (op.kind === 'associate') {
    const attempt = next.attempts.find((item) => item.id === op.attemptId);
    const source = sourceSnapshot(op.sourceBytes, catalog);
    if (
      !attempt ||
      next.activeAttemptId !== attempt.id ||
      attempt.incident.completionReached ||
      !source ||
      op.priorHead !== campaignAttemptHead(attempt) ||
      source.seed !== attempt.seed ||
      canonicalJson(source.state) !== canonicalJson(attempt.incident)
    )
      return failure('INVALID_CHECKPOINT_ASSOCIATION');
    next.checkpointAssociations ??= [];
    next.checkpointAssociations.push({
      operationId: op.operationId,
      attemptId: attempt.id,
      head: op.priorHead,
      sourceBytes: op.sourceBytes,
    });
  }
  projectOpportunityMetrics(definition, next);
  next.operations.push(op);
  return { ok: true, disposition: 'candidate', run: next };
}

function replayCampaignUnchecked(
  input: unknown,
  catalog: ScenarioCatalog,
  operations: readonly unknown[],
  prefixes: Map<number, CampaignRun> = new Map(),
): CampaignResult {
  const validated = validateCampaignDefinition(input, catalog);
  if (!validated.ok) return validated;
  let run: CampaignRun | null = null;
  for (const operation of operations) {
    try {
      canonicalJson(operation);
    } catch {
      return failure('INVALID_OPERATION_JSON');
    }
    const parsed = campaignOperationSchema.safeParse(operation);
    if (!parsed.success) return failure('INVALID_OPERATION');
    const result = apply(validated.definition, catalog, run, parsed.data, prefixes);
    if (!result.ok) return result;
    // Stored chronology must not contain duplicate delivery as a new operation.
    if (result.disposition === 'duplicate') return failure('DUPLICATE_HISTORY_ENTRY');
    run = result.run;
    prefixes.set(run.revision, run);
  }
  return run ? { ok: true, disposition: 'candidate', run } : failure('MISSING_CREATION');
}

export function replayCampaign(
  definition: unknown,
  catalog: ScenarioCatalog,
  operations: readonly unknown[],
): CampaignResult {
  try {
    return replayCampaignUnchecked(definition, catalog, operations);
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

// Pure preparation is not a committed write; no official publication occurs here.
export function prepareCampaignOperation(
  definition: unknown,
  catalog: ScenarioCatalog,
  prior: CampaignRun | null,
  input: unknown,
): CampaignResult {
  try {
    canonicalJson(input);
    const prefixes = new Map<number, CampaignRun>();
    if (prior !== null) {
      canonicalJson(prior);
      const verified = replayCampaignUnchecked(definition, catalog, prior.operations, prefixes);
      if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(prior))
        return failure('INVALID_PRIOR_RECORD');
      prior = verified.run;
    }
    const validated = validateCampaignDefinition(definition, catalog);
    if (!validated.ok) return validated;
    const parsed = campaignOperationSchema.safeParse(input);
    if (!parsed.success) return failure('INVALID_OPERATION');
    return apply(validated.definition, catalog, prior, parsed.data, prefixes);
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

function getCampaignProgressionUnchecked(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
) {
  const verified = replayCampaign(definition, catalog, run.operations);
  if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(run))
    return failure('INVALID_PRIOR_RECORD');
  const validated = validateCampaignDefinition(definition, catalog);
  if (!validated.ok) return validated;
  return {
    ok: true as const,
    incidents: validated.definition.incidents.map((item) => ({
      id: item.id,
      act: item.act,
      result: eligible(validated.definition, run, item.id),
    })),
  };
}

export function getCampaignProgression(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
) {
  try {
    return getCampaignProgressionUnchecked(definition, catalog, run);
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

// Public read-only projection verifies the complete record before guard queries.
export function getCampaignActionAvailability(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
) {
  try {
    const checked = validateCampaignDefinition(definition, catalog);
    if (!checked.ok) return checked;
    const replay = replayCampaign(checked.definition, catalog, run.operations);
    if (!replay.ok || canonicalJson(replay.run) !== canonicalJson(run))
      return failure('INVALID_PRIOR_RECORD');
    const attempt = replay.run.attempts.find((a) => a.id === replay.run.activeAttemptId);
    if (!attempt)
      return {
        ok: true as const,
        actionIds: [] as string[],
        diagnostics: [] as CampaignDiagnostic[],
      };
    const scenario = incidentScenario(
      checked.definition,
      catalog,
      attempt.incidentId,
      attempt.incident.contentVersion,
    )!;
    return {
      ok: true as const,
      ...selectCampaignActionIds(
        checked.definition,
        scenario,
        attempt.incidentId,
        attempt.incident,
        campaignActionContext(checked.definition, replay.run),
      ),
    };
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

// Tool/test access only: cached values are not trusted without whole-history replay.
export function getCampaignBehavior(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
) {
  try {
    const verified = replayCampaign(definition, catalog, run.operations);
    if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(run))
      return failure('INVALID_PRIOR_RECORD');
    return { ok: true as const, behavior: verified.run.behavior ?? null };
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

// Read-only tool/test query. Evaluation grants no route, observation or effect.
export function getCampaignBranches(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
) {
  try {
    const verified = replayCampaign(definition, catalog, run.operations);
    if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(run))
      return failure('INVALID_PRIOR_RECORD');
    const validated = validateCampaignDefinition(definition, catalog);
    if (!validated.ok) return validated;
    return {
      ok: true as const,
      boundary: run.revision,
      branches: (validated.definition.branches ?? []).map((branch) => ({
        id: branch.id,
        version: branch.version,
        result: condition(
          validated.definition,
          verified.run,
          { type: 'all', children: [branch.eligibility, branch.reveal] },
          'branch',
        ),
      })),
    };
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

export function resumeCampaignAssociation(
  definition: unknown,
  catalog: ScenarioCatalog,
  run: CampaignRun,
  associationId: string,
  actualBytes: string,
) {
  try {
    canonicalJson(run);
    const verified = replayCampaign(definition, catalog, run.operations);
    if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(run))
      return failure('INVALID_PRIOR_RECORD');
    const association = run.checkpointAssociations?.find(
      (item) => item.operationId === associationId,
    );
    const attempt = association && run.attempts.find((item) => item.id === association.attemptId);
    const source = sourceSnapshot(actualBytes, catalog);
    if (
      !association ||
      !attempt ||
      attempt.id !== run.activeAttemptId ||
      attempt.incident.completionReached ||
      association.sourceBytes !== actualBytes ||
      association.head !== campaignAttemptHead(attempt) ||
      !source ||
      source.seed !== attempt.seed ||
      canonicalJson(source.state) !== canonicalJson(attempt.incident)
    )
      return failure('INVALID_CHECKPOINT_ASSOCIATION');
    return {
      ok: true as const,
      attempt: verified.run.attempts.find((item) => item.id === attempt.id)!,
    };
  } catch {
    return failure('INVALID_JSON_OR_RECORD');
  }
}

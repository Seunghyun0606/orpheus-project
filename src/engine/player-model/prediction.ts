import { z } from 'zod';
import { validateCampaignDefinition, type CampaignDefinition } from '../../scenario/campaign.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import type { Scenario } from '../../scenario/schema.ts';
import {
  predictionReferences,
  type PredictionDefinition,
  type PredictionScenario,
} from '../../scenario/prediction.ts';
import { getAvailableActionIds } from '../simulation.ts';
import { canonicalJson } from '../campaign/canonical.ts';
import {
  campaignObservations,
  campaignAttemptHead,
  replayCampaign,
  type CampaignRun,
  type CampaignAttempt,
} from '../campaign/transitions.ts';
import {
  evaluateCampaignCondition,
  orderedDiagnostics,
  type Condition,
  type Observation,
  type CampaignDiagnostic,
} from '../campaign/conditions.ts';

export interface PredictionSample {
  runId: string;
  attemptId: string;
  operationId: string;
  operationSequence: number;
  inputId: string;
  commandSequence: number;
  actionId: string;
  candidateId: string;
  contextId: string;
  scenarioId: string;
  contentVersion: string;
  preHistoryBoundary: number;
  preEventSequence: number;
  priorHead: string;
  observations: Record<string, Observation>;
}
export interface PredictionBoundary {
  runId: string;
  attemptId: string;
  historyBoundary: number;
  commandSequence: number;
  eventSequence: number;
  scenarioId: string;
  contentVersion: string;
  definitionId: string;
  definitionVersion: string;
  modelId: string;
  modelVersion: string;
  classificationVersion: string;
  formulaVersion: 1;
  contextId: string;
}
interface Support {
  boundary: PredictionBoundary;
  observations: Record<string, Observation>;
  availableCandidates: { candidateId: string; actionId: string }[];
  counts: { candidateId: string; count: number }[];
  eligibleTotal: number;
  samples: PredictionSample[];
}
export type PredictionResult =
  | { ok: false; diagnostics: CampaignDiagnostic[] }
  | { ok: true; result: { kind: 'gated'; boundary: PredictionBoundary } }
  | {
      ok: true;
      result: Support &
        (
          | { kind: 'predicted'; candidateId: string; actionId: string; confidence: number }
          | {
              kind: 'unknown';
              reason: 'EMPTY_CANDIDATES' | 'EMPTY_HISTORY' | 'INSUFFICIENT_SUPPORT' | 'TOP_TIE';
            }
        );
    };
const fail = (code: string, path = '$'): PredictionResult => ({
  ok: false,
  diagnostics: [{ code, path }],
});
const requestSchema = z.object({ contextId: z.string().min(1) }).strict();
type Catalog = ReadonlyMap<string, Scenario>;

function mappingFor(model: PredictionDefinition, attempt: CampaignAttempt) {
  return model.scenarios.find(
    (m) =>
      m.scenarioId === attempt.incident.scenarioId &&
      m.contentVersion === attempt.incident.contentVersion,
  )!;
}
function observationsFor(
  definition: CampaignDefinition,
  mapping: PredictionScenario,
  run: CampaignRun,
  attempt: CampaignAttempt,
): Record<string, Observation> {
  const campaign = campaignObservations(definition, run);
  const pre = attempt.incident;
  return Object.fromEntries(
    mapping.references.map((ref) => {
      if (ref.source === 'campaign') return [ref.id, campaign[ref.key]!];
      let value: number | boolean | string;
      switch (ref.source) {
        case 'elapsedSeconds':
          value = pre.elapsedSeconds;
          break;
        case 'signal':
          value = pre.signals[ref.key]!.value;
          break;
        case 'resource':
          value = pre.resources[ref.key]!.value;
          break;
        case 'flag':
          value = pre.flags[ref.key]!;
          break;
        case 'signal_revealed':
          value = pre.signals[ref.key]!.revealed;
          break;
        case 'evidence':
          value = pre.revealedEvidenceIds.includes(ref.key);
          break;
      }
      return [ref.id, { status: 'available', value }];
    }),
  );
}
function evaluate(
  model: PredictionDefinition,
  mapping: PredictionScenario,
  run: CampaignRun,
  observations: Record<string, Observation>,
  tree: Condition,
) {
  return evaluateCampaignCondition(tree, predictionReferences(mapping), {
    definitionVersion: model.version,
    kind: 'branch',
    runId: run.runId,
    boundary: run.revision,
    observations,
  });
}

// No I/O, cached prediction field, exposure operation or response observation.
// Every historical context is reconstructed at its own verified pre-command prefix.
export function getCampaignPrediction(
  definition: unknown,
  catalog: Catalog,
  run: CampaignRun,
  request: unknown,
): PredictionResult {
  try {
    canonicalJson(request);
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success) return fail('INVALID_PREDICTION_REQUEST');
    const checked = validateCampaignDefinition(definition, catalog);
    if (!checked.ok) return checked;
    const d = checked.definition;
    const verified = replayCampaign(d, catalog, run.operations);
    if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(run))
      return fail('INVALID_PRIOR_RECORD');
    // Work only with replay-owned values, never a caller's mutable projection.
    run = verified.run;
    const model = d.prediction;
    if (!model) return fail('NO_PINNED_PREDICTION_MODEL');
    const context = model.contexts.find((c) => c.id === parsed.data.contextId);
    if (!context) return fail('UNKNOWN_PREDICTION_CONTEXT', parsed.data.contextId);
    const attempt = run.attempts.find((a) => a.id === run.activeAttemptId);
    if (!attempt) return fail('MISSING_PREDICTION_ATTEMPT');
    const mapping = mappingFor(model, attempt);
    if (mapping.coverage === 'unsupported')
      return fail(
        'UNSUPPORTED_PREDICTION_COVERAGE',
        scenarioVersionKey(mapping.scenarioId, mapping.contentVersion),
      );
    const rules = mapping.contexts.find((c) => c.contextId === context.id)!;
    const observations = observationsFor(d, mapping, run, attempt);
    const applicable = evaluate(model, mapping, run, observations, rules.when);
    const reveal = evaluate(model, mapping, run, observations, rules.reveal);
    const choices = rules.choices.map((choice) => ({
      choice,
      result: evaluate(model, mapping, run, observations, choice.eligible),
    }));
    const diagnostics = [applicable, reveal, ...choices.map((c) => c.result)].flatMap((r) =>
      r.ok ? [] : r.diagnostics,
    );
    if (diagnostics.length) return { ok: false, diagnostics: orderedDiagnostics(diagnostics) };
    const boundary: PredictionBoundary = {
      runId: run.runId,
      attemptId: attempt.id,
      historyBoundary: run.revision,
      commandSequence: attempt.incident.replayLog.length,
      eventSequence: attempt.incident.nextEventSequence,
      scenarioId: attempt.incident.scenarioId,
      contentVersion: attempt.incident.contentVersion,
      definitionId: d.id,
      definitionVersion: d.version,
      modelId: model.id,
      modelVersion: model.version,
      classificationVersion: model.classificationVersion,
      formulaVersion: model.formulaVersion,
      contextId: context.id,
    };
    if (reveal.ok && !reveal.value) return { ok: true, result: { kind: 'gated', boundary } };
    if (applicable.ok && !applicable.value)
      return fail('INAPPLICABLE_PREDICTION_CONTEXT', context.id);
    const scenario = catalog.get(scenarioVersionKey(mapping.scenarioId, mapping.contentVersion))!;
    const engineAvailable = attempt.incident.completionReached
      ? []
      : getAvailableActionIds(attempt.incident, scenario);
    const availableCandidates = choices
      .filter((c) => c.result.ok && c.result.value && engineAvailable.includes(c.choice.actionId))
      .map((c) => ({ candidateId: c.choice.candidateId, actionId: c.choice.actionId }));
    const samples: PredictionSample[] = [];
    const counts = availableCandidates.map((c) => ({ candidateId: c.candidateId, count: 0 }));
    const support = (): Support => ({
      boundary,
      observations,
      availableCandidates,
      counts,
      eligibleTotal: samples.length,
      samples,
    });
    const unknown = (
      reason: 'EMPTY_CANDIDATES' | 'EMPTY_HISTORY' | 'INSUFFICIENT_SUPPORT' | 'TOP_TIE',
    ): PredictionResult => ({ ok: true, result: { ...support(), kind: 'unknown', reason } });
    if (!availableCandidates.length) return unknown('EMPTY_CANDIDATES');
    for (const op of run.operations) {
      if (op.kind !== 'command') continue;
      const prefix = replayCampaign(d, catalog, run.operations.slice(0, op.sequence));
      if (!prefix.ok) return prefix;
      const historical = prefix.run.attempts.find((a) => a.id === op.attemptId)!;
      const pastMapping = mappingFor(model, historical);
      if (pastMapping.coverage === 'unsupported')
        return fail('UNSUPPORTED_PREDICTION_COVERAGE', op.operationId);
      const pastRules = pastMapping.contexts.find((c) => c.contextId === context.id)!;
      const choice = pastRules.choices.find((c) => c.actionId === op.command.actionId);
      if (!choice || !availableCandidates.some((c) => c.candidateId === choice.candidateId))
        continue;
      const pastObservations = observationsFor(d, pastMapping, prefix.run, historical);
      const when = evaluate(model, pastMapping, prefix.run, pastObservations, pastRules.when);
      const eligible = evaluate(model, pastMapping, prefix.run, pastObservations, choice.eligible);
      const errors = [when, eligible].flatMap((r) => (r.ok ? [] : r.diagnostics));
      if (errors.length)
        return {
          ok: false,
          diagnostics: orderedDiagnostics(
            errors.map((e) => ({ ...e, path: op.operationId + '.' + e.path })),
          ),
        };
      if (!when.ok || !when.value || !eligible.ok || !eligible.value) continue;
      samples.push({
        runId: run.runId,
        attemptId: op.attemptId,
        operationId: op.operationId,
        operationSequence: op.sequence,
        inputId: op.inputId,
        commandSequence: op.commandSequence,
        actionId: op.command.actionId,
        candidateId: choice.candidateId,
        contextId: context.id,
        scenarioId: historical.incident.scenarioId,
        contentVersion: historical.incident.contentVersion,
        preHistoryBoundary: prefix.run.revision,
        preEventSequence: historical.incident.nextEventSequence,
        priorHead: campaignAttemptHead(historical),
        observations: pastObservations,
      });
      counts.find((c) => c.candidateId === choice.candidateId)!.count++;
    }
    if (!samples.length) return unknown('EMPTY_HISTORY');
    if (samples.length < context.minimumSamples) return unknown('INSUFFICIENT_SUPPORT');
    const top = Math.max(...counts.map((c) => c.count));
    const winners = counts.filter((c) => c.count === top);
    if (winners.length !== 1) return unknown('TOP_TIE');
    const winner = availableCandidates.find((c) => c.candidateId === winners[0]!.candidateId)!;
    return {
      ok: true,
      result: { ...support(), kind: 'predicted', ...winner, confidence: top / samples.length },
    };
  } catch {
    return fail('INVALID_JSON_OR_RECORD');
  }
}

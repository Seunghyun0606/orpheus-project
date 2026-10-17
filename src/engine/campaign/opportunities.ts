import { validateCampaignDefinition, type CampaignDefinition } from '../../scenario/campaign.ts';
import {
  opportunityMetrics,
  opportunityReferences,
  type OpportunityRule,
} from '../../scenario/opportunity.ts';
import type { Scenario } from '../../scenario/schema.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import { selectCampaignActionIds, evaluateActionGate } from './action-gates.ts';
import { observeIncident } from './incident-observation.ts';
import {
  calculateVerifiedPrediction,
  verifiedPredictionContext,
  type PredictionResult,
  type PredictionContext,
} from '../player-model/prediction.ts';
import {
  evaluateCampaignCondition,
  type Condition,
  type Observation,
  type CampaignDiagnostic,
  type ConditionResult,
  orderedDiagnostics,
} from './conditions.ts';
import {
  campaignObservations,
  campaignActionContext,
  campaignAttemptHead,
  verifyCampaignRun,
  type CampaignRun,
  type CampaignOperation,
  type CampaignResult,
} from './transitions.ts';

export interface OpportunityPreparation {
  kind: OpportunityRule['kind'];
  metric: OpportunityRule['metric'];
  recommendedActionId?: string;
  id: string;
  ruleId: string;
  modelId: string;
  modelVersion: string;
  formulaVersion: 1;
  attemptId: string;
  operationId: string;
  historyBoundary: number;
  priorHead: string;
  atSeconds: number;
  scenarioId: string;
  contentVersion: string;
  presentation: OpportunityRule['presentation'];
  observations: Record<string, Observation>;
  prediction: PredictionResult | null;
}

// Read-only current display gate. Historical preparation is not permission to
// redisplay content whose authored gate or candidate availability has closed.
export function getCampaignPresentation(
  definition: unknown,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
  preparationId: string,
):
  | { ok: true; presentation: OpportunityPreparation | null }
  | { ok: false; diagnostics: CampaignDiagnostic[] } {
  try {
    const checked = validateCampaignDefinition(definition, catalog);
    if (!checked.ok) return checked;
    const d = checked.definition;
    const verifiedRun = verifyCampaignRun(d, catalog, run);
    if (!verifiedRun)
      return { ok: false, diagnostics: [{ code: 'INVALID_PRIOR_RECORD', path: '$' }] };
    const verified = { run: verifiedRun };
    const p = verified.run.opportunities?.preparations.find((p) => p.id === preparationId);
    if (
      !p ||
      p.attemptId !== verified.run.activeAttemptId ||
      verified.run.opportunities!.responses.some((r) => r.preparationId === p.id)
    )
      return { ok: true, presentation: null };
    const a = verified.run.attempts.find((a) => a.id === p.attemptId)!;
    if (a.incident.completionReached) return { ok: true, presentation: null };
    const rule = d.opportunities!.rules.find((r) => r.id === p.ruleId)!;
    const observations = context(d, verified.run, rule, p.atSeconds);
    const checks = [rule.available, rule.reveal, rule.valid].map((tree) =>
      evaluate(d, verified.run, rule, observations, tree),
    );
    const diagnostics = checks.flatMap((c) => (c.ok ? [] : c.diagnostics));
    if (diagnostics.length) return { ok: false, diagnostics };
    if (checks.some((c) => c.ok && !c.value)) return { ok: true, presentation: null };
    const choiceGuard = choiceActionGuard(
      d,
      verified.run,
      a.incidentId,
      a.incident.contentVersion,
      rule,
    );
    if (!choiceGuard.ok) return choiceGuard;
    if (!choiceGuard.value) return { ok: true, presentation: null };
    const scenario = catalog.get(
      scenarioVersionKey(a.incident.scenarioId, a.incident.contentVersion),
    )!;
    const availability = selectCampaignActionIds(
      d,
      scenario,
      a.incidentId,
      a.incident,
      campaignActionContext(d, verified.run),
      rule.kind === 'recommendation'
        ? [rule.recommendedActionId!]
        : rule.responses.map((r) => r.actionId),
    );
    if (availability.diagnostics.length)
      return { ok: false, diagnostics: availability.diagnostics };
    if (
      rule.kind === 'recommendation' &&
      !availability.actionIds.includes(rule.recommendedActionId!)
    )
      return { ok: true, presentation: null };
    if (rule.kind === 'prediction') {
      const current = verifiedPredictionContext(d, catalog, verified.run, rule.contextId!);
      if (!current.ok) return current;
      if (current.gated || !p.prediction?.ok || p.prediction.result.kind !== 'predicted')
        return { ok: true, presentation: null };
      const exposed = p.prediction.result;
      if (
        !current.context?.availableCandidates.some(
          (c) => c.actionId === exposed.actionId && c.candidateId === exposed.candidateId,
        )
      )
        return { ok: true, presentation: null };
    }
    return { ok: true, presentation: p };
  } catch {
    return { ok: false, diagnostics: [{ code: 'INVALID_JSON_OR_RECORD', path: '$' }] };
  }
}
export interface OpportunityResponse {
  preparationId: string;
  acknowledgementId: string;
  metric: OpportunityRule['metric'];
  ruleId: string;
  modelId: string;
  modelVersion: string;
  formulaVersion: 1;
  attemptId: string;
  operationId: string;
  inputId: string;
  operationSequence: number;
  commandSequence: number;
  actionId: string;
  priorHead: string;
  positive: boolean;
  observations: Record<string, Observation>;
  predictionContext?: PredictionContext;
}
export interface OpportunityState {
  preparations: OpportunityPreparation[];
  acknowledgements: {
    preparationId: string;
    operationId: string;
    historyBoundary: number;
    priorHead: string;
    surfaceId: string;
    observations: Record<string, Observation>;
  }[];
  responses: OpportunityResponse[];
}
type Result = { ok: true } | { ok: false; diagnostics: CampaignDiagnostic[] };
const fail = (code: string, path = '$'): Result => ({ ok: false, diagnostics: [{ code, path }] });
function choiceActionGuard(
  d: CampaignDefinition,
  run: CampaignRun,
  incidentId: string,
  contentVersion: string,
  rule: OpportunityRule,
): ConditionResult {
  if (rule.kind !== 'choice') return { ok: true, value: true };
  const checks = [...new Set(rule.responses.map((r) => r.actionId))].map((id) =>
    evaluateActionGate(d, incidentId, contentVersion, id, campaignActionContext(d, run)),
  );
  const diagnostics = orderedDiagnostics(checks.flatMap((c) => (c.ok ? [] : c.diagnostics)));
  return diagnostics.length
    ? { ok: false, diagnostics }
    : { ok: true, value: checks.every((c) => c.ok && c.value) };
}
function context(
  d: CampaignDefinition,
  run: CampaignRun,
  rule: OpportunityRule,
  preparedAt: number,
) {
  const pre = run.attempts.find((a) => a.id === run.activeAttemptId)!.incident;
  const campaign = campaignObservations(d, run);
  return Object.fromEntries(
    rule.references.map((ref) => {
      if (ref.source === 'campaign') return [ref.id, campaign[ref.key]!];
      const value = observeIncident(pre, ref) ?? specific();
      function specific(): number | string | boolean {
        switch (ref.source) {
          case 'ageSeconds':
            return pre.elapsedSeconds - preparedAt;
          default:
            throw new Error('Unsupported observation source');
        }
      }
      return [ref.id, { status: 'available', value }];
    }),
  ) as Record<string, Observation>;
}
function evaluate(
  d: CampaignDefinition,
  run: CampaignRun,
  rule: OpportunityRule,
  observations: Record<string, Observation>,
  tree: Condition,
) {
  return evaluateCampaignCondition(tree, opportunityReferences(rule), {
    definitionVersion: d.opportunities!.version,
    kind: 'branch',
    runId: run.runId,
    boundary: run.revision,
    observations,
  });
}
export function applyOpportunityOperation(
  d: CampaignDefinition,
  catalog: ReadonlyMap<string, Scenario>,
  before: CampaignRun,
  next: CampaignRun,
  op: CampaignOperation,
  prefixAt: (length: number) => CampaignResult,
): Result {
  if (op.kind !== 'prepare_opportunity' && op.kind !== 'acknowledge_presentation')
    return fail('INVALID_OPPORTUNITY_OPERATION');
  const state = next.opportunities;
  const attempt = before.attempts.find((a) => a.id === op.attemptId);
  if (
    !d.opportunities ||
    !state ||
    !attempt ||
    before.activeAttemptId !== attempt.id ||
    attempt.incident.completionReached ||
    op.priorHead !== campaignAttemptHead(attempt)
  )
    return fail('INVALID_PRESENTATION_BOUNDARY');
  const existing = state.preparations.find((p) => p.id === op.preparationId);
  const rule = d.opportunities.rules.find(
    (r) => r.id === (op.kind === 'prepare_opportunity' ? op.ruleId : existing?.ruleId),
  );
  if (
    !rule ||
    rule.incidentId !== attempt.incidentId ||
    rule.contentVersion !== attempt.incident.contentVersion
  )
    return fail('UNSUPPORTED_OPPORTUNITY');
  const observations = context(
    d,
    before,
    rule,
    existing?.atSeconds ?? attempt.incident.elapsedSeconds,
  );
  const checked = [rule.available, rule.reveal, rule.valid].map((tree) =>
    evaluate(d, before, rule, observations, tree),
  );
  const diagnostics = checked.flatMap((r) => (r.ok ? [] : r.diagnostics));
  if (diagnostics.length) return { ok: false, diagnostics };
  if (checked.some((r) => r.ok && !r.value)) return fail('UNAVAILABLE_PRESENTATION');
  const choiceGuard = choiceActionGuard(
    d,
    before,
    attempt.incidentId,
    attempt.incident.contentVersion,
    rule,
  );
  if (!choiceGuard.ok) return choiceGuard;
  if (!choiceGuard.value) return fail('UNAVAILABLE_PRESENTATION');
  const scenario = catalog.get(
    scenarioVersionKey(attempt.incident.scenarioId, rule.contentVersion),
  )!;
  const guarded = selectCampaignActionIds(
    d,
    scenario,
    attempt.incidentId,
    attempt.incident,
    campaignActionContext(d, before),
    rule.kind === 'recommendation'
      ? [rule.recommendedActionId!]
      : rule.responses.map((r) => r.actionId),
  );
  if (guarded.diagnostics.length) return { ok: false, diagnostics: guarded.diagnostics };
  const available = guarded.actionIds;
  if (rule.kind === 'recommendation' && !available.includes(rule.recommendedActionId!))
    return fail('UNAVAILABLE_RECOMMENDATION');
  if (op.kind === 'prepare_opportunity') {
    if (existing) return fail('CONFLICTING_PREPARATION');
    if (
      state.preparations.some(
        (p) => p.ruleId === rule.id && p.attemptId === attempt.id && p.priorHead === op.priorHead,
      )
    )
      return fail('DUPLICATE_PRESENTATION_BOUNDARY');
    const prediction =
      rule.kind === 'prediction'
        ? calculateVerifiedPrediction(d, catalog, before, { contextId: rule.contextId }, prefixAt)
        : null;
    if (prediction && (!prediction.ok || prediction.result.kind !== 'predicted'))
      return fail('NO_VALID_PREDICTION');
    state.preparations.push({
      kind: rule.kind,
      metric: rule.metric,
      ...(rule.recommendedActionId ? { recommendedActionId: rule.recommendedActionId } : {}),
      id: op.preparationId,
      ruleId: rule.id,
      modelId: d.opportunities.id,
      modelVersion: d.opportunities.version,
      formulaVersion: d.opportunities.formulaVersion,
      attemptId: attempt.id,
      operationId: op.operationId,
      historyBoundary: before.revision,
      priorHead: op.priorHead,
      atSeconds: attempt.incident.elapsedSeconds,
      scenarioId: scenario.id,
      contentVersion: scenario.contentVersion,
      presentation: { ...rule.presentation },
      observations,
      prediction,
    });
  } else {
    if (
      !existing ||
      existing.attemptId !== attempt.id ||
      existing.priorHead !== op.priorHead ||
      op.surfaceId !== rule.presentation.id ||
      state.acknowledgements.some((a) => a.preparationId === existing.id)
    )
      return fail('INVALID_PRESENTATION_ACK');
    if (rule.kind === 'prediction') {
      const current = verifiedPredictionContext(d, catalog, before, rule.contextId!);
      if (!current.ok) return current;
      const prediction = existing.prediction;
      if (current.gated || !prediction?.ok || prediction.result.kind !== 'predicted')
        return fail('UNAVAILABLE_EXPOSED_PREDICTION');
      const exposed = prediction.result;
      if (
        !current.context?.availableCandidates.some(
          (c) => c.actionId === exposed.actionId && c.candidateId === exposed.candidateId,
        )
      )
        return fail('UNAVAILABLE_EXPOSED_PREDICTION');
    }
    state.acknowledgements.push({
      preparationId: existing.id,
      operationId: op.operationId,
      historyBoundary: before.revision,
      priorHead: op.priorHead,
      surfaceId: op.surfaceId,
      observations,
    });
  }
  return { ok: true };
}
export function associateOpportunityResponses(
  d: CampaignDefinition,
  catalog: ReadonlyMap<string, Scenario>,
  before: CampaignRun,
  next: CampaignRun,
  op: Extract<CampaignOperation, { kind: 'command' }>,
): Result {
  if (!next.opportunities || !d.opportunities) return { ok: true };
  const state = next.opportunities;
  const attempt = before.attempts.find((a) => a.id === op.attemptId)!;
  const available = selectCampaignActionIds(
    d,
    catalog.get(scenarioVersionKey(attempt.incident.scenarioId, attempt.incident.contentVersion))!,
    attempt.incidentId,
    attempt.incident,
    campaignActionContext(d, before),
  ).actionIds;
  const candidates: OpportunityResponse[] = [];
  for (const ack of state.acknowledgements) {
    const prep = state.preparations.find((p) => p.id === ack.preparationId)!;
    if (prep.attemptId !== attempt.id || state.responses.some((r) => r.preparationId === prep.id))
      continue;
    const rule = d.opportunities.rules.find((r) => r.id === prep.ruleId)!;
    const choiceGuard = choiceActionGuard(
      d,
      before,
      attempt.incidentId,
      attempt.incident.contentVersion,
      rule,
    );
    if (!choiceGuard.ok) return choiceGuard;
    if (!choiceGuard.value) continue;
    const response = rule.responses.find((r) => r.actionId === op.command.actionId);
    const observations = context(d, before, rule, prep.atSeconds);
    // Continuing validity always validates, even if this command is unrelated.
    const trees = [
      rule.available,
      rule.reveal,
      rule.valid,
      ...(response ? [response.eligible, ...(response.positive ? [response.positive] : [])] : []),
    ];
    const checks = trees.map((tree) => evaluate(d, before, rule, observations, tree));
    const diagnostics = checks.flatMap((c) => (c.ok ? [] : c.diagnostics));
    if (diagnostics.length) return { ok: false, diagnostics };
    if (!response || checks.slice(0, 4).some((c) => c.ok && !c.value)) continue;
    const last = checks.at(-1)!;
    let positive = last.ok && last.value;
    let predictionContext: PredictionContext | undefined;
    if (rule.kind === 'prediction') {
      const prediction = prep.prediction;
      if (!prediction?.ok || prediction.result.kind !== 'predicted')
        return fail('INVALID_EXPOSED_PREDICTION');
      const exposed = prediction.result;
      const current = verifiedPredictionContext(d, catalog, before, rule.contextId!);
      if (!current.ok) return current;
      if (
        current.gated ||
        !current.context ||
        !current.context.availableCandidates.some(
          (c) => c.actionId === exposed.actionId && c.candidateId === exposed.candidateId,
        ) ||
        !current.context.availableCandidates.some((c) => c.actionId === response.actionId)
      )
        continue;
      predictionContext = current.context;
      if (
        !available.includes(prediction.result.actionId) ||
        !prediction.result.availableCandidates.some((c) => c.actionId === response.actionId)
      )
        continue;
      positive = response.actionId !== prediction.result.actionId;
    } else if (rule.kind === 'recommendation') {
      const guard = evaluateActionGate(
        d,
        attempt.incidentId,
        attempt.incident.contentVersion,
        rule.recommendedActionId!,
        campaignActionContext(d, before),
      );
      if (!guard.ok) return guard;
      if (!available.includes(rule.recommendedActionId!)) continue;
      positive = response.actionId === rule.recommendedActionId;
    }
    candidates.push({
      preparationId: prep.id,
      acknowledgementId: ack.operationId,
      metric: rule.metric,
      ruleId: rule.id,
      modelId: prep.modelId,
      modelVersion: prep.modelVersion,
      formulaVersion: prep.formulaVersion,
      attemptId: attempt.id,
      operationId: op.operationId,
      inputId: op.inputId,
      operationSequence: op.sequence,
      commandSequence: op.commandSequence,
      actionId: op.command.actionId,
      priorHead: op.priorHead,
      positive,
      observations,
      ...(predictionContext ? { predictionContext } : {}),
    });
  }
  for (const metric of opportunityMetrics)
    if (candidates.filter((c) => c.metric === metric).length > 1)
      return fail('AMBIGUOUS_RESPONSE_ASSOCIATION', metric);
  state.responses.push(...candidates);
  return { ok: true };
}
export function projectOpportunityMetrics(d: CampaignDefinition, run: CampaignRun): void {
  if (!d.opportunities || !run.opportunities || !run.behavior) return;
  for (const metric of opportunityMetrics) {
    const responses = run.opportunities.responses.filter((r) => r.metric === metric);
    const numerator = responses.filter((r) => r.positive).length;
    const denominator = responses.length;
    const commandAttempts = run.behavior.attempts.filter((a) => a.acceptedCommandCount > 0);
    const supportedCommandAttempts = commandAttempts.filter((a) => {
      const attempt = run.attempts.find((t) => t.id === a.attemptId)!;
      return d.opportunities!.rules.some(
        (rule) =>
          rule.metric === metric &&
          rule.incidentId === attempt.incidentId &&
          rule.contentVersion === a.contentVersion,
      );
    }).length;
    const details = {
      numerator,
      denominator,
      coverage: {
        supportedCommandAttempts,
        unsupportedCommandAttempts: commandAttempts.length - supportedCommandAttempts,
      },
      provenance: responses.map((r) => r.operationId),
    };
    run.behavior.metrics[metric] = denominator
      ? { ...details, status: 'available', value: numerator / denominator }
      : {
          ...details,
          status: 'unavailable',
          reason: 'No eligible response to committed authored presentation',
        };
  }
}

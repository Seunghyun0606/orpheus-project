import {
  metricKeys,
  behaviorConditionReferences,
  type BehaviorDefinition,
  type BehaviorScenario,
  type BehaviorMetricKey,
} from '../../scenario/behavior.ts';
import { canonicalJson } from '../campaign/canonical.ts';
import { observeIncident } from '../campaign/incident-observation.ts';
import {
  evaluateCampaignCondition,
  type Observation,
  type CampaignDiagnostic,
} from '../campaign/conditions.ts';
import type { EngineEvent, IncidentState } from '../types.ts';

export interface BehaviorSource {
  runId: string;
  attemptId: string;
  inputId: string;
  operationId: string;
  operationSequence: number;
  commandSequence: number;
  actionId: string;
  scenarioId: string;
  contentVersion: string;
  modelId: string;
  modelVersion: string;
  classificationVersion: string;
  formulaVersion: 1;
}
export interface InvestigationObservation {
  id: string;
  key: string;
  ruleId: string;
  source: BehaviorSource;
  resultOperationId: string;
  eventSequence: number;
  atSeconds: number;
}
export interface BehaviorSample {
  source: BehaviorSource;
  preEventSequence: number;
  operational: boolean;
  restart: boolean;
  rollback: boolean;
  evidenceEligible: boolean;
  support: { ruleId: string; observationId: string }[];
}
interface BehaviorAttempt {
  attemptId: string;
  scenarioId: string;
  contentVersion: string;
  coverage: 'supported' | 'unsupported';
  reason: string | null;
  acceptedCommandCount: number;
  samples: BehaviorSample[];
  observations: InvestigationObservation[];
  distinctKeys: string[];
  pending: { eventId: string; dueAtSeconds: number; source: BehaviorSource | null }[];
}
interface MetricDetails {
  numerator: number;
  denominator: number;
  coverage: { supportedCommandAttempts: number; unsupportedCommandAttempts: number };
  provenance: string[];
}
export type BehaviorMetric = MetricDetails &
  ({ status: 'available'; value: number } | { status: 'unavailable'; reason: string });
export interface BehaviorState {
  modelId: string;
  modelVersion: string;
  classificationVersion: string;
  formulaVersion: 1;
  attempts: BehaviorAttempt[];
  metrics: Record<BehaviorMetricKey, BehaviorMetric>;
}
export function createBehaviorState(model: BehaviorDefinition): BehaviorState {
  const state = {
    modelId: model.id,
    modelVersion: model.version,
    classificationVersion: model.classificationVersion,
    formulaVersion: model.formulaVersion,
    attempts: [],
    metrics: {} as BehaviorState['metrics'],
  };
  refreshBehaviorMetrics(state);
  return state;
}
function mappingFor(
  model: BehaviorDefinition,
  incident: Pick<IncidentState, 'scenarioId' | 'contentVersion'>,
) {
  return model.scenarios.find(
    (m) => m.scenarioId === incident.scenarioId && m.contentVersion === incident.contentVersion,
  )!;
}
export function startBehaviorAttempt(
  state: BehaviorState,
  model: BehaviorDefinition,
  attemptId: string,
  incident: IncidentState,
): void {
  const mapping = mappingFor(model, incident);
  state.attempts.push({
    attemptId,
    scenarioId: incident.scenarioId,
    contentVersion: incident.contentVersion,
    coverage: mapping.coverage,
    reason: mapping.coverage === 'unsupported' ? mapping.reason : null,
    acceptedCommandCount: 0,
    samples: [],
    observations: [],
    distinctKeys: [],
    // Inherited pending work has no new accepted source, even if it returns later.
    pending: [...incident.scheduledWork]
      .sort((a, b) => a.scheduleSequence - b.scheduleSequence)
      .filter((w) => w.kind === 'timer_event')
      .map((w) => ({ eventId: w.eventId, dueAtSeconds: w.dueAtSeconds, source: null })),
  });
  refreshBehaviorMetrics(state);
}
function supportContext(
  mapping: BehaviorScenario,
  pre: IncidentState,
  source: BehaviorSource,
  observation: InvestigationObservation,
): Record<string, Observation> {
  return Object.fromEntries(
    mapping.references.map((ref) => {
      const value = observeIncident(pre, ref) ?? specific();
      function specific(): number | string | boolean {
        switch (ref.source) {
          case 'ageSeconds':
            return pre.elapsedSeconds - observation.atSeconds;
          case 'supportKey':
            return observation.key;
          case 'actionId':
            return source.actionId;
          default:
            throw new Error('Unsupported observation source');
        }
      }
      return [ref.id, { status: 'available', value }];
    }),
  );
}
// Mutate only the preparation's owned copy. None of these helpers publish a commit.
export function beginBehaviorCommand(
  state: BehaviorState,
  model: BehaviorDefinition,
  source: BehaviorSource,
  pre: IncidentState,
): CampaignDiagnostic[] {
  const attempt = state.attempts.find((a) => a.attemptId === source.attemptId)!;
  const mapping = mappingFor(model, pre);
  attempt.acceptedCommandCount++;
  if (mapping.coverage === 'unsupported') {
    refreshBehaviorMetrics(state);
    return [];
  }
  const classification = mapping.actions.find((a) => a.actionId === source.actionId)!;
  const support: BehaviorSample['support'] = [];
  if (classification.evidenceEligible) {
    for (const rule of mapping.supportRules.filter((r) => r.actionId === source.actionId)) {
      for (const observation of attempt.observations.filter((o) =>
        rule.investigationKeys.includes(o.key),
      )) {
        const context = {
          definitionVersion: model.version,
          kind: 'effect' as const,
          runId: source.runId,
          boundary: source.operationSequence,
          observations: supportContext(mapping, pre, source, observation),
        };
        // All required leaves in both authored trees validate even if one is false.
        const relevance = evaluateCampaignCondition(
          rule.relevance,
          behaviorConditionReferences(mapping),
          context,
        );
        const freshness = evaluateCampaignCondition(
          rule.freshness,
          behaviorConditionReferences(mapping),
          context,
        );
        if (!relevance.ok || !freshness.ok)
          return [
            ...(!relevance.ok ? relevance.diagnostics : []),
            ...(!freshness.ok ? freshness.diagnostics : []),
          ];
        if (relevance.value && freshness.value)
          support.push({ ruleId: rule.id, observationId: observation.id });
      }
    }
  }
  attempt.samples.push({
    source,
    preEventSequence: pre.nextEventSequence,
    operational: classification.operational,
    restart: classification.restart,
    rollback: classification.rollback,
    evidenceEligible: classification.evidenceEligible,
    support,
  });
  refreshBehaviorMetrics(state);
  return [];
}
export function consumeBehaviorEvent(
  state: BehaviorState,
  model: BehaviorDefinition,
  source: BehaviorSource,
  event: EngineEvent,
  delivered: Map<string, BehaviorSource | null>,
): void {
  const attempt = state.attempts.find((a) => a.attemptId === source.attemptId)!;
  const mapping = mappingFor(model, attempt);
  if (mapping.coverage === 'unsupported') return;
  if (event.type === 'event_scheduled') {
    // Validation permits one direct scheduling action and rejects indirect origins.
    const attributable = mapping.investigations.some(
      (rule) =>
        rule.actionId === source.actionId &&
        rule.result.kind !== 'action_completed' &&
        rule.result.delivery.kind === 'timer' &&
        rule.result.delivery.eventId === event.sourceId,
    );
    attempt.pending.push({
      eventId: event.sourceId!,
      dueAtSeconds: event.dueAtSeconds!,
      source: attributable ? source : null,
    });
  } else if (
    event.type === 'event_fired' ||
    (event.type === 'event_cancelled' && event.targetId === undefined)
  ) {
    const index = attempt.pending.findIndex(
      (p) => p.eventId === event.sourceId && p.dueAtSeconds === event.atSeconds,
    );
    const origin = index >= 0 ? attempt.pending.splice(index, 1)[0]!.source : null;
    delivered.set(event.sourceId!, event.type === 'event_fired' ? origin : null);
  } else if (event.type === 'event_cancelled') {
    attempt.pending = attempt.pending.filter((p) => p.eventId !== event.targetId);
  }
  for (const rule of mapping.investigations) {
    const result = rule.result;
    let origin: BehaviorSource | null | undefined;
    if (result.kind === 'action_completed') {
      if (
        event.type !== 'action_completed' ||
        event.sourceId !== rule.actionId ||
        source.actionId !== rule.actionId
      )
        continue;
      origin = source;
    } else {
      if (
        event.type !== result.kind ||
        event.targetId !== (result.kind === 'signal_revealed' ? result.signalId : result.messageId)
      )
        continue;
      if (result.delivery.kind === 'action') {
        if (event.sourceId !== rule.actionId || source.actionId !== rule.actionId) continue;
        origin = source;
      } else {
        if (event.sourceId !== result.delivery.eventId) continue;
        origin = delivered.get(result.delivery.eventId);
        if (origin?.actionId !== rule.actionId) continue;
      }
    }
    if (!origin) continue;
    const observation: InvestigationObservation = {
      id: canonicalJson([origin.runId, origin.attemptId, origin.inputId, rule.id, event.sequence]),
      key: rule.key,
      ruleId: rule.id,
      source: origin,
      resultOperationId: source.operationId,
      eventSequence: event.sequence,
      atSeconds: event.atSeconds,
    };
    attempt.observations.push(observation);
    if (!attempt.distinctKeys.includes(rule.key)) attempt.distinctKeys.push(rule.key);
  }
  refreshBehaviorMetrics(state);
}
export function refreshBehaviorMetrics(state: BehaviorState): void {
  const eligible = state.attempts.filter(
    (a) => a.coverage === 'supported' && a.acceptedCommandCount > 0,
  );
  const unsupported = state.attempts.filter(
    (a) => a.coverage === 'unsupported' && a.acceptedCommandCount > 0,
  );
  const samples = eligible.flatMap((a) => a.samples);
  const operational = samples.filter((s) => s.operational);
  const evidence = samples.filter((s) => s.evidenceEligible);
  const counts: Partial<Record<BehaviorMetricKey, [number, number, string[]]>> = {
    restartRate: [
      operational.filter((s) => s.restart).length,
      operational.length,
      operational.map((s) => canonicalJson(s.source)),
    ],
    rollbackRate: [
      operational.filter((s) => s.rollback).length,
      operational.length,
      operational.map((s) => canonicalJson(s.source)),
    ],
    evidenceBeforeActionRate: [
      evidence.filter((s) => s.support.length > 0).length,
      evidence.length,
      evidence.map((s) => canonicalJson(s.source)),
    ],
    averageInvestigationDepth: [
      eligible.reduce((total, a) => total + a.distinctKeys.length, 0),
      eligible.length,
      eligible.map((a) => a.attemptId),
    ],
  };
  state.metrics = Object.fromEntries(
    metricKeys.map((key) => {
      const count = counts[key];
      const [numerator, denominator, provenance] = count ?? [0, 0, []];
      const details: MetricDetails = {
        numerator,
        denominator,
        provenance,
        coverage: {
          supportedCommandAttempts: eligible.length,
          unsupportedCommandAttempts: unsupported.length,
        },
      };
      const reason = !count
        ? 'NO_RECORDED_OPPORTUNITIES'
        : unsupported.length
          ? 'UNSUPPORTED_COVERAGE'
          : denominator === 0
            ? 'NO_ELIGIBLE_SAMPLES'
            : null;
      return [
        key,
        reason === null
          ? { ...details, status: 'available', value: numerator / denominator }
          : { ...details, status: 'unavailable', reason },
      ];
    }),
  ) as BehaviorState['metrics'];
}

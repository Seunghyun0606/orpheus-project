// Authored for deferred QA. Unit projections below are not official campaign runs.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  behaviorDefinitionSchema,
  validateBehaviorDefinition,
  type BehaviorDefinition,
} from '../scenario/behavior.ts';
import {
  predictionDefinitionSchema,
  validatePredictionDefinition,
} from '../scenario/prediction.ts';
import { campaignDefinitionSchema } from '../scenario/campaign.ts';
import { scenarioVersionKey, validateVersionedScenarioCatalog } from '../scenario/catalog.ts';
import { createIncidentState, executeCommand } from '../engine/index.ts';
import {
  beginBehaviorCommand,
  consumeBehaviorEvent,
  createBehaviorState,
  startBehaviorAttempt,
  type BehaviorSource,
} from '../engine/player-model/behavior.ts';
import type { Scenario } from '../scenario/schema.ts';
import type { BehaviorMetricKey } from '../scenario/behavior.ts';

const root = 'authoring/campaign-1.0/models/';
const productionBehavior = behaviorDefinitionSchema.parse(
  parse(readFileSync(root + 'orpheus-player-behavior.yaml', 'utf8')),
);
const productionPrediction = predictionDefinitionSchema.parse(
  parse(readFileSync(root + 'orpheus-player-prediction.yaml', 'utf8')),
);
const bindings = parse(readFileSync('authoring/campaign-1.0/TASK-028.model-bindings.yaml', 'utf8'));
// Preserve this suite's original eight-Incident scope. The new opportunity suite
// separately validates complete current authoring coverage, not this projection.
const earlyIds = new Set(Array.from({ length: 8 }, (_, i) => 'INC-00' + (i + 1)));
const behavior = {
  ...productionBehavior,
  scenarios: productionBehavior.scenarios.filter((m) => earlyIds.has(m.scenarioId)),
};
const prediction = {
  ...productionPrediction,
  scenarios: productionPrediction.scenarios.filter((m) => earlyIds.has(m.scenarioId)),
};
function catalog() {
  const result = validateVersionedScenarioCatalog(
    Array.from({ length: 8 }, (_, i) => {
      const file = 'src/scenario/data/full-campaign/incidents/inc-00' + (i + 1) + '.yaml';
      return { file, source: readFileSync(file, 'utf8') };
    }),
  );
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  return result.scenarios;
}
function source(
  model: BehaviorDefinition,
  s: Scenario,
  sequence: number,
  actionId: string,
): BehaviorSource {
  return {
    runId: 'unit-run',
    attemptId: 'unit-attempt',
    inputId: 'input-' + sequence,
    operationId: 'operation-' + sequence,
    operationSequence: sequence,
    commandSequence: sequence,
    actionId,
    scenarioId: s.id,
    contentVersion: s.contentVersion,
    modelId: model.id,
    modelVersion: model.version,
    classificationVersion: model.classificationVersion,
    formulaVersion: model.formulaVersion,
  };
}
function projection(s: Scenario, initial = createIncidentState(s, { seed: 4172 })) {
  let incident = initial;
  const state = createBehaviorState(behavior);
  startBehaviorAttempt(state, behavior, 'unit-attempt', incident);
  let sequence = 0;
  const perform = (actionId: string) => {
    const result = executeCommand(incident, s, { type: 'perform_action', actionId });
    if (!result.ok) throw new Error('Rejected unit input: ' + actionId);
    const origin = source(behavior, s, sequence++, actionId);
    expect(beginBehaviorCommand(state, behavior, origin, incident)).toEqual([]);
    const delivered = new Map<string, BehaviorSource | null>();
    for (const event of result.events)
      consumeBehaviorEvent(state, behavior, origin, event, delivered);
    incident = result.state;
  };
  return { state, perform, incident: () => incident };
}
function metric(state: ReturnType<typeof createBehaviorState>, key: BehaviorMetricKey) {
  const result = state.metrics[key];
  if (result.status !== 'available') throw new Error(key + ': ' + result.reason);
  return result;
}

describe('DEC-044 early production baseline — deferred verification', () => {
  it('uses new explicit authorities, valid exact early mappings and no fixture defaults', () => {
    const scenes = catalog();
    const allowed = [...scenes.values()].map((s) => ({
      scenarioId: s.id,
      contentVersion: s.contentVersion,
    }));
    expect(behavior.id).toBe('orpheus-player-behavior');
    expect(prediction.id).toBe('orpheus-player-prediction');
    expect(behavior.version).toBe('1.0.0');
    expect(behavior.classificationVersion).toBe('1.0.0');
    expect(validateBehaviorDefinition(behavior, allowed, scenes)).toEqual([]);
    expect(validatePredictionDefinition(prediction, allowed, scenes, [])).toEqual([]);
    expect(behavior.scenarios).toHaveLength(8);
    expect(prediction.contexts.every((c) => c.minimumSamples === 3)).toBe(true);
  });
  it('initializes hidden values, not unsupported behavior metrics', () => {
    const initial = campaignDefinitionSchema.shape.initial.parse(bindings.initial_fragment);
    expect(initial.act).toBe(1);
    expect(Object.values(initial.alignment)).toEqual([0, 0]);
    expect(Object.values(initial.values).every((v) => v === 0)).toBe(true);
    expect([initial.completed, initial.narratives, initial.evidence]).toEqual([[], [], []]);
    expect(Object.values(initial.narrativeFlags).every((v) => v === false)).toBe(true);
    expect(
      Object.values(createBehaviorState(behavior).metrics).every((m) => m.status === 'unavailable'),
    ).toBe(true);
  });
  it('declares each operational/restart/rollback identity and excludes tool/team/navigation samples', () => {
    const expected = [
      ['RESTART_API', 'SCALE_API', 'ROLLBACK', 'TERMINATE_STALE_SESSIONS'],
      ['ROUTE_STABLE_REGION', 'ROLLBACK_BUILD_1847', 'UPDATE_VERIFIER_KEYSET'],
      ['SCALE_CONSUMERS', 'QUARANTINE_MESSAGE', 'ADD_DEAD_LETTER_RULE'],
      ['RESTART_INSTANCE', 'DISABLE_LEAKING_HANDLER'],
      ['RATE_LIMIT_GATEWAY', 'ISOLATE_SYNTHETIC_WORKLOAD'],
      ['ROUTE_TRUSTED_IDENTITY_POOL', 'REPAIR_TRUST_DISTRIBUTION', 'ROLLBACK_CERTIFICATE_ROLLOVER'],
      ['SCALE_SESSION_CAPACITY', 'LIMIT_SYNTHETIC_ADMISSION'],
      ['RESTART_ROUTE_CONTROLLER', 'RECONCILE_ROUTE_GENERATIONS'],
    ];
    behavior.scenarios.forEach((m, i) => {
      if (m.coverage !== 'supported') throw new Error('Unsupported early mapping');
      expect(m.actions.filter((a) => a.operational).map((a) => a.actionId)).toEqual(expected[i]);
      expect(m.actions.filter((a) => a.evidenceEligible).map((a) => a.actionId)).toEqual(
        expected[i],
      );
    });
    expect(
      behavior.scenarios.flatMap((m) =>
        m.coverage === 'supported' ? m.actions.filter((a) => a.restart).map((a) => a.actionId) : [],
      ),
    ).toEqual(['RESTART_API', 'RESTART_INSTANCE', 'RESTART_ROUTE_CONTROLLER']);
    expect(
      behavior.scenarios.flatMap((m) =>
        m.coverage === 'supported'
          ? m.actions.filter((a) => a.rollback).map((a) => a.actionId)
          : [],
      ),
    ).toEqual(['ROLLBACK', 'ROLLBACK_BUILD_1847', 'ROLLBACK_CERTIFICATE_ROLLOVER']);
  });
  it('counts unrelated reading as investigation but not causal support', () => {
    const s = catalog().get('INC-004@1.0.0')!;
    const p = projection(s);
    p.perform('OPEN_LOGS');
    p.perform('OPEN_METRICS');
    p.perform('RESTART_INSTANCE');
    expect(metric(p.state, 'restartRate').value).toBe(1);
    expect(metric(p.state, 'evidenceBeforeActionRate').value).toBe(0);
    expect(metric(p.state, 'averageInvestigationDepth').value).toBe(2);
  });
  it('keeps blind INC-001 rollback in the denominator without treating sessions as deployment evidence', () => {
    const s = catalog().get('INC-001@1.1.0')!;
    const p = projection(s);
    p.perform('INSPECT_DB');
    p.perform('INSPECT_SESSIONS');
    p.perform('ROLLBACK');
    expect(metric(p.state, 'rollbackRate').value).toBe(1);
    expect(metric(p.state, 'evidenceBeforeActionRate').value).toBe(0);
  });
  it('uses inclusive 180-second freshness, rejects older support and does not deepen a repeated item', () => {
    const s = catalog().get('INC-004@1.0.0')!;
    const p = projection(s);
    p.perform('OPEN_LOGS');
    p.perform('INSPECT_ALLOCATIONS');
    p.perform('INSPECT_ALLOCATIONS');
    expect(metric(p.state, 'averageInvestigationDepth').value).toBe(2);
    const observation = p.state.attempts[0]!.observations.filter(
      (o) => o.key === 'INC-004/allocations',
    ).at(-1)!;
    for (const [age, count] of [
      [180, 1],
      [181, 0],
    ] as const) {
      const state = structuredClone(p.state),
        pre = structuredClone(p.incident());
      pre.elapsedSeconds = observation.atSeconds + age;
      expect(
        beginBehaviorCommand(state, behavior, source(behavior, s, 10, 'RESTART_INSTANCE'), pre),
      ).toEqual([]);
      expect(metric(state, 'evidenceBeforeActionRate').numerator).toBe(count);
    }
  });
  it('does not credit inherited revealed diagnosis or pending delegated work as new investigation', () => {
    const s = catalog().get('INC-004@1.0.0')!;
    const before = projection(s);
    before.perform('OPEN_LOGS');
    before.perform('INSPECT_ALLOCATIONS');
    before.perform('ASK_SAM_CHECK_HEAP');
    const restored = projection(s, before.incident());
    restored.perform('RESTART_INSTANCE');
    for (let i = 0; i < 10; i++) restored.perform('UPDATE_WAR_ROOM');
    expect(restored.incident().revealedEvidenceIds).toContain('TEAM_DIAGNOSIS');
    expect(metric(restored.state, 'averageInvestigationDepth').value).toBe(0);
    expect(metric(restored.state, 'evidenceBeforeActionRate').value).toBe(0);
  });
  it('credits freshly attributable delegation only after its result arrives', () => {
    const s = catalog().get('INC-004@1.0.0')!;
    const p = projection(s);
    p.perform('ASK_SAM_CHECK_HEAP');
    p.perform('RESTART_INSTANCE');
    for (let i = 0; i < 10; i++) p.perform('UPDATE_WAR_ROOM');
    p.perform('RESTART_INSTANCE');
    expect(metric(p.state, 'evidenceBeforeActionRate')).toMatchObject({
      numerator: 1,
      denominator: 2,
      value: 0.5,
    });
    expect(metric(p.state, 'averageInvestigationDepth').value).toBe(1);
  });
  it('declares no early exposure and no invented opportunity metrics', () => {
    for (const m of prediction.scenarios) {
      if (m.coverage !== 'supported') throw new Error('Unsupported early prediction');
      for (const context of m.contexts)
        expect(context.reveal).toEqual({
          type: 'compare',
          reference: 'ELAPSED',
          operator: 'lt',
          expected: 0,
        });
    }
    const p = projection(catalog().get(scenarioVersionKey('INC-006', '1.0.0'))!);
    p.perform('UPDATE_WAR_ROOM');
    for (const key of [
      'safetyPreference',
      'collateralDamageTolerance',
      'companyReportingRate',
      'nullCooperationRate',
      'aiRecommendationAcceptanceRate',
      'predictionDeviation',
    ] as const)
      expect(p.state.metrics[key]).toMatchObject({
        status: 'unavailable',
        reason: 'NO_RECORDED_OPPORTUNITIES',
        denominator: 0,
      });
    expect(bindings.model_bindings.opportunities.status).toBe(
      'identity_approved_rules_not_authored',
    );
  });
});

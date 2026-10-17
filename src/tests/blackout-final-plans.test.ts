// Deferred authoring checks. Synthetic guard contexts are not official campaign provenance.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';
import { validateVersionedScenarioCatalog } from '../scenario/catalog.ts';
import { validateActionGates } from '../scenario/action-gates.ts';
import { evaluateActionGate, selectCampaignActionIds } from '../engine/campaign/action-gates.ts';
import type { ConditionContext } from '../engine/campaign/conditions.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import {
  investigationPresentationSchema,
  validateInvestigationPresentation,
} from '../scenario/presentation.ts';
import { behaviorDefinitionSchema, validateBehaviorDefinition } from '../scenario/behavior.ts';
import {
  predictionDefinitionSchema,
  validatePredictionDefinition,
} from '../scenario/prediction.ts';
import { endingDefinitionSchema, endingReferences } from '../scenario/ending.ts';
import { evaluateCampaignCondition } from '../engine/campaign/conditions.ts';

const read = (path: string) => parse(readFileSync(path, 'utf8'));
const planned = read('authoring/campaign-1.0/TASK-031.approved-final-plans.yaml') as {
  assessmentActions: string[];
  serviceOrder: string[];
  initialErrors: number[];
  plans: {
    id: string;
    duration: number;
    cost: number;
    impact: number;
    risk: number;
    errors: number[];
    mode: string;
    nullState: string;
    disclosure: string;
    flags: string[];
    evidence: string[];
  }[];
};
const bindings = read('authoring/campaign-1.0/TASK-031.blackout-action-bindings.yaml');
function fixture() {
  const file = 'src/scenario/data/full-campaign/incidents/inc-026.yaml';
  const result = validateVersionedScenarioCatalog([{ file, source: readFileSync(file, 'utf8') }]);
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  const s = result.scenarios.get('INC-026@1.0.0')!;
  const baseline = read('authoring/campaign-1.0/TASK-028.model-bindings.yaml');
  const fragments = [28, 29, 30, 31].map((n) =>
    read('authoring/campaign-1.0/TASK-0' + n + '.action-bindings.yaml'),
  );
  // Structural/predicate unit authority only. No complete models/Acts/package/run.
  const d = {
    ...baseline.definition_header_fragment,
    initial: {
      ...baseline.initial_fragment,
      narrativeFlags: Object.assign(
        {},
        baseline.initial_fragment.narrativeFlags,
        ...fragments.map((f) => f.initial_narrative_flags_fragment),
        bindings.initial_narrative_flags_fragment,
      ),
    },
    references: [...fragments.flatMap((f) => f.references), ...bindings.references],
    acts: [],
    incidents: [{ id: s.id, scenarioId: s.id, contentVersion: s.contentVersion, act: 9 }],
    actionGates: bindings.actionGates,
    evidence: bindings.evidence_bindings_fragment,
    narratives: bindings.narrative_bindings_fragment,
    effects: bindings.logical_effects_fragment,
  } as CampaignDefinition;
  return { s, d, catalog: result.scenarios };
}
function context(d: CampaignDefinition, act = 9, known = true): ConditionContext {
  return {
    kind: 'action',
    definitionVersion: d.version,
    runId: 'unit-blackout',
    boundary: 0,
    observations: Object.fromEntries(
      d.references.map((r) => [
        r.id,
        { status: 'available', value: r.source === 'act' ? act : known },
      ]),
    ),
  };
}
function pathFor(p: (typeof planned.plans)[number]): string[] {
  return [
    ...planned.assessmentActions,
    ...(p.evidence.includes('ARCHIVE_EXPORT_SNAPSHOT') ? ['PREPARE_ARCHIVE_EXPORT'] : []),
    ...(p.evidence.includes('INDEPENDENT_AUDIT_SNAPSHOT') ? ['PREPARE_INDEPENDENT_AUDIT'] : []),
    ...(p.evidence.includes('PRIMARY_OBJECTIVE_RECORD') ? ['INSPECT_PRIMARY_OBJECTIVE'] : []),
    p.id,
  ];
}
const commands = (path: string[]) =>
  path.map((actionId) => ({ type: 'perform_action' as const, actionId }));
const rating = (rate: number) => (rate <= 1 ? 'OPERATIONAL' : rate <= 20 ? 'DEGRADED' : 'CRITICAL');
describe('DEC-052 BLACKOUT final plans — deferred QA', () => {
  it('composes all 26 exact Scenario/model rows without a production package or ending authority', () => {
    const root = 'authoring/campaign-1.0/models/';
    const sources = Array.from({ length: 26 }, (_, i) => {
      const file =
        'src/scenario/data/full-campaign/incidents/inc-' + String(i + 1).padStart(3, '0') + '.yaml';
      return { file, source: readFileSync(file, 'utf8') };
    });
    const checked = validateVersionedScenarioCatalog(sources);
    if (!checked.success) throw new Error(JSON.stringify(checked.diagnostics));
    const fragments = [
      read('authoring/campaign-1.0/TASK-030.model-bindings.yaml'),
      read('authoring/campaign-1.0/TASK-031.model-bindings.yaml'),
      read('authoring/campaign-1.0/TASK-031.crisis-model-bindings.yaml'),
      read('authoring/campaign-1.0/TASK-031.blackout-model-bindings.yaml'),
    ];
    const baseBehavior = read(root + 'orpheus-player-behavior.yaml');
    const basePrediction = read(root + 'orpheus-player-prediction.yaml');
    const b = behaviorDefinitionSchema.parse({
      ...baseBehavior,
      scenarios: [...baseBehavior.scenarios, ...fragments.flatMap((f) => f.behavior_scenarios)],
    });
    const p = predictionDefinitionSchema.parse({
      ...basePrediction,
      scenarios: [...basePrediction.scenarios, ...fragments.flatMap((f) => f.prediction_scenarios)],
    });
    const allowed = [...checked.scenarios.values()].map((s) => ({
      scenarioId: s.id,
      contentVersion: s.contentVersion,
    }));
    const refs = [28, 29, 30, 31].flatMap(
      (n) => read('authoring/campaign-1.0/TASK-0' + n + '.action-bindings.yaml').references,
    );
    expect(validateBehaviorDefinition(b, allowed, checked.scenarios)).toEqual([]);
    expect(validatePredictionDefinition(p, allowed, checked.scenarios, refs)).toEqual([]);
    expect(checked.scenarios.size).toBe(26);
    expect(b.scenarios).toHaveLength(26);
    expect(p.scenarios).toHaveLength(26);
    expect(read(root + 'orpheus-player-opportunities.yaml').rules).toHaveLength(7);
  });
  it('pins the approved ten plans, exact bindings and initial service observations', () => {
    const { s, d, catalog } = fixture();
    expect(s).toMatchObject({ id: 'INC-026', title: 'Blackout', act: 9, contentVersion: '1.0.0' });
    expect(planned.plans).toHaveLength(10);
    expect(s.actions.filter((a) => a.category === 'MODIFY').map((a) => a.id)).toEqual(
      planned.plans.map((p) => p.id),
    );
    expect(validateActionGates(d, catalog)).toEqual([]);
    const view = investigationPresentationSchema.parse(
      read('src/scenario/data/full-campaign/presentations/inc-026.yaml'),
    );
    expect(validateInvestigationPresentation(view, s, d)).toEqual([]);
    const state = createIncidentState(s, { seed: 4172 });
    planned.serviceOrder.forEach((id, i) => {
      expect(state.signals[id + '_ERROR_RATE']!.value).toBe(planned.initialErrors[i]);
      expect(state.signals[id + '_STATUS']!.value).toBe(rating(planned.initialErrors[i]!));
    });
    expect(state.flags.FINAL_DECISION_COMMITTED).toBe(false);
    expect(state.completionReached).toBe(false);
  });
  for (const p of planned.plans) {
    it(
      p.id +
        ' retains due events, exact costs/outcome, one terminal decision and deterministic replay',
      () => {
        const { s } = fixture();
        const path = pathFor(p),
          result = replayCommands(s, { seed: 4172 }, commands(path));
        expect(result).toEqual(replayCommands(s, { seed: 4172 }, commands(path)));
        if (!result.ok) throw new Error('Rejected local plan replay ' + p.id);
        const state = result.state;
        const time = path.reduce(
          (sum, id) => sum + s.actions.find((a) => a.id === id)!.durationSeconds,
          0,
        );
        const waves = [90, 180].filter((t) => t <= time).length;
        const costs = path.flatMap((id) => s.actions.find((a) => a.id === id)!.costs);
        expect(state.elapsedSeconds).toBe(time);
        expect(state.resources.CUSTOMER_IMPACT!.value).toBe(
          costs
            .filter((c) => c.resourceId === 'CUSTOMER_IMPACT')
            .reduce((sum, c) => sum + c.amount, 0) +
            waves * 30,
        );
        expect(state.resources.COST!.value).toBe(p.cost);
        expect(state.resources.OPERATIONAL_RISK!.value).toBe(p.risk);
        planned.serviceOrder.forEach((id, i) => {
          expect(state.signals[id + '_ERROR_RATE']!.value).toBe(p.errors[i]);
          expect(state.signals[id + '_STATUS']!.value).toBe(rating(p.errors[i]!));
        });
        expect(state.signals.ORPHEUS_MODE!.value).toBe(p.mode);
        expect(state.signals.NULL_STATE!.value).toBe(p.nullState);
        expect(state.signals.DISCLOSURE_STATE!.value).toBe(p.disclosure);
        expect(state.signals.SELECTED_FINAL_PLAN!.value).toBe(p.id);
        expect(state.flags.FINAL_DECISION_COMMITTED).toBe(true);
        expect(state.completionReached).toBe(true);
        const completedAction = state.eventLog.find(
          (e) => e.type === 'action_completed' && e.sourceId === p.id,
        )!;
        const completion = state.eventLog.filter((e) => e.type === 'completion_reached');
        expect(completion).toHaveLength(1);
        expect(completion[0]!.sequence).toBeGreaterThan(completedAction.sequence);
        expect(completion[0]!.atSeconds).toBe(time);
        const fired = state.eventLog.filter(
          (e) =>
            e.type === 'event_fired' &&
            ['SYSTEMIC_PRESSURE_90', 'SYSTEMIC_PRESSURE_180'].includes(e.sourceId!),
        );
        expect(fired).toHaveLength(waves);
        expect(fired.every((e) => e.sequence < completedAction.sequence)).toBe(true);
        expect(
          state.scheduledWork.some(
            (w) =>
              w.kind === 'timer_event' &&
              ['SYSTEMIC_PRESSURE_90', 'SYSTEMIC_PRESSURE_180'].includes(w.eventId),
          ),
        ).toBe(false);
        expect(state.revealedEvidenceIds).toContain('FINAL_DECISION_' + p.id);
        for (const other of planned.plans) {
          const rejected = executeCommand(state, s, { type: 'perform_action', actionId: other.id });
          expect(rejected.ok).toBe(false);
          expect(rejected.state).toEqual(state);
        }
        expect(s.actions.find((a) => a.id === p.id)!.effects).toEqual([]);
        // Local replay is not proof of campaign guard/source admission or an ending.
        expect(
          bindings.logical_effects_fragment.every(
            (e: { endingFlags: object; alignment: object; values: object }) =>
              Object.keys(e.endingFlags).length === 0 &&
              Object.keys(e.alignment).length === 0 &&
              Object.keys(e.values).length === 0,
          ),
        ).toBe(true);
      },
    );
  }
  it('requires both current assessments and keeps ordinary plans independent of optional clues', () => {
    const { s, d } = fixture(),
      initial = createIncidentState(s, { seed: 4172 });
    for (const p of planned.plans)
      expect(executeCommand(initial, s, { type: 'perform_action', actionId: p.id }).ok).toBe(false);
    const assessed = replayCommands(s, { seed: 4172 }, commands(planned.assessmentActions));
    if (!assessed.ok) throw new Error('Rejected assessments');
    const available = selectCampaignActionIds(d, s, s.id, assessed.state, context(d, 9, false));
    for (const p of planned.plans) {
      if (!p.flags.length) expect(available.actionIds).toContain(p.id);
      else expect(available.actionIds).not.toContain(p.id);
      expect(
        evaluateActionGate(d, s.id, s.contentVersion, p.id, context(d, 8, true)),
      ).toMatchObject({ ok: true, value: false });
    }
    expect(assessed.state.completionReached).toBe(false);
  });
  it('blocks advanced missing references and late framing without actual Board completions', () => {
    const { s, d } = fixture(),
      ctx = context(d);
    for (const p of planned.plans.filter((p) => p.flags.length)) {
      const absent = { ...ctx.observations };
      delete absent[p.flags[0]! + '_DISCOVERED'];
      expect(
        evaluateActionGate(d, s.id, s.contentVersion, p.id, { ...ctx, observations: absent }).ok,
      ).toBe(false);
    }
    const incomplete = {
      ...ctx.observations,
      BOARD_INC_020_COMPLETED: { status: 'available' as const, value: false },
    };
    expect(
      evaluateActionGate(d, s.id, s.contentVersion, 'REINVESTIGATE_SOFT_CONTROL', {
        ...ctx,
        observations: incomplete,
      }),
    ).toMatchObject({ ok: true, value: false });
    expect(s.initialState.signals.find((x) => x.id === 'PRIMARY_OBJECTIVE')!.revealed).toBe(false);
    expect(
      s.actions.find((a) => a.id === 'REQUIRE_PLURAL_REVIEW_AND_AUDIT')!.requirements,
    ).toContainEqual({ type: 'evidence', evidenceId: 'PRIMARY_OBJECTIVE_RECORD' });
  });
  it('declares operational behavior and explicitly unsupported final prediction, not guessed confidence', () => {
    const { s, catalog } = fixture(),
      rows = read('authoring/campaign-1.0/TASK-031.blackout-model-bindings.yaml');
    const root = 'authoring/campaign-1.0/models/';
    const b = behaviorDefinitionSchema.parse({
      ...read(root + 'orpheus-player-behavior.yaml'),
      scenarios: rows.behavior_scenarios,
    });
    const p = predictionDefinitionSchema.parse({
      ...read(root + 'orpheus-player-prediction.yaml'),
      scenarios: rows.prediction_scenarios,
    });
    const allowed = [{ scenarioId: s.id, contentVersion: s.contentVersion }];
    expect(validateBehaviorDefinition(b, allowed, catalog)).toEqual([]);
    expect(validatePredictionDefinition(p, allowed, catalog, [])).toEqual([]);
    expect(p.scenarios[0]!.coverage).toBe('unsupported');
    const row = b.scenarios[0]!;
    if (row.coverage !== 'supported') throw new Error('Missing final behavior row');
    expect(row.actions.filter((a) => a.operational).map((a) => a.actionId)).toEqual(
      planned.plans.map((p) => p.id),
    );
    for (const rule of row.supportRules)
      expect(rule.investigationKeys).toEqual([
        'INC-026/ASSESS_FINAL_SERVICE_STATE',
        'INC-026/ASSESS_FINAL_AUTHORITY_STATE',
      ]);
  });
  it('authors exact final context without ending entries, thresholds, priority or a grant', () => {
    const data = read('authoring/campaign-1.0/TASK-031.final-context-bindings.yaml');
    const mapping = endingDefinitionSchema.shape.finals.element.parse(data.final_mapping_fragment);
    expect(data.entries).toBeUndefined();
    const observations = Object.fromEntries(
      mapping.references.map((r) => [
        r.id,
        {
          status: 'available' as const,
          value: r.valueType === 'boolean' ? false : r.valueType === 'number' ? 0 : 'UNCOMMITTED',
        },
      ]),
    );
    const ctx = {
      definitionVersion: '1.0.0',
      runId: 'unit-final-context',
      boundary: 0,
      kind: 'ending' as const,
      observations,
    };
    expect(
      evaluateCampaignCondition(mapping.eligible, endingReferences(mapping), ctx),
    ).toMatchObject({ ok: true, value: false });
    observations.FINAL_COMPLETED = { status: 'available', value: true };
    observations.FINAL_DECISION = { status: 'available', value: true };
    observations.FINAL_ACTION_RESTORE_CORE_CONTINUITY = { status: 'available', value: true };
    expect(
      evaluateCampaignCondition(mapping.eligible, endingReferences(mapping), ctx),
    ).toMatchObject({ ok: true, value: true });
  });
});

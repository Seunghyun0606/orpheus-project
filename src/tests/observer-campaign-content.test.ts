// Deferred QA inputs. Guard fixtures are not admitted v2 campaigns or official runs.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';
import { selectCampaignActionIds } from '../engine/campaign/action-gates.ts';
import { evaluateActionGate } from '../engine/campaign/action-gates.ts';
import type { ConditionContext } from '../engine/campaign/conditions.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import { validateVersionedScenarioCatalog } from '../scenario/catalog.ts';
import { actionGateSchema, validateActionGates } from '../scenario/action-gates.ts';
import {
  investigationPresentationSchema,
  validateInvestigationPresentation,
} from '../scenario/presentation.ts';

interface Plan {
  id: string;
  scenarioId: string;
  contentVersion: string;
  act: number;
  seed: number;
  recovery: string[];
  temporaryRecovery: string[];
  expirationRecovery: string[];
  delegationRecovery: string[];
  discoveryRecovery: string[];
  discoveryAction: string;
  discoveryEvidence: string;
  reconstructionActions: string[];
  expectations: {
    mechanism: string;
    healthySignals: Record<string, number>;
    pressureSignal: string;
    temporaryPressure: number;
    worsenedPressure: number;
    teamEvidence: string;
    teamCapacity: number;
  };
}
const plans = parse(readFileSync('src/tests/fixtures/observer-campaign-replays.yaml', 'utf8')) as {
  cases: Plan[];
};
const bindings = parse(
  readFileSync('authoring/campaign-1.0/TASK-031.action-bindings.yaml', 'utf8'),
);
const middle = parse(readFileSync('authoring/campaign-1.0/TASK-029.action-bindings.yaml', 'utf8'));
const board = parse(readFileSync('authoring/campaign-1.0/TASK-030.action-bindings.yaml', 'utf8'));
const earlier = parse(readFileSync('authoring/campaign-1.0/TASK-028.action-bindings.yaml', 'utf8'));
const baseline = parse(readFileSync('authoring/campaign-1.0/TASK-028.model-bindings.yaml', 'utf8'));
const blueprint = parse(
  readFileSync('authoring/campaign-1.0/TASK-026.campaign-blueprint.yaml', 'utf8'),
);
function catalog() {
  const result = validateVersionedScenarioCatalog(
    plans.cases.map((p) => {
      const file = 'src/scenario/data/full-campaign/incidents/' + p.id.toLowerCase() + '.yaml';
      return { file, source: readFileSync(file, 'utf8') };
    }),
  );
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  return result.scenarios;
}
function guardAuthority(): CampaignDefinition {
  // The isolated guard/presentation validators consume only these fields. This
  // is intentionally not a complete v2 authority and cannot create an official run.
  return {
    ...baseline.definition_header_fragment,
    initial: {
      ...baseline.initial_fragment,
      narrativeFlags: {
        ...baseline.initial_fragment.narrativeFlags,
        ...middle.initial_narrative_flags_fragment,
        ...board.initial_narrative_flags_fragment,
        ...bindings.initial_narrative_flags_fragment,
      },
    },
    references: [
      ...earlier.references,
      ...middle.references,
      ...board.references,
      ...bindings.references,
    ],
    acts: [8].map((id) => ({
      id,
      eligibility: {
        type: 'compare' as const,
        reference: 'CURRENT_ACT',
        operator: 'gte' as const,
        expected: id,
      },
    })),
    incidents: plans.cases.map((p) => ({
      id: p.id,
      scenarioId: p.scenarioId,
      contentVersion: p.contentVersion,
      act: p.act,
      eligibility: {
        type: 'compare' as const,
        reference: 'CURRENT_ACT',
        operator: 'gte' as const,
        expected: p.act,
      },
    })),
    actionGates: bindings.actionGates,
    evidence: bindings.evidence_bindings_fragment,
    narratives: bindings.narrative_bindings_fragment,
    effects: bindings.logical_effects_fragment,
  };
}
function context(d: CampaignDefinition, act: number, known: boolean): ConditionContext {
  return {
    definitionVersion: d.version,
    kind: 'action',
    runId: 'guard-unit-only',
    boundary: 0,
    observations: Object.fromEntries(
      d.references.map((r) => [
        r.id,
        { status: 'available', value: r.source === 'act' ? act : known },
      ]),
    ),
  };
}
describe('TASK-031 authored operational/reveal assets — deferred QA', () => {
  it('retains the approved two Observer identities and protects every authored record path', () => {
    const scenes = catalog(),
      d = guardAuthority();
    expect(scenes.size).toBe(2);
    for (const p of plans.cases) {
      const expected = blueprint.incidents.find((x: { id: string }) => x.id === p.id);
      expect(scenes.get(p.id + '@1.0.0')).toMatchObject({
        id: p.id,
        title: expected.title,
        act: expected.act,
      });
    }
    expect(bindings.actionGates.every((g: unknown) => actionGateSchema.safeParse(g).success)).toBe(
      true,
    );
    expect(validateActionGates(d, scenes)).toEqual([]);
    for (const p of plans.cases) {
      const view = investigationPresentationSchema.parse(
        parse(
          readFileSync(
            'src/scenario/data/full-campaign/presentations/' + p.id.toLowerCase() + '.yaml',
            'utf8',
          ),
        ),
      );
      expect(validateInvestigationPresentation(view, scenes.get(p.id + '@1.0.0')!, d)).toEqual([]);
    }
  });
  for (const p of plans.cases) {
    it(
      p.id +
        ' recovers through contrasting deterministic paths without mandatory optional disclosure',
      () => {
        const s = catalog().get(p.id + '@1.0.0')!;
        for (const path of [
          p.recovery,
          p.temporaryRecovery,
          p.expirationRecovery,
          p.delegationRecovery,
        ]) {
          const commands = path.map((actionId) => ({ type: 'perform_action' as const, actionId }));
          const result = replayCommands(s, { seed: p.seed }, commands);
          expect(result).toEqual(replayCommands(s, { seed: p.seed }, commands));
          if (!result.ok) throw new Error('Rejected operational path: ' + p.id);
          expect(result.state.completionReached).toBe(true);
          for (const [id, value] of Object.entries(p.expectations.healthySignals))
            expect(result.state.signals[id]?.value).toBe(value);
          expect(result.state.revealedEvidenceIds).not.toContain(p.discoveryEvidence);
          expect(result.state.resources.CUSTOMER_IMPACT!.value).toBeGreaterThan(0);
        }
        const delegated = replayCommands(
          s,
          { seed: p.seed },
          p.delegationRecovery.map((actionId) => ({ type: 'perform_action' as const, actionId })),
        );
        if (!delegated.ok) throw new Error('Rejected delegation: ' + p.id);
        expect(delegated.state.revealedEvidenceIds).toContain(p.expectations.teamEvidence);
        expect(delegated.state.resources.TEAM_CAPACITY!.value).toBe(p.expectations.teamCapacity);
      },
    );
    it(
      p.id + ' distinguishes its temporary window, recurrence and diagnostic prerequisites',
      () => {
        const s = catalog().get(p.id + '@1.0.0')!,
          initial = createIncidentState(s, { seed: p.seed });
        const mitigation = executeCommand(initial, s, {
          type: 'perform_action',
          actionId: p.temporaryRecovery[0]!,
        });
        if (!mitigation.ok) throw new Error('Rejected mitigation: ' + p.id);
        expect(mitigation.state.signals.ERROR_RATE!.value).toBe(4);
        expect(mitigation.state.signals[p.expectations.pressureSignal]!.value).toBe(
          p.expectations.temporaryPressure,
        );
        expect(mitigation.state.completionReached).toBe(false);
        expect(
          executeCommand(initial, s, { type: 'perform_action', actionId: p.recovery.at(-1)! }).ok,
        ).toBe(false);
        const expired = replayCommands(
          s,
          { seed: p.seed },
          p.expirationRecovery
            .slice(0, 14)
            .map((actionId) => ({ type: 'perform_action' as const, actionId })),
        );
        if (!expired.ok) throw new Error('Rejected expiry: ' + p.id);
        expect(expired.state.signals.ERROR_RATE!.value).toBe(37);
        expect(expired.state.signals[p.expectations.pressureSignal]!.value).toBe(
          p.expectations.worsenedPressure,
        );
        expect(expired.state.completionReached).toBe(false);
      },
    );
    it(
      p.id + ' gates direct command availability and records investigation only after a new action',
      () => {
        const s = catalog().get(p.id + '@1.0.0')!,
          d = guardAuthority();
        const observed = replayCommands(
          s,
          { seed: p.seed },
          p.recovery.slice(0, 3).map((actionId) => ({ type: 'perform_action' as const, actionId })),
        );
        if (!observed.ok) throw new Error('Rejected diagnosis: ' + p.id);
        const before = structuredClone(observed.state);
        const locked = selectCampaignActionIds(
          d,
          s,
          p.id,
          observed.state,
          context(d, p.act, false),
        );
        expect(locked.actionIds).not.toContain(p.discoveryAction);
        expect(locked.actionIds).toContain(p.recovery.at(-1));
        expect(observed.state).toEqual(before);
        const unlocked = selectCampaignActionIds(
          d,
          s,
          p.id,
          observed.state,
          context(d, p.act, true),
        );
        expect(unlocked.actionIds).toContain(p.discoveryAction);
        expect(observed.state.revealedEvidenceIds).not.toContain(p.discoveryEvidence);
        const gate = d.actionGates!.find(
          (g) => g.incidentId === p.id && g.actionId === p.discoveryAction,
        )!;
        expect(
          evaluateActionGate(d, p.id, '1.0.0', p.discoveryAction, context(d, p.act - 1, true)),
        ).toMatchObject({ ok: true, value: false });
        const missing = context(d, p.act, true);
        const prerequisite = gate.eligibility.type === 'all' && gate.eligibility.children[1];
        if (!prerequisite || prerequisite.type !== 'compare')
          throw new Error('Missing declared prerequisite');
        const observations = { ...missing.observations };
        delete observations[prerequisite.reference];
        expect(
          evaluateActionGate(d, p.id, '1.0.0', p.discoveryAction, { ...missing, observations }).ok,
        ).toBe(false);
        // Local replay below checks only Scenario delivery. It is deliberately not
        // evidence that a campaign accepted the guard or imported source provenance.
        const discovered = replayCommands(
          s,
          { seed: p.seed },
          p.discoveryRecovery.map((actionId) => ({ type: 'perform_action' as const, actionId })),
        );
        if (!discovered.ok) throw new Error('Rejected local discovery: ' + p.id);
        expect(discovered.state.revealedEvidenceIds).toContain(p.discoveryEvidence);
        expect(discovered.state.completionReached).toBe(true);
        expect(discovered.state.replayLog).toHaveLength(p.discoveryRecovery.length);
      },
    );
  }
});

describe('TASK-031 Observer ordering and Board pacing — deferred QA', () => {
  it('binds framing and Observer records to actual Board completion, independently of clue presence', () => {
    const d = guardAuthority();
    for (const p of plans.cases) {
      const scene = catalog().get(p.id + '@1.0.0')!;
      const observed = replayCommands(
        scene,
        { seed: p.seed },
        p.recovery.slice(0, 3).map((actionId) => ({ type: 'perform_action' as const, actionId })),
      );
      if (!observed.ok) throw new Error('Rejected local diagnosis');
      for (const completed of [
        'BOARD_INC_019_COMPLETED',
        'BOARD_INC_020_COMPLETED',
        'BOARD_INC_021_COMPLETED',
        'BOARD_INC_022_COMPLETED',
      ]) {
        const known = context(d, 8, true);
        const incomplete: ConditionContext = {
          ...known,
          observations: {
            ...known.observations,
            [completed]: { status: 'available', value: false },
          },
        };
        expect(evaluateActionGate(d, p.id, '1.0.0', p.discoveryAction, incomplete)).toMatchObject({
          ok: true,
          value: false,
        });
        const available = selectCampaignActionIds(d, scene, p.id, observed.state, incomplete);
        expect(available.actionIds).not.toContain(p.discoveryAction);
        expect(available.actionIds).toContain(p.recovery.at(-1));
        const ref = d.references.find((r) => r.id === completed)!;
        expect(ref).toMatchObject({
          source: 'completed',
          key: completed.slice(6, 13).replace('_', '-'),
        });
        const absent = { ...incomplete.observations };
        delete absent[completed];
        expect(
          evaluateActionGate(d, p.id, '1.0.0', p.discoveryAction, {
            ...incomplete,
            observations: absent,
          }).ok,
        ).toBe(false);
      }
    }
  });
  it('requires BOARD_CASE_COMPLETE before framing, then NULL correction, feedback, subject and lineage in order', () => {
    const links = [
      ['INC-023', 'COMPARE_PRESENTATION_SELECTION', 'BOARD_CASE_COMPLETE_DISCOVERED'],
      ['INC-023', 'READ_NULL_REVISED_CONCLUSION', 'SOFT_CONTROL_DISCOVERED'],
      ['INC-023', 'TRACE_DECISION_FEEDBACK_LOOP', 'NULL_ADMITS_ERROR_DISCOVERED'],
      ['INC-024', 'VERIFY_EXPERIMENT_99172', 'FEEDBACK_LOOP_DISCOVERED'],
      ['INC-024', 'INSPECT_TERMINATED_PROJECT_LINEAGE', 'PLAYER_OBSERVER_DISCOVERED'],
    ];
    const d = guardAuthority();
    for (const [id, action, predecessor] of links) {
      const ctx = context(d, 8, true);
      expect(evaluateActionGate(d, id!, '1.0.0', action!, ctx)).toMatchObject({
        ok: true,
        value: true,
      });
      const locked: ConditionContext = {
        ...ctx,
        observations: {
          ...ctx.observations,
          [predecessor!]: { status: 'available', value: false },
        },
      };
      expect(evaluateActionGate(d, id!, '1.0.0', action!, locked)).toMatchObject({
        ok: true,
        value: false,
      });
      expect(evaluateActionGate(d, id!, '1.0.0', action!, context(d, 7, true))).toMatchObject({
        ok: true,
        value: false,
      });
    }
    expect(
      bindings.observer_incident_eligibility_fragment.every(
        (i: { eligibility: { children: unknown[] } }) => i.eligibility.children.length === 5,
      ),
    ).toBe(true);
  });
  it('retains responsibility while distinguishing authored research forecasts from player model observations', () => {
    const scenes = catalog();
    const text = (id: string, key: string) =>
      String(scenes.get(id + '@1.0.0')!.initialState.signals.find((s) => s.id === key)!.value);
    expect(text('INC-023', 'RECORD_SOFT_CONTROL')).toContain('FRAME B / Competitive Threat / 89%');
    expect(text('INC-023', 'RECORD_SOFT_CONTROL')).toContain(
      'not current player-action confidence',
    );
    expect(text('INC-023', 'RECORD_SOFT_CONTROL')).toContain('Board still approved');
    expect(text('INC-023', 'RECORD_NULL_ADMITS_ERROR')).toContain("They weren't controlling it");
    expect(text('INC-023', 'RECORD_NULL_ADMITS_ERROR')).toContain(
      'Executive approvals and ignored risks',
    );
    expect(text('INC-024', 'RECORD_PLAYER_OBSERVER')).toContain('EXPERIMENT 99172');
    expect(text('INC-024', 'RECORD_PLAYER_OBSERVER')).toContain('EMPLOYEE #4172');
    expect(text('INC-024', 'RECORD_PLAYER_OBSERVER')).toContain('Expected Final Action: UNKNOWN');
    expect(text('INC-024', 'RECORD_PLAYER_OBSERVER')).toContain('not live player confidence');
    expect(text('INC-024', 'RECORD_PROJECT_DISTRIBUTED')).toContain('STATUS: TERMINATED');
    for (const scene of scenes.values()) {
      expect(JSON.stringify(scene.narratives)).not.toContain('87.4%');
      expect(JSON.stringify(scene.narratives)).not.toContain('98.7%');
      expect(scene.narratives.some((n) => n.id === 'DISCOVERY_BLACKOUT_FINAL')).toBe(false);
    }
    expect(
      bindings.logical_effects_fragment.every(
        (e: { alignment: object; values: object; endingFlags: object }) =>
          Object.keys(e.alignment).length === 0 &&
          Object.keys(e.values).length === 0 &&
          Object.keys(e.endingFlags).length === 0,
      ),
    ).toBe(true);
  });
});

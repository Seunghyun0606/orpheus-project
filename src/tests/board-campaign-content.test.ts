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
const plans = parse(readFileSync('src/tests/fixtures/board-campaign-replays.yaml', 'utf8')) as {
  cases: Plan[];
};
const bindings = parse(readFileSync('.project-os/planning/TASK-030.action-bindings.yaml', 'utf8'));
const middle = parse(readFileSync('.project-os/planning/TASK-029.action-bindings.yaml', 'utf8'));
const route = parse(readFileSync('.project-os/planning/TASK-029.branch-bindings.yaml', 'utf8'));
const consumers = parse(
  readFileSync('.project-os/planning/TASK-030.branch-consumer-bindings.yaml', 'utf8'),
);
const earlier = parse(readFileSync('.project-os/planning/TASK-028.action-bindings.yaml', 'utf8'));
const baseline = parse(readFileSync('.project-os/planning/TASK-028.model-bindings.yaml', 'utf8'));
const blueprint = parse(
  readFileSync('.project-os/planning/TASK-026.campaign-blueprint.yaml', 'utf8'),
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
        ...bindings.initial_narrative_flags_fragment,
      },
    },
    references: [
      ...earlier.references,
      ...middle.references,
      ...bindings.references,
      ...route.references,
    ],
    acts: [7].map((id) => ({
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
        {
          status: 'available',
          value:
            r.source === 'act'
              ? act
              : r.source === 'metric'
                ? known
                  ? r.key === 'averageInvestigationDepth'
                    ? 4
                    : 1
                  : 0
                : known,
        },
      ]),
    ),
  };
}
describe('TASK-030 authored operational/reveal assets — deferred QA', () => {
  it('retains the approved four Board identities and protects every authored record path', () => {
    const scenes = catalog(),
      d = guardAuthority();
    expect(scenes.size).toBe(4);
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

describe('DEC-049 optional Board investigations — deferred QA', () => {
  it('retains all five exact consumer and branch bindings', () => {
    expect(consumers.consumers).toHaveLength(5);
    expect(bindings.actionGates).toHaveLength(59);
    for (const ref of route.references) expect(ref.contexts).toEqual(['branch', 'action']);
    for (const c of consumers.consumers) {
      const branch = route.branches.find((b: { id: string }) => b.id === c.branchId);
      const gate = bindings.actionGates.find(
        (g: { incidentId: string; actionId: string }) =>
          g.incidentId === c.incidentId && g.actionId === c.actionId,
      );
      expect(gate.eligibility).toEqual({
        type: 'all',
        children: [
          branch.eligibility,
          branch.reveal,
          { type: 'compare', reference: 'CURRENT_ACT', operator: 'gte', expected: 7 },
          {
            type: 'compare',
            reference: 'BOARD_RESPONSIBILITY_DISCOVERED',
            operator: 'eq',
            expected: true,
          },
        ],
      });
      expect(
        bindings.logical_effects_fragment.some(
          (e: { trigger: { incidentId: string; targetId: string } }) =>
            e.trigger.incidentId === c.incidentId && e.trigger.targetId === c.evidenceId,
        ),
      ).toBe(false);
    }
  });
  for (const c of consumers.consumers as {
    incidentId: string;
    actionId: string;
    branchId: string;
    evidenceId: string;
    narrativeId: string;
    localEvidenceId: string;
  }[]) {
    it(c.actionId + ' respects supported thresholds and strict unavailable diagnostics', () => {
      const d = guardAuthority(),
        s = catalog().get(c.incidentId + '@1.0.0')!;
      const branch = route.branches.find((b: { id: string }) => b.id === c.branchId);
      const metric = branch.eligibility.children.find((p: { reference: string }) =>
        p.reference.startsWith('METRIC_'),
      );
      const ctx = context(d, 7, true);
      const withMetric = (value: number): ConditionContext => ({
        ...ctx,
        observations: { ...ctx.observations, [metric.reference]: { status: 'available', value } },
      });
      expect(
        evaluateActionGate(d, c.incidentId, '1.0.0', c.actionId, withMetric(metric.expected)),
      ).toMatchObject({ ok: true, value: true });
      for (const value of [0, metric.expected - 0.01])
        expect(
          evaluateActionGate(d, c.incidentId, '1.0.0', c.actionId, withMetric(value)),
        ).toMatchObject({ ok: true, value: false });
      expect(
        evaluateActionGate(d, c.incidentId, '1.0.0', c.actionId, context(d, 6, true)),
      ).toMatchObject({ ok: true, value: false });
      // A decisive false sibling cannot hide a required unavailable observation.
      const unavailable: ConditionContext = {
        ...context(d, 6, false),
        observations: {
          ...context(d, 6, false).observations,
          [metric.reference]: { status: 'unavailable', reason: 'NO_ELIGIBLE_SAMPLES' },
        },
      };
      const before = createIncidentState(s, { seed: 4172 }),
        snapshot = structuredClone(before);
      expect(evaluateActionGate(d, c.incidentId, '1.0.0', c.actionId, unavailable).ok).toBe(false);
      expect(
        selectCampaignActionIds(d, s, c.incidentId, before, unavailable).actionIds,
      ).not.toContain(c.actionId);
      expect(before).toEqual(snapshot);
      expect(before.revealedEvidenceIds).not.toContain(c.evidenceId);
    });
    it(
      c.actionId + ' requires new local investigation and applies only authored time/impact',
      () => {
        const d = guardAuthority(),
          s = catalog().get(c.incidentId + '@1.0.0')!;
        const p = plans.cases.find((p) => p.id === c.incidentId)!;
        const action = s.actions.find((a) => a.id === c.actionId)!;
        expect(action).toMatchObject({
          category: 'INVESTIGATE',
          durationSeconds: 45,
          costs: [{ resourceId: 'CUSTOMER_IMPACT', amount: 18 }],
          effects: [{ type: 'reveal_signal', signalId: c.evidenceId }],
        });
        expect(action.requirements).toContainEqual({
          type: 'evidence',
          evidenceId: c.localEvidenceId,
        });
        const withoutLocal = replayCommands(
          s,
          { seed: p.seed },
          p.recovery.slice(0, 3).map((actionId) => ({ type: 'perform_action' as const, actionId })),
        );
        if (!withoutLocal.ok) throw new Error('Rejected operational diagnosis');
        expect(
          selectCampaignActionIds(d, s, c.incidentId, withoutLocal.state, context(d, 7, true))
            .actionIds,
        ).not.toContain(c.actionId);
        const observed = replayCommands(
          s,
          { seed: p.seed },
          p.discoveryRecovery
            .slice(0, -1)
            .map((actionId) => ({ type: 'perform_action' as const, actionId })),
        );
        if (!observed.ok) throw new Error('Rejected local record path');
        expect(observed.state.revealedEvidenceIds).not.toContain(c.evidenceId);
        expect(
          selectCampaignActionIds(d, s, c.incidentId, observed.state, context(d, 7, true))
            .actionIds,
        ).toContain(c.actionId);
        // Standalone delivery only; this is not official campaign/provenance acceptance.
        const delivered = executeCommand(observed.state, s, {
          type: 'perform_action',
          actionId: c.actionId,
        });
        if (!delivered.ok) throw new Error('Rejected local optional investigation');
        expect(delivered.state.elapsedSeconds - observed.state.elapsedSeconds).toBe(45);
        expect(
          delivered.state.resources.CUSTOMER_IMPACT!.value -
            observed.state.resources.CUSTOMER_IMPACT!.value,
        ).toBe(18);
        expect(delivered.state.resources.COST).toEqual(observed.state.resources.COST);
        expect(delivered.state.resources.OPERATIONAL_RISK).toEqual(
          observed.state.resources.OPERATIONAL_RISK,
        );
        expect(delivered.state.revealedEvidenceIds).toContain(c.evidenceId);
        expect(delivered.state.triggeredNarrativeIds).toContain(c.narrativeId);
      },
    );
  }
});

describe('TASK-030 Board interval and attribution — deferred QA', () => {
  it('keeps the four approved identities and framing resolution in the following Act', () => {
    expect(plans.cases.map((p) => p.id)).toEqual(blueprint.board_interval.incidents);
    expect(blueprint.board_interval.framing_resolution).toBe('INC-023');
    const scenes = catalog();
    for (const scene of scenes.values()) {
      expect(scene.act).toBe(7);
      // Search actual player-facing authored content, not planning metadata.
      const playerData = JSON.stringify({
        signals: scene.initialState.signals,
        evidence: scene.evidence,
        narratives: scene.narratives,
        messages: scene.warRoom?.messages,
      });
      for (const earlyReveal of [
        'SOFT CONTROL',
        'FRAME A',
        'FRAME B',
        'FRAME C',
        'DECISION PRESENTATION OPTIMIZATION',
        "They weren't controlling it",
        'EXPERIMENT 99172',
        'Authority is unnecessary',
      ])
        expect(playerData).not.toContain(earlyReveal);
      expect(scene.narratives.map((n) => n.id)).not.toContain('DISCOVERY_SOFT_CONTROL');
      expect(scene.warRoom!.messages.filter((m) => m.initial).map((m) => m.id)).not.toContain(
        'REPORT_NULL_BLAMES_BOARD',
      );
    }
  });
  it('retains signed approvals, known risks, benefits and the fallible NULL attribution', () => {
    const scenes = catalog();
    const content = (id: string, key: string) =>
      String(scenes.get(id + '@1.0.0')!.initialState.signals.find((s) => s.id === key)!.value);
    expect(content('INC-019', 'RECORD_BOARD_RESPONSIBILITY')).toContain(
      'warning was attached before approval',
    );
    expect(content('INC-019', 'RECORD_CEO_OUTCOMES')).toContain('trust the outcomes');
    expect(content('INC-020', 'RECORD_WORKFORCE_DECISION')).toContain('12,410');
    expect(content('INC-020', 'RECORD_WORKFORCE_DECISION')).toContain('lower idle cost');
    expect(content('INC-021', 'RECORD_SECURITY_DISCLOSURE_DECISION')).toContain(
      'acknowledged before',
    );
    expect(content('INC-021', 'RECORD_NULL_BLAMES_BOARD')).toContain(
      'I found the root cause. The Board.',
    );
    expect(content('INC-021', 'RECORD_NULL_BLAMES_BOARD')).toContain('hypothesis');
    expect(
      scenes
        .get('INC-021@1.0.0')!
        .warRoom!.messages.find((m) => m.id === 'REPORT_NULL_BLAMES_BOARD')!.roleId,
    ).toBe('NULL_218');
    expect(content('INC-022', 'RECORD_BOARD_AUTHORITY_LEDGER')).toContain(
      'production experiments approved',
    );
    expect(content('INC-022', 'RECORD_BOARD_AUTHORITY_LEDGER')).toContain(
      'risk evidence was acknowledged',
    );
  });
  it('requires prior investigation flags and current local documents for the case correlation', () => {
    const d = guardAuthority(),
      scene = catalog().get('INC-022@1.0.0')!;
    const gate = d.actionGates!.find(
      (g) =>
        g.incidentId === 'INC-022' && g.actionId === 'CORRELATE_PUBLIC_SECTOR_APPROVAL_HISTORY',
    )!;
    expect(gate.eligibility).toEqual({
      type: 'all',
      children: [
        { type: 'compare', reference: 'CURRENT_ACT', operator: 'gte', expected: 7 },
        {
          type: 'compare',
          reference: 'NULL_BLAMES_BOARD_DISCOVERED',
          operator: 'eq',
          expected: true,
        },
      ],
    });
    expect(scene.actions.find((a) => a.id === gate.actionId)!.requirements).toEqual(
      expect.arrayContaining([
        { type: 'evidence', evidenceId: 'RECORD_FORECAST_HISTORY' },
        { type: 'evidence', evidenceId: 'RECORD_BOARD_AUTHORITY_LEDGER' },
      ]),
    );
    // Presence of an earlier clue does not deliver the new local document.
    const state = createIncidentState(scene, { seed: 4172 });
    expect(
      selectCampaignActionIds(d, scene, 'INC-022', state, context(d, 7, true)).actionIds,
    ).not.toContain(gate.actionId);
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

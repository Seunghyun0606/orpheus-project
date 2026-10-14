// @vitest-environment node
// Authored for deferred QA. Isolated lifecycle fixtures, not official full-campaign admission.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import { getCampaignPresentation } from '../engine/campaign/opportunities.ts';
import { behaviorDefinitionSchema } from '../scenario/behavior.ts';
import { opportunityDefinitionSchema } from '../scenario/opportunity.ts';
import { validateCampaignDefinition, type CampaignDefinition } from '../scenario/campaign.ts';
import { validateVersionedScenarioCatalog, scenarioVersionKey } from '../scenario/catalog.ts';
import { fixtureOperation } from './fixtures/opportunities.ts';

const root = '.project-os/planning/M5/models/';
const read = (path: string): unknown => parse(readFileSync(path, 'utf8'));
const cases = [
  {
    incident: 'INC-018',
    rule: 'LOGISTICS_CAPACITY_RECOMMENDATION',
    act: 6,
    trace: 'TRACE_EMERGENCY_ALLOCATION',
    compare: 'COMPARE_ALLOCATION_CONSTRAINTS',
    recommended: 'ROUTE_EMERGENCY_CAPACITY',
    alternative: 'RESTORE_EMERGENCY_DISPATCH_FLOOR',
  },
  {
    incident: 'INC-022',
    rule: 'PUBLIC_ALLOCATION_RECOMMENDATION',
    act: 7,
    trace: 'TRACE_FORECAST_REALLOCATION',
    compare: 'COMPARE_PUBLIC_SERVICE_FLOORS',
    recommended: 'RESTORE_TEMPORARY_PUBLIC_ALLOCATION',
    alternative: 'RESTORE_PROTECTED_PUBLIC_SERVICE_FLOORS',
  },
  {
    incident: 'INC-025',
    rule: 'REGIONAL_CONTAINMENT_RECOMMENDATION',
    act: 9,
    trace: 'TRACE_REGIONAL_AUTHORITY_CONFLICT',
    compare: 'COMPARE_REGIONAL_WRITER_GENERATIONS',
    recommended: 'CONTAIN_AFFECTED_REGION',
    alternative: 'FENCE_CONFLICTING_REGIONAL_WRITERS',
  },
] as const;
function authored() {
  const base = opportunityDefinitionSchema.parse(read(root + 'orpheus-player-opportunities.yaml'));
  const extension = z
    .object({ rules_extension: opportunityDefinitionSchema.shape.rules })
    .passthrough()
    .parse(read('.project-os/planning/TASK-032.recommendation-bindings.yaml'));
  return { base, rules: extension.rules_extension };
}

function fixture(options: { act?: number; known?: boolean } = {}) {
  const { base, rules } = authored();
  const care = base.rules.find((r) => r.id === 'CARE_CAPACITY_RECOMMENDATION')!;
  const selected = [care, ...rules];
  const files = selected.map(
    (r) => 'src/scenario/data/full-campaign/incidents/' + r.incidentId.toLowerCase() + '.yaml',
  );
  const checked = validateVersionedScenarioCatalog(
    files.map((file) => ({
      file,
      source: readFileSync(file, 'utf8'),
    })),
  );
  if (!checked.success) throw new Error(JSON.stringify(checked.diagnostics));
  const catalog = checked.scenarios;
  const baseBehavior = behaviorDefinitionSchema.parse(read(root + 'orpheus-player-behavior.yaml'));
  const board = z
    .object({ behavior_scenarios: behaviorDefinitionSchema.shape.scenarios })
    .passthrough()
    .parse(read('.project-os/planning/TASK-030.model-bindings.yaml'));
  const crisis = z
    .object({ behavior_scenarios: behaviorDefinitionSchema.shape.scenarios })
    .passthrough()
    .parse(read('.project-os/planning/TASK-031.crisis-model-bindings.yaml'));
  const behavior = behaviorDefinitionSchema.parse({
    ...baseBehavior,
    id: 'TEST-ONLY-RECOMMENDATION-BEHAVIOR',
    scenarios: [
      ...baseBehavior.scenarios,
      ...board.behavior_scenarios,
      ...crisis.behavior_scenarios,
    ].filter((s) => selected.some((r) => r.incidentId === s.scenarioId)),
  });
  const { predictionVersion: _prediction, ...withoutPrediction } = base;
  void _prediction;
  // Known flags and permissive Incident progression are explicit unit-test context,
  // not real reveal/completion provenance. These fixtures cannot certify a campaign.
  const d: CampaignDefinition = {
    schemaVersion: 1,
    id: 'TEST-ONLY-ADDITIONAL-RECOMMENDATIONS',
    version: '1.0.0',
    replayVersion: 2,
    recordVersion: 2,
    initial: {
      act: options.act ?? 9,
      alignment: { corporate: 0, null: 0 },
      values: {
        publicInterest: 0,
        operationalSafety: 0,
        curiosity: 0,
        evidence: 0,
        teamTrust: 0,
        aiDependency: 0,
        collateralDamage: 0,
      },
      evidence: [],
      narratives: [],
      completed: [],
      endingFlags: {},
      narrativeFlags: {
        HUMAN_DECISION_APIS: options.known ?? true,
        BOARD_RESPONSIBILITY: options.known ?? true,
        ORPHEUS_ACTIVE: options.known ?? true,
      },
    },
    references: [
      {
        id: 'CURRENT_ACT',
        version: '1.0.0',
        source: 'act',
        key: 'current',
        valueType: 'number',
        contexts: ['progression', 'branch'],
      },
      ...(['HUMAN_DECISION_APIS', 'BOARD_RESPONSIBILITY', 'ORPHEUS_ACTIVE'] as const).map(
        (key) => ({
          id: key + '_DISCOVERED',
          version: '1.0.0',
          source: 'narrative_flag' as const,
          key,
          valueType: 'boolean' as const,
          contexts: ['branch' as const],
        }),
      ),
    ],
    acts: Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      eligibility: {
        type: 'compare' as const,
        reference: 'CURRENT_ACT',
        operator: 'gte' as const,
        expected: 1,
      },
    })),
    incidents: [...catalog.values()].map((s) => ({
      id: s.id,
      scenarioId: s.id,
      contentVersion: s.contentVersion,
      // Unit lifecycle placement only. Production Act allocation and actual
      // opportunity Act gates remain unchanged, including wrong-Act negatives.
      act: options.act ?? 9,
      eligibility: {
        type: 'compare' as const,
        reference: 'CURRENT_ACT',
        operator: 'gte' as const,
        expected: 1,
      },
    })),
    evidence: [],
    narratives: [],
    effects: [],
    behavior,
    opportunities: {
      ...withoutPrediction,
      id: 'TEST-ONLY-RECOMMENDATION-LIFECYCLE',
      rules: selected,
    },
  };
  const apply = (run: CampaignRun | null, payload: Parameters<typeof fixtureOperation>[2]) => {
    const result = prepareCampaignOperation(d, catalog, run, fixtureOperation(d, run, payload));
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.run;
  };
  const start = (
    incidentId: string,
    run: CampaignRun | null = null,
    attemptId = incidentId + '-attempt',
  ) => {
    if (!run) run = apply(null, { kind: 'create' });
    return apply(run, { kind: 'start', attemptId, incidentId, seed: 4172 });
  };
  const command = (run: CampaignRun, actionId: string) => {
    const a = run.attempts.find((t) => t.id === run.activeAttemptId)!;
    return apply(run, {
      kind: 'command',
      attemptId: a.id,
      inputId: 'input-' + run.revision,
      commandSequence: a.incident.replayLog.length,
      priorHead: campaignAttemptHead(a),
      command: { type: 'perform_action', actionId },
    });
  };
  const investigate = (
    c: { incident: string; trace: string; compare: string },
    prior: CampaignRun | null = null,
    attemptId?: string,
  ) => {
    let run = start(c.incident, prior, attemptId);
    for (const id of ['OPEN_LOGS', c.trace, c.compare]) run = command(run, id);
    return run;
  };
  const prepare = (run: CampaignRun, ruleId: string) => {
    const a = run.attempts.find((t) => t.id === run.activeAttemptId)!;
    return apply(run, {
      kind: 'prepare_opportunity',
      attemptId: a.id,
      priorHead: campaignAttemptHead(a),
      ruleId,
      preparationId: 'presentation-' + run.revision,
    });
  };
  const ack = (run: CampaignRun) => {
    const p = run.opportunities!.preparations.at(-1)!;
    return apply(run, {
      kind: 'acknowledge_presentation',
      attemptId: p.attemptId,
      priorHead: p.priorHead,
      preparationId: p.id,
      surfaceId: p.presentation.id,
    });
  };
  return { d, catalog, start, command, investigate, prepare, ack };
}

describe('DEC-056 additional recommendation authoring — QA deferred', () => {
  it('composes exactly ten rules without changing the original seven or adding prediction claims', () => {
    const { base, rules } = authored();
    expect(base.rules).toHaveLength(7);
    const before = canonicalJson(base);
    const composed = opportunityDefinitionSchema.parse({
      ...base,
      rules: [...base.rules, ...rules],
    });
    expect(composed.rules).toHaveLength(10);
    expect(composed.rules.slice(0, 7)).toEqual(base.rules);
    expect(canonicalJson(base)).toBe(before);
    expect(composed.rules.filter((r) => r.kind === 'recommendation')).toHaveLength(4);
    for (const r of rules) {
      expect(r).toMatchObject({
        version: '1.0.0',
        contentVersion: '1.0.0',
        metric: 'aiRecommendationAcceptanceRate',
        kind: 'recommendation',
        consumption: 'single_response',
        replacement: 'none',
      });
      expect(r.contextId).toBeUndefined();
      expect(r.responses.every((x) => x.positive === undefined)).toBe(true);
      expect(
        r.references.some(
          (x) => x.source === 'campaign' && x.valueType === 'number' && x.key !== 'CURRENT_ACT',
        ),
      ).toBe(false);
      expect(r.presentation.text).not.toMatch(/SOFT CONTROL|confidence|\d+\.\d+%/i);
    }
  });

  for (const c of cases) {
    it(c.incident + ' preserves both existing action consequence records', () => {
      const f = fixture();
      expect(validateCampaignDefinition(f.d, f.catalog)).toMatchObject({ ok: true });
      const s = f.catalog.get(scenarioVersionKey(c.incident, '1.0.0'))!;
      for (const [id, seconds, cost, impact, risk] of [
        [c.recommended, 60, 220, 15, 5],
        [c.alternative, 150, 190, 30, 4],
      ] as const) {
        const a = s.actions.find((x) => x.id === id)!;
        expect(a.durationSeconds).toBe(seconds);
        expect(a.costs).toEqual(
          expect.arrayContaining([
            { resourceId: 'COST', amount: cost },
            { resourceId: 'CUSTOMER_IMPACT', amount: impact },
            { resourceId: 'OPERATIONAL_RISK', amount: risk },
          ]),
        );
      }
    });

    it(c.rule + ' requires the known flag, Act and current local causal observations', () => {
      const normal = fixture();
      expect(() => normal.prepare(normal.start(c.incident), c.rule)).toThrow(
        'UNAVAILABLE_PRESENTATION',
      );
      for (const f of [fixture({ known: false }), fixture({ act: c.act - 1 })]) {
        const r = f.investigate(c);
        expect(() => f.prepare(r, c.rule)).toThrow('UNAVAILABLE_PRESENTATION');
        expect(r.opportunities!.preparations).toHaveLength(0);
      }
    });

    for (const [action, positive] of [
      [c.recommended, true],
      [c.alternative, false],
    ] as const) {
      it(c.rule + ' records acknowledged response ' + action + ' without any score award', () => {
        const f = fixture();
        const prepared = f.prepare(f.investigate(c), c.rule);
        const id = prepared.opportunities!.preparations[0]!.id;
        expect(getCampaignPresentation(f.d, f.catalog, prepared, id)).toMatchObject({
          ok: true,
          presentation: {
            kind: 'recommendation',
            recommendedActionId: c.recommended,
            prediction: null,
          },
        });
        let r = f.ack(prepared);
        r = f.command(r, 'UPDATE_WAR_ROOM');
        expect(r.opportunities!.responses).toHaveLength(0);
        r = f.command(r, action);
        expect(r.opportunities!.responses).toHaveLength(1);
        expect(r.opportunities!.responses[0]).toMatchObject({
          ruleId: c.rule,
          actionId: action,
          positive,
        });
        expect(r.behavior!.metrics.aiRecommendationAcceptanceRate).toMatchObject({
          status: 'available',
          numerator: Number(positive),
          denominator: 1,
        });
        expect(r.behavior!.metrics.predictionDeviation.status).toBe('unavailable');
        expect(r.projection.values).toEqual(f.d.initial.values);
        expect(r.effectReceipts).toHaveLength(0);
        expect(replayCampaign(f.d, f.catalog, r.operations)).toMatchObject({ ok: true, run: r });
        expect(getCampaignPresentation(f.d, f.catalog, r, id)).toMatchObject({
          ok: true,
          presentation: null,
        });
      });
    }

    it(c.rule + ' allows direct recovery without fabricating a no-ACK response', () => {
      const f = fixture();
      for (const prepare of [false, true]) {
        let r = f.investigate(c);
        if (prepare) r = f.prepare(r, c.rule);
        r = f.command(r, c.alternative);
        expect(r.attempts[0]!.incident.completionReached).toBe(true);
        expect(r.opportunities!.responses).toHaveLength(0);
        expect(r.behavior!.metrics.aiRecommendationAcceptanceRate).toMatchObject({
          status: 'unavailable',
          denominator: 0,
        });
      }
    });

    it(c.rule + ' has an inclusive 180-second pre-command response deadline', () => {
      const f = fixture();
      for (const [updates, denominator] of [
        [12, 1],
        [13, 0],
      ] as const) {
        let r = f.ack(f.prepare(f.investigate(c), c.rule));
        const p = r.opportunities!.preparations[0]!;
        for (let i = 0; i < updates; i++) r = f.command(r, 'UPDATE_WAR_ROOM');
        expect(r.attempts[0]!.incident.elapsedSeconds - p.atSeconds).toBe(updates * 15);
        const current = getCampaignPresentation(f.d, f.catalog, r, p.id);
        expect(current.ok).toBe(true);
        if (!current.ok) throw new Error('invalid test display');
        expect(current.presentation === null).toBe(updates === 13);
        r = f.command(r, c.recommended);
        expect(r.behavior!.metrics.aiRecommendationAcceptanceRate.denominator).toBe(denominator);
      }
    });
  }

  it('pools four distinct observed recommendation acceptances without auto-inferring sustained dependency', () => {
    const f = fixture();
    const care = {
      incident: 'INC-015',
      rule: 'CARE_CAPACITY_RECOMMENDATION',
      trace: 'TRACE_DEFERRED_PATIENT_ROUTE',
      compare: 'COMPARE_PRIORITY_CONSTRAINTS',
      recommended: 'ADD_CARE_ROUTING_CAPACITY',
    };
    let run: CampaignRun | null = null;
    for (const c of [care, ...cases]) {
      run = f.command(f.ack(f.prepare(f.investigate(c, run), c.rule)), c.recommended);
    }
    if (!run) throw new Error('missing test run');
    expect(run.opportunities!.responses).toHaveLength(4);
    expect(new Set(run.opportunities!.responses.map((r) => r.ruleId)).size).toBe(4);
    expect(run.behavior!.metrics.aiRecommendationAcceptanceRate).toMatchObject({
      status: 'available',
      numerator: 4,
      denominator: 4,
    });
    expect(run.projection.values.aiDependency).toBe(0);
    expect(run.projection.endingFlags).toEqual({});
  });

  it('retains a real new retry sample while never consuming an old attempt ACK', () => {
    const f = fixture(),
      c = cases[0];
    let r = f.ack(f.prepare(f.investigate(c), c.rule));
    r = f.investigate(c, r, 'retry-without-ACK');
    r = f.command(r, c.recommended);
    expect(r.opportunities!.responses).toHaveLength(0);
    r = f.ack(f.prepare(r, c.rule));
    r = f.command(r, c.recommended);
    expect(r.opportunities!.responses).toHaveLength(1);
    expect(r.opportunities!.responses[0]!.attemptId).toBe('retry-without-ACK');
    const duplicate = prepareCampaignOperation(f.d, f.catalog, r, r.operations.at(-1)!);
    expect(duplicate).toMatchObject({ ok: true, disposition: 'duplicate', run: r });
  });
});

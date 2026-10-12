// Authored for deferred QA. Test-only partial composition, not native exposure or production admission.
import { describe, expect, it } from 'vitest';
import { authoredMidFixture } from './fixtures/authored-mid-campaign.ts';
import { validateCampaignDefinition } from '../scenario/campaign.ts';
import {
  replayCampaign,
  prepareCampaignOperation,
  campaignAttemptHead,
} from '../engine/campaign/transitions.ts';
import { getCampaignPrediction } from '../engine/player-model/prediction.ts';
import { getCampaignPresentation } from '../engine/campaign/opportunities.ts';
import { fixtureOperation } from './fixtures/opportunities.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';

describe('DEC-046 authored opportunities — deferred verification', () => {
  it('connects exact 18-Incident mappings and seven rules without changing old or early exposure', () => {
    const f = authoredMidFixture(),
      d = f.definition;
    expect(validateCampaignDefinition(d, f.catalog)).toMatchObject({ ok: true });
    expect(d.behavior!.scenarios).toHaveLength(18);
    expect(d.prediction!.scenarios).toHaveLength(18);
    expect(d.opportunities!.rules).toHaveLength(7);
    expect(d.opportunities!.id).toBe('orpheus-player-opportunities');
    expect(d.prediction!.contexts.every((c) => c.minimumSamples === 3)).toBe(true);
    for (const m of d.prediction!.scenarios) {
      if (m.coverage !== 'supported') throw new Error('Unsupported authored mapping');
      for (const c of m.contexts)
        if (
          !['INC-015', 'INC-017'].includes(m.scenarioId) ||
          c.contextId !== 'AFTER_CAUSAL_OBSERVATION'
        )
          expect(c.reveal).toEqual({
            type: 'compare',
            reference: 'ELAPSED',
            operator: 'lt',
            expected: 0,
          });
    }
    for (const m of d.behavior!.scenarios.filter((m) =>
      ['INC-011', 'INC-013'].includes(m.scenarioId),
    )) {
      if (m.coverage !== 'supported') throw new Error('Unsupported response mapping');
      for (const a of m.actions.filter((a) =>
        /^(SEND_|WITHHOLD_|PRESERVE_|DECLINE_)/.test(a.actionId),
      ))
        expect(a).toMatchObject({
          operational: false,
          restart: false,
          rollback: false,
          evidenceEligible: false,
        });
    }
  });

  const choices = [
    [
      'INC-015',
      'CARE_ROUTING_TRADEOFF',
      'safetyPreference',
      'RESTORE_MINIMUM_CARE_ROUTE',
      'ADD_CARE_ROUTING_CAPACITY',
    ],
    [
      'INC-016',
      'REVIEW_BYPASS_TRADEOFF',
      'collateralDamageTolerance',
      'BYPASS_NARROW_REVIEW_QUEUE',
      'HONOR_VERIFIED_REVIEW_RECEIPTS',
    ],
    [
      'INC-011',
      'GENERATOR_OWNERSHIP_REPORT',
      'companyReportingRate',
      'SEND_GENERATOR_OWNERSHIP_REPORT',
      'WITHHOLD_GENERATOR_OWNERSHIP_REPORT',
    ],
    [
      'INC-013',
      'OBJECTIVE_COPY_REQUEST',
      'nullCooperationRate',
      'PRESERVE_OBJECTIVE_CONSTRAINT_COPY',
      'DECLINE_OBJECTIVE_COPY_REQUEST',
    ],
  ] as const;
  for (const [incidentId, ruleId, metric, positive, negative] of choices) {
    for (const [action, numerator] of [
      [positive, 1],
      [negative, 0],
    ] as const) {
      it(ruleId + ' counts only its acknowledged explicit response: ' + action, () => {
        const f = authoredMidFixture();
        let run = f.investigate(incidentId);
        run = f.acknowledge(f.prepare(run, ruleId));
        run = f.command(run, 'UPDATE_WAR_ROOM');
        expect(run.opportunities!.responses).toHaveLength(0);
        run = f.command(run, action);
        expect(run.behavior!.metrics[metric]).toMatchObject({
          status: 'available',
          numerator,
          denominator: 1,
          value: numerator,
        });
        expect(run.opportunities!.responses[0]).toMatchObject({
          ruleId,
          actionId: action,
          positive: numerator === 1,
        });
        expect(run.projection.values).toEqual(f.definition.initial.values);
        expect(run.projection.alignment).toEqual(f.definition.initial.alignment);
        const replay = replayCampaign(f.definition, f.catalog, run.operations);
        expect(replay).toMatchObject({ ok: true });
        if (!replay.ok) throw new Error('Rejected test replay');
        expect(canonicalJson(replay.run)).toBe(canonicalJson(run));
      });
    }
    it(ruleId + ' has no response sample without committed display ACK', () => {
      const f = authoredMidFixture();
      let run = f.prepare(f.investigate(incidentId), ruleId);
      run = f.command(run, positive);
      expect(run.opportunities!.responses).toHaveLength(0);
      expect(run.behavior!.metrics[metric]).toMatchObject({
        status: 'unavailable',
        denominator: 0,
      });
    });
  }
  it('counts manual matching recommendations and a nonmatching causal repair independently of prediction', () => {
    for (const [action, positive] of [
      ['ADD_CARE_ROUTING_CAPACITY', true],
      ['RESTORE_MINIMUM_CARE_ROUTE', false],
    ] as const) {
      const f = authoredMidFixture();
      let run = f.acknowledge(f.prepare(f.investigate('INC-015'), 'CARE_CAPACITY_RECOMMENDATION'));
      run = f.command(run, action);
      expect(run.behavior!.metrics.aiRecommendationAcceptanceRate).toMatchObject({
        status: 'available',
        numerator: Number(positive),
        denominator: 1,
      });
      expect(run.behavior!.metrics.predictionDeviation).toMatchObject({
        status: 'unavailable',
        denominator: 0,
      });
    }
  });
  it('keeps insufficient empirical support UNKNOWN without fabricating exposed prediction history', () => {
    const f = authoredMidFixture(),
      run = f.investigate('INC-015');
    const p = getCampaignPrediction(f.definition, f.catalog, run, {
      contextId: 'AFTER_CAUSAL_OBSERVATION',
    });
    expect(p).toMatchObject({ ok: true, result: { kind: 'unknown', reason: 'EMPTY_HISTORY' } });
    expect(() => f.prepare(run, 'CARE_ACTION_PREDICTION')).toThrow('NO_VALID_PREDICTION');
    expect(run.opportunities!.preparations).toHaveLength(0);
    expect(run.behavior!.metrics.predictionDeviation).toMatchObject({
      status: 'unavailable',
      denominator: 0,
    });
  });
  it('derives supported prediction from genuine prior choices and records an acknowledged deviation', () => {
    const f = authoredMidFixture();
    let run = f.command(f.investigate('INC-015', null, 'training-0'), 'ADD_CARE_ROUTING_CAPACITY');
    for (let i = 1; i < 3; i++)
      run = f.command(f.investigate('INC-015', run, 'training-' + i), 'ADD_CARE_ROUTING_CAPACITY');
    run = f.investigate('INC-015', run, 'response-attempt');
    const prediction = getCampaignPrediction(f.definition, f.catalog, run, {
      contextId: 'AFTER_CAUSAL_OBSERVATION',
    });
    expect(prediction).toMatchObject({
      ok: true,
      result: {
        kind: 'predicted',
        actionId: 'ADD_CARE_ROUTING_CAPACITY',
        confidence: 1,
        eligibleTotal: 3,
      },
    });
    run = f.acknowledge(f.prepare(run, 'CARE_ACTION_PREDICTION'));
    run = f.command(run, 'RESTORE_MINIMUM_CARE_ROUTE');
    expect(run.behavior!.metrics.predictionDeviation).toMatchObject({
      status: 'available',
      numerator: 1,
      denominator: 1,
      value: 1,
    });
    expect(run.behavior!.metrics.aiRecommendationAcceptanceRate).toMatchObject({
      status: 'unavailable',
      denominator: 0,
    });
  });
  it('retains genuine unfinished retry history and pools distinct reporting responses', () => {
    const f = authoredMidFixture();
    let run = f.acknowledge(
      f.prepare(
        f.investigate('INC-011', null, 'first-report-attempt'),
        'GENERATOR_OWNERSHIP_REPORT',
      ),
    );
    run = f.command(run, 'SEND_GENERATOR_OWNERSHIP_REPORT');
    run = f.investigate('INC-011', run, 'second-report-attempt');
    run = f.acknowledge(f.prepare(run, 'GENERATOR_OWNERSHIP_REPORT'));
    run = f.command(run, 'WITHHOLD_GENERATOR_OWNERSHIP_REPORT');
    expect(run.behavior!.metrics.companyReportingRate).toMatchObject({
      status: 'available',
      numerator: 1,
      denominator: 2,
      value: 0.5,
    });
    expect(new Set(run.opportunities!.responses.map((r) => r.attemptId)).size).toBe(2);
  });
  it('accepts a response at age 180, closes after 180, and does not classify expiry as refusal', () => {
    for (const [updates, denominator] of [
      [12, 1],
      [13, 0],
    ] as const) {
      const f = authoredMidFixture();
      let run = f.acknowledge(f.prepare(f.investigate('INC-011'), 'GENERATOR_OWNERSHIP_REPORT'));
      const preparationId = run.opportunities!.preparations.at(-1)!.id;
      for (let i = 0; i < updates; i++) run = f.command(run, 'UPDATE_WAR_ROOM');
      const presentation = getCampaignPresentation(f.definition, f.catalog, run, preparationId);
      expect(presentation.ok).toBe(true);
      if (!presentation.ok) throw new Error('Rejected test display gate');
      expect(presentation.presentation === null).toBe(updates === 13);
      run = f.command(run, 'SEND_GENERATOR_OWNERSHIP_REPORT');
      expect(run.behavior!.metrics.companyReportingRate.denominator).toBe(denominator);
      if (!denominator)
        expect(run.behavior!.metrics.companyReportingRate.status).toBe('unavailable');
    }
  });
  it('preserves one acknowledged instance and rejects a reused preparation identity', () => {
    const f = authoredMidFixture();
    let run = f.acknowledge(f.prepare(f.investigate('INC-011'), 'GENERATOR_OWNERSHIP_REPORT'));
    const preparation = run.opportunities!.preparations.at(-1)!;
    run = f.command(run, 'SEND_GENERATOR_OWNERSHIP_REPORT');
    run = f.command(run, 'WITHHOLD_GENERATOR_OWNERSHIP_REPORT');
    expect(run.behavior!.metrics.companyReportingRate).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
    expect(getCampaignPresentation(f.definition, f.catalog, run, preparation.id)).toEqual({
      ok: true,
      presentation: null,
    });
    const a = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    const result = prepareCampaignOperation(
      f.definition,
      f.catalog,
      run,
      fixtureOperation(f.definition, run, {
        kind: 'prepare_opportunity',
        attemptId: a.id,
        priorHead: campaignAttemptHead(a),
        preparationId: preparation.id,
        ruleId: preparation.ruleId,
      }),
    );
    expect(result.ok).toBe(false);
    expect(run.opportunities!.responses).toHaveLength(1);
  });
});

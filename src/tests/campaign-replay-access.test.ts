// @vitest-environment node
// Authored for deferred QA; isolated v2 fixtures, not production/native acceptance.
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  getCampaignProgression,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import {
  campaignDefinitionSchema,
  validateCampaignDefinition,
  type CampaignDefinition,
} from '../scenario/campaign.ts';
import { campaignCatalog, campaignFixture } from './fixtures/campaign.ts';
import {
  opportunityCampaignFixture,
  fixtureOperation,
  startFixture,
  commandFixture,
  applyFixture,
} from './fixtures/opportunities.ts';
import { rootCauseResolutionReplay } from './fixtures/inc-001-replays.ts';

function fixture(policy = true): CampaignDefinition {
  const d = opportunityCampaignFixture();
  d.id = 'replay-access-fixture-only';
  if (policy) d.replayAccess = 'completed_prior_acts';
  d.effects.find((e) => e.id === 'completion')!.act = 2;
  return d;
}
function finish(d: CampaignDefinition, run: CampaignRun) {
  for (const command of rootCauseResolutionReplay.commands)
    run = commandFixture(d, run, command.actionId);
  return run;
}
function startInput(
  d: CampaignDefinition,
  run: CampaignRun,
  incidentId: string,
  attemptId: string,
) {
  return fixtureOperation(d, run, { kind: 'start', incidentId, attemptId, seed: 1002 });
}
function eligibility(d: CampaignDefinition, run: CampaignRun, id: string) {
  const result = getCampaignProgression(d, campaignCatalog, run);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.incidents.find((i) => i.id === id)!.result;
}
describe('DEC-060 opt-in replay access without legacy reinterpretation (deferred)', () => {
  it('keeps the optional policy absent in old schema output and rejects unknown policies/v1 use', () => {
    const legacy = campaignFixture();
    expect(campaignDefinitionSchema.parse(legacy)).not.toHaveProperty('replayAccess');
    expect(
      campaignDefinitionSchema.safeParse({ ...legacy, replayAccess: 'all_acts' }).success,
    ).toBe(false);
    expect(
      validateCampaignDefinition(
        { ...legacy, replayAccess: 'completed_prior_acts' },
        campaignCatalog,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        { code: 'INVALID_REPLAY_ACCESS_VERSION', path: 'replayAccess' },
      ]),
    });
  });
  it('preserves current-Act access and old prior-Act rejection after real completion', () => {
    const d = fixture(false);
    const current = startFixture(d);
    expect(eligibility(d, current, 'stage-one')).toEqual({ ok: true, value: true });
    const run = finish(d, current);
    expect(run.projection.act).toBe(2);
    expect(eligibility(d, run, 'stage-one')).toEqual({ ok: true, value: false });
    const before = canonicalJson(run);
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        run,
        startInput(d, run, 'stage-one', 'legacy-retry'),
      ),
    ).toMatchObject({ ok: false });
    expect(canonicalJson(run)).toBe(before);
    expect(replayCampaign(d, campaignCatalog, run.operations)).toMatchObject({ ok: true, run });
  });
  it('allows a new older-Act attempt, retains history and never rewinds Act/shared scores', () => {
    const d = fixture();
    let run = finish(d, startFixture(d));
    const prior = structuredClone(run);
    expect(eligibility(d, run, 'stage-one')).toEqual({ ok: true, value: true });
    run = applyFixture(d, run, {
      kind: 'start',
      incidentId: 'stage-one',
      attemptId: 'older-act-retry',
      seed: 1002,
    });
    expect(run.projection.act).toBe(2);
    run = finish(d, run);
    expect(run.attempts).toHaveLength(2);
    expect(run.attempts[0]).toEqual(prior.attempts[0]);
    expect(run.projection).toEqual(prior.projection);
    expect(run.effectReceipts).toEqual(prior.effectReceipts);
    expect(run.behavior!.metrics.evidenceBeforeActionRate.denominator).toBe(
      prior.behavior!.metrics.evidenceBeforeActionRate.denominator * 2,
    );
    expect(replayCampaign(d, campaignCatalog, run.operations)).toMatchObject({ ok: true, run });
  });
  it('rejects future Acts, incomplete older Incidents and seed-only completed membership', () => {
    const d = fixture();
    const current = startFixture(d);
    expect(eligibility(d, current, 'stage-two')).toEqual({ ok: true, value: false });
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        current,
        startInput(d, current, 'stage-two', 'future'),
      ),
    ).toMatchObject({ ok: false });
    for (const initialCompleted of [[], ['stage-one']]) {
      const seeded = fixture();
      seeded.initial.act = 2;
      seeded.initial.completed = initialCompleted;
      const run = applyFixture(seeded, null, { kind: 'create' });
      expect(eligibility(seeded, run, 'stage-one')).toEqual({ ok: true, value: false });
      expect(
        prepareCampaignOperation(
          seeded,
          campaignCatalog,
          run,
          startInput(seeded, run, 'stage-one', 'ungenuine'),
        ),
      ).toMatchObject({ ok: false });
    }
  });
  it('never overrides authored access conditions just because a prior Incident completed', () => {
    const d = fixture();
    d.incidents[0]!.eligibility = {
      type: 'compare',
      reference: 'act',
      operator: 'eq',
      expected: 1,
    };
    const run = finish(d, startFixture(d));
    expect(run.projection.act).toBe(2);
    expect(run.projection.completed).toContain('stage-one');
    expect(eligibility(d, run, 'stage-one')).toEqual({ ok: true, value: false });
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        run,
        startInput(d, run, 'stage-one', 'authored-denial'),
      ),
    ).toMatchObject({ ok: false });
  });
  it('rejects forged projections and stale command heads while preserving the source record', () => {
    const d = fixture();
    const run = startFixture(d);
    const forged = structuredClone(run);
    forged.projection.act = 2;
    forged.projection.completed.push('stage-one');
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        forged,
        startInput(d, forged, 'stage-one', 'forged'),
      ),
    ).toMatchObject({ ok: false });
    const a = run.attempts.at(-1)!;
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        run,
        fixtureOperation(d, run, {
          kind: 'command',
          attemptId: a.id,
          inputId: 'stale',
          commandSequence: 0,
          priorHead: campaignAttemptHead(a) + '-stale',
          command: { type: 'perform_action', actionId: 'OPEN_LOGS' },
        }),
      ),
    ).toMatchObject({ ok: false });
  });
});

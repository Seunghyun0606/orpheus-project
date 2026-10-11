// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import { validateCampaignDefinition } from '../scenario/campaign.ts';
import { getCampaignPrediction } from '../engine/player-model/prediction.ts';
import {
  createCampaignLedger,
  campaignDefinitionKey,
  verifyCampaignRecord,
} from '../persistence/campaign-ledger.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';
import {
  opportunityCampaignFixture,
  choiceRule,
  fixtureOperation,
  applyFixture,
  startFixture,
  commandFixture,
  prepareFixture,
  acknowledgeFixture,
  trainedFixture,
} from './fixtures/opportunities.ts';
import { encodeSave } from '../persistence/save.ts';
import { elapsed } from './fixtures/prediction.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';

afterEach(() => vi.restoreAllMocks());
const metric = (r: CampaignRun) => r.behavior!.metrics.predictionDeviation;
describe('new-only v2 presentation and causal response records', () => {
  it('validates exact versions and required authored lifecycle/reference contracts', () => {
    const d = opportunityCampaignFixture();
    expect(validateCampaignDefinition(d, campaignCatalog)).toMatchObject({ ok: true });
    for (const mutate of [
      (x: typeof d) => {
        delete x.recordVersion;
      },
      (x: typeof d) => {
        x.opportunities!.behaviorVersion = 'latest';
      },
      (x: typeof d) => {
        x.opportunities!.rules[0]!.references[0]!.version = 'latest';
      },
      (x: typeof d) => {
        x.opportunities!.rules[0]!.responses[0]!.actionId = 'UNKNOWN';
      },
      (x: typeof d) => {
        x.opportunities!.rules[0]!.valid = { ...elapsed, reference: 'missing' } as never;
      },
      (x: typeof d) => {
        delete (
          x.opportunities!.rules[0] as Partial<NonNullable<typeof d.opportunities>['rules'][number]>
        ).replacement;
      },
      (x: typeof d) => {
        x.replayVersion = 1;
      },
    ]) {
      const copy = structuredClone(d);
      mutate(copy);
      expect(validateCampaignDefinition(copy, campaignCatalog).ok).toBe(false);
    }
  });
  it.each([
    ['RESTART_API', 0],
    ['ROLLBACK', 1],
  ] as const)(
    'committed prediction then %s yields %s/1 with immutable provenance',
    (action, numerator) => {
      const d = opportunityCampaignFixture();
      let r = trainedFixture(d);
      const before = canonicalJson(r);
      expect(getCampaignPrediction(d, campaignCatalog, r, { contextId: 'pressure' })).toMatchObject(
        { ok: true, result: { kind: 'predicted', actionId: 'RESTART_API' } },
      );
      expect(canonicalJson(r)).toBe(before);
      expect(metric(r).status).toBe('unavailable');
      r = prepareFixture(d, r);
      expect(metric(r).status).toBe('unavailable');
      const frozen = canonicalJson(r.opportunities!.preparations);
      r = acknowledgeFixture(d, r);
      expect(metric(r).status).toBe('unavailable');
      const head = campaignAttemptHead(r.attempts.at(-1)!);
      const ack = r.opportunities!.acknowledgements[0]!;
      r = commandFixture(d, r, 'OPEN_LOGS');
      expect(metric(r).status).toBe('unavailable');
      r = commandFixture(d, r, action);
      expect(metric(r)).toMatchObject({
        status: 'available',
        numerator,
        denominator: 1,
        value: numerator,
      });
      expect(r.opportunities!.responses[0]).toMatchObject({
        acknowledgementId: ack.operationId,
        attemptId: 'attempt',
        actionId: action,
        positive: numerator === 1,
      });
      expect(r.opportunities!.responses[0]!.operationSequence).toBeGreaterThan(ack.historyBoundary);
      expect(r.opportunities!.responses[0]!.priorHead).not.toBe(head); // unrelated accepted investigation changes causal head
      expect(canonicalJson(r.opportunities!.preparations)).toBe(frozen);
      const duplicate = prepareCampaignOperation(d, campaignCatalog, r, r.operations.at(-1)!);
      expect(duplicate).toMatchObject({ ok: true, disposition: 'duplicate', run: r });
      r = commandFixture(d, r, 'RESTART_API');
      expect(metric(r).denominator).toBe(1);
      expect(replayCampaign(d, campaignCatalog, r.operations)).toMatchObject({ ok: true, run: r });
    },
  );
  it('pools two genuinely exposed mismatches across 2 and 10 responses, not per-attempt rates', () => {
    const d = opportunityCampaignFixture();
    // Broad age window is explicit fixture data, not a runtime default.
    d.opportunities!.rules[0]!.valid = {
      type: 'compare',
      reference: 'age',
      operator: 'lte',
      expected: 9999,
    };
    let r = trainedFixture(d);
    for (const [name, count] of [
      ['attempt', 2],
      ['second', 10],
    ] as const) {
      if (name === 'second') r = startFixture(d, r, name);
      for (let i = 0; i < count; i++) {
        r = acknowledgeFixture(d, prepareFixture(d, r));
        const p = r.opportunities!.preparations.at(-1)!.prediction!;
        if (!p.ok || p.result.kind !== 'predicted')
          throw new Error('Fixture requires unique prediction');
        const action =
          i === 0
            ? p.result.actionId === 'ROLLBACK'
              ? 'RESTART_API'
              : 'ROLLBACK'
            : p.result.actionId;
        r = commandFixture(d, r, action);
      }
    }
    expect(metric(r)).toMatchObject({
      numerator: 2,
      denominator: 12,
      status: 'available',
      value: 2 / 12,
    });
    expect(
      r.opportunities!.responses.filter((x) => x.attemptId === 'attempt' && x.positive),
    ).toHaveLength(1);
    expect(
      r.opportunities!.responses.filter((x) => x.attemptId === 'second' && x.positive),
    ).toHaveLength(1);
  });
  it('no ACK, rejected commands, gated/UNKNOWN preparations, expiry and wrong heads fabricate no response', () => {
    const d = opportunityCampaignFixture();
    const unknown = startFixture(d);
    expect(() => prepareFixture(d, unknown)).toThrow('NO_VALID_PREDICTION');
    let r = prepareFixture(d, trainedFixture(d));
    r = commandFixture(d, r, 'ROLLBACK');
    expect(metric(r).denominator).toBe(0);
    expect(() => acknowledgeFixture(d, r)).toThrow('INVALID_PRESENTATION_BOUNDARY');
    r = acknowledgeFixture(d, prepareFixture(d, r));
    expect(() => commandFixture(d, r, 'MISSING_ACTION')).toThrow();
    expect(metric(r).denominator).toBe(0);
    const gated = structuredClone(d);
    gated.opportunities!.rules[0]!.reveal = { type: 'not', child: elapsed };
    expect(() => prepareFixture(gated, trainedFixture(gated))).toThrow('UNAVAILABLE_PRESENTATION');
    const expiring = opportunityCampaignFixture();
    expiring.opportunities!.rules[0]!.valid = {
      type: 'compare',
      reference: 'age',
      operator: 'lte',
      expected: 0,
    };
    r = acknowledgeFixture(expiring, prepareFixture(expiring, trainedFixture(expiring)));
    r = commandFixture(expiring, r, 'OPEN_LOGS');
    r = commandFixture(expiring, r, 'ROLLBACK');
    expect(metric(r).denominator).toBe(0);
  });
  it('diagnoses overlapping opportunity association rather than selecting a latest display', () => {
    const d = opportunityCampaignFixture();
    d.opportunities!.rules.push({
      ...structuredClone(d.opportunities!.rules[0]!),
      id: 'second-rule',
    });
    let r = acknowledgeFixture(d, prepareFixture(d, trainedFixture(d)));
    expect(() => prepareFixture(d, r)).toThrow('DUPLICATE_PRESENTATION_BOUNDARY');
    r = acknowledgeFixture(d, prepareFixture(d, r, undefined, 'second-rule'));
    expect(() => commandFixture(d, r, 'RESTART_API')).toThrow('AMBIGUOUS_RESPONSE_ASSOCIATION');
    expect(metric(r).denominator).toBe(0);
  });
  it('revalidates current authored prediction candidates after unrelated investigation', () => {
    const d = opportunityCampaignFixture();
    const mapping = d.prediction!.scenarios[0]!;
    if (mapping.coverage !== 'supported') throw new Error('fixture coverage');
    mapping.contexts[0]!.choices.find((c) => c.actionId === 'ROLLBACK')!.eligible = {
      type: 'compare',
      reference: 'elapsed',
      operator: 'lte',
      expected: 0,
    };
    let r = acknowledgeFixture(d, prepareFixture(d, trainedFixture(d)));
    r = commandFixture(d, r, 'OPEN_LOGS');
    r = commandFixture(d, r, 'ROLLBACK');
    expect(metric(r).denominator).toBe(0);
    // No response is inferred from engine availability alone.
    r = commandFixture(d, r, 'RESTART_API');
    expect(metric(r)).toMatchObject({ numerator: 0, denominator: 1 });
    expect(
      r.opportunities!.responses[0]!.predictionContext!.availableCandidates.some(
        (c) => c.actionId === 'ROLLBACK',
      ),
    ).toBe(false);
  });
  it('keeps checkpoint baselines and later attempts from inheriting exposed response opportunities', () => {
    const d = opportunityCampaignFixture();
    let r = acknowledgeFixture(d, prepareFixture(d, trainedFixture(d)));
    const a = r.attempts.at(-1)!;
    r = applyFixture(d, r, {
      kind: 'checkpoint',
      attemptId: 'checkpoint',
      incidentId: 'stage-one',
      sourceBytes: encodeSave(inc001Scenario, a.incident.rng.seed, a.incident),
      confirmed: true,
    });
    r = commandFixture(d, r, 'ROLLBACK');
    expect(metric(r).denominator).toBe(0);
    r = startFixture(d, r, 'new-attempt');
    r = commandFixture(d, r, 'RESTART_API');
    expect(metric(r).denominator).toBe(0);
  });
  it.each([
    'safetyPreference',
    'collateralDamageTolerance',
    'companyReportingRate',
    'nullCooperationRate',
  ] as const)(
    'pools only explicit eligible %s choices with supported zero and distinct metric coverage',
    (key) => {
      const d = opportunityCampaignFixture();
      d.opportunities!.rules = [choiceRule(d, key)];
      let r = startFixture(d);
      r = acknowledgeFixture(d, prepareFixture(d, r, undefined, key));
      r = commandFixture(d, r, 'ROLLBACK');
      expect(r.behavior!.metrics[key]).toMatchObject({
        status: 'available',
        value: 0,
        numerator: 0,
        denominator: 1,
      });
      expect(r.behavior!.metrics.predictionDeviation).toMatchObject({
        status: 'unavailable',
        coverage: { supportedCommandAttempts: 0, unsupportedCommandAttempts: 1 },
      });
      r = acknowledgeFixture(d, prepareFixture(d, r, undefined, key));
      r = commandFixture(d, r, 'RESTART_API');
      expect(r.behavior!.metrics[key]).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
    },
  );
  it('distinguishes recommendation from prediction and manual execution can match', () => {
    const d = opportunityCampaignFixture();
    const { contextId: _context, ...base } = d.opportunities!.rules[0]!;
    void _context;
    d.opportunities!.rules = [
      {
        ...base,
        id: 'recommendation',
        kind: 'recommendation',
        metric: 'aiRecommendationAcceptanceRate',
        recommendedActionId: 'ROLLBACK',
      },
    ];
    let r = startFixture(d);
    r = acknowledgeFixture(d, prepareFixture(d, r, undefined, 'recommendation'));
    r = commandFixture(d, r, 'ROLLBACK');
    expect(r.behavior!.metrics.aiRecommendationAcceptanceRate).toMatchObject({
      numerator: 1,
      denominator: 1,
      value: 1,
    });
    expect(metric(r).status).toBe('unavailable');
  });
  it('preserves v1 exact shape and rejects retrofitting or forged v2 projections', () => {
    const d = campaignFixture();
    const old = prepareCampaignOperation(
      d,
      campaignCatalog,
      null,
      operation(null, { kind: 'create' }),
    );
    if (!old.ok) throw new Error('old fixture');
    expect(old.run.schemaVersion).toBe(1);
    expect('opportunities' in old.run).toBe(false);
    expect(replayCampaign(d, campaignCatalog, old.run.operations)).toMatchObject({
      ok: true,
      run: old.run,
    });
    const v2 = opportunityCampaignFixture();
    expect(
      prepareCampaignOperation(
        v2,
        campaignCatalog,
        old.run,
        fixtureOperation(v2, old.run, {
          kind: 'start',
          attemptId: 'new',
          incidentId: 'stage-one',
          seed: 1,
        }),
      ).ok,
    ).toBe(false);
    const r = commandFixture(
      v2,
      acknowledgeFixture(v2, prepareFixture(v2, trainedFixture(v2))),
      'ROLLBACK',
    );
    const authorities = {
      definitions: new Map([[campaignDefinitionKey(v2.id, v2.version), v2]]),
      scenarios: campaignCatalog,
    };
    expect(verifyCampaignRecord(r, r.runId, authorities)).toMatchObject({ ok: true });
    const forged = structuredClone(r);
    forged.opportunities!.responses[0]!.positive = false;
    expect(verifyCampaignRecord(forged, r.runId, authorities)).toMatchObject({ ok: false });
  });
});

describe('isolated physical v2 ledger recovery, no user stores', () => {
  async function setup() {
    const d = opportunityCampaignFixture();
    const factory = new IDBFactory();
    const authorities = {
      definitions: new Map([[campaignDefinitionKey(d.id, d.version), d]]),
      scenarios: campaignCatalog,
    };
    const ledger = createCampaignLedger(authorities, () => factory);
    const r = acknowledgeFixture(d, prepareFixture(d, trainedFixture(d)));
    for (let i = 0; i < r.operations.length; i++) {
      const prefix = replayCampaign(d, campaignCatalog, r.operations.slice(0, i + 1));
      if (!prefix.ok) throw new Error('invalid prefix');
      expect(
        await ledger.commit({
          runId: r.runId,
          expectedRevision: i ? i - 1 : null,
          operation: r.operations[i],
          candidate: prefix.run,
        }),
      ).toMatchObject({ ok: true });
    }
    return { d, r, ledger, factory, authorities };
  }
  it('reloads ACK before response; lost acknowledgement reconciles one immutable sample and conflicts reject', async () => {
    const { d, r, ledger, factory, authorities } = await setup();
    expect(await createCampaignLedger(authorities, () => factory).read(r.runId)).toMatchObject({
      ok: true,
      run: r,
    });
    const candidate = commandFixture(d, r, 'ROLLBACK');
    const request = {
      runId: r.runId,
      expectedRevision: r.revision,
      operation: candidate.operations.at(-1)!,
      candidate,
    };
    expect(await ledger.commit(request)).toMatchObject({ ok: true, disposition: 'committed' });
    expect(await ledger.commit(request)).toMatchObject({
      ok: true,
      disposition: 'duplicate',
      run: candidate,
    });
    const other = commandFixture(d, r, 'RESTART_API');
    expect(
      await ledger.commit({ ...request, operation: other.operations.at(-1)!, candidate: other }),
    ).toMatchObject({ ok: false });
    expect(await ledger.read(r.runId)).toMatchObject({ ok: true, run: candidate });
  });
  it('abort after individual put success leaves durable ACK and no response', async () => {
    const { d, r, ledger } = await setup();
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const req = original.apply(this, args);
      req.addEventListener('success', () => this.transaction.abort());
      return req;
    });
    const candidate = commandFixture(d, r, 'ROLLBACK');
    expect(
      await ledger.commit({
        runId: r.runId,
        expectedRevision: r.revision,
        operation: candidate.operations.at(-1)!,
        candidate,
      }),
    ).toMatchObject({ ok: false, code: 'TRANSACTION_ABORTED' });
    spy.mockRestore();
    expect(await ledger.read(r.runId)).toMatchObject({ ok: true, run: r });
    expect(metric(r).denominator).toBe(0);
  });
});

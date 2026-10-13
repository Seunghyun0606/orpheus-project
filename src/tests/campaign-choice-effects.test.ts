// @vitest-environment node
// Synthetic scores and authorities only; never production balance or user stores.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { replayCommands } from '../engine/simulation.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import { validateCampaignDefinition, type CampaignDefinition } from '../scenario/campaign.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { encodeSave } from '../persistence/save.ts';
import {
  campaignDefinitionKey,
  createCampaignLedger,
  verifyCampaignRecord,
} from '../persistence/campaign-ledger.ts';
import { always, campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';
import { elapsed } from './fixtures/prediction.ts';
import {
  opportunityCampaignFixture,
  fixtureOperation,
  applyFixture,
  startFixture,
  commandFixture,
  prepareFixture,
  acknowledgeFixture,
} from './fixtures/opportunities.ts';

const rawId = 'test-only-communication';
const positiveId = 'test-only-accepted-recommendation';
const negativeId = 'test-only-other-response';
function definition(): CampaignDefinition {
  const d = opportunityCampaignFixture();
  d.id = 'choice-effects-fixture-only';
  d.version = 'choice-effects-fixture-v1';
  for (const ref of d.references) ref.version = d.version;
  for (const branch of d.branches!) branch.version = d.version;
  const { contextId: _context, ...rule } = d.opportunities!.rules[0]!;
  void _context;
  d.opportunities!.rules = [
    {
      ...rule,
      id: 'recommendation',
      kind: 'recommendation',
      metric: 'aiRecommendationAcceptanceRate',
      recommendedActionId: 'RESTART_API',
    },
  ];
  d.effects.push(
    {
      id: rawId,
      trigger: { incidentId: 'stage-one', type: 'action_completed', targetId: 'UPDATE_WAR_ROOM' },
      boundary: 'post_event',
      condition: always,
      alignment: { corporate: 7 },
      values: {},
      narrativeFlags: {},
      endingFlags: {},
    },
    {
      id: positiveId,
      trigger: {
        incidentId: 'stage-one',
        type: 'action_completed',
        targetId: 'RESTART_API',
        response: { ruleId: 'recommendation', positive: true },
      },
      boundary: 'post_event',
      condition: always,
      alignment: {},
      values: { aiDependency: 5 },
      narrativeFlags: {},
      endingFlags: {},
    },
    {
      id: negativeId,
      trigger: {
        incidentId: 'stage-one',
        type: 'action_completed',
        targetId: 'ROLLBACK',
        response: { ruleId: 'recommendation', positive: false },
      },
      boundary: 'post_event',
      condition: always,
      alignment: {},
      values: { publicInterest: 2 },
      narrativeFlags: {},
      endingFlags: {},
    },
  );
  return d;
}
function expose(d: CampaignDefinition, r: CampaignRun) {
  return acknowledgeFixture(d, prepareFixture(d, r, undefined, 'recommendation'));
}
function effect(d: CampaignDefinition, id: string) {
  return d.effects.find((e) => e.id === id)!;
}
const receipts = (r: CampaignRun, id: string) => r.effectReceipts.filter((e) => e.effectId === id);
const authorities = (d: CampaignDefinition) => ({
  definitions: new Map([[campaignDefinitionKey(d.id, d.version), d]]),
  scenarios: campaignCatalog,
});
afterEach(() => vi.restoreAllMocks());

describe('DEC-055 genuine completed-action and verified-response effect sources', () => {
  it('awards a raw action only at its real completion, not the command target payload', () => {
    const d = definition();
    const before = startFixture(d);
    const a = before.attempts.at(-1)!;
    const op = fixtureOperation(d, before, {
      kind: 'command',
      attemptId: a.id,
      inputId: 'input-target-payload',
      commandSequence: a.incident.replayLog.length,
      priorHead: campaignAttemptHead(a),
      command: { type: 'perform_action', actionId: 'UPDATE_WAR_ROOM', targetId: 'RESTART_API' },
    });
    const result = prepareCampaignOperation(d, campaignCatalog, before, op);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const r = result.run;
    expect(before.projection.alignment.corporate).toBe(0);
    expect(r.projection.alignment.corporate).toBe(7);
    expect(r.projection.values.aiDependency).toBe(0);
    const receipt = receipts(r, rawId)[0]!;
    const completed = r.attempts.at(-1)!.incident.eventLog[receipt.eventSequence]!;
    expect(completed).toMatchObject({
      type: 'action_completed',
      sourceId: 'UPDATE_WAR_ROOM',
      targetId: 'RESTART_API',
      atSeconds: 15,
    });
    expect(receipt).toMatchObject({ operationId: op.operationId, attemptId: a.id });
    expect(r.opportunities!.responses).toHaveLength(0);
  });

  it.each([
    ['RESTART_API', true, positiveId, 5, 0],
    ['ROLLBACK', false, negativeId, 0, 2],
  ] as const)(
    'uses the calculated %s response, not a displayed rate',
    (action, positive, id, ai, publicValue) => {
      const d = definition();
      const before = expose(d, startFixture(d));
      const frozen = canonicalJson(before);
      const r = commandFixture(d, before, action);
      expect(canonicalJson(before)).toBe(frozen);
      expect(r.opportunities!.responses).toHaveLength(1);
      expect(r.opportunities!.responses[0]).toMatchObject({ actionId: action, positive });
      expect(r.projection.values.aiDependency).toBe(ai);
      expect(r.projection.values.publicInterest).toBe(publicValue);
      expect(receipts(r, id)).toHaveLength(1);
      const receipt = receipts(r, id)[0]!;
      expect(r.attempts.at(-1)!.incident.eventLog[receipt.eventSequence]).toMatchObject({
        type: 'action_completed',
        sourceId: action,
      });
      expect(replayCampaign(d, campaignCatalog, r.operations)).toMatchObject({ ok: true, run: r });
    },
  );

  it.each(['RESTART_API', 'ROLLBACK'])(
    'does not award %s without preparation or actual ACK',
    (action) => {
      const d = definition();
      for (const before of [
        startFixture(d),
        prepareFixture(d, startFixture(d), undefined, 'recommendation'),
      ]) {
        const r = commandFixture(d, before, action);
        expect(r.opportunities!.responses).toHaveLength(0);
        expect(receipts(r, positiveId)).toHaveLength(0);
        expect(receipts(r, negativeId)).toHaveLength(0);
        expect(r.behavior!.metrics.aiRecommendationAcceptanceRate.status).toBe('unavailable');
      }
    },
  );

  it('does not confuse an unrelated action, expiry or a rejected command with a response', () => {
    const d = definition();
    d.opportunities!.rules[0]!.valid = {
      type: 'compare',
      reference: 'age',
      operator: 'lte',
      expected: 0,
    };
    let r = expose(d, startFixture(d));
    const frozen = canonicalJson(r);
    expect(() => commandFixture(d, r, 'MISSING_ACTION')).toThrow();
    expect(canonicalJson(r)).toBe(frozen);
    r = commandFixture(d, r, 'UPDATE_WAR_ROOM');
    expect(receipts(r, rawId)).toHaveLength(1);
    expect(r.opportunities!.responses).toHaveLength(0);
    r = commandFixture(d, r, 'RESTART_API');
    expect(r.opportunities!.responses).toHaveLength(0);
    expect(receipts(r, positiveId)).toHaveLength(0);
  });

  it('does not match the wrong polarity or reuse a consumed or other-attempt response', () => {
    const d = definition();
    effect(d, positiveId).trigger.response!.positive = false;
    let r = commandFixture(d, expose(d, startFixture(d)), 'RESTART_API');
    expect(r.opportunities!.responses[0]!.positive).toBe(true);
    expect(receipts(r, positiveId)).toHaveLength(0);
    r = commandFixture(d, r, 'ROLLBACK');
    expect(receipts(r, negativeId)).toHaveLength(0);
    r = startFixture(d, r, 'retry-with-no-exposure');
    r = commandFixture(d, r, 'ROLLBACK');
    expect(receipts(r, negativeId)).toHaveLength(0);
  });

  it('pays once per effect across new exposures/retries while genuine samples continue to grow', () => {
    const d = definition();
    let r = commandFixture(d, expose(d, startFixture(d)), 'RESTART_API');
    const duplicate = prepareCampaignOperation(d, campaignCatalog, r, r.operations.at(-1)!);
    expect(duplicate).toMatchObject({ ok: true, disposition: 'duplicate', run: r });
    r = commandFixture(d, expose(d, r), 'RESTART_API');
    r = startFixture(d, r, 'retry');
    r = commandFixture(d, expose(d, r), 'RESTART_API');
    expect(r.opportunities!.responses).toHaveLength(3);
    expect(receipts(r, positiveId)).toHaveLength(1);
    expect(r.projection.values.aiDependency).toBe(5);
    expect(r.behavior!.metrics.aiRecommendationAcceptanceRate.denominator).toBe(3);
    expect(replayCampaign(d, campaignCatalog, r.operations)).toMatchObject({ ok: true, run: r });
  });

  it('does not award inherited checkpoint actions or imported discoveries', () => {
    const d = definition();
    const historical = replayCommands(inc001Scenario, { seed: 1002 }, [
      { type: 'perform_action', actionId: 'UPDATE_WAR_ROOM' },
    ]);
    if (!historical.ok) throw new Error('invalid test-only history');
    const bytes = encodeSave(inc001Scenario, 1002, historical.state);
    let r = applyFixture(d, null, { kind: 'create' });
    r = applyFixture(d, r, { kind: 'adopt', sourceBytes: [bytes], confirmed: true });
    r = applyFixture(d, r, {
      kind: 'checkpoint',
      attemptId: 'checkpoint',
      incidentId: 'stage-one',
      sourceBytes: bytes,
      confirmed: true,
    });
    expect(r.attempts[0]!.baselineEventCount).toBeGreaterThan(0);
    expect(receipts(r, rawId)).toHaveLength(0);
    r = commandFixture(d, r, 'OPEN_LOGS');
    expect(receipts(r, rawId)).toHaveLength(0);
    r = commandFixture(d, r, 'UPDATE_WAR_ROOM');
    const receipt = receipts(r, rawId)[0]!;
    expect(receipt.eventSequence).toBeGreaterThanOrEqual(r.attempts[0]!.baselineEventCount);
    expect(r.projection.alignment.corporate).toBe(7);
  });

  it('uses the explicitly authored pre-command or post-event boundary', () => {
    for (const boundary of ['pre_command', 'post_event'] as const) {
      const d = definition();
      d.references.find((r) => r.id === 'dependency')!.contexts.push('effect');
      d.effects.push({
        id: 'test-only-ordered-effect',
        trigger: structuredClone(effect(d, positiveId).trigger),
        boundary,
        condition: { type: 'compare', reference: 'dependency', operator: 'gte', expected: 5 },
        alignment: {},
        values: { curiosity: 1 },
        narrativeFlags: {},
        endingFlags: {},
      });
      const r = commandFixture(d, expose(d, startFixture(d)), 'RESTART_API');
      expect(r.projection.values.curiosity).toBe(boundary === 'pre_command' ? 0 : 1);
    }
  });

  it('matches two different qualified rules independently on one accepted command', () => {
    const d = definition();
    const base = d.opportunities!.rules[0]!;
    const { recommendedActionId: _recommended, ...choice } = base;
    void _recommended;
    d.opportunities!.rules.push({
      ...structuredClone(choice),
      id: 'report-choice',
      kind: 'choice',
      metric: 'companyReportingRate',
      responses: base.responses.map((r) => ({
        ...r,
        positive: elapsed,
      })),
    });
    d.effects.push({
      ...structuredClone(effect(d, positiveId)),
      id: 'test-only-second-rule',
      trigger: {
        incidentId: 'stage-one',
        type: 'action_completed',
        targetId: 'RESTART_API',
        response: { ruleId: 'report-choice', positive: true },
      },
      values: { teamTrust: 1 },
    });
    let r = expose(d, startFixture(d));
    r = acknowledgeFixture(d, prepareFixture(d, r, undefined, 'report-choice'));
    r = commandFixture(d, r, 'RESTART_API');
    expect(r.opportunities!.responses).toHaveLength(2);
    expect(receipts(r, positiveId)).toHaveLength(1);
    expect(receipts(r, 'test-only-second-rule')).toHaveLength(1);
  });

  it('retains strict unavailable diagnostics in an authored effect condition', () => {
    const d = definition();
    effect(d, rawId).condition = {
      type: 'all',
      children: [
        { type: 'compare', reference: 'act', operator: 'lt', expected: 0 },
        { type: 'compare', reference: 'metric', operator: 'gte', expected: 0 },
      ],
    };
    const r = startFixture(d);
    const frozen = canonicalJson(r);
    expect(r.behavior!.metrics.restartRate.status).toBe('unavailable');
    expect(() => commandFixture(d, r, 'UPDATE_WAR_ROOM')).toThrow();
    expect(canonicalJson(r)).toBe(frozen);
    expect(receipts(r, rawId)).toHaveLength(0);
  });

  it('rejects malformed targets, qualifiers, cross-incident/model references and impossible positive recommendation targets', () => {
    const mutations: ((d: CampaignDefinition) => void)[] = [
      (d) => {
        delete effect(d, rawId).trigger.targetId;
      },
      (d) => {
        effect(d, rawId).trigger.targetId = 'MISSING';
      },
      (d) => {
        effect(d, positiveId).trigger.type = 'completion_reached';
      },
      (d) => {
        effect(d, positiveId).trigger.response!.ruleId = 'UNKNOWN';
      },
      (d) => {
        effect(d, positiveId).trigger.targetId = 'OPEN_LOGS';
      },
      (d) => {
        effect(d, positiveId).trigger.targetId = 'ROLLBACK';
      },
      (d) => {
        d.opportunities!.rules[0]!.incidentId = 'stage-two';
      },
      (d) => {
        d.opportunities!.version = 'latest';
      },
      (d) => {
        d.opportunities!.behaviorVersion = 'latest';
      },
      (d) => {
        effect(d, positiveId).trigger.response = { ruleId: 'recommendation' } as never;
      },
      (d) => {
        effect(d, positiveId).trigger.response = {
          ruleId: 'recommendation',
          positive: true,
          extra: 1,
        } as never;
      },
    ];
    expect(validateCampaignDefinition(definition(), campaignCatalog)).toMatchObject({ ok: true });
    for (const mutate of mutations) {
      const d = definition();
      mutate(d);
      expect(validateCampaignDefinition(d, campaignCatalog).ok).toBe(false);
    }
  });

  it('validates explicit compatible-content triggers without losing their response qualifier', () => {
    const d = definition();
    const variant = { ...structuredClone(inc001Scenario), contentVersion: '9.0.0-effect-fixture' };
    const catalog = new Map(campaignCatalog).set(
      scenarioVersionKey(variant.id, variant.contentVersion),
      variant,
    );
    d.incidents[0]!.compatibleContentVersions = [variant.contentVersion];
    d.behavior!.scenarios.push({
      ...structuredClone(d.behavior!.scenarios[0]!),
      contentVersion: variant.contentVersion,
    });
    d.prediction!.scenarios.push({
      ...structuredClone(d.prediction!.scenarios[0]!),
      contentVersion: variant.contentVersion,
    });
    effect(d, rawId).additionalTriggers = [
      {
        contentVersion: variant.contentVersion,
        type: 'action_completed',
        targetId: 'UPDATE_WAR_ROOM',
      },
    ];
    effect(d, positiveId).additionalTriggers = [
      {
        contentVersion: variant.contentVersion,
        type: 'action_completed',
        targetId: 'RESTART_API',
        response: { ruleId: 'recommendation', positive: true },
      },
    ];
    expect(validateCampaignDefinition(d, catalog).ok).toBe(false); // old rule is not a variant rule
    const alternate = {
      ...structuredClone(d.opportunities!.rules[0]!),
      id: 'alternate-recommendation',
      contentVersion: variant.contentVersion,
    };
    d.opportunities!.rules.push(alternate);
    effect(d, positiveId).additionalTriggers![0]!.response!.ruleId = alternate.id;
    expect(validateCampaignDefinition(d, catalog)).toMatchObject({ ok: true });
    const created = prepareCampaignOperation(
      d,
      catalog,
      null,
      fixtureOperation(d, null, { kind: 'create' }),
    );
    if (!created.ok) throw new Error(JSON.stringify(created.diagnostics));
    let r = created.run;
    const apply = (payload: Parameters<typeof fixtureOperation>[2]) => {
      const result = prepareCampaignOperation(d, catalog, r, fixtureOperation(d, r, payload));
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      r = result.run;
    };
    apply({
      kind: 'start',
      attemptId: 'alternate',
      incidentId: 'stage-one',
      seed: 1002,
      contentVersion: variant.contentVersion,
    });
    apply({
      kind: 'prepare_opportunity',
      attemptId: 'alternate',
      priorHead: campaignAttemptHead(r.attempts.at(-1)!),
      preparationId: 'alt-p',
      ruleId: alternate.id,
    });
    apply({
      kind: 'acknowledge_presentation',
      attemptId: 'alternate',
      priorHead: campaignAttemptHead(r.attempts.at(-1)!),
      preparationId: 'alt-p',
      surfaceId: alternate.presentation.id,
    });
    apply({
      kind: 'command',
      attemptId: 'alternate',
      inputId: 'alt-i',
      commandSequence: 0,
      priorHead: campaignAttemptHead(r.attempts.at(-1)!),
      command: { type: 'perform_action', actionId: 'RESTART_API' },
    });
    expect(receipts(r, positiveId)).toHaveLength(1);
    expect(r.projection.values.aiDependency).toBe(5);
    expect(replayCampaign(d, catalog, r.operations)).toMatchObject({ ok: true, run: r });
  });

  it('preserves an old authority exactly and rejects forged response or effect provenance', () => {
    const old = campaignFixture();
    const frozen = canonicalJson(old);
    const original = replayCampaign(old, campaignCatalog, [operation(null, { kind: 'create' })]);
    expect(original).toMatchObject({ ok: true });
    if (!original.ok) throw new Error('invalid old fixture');
    let oldRun = original.run;
    const applyOld = (payload: Parameters<typeof operation>[1]) => {
      const result = prepareCampaignOperation(
        old,
        campaignCatalog,
        oldRun,
        operation(oldRun, payload),
      );
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      oldRun = result.run;
    };
    applyOld({ kind: 'start', attemptId: 'old', incidentId: 'stage-one', seed: 1002 });
    for (const actionId of [
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]) {
      const a = oldRun.attempts.at(-1)!;
      applyOld({
        kind: 'command',
        attemptId: a.id,
        inputId: 'old-' + oldRun.revision,
        commandSequence: a.incident.replayLog.length,
        priorHead: campaignAttemptHead(a),
        command: { type: 'perform_action', actionId },
      });
    }
    expect(oldRun.projection).toMatchObject({
      alignment: { corporate: 2, null: 0 },
      values: { curiosity: 3, operationalSafety: 1, aiDependency: 0 },
      evidence: ['artifact'],
      narratives: ['hint'],
      completed: ['stage-one'],
    });
    expect(oldRun.effectReceipts.map((r) => r.effectId)).toEqual(['discovery', 'completion']);
    expect(replayCampaign(old, campaignCatalog, oldRun.operations)).toMatchObject({
      ok: true,
      run: oldRun,
    });
    expect(canonicalJson(old)).toBe(frozen);
    const d = definition();
    const r = commandFixture(d, expose(d, startFixture(d)), 'RESTART_API');
    for (const mutate of [
      (x: CampaignRun) => {
        x.opportunities!.responses[0]!.positive = false;
      },
      (x: CampaignRun) => {
        x.opportunities!.responses[0]!.acknowledgementId = 'forged';
      },
      (x: CampaignRun) => {
        receipts(x, positiveId)[0]!.eventSequence = 0;
      },
    ]) {
      const forged = structuredClone(r);
      mutate(forged);
      expect(verifyCampaignRecord(forged, forged.runId, authorities(d))).toMatchObject({
        ok: false,
      });
    }
    expect(verifyCampaignRecord(r, r.runId, authorities(d))).toMatchObject({ ok: true });
  });
});

describe('choice effects stay candidates until the existing ledger transaction commits', () => {
  async function setup() {
    const d = definition();
    const r = expose(d, startFixture(d));
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(authorities(d), () => factory);
    for (let i = 0; i < r.operations.length; i++) {
      const replay = replayCampaign(d, campaignCatalog, r.operations.slice(0, i + 1));
      if (!replay.ok) throw new Error('invalid fixture prefix');
      expect(
        await ledger.commit({
          runId: r.runId,
          expectedRevision: i ? i - 1 : null,
          operation: r.operations[i],
          candidate: replay.run,
        }),
      ).toMatchObject({ ok: true });
    }
    return { d, r, factory, ledger };
  }
  it('reloads a lost commit ACK once and rejects a competing candidate', async () => {
    const { d, r, factory, ledger } = await setup();
    const candidate = commandFixture(d, r, 'RESTART_API');
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
    const competingOperation = {
      ...commandFixture(d, r, 'ROLLBACK').operations.at(-1)!,
      operationId: 'distinct-competing-operation',
    };
    const competing = prepareCampaignOperation(d, campaignCatalog, r, competingOperation);
    if (!competing.ok) throw new Error(JSON.stringify(competing.diagnostics));
    expect(
      await ledger.commit({
        ...request,
        operation: competingOperation,
        candidate: competing.run,
      }),
    ).toMatchObject({ ok: false });
    expect(await createCampaignLedger(authorities(d), () => factory).read(r.runId)).toMatchObject({
      ok: true,
      run: candidate,
    });
    expect(receipts(candidate, positiveId)).toHaveLength(1);
  });
  it('publishes no score or response when the transaction aborts after put success', async () => {
    const { d, r, ledger } = await setup();
    const candidate = commandFixture(d, r, 'RESTART_API');
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
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
    expect(r.opportunities!.responses).toHaveLength(0);
    expect(receipts(r, positiveId)).toHaveLength(0);
    expect(r.projection.values.aiDependency).toBe(0);
  });
});

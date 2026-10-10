import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import {
  createCampaignLedger,
  campaignDefinitionKey,
  verifyCampaignRecord,
} from '../persistence/campaign-ledger.ts';
import { behaviorCampaignFixture, behaviorOperation } from './fixtures/behavior.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';

const definition = behaviorCampaignFixture();
const oldDefinition = campaignFixture();
const authorities = {
  definitions: new Map(
    [definition, oldDefinition].map((d) => [campaignDefinitionKey(d.id, d.version), d]),
  ),
  scenarios: campaignCatalog,
};
function request(prior: CampaignRun | null, op: CampaignOperation, d = definition) {
  const result = prepareCampaignOperation(d, campaignCatalog, prior, op);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return {
    runId: op.runId,
    expectedRevision: prior?.revision ?? null,
    operation: op,
    candidate: result.run,
  };
}
async function initialize(factory: IDBFactory) {
  const ledger = createCampaignLedger(authorities, () => factory);
  const creation = request(null, behaviorOperation(definition, null, { kind: 'create' }));
  expect(await ledger.commit(creation)).toMatchObject({ ok: true });
  const start = request(
    creation.candidate,
    behaviorOperation(definition, creation.candidate, {
      kind: 'start',
      attemptId: 'attempt',
      incidentId: 'stage-one',
      seed: 17,
    }),
  );
  expect(await ledger.commit(start)).toMatchObject({ ok: true });
  return { ledger, run: start.candidate };
}
function command(prior: CampaignRun, actionId: string, operationId?: string) {
  const attempt = prior.attempts.at(-1)!;
  const op = behaviorOperation(definition, prior, {
    kind: 'command',
    attemptId: attempt.id,
    inputId: 'input-' + prior.revision,
    commandSequence: attempt.incident.replayLog.length,
    priorHead: campaignAttemptHead(attempt),
    command: { type: 'perform_action', actionId },
  });
  if (operationId) {
    op.operationId = operationId;
    if (op.kind === 'command') op.inputId = operationId;
  }
  return request(prior, op);
}
afterEach(() => vi.restoreAllMocks());
describe('committed behavior counts and identities in isolated campaign ledgers', () => {
  it('retains pending investigation provenance across ledger reload and deterministic continuation', async () => {
    const factory = new IDBFactory();
    const { ledger, run } = await initialize(factory);
    const asked = command(run, 'ASK_JIN_CONFIRM_IMPACT');
    expect(await ledger.commit(asked)).toMatchObject({ ok: true });
    const reload = createCampaignLedger(authorities, () => factory);
    const read = await reload.read(run.runId);
    expect(read).toEqual({ ok: true, disposition: 'found', run: asked.candidate });
    if (!read.ok || !read.run) throw new Error('reload failed');
    let current = read.run;
    for (const action of [
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'RESTART_API',
    ]) {
      const next = command(current, action);
      expect(await reload.commit(next)).toMatchObject({ ok: true });
      current = next.candidate;
    }
    expect(current.behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
    expect(current.behavior!.attempts[0]!.observations[0]!.source.inputId).toBe('input-1');
    expect(await ledger.read(run.runId)).toMatchObject({ ok: true, run: current });
  });
  it('reconciles a lost command acknowledgement against the committed identity without recounting', async () => {
    const { ledger, run } = await initialize(new IDBFactory());
    const saved = command(run, 'RESTART_API');
    await ledger.commit(saved); // Simulate lost caller acknowledgement, not a lost write.
    const later = command(saved.candidate, 'SCALE_API');
    await ledger.commit(later);
    const retry = await ledger.commit(saved);
    expect(retry).toEqual({ ok: true, disposition: 'duplicate', run: later.candidate });
    expect(later.candidate.behavior!.metrics.restartRate).toMatchObject({
      value: 1 / 2,
      denominator: 2,
    });
  });
  it('never acknowledges a candidate sample if the transaction aborts after put success', async () => {
    const { ledger, run } = await initialize(new IDBFactory());
    const next = command(run, 'RESTART_API');
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const req = original.apply(this, args);
      req.addEventListener('success', () => this.transaction.abort());
      return req;
    });
    expect(await ledger.commit(next)).toMatchObject({ ok: false, code: 'TRANSACTION_ABORTED' });
    spy.mockRestore();
    expect(await ledger.read(run.runId)).toEqual({ ok: true, disposition: 'found', run });
    expect(await ledger.commit(next)).toMatchObject({ ok: true, run: next.candidate });
    expect(next.candidate.behavior!.metrics.restartRate).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
  });
  it('keeps only the winning revision when concurrent commands propose different samples', async () => {
    const factory = new IDBFactory();
    const { ledger, run } = await initialize(factory);
    const a = command(run, 'RESTART_API', 'writer-a');
    const b = command(run, 'SCALE_API', 'writer-b');
    const other = createCampaignLedger(authorities, () => factory);
    const results = await Promise.all([ledger.commit(a), other.commit(b)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: 'REVISION_CONFLICT' });
    const read = await ledger.read(run.runId);
    if (!read.ok || !read.run) throw new Error('read failed');
    expect(read.run.behavior!.metrics.restartRate.denominator).toBe(1);
    expect(read.run.attempts[0]!.acceptedInputIds).toHaveLength(1);
  });
  it('rejects forged counts, supports and model authority before publishing official state', async () => {
    const factory = new IDBFactory();
    const { ledger, run } = await initialize(factory);
    const next = command(run, 'RESTART_API');
    for (const kind of ['counts', 'support', 'authority']) {
      const candidate = structuredClone(next.candidate);
      if (kind === 'counts') candidate.behavior!.metrics.restartRate.numerator = 9;
      if (kind === 'support')
        candidate.behavior!.attempts[0]!.samples[0]!.support.push({
          ruleId: 'fake',
          observationId: 'inherited',
        });
      if (kind === 'authority') candidate.behavior!.modelVersion = 'latest';
      expect(verifyCampaignRecord(candidate, run.runId, authorities).ok).toBe(false);
      expect(await ledger.commit({ ...next, candidate })).toMatchObject({ ok: false });
    }
    expect(await ledger.read(run.runId)).toEqual({ ok: true, disposition: 'found', run });
  });
  it('keeps older model-less records unchanged alongside a new pinned model-enabled run', async () => {
    const factory = new IDBFactory();
    const { ledger, run } = await initialize(factory);
    const oldOp = { ...operation(null, { kind: 'create' }), runId: 'older-run' };
    const older = request(null, oldOp, oldDefinition);
    expect(await ledger.commit(older)).toMatchObject({ ok: true });
    const reload = createCampaignLedger(authorities, () => factory);
    expect(await reload.read('older-run')).toEqual({
      ok: true,
      disposition: 'found',
      run: older.candidate,
    });
    expect(Object.hasOwn(older.candidate, 'behavior')).toBe(false);
    expect(await reload.read(run.runId)).toEqual({ ok: true, disposition: 'found', run });
  });
});

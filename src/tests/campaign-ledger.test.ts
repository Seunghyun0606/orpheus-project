import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import {
  createCampaignLedger,
  campaignDefinitionKey,
  CAMPAIGN_DATABASE,
  CAMPAIGN_RUN_STORE,
} from '../persistence/campaign-ledger.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';
import { encodeSave } from '../persistence/save.ts';
import { replayCommands } from '../engine/simulation.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';

const definition = campaignFixture();
const authorities = {
  definitions: new Map([[campaignDefinitionKey(definition.id, definition.version), definition]]),
  scenarios: campaignCatalog,
};
function candidate(prior: CampaignRun | null, op: CampaignOperation) {
  const result = prepareCampaignOperation(definition, campaignCatalog, prior, op);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.run;
}
const creation = operation(null, { kind: 'create' });
const empty = candidate(null, creation);
function start(prior = empty, name = 'attempt') {
  const op = operation(prior, {
    kind: 'start',
    attemptId: name,
    incidentId: 'stage-one',
    seed: 1002,
  });
  return { op, run: candidate(prior, op) };
}
function command(prior: CampaignRun, actionId: string) {
  const head = prior.attempts.at(-1)!;
  const op = operation(prior, {
    kind: 'command',
    attemptId: head.id,
    inputId: 'input-' + prior.revision,
    commandSequence: head.incident.replayLog.length,
    priorHead: campaignAttemptHead(head),
    command: { type: 'perform_action', actionId },
  });
  return { op, run: candidate(prior, op) };
}
async function rawDatabase(
  factory: IDBFactory,
  version = 1,
  layout: 'normal' | 'missing' | 'key' | 'extra' = 'normal',
) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(CAMPAIGN_DATABASE, version);
    request.onupgradeneeded = () => {
      if (layout !== 'missing')
        request.result.createObjectStore(CAMPAIGN_RUN_STORE, {
          keyPath: layout === 'key' ? 'wrong' : 'runId',
        });
      if (layout === 'extra') request.result.createObjectStore('unexpected');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function seedRaw(factory: IDBFactory, record: unknown) {
  const db = await rawDatabase(factory);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CAMPAIGN_RUN_STORE, 'readwrite');
    tx.objectStore(CAMPAIGN_RUN_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
afterEach(() => vi.restoreAllMocks());
describe('transactional separate campaign ledger', () => {
  it('round-trips, reloads and keeps new attempts and hidden projections replay-verified', async () => {
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(authorities, () => factory);
    expect(await ledger.read(empty.runId)).toEqual({
      ok: true,
      disposition: 'not_found',
      run: null,
    });
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: null,
        operation: creation,
        candidate: empty,
      }),
    ).toEqual({ ok: true, disposition: 'committed', run: empty });
    let next = start();
    await ledger.commit({
      runId: empty.runId,
      expectedRevision: empty.revision,
      operation: next.op,
      candidate: next.run,
    });
    for (const action of [
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]) {
      const prior = next.run;
      next = command(prior, action);
      expect(
        await ledger.commit({
          runId: empty.runId,
          expectedRevision: prior.revision,
          operation: next.op,
          candidate: next.run,
        }),
      ).toMatchObject({ ok: true, disposition: 'committed' });
    }
    expect(next.run.projection.evidence).toEqual(['artifact']);
    const reload = createCampaignLedger(authorities, () => factory);
    expect(await reload.read(empty.runId)).toEqual({
      ok: true,
      disposition: 'found',
      run: next.run,
    });
  });
  it('reconciles committed identities before stale revisions without reapplying or accepting divergent candidates', async () => {
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(authorities, () => factory);
    await ledger.commit({
      runId: empty.runId,
      expectedRevision: null,
      operation: creation,
      candidate: empty,
    });
    const started = start();
    const request = {
      runId: empty.runId,
      expectedRevision: 0,
      operation: started.op,
      candidate: started.run,
    };
    await ledger.commit(request); // Simulated lost caller acknowledgement.
    const next = command(started.run, 'OPEN_LOGS');
    await ledger.commit({
      runId: empty.runId,
      expectedRevision: 1,
      operation: next.op,
      candidate: next.run,
    });
    expect(await ledger.commit(request)).toEqual({
      ok: true,
      disposition: 'duplicate',
      run: next.run,
    });
    const divergent = start(empty, 'other');
    expect(
      await ledger.commit({ ...request, operation: divergent.op, candidate: divergent.run }),
    ).toMatchObject({ ok: false, code: 'CONFLICTING_OPERATION' });
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: next.run });
  });
  it('serializes concurrent writers and never silently rebases a stale candidate', async () => {
    const factory = new IDBFactory();
    const first = createCampaignLedger(authorities, () => factory);
    const second = createCampaignLedger(authorities, () => factory);
    await first.commit({
      runId: empty.runId,
      expectedRevision: null,
      operation: creation,
      candidate: empty,
    });
    const a = start(empty, 'a');
    const b = start(empty, 'b');
    b.op.operationId = 'different-operation';
    b.run = candidate(empty, b.op);
    const results = await Promise.all([
      first.commit({ runId: empty.runId, expectedRevision: 0, operation: a.op, candidate: a.run }),
      second.commit({ runId: empty.runId, expectedRevision: 0, operation: b.op, candidate: b.run }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(await first.read(empty.runId)).toMatchObject({
      ok: true,
      run: { revision: 1, attempts: expect.any(Array) },
    });
  });
  it('request success is not an acknowledgement: an abort after put success leaves prior record intact', async () => {
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(authorities, () => factory);
    await ledger.commit({
      runId: empty.runId,
      expectedRevision: null,
      operation: creation,
      candidate: empty,
    });
    const original = IDBObjectStore.prototype.put;
    let acknowledged = false;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => {
        expect(acknowledged).toBe(false);
        this.transaction.abort();
      });
      return request;
    });
    const started = start();
    const result = await ledger
      .commit({
        runId: empty.runId,
        expectedRevision: 0,
        operation: started.op,
        candidate: started.run,
      })
      .then((value) => {
        acknowledged = true;
        return value;
      });
    expect(result).toMatchObject({ ok: false, code: 'TRANSACTION_ABORTED' });
    spy.mockRestore();
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: empty });
  });
  it.each(['schema', 'projection', 'history', 'extra'] as const)(
    'rejects corrupt %s data without replacing it on read or commit',
    async (kind) => {
      const factory = new IDBFactory();
      const corrupted = structuredClone(empty) as CampaignRun & { extra?: boolean };
      if (kind === 'schema') Object.assign(corrupted, { schemaVersion: 99 });
      if (kind === 'projection') corrupted.projection.values.curiosity = 999;
      if (kind === 'history') corrupted.operations[0]!.replayVersion = 99 as 1;
      if (kind === 'extra') corrupted.extra = true;
      await seedRaw(factory, corrupted);
      const ledger = createCampaignLedger(authorities, () => factory);
      expect(await ledger.read(empty.runId)).toMatchObject({ ok: false });
      expect(
        await ledger.commit({
          runId: empty.runId,
          expectedRevision: null,
          operation: creation,
          candidate: empty,
        }),
      ).toMatchObject({ ok: false });
      const db = await rawDatabase(factory);
      const raw = await new Promise<unknown>((resolve) => {
        const tx = db.transaction(CAMPAIGN_RUN_STORE, 'readonly');
        const req = tx.objectStore(CAMPAIGN_RUN_STORE).get(empty.runId);
        req.onsuccess = () => resolve(req.result);
      });
      expect(raw).toEqual(corrupted);
      db.close();
    },
  );
  it('rejects unavailable API, failed opens, newer database versions and unexpected layouts', async () => {
    expect(await createCampaignLedger(authorities, () => undefined).read('run')).toMatchObject({
      code: 'INDEXEDDB_UNAVAILABLE',
    });
    expect(
      await createCampaignLedger(authorities, () => {
        throw new Error('disabled');
      }).read('run'),
    ).toMatchObject({ code: 'INDEXEDDB_UNAVAILABLE' });
    for (const layout of ['missing', 'key', 'extra'] as const) {
      const factory = new IDBFactory();
      const db = await rawDatabase(factory, 1, layout);
      db.close();
      expect(await createCampaignLedger(authorities, () => factory).read('run')).toMatchObject({
        code: 'UNSUPPORTED_DATABASE_LAYOUT',
      });
    }
    const newer = new IDBFactory();
    const db = await rawDatabase(newer, 2);
    db.close();
    expect(await createCampaignLedger(authorities, () => newer).read('run')).toMatchObject({
      code: 'UNSUPPORTED_DATABASE_VERSION',
    });
  });
  it('rejects tampered candidates, unknown definition authorities and mismatching run IDs', async () => {
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(authorities, () => factory);
    const bad = structuredClone(empty);
    bad.projection.values.curiosity = 1;
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: null,
        operation: creation,
        candidate: bad,
      }),
    ).toMatchObject({ ok: false });
    await seedRaw(factory, empty);
    expect(
      await createCampaignLedger({ ...authorities, definitions: new Map() }, () => factory).read(
        empty.runId,
      ),
    ).toMatchObject({ code: 'UNSUPPORTED_DEFINITION' });
    expect(
      await ledger.commit({
        runId: 'different-run',
        expectedRevision: null,
        operation: creation,
        candidate: empty,
      }),
    ).toMatchObject({ ok: false });
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: empty });
    expect(canonicalJson(empty)).toBe(canonicalJson(candidate(null, creation)));
  });
  it.each([null, false, 12, 'text', [], {}, { extra: true }])(
    'rejects malformed commit requests (%j) without throwing',
    async (input) => {
      const factory = new IDBFactory();
      const open = vi.spyOn(factory, 'open');
      const ledger = createCampaignLedger(authorities, () => factory);
      expect(await ledger.commit(input as never)).toMatchObject({
        ok: false,
        code: 'INVALID_COMMIT_REQUEST',
      });
      expect(open).not.toHaveBeenCalled();
    },
  );
  it('snapshots caller-owned requests before yielding, rejecting extra fields and preserving payload identity', async () => {
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(authorities, () => factory);
    const request = {
      runId: empty.runId,
      expectedRevision: null,
      operation: structuredClone(creation),
      candidate: structuredClone(empty),
    };
    expect(await ledger.commit({ ...request, extra: true } as never)).toMatchObject({
      code: 'INVALID_COMMIT_REQUEST',
    });
    const pending = ledger.commit(request);
    request.candidate.projection.values.curiosity = 999;
    request.operation.operationId = 'mutated';
    expect(await pending).toEqual({ ok: true, disposition: 'committed', run: empty });
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: empty });
  });
  it('rejects an otherwise valid duplicate candidate with different prior provenance', async () => {
    const replay = replayCommands(inc001Scenario, { seed: 1002 }, [
      { type: 'perform_action', actionId: 'OPEN_LOGS' },
    ]);
    if (!replay.ok) throw new Error('fixture failed');
    const bytes = encodeSave(inc001Scenario, 1002, replay.state);
    const firstAdopt = candidate(
      empty,
      operation(empty, { kind: 'adopt', confirmed: true, sourceBytes: [bytes] }),
    );
    const otherAdopt = candidate(
      empty,
      operation(empty, { kind: 'adopt', confirmed: true, sourceBytes: [bytes + ' '] }),
    );
    const firstStart = start(firstAdopt);
    const otherStart = start(otherAdopt);
    expect(otherStart.op).toEqual(firstStart.op);
    const factory = new IDBFactory();
    await seedRaw(factory, firstStart.run);
    const ledger = createCampaignLedger(authorities, () => factory);
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: 1,
        operation: otherStart.op,
        candidate: otherStart.run,
      }),
    ).toMatchObject({ code: 'INVALID_CANDIDATE' });
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: firstStart.run });
  });
  it('fails on a quota exception without replacing or falling back from the committed head', async () => {
    const factory = new IDBFactory();
    await seedRaw(factory, empty);
    const ledger = createCampaignLedger(authorities, () => factory);
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const next = start();
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: 0,
        operation: next.op,
        candidate: next.run,
      }),
    ).toMatchObject({ code: 'STORAGE_ERROR' });
    spy.mockRestore();
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: empty });
  });
  it('fails a read transaction abort without returning the successful individual get', async () => {
    const factory = new IDBFactory();
    await seedRaw(factory, empty);
    const ledger = createCampaignLedger(authorities, () => factory);
    const original = IDBObjectStore.prototype.get;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const req = original.apply(this, args);
      req.addEventListener('success', () => this.transaction.abort());
      return req;
    });
    expect(await ledger.read(empty.runId)).toMatchObject({ code: 'TRANSACTION_ABORTED' });
    spy.mockRestore();
    expect(await ledger.read(empty.runId)).toMatchObject({ ok: true, run: empty });
  });
  it('handles failed and blocked opens without later acknowledgement or creating a fallback', async () => {
    const failed = new IDBFactory();
    vi.spyOn(failed, 'open').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(await createCampaignLedger(authorities, () => failed).read('run')).toMatchObject({
      code: 'DATABASE_OPEN_FAILED',
    });
    const blocked = new IDBFactory();
    const original = blocked.open.bind(blocked);
    vi.spyOn(blocked, 'open').mockImplementation((...args: Parameters<typeof original>) => {
      const request = original(...args);
      queueMicrotask(() =>
        request.onblocked?.call(request, new Event('blocked') as IDBVersionChangeEvent),
      );
      return request;
    });
    expect(await createCampaignLedger(authorities, () => blocked).read('run')).toMatchObject({
      code: 'DATABASE_BLOCKED',
    });
  });
});

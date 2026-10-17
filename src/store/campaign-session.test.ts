// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createCampaignSessionStore } from './campaign-session.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import {
  opportunityCampaignFixture,
  trainedFixture,
  prepareFixture,
  acknowledgeFixture,
} from '../tests/fixtures/opportunities.ts';
import { campaignCatalog } from '../tests/fixtures/campaign.ts';
import { fixtureLedger, fixtureIdentity } from '../tests/fixtures/ledger.ts';

afterEach(() => vi.restoreAllMocks());
async function loaded(ack = false) {
  const definition = opportunityCampaignFixture();
  const base = trainedFixture(definition);
  const run = ack ? acknowledgeFixture(definition, prepareFixture(definition, base)) : base;
  const { ledger, factory, authorities } = await fixtureLedger(definition, campaignCatalog, run);
  const options = {
    definition,
    catalog: campaignCatalog,
    runId: run.runId,
    ledger,
    identity: fixtureIdentity(),
  };
  const store = createCampaignSessionStore(options);
  expect(await store.getState().load()).toBe(true);
  return { store, options, run, factory, authorities };
}
describe('opt-in campaign adapter commit publication', () => {
  it('reads before explicit creation; no import initialization or old-slot writes', async () => {
    const definition = opportunityCampaignFixture();
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(
      {
        definitions: new Map([
          [campaignDefinitionKey(definition.id, definition.version), definition],
        ]),
        scenarios: campaignCatalog,
      },
      () => factory,
    );
    const store = createCampaignSessionStore({
      definition,
      catalog: campaignCatalog,
      ledger,
      runId: 'new-run',
      identity: fixtureIdentity(),
    });
    expect(store.getState().run).toBeNull();
    expect(await store.getState().create()).toBe(false);
    expect(await store.getState().load()).toBe(true);
    expect(await store.getState().create()).toBe(true);
    expect(await store.getState().create()).toBe(false);
    expect(store.getState().run!.schemaVersion).toBe(2);
    expect(await store.getState().start('stage-one', 1002)).toBe(true);
  });
  it('preparation is not ACK; stable redisplay, direct action and remount yield one sample', async () => {
    const { store, options } = await loaded();
    expect(await store.getState().preparePresentation('prediction')).toBe(true);
    const p = store.getState().run!.opportunities!.preparations[0]!;
    const revision = store.getState().run!.revision;
    expect(await store.getState().preparePresentation('prediction')).toBe(true);
    expect(store.getState().run!.revision).toBe(revision);
    expect(store.getState().run!.behavior!.metrics.predictionDeviation.denominator).toBe(0);
    expect(await store.getState().acknowledgeVisiblePresentation(p.id, p.presentation.id)).toBe(
      true,
    );
    expect(await store.getState().acknowledgeVisiblePresentation(p.id, p.presentation.id)).toBe(
      true,
    );
    expect(await store.getState().performAction('ROLLBACK')).toBe(true);
    expect(store.getState().run!.behavior!.metrics.predictionDeviation).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
    expect(store.getState().run!.opportunities!.responses).toHaveLength(1);
    const remount = createCampaignSessionStore(options);
    expect(await remount.getState().load()).toBe(true);
    expect(remount.getState().run).toEqual(store.getState().run);
    expect(await remount.getState().performAction('RESTART_API')).toBe(true);
    expect(remount.getState().run!.behavior!.metrics.predictionDeviation.denominator).toBe(1);
  });
  it('publishes nothing before transaction completion and retains identity after ACK loss', async () => {
    const { options, run } = await loaded(true);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let loseAck = true;
    const port = {
      read: options.ledger.read,
      async commit(req: Parameters<typeof options.ledger.commit>[0]) {
        await barrier;
        const result = await options.ledger.commit(req);
        if (loseAck) {
          loseAck = false;
          throw new Error('Caller acknowledgement lost after commit');
        }
        return result;
      },
    };
    const store = createCampaignSessionStore({ ...options, ledger: port });
    const committed = vi.fn();
    store.getState().subscribeCommitted(committed);
    await store.getState().load();
    expect(committed).not.toHaveBeenCalled();
    const action = store.getState().performAction('ROLLBACK');
    expect(store.getState().busy).toBe(true);
    expect(store.getState().run).toEqual(run);
    expect(committed).not.toHaveBeenCalled();
    const identity = store.getState().pendingOperationId;
    expect(await store.getState().performAction('RESTART_API')).toBe(false);
    release();
    expect(await action).toBe(false);
    expect(store.getState().error).toBe('COMMIT_ACK_UNKNOWN');
    expect(store.getState().run).toEqual(run);
    expect(store.getState().pendingOperationId).toBe(identity);
    expect(await store.getState().load()).toBe(false); // do not drop unresolved operation
    expect(await store.getState().retryPending()).toBe(true);
    expect(committed).toHaveBeenCalledTimes(1);
    expect(
      committed.mock.calls[0]![0].events.some(
        (e: { type: string }) => e.type === 'action_completed',
      ),
    ).toBe(true);
    expect(await store.getState().retryPending()).toBe(false);
    expect(await store.getState().load()).toBe(true);
    expect(committed).toHaveBeenCalledTimes(1);
    expect(store.getState().run!.behavior!.metrics.predictionDeviation).toMatchObject({
      numerator: 1,
      denominator: 1,
    });
    expect(store.getState().run!.operations.filter((o) => o.operationId === identity)).toHaveLength(
      1,
    );
  });
  it('aborted ACK publication remains prepared only; retry commits that same acknowledgement', async () => {
    const { store } = await loaded();
    const committed = vi.fn();
    store.getState().subscribeCommitted(committed);
    await store.getState().preparePresentation('prediction');
    const before = store.getState().run;
    committed.mockClear();
    const p = before!.opportunities!.preparations[0]!;
    const original = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const req = original.apply(this, args);
      req.addEventListener('success', () => this.transaction.abort());
      return req;
    });
    expect(await store.getState().acknowledgeVisiblePresentation(p.id, p.presentation.id)).toBe(
      false,
    );
    expect(store.getState().run).toEqual(before);
    expect(committed).not.toHaveBeenCalled();
    expect(await store.getState().performAction('ROLLBACK')).toBe(false);
    const pending = store.getState().pendingOperationId;
    spy.mockRestore();
    expect(await store.getState().retryPending()).toBe(true);
    expect(store.getState().run!.opportunities!.acknowledgements.map((a) => a.operationId)).toEqual(
      [pending],
    );
    expect(store.getState().run!.behavior!.metrics.predictionDeviation.denominator).toBe(0);
  });
  it('a deterministic ledger rejection can be discarded by an explicit reload', async () => {
    const { store, options } = await loaded();
    const rejecting = {
      read: options.ledger.read,
      commit: () => Promise.resolve({ ok: false as const, code: 'INVALID_CANDIDATE' as const }),
    };
    const stranded = createCampaignSessionStore({ ...options, ledger: rejecting });
    expect(await stranded.getState().load()).toBe(true);
    const before = stranded.getState().run;
    expect(await stranded.getState().performAction('ROLLBACK')).toBe(false);
    expect(stranded.getState().error).toBe('INVALID_CANDIDATE');
    expect(stranded.getState().pendingOperationId).not.toBeNull();
    expect(await stranded.getState().retryPending()).toBe(false);
    // The identical request cannot succeed; reload reconciles instead of locking up.
    expect(await stranded.getState().load()).toBe(true);
    expect(stranded.getState().pendingOperationId).toBeNull();
    expect(stranded.getState().run).toEqual(before);
    expect(store.getState().run).toEqual(before);
  });
  it('a competing writer requires explicit reload rather than rebasing or replaying a failed action', async () => {
    const { store, options } = await loaded(true);
    const other = createCampaignSessionStore({ ...options, identity: fixtureIdentity('other') });
    const committed = vi.fn();
    other.getState().subscribeCommitted(committed);
    await other.getState().load();
    expect(await store.getState().performAction('ROLLBACK')).toBe(true);
    expect(await other.getState().performAction('RESTART_API')).toBe(false);
    expect(other.getState().error).toBe('REVISION_CONFLICT');
    expect(await other.getState().load()).toBe(true);
    expect(other.getState().pendingOperationId).toBeNull();
    expect(other.getState().run).toEqual(store.getState().run);
    expect(committed).not.toHaveBeenCalled();
    expect(other.getState().run!.behavior!.metrics.predictionDeviation.denominator).toBe(1);
  });
  it('isolates throwing presentation observers and unsubscribe without changing commits', async () => {
    const { store } = await loaded();
    store.getState().subscribeCommitted(() => {
      throw new Error('Audio failed');
    });
    const observer = vi.fn();
    const unsubscribe = store.getState().subscribeCommitted(observer);
    expect(await store.getState().performAction('RESTART_API')).toBe(true);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(store.getState().error).toBeNull();
    expect(store.getState().pendingOperationId).toBeNull();
    unsubscribe();
    expect(await store.getState().load()).toBe(true);
    expect(observer).toHaveBeenCalledTimes(1);
  });
  it('unavailable identity generation is diagnosed without action or storage mutation', async () => {
    const { options, run } = await loaded();
    const store = createCampaignSessionStore({
      ...options,
      identity: () => {
        throw new Error('No UUID');
      },
    });
    await store.getState().load();
    expect(await store.getState().performAction('RESTART_API')).toBe(false);
    expect(store.getState().error).toBe('IDENTITY_UNAVAILABLE');
    expect(store.getState().run).toEqual(run);
  });
  it('explicitly selects prepared guidance instead of implicitly using the latest item', async () => {
    const definition = opportunityCampaignFixture();
    const { choiceRule } = await import('../tests/fixtures/opportunities.ts');
    definition.opportunities!.rules = [
      choiceRule(definition, 'safetyPreference'),
      choiceRule(definition, 'companyReportingRate'),
    ];
    const run = trainedFixture(definition);
    const { ledger } = await fixtureLedger(definition, campaignCatalog, run);
    const store = createCampaignSessionStore({
      definition,
      catalog: campaignCatalog,
      runId: run.runId,
      ledger,
      identity: fixtureIdentity(),
    });
    await store.getState().load();
    await store.getState().preparePresentation('safetyPreference');
    const first = store.getState().selectedPreparationId;
    await store.getState().preparePresentation('companyReportingRate');
    expect(store.getState().selectedPreparationId).not.toBe(first);
    await store.getState().preparePresentation('safetyPreference');
    expect(store.getState().selectedPreparationId).toBe(first);
    expect(store.getState().view!.presentations).toHaveLength(2);
    const before = store.getState().run;
    expect(store.getState().selectPresentation('missing')).toBe(false);
    expect(store.getState().run).toBe(before);
  });
});

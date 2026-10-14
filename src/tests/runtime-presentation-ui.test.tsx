import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { runtimePresentationFixture } from './fixtures/runtime-presentation.ts';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import { CampaignRuntimeNotices } from '../app/CampaignRuntimeNotices.tsx';
import { CampaignTools } from '../app/CampaignTools.tsx';
import type { NoticeTimers } from '../app/runtime-notice-queue.ts';
import type { CampaignOperation } from '../engine/campaign/transitions.ts';
import { useLayoutEffect } from 'react';
import { encodeSave } from '../persistence/save.ts';
import { startFixture, commandFixture } from './fixtures/opportunities.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function session(runId = 'runtime-ui-fixture') {
  const f = runtimePresentationFixture();
  let n = 0;
  // One persistent fake database factory per test, never user storage.
  const factory = new IDBFactory();
  const stableLedger = createCampaignLedger(
    {
      definitions: new Map([
        [campaignDefinitionKey(f.definition.id, f.definition.version), f.definition],
      ]),
      scenarios: f.composition.catalog,
    },
    () => factory,
  );
  const options = {
    definition: f.definition,
    catalog: f.composition.catalog,
    runId,
    ledger: stableLedger,
    identity: () => 'runtime-' + n++,
  };
  const store = createCampaignSessionStore(options);
  await store.getState().load();
  await store.getState().create();
  await store.getState().start('stage-one', 1002);
  return { ...f, store, options, ledger: stableLedger };
}
async function trigger(store: ReturnType<typeof createCampaignSessionStore>) {
  await act(async () => {
    for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS'])
      expect(await store.getState().performAction(id)).toBe(true);
  });
}
describe('runtime notification UI is ephemeral, history is durable (isolated)', () => {
  it('checkpoint/adoption are history-only; genuine new retry events notify without re-awarding receipts', async () => {
    const f = await session(),
      timers = { start: vi.fn(), cancel: vi.fn() };
    render(
      <CampaignRuntimeNotices
        store={f.store}
        composition={f.composition}
        live
        reducedMotion
        timers={timers}
      />,
    );
    let external = startFixture(f.definition);
    external = commandFixture(f.definition, external, 'ASK_JIN_CONFIRM_IMPACT');
    const source = encodeSave(f.scenario, 1002, external.attempts[0]!.incident);
    await act(async () => {
      expect(await f.store.getState().checkpoint('stage-one', source, true)).toBe(true);
    });
    expect(f.store.getState().run!.attempts.at(-1)!.baselineEventCount).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    await trigger(f.store);
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toBeInTheDocument();
    const completedSource = encodeSave(
      f.scenario,
      1002,
      f.store.getState().run!.attempts.at(-1)!.incident,
    );
    const receipts = JSON.stringify(f.store.getState().run!.projection);
    await act(async () => {
      expect(await f.store.getState().load()).toBe(true);
      expect(await f.store.getState().adopt([completedSource], true)).toBe(true);
    });
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    expect(JSON.stringify(f.store.getState().run!.projection)).toBe(receipts);
    await act(async () => {
      expect(await f.store.getState().start('stage-one', 1002)).toBe(true);
    });
    await trigger(f.store);
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toBeInTheDocument();
    expect(JSON.stringify(f.store.getState().run!.projection)).toBe(receipts);
  });
  it('transaction abort and revision conflict publish no notice or stale read boundary', async () => {
    const f = await session(),
      timers = { start: vi.fn(), cancel: vi.fn() };
    render(
      <CampaignRuntimeNotices
        store={f.store}
        composition={f.composition}
        live
        reducedMotion
        timers={timers}
      />,
    );
    await act(async () => {
      for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS'])
        expect(await f.store.getState().performAction(id)).toBe(true);
    });
    const before = JSON.stringify(f.store.getState().run),
      observer = vi.fn();
    f.store.getState().subscribeCommitted(observer);
    const original = IDBObjectStore.prototype.put;
    const abort = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await act(async () => {
      expect(await f.store.getState().performAction('TERMINATE_STALE_SESSIONS')).toBe(false);
    });
    expect(JSON.stringify(f.store.getState().run)).toBe(before);
    expect(observer).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    abort.mockRestore();
    const writer = createCampaignSessionStore({
      ...f.options,
      identity: () => crypto.randomUUID(),
    });
    await writer.getState().load();
    expect(await writer.getState().performAction('OPEN_METRICS')).toBe(true);
    await act(async () => {
      expect(await f.store.getState().retryPending()).toBe(false);
    });
    expect(f.store.getState().error).toBe('REVISION_CONFLICT');
    expect(observer).not.toHaveBeenCalled();
    await act(async () => {
      expect(await f.store.getState().load()).toBe(true);
    });
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    expect(f.store.getState().run).toEqual(writer.getState().run);
  });
  it('does not paint a previous binding on replacement before passive cleanup', async () => {
    const f = await session(),
      replacement = await session('replacement-runtime-run');
    const timers = { start: vi.fn(), cancel: vi.fn() };
    const duringLayout: boolean[] = [];
    function LayoutProbe({ phase }: { phase: number }) {
      useLayoutEffect(() => {
        void phase;
        duringLayout.push(!!screen.queryByRole('region', { name: 'New recorded narrative' }));
      }, [phase]);
      return null;
    }
    const ui = render(
      <>
        <CampaignRuntimeNotices
          store={f.store}
          composition={f.composition}
          live
          reducedMotion
          timers={timers}
        />
        <LayoutProbe phase={0} />
      </>,
    );
    await trigger(f.store);
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toBeInTheDocument();
    ui.rerender(
      <>
        <CampaignRuntimeNotices
          store={replacement.store}
          composition={replacement.composition}
          live
          reducedMotion
          timers={timers}
        />
        <LayoutProbe phase={1} />
      </>,
    );
    expect(duringLayout.at(-1)).toBe(false);
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    await trigger(replacement.store);
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toBeInTheDocument();
  });
  it('lost ACK publishes no notice; exact retry publishes once, while a later writer makes it history-only', async () => {
    const f = await session();
    let lose = true;
    const store = createCampaignSessionStore({
      ...f.options,
      ledger: {
        read: f.ledger.read,
        async commit(request) {
          const result = await f.ledger.commit(request);
          const operation = request.operation as CampaignOperation;
          if (
            lose &&
            operation.kind === 'command' &&
            operation.command.type === 'perform_action' &&
            operation.command.actionId === 'TERMINATE_STALE_SESSIONS'
          ) {
            lose = false;
            throw new Error('ACK lost after durable commit');
          }
          return result;
        },
      },
    });
    await store.getState().load();
    const timers = { start: vi.fn(), cancel: vi.fn() };
    const ui = render(
      <CampaignRuntimeNotices
        store={store}
        composition={f.composition}
        live
        reducedMotion
        timers={timers}
      />,
    );
    await act(async () => {
      for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS'])
        expect(await store.getState().performAction(id)).toBe(true);
      expect(await store.getState().performAction('TERMINATE_STALE_SESSIONS')).toBe(false);
    });
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    await act(async () => {
      expect(await store.getState().retryPending()).toBe(true);
    });
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toBeInTheDocument();
    const exact = JSON.stringify(store.getState().run);
    await act(async () => {
      expect(await store.getState().retryPending()).toBe(false);
    });
    expect(JSON.stringify(store.getState().run)).toBe(exact);
    ui.unmount();
    // New attempt in the same legal history, then ACK loss followed by another writer's new attempt.
    expect(await store.getState().start('stage-one', 1002)).toBe(true);
    lose = true;
    const stale = render(
      <CampaignRuntimeNotices
        store={store}
        composition={f.composition}
        live
        reducedMotion
        timers={timers}
      />,
    );
    await act(async () => {
      for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS'])
        expect(await store.getState().performAction(id)).toBe(true);
      expect(await store.getState().performAction('TERMINATE_STALE_SESSIONS')).toBe(false);
    });
    const writer = createCampaignSessionStore({
      ...f.options,
      identity: () => crypto.randomUUID(),
    });
    await writer.getState().load();
    expect(await writer.getState().start('stage-one', 1002)).toBe(true);
    await act(async () => {
      expect(await store.getState().retryPending()).toBe(true);
    });
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    expect(store.getState().run).toEqual(writer.getState().run);
    stale.unmount();
  });
  it('waits for visible paint, dismisses by injected timer, retains full readable history and never writes on read', async () => {
    const f = await session();
    const callbacks: (() => void)[] = [],
      frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.set(++frameId, cb);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    const start = vi.fn((cb: () => void, _ms: number) => {
      void _ms;
      callbacks.push(cb);
      return callbacks.length;
    });
    const timers: NoticeTimers = { start, cancel: vi.fn() };
    const ui = render(
      <CampaignRuntimeNotices
        store={f.store}
        composition={f.composition}
        live
        reducedMotion={false}
        timers={timers}
      />,
    );
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    await trigger(f.store);
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toHaveTextContent(
      'UNKNOWN: Good.',
    );
    expect(start).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++)
      act(() => {
        const batch = [...frames.values()];
        frames.clear();
        for (const cb of batch) cb(0);
      });
    expect(start).toHaveBeenCalledTimes(1);
    act(() => callbacks[0]!());
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    const saved = JSON.stringify(f.store.getState().run);
    render(
      <CampaignTools
        composition={f.composition}
        run={f.store.getState().run!}
        attemptId={f.store.getState().run!.activeAttemptId!}
        actions={[]}
        disabled
        readOnly
        onAction={vi.fn()}
      />,
    );
    expect(
      within(screen.getByRole('region', { name: 'Recorded narrative history' })).getByText(
        '02:23:11 / UNKNOWN: Good.',
      ),
    ).toBeInTheDocument();
    await act(async () => {
      expect(await f.store.getState().load()).toBe(true);
    });
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    expect(JSON.stringify(f.store.getState().run)).toBe(saved);
    ui.unmount();
    act(() => callbacks[0]!());
  });
  it('successful explicit load clears a current notice; archive, remount and hidden boundaries never revive it', async () => {
    const f = await session();
    const timers = { start: vi.fn(), cancel: vi.fn() };
    const ui = render(
      <CampaignRuntimeNotices
        store={f.store}
        composition={f.composition}
        live
        reducedMotion
        timers={timers}
      />,
    );
    await trigger(f.store);
    expect(screen.getByRole('region', { name: 'New recorded narrative' })).toBeInTheDocument();
    const saved = JSON.stringify(f.store.getState().run),
      committed = vi.fn(),
      reads = vi.fn();
    f.store.getState().subscribeCommitted(committed);
    f.store.getState().subscribeReadBoundary(reads);
    await act(async () => {
      expect(await f.store.getState().load()).toBe(true);
    });
    expect(reads).toHaveBeenCalledTimes(1);
    expect(committed).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    ui.rerender(
      <CampaignRuntimeNotices
        store={f.store}
        composition={f.composition}
        live={false}
        reducedMotion
        timers={timers}
      />,
    );
    ui.rerender(
      <CampaignRuntimeNotices
        store={f.store}
        composition={f.composition}
        live
        reducedMotion
        timers={timers}
      />,
    );
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.queryByRole('region', { name: 'New recorded narrative' })).toBeNull();
    expect(JSON.stringify(f.store.getState().run)).toBe(saved);
    expect(timers.start).not.toHaveBeenCalled();
  });
});

import type { RecordedNarrative } from '../engine/campaign/runtime-streams.ts';

export interface NoticeTimers {
  start(callback: () => void, durationMs: number): unknown;
  cancel(handle: unknown): void;
}
// Presentation-only external resource, never saved or used by the simulation.
export function createRuntimeNoticeQueue(timers: NoticeTimers) {
  let items: RecordedNarrative[] = [];
  const retired = new Set<string>(),
    listeners = new Set<() => void>();
  let timer: unknown,
    owner: unknown,
    epoch = 0,
    floor = -1,
    disposed = false,
    reduced = false,
    held = false,
    rendered = false;
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const cancel = () => {
    ++epoch;
    if (timer !== undefined) timers.cancel(timer);
    timer = undefined;
  };
  const next = () => {
    cancel();
    held = false;
    rendered = false;
    emit();
  };
  const queue = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => items[0] ?? null,
    snapshotFor: (scope: unknown) => (owner === scope ? (items[0] ?? null) : null),
    floor: () => floor,
    advanceFloor(revision: number) {
      floor = Math.max(floor, revision);
    },
    enqueue(messages: readonly RecordedNarrative[], scope?: unknown) {
      if (disposed) return;
      const wasEmpty = !items.length;
      for (const message of messages)
        if (!retired.has(message.key)) {
          retired.add(message.key);
          items.push(message);
        }
      if (wasEmpty && items.length) {
        owner = scope;
        next();
      }
    },
    markVisible(key: string) {
      const current = items[0];
      if (disposed || !current || current.key !== key || rendered) return;
      rendered = true;
      held = held || reduced || current.delivery.mode === 'until_dismissed';
      if (held || current.delivery.mode !== 'transient') return;
      const generation = epoch;
      timer = timers.start(() => {
        if (!disposed && generation === epoch && items[0]?.key === key) queue.dismiss();
      }, current.delivery.durationMs);
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      if (value && items.length) {
        held = true;
        cancel();
      }
    },
    dismiss() {
      if (disposed || !items.length) return;
      items = items.slice(1);
      next();
    },
    reconcile(visibleKeys: ReadonlySet<string>) {
      if (disposed) return;
      const before = items[0];
      items = items.filter((m) => visibleKeys.has(m.key));
      if (before !== items[0]) next();
    },
    reset(revision: number) {
      floor = revision;
      items = [];
      next();
    },
    dispose() {
      queue.reset(Infinity);
      disposed = true;
      listeners.clear();
    },
  };
  return queue;
}

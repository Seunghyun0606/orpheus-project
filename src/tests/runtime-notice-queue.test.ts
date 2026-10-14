import { describe, expect, it, vi } from 'vitest';
import { createRuntimeNoticeQueue } from '../app/runtime-notice-queue.ts';
import type { RecordedNarrative } from '../engine/campaign/runtime-streams.ts';

const message = (key: string, held = false): RecordedNarrative => ({
  key,
  narrativeId: key,
  eventSequence: 1,
  atSeconds: 0,
  title: key,
  body: 'Recorded body',
  delivery: held
    ? { mode: 'until_dismissed', reducedMotionMode: 'until_dismissed', historyMode: 'recorded' }
    : {
        mode: 'transient',
        durationMs: 800,
        reducedMotionMode: 'until_dismissed',
        historyMode: 'recorded',
      },
});
function fixture() {
  const callbacks: (() => void)[] = [];
  const start = vi.fn((f: () => void, _ms: number) => {
    void _ms;
    callbacks.push(f);
    return callbacks.length;
  });
  const cancel = vi.fn();
  return { queue: createRuntimeNoticeQueue({ start, cancel }), start, cancel, callbacks };
}
describe('ephemeral runtime notice lifecycle', () => {
  it('keeps the body at 799ms and expires at exactly 800ms after paint', () => {
    vi.useFakeTimers();
    try {
      const queue = createRuntimeNoticeQueue({
        start: (f, ms) => setTimeout(f, ms),
        cancel: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      });
      queue.enqueue([message('timed')]);
      vi.advanceTimersByTime(2000);
      expect(queue.snapshot()?.key).toBe('timed');
      queue.markVisible('timed');
      vi.advanceTimersByTime(799);
      expect(queue.snapshot()?.key).toBe('timed');
      vi.advanceTimersByTime(1);
      expect(queue.snapshot()).toBeNull();
      queue.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
  it('starts 800ms only after visible paint; FIFO dismisses once and deduplicates', () => {
    const f = fixture();
    f.queue.enqueue([message('a'), message('b', true), message('a')]);
    expect(f.start).not.toHaveBeenCalled();
    f.queue.markVisible('other');
    expect(f.start).not.toHaveBeenCalled();
    f.queue.markVisible('a');
    f.queue.markVisible('a');
    expect(f.start).toHaveBeenCalledTimes(1);
    expect(f.start.mock.calls[0]![1]).toBe(800);
    f.callbacks[0]!();
    expect(f.queue.snapshot()?.key).toBe('b');
    f.callbacks[0]!();
    expect(f.queue.snapshot()?.key).toBe('b');
    f.queue.markVisible('b');
    expect(f.start).toHaveBeenCalledTimes(1);
    f.queue.dismiss();
    f.queue.enqueue([message('a'), message('b')]);
    expect(f.queue.snapshot()).toBeNull();
  });
  it('reduced motion promotes a visible transient permanently until dismissal', () => {
    const f = fixture();
    f.queue.enqueue([message('a')]);
    f.queue.markVisible('a');
    f.queue.setReducedMotion(true);
    f.queue.setReducedMotion(false);
    f.callbacks[0]!();
    expect(f.queue.snapshot()?.key).toBe('a');
    expect(f.cancel).toHaveBeenCalledWith(1);
    f.queue.dismiss();
    f.queue.setReducedMotion(true);
    f.queue.enqueue([message('b')]);
    f.queue.markVisible('b');
    expect(f.start).toHaveBeenCalledTimes(1);
  });
  it('read/archive/visibility reset cancels stale callbacks and retains retired keys', () => {
    const f = fixture();
    f.queue.reset(20);
    f.queue.enqueue([message('a')]);
    f.queue.markVisible('a');
    f.queue.reset(22);
    f.queue.enqueue([message('a'), message('b')]);
    f.callbacks[0]!();
    expect(f.queue.snapshot()?.key).toBe('b');
    f.queue.reconcile(new Set());
    expect(f.queue.snapshot()).toBeNull();
    expect(f.queue.floor()).toBe(22);
    f.queue.advanceFloor(3);
    expect(f.queue.floor()).toBe(22);
    // A different run may start at a lower verified boundary.
    f.queue.reset(1);
    expect(f.queue.floor()).toBe(1);
    f.queue.dispose();
    f.queue.enqueue([message('c')]);
    expect(f.queue.snapshot()).toBeNull();
  });
});

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { CampaignSessionState } from '../store/campaign-session.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { projectCampaignInvestigation } from '../engine/campaign/investigation.ts';
import { getFreshRuntimeNarratives } from '../engine/campaign/runtime-delivery.ts';
import { createRuntimeNoticeQueue, type NoticeTimers } from './runtime-notice-queue.ts';

const browserTimers: NoticeTimers = {
  start: (callback, ms) => window.setTimeout(callback, ms),
  cancel: (handle) => window.clearTimeout(handle as number),
};
export function CampaignRuntimeNotices({
  store,
  composition,
  live,
  reducedMotion,
  timers = browserTimers,
}: {
  store: StoreApi<CampaignSessionState>;
  composition: ResolvedCampaignPackage;
  live: boolean;
  reducedMotion: boolean;
  timers?: NoticeTimers;
}) {
  const queue = useMemo(() => createRuntimeNoticeQueue(timers), [timers]);
  const notice = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);
  useEffect(() => {
    const revision = () => store.getState().run?.revision ?? -1;
    let mounted = true;
    queue.reset(revision());
    const active = () => mounted && live && document.visibilityState === 'visible';
    const visible = () => {
      const run = store.getState().run;
      if (!active() || !run?.activeAttemptId) return new Set<string>();
      const view = projectCampaignInvestigation(composition, run, run.activeAttemptId);
      return new Set(
        view.ok
          ? view.panels.flatMap((p) =>
              p.blocks.flatMap((b) =>
                b.kind === 'narrative_stream' ? b.messages.map((m) => m.key) : [],
              ),
            )
          : [],
      );
    };
    const unsubscribeState = store.subscribe((next, prior) => {
      if (next.run === prior.run) return;
      if (
        next.run?.runId !== prior.run?.runId ||
        next.run?.activeAttemptId !== prior.run?.activeAttemptId
      )
        queue.reset(revision());
      else queue.reconcile(visible());
    });
    const unsubscribeCommit = store.getState().subscribeCommitted((update) => {
      const run = store.getState().run;
      if (!mounted || !run) return;
      if (active())
        queue.enqueue(getFreshRuntimeNarratives(composition, run, update, queue.floor()));
      queue.advanceFloor(run.revision); // Unseen/gated/duplicate callbacks cannot become fresh later.
    });
    const unsubscribeRead = store.getState().subscribeReadBoundary(() => {
      if (mounted) queue.reset(revision());
    });
    const visibility = () => {
      if (mounted) queue.reset(revision());
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted = false;
      unsubscribeState();
      unsubscribeCommit();
      unsubscribeRead();
      document.removeEventListener('visibilitychange', visibility);
      queue.reset(revision());
    };
  }, [store, composition, live, queue]);
  useEffect(() => {
    queue.setReducedMotion(reducedMotion);
  }, [queue, reducedMotion]);
  useEffect(() => {
    if (!notice) return;
    let second = 0;
    // Two frames place the timer after the first rendered visible frame.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (document.visibilityState === 'visible') queue.markVisible(notice.key);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [notice, queue]);
  if (!notice || !live) return null;
  return (
    <section className="panel" aria-label="New recorded narrative" aria-live="polite">
      <h2>{notice.title}</h2>
      <p className="campaign-document-text">{notice.body}</p>
      <p>
        This notification changes no campaign state. The recorded text remains in investigation
        history.
      </p>
      <a href="#campaign-tools">Read recorded narrative history</a>{' '}
      <button type="button" onClick={() => queue.dismiss()}>
        Dismiss notification
      </button>
    </section>
  );
}

import { useCallback, type MutableRefObject } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { CampaignSessionState } from '../store/campaign-session.ts';
import { committedCues } from '../audio/cues.ts';
import type { createSynthesizer } from '../audio/synth.ts';
import { AudioControls, type CueSubscription } from './AudioControls.tsx';

// Campaign binding: cues come only from durably committed ledger updates.
export function CampaignAudio({
  store,
  live,
  ambience,
  keyboard,
  createOutput,
  variant,
}: {
  store: StoreApi<CampaignSessionState>;
  live: boolean;
  ambience: boolean;
  keyboard: MutableRefObject<(() => void) | null>;
  createOutput?: typeof createSynthesizer;
  variant?: 'panel' | 'compact';
}) {
  const subscribe = useCallback<CueSubscription>(
    (listener) => store.getState().subscribeCommitted((update) => listener(committedCues(update))),
    [store],
  );
  return (
    <AudioControls
      subscribe={subscribe}
      live={live}
      ambience={ambience}
      keyboard={keyboard}
      createOutput={createOutput}
      variant={variant}
    />
  );
}

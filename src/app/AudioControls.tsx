import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { cueText, type AudioCue } from '../audio/cues.ts';
import { createSynthesizer, type AudioStatus, type Synthesizer } from '../audio/synth.ts';
import {
  readAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from '../audio/preferences.ts';

export type CueSubscription = (listener: (cues: readonly AudioCue[]) => void) => () => void;

const statusText: Record<AudioStatus, string> = {
  inactive: 'off',
  enabled: 'on',
  paused: 'paused',
  unavailable: 'unavailable',
};

// Presentation-only sound. Subscribes to already-accepted results; it never
// issues a domain command, and all information stays visible without audio.
export function AudioControls({
  subscribe,
  live,
  ambience,
  keyboard,
  createOutput = createSynthesizer,
  variant = 'panel',
}: {
  subscribe: CueSubscription;
  live: boolean;
  ambience: boolean;
  keyboard: MutableRefObject<(() => void) | null>;
  createOutput?: typeof createSynthesizer;
  variant?: 'panel' | 'compact';
}) {
  const [initial] = useState(readAudioPreferences);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [storageError, setStorageError] = useState(initial.error);
  const [status, setStatus] = useState<AudioStatus>('inactive');
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState('No new sound notifications.');
  const output = useRef<Synthesizer | null>(null);
  const liveRef = useRef(live);
  const ambienceRef = useRef(ambience);
  const preferencesRef = useRef(preferences);
  const activation = useRef({ generation: 0 });
  useEffect(() => {
    let mounted = true;
    const activationState = activation.current;
    const driver = createOutput({
      status: (next) => {
        if (!mounted) return;
        setStatus(next);
        if (next === 'paused' || next === 'unavailable') setActivating(false);
      },
    });
    output.current = driver;
    driver.setVolume(preferencesRef.current.volume);
    driver.setHumAllowed(liveRef.current && ambienceRef.current);
    driver.setForeground(document.visibilityState === 'visible');
    const visibility = () => {
      ++activationState.generation;
      setActivating(false);
      driver.setForeground(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', visibility);
    const unsubscribe = subscribe((cues) => {
      if (!liveRef.current || document.visibilityState !== 'visible') return;
      if (cues.length) setNotice(cues.map((cue) => cueText[cue]).join(' '));
      if (!preferencesRef.current.muted)
        for (const cue of cues) if (cue !== 'server_hum') driver.play(cue);
    });
    keyboard.current = () => {
      if (liveRef.current && !preferencesRef.current.muted) driver.play('keyboard');
    };
    return () => {
      mounted = false;
      ++activationState.generation;
      unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      keyboard.current = null;
      output.current = null;
      driver.dispose();
    };
  }, [subscribe, keyboard, createOutput]);
  useEffect(() => {
    liveRef.current = live;
    ambienceRef.current = ambience;
    output.current?.setHumAllowed(live && ambience);
    // Archive entry immediately stops all output; return requires explicit resume.
    if (!live) {
      ++activation.current.generation;
      output.current?.pause();
    }
  }, [live, ambience]);
  function remember(next: AudioPreferences) {
    preferencesRef.current = next;
    setPreferences(next);
    setStorageError(saveAudioPreferences(next));
  }
  async function enable() {
    const driver = output.current;
    if (!driver || activating) return;
    const token = ++activation.current.generation;
    setActivating(true);
    const success = await driver.enable();
    if (token !== activation.current.generation) return;
    setActivating(false);
    if (success) remember({ ...preferencesRef.current, muted: false });
  }
  const controls = (
    <>
      <p>Optional sound only. Everything you need to play is always shown on screen.</p>
      <p role="status">
        Sound: {statusText[status]}.{' '}
        {preferences.muted
          ? 'Muted.'
          : 'Sound is allowed; press Enable after opening or returning to this screen.'}
      </p>
      <button type="button" disabled={activating || !live} onClick={() => void enable()}>
        Enable / resume audio
      </button>
      <button
        type="button"
        onClick={() => {
          ++activation.current.generation;
          setActivating(false);
          output.current?.pause();
          remember({ ...preferencesRef.current, muted: true });
        }}
      >
        Mute audio
      </button>
      <label>
        Master volume: {Math.round(preferences.volume * 100)}%
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={preferences.volume}
          onChange={(event) => {
            const volume = Math.max(0, Math.min(1, Number(event.target.value)));
            output.current?.setVolume(volume);
            remember({ ...preferencesRef.current, volume });
          }}
        />
      </label>
      {status === 'unavailable' ? (
        <p role="alert">Audio unavailable. Silent visual gameplay is unchanged.</p>
      ) : null}
      {storageError ? <p role="alert">{storageError}</p> : null}
      <p role="status" aria-live="polite">
        {notice}
      </p>
      <p className="audio-legend">
        Pager: new incident. Relay: action finished. Chime: new information. Alarm: a service turned
        critical. Hum: live ambience. Keys: typing feedback.
      </p>
    </>
  );
  if (variant === 'compact')
    return (
      <details className="presentation-settings audio-settings" data-audio-controls>
        <summary>Sound settings ({preferences.muted ? 'muted' : statusText[status]})</summary>
        <div className="presentation-settings-controls audio-settings-controls">{controls}</div>
      </details>
    );
  return (
    <section
      className="panel campaign-audio"
      aria-labelledby="campaign-audio-title"
      data-audio-controls
    >
      <h2 id="campaign-audio-title">Sound</h2>
      {controls}
    </section>
  );
}

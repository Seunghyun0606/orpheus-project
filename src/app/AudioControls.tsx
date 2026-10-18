import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { AudioCue } from '../audio/cues.ts';
import { createSynthesizer, type AudioStatus, type Synthesizer } from '../audio/synth.ts';
import {
  readAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from '../audio/preferences.ts';
import { useMessages } from '../i18n/I18n.ts';
import { audioMessages } from './messages/audio.ts';

export type CueSubscription = (listener: (cues: readonly AudioCue[]) => void) => () => void;

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
  // The latest announced cues; the text is composed in the display language.
  const [notice, setNotice] = useState<readonly AudioCue[]>([]);
  const m = useMessages(audioMessages);
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
      if (cues.length) setNotice(cues);
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
      <p>{m.intro}</p>
      <p role="status">
        {m.soundStatus(m.status[status])} {preferences.muted ? m.muted : m.allowed}
      </p>
      <button type="button" disabled={activating || !live} onClick={() => void enable()}>
        {m.enable}
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
        {m.mute}
      </button>
      <label>
        {m.volume(Math.round(preferences.volume * 100))}
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
      {status === 'unavailable' ? <p role="alert">{m.unavailable}</p> : null}
      {storageError ? <p role="alert">{m.storageError(storageError)}</p> : null}
      <p role="status" aria-live="polite">
        {notice.length === 0 ? m.noNotice : notice.map((cue) => m.cues[cue]).join(' ')}
      </p>
      <p className="audio-legend">{m.legend}</p>
    </>
  );
  if (variant === 'compact')
    return (
      <details className="presentation-settings audio-settings" data-audio-controls>
        <summary>{m.summary(preferences.muted ? m.summaryMuted : m.status[status])}</summary>
        <div className="presentation-settings-controls audio-settings-controls">{controls}</div>
      </details>
    );
  return (
    <section
      className="panel campaign-audio"
      aria-labelledby="campaign-audio-title"
      data-audio-controls
    >
      <h2 id="campaign-audio-title">{m.title}</h2>
      {controls}
    </section>
  );
}

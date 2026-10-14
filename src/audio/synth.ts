import { tones, type AudioCue, type Tone } from './cues.ts';
export type AudioStatus = 'inactive' | 'enabled' | 'paused' | 'unavailable';
export function createSynthesizer(
  options: {
    context?: () => AudioContext;
    status?: (status: AudioStatus) => void;
  } = {},
) {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = false,
    foreground = true,
    humAllowed = false,
    disposed = false,
    epoch = 0,
    volume = 0.35;
  const voices = new Set<{ oscillator: OscillatorNode; gain: GainNode; hum: boolean }>();
  function stop(humOnly = false) {
    for (const voice of [...voices]) {
      if (humOnly && !voice.hum) continue;
      voices.delete(voice);
      try {
        voice.oscillator.stop();
      } catch {
        /* already ended */
      }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
  }
  function pause() {
    ++epoch;
    enabled = false;
    stop();
    if (master) master.gain.value = 0;
    if (context && context.state !== 'closed') void context.suspend().catch(() => undefined);
    if (!disposed) options.status?.('paused');
  }
  function tone(t: Tone, hum: boolean) {
    if (!context || !master || voices.size >= 24) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const start = context.currentTime + t.offset;
    oscillator.type = t.type;
    oscillator.frequency.value = t.frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(t.gain, start + 0.008);
    if (!hum) gain.gain.linearRampToValueAtTime(0, start + t.duration);
    oscillator.connect(gain);
    gain.connect(master);
    const voice = { oscillator, gain, hum };
    voices.add(voice);
    oscillator.onended = () => {
      voices.delete(voice);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    if (!hum) oscillator.stop(start + t.duration + 0.01);
  }
  function updateHum() {
    if (!enabled || !foreground || !humAllowed || volume === 0) {
      stop(true);
      return;
    }
    if (![...voices].some((v) => v.hum)) for (const t of tones.server_hum) tone(t, true);
  }
  function failed() {
    pause();
    options.status?.('unavailable');
  }
  return {
    // Called only by an explicit local activation button, never an effect or read.
    async enable(): Promise<boolean> {
      if (disposed || !foreground) return false;
      const token = ++epoch;
      try {
        if (!context) {
          context = options.context ? options.context() : new AudioContext();
          master = context.createGain();
          master.gain.value = 0;
          master.connect(context.destination);
        }
        await context.resume();
        if (disposed || token !== epoch || !foreground) {
          if (!enabled && context.state !== 'closed') void context.suspend().catch(() => undefined);
          return false;
        }
        if (context.state !== 'running') throw new Error('Audio output unavailable');
        enabled = true;
        master!.gain.value = volume;
        updateHum();
        options.status?.('enabled');
        return true;
      } catch {
        if (token === epoch && !disposed) failed();
        return false;
      }
    },
    pause,
    setVolume(value: number) {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      if (master) master.gain.value = enabled ? volume : 0;
      if (volume === 0) stop();
      try {
        updateHum();
      } catch {
        failed();
      }
    },
    setForeground(value: boolean) {
      foreground = value;
      if (!value) pause();
    },
    setHumAllowed(value: boolean) {
      humAllowed = value;
      try {
        updateHum();
      } catch {
        failed();
      }
    },
    play(cue: Exclude<AudioCue, 'server_hum'>) {
      if (!enabled || !foreground || disposed || volume === 0 || context?.state !== 'running')
        return;
      try {
        for (const t of tones[cue]) tone(t, false);
      } catch {
        failed();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      master?.disconnect();
      if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    },
  };
}
export type Synthesizer = ReturnType<typeof createSynthesizer>;

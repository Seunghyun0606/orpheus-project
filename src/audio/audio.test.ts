// Authored only; execution deferred by the human. No user-profile I/O.
import { describe, expect, it, vi } from 'vitest';
import {
  parseAudioPreferences,
  readAudioPreferences,
  saveAudioPreferences,
  AUDIO_PREFERENCES_KEY,
  defaultAudioPreferences,
} from './preferences.ts';
import { committedCues } from './cues.ts';
import { createSynthesizer } from './synth.ts';
import type { CampaignCommittedUpdate } from '../store/campaign-session.ts';

function fakeOutput() {
  const oscillators: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const gains: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended';
    }),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),
    createGain: vi.fn(() => {
      const gain = { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
      gains.push(gain);
      return { gain, connect: vi.fn(), disconnect: vi.fn() };
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: 'sine',
        frequency: { value: 0 },
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
  };
  return { context, oscillators, gains, factory: vi.fn(() => context as unknown as AudioContext) };
}
describe('scoped audio preferences (deferred)', () => {
  it('validates exact version, finite range and shape; preserves rejected bytes', () => {
    for (const payload of [
      { ...defaultAudioPreferences, schemaVersion: 2 },
      { ...defaultAudioPreferences, volume: -1 },
      { ...defaultAudioPreferences, volume: 2 },
      { ...defaultAudioPreferences, extra: true },
      { volume: 0.5 },
      [],
    ])
      expect(parseAudioPreferences(JSON.stringify(payload))).toBeNull();
    const port = { getItem: vi.fn(() => '{unsupported'), setItem: vi.fn() };
    expect(readAudioPreferences(port).preferences).toEqual(defaultAudioPreferences);
    expect(port.setItem).not.toHaveBeenCalled();
    expect(saveAudioPreferences(defaultAudioPreferences, port)).toBeNull();
    expect(port.setItem).toHaveBeenCalledWith(
      AUDIO_PREFERENCES_KEY,
      JSON.stringify(defaultAudioPreferences),
    );
  });
  it('reports blocked storage without throwing or issuing domain writes', () => {
    const port = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readAudioPreferences(port).error).not.toBeNull();
    expect(saveAudioPreferences(defaultAudioPreferences, port)).not.toBeNull();
  });
});
describe('local synthesis lifecycle (deferred)', () => {
  it('does not create context before activation; clamps volume, stops all voices and closes on exit', async () => {
    const f = fakeOutput(),
      driver = createSynthesizer({ context: f.factory });
    driver.setHumAllowed(true);
    driver.play('pager');
    expect(f.factory).not.toHaveBeenCalled();
    expect(await driver.enable()).toBe(true);
    driver.play('pager');
    expect(f.oscillators).toHaveLength(5);
    driver.setVolume(2);
    expect(f.gains[0]!.value).toBe(1);
    driver.setForeground(false);
    expect(f.oscillators.every((o) => o.stop.mock.calls.length > 0)).toBe(true);
    const count = f.oscillators.length;
    driver.setForeground(true);
    driver.play('relay');
    expect(f.oscillators).toHaveLength(count);
    driver.dispose();
    expect(f.context.close).toHaveBeenCalledTimes(1);
    expect(await driver.enable()).toBe(false);
  });
  it('mute invalidates an in-flight resume without re-enabling output', async () => {
    const f = fakeOutput();
    let release!: () => void;
    f.context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            f.context.state = 'running';
            resolve();
          };
        }),
    );
    const driver = createSynthesizer({ context: f.factory });
    const enabling = driver.enable();
    driver.pause();
    release();
    expect(await enabling).toBe(false);
    driver.play('pager');
    expect(f.oscillators).toHaveLength(0);
    expect(f.gains[0]!.value).toBe(0);
  });
  it('unsupported output stays silent and supplies a presentation diagnosis', async () => {
    const status = vi.fn(),
      driver = createSynthesizer({
        context: () => {
          throw new Error('Unavailable');
        },
        status,
      });
    expect(await driver.enable()).toBe(false);
    expect(status).toHaveBeenLastCalledWith('unavailable');
  });
});
describe('committed cue projection (deferred)', () => {
  it('uses only new command events and revealed status, never hidden signals or checkpoint history', () => {
    const base = {
      operation: { kind: 'command' },
      events: [
        {
          sequence: 1,
          atSeconds: 15,
          type: 'signal_changed',
          targetId: 'status',
          value: 'CRITICAL',
          previousValue: 'DEGRADED',
        },
      ],
      signals: { status: { value: 'CRITICAL', revealed: false } },
    } as CampaignCommittedUpdate;
    expect(committedCues(base)).toEqual([]);
    expect(
      committedCues({ ...base, signals: { status: { value: 'CRITICAL', revealed: true } } }),
    ).toEqual(['critical_alarm']);
    expect(
      committedCues({
        ...base,
        operation: { kind: 'checkpoint' } as CampaignCommittedUpdate['operation'],
      }),
    ).toEqual([]);
    expect(committedCues({ ...base, events: [] })).toEqual([]);
    expect(
      committedCues({
        ...base,
        operation: { kind: 'start' } as CampaignCommittedUpdate['operation'],
      }),
    ).toEqual(['pager']);
  });
});

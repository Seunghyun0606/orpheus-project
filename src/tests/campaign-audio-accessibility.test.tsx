// Deferred coverage, not native Windows/Narrator certification.
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createRef } from 'react';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { compositionFixture } from './fixtures/composition.ts';
import { CampaignAudio } from '../app/CampaignAudio.tsx';
import { CampaignDesk } from '../app/CampaignDesk.tsx';
import { AUDIO_PREFERENCES_KEY } from '../audio/preferences.ts';
import type { createSynthesizer } from '../audio/synth.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
async function session() {
  const f = compositionFixture();
  const factory = new IDBFactory();
  let id = 0;
  const ledger = createCampaignLedger(
    {
      definitions: new Map([
        [campaignDefinitionKey(f.definition.id, f.definition.version), f.definition],
      ]),
      scenarios: f.composition.catalog,
    },
    () => factory,
  );
  const store = createCampaignSessionStore({
    definition: f.definition,
    catalog: f.composition.catalog,
    runId: 'audio-fixture',
    ledger,
    identity: () => `audio-${id++}`,
  });
  await store.getState().load();
  await store.getState().create();
  return { ...f, store };
}
describe('campaign audio controls and accessible sections (deferred)', () => {
  it('invalidates an unresolved enable on unmount without remembering stale activation', async () => {
    const { store } = await session();
    let complete: (value: boolean) => void = () => undefined;
    const output = {
      enable: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            complete = resolve;
          }),
      ),
      pause: vi.fn(),
      setVolume: vi.fn(),
      setForeground: vi.fn(),
      setHumAllowed: vi.fn(),
      play: vi.fn(),
      dispose: vi.fn(),
    };
    const keyboard = createRef<(() => void) | null>();
    const rendered = render(
      <CampaignAudio
        store={store}
        live
        ambience={false}
        keyboard={keyboard}
        createOutput={() => output}
      />,
    );
    const prior = localStorage.getItem(AUDIO_PREFERENCES_KEY);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enable / resume audio' }));
    expect(output.enable).toHaveBeenCalledTimes(1);
    rendered.unmount();
    await act(async () => {
      complete(true);
    });
    expect(output.dispose).toHaveBeenCalledTimes(1);
    expect(keyboard.current).toBeNull();
    expect(localStorage.getItem(AUDIO_PREFERENCES_KEY)).toBe(prior);
  });
  it('reads remembered preference without enabling output; mute/volume/exit are presentation-only', async () => {
    const { store } = await session();
    const user = userEvent.setup();
    localStorage.setItem('orpheus.presentation.v1', 'preserve-exact-bytes');
    localStorage.setItem(
      AUDIO_PREFERENCES_KEY,
      JSON.stringify({ schemaVersion: 1, muted: false, volume: 0.5 }),
    );
    const output = {
      enable: vi.fn(async () => true),
      pause: vi.fn(),
      setVolume: vi.fn(),
      setForeground: vi.fn(),
      setHumAllowed: vi.fn(),
      play: vi.fn(),
      dispose: vi.fn(),
    };
    const createOutput: typeof createSynthesizer = () => output;
    const keyboard = createRef<(() => void) | null>();
    const before = store.getState().run;
    const rendered = render(
      <CampaignAudio
        store={store}
        live
        ambience={false}
        keyboard={keyboard}
        createOutput={createOutput}
      />,
    );
    expect(output.enable).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Enable / resume audio' }));
    expect(output.enable).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Mute audio' }));
    expect(output.pause).toHaveBeenCalled();
    expect(store.getState().run).toBe(before);
    expect(localStorage.getItem('orpheus.presentation.v1')).toBe('preserve-exact-bytes');
    rendered.unmount();
    expect(output.dispose).toHaveBeenCalledTimes(1);
    expect(keyboard.current).toBeNull();
  });
  it('does not replay alerts on reload/archive; exposes a text alternative for a live new attempt', async () => {
    const { store, definition } = await session();
    const output = {
      enable: vi.fn(async () => true),
      pause: vi.fn(),
      setVolume: vi.fn(),
      setForeground: vi.fn(),
      setHumAllowed: vi.fn(),
      play: vi.fn(),
      dispose: vi.fn(),
    };
    const createOutput: typeof createSynthesizer = () => output;
    const keyboard = createRef<(() => void) | null>();
    const rendered = render(
      <CampaignAudio
        store={store}
        live
        ambience={false}
        keyboard={keyboard}
        createOutput={createOutput}
      />,
    );
    await act(async () => {
      await store.getState().load();
    });
    expect(output.play).not.toHaveBeenCalled();
    await act(async () => {
      await store.getState().start(definition.incidents[0]!.id, 1001);
    });
    expect(screen.getByText('New incident attempt committed.')).toBeInTheDocument();
    expect(output.play).not.toHaveBeenCalled(); // default muted
    rendered.rerender(
      <CampaignAudio
        store={store}
        live={false}
        ambience={false}
        keyboard={keyboard}
        createOutput={createOutput}
      />,
    );
    expect(output.pause).toHaveBeenCalled();
    await act(async () => {
      await store.getState().load();
    });
    expect(output.play).not.toHaveBeenCalled();
  });
  it('keeps section shortcuts, 150 percent text and native controls without generating samples', async () => {
    const { store, composition } = await session();
    const user = userEvent.setup();
    const before = store.getState().run;
    const { container } = render(
      <CampaignDesk store={store} seed={1001} composition={composition} onBack={() => undefined} />,
    );
    expect(
      screen.getByRole('navigation', { name: 'Campaign section shortcuts' }),
    ).toBeInTheDocument();
    await user.click(screen.getByText('Display settings', { selector: 'summary' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Text scale' }), 'extra-large');
    // Text scale and motion are one global document setting (CSS scales the
    // root font size). This remains a presentation test, not native layout.
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'extra-large');
    await user.click(screen.getByRole('checkbox', { name: 'Reduce animation' }));
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(container.querySelector('#campaign-evidence')).toHaveAttribute('tabindex', '-1');
    expect(store.getState().run).toBe(before);
    expect(screen.getByRole('slider', { name: /Master volume/ })).toBeInTheDocument();
  });
});

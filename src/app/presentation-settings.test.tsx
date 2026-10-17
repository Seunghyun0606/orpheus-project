import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PresentationProvider, PresentationSettings } from './PresentationSettings.tsx';
import {
  defaultPresentationPreferences,
  presentationStorageKey,
  readPresentationPreferences,
} from './presentation-settings.ts';

const css = readFileSync('src/ui/base.css', 'utf8');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(presentationStorageKey);
});

describe('global presentation settings', () => {
  it('reads older stored preferences without a colour theme', () => {
    window.localStorage.setItem(
      presentationStorageKey,
      JSON.stringify({ crtEffects: false, reducedAnimation: true, textScale: 'large' }),
    );
    expect(readPresentationPreferences()).toEqual({
      crtEffects: false,
      reducedAnimation: true,
      textScale: 'large',
      colorTheme: 'standard',
    });
    window.localStorage.setItem(presentationStorageKey, '{not json');
    expect(readPresentationPreferences()).toEqual(defaultPresentationPreferences);
  });

  it('shares one state between nested providers and every settings control', async () => {
    const user = userEvent.setup();
    render(
      <PresentationProvider>
        <PresentationSettings />
        <PresentationProvider>
          <PresentationSettings />
        </PresentationProvider>
      </PresentationProvider>,
    );
    const [outer, inner] = screen.getAllByRole('combobox', { name: 'Colour theme' });
    await user.selectOptions(inner!, 'high-contrast');
    expect(outer).toHaveValue('high-contrast');
    expect(document.documentElement).toHaveAttribute('data-theme', 'high-contrast');
  });

  it('keeps working when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(
      <PresentationProvider>
        <PresentationSettings />
      </PresentationProvider>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'CRT effects' }));
    expect(document.documentElement).toHaveAttribute('data-crt-effects', 'off');
  });
});

describe('presentation stylesheet contract', () => {
  it('never declares text smaller than 0.75rem', () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(20);
    expect(sizes.filter((size) => size < 0.75)).toEqual([]);
  });

  it('animates the CRT layer only when CRT is on and motion is not reduced', () => {
    expect(css).toMatch(/@keyframes crt-flicker/);
    const motionBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    expect(motionBlock).toMatch(
      /:root\[data-crt-effects='on'\]\[data-motion='standard'\]:not\(\[data-theme='high-contrast'\]\)\s+body::after\s*\{\s*animation: crt-flicker/,
    );
    expect(css).toMatch(/pointer-events: none/);
  });

  it('defines a high-contrast theme and forced-colours handling', () => {
    expect(css).toMatch(/:root\[data-theme='high-contrast'\]\s*\{/);
    expect(css).toMatch(/@media \(forced-colors: active\)/);
  });
});

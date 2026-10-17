import { createContext, useContext } from 'react';

export type TextScale = 'standard' | 'large' | 'extra-large';
export type ColorTheme = 'standard' | 'high-contrast';

export interface PresentationPreferences {
  crtEffects: boolean;
  reducedAnimation: boolean;
  textScale: TextScale;
  colorTheme: ColorTheme;
}

export const presentationStorageKey = 'orpheus.presentation.v1';

export const defaultPresentationPreferences: PresentationPreferences = {
  crtEffects: true,
  reducedAnimation: false,
  textScale: 'standard',
  colorTheme: 'standard',
};

// Older stored values (without colorTheme) remain readable; unknown values fall back.
export function readPresentationPreferences(): PresentationPreferences {
  if (typeof window === 'undefined') return defaultPresentationPreferences;

  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(presentationStorageKey) ?? 'null',
    );
    if (stored === null || typeof stored !== 'object') return defaultPresentationPreferences;
    const value = stored as Record<string, unknown>;
    return {
      crtEffects:
        typeof value.crtEffects === 'boolean'
          ? value.crtEffects
          : defaultPresentationPreferences.crtEffects,
      reducedAnimation:
        typeof value.reducedAnimation === 'boolean'
          ? value.reducedAnimation
          : defaultPresentationPreferences.reducedAnimation,
      textScale:
        value.textScale === 'large' || value.textScale === 'extra-large'
          ? value.textScale
          : defaultPresentationPreferences.textScale,
      colorTheme:
        value.colorTheme === 'high-contrast'
          ? 'high-contrast'
          : defaultPresentationPreferences.colorTheme,
    };
  } catch {
    return defaultPresentationPreferences;
  }
}

export function savePresentationPreferences(preferences: PresentationPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(presentationStorageKey, JSON.stringify(preferences));
  } catch {
    // Display controls remain usable when local storage is unavailable.
  }
}

// Presentation-only document attributes. They are intentionally never removed on
// unmount: every screen shares one setting, and navigation must not reset it.
export function applyPresentationPreferences(
  preferences: PresentationPreferences,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.crtEffects = preferences.crtEffects ? 'on' : 'off';
  root.dataset.motion = preferences.reducedAnimation ? 'reduce' : 'standard';
  root.dataset.textScale = preferences.textScale;
  root.dataset.theme = preferences.colorTheme;
}

export interface PresentationContextValue {
  readonly preferences: PresentationPreferences;
  readonly setPreferences: (preferences: PresentationPreferences) => void;
}

export const PresentationContext = createContext<PresentationContextValue | null>(null);

export function usePresentationPreferences(): PresentationContextValue {
  const value = useContext(PresentationContext);
  if (value === null) {
    throw new Error('Presentation settings require a PresentationProvider.');
  }
  return value;
}

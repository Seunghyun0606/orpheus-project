export type TextScale = 'standard' | 'large' | 'extra-large';

export interface PresentationPreferences {
  crtEffects: boolean;
  reducedAnimation: boolean;
  textScale: TextScale;
}

export const presentationStorageKey = 'orpheus.presentation.v1';

export const defaultPresentationPreferences: PresentationPreferences = {
  crtEffects: true,
  reducedAnimation: false,
  textScale: 'standard',
};

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

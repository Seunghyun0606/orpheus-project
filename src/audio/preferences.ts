export const AUDIO_PREFERENCES_KEY = 'orpheus.audio.v1';
export interface AudioPreferences {
  schemaVersion: 1;
  muted: boolean;
  volume: number;
}
export const defaultAudioPreferences: AudioPreferences = {
  schemaVersion: 1,
  muted: true,
  volume: 0.35,
};
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
function storage(): PreferenceStorage {
  return globalThis.localStorage;
}
export function parseAudioPreferences(bytes: string): AudioPreferences | null {
  try {
    const p: unknown = JSON.parse(bytes);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const v = p as Record<string, unknown>;
    if (
      Object.keys(v).length !== 3 ||
      v.schemaVersion !== 1 ||
      typeof v.muted !== 'boolean' ||
      typeof v.volume !== 'number' ||
      !Number.isFinite(v.volume) ||
      v.volume < 0 ||
      v.volume > 1
    )
      return null;
    return { schemaVersion: 1, muted: v.muted, volume: v.volume };
  } catch {
    return null;
  }
}
export function readAudioPreferences(port?: PreferenceStorage): {
  preferences: AudioPreferences;
  error: string | null;
} {
  try {
    const bytes = (port ?? storage()).getItem(AUDIO_PREFERENCES_KEY);
    if (bytes === null) return { preferences: { ...defaultAudioPreferences }, error: null };
    const preferences = parseAudioPreferences(bytes);
    return {
      preferences: preferences ?? { ...defaultAudioPreferences },
      error: preferences
        ? null
        : 'Stored audio preferences are unsupported; preserved without rewriting.',
    };
  } catch {
    return {
      preferences: { ...defaultAudioPreferences },
      error: 'Audio preferences unavailable; using memory only.',
    };
  }
}
export function saveAudioPreferences(
  preferences: AudioPreferences,
  port?: PreferenceStorage,
): string | null {
  if (!parseAudioPreferences(JSON.stringify(preferences)))
    return 'Invalid audio preferences; not saved.';
  try {
    (port ?? storage()).setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
    return null;
  } catch {
    return 'Audio preferences not saved; controls work in memory only.';
  }
}

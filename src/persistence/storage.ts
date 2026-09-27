export interface SaveStorage {
  read(): string | null;
  write(value: string): void;
}

export const DEFAULT_SAVE_KEY = 'orpheus.incident.v1';

// Browser and Tauri WebView both expose localStorage. Keep platform I/O here so
// session and domain code can use an injected adapter in either runtime.
export function createLocalSaveStorage(
  key = DEFAULT_SAVE_KEY,
  getStorage: () => Storage = () => globalThis.localStorage,
): SaveStorage {
  return {
    read: () => getStorage().getItem(key),
    write: (value) => getStorage().setItem(key, value),
  };
}

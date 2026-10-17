export const briefingStorageKey = 'orpheus.briefing.v1';

// First-run briefing memory. Storage failures (private mode, blocked storage)
// simply show the briefing again; they never block the desk.
export function readBriefingDismissed(): boolean {
  try {
    return window.localStorage.getItem(briefingStorageKey) === 'dismissed';
  } catch {
    return false;
  }
}

export function saveBriefingDismissed(): void {
  try {
    window.localStorage.setItem(briefingStorageKey, 'dismissed');
  } catch {
    // The briefing is dismissed for this session only.
  }
}

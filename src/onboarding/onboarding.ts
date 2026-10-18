import { useSyncExternalStore } from 'react';
import { parse } from 'yaml';
import { z } from 'zod';

import type { IncidentState } from '../engine/types.ts';
import type { Locale } from '../i18n/locale.ts';
import hintsSource from './hints.yaml?raw';

// Onboarding hints for the first Incidents (DEC-071). They are derived from
// the Incident state on every render and never feed back into the engine, so
// replays, saves and campaign records are identical with hints on or off.

const localized = z.strictObject({ en: z.string().min(1), ko: z.string().min(1) });
const ids = z.array(z.string().min(1)).min(1);
const focus = z.string().regex(/^(action|tool|region):[A-Za-z0-9_-]+$/);

const hintSchema = z.strictObject({
  id: z.string().min(1),
  when: z.strictObject({
    completed: ids.optional(),
    notCompleted: ids.optional(),
    anyCompleted: ids.optional(),
    available: ids.optional(),
    resolved: z.boolean().optional(),
    closed: z.boolean().optional(),
    evidence: z.boolean().optional(),
    minElapsed: z.number().int().nonnegative().optional(),
  }),
  focus: focus.optional(),
  text: localized,
  campaign: localized.optional(),
  campaignFocus: focus.optional(),
});

const guideSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sender: localized,
  incidents: z.record(z.string(), z.array(hintSchema)),
});

export type OnboardingHint = z.infer<typeof hintSchema>;
export type OnboardingGuide = z.infer<typeof guideSchema>;
export type OnboardingSurface = 'desk' | 'campaign';

export function parseOnboardingGuide(source: string): OnboardingGuide {
  const guide = guideSchema.parse(parse(source));
  for (const [incidentId, hints] of Object.entries(guide.incidents)) {
    const seen = new Set<string>();
    for (const hint of hints) {
      if (seen.has(hint.id)) throw new Error(`Duplicate onboarding hint ${incidentId}/${hint.id}.`);
      seen.add(hint.id);
    }
  }
  return guide;
}

export const onboardingGuide: OnboardingGuide = parseOnboardingGuide(hintsSource);

export type OnboardingState = Pick<
  IncidentState,
  | 'scenarioId'
  | 'elapsedSeconds'
  | 'completedActionIds'
  | 'revealedEvidenceIds'
  | 'resolutionReached'
  | 'completionReached'
>;

export function hintMatches(
  hint: OnboardingHint,
  state: OnboardingState,
  availableActionIds: readonly string[],
): boolean {
  const { when } = hint;
  const done = new Set(state.completedActionIds);
  return (
    (when.completed?.every((id) => done.has(id)) ?? true) &&
    (when.notCompleted?.every((id) => !done.has(id)) ?? true) &&
    (when.anyCompleted?.some((id) => done.has(id)) ?? true) &&
    (when.available?.every((id) => availableActionIds.includes(id)) ?? true) &&
    (when.resolved === undefined || when.resolved === state.resolutionReached) &&
    (when.closed === undefined || when.closed === state.completionReached) &&
    (when.evidence === undefined || when.evidence === state.revealedEvidenceIds.length > 0) &&
    (when.minElapsed === undefined || state.elapsedSeconds >= when.minElapsed)
  );
}

export const hintKey = (incidentId: string, hintId: string) => `${incidentId}/${hintId}`;

export interface ActiveHint {
  readonly key: string;
  readonly hint: OnboardingHint;
  readonly text: string;
  readonly focus: string | undefined;
}

// The first matching, undismissed hint for this Incident, if it has a guide.
export function selectHint(
  guide: OnboardingGuide,
  state: OnboardingState,
  availableActionIds: readonly string[],
  dismissed: ReadonlySet<string>,
  surface: OnboardingSurface,
  locale: Locale,
): ActiveHint | undefined {
  for (const hint of guide.incidents[state.scenarioId] ?? []) {
    const key = hintKey(state.scenarioId, hint.id);
    if (dismissed.has(key) || !hintMatches(hint, state, availableActionIds)) continue;
    const campaign = surface === 'campaign';
    return {
      key,
      hint,
      text: ((campaign ? hint.campaign : undefined) ?? hint.text)[locale],
      focus: (campaign ? hint.campaignFocus : undefined) ?? hint.focus,
    };
  }
  return undefined;
}

// {action:ID} placeholders become the action's title (already translated by
// the caller); an unknown action keeps its ID so the gap is visible in review.
export function renderHintText(text: string, actionTitle: (id: string) => string): string {
  return text.replace(/\{action:([A-Za-z0-9_-]+)\}/g, (_, id: string) => actionTitle(id));
}

// Viewer preference: hints on/off and which ones were dismissed. Stored apart
// from saves and campaign records; storage failures only forget the choice.
export const onboardingStorageKey = 'orpheus.onboarding.v1';

export interface OnboardingPreferences {
  readonly enabled: boolean;
  readonly dismissed: readonly string[];
}

const defaultPreferences: OnboardingPreferences = { enabled: true, dismissed: [] };
let current: OnboardingPreferences | undefined;
const listeners = new Set<() => void>();

function read(): OnboardingPreferences {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(onboardingStorageKey) ?? 'null');
    if (stored === null || typeof stored !== 'object') return defaultPreferences;
    const value = stored as Record<string, unknown>;
    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
      dismissed: Array.isArray(value.dismissed)
        ? value.dismissed.filter((item): item is string => typeof item === 'string')
        : [],
    };
  } catch {
    return defaultPreferences;
  }
}

export function getOnboardingPreferences(): OnboardingPreferences {
  current ??= typeof window === 'undefined' ? defaultPreferences : read();
  return current;
}

export function setOnboardingPreferences(next: OnboardingPreferences): void {
  current = next;
  try {
    window.localStorage.setItem(onboardingStorageKey, JSON.stringify(next));
  } catch {
    // Kept for this session only.
  }
  for (const listener of listeners) listener();
}

export function subscribeOnboardingPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnboardingPreferences(): OnboardingPreferences {
  return useSyncExternalStore(
    subscribeOnboardingPreferences,
    getOnboardingPreferences,
    getOnboardingPreferences,
  );
}

// Test hook: forget the cached preferences so the next read uses storage.
export function resetOnboardingPreferencesCache(): void {
  current = undefined;
}

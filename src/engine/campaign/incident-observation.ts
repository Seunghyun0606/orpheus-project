import type { IncidentState } from '../types.ts';

export type IncidentObservationValue = number | string | boolean;

// Incident-state sources shared by the behavior, prediction, opportunity and
// ending models. Model-specific sources (ages, action history, support keys)
// return undefined so each caller resolves them itself.
export function observeIncident(
  incident: IncidentState,
  ref: { readonly source: string; readonly key?: string },
): IncidentObservationValue | undefined {
  const key = ref.key ?? '';
  switch (ref.source) {
    case 'elapsedSeconds':
      return incident.elapsedSeconds;
    case 'signal':
      return incident.signals[key]!.value;
    case 'signal_revealed':
      return incident.signals[key]!.revealed;
    case 'resource':
      return incident.resources[key]!.value;
    case 'flag':
      return incident.flags[key]!;
    case 'evidence':
      return incident.revealedEvidenceIds.includes(key);
    case 'completion':
      return incident.completionReached;
    case 'resolution':
      return incident.resolutionReached;
    default:
      return undefined;
  }
}

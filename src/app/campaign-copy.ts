import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import type { Scenario } from '../scenario/schema.ts';
import { humanize } from './format.ts';

// Player-facing wording for the campaign console. Read-only helpers over the
// verified package and run; nothing here decides availability or progression.

// Act names follow the approved campaign blueprint (Acts 1-9). They are display
// copy only and are shown for the act the player has already reached.
const actNames: Record<number, string> = {
  1: 'NORMAL',
  2: 'GHOST',
  3: 'NULL',
  4: 'ORPHEUS',
  5: 'EXPERIMENT',
  6: 'HUMAN SYSTEM',
  7: 'THE BOARD',
  8: 'OBSERVER',
  9: 'BLACKOUT',
};

export function actTitle(act: number): string {
  const name = actNames[act];
  return name === undefined ? `Act ${act}` : `Act ${act} — ${name}`;
}

export function incidentScenario(
  composition: ResolvedCampaignPackage | undefined,
  incidentId: string,
): Scenario | undefined {
  if (composition === undefined) return undefined;
  const incident = composition.definition.incidents.find((item) => item.id === incidentId);
  if (incident === undefined) return undefined;
  return composition.catalog.get(scenarioVersionKey(incident.scenarioId, incident.contentVersion));
}

export function incidentTitle(
  composition: ResolvedCampaignPackage | undefined,
  incidentId: string,
): string {
  return incidentScenario(composition, incidentId)?.title ?? humanize(incidentId);
}

export function attemptScenario(
  composition: ResolvedCampaignPackage | undefined,
  attempt: CampaignRun['attempts'][number],
): Scenario | undefined {
  return composition?.catalog.get(
    scenarioVersionKey(attempt.incident.scenarioId, attempt.incident.contentVersion),
  );
}

export function actionTitleFrom(
  scenario: Scenario | undefined,
  actionId: string,
  available: readonly { id: string; title: string }[] = [],
): string {
  return (
    scenario?.actions.find((action) => action.id === actionId)?.title ??
    available.find((action) => action.id === actionId)?.title ??
    humanize(actionId)
  );
}

export function isFinalIncident(
  composition: ResolvedCampaignPackage | undefined,
  incidentId: string,
): boolean {
  return composition?.definition.endings?.finals.some((f) => f.incidentId === incidentId) ?? false;
}

export const closedActionReasons = {
  record: "Not open to you: your record doesn't support this.",
  known: 'Already on record.',
} as const;

export interface ClosedAction {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
}

// Availability comes only from the store's verified action list (`available`).
// A panel's authored, campaign-gated actions that are absent from it are listed
// as closed (never enabled), so the player can see what their record shut.
// Actions merely not unlocked yet, or already done, stay hidden as before.
export function closedPanelActions(
  definition: CampaignDefinition,
  attempt: CampaignRun['attempts'][number],
  scenario: Scenario | undefined,
  panelActionIds: readonly string[],
  available: readonly { id: string }[],
): ClosedAction[] {
  if (attempt.incident.completionReached) return [];
  return panelActionIds.flatMap((id): ClosedAction[] => {
    if (available.some((action) => action.id === id)) return [];
    if (attempt.incident.completedActionIds.includes(id)) return [];
    const gated = (definition.actionGates ?? []).some(
      (gate) =>
        gate.incidentId === attempt.incidentId &&
        gate.contentVersion === attempt.incident.contentVersion &&
        gate.actionId === id,
    );
    if (!gated) return [];
    // Catch-up re-investigations close once the finding is already on the
    // record; every other gate (e.g. the final plans) closes on the record.
    const reason = id.startsWith('REINVESTIGATE_')
      ? closedActionReasons.known
      : closedActionReasons.record;
    return [{ id, title: actionTitleFrom(scenario, id), reason }];
  });
}

export type GuidanceKind = 'prediction' | 'recommendation' | 'choice' | 'unknown';

export function ruleKind(
  composition: ResolvedCampaignPackage | undefined,
  ruleId: string,
): GuidanceKind {
  return (
    composition?.definition.opportunities?.rules.find((rule) => rule.id === ruleId)?.kind ??
    'unknown'
  );
}

export const guidanceOffer: Record<GuidanceKind, string> = {
  prediction: 'ORPHEUS has a forecast about you — show it',
  recommendation: 'ORPHEUS recommends an action — show it',
  choice: 'A decision is waiting — show it',
  unknown: 'ORPHEUS has something for you — show it',
};

export const guidanceReopen: Record<GuidanceKind, string> = {
  prediction: 'Show the ORPHEUS forecast again',
  recommendation: 'Show the ORPHEUS recommendation again',
  choice: 'Show the waiting decision again',
  unknown: 'Show the ORPHEUS message again',
};

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

const metricLabels: Record<string, string> = {
  restartRate: 'Restarted a service as the response',
  rollbackRate: 'Rolled back a change as the response',
  evidenceBeforeActionRate: 'Gathered evidence before acting',
  aiRecommendationAcceptanceRate: 'Accepted ORPHEUS recommendations',
  averageInvestigationDepth: 'Investigation depth (distinct findings per incident)',
  safetyPreference: 'Chose the safer option',
  collateralDamageTolerance: 'Accepted collateral damage',
  companyReportingRate: 'Reported findings to the company',
  nullCooperationRate: 'Cooperated with NULL',
  predictionDeviation: 'Did something other than ORPHEUS forecast',
};

export interface ProfileLine {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

// Only metrics the engine marked available are shown; nothing is inferred.
export function subjectProfile(run: CampaignRun): ProfileLine[] {
  const metrics = run.behavior?.metrics;
  if (metrics === undefined) return [];
  return Object.entries(metrics).flatMap(([key, metric]): ProfileLine[] => {
    if (metric.status !== 'available') return [];
    const label = metricLabels[key] ?? humanize(key);
    if (key === 'averageInvestigationDepth')
      return [
        {
          key,
          label,
          value: metric.value.toFixed(1),
          detail: `across ${metric.denominator} incident${metric.denominator === 1 ? '' : 's'}`,
        },
      ];
    return [
      {
        key,
        label,
        value: `${Math.round(metric.value * 100)}%`,
        detail: `${metric.numerator} of ${metric.denominator}`,
      },
    ];
  });
}

export interface ForecastComparison {
  readonly key: string;
  readonly predicted: string;
  readonly confidence: string;
  readonly actual: string;
  readonly matched: boolean;
}

// Pairs each recorded response with the exact preparation it answered. Only
// predictions the player was actually shown (a predicted result) are listed.
export function forecastComparisons(
  run: CampaignRun,
  attemptId: string,
  scenario: Scenario | undefined,
): ForecastComparison[] {
  const opportunities = run.opportunities;
  if (opportunities === undefined) return [];
  return opportunities.responses.flatMap((response): ForecastComparison[] => {
    if (response.attemptId !== attemptId) return [];
    const preparation = opportunities.preparations.find((p) => p.id === response.preparationId);
    const prediction = preparation?.prediction;
    if (
      preparation?.kind !== 'prediction' ||
      !prediction?.ok ||
      prediction.result.kind !== 'predicted'
    )
      return [];
    return [
      {
        key: response.preparationId,
        predicted: actionTitleFrom(scenario, prediction.result.actionId),
        confidence: formatConfidence(prediction.result.confidence),
        actual: actionTitleFrom(scenario, response.actionId),
        matched: prediction.result.actionId === response.actionId,
      },
    ];
  });
}

function versionParts(version: string): number[] {
  return version.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function newestPackage(
  packages: readonly ResolvedCampaignPackage[],
): ResolvedCampaignPackage | undefined {
  return [...packages].sort((left, right) =>
    compareVersions(right.package.version, left.package.version),
  )[0];
}

import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import type { Scenario } from '../scenario/schema.ts';
import type { Locale } from '../i18n/locale.ts';
import { humanize } from './format.ts';
import { campaignCopyMessages } from './messages/campaign-copy.ts';

// Player-facing wording for the campaign console. Read-only helpers over the
// verified package and run; nothing here decides availability or progression.

// Act names follow the approved campaign blueprint (Acts 1-9). They are display
// copy only and are shown for the act the player has already reached.
export function actTitle(act: number, locale: Locale = 'en'): string {
  const copy = campaignCopyMessages[locale];
  const name = copy.actNames[act];
  return name === undefined ? copy.act(act) : copy.actNamed(act, name);
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

export const closedActionReasons = campaignCopyMessages.en.closedReasons;

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
  locale: Locale = 'en',
): ClosedAction[] {
  const reasons = campaignCopyMessages[locale].closedReasons;
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
    const reason = id.startsWith('REINVESTIGATE_') ? reasons.known : reasons.record;
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

// English defaults; localized screens read campaignCopyMessages[locale].
export const guidanceOffer: Readonly<Record<GuidanceKind, string>> =
  campaignCopyMessages.en.guidanceOffer;

export const guidanceReopen: Readonly<Record<GuidanceKind, string>> =
  campaignCopyMessages.en.guidanceReopen;

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export interface ProfileLine {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

// Only metrics the engine marked available are shown; nothing is inferred.
export function subjectProfile(run: CampaignRun, locale: Locale = 'en'): ProfileLine[] {
  const metrics = run.behavior?.metrics;
  if (metrics === undefined) return [];
  const copy = campaignCopyMessages[locale];
  return Object.entries(metrics).flatMap(([key, metric]): ProfileLine[] => {
    if (metric.status !== 'available') return [];
    const label = copy.metricLabels[key] ?? humanize(key);
    if (key === 'averageInvestigationDepth')
      return [
        {
          key,
          label,
          value: metric.value.toFixed(1),
          detail: copy.depthDetail(metric.denominator),
        },
      ];
    return [
      {
        key,
        label,
        value: `${Math.round(metric.value * 100)}%`,
        detail: copy.rateDetail(metric.numerator, metric.denominator),
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

// ORPHEUS is only known to be alive from Act 4 (its rediscovery is a reveal), so the
// always-visible advisory chrome stays generic before then.
export const advisorName = (act: number | null, locale: Locale = 'en'): string =>
  act !== null && act >= 4 ? 'ORPHEUS' : campaignCopyMessages[locale].unnamedAdvisor;

// Ending IDs are authored identities; only the displayed name is localized.
export function endingName(endingId: string, locale: Locale = 'en'): string {
  return campaignCopyMessages[locale].endingNames[endingId] ?? endingId;
}

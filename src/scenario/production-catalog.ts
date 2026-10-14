import { z } from 'zod';
import {
  createCampaignPackageRegistry,
  campaignPackageSchema,
  parsePackageYaml,
  type PackageResult,
} from './campaign-package.ts';
import { validateVersionedScenarioCatalog } from './catalog.ts';
import { validateCampaignDefinition } from './campaign.ts';

export const fullCampaignManifestSchema = z
  .object({
    endingIds: z.array(z.string().min(1)).length(10),
    incidents: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: z.string().min(1),
            act: z.number().int().min(1).max(9),
          })
          .strict(),
      )
      .length(26),
  })
  .strict()
  .refine(
    (m) =>
      new Set(m.endingIds).size === 10 &&
      new Set(m.incidents.map((i) => i.id)).size === 26 &&
      new Set(m.incidents.map((i) => i.act)).size === 9,
    'Unique incident IDs and all nine Acts are required.',
  );

// Pure parser shared by the Node CLI and lazy Vite loader; no filesystem/storage I/O.
export function inspectProductionCampaignSources(
  sources: Readonly<Record<string, string>>,
  manifest: unknown,
): PackageResult {
  if (!Object.keys(sources).length)
    return { ok: false, diagnostics: ['FULL_CAMPAIGN_CONTENT_UNAVAILABLE'] };
  try {
    const approved = fullCampaignManifestSchema.parse(manifest);
    if (
      Object.keys(sources).some(
        (p) => !/\/(incidents|packages|definitions|presentations|ending-presentations)\//.test(p),
      )
    )
      return { ok: false, diagnostics: ['UNKNOWN_PRODUCTION_SOURCE'] };
    const incidents = Object.entries(sources)
      .filter(([p]) => p.includes('/incidents/'))
      .map(([file, source]) => ({ file, source }));
    const catalog = validateVersionedScenarioCatalog(incidents);
    if (!catalog.success) return { ok: false, diagnostics: catalog.diagnostics.map((d) => d.code) };
    const byFolder = (folder: string) =>
      Object.entries(sources)
        .filter(([p]) => p.includes('/' + folder + '/'))
        .map(([, source]) => parsePackageYaml(source));
    const packages = byFolder('packages'),
      definitions = byFolder('definitions'),
      presentations = byFolder('presentations'),
      endingPresentations = byFolder('ending-presentations');
    if (!packages.length || !definitions.length || !presentations.length)
      return { ok: false, diagnostics: ['INCOMPLETE_PRODUCTION_PACKAGE'] };
    for (const raw of definitions) {
      const checked = validateCampaignDefinition(raw, catalog.scenarios);
      if (
        !checked.ok ||
        checked.definition.replayVersion !== 2 ||
        !checked.definition.behavior ||
        !checked.definition.prediction ||
        !checked.definition.endings ||
        !checked.definition.opportunities ||
        checked.definition.incidents.length !== 26 ||
        checked.definition.acts.length !== 9
      )
        return { ok: false, diagnostics: ['INCOMPLETE_PRODUCTION_PACKAGE'] };
      const d = checked.definition;
      if (
        d.endings!.entries.length !== approved.endingIds.length ||
        d.endings!.entries.some((entry) => !approved.endingIds.includes(entry.id))
      )
        return { ok: false, diagnostics: ['PRODUCTION_ENDING_COVERAGE'] };
      if (
        !approved.incidents.every((i) => {
          const entry = d.incidents.find((x) => x.id === i.id);
          const scenario =
            entry && catalog.scenarios.get(entry.scenarioId + '@' + entry.contentVersion);
          return (
            entry?.scenarioId === i.id &&
            entry.act === i.act &&
            scenario?.title === i.title &&
            scenario.act === i.act
          );
        }) ||
        !d.acts.every((a) => a.id >= 1 && a.id <= 9)
      )
        return { ok: false, diagnostics: ['PRODUCTION_BLUEPRINT_MISMATCH'] };
    }
    // The full production route requires the new explicit prose binding. Generic
    // framework/older packages remain valid without this optional addition.
    if (
      !endingPresentations.length ||
      packages.some((raw) => {
        const parsed = campaignPackageSchema.safeParse(raw);
        return !parsed.success || !parsed.data.endingPresentation;
      })
    )
      return { ok: false, diagnostics: ['INCOMPLETE_ENDING_PRESENTATION_PACKAGE'] };
    return createCampaignPackageRegistry({
      packages,
      definitions,
      presentations,
      endingPresentations,
      scenarios: catalog.scenarios,
    });
  } catch {
    return { ok: false, diagnostics: ['INVALID_PRODUCTION_PACKAGE'] };
  }
}

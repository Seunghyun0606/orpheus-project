import { parsePackageYaml, type PackageResult } from './campaign-package.ts';
import { inspectProductionCampaignSources as inspectSources } from './production-catalog.ts';
import approvedManifestSource from './data/full-campaign-manifest.yaml?raw';

// Imported only after choosing Full campaign. No QA imports, storage or fallback.
export function loadProductionCampaignPackages(): PackageResult {
  return inspectProductionCampaignSources(
    import.meta.glob<string>('./data/full-campaign/**/*.{yaml,yml}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  );
}
// Injectable parser boundary for validation/tests; no storage or fixture fallback.
export function inspectProductionCampaignSources(
  sources: Readonly<Record<string, string>>,
): PackageResult {
  return inspectSources(sources, parsePackageYaml(approvedManifestSource));
}

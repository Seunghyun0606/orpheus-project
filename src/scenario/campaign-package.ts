import { z } from 'zod';
import { parseDocument } from 'yaml';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  validateCampaignDefinition,
  campaignContentVersions,
  type CampaignDefinition,
} from './campaign.ts';
import { scenarioVersionKey } from './catalog.ts';
import { idSchema, type Scenario } from './schema.ts';
import {
  investigationPresentationSchema,
  validateInvestigationPresentation,
  type InvestigationPresentation,
} from './presentation.ts';

const version = z.string().min(1);
export const campaignPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    version,
    definitionId: idSchema,
    definitionVersion: version,
    scenarios: z.array(z.object({ scenarioId: idSchema, contentVersion: version }).strict()).min(1),
    presentations: z
      .array(
        z.object({ id: idSchema, version, scenarioId: idSchema, contentVersion: version }).strict(),
      )
      .min(1),
  })
  .strict();
export type CampaignPackage = z.infer<typeof campaignPackageSchema>;
export interface ResolvedCampaignPackage {
  readonly package: CampaignPackage;
  readonly definition: CampaignDefinition;
  readonly catalog: ReadonlyMap<string, Scenario>;
  readonly presentations: readonly InvestigationPresentation[];
}
export interface CampaignPackageRegistry {
  all(): readonly ResolvedCampaignPackage[];
  resolve(definitionId: string, definitionVersion: string): ResolvedCampaignPackage | undefined;
}
export type PackageResult =
  { ok: true; registry: CampaignPackageRegistry } | { ok: false; diagnostics: string[] };
const key = (id: string, v: string) => JSON.stringify([id, v]);
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    for (const child of Object.values(v)) freeze(child);
    Object.freeze(v);
  }
  return v;
}
function copy(p: ResolvedCampaignPackage): ResolvedCampaignPackage {
  return {
    package: freeze(structuredClone(p.package)),
    definition: freeze(structuredClone(p.definition)),
    catalog: new Map([...p.catalog].map(([k, s]) => [k, freeze(structuredClone(s))])),
    presentations: freeze(structuredClone(p.presentations)),
  };
}
export function parsePackageYaml(source: string): unknown {
  const doc = parseDocument(source, { uniqueKeys: true });
  if (doc.errors.length) throw new Error('INVALID_PACKAGE_YAML');
  return doc.toJS();
}
export function createCampaignPackageRegistry(inputs: {
  packages: readonly unknown[];
  definitions: readonly unknown[];
  scenarios: ReadonlyMap<string, Scenario>;
  presentations: readonly unknown[];
}): PackageResult {
  const issues: string[] = [];
  try {
    canonicalJson([
      inputs.packages,
      inputs.definitions,
      [...inputs.scenarios],
      inputs.presentations,
    ]);
    const definitions = new Map<string, CampaignDefinition>();
    for (const raw of inputs.definitions) {
      const result = validateCampaignDefinition(raw, inputs.scenarios);
      if (!result.ok) {
        issues.push(...result.diagnostics.map((d) => d.code));
        continue;
      }
      const k = key(result.definition.id, result.definition.version);
      if (definitions.has(k)) issues.push('DUPLICATE_DEFINITION');
      definitions.set(k, result.definition);
    }
    const presentations = new Map<string, InvestigationPresentation>();
    for (const raw of inputs.presentations) {
      const result = investigationPresentationSchema.safeParse(raw);
      if (!result.success) {
        issues.push('INVALID_PRESENTATION_SCHEMA');
        continue;
      }
      const k = key(result.data.id, result.data.version);
      if (presentations.has(k)) issues.push('DUPLICATE_PRESENTATION');
      presentations.set(k, result.data);
    }
    const resolved = new Map<string, ResolvedCampaignPackage>();
    const packageIds = new Set<string>();
    for (const raw of inputs.packages) {
      const parsed = campaignPackageSchema.safeParse(raw);
      if (!parsed.success) {
        issues.push('INVALID_PACKAGE_SCHEMA');
        continue;
      }
      const p = parsed.data,
        k = key(p.definitionId, p.definitionVersion),
        id = key(p.id, p.version);
      if (resolved.has(k) || packageIds.has(id)) issues.push('DUPLICATE_PACKAGE_BINDING');
      packageIds.add(id);
      const d = definitions.get(k);
      if (!d) {
        issues.push('UNSUPPORTED_PACKAGE_DEFINITION');
        continue;
      }
      const expected = new Set(
        d.incidents.flatMap((i) =>
          campaignContentVersions(i).map((v) => scenarioVersionKey(i.scenarioId, v)),
        ),
      );
      const declared = p.scenarios.map((i) => scenarioVersionKey(i.scenarioId, i.contentVersion));
      const viewKeys = p.presentations.map((i) =>
        scenarioVersionKey(i.scenarioId, i.contentVersion),
      );
      if (
        new Set(declared).size !== declared.length ||
        declared.length !== expected.size ||
        declared.some((x) => !expected.has(x))
      )
        issues.push('PACKAGE_SCENARIO_COVERAGE');
      if (
        new Set(viewKeys).size !== viewKeys.length ||
        viewKeys.length !== expected.size ||
        viewKeys.some((x) => !expected.has(x))
      )
        issues.push('PACKAGE_PRESENTATION_COVERAGE');
      const catalog = new Map<string, Scenario>();
      const views: InvestigationPresentation[] = [];
      for (const binding of p.scenarios) {
        const k = scenarioVersionKey(binding.scenarioId, binding.contentVersion),
          s = inputs.scenarios.get(k);
        if (!s) issues.push('MISSING_PACKAGE_SCENARIO');
        else catalog.set(k, s);
      }
      for (const binding of p.presentations) {
        const view = presentations.get(key(binding.id, binding.version));
        const s = catalog.get(scenarioVersionKey(binding.scenarioId, binding.contentVersion));
        if (!view || !s) {
          issues.push('MISSING_PACKAGE_PRESENTATION');
          continue;
        }
        if (
          view.scenarioId !== binding.scenarioId ||
          view.contentVersion !== binding.contentVersion
        )
          issues.push('PRESENTATION_BINDING_MISMATCH');
        issues.push(...validateInvestigationPresentation(view, s, d));
        views.push(view);
      }
      resolved.set(k, copy({ package: p, definition: d, catalog, presentations: views }));
    }
    if (issues.length) return { ok: false, diagnostics: [...new Set(issues)].sort() };
    return {
      ok: true,
      registry: Object.freeze({
        all: () => [...resolved.values()].map(copy),
        resolve: (id: string, v: string) => {
          const p = resolved.get(key(id, v));
          return p && copy(p);
        },
      }),
    };
  } catch {
    return { ok: false, diagnostics: ['INVALID_PACKAGE_INPUT'] };
  }
}

import { inspectScenarioYaml } from './parser.ts';
import { diagnosticCodes, type ScenarioDiagnostic } from './validator.ts';
import type { Scenario } from './schema.ts';
import { deepFreeze } from '../engine/campaign/canonical.ts';

// Ordinal comparison keeps catalog order identical on every machine and locale.
const ordinal = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export interface ScenarioSource {
  file: string;
  source: string;
}

export type ScenarioCatalogResult =
  | { success: true; scenarios: ReadonlyMap<string, Scenario>; diagnostics: [] }
  | { success: false; diagnostics: ScenarioDiagnostic[] };

export type VersionedScenarioCatalogResult =
  | { success: true; scenarios: ReadonlyMap<string, Scenario>; diagnostics: [] }
  | { success: false; diagnostics: ScenarioDiagnostic[] };

export function scenarioVersionKey(id: string, version: string): string {
  return `${id}@${version}`;
}

export function validateVersionedScenarioCatalog(
  sources: readonly ScenarioSource[],
): VersionedScenarioCatalogResult {
  if (sources.length === 0) {
    return {
      success: false,
      diagnostics: [
        {
          file: '<catalog>',
          path: '$',
          code: diagnosticCodes.emptyCatalog,
          message: 'No scenario YAML files were found.',
        },
      ],
    };
  }

  const scenarios = new Map<string, Scenario>();
  const firstFileByKey = new Map<string, string>();
  const diagnostics: ScenarioDiagnostic[] = [];
  for (const { file, source } of [...sources].sort((a, b) => ordinal(a.file, b.file))) {
    const { result } = inspectScenarioYaml(source, file);
    if (!result.success) {
      diagnostics.push(...result.diagnostics);
      continue;
    }
    const key = scenarioVersionKey(result.scenario.id, result.scenario.contentVersion);
    const first = firstFileByKey.get(key);
    if (first !== undefined) {
      diagnostics.push({
        file,
        path: '$.contentVersion',
        code: diagnosticCodes.duplicateId,
        message: `Duplicate scenario version ${JSON.stringify(key)}; first declared in ${first}.`,
      });
      continue;
    }
    firstFileByKey.set(key, file);
    scenarios.set(key, deepFreeze(result.scenario));
  }
  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : { success: true, scenarios, diagnostics: [] };
}

export function validateScenarioCatalog(sources: readonly ScenarioSource[]): ScenarioCatalogResult {
  if (sources.length === 0) {
    return {
      success: false,
      diagnostics: [
        {
          file: '<catalog>',
          path: '$',
          code: diagnosticCodes.emptyCatalog,
          message: 'No scenario YAML files were found.',
        },
      ],
    };
  }

  const diagnostics: ScenarioDiagnostic[] = [];
  const scenarios = new Map<string, Scenario>();
  const firstFileById = new Map<string, string>();

  for (const { file, source } of [...sources].sort((left, right) =>
    ordinal(left.file, right.file),
  )) {
    const { id, result } = inspectScenarioYaml(source, file);
    const firstFile = id === undefined ? undefined : firstFileById.get(id);
    if (id !== undefined && firstFile === undefined) firstFileById.set(id, file);
    if (firstFile !== undefined) {
      diagnostics.push({
        file,
        path: '$.id',
        code: diagnosticCodes.duplicateId,
        message: `Duplicate scenario id ${JSON.stringify(id)}; first declared in ${firstFile}:$.id.`,
      });
    }

    if (!result.success) {
      diagnostics.push(...result.diagnostics);
      continue;
    }

    if (firstFile === undefined) scenarios.set(result.scenario.id, deepFreeze(result.scenario));
  }

  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : { success: true, scenarios, diagnostics: [] };
}

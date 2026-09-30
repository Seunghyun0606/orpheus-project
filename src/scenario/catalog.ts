import { parseScenarioYaml } from './parser.ts';
import { diagnosticCodes, type ScenarioDiagnostic } from './validator.ts';
import type { Scenario } from './schema.ts';

export interface ScenarioSource {
  file: string;
  source: string;
}

export type ScenarioCatalogResult =
  | { success: true; scenarios: ReadonlyMap<string, Scenario>; diagnostics: [] }
  | { success: false; diagnostics: ScenarioDiagnostic[] };

export function validateScenarioCatalog(sources: readonly ScenarioSource[]): ScenarioCatalogResult {
  const diagnostics: ScenarioDiagnostic[] = [];
  const scenarios = new Map<string, Scenario>();
  const firstFileById = new Map<string, string>();

  for (const { file, source } of [...sources].sort((left, right) =>
    left.file.localeCompare(right.file),
  )) {
    const result = parseScenarioYaml(source, file);
    if (!result.success) {
      diagnostics.push(...result.diagnostics);
      continue;
    }

    const firstFile = firstFileById.get(result.scenario.id);
    if (firstFile !== undefined) {
      diagnostics.push({
        file,
        path: '$.id',
        code: diagnosticCodes.duplicateId,
        message: `Duplicate scenario id ${JSON.stringify(result.scenario.id)}; first declared in ${firstFile}:$.id.`,
      });
      continue;
    }

    firstFileById.set(result.scenario.id, file);
    scenarios.set(result.scenario.id, result.scenario);
  }

  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : { success: true, scenarios, diagnostics: [] };
}

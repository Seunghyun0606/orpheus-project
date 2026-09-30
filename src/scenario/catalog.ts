import { inspectScenarioYaml } from './parser.ts';
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
    left.file.localeCompare(right.file),
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

    if (firstFile === undefined) scenarios.set(result.scenario.id, result.scenario);
  }

  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : { success: true, scenarios, diagnostics: [] };
}

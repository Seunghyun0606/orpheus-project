import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  validateScenarioCatalog,
  validateVersionedScenarioCatalog,
  type ScenarioSource,
} from './catalog.ts';
import type { ScenarioDiagnostic } from './validator.ts';
import { parsePackageYaml } from './campaign-package.ts';
import {
  fullCampaignManifestSchema,
  inspectProductionCampaignSources,
} from './production-catalog.ts';

const yamlExtensions = new Set(['.yaml', '.yml']);

async function collectYamlFiles(entry: string): Promise<string[]> {
  const details = await stat(entry);
  if (details.isFile()) return yamlExtensions.has(path.extname(entry).toLowerCase()) ? [entry] : [];
  if (!details.isDirectory()) return [];

  const children = await readdir(entry, { withFileTypes: true });
  const nested = await Promise.all(
    children
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((child) => collectYamlFiles(path.join(entry, child.name))),
  );
  return nested.flat();
}

function printDiagnostic(diagnostic: ScenarioDiagnostic): void {
  console.error(`${diagnostic.file}:${diagnostic.path} [${diagnostic.code}] ${diagnostic.message}`);
}

export async function runScenarioValidationCli(args: readonly string[]): Promise<number> {
  // Current content uses unique incident IDs; frozen content uses unique
  // incident ID and version pairs. Explicit paths retain the single-catalog rule.
  const groups = args.length > 0 ? [[...args]] : [['src/scenario/data'], ['src/scenario/legacy']];
  let fileCount = 0;
  let failed = false;
  for (const [groupIndex, entries] of groups.entries()) {
    const files: string[] = [];
    for (const entry of entries) {
      try {
        files.push(...(await collectYamlFiles(entry)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${entry}:$ [IO_ERROR] ${message}`);
        return 1;
      }
    }

    const sources: ScenarioSource[] = [];
    for (const file of files.sort()) {
      try {
        sources.push({ file, source: await readFile(file, 'utf8') });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${file}:$ [IO_ERROR] ${message}`);
        return 1;
      }
    }

    fileCount += files.length;
    let scenarioSources = sources;
    if (args.length === 0 && groupIndex === 0) {
      const normalized = sources.map((s) => ({ ...s, file: s.file.replaceAll('\\', '/') }));
      const manifest = normalized.find(
        (s) => s.file === 'src/scenario/data/full-campaign-manifest.yaml',
      );
      const production = normalized.filter((s) =>
        s.file.startsWith('src/scenario/data/full-campaign/'),
      );
      scenarioSources = normalized.filter((s) => s.file.startsWith('src/scenario/data/incidents/'));
      const recognized = scenarioSources.length + production.length + (manifest ? 1 : 0);
      if (recognized !== sources.length || !manifest) {
        console.error(
          'Campaign authoring validation failed: unknown data category or missing manifest.',
        );
        failed = true;
      } else {
        try {
          const parsed = fullCampaignManifestSchema.parse(parsePackageYaml(manifest.source));
          if (production.length) {
            const checked = inspectProductionCampaignSources(
              Object.fromEntries(production.map((s) => [s.file, s.source])),
              parsed,
            );
            if (!checked.ok) {
              console.error(
                `Campaign authoring validation failed: ${checked.diagnostics.join(', ')}`,
              );
              failed = true;
            }
          } else
            console.log(
              'Full campaign: no production package authored yet (unavailable, not certified).',
            );
        } catch {
          console.error('Campaign authoring validation failed: invalid full-campaign manifest.');
          failed = true;
        }
      }
    }
    const result =
      args.length === 0 && groupIndex === 1
        ? validateVersionedScenarioCatalog(scenarioSources)
        : validateScenarioCatalog(scenarioSources);
    if (!result.success) {
      result.diagnostics.forEach(printDiagnostic);
      failed = true;
    }
  }
  if (failed) {
    console.error(`Scenario validation failed: ${fileCount} file(s) checked.`);
    return 1;
  }

  console.log(`Scenario validation passed: ${fileCount} file(s).`);
  return 0;
}

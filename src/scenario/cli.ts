import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { validateScenarioCatalog, type ScenarioSource } from './catalog.ts';
import type { ScenarioDiagnostic } from './validator.ts';

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
  const entries = args.length > 0 ? [...args] : ['src/scenario/data'];
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

  if (files.length === 0) {
    console.log(`No scenario YAML files found under: ${entries.join(', ')}`);
    return 0;
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

  const result = validateScenarioCatalog(sources);
  if (!result.success) {
    result.diagnostics.forEach(printDiagnostic);
    console.error(`Scenario validation failed: ${files.length} file(s) checked.`);
    return 1;
  }

  console.log(`Scenario validation passed: ${files.length} file(s).`);
  return 0;
}

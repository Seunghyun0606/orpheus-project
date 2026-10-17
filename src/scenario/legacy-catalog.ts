import { parse } from 'yaml';
import { z } from 'zod';

import { scenarioVersionKey, validateVersionedScenarioCatalog } from './catalog.ts';
import migrationSource from './legacy-migrations.yaml?raw';
import type { Scenario } from './schema.ts';

// Frozen scenario versions are replay authorities for saves written before a
// compatible content migration. They are never offered as playable incidents.
const legacySources = import.meta.glob<string>('./legacy/*.{yaml,yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const result = validateVersionedScenarioCatalog(
  Object.entries(legacySources).map(([file, source]) => ({ file, source })),
);

if (!result.success) {
  const details = result.diagnostics
    .map(({ file, path, code, message }) => `${file}:${path} [${code}] ${message}`)
    .join('\n');
  throw new Error(`Legacy scenarios failed validation:\n${details}`);
}
const legacyScenarios = result.scenarios;

const migrationTargets: Readonly<Record<string, readonly string[]>> = z
  .record(z.string().min(1), z.array(z.string().min(1)).min(1))
  .parse(parse(migrationSource));

export function getLegacyScenarioForMigration(
  scenarioId: string,
  savedContentVersion: string,
  targetContentVersion: string,
): Scenario | undefined {
  if (!migrationTargets[scenarioId]?.includes(targetContentVersion)) return undefined;
  return legacyScenarios.get(scenarioVersionKey(scenarioId, savedContentVersion));
}

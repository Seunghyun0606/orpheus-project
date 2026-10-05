import { validateScenarioCatalog } from './catalog.ts';
import type { Scenario } from './schema.ts';

// Frozen scenario versions are replay authorities for saves written before a
// compatible content migration. They are never offered as playable incidents.
const legacySources = import.meta.glob<string>('./legacy/*.{yaml,yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const result = validateScenarioCatalog(
  Object.entries(legacySources).map(([file, source]) => ({ file, source })),
);

if (!result.success) {
  const details = result.diagnostics
    .map(({ file, path, code, message }) => `${file}:${path} [${code}] ${message}`)
    .join('\n');
  throw new Error(`Legacy scenarios failed validation:\n${details}`);
}
const legacyScenarios = result.scenarios;

const migrationTargets: Readonly<Record<string, string>> = {
  'INC-001': '1.1.0',
  'INC-002': '1.1.0',
  'INC-003': '1.1.0',
};

export function getLegacyScenarioForMigration(
  scenarioId: string,
  savedContentVersion: string,
  targetContentVersion: string,
): Scenario | undefined {
  if (migrationTargets[scenarioId] !== targetContentVersion) return undefined;
  const legacy = legacyScenarios.get(scenarioId);
  return legacy?.contentVersion === savedContentVersion ? legacy : undefined;
}

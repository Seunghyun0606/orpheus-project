import { validateScenarioCatalog } from './catalog.ts';
import type { Scenario } from './schema.ts';

const bundledSources = import.meta.glob<string>('./data/incidents/**/*.{yaml,yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const result = validateScenarioCatalog(
  Object.entries(bundledSources).map(([file, source]) => ({ file, source })),
);

if (!result.success) {
  const details = result.diagnostics
    .map(({ file, path, code, message }) => `${file}:${path} [${code}] ${message}`)
    .join('\n');
  throw new Error(`Bundled scenarios failed validation:\n${details}`);
}

export const scenarioCatalog: ReadonlyMap<string, Scenario> = result.scenarios;

export function getScenario(id: string): Scenario | undefined {
  return scenarioCatalog.get(id);
}

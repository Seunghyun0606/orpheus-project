import inc001Source from './data/incidents/inc-001.yaml?raw';
import { parseScenarioYaml } from './parser.ts';
import type { Scenario } from './schema.ts';

const inc001File = 'src/scenario/data/incidents/inc-001.yaml';

export function loadInc001Scenario(): Scenario {
  const result = parseScenarioYaml(inc001Source, inc001File);

  if (!result.success) {
    const details = result.diagnostics
      .map(({ path, code, message }) => `${path} [${code}] ${message}`)
      .join('\n');
    throw new Error(`INC-001 failed scenario validation:\n${details}`);
  }

  return result.scenario;
}

export const inc001Scenario = loadInc001Scenario();

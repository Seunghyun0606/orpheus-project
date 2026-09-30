import { getScenario } from './bundled-catalog.ts';
import type { Scenario } from './schema.ts';

export function loadInc001Scenario(): Scenario {
  const scenario = getScenario('INC-001');
  if (scenario === undefined) throw new Error('INC-001 is missing from the validated catalog.');
  return scenario;
}

export const inc001Scenario = loadInc001Scenario();

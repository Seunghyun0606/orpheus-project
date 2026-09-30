import { parseDocument } from 'yaml';

import { idSchema } from './schema.ts';
import {
  diagnosticCodes,
  validateScenarioObject,
  type ScenarioDiagnostic,
  type ScenarioValidationResult,
} from './validator.ts';

export interface ScenarioInspection {
  id?: string;
  result: ScenarioValidationResult;
}

export function inspectScenarioYaml(source: string, file = '<memory>'): ScenarioInspection {
  const document = parseDocument(source, { prettyErrors: false });
  if (document.errors.length > 0) {
    const diagnostics: ScenarioDiagnostic[] = document.errors.map((error) => ({
      file,
      path: '$',
      code: diagnosticCodes.yamlParse,
      message: error.message,
    }));
    return { result: { success: false, diagnostics } };
  }

  const value: unknown = document.toJS();
  const candidate =
    value !== null && typeof value === 'object' && !Array.isArray(value) && 'id' in value
      ? value.id
      : undefined;
  const parsedId = idSchema.safeParse(candidate);

  return {
    ...(parsedId.success ? { id: parsedId.data } : {}),
    result: validateScenarioObject(value, file),
  };
}

export function parseScenarioYaml(source: string, file = '<memory>'): ScenarioValidationResult {
  return inspectScenarioYaml(source, file).result;
}

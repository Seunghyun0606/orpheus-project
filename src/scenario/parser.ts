import { parseDocument } from 'yaml';

import {
  diagnosticCodes,
  validateScenarioObject,
  type ScenarioDiagnostic,
  type ScenarioValidationResult,
} from './validator.ts';

export function parseScenarioYaml(source: string, file = '<memory>'): ScenarioValidationResult {
  const document = parseDocument(source, { prettyErrors: false });
  if (document.errors.length > 0) {
    const diagnostics: ScenarioDiagnostic[] = document.errors.map((error) => ({
      file,
      path: '$',
      code: diagnosticCodes.yamlParse,
      message: error.message,
    }));
    return { success: false, diagnostics };
  }

  return validateScenarioObject(document.toJS(), file);
}

import type { ZodIssue } from 'zod';

import {
  scenarioSchema,
  type Scenario,
  type ScenarioCondition,
  type ScenarioEffect,
} from './schema.ts';

export const diagnosticCodes = {
  yamlParse: 'YAML_PARSE',
  schemaInvalid: 'SCHEMA_INVALID',
  unknownEffectType: 'UNKNOWN_EFFECT_TYPE',
  unknownEventType: 'UNKNOWN_EVENT_TYPE',
  duplicateId: 'DUPLICATE_ID',
  unknownReference: 'UNKNOWN_REFERENCE',
} as const;

export type DiagnosticCode = (typeof diagnosticCodes)[keyof typeof diagnosticCodes];

export interface ScenarioDiagnostic {
  file: string;
  path: string;
  code: DiagnosticCode;
  message: string;
}

export type ScenarioValidationResult =
  | { success: true; scenario: Scenario; diagnostics: [] }
  | { success: false; diagnostics: ScenarioDiagnostic[] };

export function formatDataPath(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === 'number') return `${path}[${segment}]`;
    const key = String(segment);
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;
  }, '$');
}

function structuralCode(issue: ZodIssue): DiagnosticCode {
  const path = issue.path.map(String);
  const last = path.at(-1);
  if (last === 'type' && path.includes('events')) return diagnosticCodes.unknownEventType;
  if (last === 'type' && path.some((segment) => ['effects', 'apply', 'expire'].includes(segment))) {
    return diagnosticCodes.unknownEffectType;
  }
  return diagnosticCodes.schemaInvalid;
}

function zodDiagnostics(file: string, issues: readonly ZodIssue[]): ScenarioDiagnostic[] {
  return issues.map((issue) => ({
    file,
    path: formatDataPath(issue.path),
    code: structuralCode(issue),
    message: issue.message,
  }));
}

function semanticDiagnostics(scenario: Scenario, file: string): ScenarioDiagnostic[] {
  const diagnostics: ScenarioDiagnostic[] = [];
  const services = new Set(scenario.services.map(({ id }) => id));
  const signals = new Set(scenario.initialState.signals.map(({ id }) => id));
  const resources = new Set(scenario.initialState.resources.map(({ id }) => id));
  const flags = new Set(scenario.initialState.flags.map(({ id }) => id));
  const actions = new Set(scenario.actions.map(({ id }) => id));
  const events = new Set(scenario.events.map(({ id }) => id));
  const evidence = new Set(scenario.evidence.map(({ id }) => id));
  const narratives = new Set(scenario.narratives.map(({ id }) => id));
  const mechanisms = new Set(scenario.incident.failureMechanisms.map(({ id }) => id));

  const addDuplicateDiagnostics = <T extends { id: string }>(
    values: readonly T[],
    basePath: string,
    namespace: string,
  ) => {
    const firstIndex = new Map<string, number>();
    values.forEach(({ id }, index) => {
      const prior = firstIndex.get(id);
      if (prior === undefined) {
        firstIndex.set(id, index);
        return;
      }
      diagnostics.push({
        file,
        path: `${basePath}[${index}].id`,
        code: diagnosticCodes.duplicateId,
        message: `Duplicate ${namespace} id ${JSON.stringify(id)}; first declared at ${basePath}[${prior}].id.`,
      });
    });
  };

  const requireReference = (
    path: string,
    id: string,
    known: ReadonlySet<string>,
    namespace: string,
  ) => {
    if (!known.has(id)) {
      diagnostics.push({
        file,
        path,
        code: diagnosticCodes.unknownReference,
        message: `Unknown ${namespace} reference ${JSON.stringify(id)}.`,
      });
    }
  };

  const validateCondition = (condition: ScenarioCondition, path: string) => {
    switch (condition.type) {
      case 'signal':
      case 'signal_revealed':
        requireReference(`${path}.signalId`, condition.signalId, signals, 'signal');
        break;
      case 'resource':
        requireReference(`${path}.resourceId`, condition.resourceId, resources, 'resource');
        break;
      case 'flag':
        requireReference(`${path}.flagId`, condition.flagId, flags, 'flag');
        break;
      case 'evidence':
        requireReference(`${path}.evidenceId`, condition.evidenceId, evidence, 'evidence');
        break;
      case 'action_completed':
        requireReference(`${path}.actionId`, condition.actionId, actions, 'action');
        break;
      case 'mechanism_resolved':
        requireReference(
          `${path}.mechanismId`,
          condition.mechanismId,
          mechanisms,
          'failure mechanism',
        );
        break;
    }
  };

  const validateEffect = (effect: ScenarioEffect, path: string) => {
    switch (effect.type) {
      case 'set_signal':
      case 'change_signal':
      case 'reveal_signal':
        requireReference(`${path}.signalId`, effect.signalId, signals, 'signal');
        break;
      case 'change_resource':
        requireReference(`${path}.resourceId`, effect.resourceId, resources, 'resource');
        break;
      case 'set_flag':
        requireReference(`${path}.flagId`, effect.flagId, flags, 'flag');
        break;
      case 'schedule_event':
      case 'cancel_event':
        requireReference(`${path}.eventId`, effect.eventId, events, 'event');
        break;
      case 'unlock_action':
        requireReference(`${path}.actionId`, effect.actionId, actions, 'action');
        break;
      case 'reveal_evidence':
        requireReference(`${path}.evidenceId`, effect.evidenceId, evidence, 'evidence');
        break;
      case 'trigger_narrative':
        requireReference(`${path}.narrativeId`, effect.narrativeId, narratives, 'narrative');
        break;
      case 'resolve_mechanism':
        requireReference(
          `${path}.mechanismId`,
          effect.mechanismId,
          mechanisms,
          'failure mechanism',
        );
        break;
    }
  };

  addDuplicateDiagnostics(scenario.services, '$.services', 'service');
  addDuplicateDiagnostics(scenario.initialState.signals, '$.initialState.signals', 'signal');
  addDuplicateDiagnostics(scenario.initialState.resources, '$.initialState.resources', 'resource');
  addDuplicateDiagnostics(scenario.initialState.flags, '$.initialState.flags', 'flag');
  addDuplicateDiagnostics(scenario.actions, '$.actions', 'action');
  addDuplicateDiagnostics(scenario.events, '$.events', 'event');
  addDuplicateDiagnostics(scenario.evidence, '$.evidence', 'evidence');
  addDuplicateDiagnostics(scenario.narratives, '$.narratives', 'narrative');

  const causalGroups = [
    ['contributingFactors', scenario.incident.contributingFactors],
    ['failureMechanisms', scenario.incident.failureMechanisms],
    ['symptoms', scenario.incident.symptoms],
    ['amplifiers', scenario.incident.amplifiers],
  ] as const;
  causalGroups.forEach(([name, values]) =>
    addDuplicateDiagnostics(values, `$.incident.${name}`, `incident ${name}`),
  );

  scenario.services.forEach((service, serviceIndex) => {
    service.dependsOn.forEach((dependencyId, dependencyIndex) =>
      requireReference(
        `$.services[${serviceIndex}].dependsOn[${dependencyIndex}]`,
        dependencyId,
        services,
        'service',
      ),
    );
  });
  scenario.initialState.signals.forEach((signal, index) => {
    if (signal.serviceId) {
      requireReference(
        `$.initialState.signals[${index}].serviceId`,
        signal.serviceId,
        services,
        'service',
      );
    }
  });

  scenario.actions.forEach((action, actionIndex) => {
    const base = `$.actions[${actionIndex}]`;
    action.requirements.forEach((condition, index) =>
      validateCondition(condition, `${base}.requirements[${index}]`),
    );
    action.costs.forEach((cost, index) =>
      requireReference(
        `${base}.costs[${index}].resourceId`,
        cost.resourceId,
        resources,
        'resource',
      ),
    );
    action.effects.forEach((effect, index) => validateEffect(effect, `${base}.effects[${index}]`));
    addDuplicateDiagnostics(
      action.temporaryEffects,
      `${base}.temporaryEffects`,
      'temporary effect',
    );
    action.temporaryEffects.forEach((temporary, temporaryIndex) => {
      temporary.apply.forEach((effect, effectIndex) =>
        validateEffect(effect, `${base}.temporaryEffects[${temporaryIndex}].apply[${effectIndex}]`),
      );
      temporary.expire.forEach((effect, effectIndex) =>
        validateEffect(
          effect,
          `${base}.temporaryEffects[${temporaryIndex}].expire[${effectIndex}]`,
        ),
      );
    });
  });

  scenario.events.forEach((event, eventIndex) => {
    const base = `$.events[${eventIndex}]`;
    if (event.targetServiceId) {
      requireReference(`${base}.targetServiceId`, event.targetServiceId, services, 'service');
    }
    const conditions = event.type === 'timer' ? event.cancellationConditions : event.conditions;
    const conditionKey = event.type === 'timer' ? 'cancellationConditions' : 'conditions';
    conditions.forEach((condition, index) =>
      validateCondition(condition, `${base}.${conditionKey}[${index}]`),
    );
    event.effects.forEach((effect, index) => validateEffect(effect, `${base}.effects[${index}]`));
  });

  scenario.evidence.forEach((item, index) => {
    if (item.sourceNarrativeId) {
      requireReference(
        `$.evidence[${index}].sourceNarrativeId`,
        item.sourceNarrativeId,
        narratives,
        'narrative',
      );
    }
  });
  scenario.narratives.forEach((narrative, narrativeIndex) => {
    const base = `$.narratives[${narrativeIndex}]`;
    narrative.conditions.forEach((condition, index) =>
      validateCondition(condition, `${base}.conditions[${index}]`),
    );
    narrative.effects.forEach((effect, index) =>
      validateEffect(effect, `${base}.effects[${index}]`),
    );
  });

  (['resolution', 'completion'] as const).forEach((key) => {
    scenario[key].conditions.forEach((condition, index) =>
      validateCondition(condition, `$.${key}.conditions[${index}]`),
    );
    scenario[key].effects.forEach((effect, index) =>
      validateEffect(effect, `$.${key}.effects[${index}]`),
    );
  });

  addDuplicateDiagnostics(
    scenario.postmortem.scoringInputs,
    '$.postmortem.scoringInputs',
    'postmortem scoring input',
  );
  scenario.postmortem.scoringInputs.forEach((input, index) => {
    if (input.refId === undefined) return;
    const path = `$.postmortem.scoringInputs[${index}].refId`;
    if (input.source === 'signal') requireReference(path, input.refId, signals, 'signal');
    if (input.source === 'resource') requireReference(path, input.refId, resources, 'resource');
    if (input.source === 'action_count') requireReference(path, input.refId, actions, 'action');
  });

  return diagnostics;
}

export function validateScenarioObject(
  input: unknown,
  file = '<memory>',
): ScenarioValidationResult {
  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, diagnostics: zodDiagnostics(file, parsed.error.issues) };
  }

  const diagnostics = semanticDiagnostics(parsed.data, file);
  return diagnostics.length === 0
    ? { success: true, scenario: parsed.data, diagnostics: [] }
    : { success: false, diagnostics };
}

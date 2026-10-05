import type { ZodIssue } from 'zod';

import {
  scenarioSchema,
  type Scenario,
  type ScenarioCondition,
  type ScenarioEffect,
} from './schema.ts';

export const diagnosticCodes = {
  emptyCatalog: 'EMPTY_CATALOG',
  yamlParse: 'YAML_PARSE',
  schemaInvalid: 'SCHEMA_INVALID',
  unknownEffectType: 'UNKNOWN_EFFECT_TYPE',
  unknownEventType: 'UNKNOWN_EVENT_TYPE',
  invalidEventTargetType: 'INVALID_EVENT_TARGET_TYPE',
  invalidDelegation: 'INVALID_DELEGATION',
  duplicateId: 'DUPLICATE_ID',
  unknownReference: 'UNKNOWN_REFERENCE',
  invalidNarrativeSource: 'INVALID_NARRATIVE_SOURCE',
  prohibitedMvpReveal: 'PROHIBITED_MVP_REVEAL',
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
  const timerEvents = new Set(
    scenario.events.filter(({ type }) => type === 'timer').map(({ id }) => id),
  );
  const evidence = new Set(scenario.evidence.map(({ id }) => id));
  const narratives = new Set(scenario.narratives.map(({ id }) => id));
  const mechanisms = new Set(scenario.incident.failureMechanisms.map(({ id }) => id));
  const roles = new Set(scenario.warRoom.roles.map(({ id }) => id));
  const messages = new Set(scenario.warRoom.messages.map(({ id }) => id));
  const delegatedEventIds = new Set<string>();

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
        if (events.has(effect.eventId) && !timerEvents.has(effect.eventId)) {
          diagnostics.push({
            file,
            path: `${path}.eventId`,
            code: diagnosticCodes.invalidEventTargetType,
            message: `${effect.type} requires a timer event; ${JSON.stringify(effect.eventId)} is conditional.`,
          });
        }
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
      case 'post_message':
        requireReference(`${path}.messageId`, effect.messageId, messages, 'War Room message');
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
  addDuplicateDiagnostics(scenario.warRoom.roles, '$.warRoom.roles', 'War Room role');
  addDuplicateDiagnostics(scenario.warRoom.messages, '$.warRoom.messages', 'War Room message');
  scenario.warRoom.messages.forEach((message, index) =>
    requireReference(`$.warRoom.messages[${index}].roleId`, message.roleId, roles, 'War Room role'),
  );

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
    if (action.category === 'DELEGATE' && action.delegation === undefined) {
      diagnostics.push({
        file,
        path: `${base}.delegation`,
        code: diagnosticCodes.invalidDelegation,
        message: 'A DELEGATE action requires delegation metadata.',
      });
    }
    if (action.delegation !== undefined) {
      const { roleId, eventId, capacityResourceId } = action.delegation;
      if (delegatedEventIds.has(eventId)) {
        diagnostics.push({
          file,
          path: `${base}.delegation.eventId`,
          code: diagnosticCodes.invalidDelegation,
          message: `Timer ${JSON.stringify(eventId)} is already assigned to another delegation.`,
        });
      }
      delegatedEventIds.add(eventId);
      requireReference(`${base}.delegation.roleId`, roleId, roles, 'War Room role');
      requireReference(`${base}.delegation.eventId`, eventId, timerEvents, 'timer event');
      requireReference(
        `${base}.delegation.capacityResourceId`,
        capacityResourceId,
        resources,
        'resource',
      );
      const timer = scenario.events.find(
        (event): event is Extract<Scenario['events'][number], { type: 'timer' }> =>
          event.id === eventId && event.type === 'timer',
      );
      const capacity = scenario.initialState.resources.find(
        (resource) => resource.id === capacityResourceId,
      );
      const capacityCosts = action.costs.filter((cost) => cost.resourceId === capacityResourceId);
      const capacityRestores = timer?.effects.filter(
        (effect) => effect.type === 'change_resource' && effect.resourceId === capacityResourceId,
      );
      const valid =
        action.category === 'DELEGATE' &&
        action.effects.some(
          (effect) => effect.type === 'schedule_event' && effect.eventId === eventId,
        ) &&
        capacity?.min === 0 &&
        capacity.value >= 1 &&
        (capacity.max === undefined || capacity.value <= capacity.max) &&
        capacityCosts.length === 1 &&
        capacityCosts[0]?.amount === -1 &&
        !action.effects.some(
          (effect) => effect.type === 'change_resource' && effect.resourceId === capacityResourceId,
        ) &&
        !action.temporaryEffects.some((temporary) =>
          [...temporary.apply, ...temporary.expire].some(
            (effect) =>
              effect.type === 'change_resource' && effect.resourceId === capacityResourceId,
          ),
        ) &&
        action.requirements.some(
          (condition) =>
            condition.type === 'resource' &&
            condition.resourceId === capacityResourceId &&
            condition.operator === 'gte' &&
            condition.value >= 1,
        ) &&
        timer !== undefined &&
        timer.delaySeconds > action.durationSeconds &&
        timer.cancellationConditions.length === 0 &&
        capacityRestores?.length === 1 &&
        capacityRestores[0]?.type === 'change_resource' &&
        capacityRestores[0].amount === 1 &&
        !timer.effects.some((effect) => effect.type === 'trigger_narrative');
      if (!valid) {
        diagnostics.push({
          file,
          path: `${base}.delegation`,
          code: diagnosticCodes.invalidDelegation,
          message:
            'Delegation requires a DELEGATE action, capacity >= 1, a -1 capacity cost, and a non-cancellable timer after action completion that restores +1 capacity.',
        });
      }
    }
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
      const source = scenario.narratives.find(({ id }) => id === item.sourceNarrativeId);
      if (
        source !== undefined &&
        !source.effects.some(
          (effect) => effect.type === 'reveal_evidence' && effect.evidenceId === item.id,
        )
      ) {
        diagnostics.push({
          file,
          path: `$.evidence[${index}].sourceNarrativeId`,
          code: diagnosticCodes.invalidNarrativeSource,
          message: `Narrative ${JSON.stringify(item.sourceNarrativeId)} does not reveal evidence ${JSON.stringify(item.id)}.`,
        });
      }
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

  if (scenario.act === 1) {
    const prohibited =
      /\b(?:NULL(?:_\d+)?|ORPHEUS|PRODUCTION EXPERIMENT|SOFT CONTROL|THE BOARD)\b/i;
    const copy: readonly { path: string; text: string }[] = [
      { path: '$.title', text: scenario.title },
      ...scenario.services.map((item, index) => ({
        path: `$.services[${index}].name`,
        text: item.name,
      })),
      ...scenario.initialState.signals.flatMap((item, index) =>
        typeof item.value === 'string'
          ? [{ path: `$.initialState.signals[${index}].value`, text: item.value }]
          : [],
      ),
      ...[
        ['contributingFactors', scenario.incident.contributingFactors],
        ['failureMechanisms', scenario.incident.failureMechanisms],
        ['symptoms', scenario.incident.symptoms],
        ['amplifiers', scenario.incident.amplifiers],
      ].flatMap(([name, items]) =>
        (items as Scenario['incident']['symptoms']).flatMap((item, index) => [
          { path: `$.incident.${name}[${index}].label`, text: item.label },
          ...(item.description === undefined
            ? []
            : [{ path: `$.incident.${name}[${index}].description`, text: item.description }]),
        ]),
      ),
      { path: '$.incident.trigger.label', text: scenario.incident.trigger.label },
      ...(scenario.incident.trigger.description === undefined
        ? []
        : [
            { path: '$.incident.trigger.description', text: scenario.incident.trigger.description },
          ]),
      ...scenario.actions.map((item, index) => ({
        path: `$.actions[${index}].title`,
        text: item.title,
      })),
      ...scenario.evidence.flatMap((item, index) => [
        { path: `$.evidence[${index}].title`, text: item.title },
        { path: `$.evidence[${index}].description`, text: item.description },
      ]),
      ...scenario.narratives.flatMap((item, index) => [
        { path: `$.narratives[${index}].title`, text: item.title },
        { path: `$.narratives[${index}].body`, text: item.body },
      ]),
      ...scenario.warRoom.messages.map((item, index) => ({
        path: `$.warRoom.messages[${index}].text`,
        text: item.text,
      })),
      ...scenario.postmortem.scoringInputs.map((item, index) => ({
        path: `$.postmortem.scoringInputs[${index}].label`,
        text: item.label,
      })),
    ];
    for (const { path, text } of copy) {
      if (prohibited.test(text)) {
        diagnostics.push({
          file,
          path,
          code: diagnosticCodes.prohibitedMvpReveal,
          message: 'Act 1 narrative content discloses a later-campaign reveal.',
        });
      }
    }
  }

  const allEffects: ScenarioEffect[] = [
    ...scenario.actions.flatMap((action) => [
      ...action.effects,
      ...action.temporaryEffects.flatMap((temporary) => [...temporary.apply, ...temporary.expire]),
    ]),
    ...scenario.events.flatMap((event) => event.effects),
    ...scenario.narratives.flatMap((narrative) => narrative.effects),
    ...scenario.resolution.effects,
    ...scenario.completion.effects,
  ];
  for (const eventId of delegatedEventIds) {
    if (
      allEffects.filter((effect) => effect.type === 'schedule_event' && effect.eventId === eventId)
        .length !== 1
    ) {
      diagnostics.push({
        file,
        path: '$.events',
        code: diagnosticCodes.invalidDelegation,
        message: `Delegation timer ${JSON.stringify(eventId)} must be scheduled by exactly one effect.`,
      });
    }
    if (allEffects.some((effect) => effect.type === 'cancel_event' && effect.eventId === eventId)) {
      diagnostics.push({
        file,
        path: '$.events',
        code: diagnosticCodes.invalidDelegation,
        message: `Delegation timer ${JSON.stringify(eventId)} cannot be cancelled because capacity must be restored.`,
      });
    }
  }

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

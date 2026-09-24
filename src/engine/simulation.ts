import type {
  Scenario,
  ScenarioCondition,
  ScenarioEffect,
  ScenarioEvent,
} from '../scenario/index.ts';
import { actionDrivenClock } from './clock.ts';
import { createSeededRngState, seededRng } from './rng.ts';
import type {
  CommandFailure,
  CommandResult,
  CreateIncidentOptions,
  EngineCommand,
  EngineDependencies,
  EngineEvent,
  EngineEventType,
  IncidentState,
  ReplayResult,
  ScalarValue,
  ScheduledWork,
} from './types.ts';

export const defaultEngineDependencies: EngineDependencies = {
  clock: actionDrivenClock,
  rng: seededRng,
};

const scheduledWorkPriority: Record<ScheduledWork['kind'], number> = {
  temporary_expiration: 0,
  timer_event: 1,
};

function includes(items: readonly string[], id: string): boolean {
  return items.includes(id);
}

function addUnique(items: string[], id: string): boolean {
  if (items.includes(id)) return false;
  items.push(id);
  return true;
}

function remove(items: string[], id: string): void {
  const index = items.indexOf(id);
  if (index >= 0) items.splice(index, 1);
}

function cloneCommand(command: EngineCommand): EngineCommand {
  return {
    type: 'perform_action',
    actionId: command.actionId,
    ...(command.targetId === undefined ? {} : { targetId: command.targetId }),
    ...(command.input === undefined
      ? {}
      : {
          input: Object.fromEntries(
            Object.entries(command.input).sort(([a], [b]) => a.localeCompare(b)),
          ),
        }),
  };
}

export function cloneIncidentState(state: IncidentState): IncidentState {
  return {
    ...state,
    rng: { ...state.rng },
    signals: Object.fromEntries(
      Object.entries(state.signals).map(([id, signal]) => [id, { ...signal }]),
    ),
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([id, resource]) => [id, { ...resource }]),
    ),
    flags: { ...state.flags },
    unlockedActionIds: [...state.unlockedActionIds],
    completedActionIds: [...state.completedActionIds],
    actionHistory: [...state.actionHistory],
    revealedEvidenceIds: [...state.revealedEvidenceIds],
    triggeredNarrativeIds: [...state.triggeredNarrativeIds],
    resolvedMechanismIds: [...state.resolvedMechanismIds],
    firedOnceEventIds: [...state.firedOnceEventIds],
    latchedConditionalEventIds: [...state.latchedConditionalEventIds],
    scheduledWork: state.scheduledWork.map((work) =>
      work.kind === 'temporary_expiration'
        ? { ...work, effects: work.effects.map((effect) => ({ ...effect })) }
        : { ...work },
    ),
    replayLog: state.replayLog.map((entry) => ({
      sequence: entry.sequence,
      command: cloneCommand(entry.command),
    })),
    eventLog: state.eventLog.map((event) => ({ ...event })),
  };
}

function emit(
  state: IncidentState,
  type: EngineEventType,
  details: Omit<EngineEvent, 'sequence' | 'type' | 'atSeconds'> = {},
): EngineEvent {
  const event: EngineEvent = {
    sequence: state.nextEventSequence++,
    type,
    atSeconds: state.elapsedSeconds,
    ...details,
  };
  state.eventLog.push(event);
  return event;
}

function compareScalar(left: ScalarValue, operator: string, right: ScalarValue): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' && left >= right;
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' && left <= right;
    default:
      return false;
  }
}

export function evaluateCondition(state: IncidentState, condition: ScenarioCondition): boolean {
  switch (condition.type) {
    case 'signal': {
      const signal = state.signals[condition.signalId];
      return (
        signal !== undefined && compareScalar(signal.value, condition.operator, condition.value)
      );
    }
    case 'resource': {
      const resource = state.resources[condition.resourceId];
      return (
        resource !== undefined && compareScalar(resource.value, condition.operator, condition.value)
      );
    }
    case 'flag':
      return state.flags[condition.flagId] === condition.value;
    case 'signal_revealed':
      return state.signals[condition.signalId]?.revealed === true;
    case 'evidence':
      return includes(state.revealedEvidenceIds, condition.evidenceId);
    case 'action_completed':
      return includes(state.completedActionIds, condition.actionId);
    case 'mechanism_resolved':
      return includes(state.resolvedMechanismIds, condition.mechanismId);
  }
}

function conditionsMet(state: IncidentState, conditions: readonly ScenarioCondition[]): boolean {
  return conditions.every((condition) => evaluateCondition(state, condition));
}

function conditionGroupMet(
  state: IncidentState,
  group: Scenario['resolution'] | Scenario['completion'],
): boolean {
  return group.mode === 'any'
    ? group.conditions.some((condition) => evaluateCondition(state, condition))
    : conditionsMet(state, group.conditions);
}

function resourceBounds(scenario: Scenario, resourceId: string): { min?: number; max?: number } {
  const definition = scenario.initialState.resources.find((resource) => resource.id === resourceId);
  return definition === undefined ? {} : { min: definition.min, max: definition.max };
}

function clampResource(scenario: Scenario, resourceId: string, value: number): number {
  const { min, max } = resourceBounds(scenario, resourceId);
  return Math.min(
    max ?? Number.POSITIVE_INFINITY,
    Math.max(min ?? Number.NEGATIVE_INFINITY, value),
  );
}

function scheduleTimerEvent(state: IncidentState, scenario: Scenario, eventId: string): void {
  const definition = scenario.events.find(
    (event): event is Extract<ScenarioEvent, { type: 'timer' }> =>
      event.id === eventId && event.type === 'timer',
  );
  if (definition === undefined) return;

  const dueAtSeconds = state.elapsedSeconds + definition.delaySeconds;
  state.scheduledWork.push({
    kind: 'timer_event',
    dueAtSeconds,
    scheduleSequence: state.nextScheduleSequence++,
    eventId,
  });
  emit(state, 'event_scheduled', { sourceId: eventId, dueAtSeconds });
}

function triggerNarrative(state: IncidentState, scenario: Scenario, narrativeId: string): void {
  if (!addUnique(state.triggeredNarrativeIds, narrativeId)) return;
  emit(state, 'narrative_triggered', { sourceId: narrativeId });
  const narrative = scenario.narratives.find((candidate) => candidate.id === narrativeId);
  if (narrative !== undefined) applyEffects(state, scenario, narrative.effects, narrativeId);
}

function applyEffects(
  state: IncidentState,
  scenario: Scenario,
  effects: readonly ScenarioEffect[],
  sourceId: string,
): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'set_signal': {
        const signal = state.signals[effect.signalId];
        if (signal === undefined) break;
        const previousValue = signal.value;
        signal.value = effect.value;
        emit(state, 'signal_changed', {
          sourceId,
          targetId: effect.signalId,
          previousValue,
          value: signal.value,
        });
        break;
      }
      case 'change_signal': {
        const signal = state.signals[effect.signalId];
        if (signal === undefined || typeof signal.value !== 'number') break;
        const previousValue = signal.value;
        signal.value += effect.amount;
        emit(state, 'signal_changed', {
          sourceId,
          targetId: effect.signalId,
          previousValue,
          value: signal.value,
        });
        break;
      }
      case 'change_resource': {
        const resource = state.resources[effect.resourceId];
        if (resource === undefined) break;
        const previousValue = resource.value;
        resource.value = clampResource(scenario, effect.resourceId, resource.value + effect.amount);
        emit(state, 'resource_changed', {
          sourceId,
          targetId: effect.resourceId,
          previousValue,
          value: resource.value,
        });
        break;
      }
      case 'set_flag': {
        const previousValue = state.flags[effect.flagId];
        state.flags[effect.flagId] = effect.value;
        emit(state, 'flag_changed', {
          sourceId,
          targetId: effect.flagId,
          previousValue,
          value: effect.value,
        });
        break;
      }
      case 'schedule_event':
        scheduleTimerEvent(state, scenario, effect.eventId);
        break;
      case 'cancel_event': {
        const before = state.scheduledWork.length;
        state.scheduledWork = state.scheduledWork.filter(
          (work) => work.kind !== 'timer_event' || work.eventId !== effect.eventId,
        );
        if (state.scheduledWork.length !== before) {
          emit(state, 'event_cancelled', { sourceId, targetId: effect.eventId });
        }
        break;
      }
      case 'reveal_signal': {
        const signal = state.signals[effect.signalId];
        if (signal !== undefined && !signal.revealed) {
          signal.revealed = true;
          emit(state, 'signal_revealed', { sourceId, targetId: effect.signalId });
        }
        break;
      }
      case 'unlock_action':
        if (addUnique(state.unlockedActionIds, effect.actionId)) {
          emit(state, 'action_unlocked', { sourceId, targetId: effect.actionId });
        }
        break;
      case 'reveal_evidence':
        if (addUnique(state.revealedEvidenceIds, effect.evidenceId)) {
          emit(state, 'evidence_revealed', { sourceId, targetId: effect.evidenceId });
        }
        break;
      case 'trigger_narrative':
        triggerNarrative(state, scenario, effect.narrativeId);
        break;
      case 'resolve_mechanism':
        if (addUnique(state.resolvedMechanismIds, effect.mechanismId)) {
          emit(state, 'mechanism_resolved', { sourceId, targetId: effect.mechanismId });
        }
        break;
    }
  }
}

function updateMilestones(state: IncidentState, scenario: Scenario): void {
  if (!state.resolutionReached && conditionGroupMet(state, scenario.resolution)) {
    state.resolutionReached = true;
    applyEffects(state, scenario, scenario.resolution.effects, 'resolution');
    emit(state, 'resolution_reached', { sourceId: scenario.id });
  }
  if (!state.completionReached && conditionGroupMet(state, scenario.completion)) {
    state.completionReached = true;
    applyEffects(state, scenario, scenario.completion.effects, 'completion');
    emit(state, 'completion_reached', { sourceId: scenario.id });
  }
}

function settleReactiveRules(state: IncidentState, scenario: Scenario): void {
  let firedRule = true;
  let passes = 0;
  const maximumPasses = Math.max(16, (scenario.events.length + scenario.narratives.length) * 4);

  while (firedRule) {
    if (passes++ > maximumPasses) {
      throw new Error('Reactive scenario rules did not reach a stable state.');
    }
    firedRule = false;

    for (const event of scenario.events) {
      if (event.type !== 'conditional') continue;
      const met = conditionsMet(state, event.conditions);
      if (!met) {
        remove(state.latchedConditionalEventIds, event.id);
        continue;
      }
      if (event.once && includes(state.firedOnceEventIds, event.id)) continue;
      if (!event.once && includes(state.latchedConditionalEventIds, event.id)) continue;

      if (event.once) addUnique(state.firedOnceEventIds, event.id);
      else addUnique(state.latchedConditionalEventIds, event.id);
      emit(state, 'event_fired', { sourceId: event.id, targetId: event.targetServiceId });
      applyEffects(state, scenario, event.effects, event.id);
      firedRule = true;
    }

    for (const narrative of scenario.narratives) {
      if (
        narrative.conditions.length > 0 &&
        !includes(state.triggeredNarrativeIds, narrative.id) &&
        conditionsMet(state, narrative.conditions)
      ) {
        triggerNarrative(state, scenario, narrative.id);
        firedRule = true;
      }
    }

    const before = state.eventLog.length;
    updateMilestones(state, scenario);
    if (state.eventLog.length !== before) firedRule = true;
  }
}

function sortScheduledWork(work: ScheduledWork[]): void {
  work.sort(
    (left, right) =>
      left.dueAtSeconds - right.dueAtSeconds ||
      scheduledWorkPriority[left.kind] - scheduledWorkPriority[right.kind] ||
      left.scheduleSequence - right.scheduleSequence,
  );
}

function runScheduledWork(state: IncidentState, scenario: Scenario, endSeconds: number): void {
  sortScheduledWork(state.scheduledWork);
  while (state.scheduledWork.length > 0 && state.scheduledWork[0]!.dueAtSeconds <= endSeconds) {
    const work = state.scheduledWork.shift();
    if (work === undefined) break;
    state.elapsedSeconds = work.dueAtSeconds;

    if (work.kind === 'temporary_expiration') {
      emit(state, 'temporary_effect_expired', {
        sourceId: work.actionId,
        targetId: work.temporaryEffectId,
      });
      applyEffects(state, scenario, work.effects, work.temporaryEffectId);
    } else {
      const event = scenario.events.find(
        (candidate): candidate is Extract<ScenarioEvent, { type: 'timer' }> =>
          candidate.id === work.eventId && candidate.type === 'timer',
      );
      if (event === undefined) continue;
      if (
        event.cancellationConditions.length > 0 &&
        conditionsMet(state, event.cancellationConditions)
      ) {
        emit(state, 'event_cancelled', { sourceId: event.id });
      } else {
        emit(state, 'event_fired', { sourceId: event.id, targetId: event.targetServiceId });
        applyEffects(state, scenario, event.effects, event.id);
      }
    }
    settleReactiveRules(state, scenario);
    sortScheduledWork(state.scheduledWork);
  }
}

function advanceTime(
  state: IncidentState,
  scenario: Scenario,
  durationSeconds: number,
  dependencies: EngineDependencies,
): void {
  const start = state.elapsedSeconds;
  const end = dependencies.clock.advance(start, durationSeconds);
  runScheduledWork(state, scenario, end);
  state.elapsedSeconds = end;
  emit(state, 'time_advanced', { previousValue: start, value: end });
  settleReactiveRules(state, scenario);
}

export function createIncidentState(
  scenario: Scenario,
  options: CreateIncidentOptions,
): IncidentState {
  const initial = options.initialState ?? scenario.initialState;
  const state: IncidentState = {
    scenarioId: scenario.id,
    contentVersion: scenario.contentVersion,
    elapsedSeconds: 0,
    rng: createSeededRngState(options.seed),
    signals: Object.fromEntries(
      initial.signals.map((signal) => [
        signal.id,
        { value: signal.value, revealed: signal.revealed ?? false },
      ]),
    ),
    resources: Object.fromEntries(
      initial.resources.map((resource) => [resource.id, { value: resource.value }]),
    ),
    flags: Object.fromEntries((initial.flags ?? []).map((flag) => [flag.id, flag.value])),
    unlockedActionIds: scenario.actions
      .filter((action) => action.initiallyAvailable)
      .map((action) => action.id),
    completedActionIds: [],
    actionHistory: [],
    revealedEvidenceIds: [],
    triggeredNarrativeIds: [],
    resolvedMechanismIds: [],
    firedOnceEventIds: [],
    latchedConditionalEventIds: [],
    scheduledWork: [],
    resolutionReached: false,
    completionReached: false,
    replayLog: [],
    eventLog: [],
    nextEventSequence: 0,
    nextScheduleSequence: 0,
  };
  settleReactiveRules(state, scenario);
  return state;
}

export function getUnmetActionRequirements(
  state: IncidentState,
  scenario: Scenario,
  actionId: string,
): readonly ScenarioCondition[] {
  const action = scenario.actions.find((candidate) => candidate.id === actionId);
  return action?.requirements.filter((condition) => !evaluateCondition(state, condition)) ?? [];
}

export function getAvailableActionIds(state: IncidentState, scenario: Scenario): readonly string[] {
  return scenario.actions
    .filter(
      (action) =>
        includes(state.unlockedActionIds, action.id) &&
        getUnmetActionRequirements(state, scenario, action.id).length === 0,
    )
    .map((action) => action.id);
}

function failure(
  state: IncidentState,
  code: CommandFailure['code'],
  message: string,
  unmetRequirements?: readonly ScenarioCondition[],
): CommandFailure {
  return {
    ok: false,
    state,
    events: [],
    code,
    message,
    ...(unmetRequirements === undefined ? {} : { unmetRequirements }),
  };
}

export function executeCommand(
  state: IncidentState,
  scenario: Scenario,
  command: EngineCommand,
  dependencies: EngineDependencies = defaultEngineDependencies,
): CommandResult {
  if (state.scenarioId !== scenario.id || state.contentVersion !== scenario.contentVersion) {
    return failure(state, 'SCENARIO_MISMATCH', 'State and scenario identity do not match.');
  }

  const action = scenario.actions.find((candidate) => candidate.id === command.actionId);
  if (action === undefined) {
    return failure(state, 'ACTION_NOT_FOUND', `Action ${command.actionId} does not exist.`);
  }
  if (!includes(state.unlockedActionIds, action.id)) {
    return failure(state, 'ACTION_LOCKED', `Action ${command.actionId} is locked.`);
  }
  const unmetRequirements = getUnmetActionRequirements(state, scenario, action.id);
  if (unmetRequirements.length > 0) {
    return failure(
      state,
      'ACTION_REQUIREMENTS_UNMET',
      `Action ${command.actionId} has unmet requirements.`,
      unmetRequirements,
    );
  }

  const next = cloneIncidentState(state);
  const firstEventIndex = next.eventLog.length;
  emit(next, 'action_started', { sourceId: action.id, targetId: command.targetId });

  for (const cost of action.costs) {
    applyEffects(
      next,
      scenario,
      [{ type: 'change_resource', resourceId: cost.resourceId, amount: cost.amount }],
      action.id,
    );
  }
  applyEffects(next, scenario, action.effects, action.id);

  for (const temporary of action.temporaryEffects) {
    emit(next, 'temporary_effect_started', {
      sourceId: action.id,
      targetId: temporary.id,
      dueAtSeconds: next.elapsedSeconds + temporary.durationSeconds,
    });
    applyEffects(next, scenario, temporary.apply, temporary.id);
    next.scheduledWork.push({
      kind: 'temporary_expiration',
      dueAtSeconds: next.elapsedSeconds + temporary.durationSeconds,
      scheduleSequence: next.nextScheduleSequence++,
      actionId: action.id,
      temporaryEffectId: temporary.id,
      effects: temporary.expire.map((effect) => ({ ...effect })),
    });
  }

  settleReactiveRules(next, scenario);
  advanceTime(next, scenario, action.durationSeconds, dependencies);

  next.actionHistory.push(action.id);
  addUnique(next.completedActionIds, action.id);
  emit(next, 'action_completed', { sourceId: action.id, targetId: command.targetId });
  settleReactiveRules(next, scenario);
  next.replayLog.push({ sequence: next.replayLog.length, command: cloneCommand(command) });

  return { ok: true, state: next, events: next.eventLog.slice(firstEventIndex) };
}

export function replayCommands(
  scenario: Scenario,
  options: CreateIncidentOptions,
  commands: readonly EngineCommand[],
  dependencies: EngineDependencies = defaultEngineDependencies,
): ReplayResult {
  let state = createIncidentState(scenario, options);
  const initialEventCount = state.eventLog.length;

  for (let index = 0; index < commands.length; index += 1) {
    const result = executeCommand(state, scenario, commands[index]!, dependencies);
    if (!result.ok) {
      return {
        ok: false,
        state,
        events: state.eventLog.slice(initialEventCount),
        commandIndex: index,
        error: result,
      };
    }
    state = result.state;
  }

  return { ok: true, state, events: state.eventLog.slice(initialEventCount) };
}

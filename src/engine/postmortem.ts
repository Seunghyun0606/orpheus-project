import type { Scenario } from '../scenario/index.ts';
import type { IncidentState, ScalarValue } from './types.ts';

type ScoringInput = Scenario['postmortem']['scoringInputs'][number];
type Action = Scenario['actions'][number];

export interface PostmortemMetric {
  readonly id: string;
  readonly label: string;
  readonly source: ScoringInput['source'];
  readonly refId?: string;
  readonly value: ScalarValue;
}

export interface PostmortemAction {
  readonly sequence: number;
  readonly id: string;
  readonly title: string;
  readonly category: Action['category'];
  readonly durationSeconds: number;
}

export interface PostmortemMechanism {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly resolved: boolean;
}

export interface PostmortemSignalChange {
  readonly signalId: string;
  readonly previousValue?: ScalarValue;
  readonly value?: ScalarValue;
}

export interface PostmortemResourceChange {
  readonly resourceId: string;
  readonly previousValue?: ScalarValue;
  readonly value?: ScalarValue;
}

export interface PostmortemIntervention {
  readonly id: string;
  readonly title: string;
  readonly count: number;
  readonly durationSeconds: number;
  readonly signalChanges: readonly PostmortemSignalChange[];
  readonly resourceChanges: readonly PostmortemResourceChange[];
}

export interface PostmortemTemporaryEffect {
  readonly actionId: string;
  readonly actionTitle: string;
  readonly effectId: string;
  readonly startedAtSeconds: number;
  readonly dueAtSeconds?: number;
  readonly expiredAtSeconds?: number;
}

export interface PostmortemReport {
  readonly scenarioId: string;
  readonly scenarioTitle: string;
  readonly elapsedSeconds: number;
  readonly metrics: readonly PostmortemMetric[];
  readonly actions: readonly PostmortemAction[];
  readonly mechanisms: readonly PostmortemMechanism[];
  readonly nonResolvingInterventions: readonly PostmortemIntervention[];
  readonly temporaryEffects: readonly PostmortemTemporaryEffect[];
  readonly firedEventIds: readonly string[];
  readonly communicationActions: readonly PostmortemAction[];
}

function requireRef(input: ScoringInput): string {
  if (input.refId === undefined) {
    throw new Error(`Postmortem input ${input.id} has no reference.`);
  }
  return input.refId;
}

function resolveMetric(input: ScoringInput, state: IncidentState): PostmortemMetric {
  let value: ScalarValue;
  switch (input.source) {
    case 'elapsed_time':
      value = state.elapsedSeconds;
      break;
    case 'signal': {
      const refId = requireRef(input);
      const signal = state.signals[refId];
      if (signal === undefined) throw new Error(`Postmortem signal ${refId} is unavailable.`);
      value = signal.value;
      break;
    }
    case 'resource': {
      const refId = requireRef(input);
      const resource = state.resources[refId];
      if (resource === undefined) throw new Error(`Postmortem resource ${refId} is unavailable.`);
      value = resource.value;
      break;
    }
    case 'action_count': {
      const refId = requireRef(input);
      value = state.actionHistory.filter((actionId) => actionId === refId).length;
      break;
    }
  }
  return {
    id: input.id,
    label: input.label,
    source: input.source,
    ...(input.refId === undefined ? {} : { refId: input.refId }),
    value,
  };
}

function requireAction(scenario: Scenario, actionId: string): Action {
  const action = scenario.actions.find(({ id }) => id === actionId);
  if (action === undefined) throw new Error(`Postmortem action ${actionId} is unavailable.`);
  return action;
}

export function computePostmortem(scenario: Scenario, state: IncidentState): PostmortemReport {
  if (state.scenarioId !== scenario.id || state.contentVersion !== scenario.contentVersion) {
    throw new Error('Postmortem state and scenario do not match.');
  }
  if (!state.completionReached) throw new Error('Postmortem requires a completed incident.');

  const actions = state.actionHistory.map((id, sequence): PostmortemAction => {
    const action = requireAction(scenario, id);
    return {
      sequence,
      id,
      title: action.title,
      category: action.category,
      durationSeconds: action.durationSeconds,
    };
  });
  const mechanismResolutionSources = new Set(
    state.eventLog
      .filter(({ type }) => type === 'mechanism_resolved')
      .map(({ sourceId }) => sourceId),
  );
  const nonResolvingInterventions = scenario.actions
    .filter(
      ({ id, category }) =>
        (category === 'MITIGATE' || category === 'MODIFY') &&
        !mechanismResolutionSources.has(id) &&
        state.actionHistory.includes(id),
    )
    .map((action): PostmortemIntervention => {
      const effectSources = new Set([action.id, ...action.temporaryEffects.map(({ id }) => id)]);
      return {
        id: action.id,
        title: action.title,
        count: state.actionHistory.filter((id) => id === action.id).length,
        durationSeconds: action.durationSeconds,
        signalChanges: state.eventLog
          .filter(
            ({ type, sourceId }) => type === 'signal_changed' && effectSources.has(sourceId ?? ''),
          )
          .map(({ targetId, previousValue, value }) => ({
            signalId: targetId ?? '',
            ...(previousValue === undefined ? {} : { previousValue }),
            ...(value === undefined ? {} : { value }),
          })),
        resourceChanges: state.eventLog
          .filter(
            ({ type, sourceId }) =>
              type === 'resource_changed' && effectSources.has(sourceId ?? ''),
          )
          .map(({ targetId, previousValue, value }) => ({
            resourceId: targetId ?? '',
            ...(previousValue === undefined ? {} : { previousValue }),
            ...(value === undefined ? {} : { value }),
          })),
      };
    });

  const temporaryEffects: {
    actionId: string;
    actionTitle: string;
    effectId: string;
    startedAtSeconds: number;
    dueAtSeconds?: number;
    expiredAtSeconds?: number;
  }[] = [];
  for (const event of state.eventLog) {
    if (event.type === 'temporary_effect_started' && event.sourceId && event.targetId) {
      temporaryEffects.push({
        actionId: event.sourceId,
        actionTitle: requireAction(scenario, event.sourceId).title,
        effectId: event.targetId,
        startedAtSeconds: event.atSeconds,
        ...(event.dueAtSeconds === undefined ? {} : { dueAtSeconds: event.dueAtSeconds }),
      });
    }
    if (event.type === 'temporary_effect_expired' && event.sourceId && event.targetId) {
      const pending = temporaryEffects.find(
        ({ actionId, effectId, expiredAtSeconds }) =>
          actionId === event.sourceId &&
          effectId === event.targetId &&
          expiredAtSeconds === undefined,
      );
      if (pending !== undefined) pending.expiredAtSeconds = event.atSeconds;
    }
  }

  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    elapsedSeconds: state.elapsedSeconds,
    metrics: scenario.postmortem.scoringInputs.map((input) => resolveMetric(input, state)),
    actions,
    mechanisms: scenario.incident.failureMechanisms.map(({ id, label, description }) => ({
      id,
      label,
      ...(description === undefined ? {} : { description }),
      resolved: state.resolvedMechanismIds.includes(id),
    })),
    nonResolvingInterventions,
    temporaryEffects,
    firedEventIds: state.eventLog
      .filter(({ type, sourceId }) => type === 'event_fired' && sourceId !== undefined)
      .map(({ sourceId }) => sourceId!),
    communicationActions: actions.filter(({ category }) => category === 'COMMUNICATE'),
  };
}

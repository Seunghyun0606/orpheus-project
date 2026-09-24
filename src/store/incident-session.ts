import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  createIncidentState,
  executeCommand,
  getAvailableActionIds,
  type CommandResult,
  type IncidentState,
  type ScalarValue,
} from '../engine/index.ts';
import type { Scenario, ScenarioCondition } from '../scenario/index.ts';

export interface IncidentSessionError {
  readonly code: Extract<CommandResult, { ok: false }>['code'];
  readonly message: string;
  readonly unmetRequirements?: readonly ScenarioCondition[];
}

export interface IncidentSessionState {
  readonly scenario: Scenario;
  readonly seed: number;
  readonly incident: IncidentState;
  readonly lastError: IncidentSessionError | null;
  readonly performAction: (actionId: string) => CommandResult;
  readonly restart: (seed?: number) => void;
}

export interface AvailableActionView {
  readonly id: string;
  readonly title: string;
  readonly category: Scenario['actions'][number]['category'];
  readonly durationSeconds: number;
  readonly requirements: readonly ScenarioCondition[];
}

export interface RevealedSignalView {
  readonly id: string;
  readonly value: ScalarValue;
  readonly serviceId?: string;
}

function toSessionError(result: Extract<CommandResult, { ok: false }>): IncidentSessionError {
  return {
    code: result.code,
    message: result.message,
    ...(result.unmetRequirements === undefined
      ? {}
      : { unmetRequirements: result.unmetRequirements }),
  };
}

export function createIncidentSessionStore(
  scenario: Scenario,
  initialSeed: number,
): StoreApi<IncidentSessionState> {
  return createStore<IncidentSessionState>((set, get) => ({
    scenario,
    seed: initialSeed,
    incident: createIncidentState(scenario, { seed: initialSeed }),
    lastError: null,
    performAction: (actionId) => {
      const current = get();
      const result = executeCommand(current.incident, current.scenario, {
        type: 'perform_action',
        actionId,
      });

      if (result.ok) {
        set({ incident: result.state, lastError: null });
      } else {
        set({ lastError: toSessionError(result) });
      }

      return result;
    },
    restart: (seed = get().seed) => {
      set({
        seed,
        incident: createIncidentState(get().scenario, { seed }),
        lastError: null,
      });
    },
  }));
}

export function selectAvailableActions(
  state: IncidentSessionState,
): readonly AvailableActionView[] {
  const available = new Set(getAvailableActionIds(state.incident, state.scenario));

  return state.scenario.actions
    .filter(({ id }) => available.has(id))
    .map(({ id, title, category, durationSeconds, requirements }) => ({
      id,
      title,
      category,
      durationSeconds,
      requirements,
    }));
}

export function selectRevealedSignals(state: IncidentSessionState): readonly RevealedSignalView[] {
  return state.scenario.initialState.signals.flatMap(({ id, serviceId }) => {
    const signal = state.incident.signals[id];
    if (signal?.revealed !== true) return [];

    return [
      {
        id,
        value: signal.value,
        ...(serviceId === undefined ? {} : { serviceId }),
      },
    ];
  });
}

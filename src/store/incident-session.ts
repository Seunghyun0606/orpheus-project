import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  createIncidentState,
  executeCommand,
  getAvailableActionIds,
  type CommandResult,
  type IncidentState,
  type ScalarValue,
} from '../engine/index.ts';
import {
  CAMPAIGN_PROGRESS_KEY,
  createLocalSaveStorage,
  decodeCampaignProgress,
  decodeSave,
  encodeCampaignProgress,
  encodeSave,
  type CampaignProgress,
  type SaveErrorCode,
  type SaveResult,
  type SaveStorage,
} from '../persistence/index.ts';
import type { Scenario, ScenarioCondition } from '../scenario/index.ts';

export interface IncidentSessionError {
  readonly code: Extract<CommandResult, { ok: false }>['code'];
  readonly message: string;
  readonly unmetRequirements?: readonly ScenarioCondition[];
}

export interface IncidentPersistenceError {
  readonly code: SaveErrorCode;
  readonly message: string;
}

export interface IncidentSessionState {
  readonly scenario: Scenario;
  readonly seed: number;
  readonly incident: IncidentState;
  readonly lastError: IncidentSessionError | null;
  readonly persistenceError: IncidentPersistenceError | null;
  readonly persistenceNotice: string | null;
  readonly campaignProgress: CampaignProgress;
  readonly campaignProgressError: IncidentPersistenceError | null;
  readonly performAction: (actionId: string) => CommandResult;
  readonly save: () => SaveResult<void>;
  readonly load: () => SaveResult<void>;
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

export interface WarRoomMessageView {
  readonly sequence: number;
  readonly atSeconds: number;
  readonly sender: string;
  readonly text: string;
}

export interface PendingDelegationView {
  readonly scheduleSequence: number;
  readonly role: string;
  readonly title: string;
  readonly dueAtSeconds: number;
}

export interface WarRoomView {
  readonly messages: readonly WarRoomMessageView[];
  readonly pending: readonly PendingDelegationView[];
  readonly capacity: readonly { resourceId: string; current: number; max?: number }[];
}

export interface CampaignEvidenceView {
  readonly scenarioId: string;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly sourceNarrativeId?: string;
}

export interface CampaignNarrativeView {
  readonly scenarioId: string;
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface CampaignProgressOptions {
  readonly storage: SaveStorage;
  readonly catalog: ReadonlyMap<string, Scenario>;
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
  storage: SaveStorage = createLocalSaveStorage(),
  progressOptions?: CampaignProgressOptions,
): StoreApi<IncidentSessionState> {
  let initialProgress: CampaignProgress = new Map();
  let initialProgressError: IncidentPersistenceError | null = null;
  if (progressOptions !== undefined) {
    try {
      const raw = progressOptions.storage.read();
      if (raw !== null) {
        const decoded = decodeCampaignProgress(raw, progressOptions.catalog);
        if (decoded.ok) initialProgress = decoded.value;
        else initialProgressError = { code: decoded.code, message: decoded.message };
      }
    } catch {
      initialProgressError = {
        code: 'STORAGE_ERROR',
        message: `Local storage could not read ${CAMPAIGN_PROGRESS_KEY}.`,
      };
    }
  }

  const archive = (
    previous: IncidentSessionState,
    incident: IncidentState,
    forceWrite = false,
  ): Pick<IncidentSessionState, 'campaignProgress' | 'campaignProgressError'> => {
    if (
      progressOptions === undefined ||
      (previous.campaignProgressError !== null &&
        previous.campaignProgressError.code !== 'STORAGE_ERROR')
    ) {
      return {
        campaignProgress: previous.campaignProgress,
        campaignProgressError: previous.campaignProgressError,
      };
    }
    const snapshots = previous.campaignProgress.get(scenario.id) ?? [];
    const discoveredEvidence = new Set(
      snapshots.flatMap(({ incident: saved }) => saved.revealedEvidenceIds),
    );
    const triggeredNarratives = new Set(
      snapshots.flatMap(({ incident: saved }) => saved.triggeredNarrativeIds),
    );
    const novel =
      incident.revealedEvidenceIds.some((id) => !discoveredEvidence.has(id)) ||
      incident.triggeredNarrativeIds.some((id) => !triggeredNarratives.has(id));
    if (!novel && !forceWrite) {
      return {
        campaignProgress: previous.campaignProgress,
        campaignProgressError: previous.campaignProgressError,
      };
    }
    const next = new Map(previous.campaignProgress);
    if (novel) next.set(scenario.id, [...snapshots, { scenario, seed: previous.seed, incident }]);
    try {
      progressOptions.storage.write(encodeCampaignProgress(next));
      return { campaignProgress: next, campaignProgressError: null };
    } catch {
      return {
        campaignProgress: next,
        campaignProgressError: {
          code: 'STORAGE_ERROR',
          message: 'Local storage could not save campaign discoveries.',
        },
      };
    }
  };

  return createStore<IncidentSessionState>((set, get) => ({
    scenario,
    seed: initialSeed,
    incident: createIncidentState(scenario, { seed: initialSeed }),
    lastError: null,
    persistenceError: null,
    persistenceNotice: null,
    campaignProgress: initialProgress,
    campaignProgressError: initialProgressError,
    performAction: (actionId) => {
      const current = get();
      const result = executeCommand(current.incident, current.scenario, {
        type: 'perform_action',
        actionId,
      });

      if (result.ok) {
        set({
          incident: result.state,
          lastError: null,
          persistenceNotice: null,
          ...archive(current, result.state),
        });
      } else {
        set({ lastError: toSessionError(result) });
      }

      return result;
    },
    save: () => {
      const current = get();
      try {
        storage.write(encodeSave(current.scenario, current.seed, current.incident));
      } catch {
        const error = {
          code: 'STORAGE_ERROR',
          message: 'Local storage could not save the session.',
        } as const;
        set({ persistenceError: error, persistenceNotice: null });
        return { ok: false, ...error };
      }
      set({
        persistenceError: null,
        persistenceNotice: 'Session saved locally.',
        ...archive(current, current.incident, true),
      });
      return { ok: true, value: undefined };
    },
    load: () => {
      let raw: string | null;
      try {
        raw = storage.read();
      } catch {
        const error = {
          code: 'STORAGE_ERROR',
          message: 'Local storage could not read the session.',
        } as const;
        set({ persistenceError: error, persistenceNotice: null });
        return { ok: false, ...error };
      }
      if (raw === null) {
        const error = { code: 'SAVE_NOT_FOUND', message: 'No saved session was found.' } as const;
        set({ persistenceError: error, persistenceNotice: null });
        return { ok: false, ...error };
      }
      const restored = decodeSave(raw, get().scenario);
      if (!restored.ok) {
        set({
          persistenceError: { code: restored.code, message: restored.message },
          persistenceNotice: null,
        });
        return restored;
      }
      set({
        seed: restored.value.seed,
        incident: restored.value.incident,
        lastError: null,
        persistenceError: null,
        persistenceNotice:
          restored.value.migratedFromContentVersion === undefined
            ? 'Saved session restored.'
            : `Saved session restored from content ${restored.value.migratedFromContentVersion}. Save again to keep the updated version.`,
        ...archive({ ...get(), seed: restored.value.seed }, restored.value.incident),
      });
      return { ok: true, value: undefined };
    },
    restart: (seed = get().seed) => {
      set({
        seed,
        incident: createIncidentState(get().scenario, { seed }),
        lastError: null,
        persistenceError: null,
        persistenceNotice: null,
      });
    },
  }));
}

function campaignSnapshots(
  state: IncidentSessionState,
): readonly { scenario: Scenario; incident: IncidentState }[] {
  return [
    ...[...state.campaignProgress.values()].flat(),
    { scenario: state.scenario, incident: state.incident },
  ];
}

export function selectCampaignEvidence(
  state: IncidentSessionState,
): readonly CampaignEvidenceView[] {
  const found = new Map<string, CampaignEvidenceView>();
  for (const { scenario, incident } of campaignSnapshots(state)) {
    for (const event of incident.eventLog) {
      if (event.type !== 'evidence_revealed' || event.targetId === undefined) continue;
      const item = scenario.evidence.find(({ id }) => id === event.targetId);
      if (item === undefined) continue;
      const key = `${scenario.id}:${item.id}`;
      if (!found.has(key)) found.set(key, { scenarioId: scenario.id, ...item });
    }
  }
  return [...found.values()];
}

export function selectCampaignNarratives(
  state: IncidentSessionState,
): readonly CampaignNarrativeView[] {
  const found = new Map<string, CampaignNarrativeView>();
  for (const { scenario, incident } of campaignSnapshots(state)) {
    for (const event of incident.eventLog) {
      if (event.type !== 'narrative_triggered' || event.sourceId === undefined) continue;
      const item = scenario.narratives.find(({ id }) => id === event.sourceId);
      if (item === undefined) continue;
      const key = `${scenario.id}:${item.id}`;
      if (!found.has(key)) found.set(key, { scenarioId: scenario.id, ...item });
    }
  }
  return [...found.values()];
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

export function selectWarRoom(
  state: Pick<IncidentSessionState, 'scenario' | 'incident'>,
): WarRoomView {
  const { scenario, incident } = state;
  const roleName = (id: string) =>
    scenario.warRoom.roles.find((role) => role.id === id)?.name ?? id;
  const messages: WarRoomMessageView[] = scenario.warRoom.messages
    .filter((message) => message.initial)
    .map((message, index) => ({
      sequence: -scenario.warRoom.messages.length + index,
      atSeconds: 0,
      sender: roleName(message.roleId),
      text: message.text,
    }));
  for (const event of incident.eventLog) {
    if (event.type !== 'war_room_message') continue;
    const message = scenario.warRoom.messages.find((item) => item.id === event.targetId);
    if (message === undefined) continue;
    messages.push({
      sequence: event.sequence,
      atSeconds: event.atSeconds,
      sender: roleName(message.roleId),
      text: message.text,
    });
  }

  const pending = incident.scheduledWork.flatMap((work) => {
    if (work.kind !== 'timer_event') return [];
    const action = scenario.actions.find((item) => item.delegation?.eventId === work.eventId);
    if (action?.delegation === undefined) return [];
    return [
      {
        scheduleSequence: work.scheduleSequence,
        role: roleName(action.delegation.roleId),
        title: action.title,
        dueAtSeconds: work.dueAtSeconds,
      },
    ];
  });

  const capacity = [
    ...new Set(
      scenario.actions.flatMap((action) =>
        action.delegation === undefined ? [] : [action.delegation.capacityResourceId],
      ),
    ),
  ].map((resourceId) => ({
    resourceId,
    current: incident.resources[resourceId]?.value ?? 0,
    max: scenario.initialState.resources.find((resource) => resource.id === resourceId)?.max,
  }));
  return { messages, pending, capacity };
}

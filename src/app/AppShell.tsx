import { useEffect, useRef, useState } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import {
  CAMPAIGN_PROGRESS_KEY,
  createLocalSaveStorage,
  decodeCampaignProgress,
  inspectSavedSlot,
  type CampaignProgress,
  type SavedSlot,
  type SaveStorage,
} from '../persistence/index.ts';
import { scenarioCatalog, type Scenario } from '../scenario/index.ts';
import {
  createIncidentSessionStore,
  type IncidentSessionState,
} from '../store/incident-session.ts';
import { App } from './App.tsx';

export interface AppShellProps {
  readonly catalog?: ReadonlyMap<string, Scenario>;
  readonly incidentStorage?: SaveStorage;
  readonly progressStorage?: SaveStorage;
}

interface DeskSnapshot {
  readonly progress: CampaignProgress;
  readonly savedSlot: SavedSlot | null;
  readonly errors: readonly string[];
}

function readDesk(
  catalog: ReadonlyMap<string, Scenario>,
  incidentStorage: SaveStorage,
  progressStorage: SaveStorage,
): DeskSnapshot {
  const errors: string[] = [];
  let progress: CampaignProgress = new Map();
  let savedSlot: SavedSlot | null = null;
  try {
    const raw = progressStorage.read();
    if (raw !== null) {
      const decoded = decodeCampaignProgress(raw, catalog);
      if (decoded.ok) progress = decoded.value;
      else errors.push(`Campaign progress: ${decoded.message}`);
    }
  } catch {
    errors.push('Campaign progress could not be read from local storage.');
  }
  try {
    const raw = incidentStorage.read();
    if (raw !== null) {
      const inspected = inspectSavedSlot(raw, catalog);
      if (inspected.ok) savedSlot = inspected.value;
      else errors.push(`Saved incident: ${inspected.message}`);
    }
  } catch {
    errors.push('The saved incident could not be read from local storage.');
  }
  return { progress, savedSlot, errors };
}

export function AppShell({
  catalog = scenarioCatalog,
  incidentStorage,
  progressStorage,
}: AppShellProps) {
  const incidentStorageRef = useRef(incidentStorage ?? createLocalSaveStorage());
  const progressStorageRef = useRef(
    progressStorage ?? createLocalSaveStorage(CAMPAIGN_PROGRESS_KEY),
  );
  const storesRef = useRef(new Map<string, StoreApi<IncidentSessionState>>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStore, setActiveStore] = useState<StoreApi<IncidentSessionState> | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [desk, setDesk] = useState(() =>
    readDesk(catalog, incidentStorageRef.current, progressStorageRef.current),
  );
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const deskHeadingRef = useRef<HTMLHeadingElement>(null);
  const scenarios = [...catalog.values()].sort((left, right) => left.id.localeCompare(right.id));
  const savedSlot = desk.savedSlot;

  useEffect(() => {
    if (activeId === null) deskHeadingRef.current?.focus();
  }, [activeId]);

  const getStore = (scenario: Scenario): StoreApi<IncidentSessionState> => {
    const existing = storesRef.current.get(scenario.id);
    if (existing !== undefined) return existing;
    const index = scenarios.findIndex(({ id }) => id === scenario.id);
    const store = createIncidentSessionStore(scenario, 1001 + index, incidentStorageRef.current, {
      storage: progressStorageRef.current,
      catalog,
    });
    storesRef.current.set(scenario.id, store);
    return store;
  };

  const open = (scenario: Scenario, mode: 'continue' | 'restart' | 'review' | 'saved') => {
    const store =
      mode === 'review'
        ? createIncidentSessionStore(scenario, 1001, incidentStorageRef.current, {
            storage: progressStorageRef.current,
            catalog,
          })
        : getStore(scenario);
    const refreshed = store.getState().refreshCampaignProgress();
    if (!refreshed.ok && mode === 'review') {
      setInteractionError(refreshed.message);
      return;
    }
    if (mode === 'restart') store.getState().restart();
    if (mode === 'review') {
      const restored = store.getState().restoreArchivedIncident();
      if (!restored.ok) {
        setInteractionError(restored.message);
        return;
      }
    }
    if (mode === 'saved') {
      const restored = store.getState().load();
      if (!restored.ok) {
        setInteractionError(restored.message);
        return;
      }
    }
    setInteractionError(refreshed.ok ? null : `Campaign progress: ${refreshed.message}`);
    setActiveStore(store);
    setReviewOnly(mode === 'review');
    setActiveId(scenario.id);
  };

  if (activeId !== null && activeStore !== null) {
    return (
      <App
        key={activeId}
        store={activeStore}
        reviewOnly={reviewOnly}
        onBackToDesk={() => {
          setDesk(readDesk(catalog, incidentStorageRef.current, progressStorageRef.current));
          setActiveStore(null);
          setActiveId(null);
        }}
      />
    );
  }

  return (
    <main className="incident-hub">
      <header>
        <p className="eyebrow">VANTAGE SYSTEMS // INCIDENT DESK</p>
        <h1 ref={deskHeadingRef} tabIndex={-1}>
          The Orpheus Project
        </h1>
        <p>Find the root cause. Choose an incident to investigate or revisit a response record.</p>
      </header>
      {interactionError && <p role="alert">{interactionError}</p>}
      {desk.errors.map((error) => (
        <p key={error} role="alert">
          {error}
        </p>
      ))}
      {savedSlot && (
        <section aria-labelledby="saved-session-title" className="panel incident-hub-saved">
          <h2 id="saved-session-title">Single local save slot</h2>
          <p>
            {savedSlot.scenario.id} / {savedSlot.scenario.title}
          </p>
          <button onClick={() => open(savedSlot.scenario, 'saved')} type="button">
            Resume saved {savedSlot.scenario.id}
          </button>
        </section>
      )}
      <section aria-labelledby="incident-list-title">
        <h2 id="incident-list-title">Available incidents</h2>
        <div className="incident-hub-grid">
          {scenarios.map((scenario) => {
            const completed = (desk.progress.get(scenario.id) ?? []).some(
              ({ incident }) => incident.completionReached,
            );
            const local = storesRef.current.get(scenario.id)?.getState().incident;
            const inProgress =
              local !== undefined && local.replayLog.length > 0 && !local.completionReached;
            return (
              <article className="panel incident-hub-card" key={scenario.id}>
                <span>
                  {scenario.severity} / {scenario.id}
                </span>
                <h3>{scenario.title}</h3>
                <p>
                  {completed
                    ? inProgress
                      ? 'Response in progress in this session; completed record available'
                      : 'Completed record available'
                    : inProgress
                      ? 'Response in progress in this session'
                      : 'Ready for response'}
                </p>
                {inProgress && (
                  <button onClick={() => open(scenario, 'continue')} type="button">
                    Continue {scenario.id}
                  </button>
                )}
                {completed && (
                  <button onClick={() => open(scenario, 'review')} type="button">
                    Review {scenario.id}
                  </button>
                )}
                <button onClick={() => open(scenario, 'restart')} type="button">
                  {completed || inProgress ? `Restart ${scenario.id}` : `Start ${scenario.id}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

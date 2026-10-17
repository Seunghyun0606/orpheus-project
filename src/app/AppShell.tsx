import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import type { CampaignSessionState } from '../store/campaign-session.ts';
import type { CampaignPackageLoader } from './FullCampaignEntry.tsx';
import { PresentationProvider, PresentationSettings } from './PresentationSettings.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { restoreFocus } from './focus.ts';
import { readBriefingDismissed, saveBriefingDismissed } from './briefing.ts';

// The campaign console is a separate, lazily loaded chunk: the training
// rotation never downloads or evaluates campaign code until it is opened.
const FullCampaignEntry = lazy(async () => ({
  default: (await import('./FullCampaignEntry.tsx')).FullCampaignEntry,
}));
const CampaignDesk = lazy(async () => ({
  default: (await import('./CampaignDesk.tsx')).CampaignDesk,
}));

export interface AppShellProps {
  readonly catalog?: ReadonlyMap<string, Scenario>;
  readonly incidentStorage?: SaveStorage;
  readonly progressStorage?: SaveStorage;
  readonly campaign?: { store: StoreApi<CampaignSessionState>; seed: number };
  readonly fullCampaignLoader?: CampaignPackageLoader;
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

function LoadingScreen() {
  return (
    <main className="incident-hub">
      <p role="status">Opening the campaign console…</p>
    </main>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <PresentationProvider>
      <Desk {...props} />
    </PresentationProvider>
  );
}

function ShiftBriefing({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="panel shift-briefing" aria-labelledby="shift-briefing-title">
      <p className="eyebrow">FIRST SHIFT // READ ME</p>
      <h2 id="shift-briefing-title">How a shift works</h2>
      <ol>
        <li>
          <strong>The pager goes off.</strong> A service is failing and customers are feeling it.
        </li>
        <li>
          <strong>Investigate.</strong> Open logs, metrics and diagnostics. Every action moves the
          incident clock forward.
        </li>
        <li>
          <strong>Mitigate or fix the cause.</strong> Restarts and scaling can buy time, but only
          fixing the underlying cause ends the incident.
        </li>
        <li>
          <strong>Use your team.</strong> Delegate work and post updates in the War Room.
        </li>
        <li>
          <strong>Nothing is graded.</strong> The postmortem shows what happened, not whether you
          were right.
        </li>
      </ol>
      <p>
        <strong>Training rotation</strong> — the three standalone incidents below; a good place to
        start. <strong>Full campaign</strong> — the long rotation, where your record carries forward
        and the company&apos;s AI, ORPHEUS, starts modelling how you work.
      </p>
      <button type="button" onClick={onDismiss}>
        Got it — hide this briefing
      </button>
    </section>
  );
}

function Desk({
  catalog = scenarioCatalog,
  incidentStorage,
  progressStorage,
  campaign,
  fullCampaignLoader,
}: AppShellProps) {
  const [fullCampaignOpen, setFullCampaignOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
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
  const [briefingOpen, setBriefingOpen] = useState(() => !readBriefingDismissed());
  const [restartPrompt, setRestartPrompt] = useState<{
    scenario: Scenario;
    trigger: HTMLButtonElement;
  } | null>(null);
  const deskHeadingRef = useRef<HTMLHeadingElement>(null);
  const keepProgressRef = useRef<HTMLButtonElement>(null);
  const scenarios = [...catalog.values()].sort((left, right) => left.id.localeCompare(right.id));
  const savedSlot = desk.savedSlot;

  useEffect(() => {
    if (activeId === null && !fullCampaignOpen && !campaignOpen) deskHeadingRef.current?.focus();
  }, [activeId, fullCampaignOpen, campaignOpen]);

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

  if (fullCampaignOpen)
    return (
      <Suspense fallback={<LoadingScreen />}>
        <FullCampaignEntry loader={fullCampaignLoader} onBack={() => setFullCampaignOpen(false)} />
      </Suspense>
    );
  if (campaignOpen && campaign)
    return (
      <Suspense fallback={<LoadingScreen />}>
        <CampaignDesk
          store={campaign.store}
          seed={campaign.seed}
          onBack={() => setCampaignOpen(false)}
        />
      </Suspense>
    );

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

  const closeRestartPrompt = () => {
    const trigger = restartPrompt?.trigger;
    setRestartPrompt(null);
    // Runs after this click; the trigger stays mounted when the prompt is declined.
    queueMicrotask(() => restoreFocus(trigger, deskHeadingRef.current));
  };

  return (
    <>
      <main className="incident-hub" inert={restartPrompt !== null}>
        <header>
          <p className="eyebrow">VANTAGE SYSTEMS // INCIDENT DESK</p>
          <h1 ref={deskHeadingRef} tabIndex={-1}>
            The Orpheus Project
          </h1>
          <p>
            You are the on-call reliability engineer. Find the root cause, keep customers in mind,
            and decide when buying time is worth it.
          </p>
          <div className="screen-toolbar" role="group" aria-label="Screen settings">
            <PresentationSettings />
            {!briefingOpen ? (
              <button type="button" className="link-button" onClick={() => setBriefingOpen(true)}>
                Show shift briefing
              </button>
            ) : null}
          </div>
        </header>
        {briefingOpen ? (
          <ShiftBriefing
            onDismiss={() => {
              saveBriefingDismissed();
              setBriefingOpen(false);
              deskHeadingRef.current?.focus();
            }}
          />
        ) : null}
        <section className="panel desk-routes" aria-labelledby="desk-routes-title">
          <h2 id="desk-routes-title">Choose a rotation</h2>
          <div className="desk-route">
            <h3>Training rotation</h3>
            <p>Three standalone incidents. Start here if this is your first shift.</p>
            <a href="#incident-list-title">Go to the training incidents</a>
          </div>
          <div className="desk-route">
            <h3>Full campaign</h3>
            <p>The long rotation across nine acts. Your record — and ORPHEUS — follow you.</p>
            <button type="button" onClick={() => setFullCampaignOpen(true)}>
              Full campaign
            </button>
            {campaign ? (
              <button type="button" onClick={() => setCampaignOpen(true)}>
                Open opt-in campaign framework
              </button>
            ) : null}
          </div>
        </section>
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
          <h2 id="incident-list-title" tabIndex={-1}>
            Training rotation
          </h2>
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
                  <button
                    onClick={(event) =>
                      inProgress
                        ? setRestartPrompt({ scenario, trigger: event.currentTarget })
                        : open(scenario, 'restart')
                    }
                    type="button"
                  >
                    {completed || inProgress ? `Restart ${scenario.id}` : `Start ${scenario.id}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      {restartPrompt !== null && (
        <ModalDialog
          channel="Destructive action"
          description={`Your unfinished response to ${restartPrompt.scenario.title} will be discarded and the incident will begin again from the pager. Completed records and your saved session are not affected.`}
          descriptionId="desk-restart-description"
          initialFocusRef={keepProgressRef}
          onEscape={closeRestartPrompt}
          role="alertdialog"
          title={`Restart ${restartPrompt.scenario.title}?`}
          titleId="desk-restart-title"
        >
          <button ref={keepProgressRef} onClick={closeRestartPrompt} type="button">
            Keep my progress
          </button>
          <button
            className="danger-button"
            onClick={() => {
              const scenario = restartPrompt.scenario;
              setRestartPrompt(null);
              open(scenario, 'restart');
            }}
            type="button"
          >
            Restart from the pager
          </button>
        </ModalDialog>
      )}
    </>
  );
}

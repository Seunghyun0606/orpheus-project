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
import { useI18n, useMessages } from '../i18n/I18n.ts';
import type { Locale } from '../i18n/locale.ts';
import { appShellMessages } from './messages/app-shell.ts';
import { errorMessage, type CodedMessage } from './messages/incident-terms.ts';

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

// Desk problems keep their code and English message; the text is composed in
// the display language at render time.
type DeskError =
  | { readonly kind: 'progress' | 'saved'; readonly error: CodedMessage }
  | { readonly kind: 'progress-unreadable' | 'saved-unreadable' };

// A failure opening an incident, optionally reported as a campaign-progress problem.
interface InteractionError {
  readonly error: CodedMessage;
  readonly campaignProgress: boolean;
}

interface DeskSnapshot {
  readonly progress: CampaignProgress;
  readonly savedSlot: SavedSlot | null;
  readonly errors: readonly DeskError[];
}

type ShellMessages = (typeof appShellMessages)['en'];

function deskErrorText(problem: DeskError, m: ShellMessages, locale: Locale): string {
  switch (problem.kind) {
    case 'progress':
      return m.campaignProgressError(errorMessage(problem.error, locale));
    case 'saved':
      return m.savedIncidentError(errorMessage(problem.error, locale));
    case 'progress-unreadable':
      return m.campaignProgressUnreadable;
    case 'saved-unreadable':
      return m.savedIncidentUnreadable;
  }
}

function readDesk(
  catalog: ReadonlyMap<string, Scenario>,
  incidentStorage: SaveStorage,
  progressStorage: SaveStorage,
): DeskSnapshot {
  const errors: DeskError[] = [];
  let progress: CampaignProgress = new Map();
  let savedSlot: SavedSlot | null = null;
  try {
    const raw = progressStorage.read();
    if (raw !== null) {
      const decoded = decodeCampaignProgress(raw, catalog);
      if (decoded.ok) progress = decoded.value;
      else errors.push({ kind: 'progress', error: decoded });
    }
  } catch {
    errors.push({ kind: 'progress-unreadable' });
  }
  try {
    const raw = incidentStorage.read();
    if (raw !== null) {
      const inspected = inspectSavedSlot(raw, catalog);
      if (inspected.ok) savedSlot = inspected.value;
      else errors.push({ kind: 'saved', error: inspected });
    }
  } catch {
    errors.push({ kind: 'saved-unreadable' });
  }
  return { progress, savedSlot, errors };
}

function LoadingScreen() {
  const m = useMessages(appShellMessages);
  return (
    <main className="incident-hub">
      <p role="status">{m.loadingCampaign}</p>
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
  const m = useMessages(appShellMessages);
  return (
    <section className="panel shift-briefing" aria-labelledby="shift-briefing-title">
      <p className="eyebrow">{m.briefingEyebrow}</p>
      <h2 id="shift-briefing-title">{m.briefingTitle}</h2>
      <ol>
        {m.briefingSteps.map((step) => (
          <li key={step.title}>
            <strong>{step.title}</strong> {step.body}
          </li>
        ))}
      </ol>
      <p>
        <strong>{m.briefingTraining}</strong>
        {m.briefingTrainingBody}
        <strong>{m.briefingCampaign}</strong>
        {m.briefingCampaignBody}
      </p>
      <button type="button" onClick={onDismiss}>
        {m.dismissBriefing}
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
  const [interactionError, setInteractionError] = useState<InteractionError | null>(null);
  const m = useMessages(appShellMessages);
  const { ct, locale } = useI18n();
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
      setInteractionError({ error: refreshed, campaignProgress: false });
      return;
    }
    if (mode === 'restart') store.getState().restart();
    if (mode === 'review') {
      const restored = store.getState().restoreArchivedIncident();
      if (!restored.ok) {
        setInteractionError({ error: restored, campaignProgress: false });
        return;
      }
    }
    if (mode === 'saved') {
      const restored = store.getState().load();
      if (!restored.ok) {
        setInteractionError({ error: restored, campaignProgress: false });
        return;
      }
    }
    setInteractionError(refreshed.ok ? null : { error: refreshed, campaignProgress: true });
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
          <p className="eyebrow">{m.eyebrow}</p>
          <h1 ref={deskHeadingRef} tabIndex={-1}>
            {m.title}
          </h1>
          <p>{m.intro}</p>
          <div className="screen-toolbar" role="group" aria-label={m.screenSettings}>
            <PresentationSettings />
            {!briefingOpen ? (
              <button type="button" className="link-button" onClick={() => setBriefingOpen(true)}>
                {m.showBriefing}
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
          <h2 id="desk-routes-title">{m.chooseRotation}</h2>
          <div className="desk-route">
            <h3>{m.trainingRotation}</h3>
            <p>{m.trainingBody}</p>
            <a href="#incident-list-title">{m.goToTraining}</a>
          </div>
          <div className="desk-route">
            <h3>{m.fullCampaign}</h3>
            <p>{m.fullCampaignBody}</p>
            <button type="button" onClick={() => setFullCampaignOpen(true)}>
              {m.fullCampaign}
            </button>
            {campaign ? (
              <button type="button" onClick={() => setCampaignOpen(true)}>
                {m.openFramework}
              </button>
            ) : null}
          </div>
        </section>
        {interactionError && (
          <p role="alert">
            {interactionError.campaignProgress
              ? m.campaignProgressError(errorMessage(interactionError.error, locale))
              : errorMessage(interactionError.error, locale)}
          </p>
        )}
        {desk.errors
          .map((problem) => deskErrorText(problem, m, locale))
          .map((text) => (
            <p key={text} role="alert">
              {text}
            </p>
          ))}
        {savedSlot && (
          <section aria-labelledby="saved-session-title" className="panel incident-hub-saved">
            <h2 id="saved-session-title">{m.saveSlot}</h2>
            <p>
              {savedSlot.scenario.id} / {ct(savedSlot.scenario.title)}
            </p>
            <button onClick={() => open(savedSlot.scenario, 'saved')} type="button">
              {m.resumeSaved(savedSlot.scenario.id)}
            </button>
          </section>
        )}
        <section aria-labelledby="incident-list-title">
          <h2 id="incident-list-title" tabIndex={-1}>
            {m.trainingRotation}
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
                  <h3>{ct(scenario.title)}</h3>
                  <p>
                    {completed
                      ? inProgress
                        ? m.inProgressAndCompleted
                        : m.completed
                      : inProgress
                        ? m.inProgress
                        : m.ready}
                  </p>
                  {inProgress && (
                    <button onClick={() => open(scenario, 'continue')} type="button">
                      {m.continueIncident(scenario.id)}
                    </button>
                  )}
                  {completed && (
                    <button onClick={() => open(scenario, 'review')} type="button">
                      {m.reviewIncident(scenario.id)}
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
                    {completed || inProgress
                      ? m.restartIncident(scenario.id)
                      : m.startIncident(scenario.id)}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      {restartPrompt !== null && (
        <ModalDialog
          channel={m.destructiveChannel}
          description={m.restartDescription(ct(restartPrompt.scenario.title))}
          descriptionId="desk-restart-description"
          initialFocusRef={keepProgressRef}
          onEscape={closeRestartPrompt}
          role="alertdialog"
          title={m.restartTitle(ct(restartPrompt.scenario.title))}
          titleId="desk-restart-title"
        >
          <button ref={keepProgressRef} onClick={closeRestartPrompt} type="button">
            {m.keepProgress}
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
            {m.restartFromPager}
          </button>
        </ModalDialog>
      )}
    </>
  );
}

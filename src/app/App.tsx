import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { computePostmortem } from '../engine/index.ts';
import { eventCues, type AudioCue } from '../audio/cues.ts';
import { CAMPAIGN_PROGRESS_KEY, createLocalSaveStorage } from '../persistence/index.ts';
import { inc001Scenario, scenarioCatalog } from '../scenario/index.ts';
import {
  createIncidentSessionStore,
  selectAvailableActions,
  selectCampaignEvidence,
  selectCampaignNarratives,
  selectRevealedSignals,
  selectWarRoom,
  type IncidentSessionState,
} from '../store/incident-session.ts';
import { OnboardingCoach } from '../onboarding/OnboardingCoach.tsx';
import { Postmortem } from './Postmortem.tsx';
import { PresentationProvider, PresentationSettings } from './PresentationSettings.tsx';
import { AudioControls, type CueSubscription } from './AudioControls.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { restoreFocus } from './focus.ts';
import { buildIncidentLog } from './incident-log.ts';
import { formatElapsed, humanize, signalDirectory } from './format.ts';
import { localizedSignals, type LocalizedSignals } from './localized-format.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { appMessages } from './messages/app.ts';
import {
  actionCategoryLabels,
  errorLabel,
  errorMessage,
  logLevelLabels,
  persistenceNoticeText,
} from './messages/incident-terms.ts';

type ToolId = 'logs' | 'metrics' | 'database' | 'status' | 'evidence' | 'war-room';
type AppMessages = (typeof appMessages)['en'];

const defaultSessionStore = createIncidentSessionStore(inc001Scenario, 1001, undefined, {
  storage: createLocalSaveStorage(CAMPAIGN_PROGRESS_KEY),
  catalog: scenarioCatalog,
});

const tools: readonly { id: ToolId; shortcut: string }[] = [
  { id: 'logs', shortcut: '01' },
  { id: 'metrics', shortcut: '02' },
  { id: 'database', shortcut: '03' },
  { id: 'status', shortcut: '04' },
  { id: 'evidence', shortcut: '05' },
  { id: 'war-room', shortcut: '06' },
];

export interface AppProps {
  store?: StoreApi<IncidentSessionState>;
  onBackToDesk?: () => void;
  reviewOnly?: boolean;
}

function formatCondition(
  condition: IncidentSessionState['scenario']['actions'][number]['requirements'][number],
  scenario: IncidentSessionState['scenario'],
  signals: LocalizedSignals,
  ct: (text: string) => string,
  m: AppMessages,
): string {
  switch (condition.type) {
    case 'action_completed':
      return m.conditionCompleted(
        ct(
          scenario.actions.find(({ id }) => id === condition.actionId)?.title ??
            humanize(condition.actionId),
        ),
      );
    case 'signal_revealed':
      return m.conditionObserved(signals.label(condition.signalId));
    case 'evidence':
      return m.conditionCollected(
        ct(
          scenario.evidence.find(({ id }) => id === condition.evidenceId)?.title ??
            humanize(condition.evidenceId),
        ),
      );
    case 'mechanism_resolved':
      return m.conditionContained(
        ct(
          scenario.incident.failureMechanisms.find(({ id }) => id === condition.mechanismId)
            ?.label ?? humanize(condition.mechanismId),
        ),
      );
    case 'flag':
      return m.conditionFlag(ct(humanize(condition.flagId)), condition.value);
    case 'resource':
      return `${ct(humanize(condition.resourceId))} ${condition.operator} ${condition.value}`;
    case 'signal':
      return `${signals.label(condition.signalId)} ${condition.operator} ${signals.value(condition.signalId, condition.value)}`;
  }
}

// Route the operator to the view where an action's result is observable. The
// authored category decides; OBSERVE is the only category that spans two views
// (logs vs telemetry), so it alone falls back to the authored title.
function chooseTool(action: IncidentSessionState['scenario']['actions'][number]): ToolId {
  switch (action.category) {
    case 'DELEGATE':
    case 'COMMUNICATE':
      return 'war-room';
    case 'DIAGNOSE':
    case 'INVESTIGATE':
      return 'database';
    case 'MITIGATE':
    case 'MODIFY':
      return 'status';
    case 'OBSERVE':
      return /\blogs?\b/i.test(action.title) ? 'logs' : 'metrics';
  }
}

function recoveryCopy(
  state: IncidentSessionState['incident'],
  m: AppMessages,
): {
  label: string;
  detail: string;
  tone: string;
} {
  if (state.completionReached) return { ...m.recovery.recovered, tone: 'recovered' };

  if (state.scheduledWork.some(({ kind }) => kind === 'temporary_expiration'))
    return { ...m.recovery.temporary, tone: 'temporary' };

  if (state.eventLog.some(({ type }) => type === 'temporary_effect_expired'))
    return { ...m.recovery.degraded, tone: 'critical' };

  return { ...m.recovery.diagnosing, tone: 'critical' };
}

export function App(props: AppProps) {
  return (
    <PresentationProvider>
      <IncidentScreen {...props} />
    </PresentationProvider>
  );
}

type PendingDialog =
  | { kind: 'overwrite'; scenarioId: string; message: string; stale: boolean }
  | { kind: 'restart' }
  | null;

function IncidentScreen({
  store = defaultSessionStore,
  onBackToDesk,
  reviewOnly = false,
}: AppProps) {
  const session = useStore(store);
  const [activeTool, setActiveTool] = useState<ToolId>('metrics');
  const [activeNarrativeId, setActiveNarrativeId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [viewMode, setViewMode] = useState<'incident' | 'postmortem'>(
    store.getState().incident.completionReached ? 'postmortem' : 'incident',
  );
  const narrativeContinueRef = useRef<HTMLButtonElement>(null);
  const postmortemReturnRef = useRef<HTMLButtonElement>(null);
  const warRoomTabRef = useRef<HTMLButtonElement>(null);
  const confirmOverwriteRef = useRef<HTMLButtonElement>(null);
  const keepSessionRef = useRef<HTMLButtonElement>(null);
  const resultRegionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Element to return to once a dialog/narrative closes, and a focus request
  // that runs after the next commit (when `inert` has already been lifted).
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<(() => void) | null>(null);
  const keyboardAudio = useRef<(() => void) | null>(null);
  const cueListeners = useRef(new Set<(cues: readonly AudioCue[]) => void>());
  const subscribeCues = useCallback<CueSubscription>((listener) => {
    const listeners = cueListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const emitCues = (cues: readonly AudioCue[]) => {
    if (cues.length > 0) for (const listener of cueListeners.current) listener(cues);
  };

  const m = useMessages(appMessages);
  const categoryLabel = useMessages(actionCategoryLabels);
  const levelLabel = useMessages(logLevelLabels);
  const i18n = useI18n();
  const { ct, locale, formatNumber } = i18n;
  const activeNarrative = session.scenario.narratives.find(({ id }) => id === activeNarrativeId);
  const directory = signalDirectory(session.scenario.initialState.signals);
  const signals = localizedSignals(directory, i18n);
  const serviceName = (id: string) =>
    ct(session.scenario.services.find((service) => service.id === id)?.name ?? humanize(id));
  const availableActions = selectAvailableActions(session);
  const revealedSignals = selectRevealedSignals(session);
  const recovery = recoveryCopy(session.incident, m);
  const customerImpact = session.incident.resources.CUSTOMER_IMPACT?.value ?? 0;
  const pagerService = revealedSignals.find(({ id }) => id === 'PAGER_SERVICE')?.value;
  const pagerThreshold = revealedSignals.find(({ id }) => id === 'PAGER_THRESHOLD')?.value;
  const newDiscoveries = revealedSignals.filter(({ id }) => {
    const initial = session.scenario.initialState.signals.find((signal) => signal.id === id);
    return initial?.revealed === false;
  });
  const warRoom = selectWarRoom(session);
  const logLines = buildIncidentLog(
    session.scenario,
    session.incident,
    directory,
    warRoom.messages,
    i18n,
  );
  const recentEvents = logLines
    .filter(({ fromEvent }) => fromEvent)
    .slice(-8)
    .reverse();
  const campaignEvidence = selectCampaignEvidence(session);
  const campaignNarratives = selectCampaignNarratives(session);
  const latestWarRoomMessage = warRoom.messages.at(-1);
  const persistenceNotice =
    session.persistenceNotice === null
      ? null
      : persistenceNoticeText(session.persistenceNotice, session.persistenceNoticeDetail, locale);
  const blocking = activeNarrative !== undefined || dialog !== null;

  useEffect(() => {
    const request = pendingFocus.current;
    pendingFocus.current = null;
    request?.();
  });

  useEffect(() => {
    if (
      viewMode === 'incident' &&
      session.incident.completionReached &&
      activeNarrative === undefined
    ) {
      postmortemReturnRef.current?.focus();
    }
  }, [viewMode, session.incident.completionReached, activeNarrative]);

  const focusLater = (request: () => void) => {
    pendingFocus.current = request;
  };

  const performAction = (actionId: string, trigger: HTMLButtonElement) => {
    const action = session.scenario.actions.find(({ id }) => id === actionId);
    const result = session.performAction(actionId);
    if (!result.ok) return;
    emitCues(eventCues(result.events, result.state.signals));
    const narrativeEvent = result.events.find(({ type }) => type === 'narrative_triggered');
    if (narrativeEvent?.sourceId !== undefined) {
      returnFocusRef.current = trigger;
      setActiveNarrativeId(narrativeEvent.sourceId);
      setActiveTool('logs');
    } else if (result.state.completionReached) {
      setViewMode('postmortem');
    } else if (action !== undefined) {
      const nextTool = chooseTool(action);
      setActiveTool(nextTool);
      // Delegation results arrive in the War Room; everything else is announced
      // in the observable results region, so focus never falls back to <body>.
      focusLater(() =>
        nextTool === 'war-room' ? warRoomTabRef.current?.focus() : resultRegionRef.current?.focus(),
      );
    }
  };

  const closeNarrative = () => {
    setActiveNarrativeId(null);
    if (session.incident.completionReached) {
      setViewMode('postmortem');
      return;
    }
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    focusLater(() => restoreFocus(trigger, resultRegionRef.current));
  };

  const loadSession = () => {
    const result = session.load();
    if (result.ok) {
      setActiveNarrativeId(null);
      setViewMode(store.getState().incident.completionReached ? 'postmortem' : 'incident');
    }
  };

  const restartSession = () => {
    session.restart();
    emitCues(['pager']);
    setActiveNarrativeId(null);
    setActiveTool('metrics');
    setViewMode('incident');
  };

  const closeDialog = () => {
    setDialog(null);
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    focusLater(() => restoreFocus(trigger, titleRef.current));
  };

  const requestRestart = (trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    setDialog({ kind: 'restart' });
  };

  const confirmRestart = () => {
    restartSession();
    closeDialog();
  };

  const requestSave = (trigger?: HTMLButtonElement) => {
    const result = session.save();
    if (!result.ok && result.code === 'OVERWRITE_CONFIRMATION_REQUIRED') {
      if (result.existingScenarioId === undefined) return;
      if (trigger !== undefined) returnFocusRef.current = trigger;
      setDialog({
        kind: 'overwrite',
        scenarioId: result.existingScenarioId,
        message: result.message,
        stale: false,
      });
    }
  };

  const confirmOverwrite = () => {
    if (dialog?.kind !== 'overwrite') return;
    const result = session.save(dialog.scenarioId);
    if (
      !result.ok &&
      result.code === 'OVERWRITE_CONFIRMATION_REQUIRED' &&
      result.existingScenarioId !== undefined
    ) {
      // A second prompt from a confirmation means the slot changed meanwhile.
      setDialog({
        kind: 'overwrite',
        scenarioId: result.existingScenarioId,
        message: result.message,
        stale: true,
      });
      return;
    }
    closeDialog();
  };

  const dialogView =
    dialog === null ? null : dialog.kind === 'overwrite' ? (
      <ModalDialog
        channel={m.overwriteChannel}
        description={m.overwriteDescription({
          message: dialog.message,
          existingScenarioId: dialog.scenarioId,
          scenarioId: session.scenario.id,
          stale: dialog.stale,
        })}
        descriptionId="overwrite-description"
        initialFocusRef={confirmOverwriteRef}
        onEscape={closeDialog}
        role="alertdialog"
        title={m.overwriteTitle}
        titleId="overwrite-title"
      >
        <button onClick={closeDialog} type="button">
          {m.keepExistingSave}
        </button>
        <button ref={confirmOverwriteRef} onClick={confirmOverwrite} type="button">
          {m.confirmReplacement}
        </button>
      </ModalDialog>
    ) : (
      <ModalDialog
        channel={m.destructiveChannel}
        description={m.restartDescription}
        descriptionId="restart-description"
        initialFocusRef={keepSessionRef}
        onEscape={closeDialog}
        role="alertdialog"
        title={m.restartTitle}
        titleId="restart-title"
      >
        <button ref={keepSessionRef} onClick={closeDialog} type="button">
          {m.keepCurrentResponse}
        </button>
        <button className="danger-button" onClick={confirmRestart} type="button">
          {m.restartFromPager}
        </button>
      </ModalDialog>
    );

  const handleToolKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tools.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tools.length) % tools.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tools.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTool = tools[nextIndex];
    if (nextTool === undefined) return;
    setActiveTool(nextTool.id);
    const tabs =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
    if (
      reviewOnly ||
      event.repeat ||
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      (event.target instanceof Element && event.target.closest('[data-audio-controls]'))
    )
      return;
    if (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace')
      keyboardAudio.current?.();
  };

  const toolbar = (
    <div className="screen-toolbar" role="group" aria-label={m.screenSettings}>
      <PresentationSettings />
      <AudioControls
        ambience={!session.incident.completionReached}
        keyboard={keyboardAudio}
        live={!reviewOnly}
        subscribe={subscribeCues}
        variant="compact"
      />
    </div>
  );

  const coach = reviewOnly ? null : (
    <OnboardingCoach
      surface="desk"
      state={session.incident}
      availableActionIds={availableActions.map(({ id }) => id)}
      actionTitle={(id) => session.scenario.actions.find((action) => action.id === id)?.title}
    />
  );

  if (viewMode === 'postmortem' && session.incident.completionReached) {
    return (
      <>
        <div inert={dialog !== null}>
          {toolbar}
          {coach}
          <Postmortem
            report={computePostmortem(session.scenario, session.incident)}
            persistenceNotice={persistenceNotice}
            persistenceError={
              session.persistenceError === null
                ? null
                : errorMessage(session.persistenceError, locale)
            }
            onSave={requestSave}
            onLoad={loadSession}
            onReturn={() => setViewMode('incident')}
            onRestart={requestRestart}
            onBackToDesk={onBackToDesk}
            reviewOnly={reviewOnly}
            signals={session.scenario.initialState.signals}
          />
        </div>
        {dialogView}
      </>
    );
  }

  return (
    <>
      <main className="operations-shell" inert={blocking} onKeyDownCapture={onKeyDownCapture}>
        {toolbar}
        <header className="incident-header">
          <div className="brand-lockup">
            <p className="eyebrow">{m.eyebrow}</p>
            <p className="brand">ORPHEUS</p>
            {onBackToDesk && (
              <button className="desk-return" onClick={onBackToDesk} type="button">
                {m.incidentDesk}
              </button>
            )}
          </div>
          <div className="incident-identity">
            <span className="severity-badge">{session.scenario.severity}</span>
            <div>
              <p className="incident-code">{session.scenario.id}</p>
              <h1 ref={titleRef} tabIndex={-1}>
                {ct(session.scenario.title)}
              </h1>
            </div>
          </div>
          <dl className="header-stats">
            <div>
              <dt>{m.elapsed}</dt>
              <dd data-testid="elapsed-time">{formatElapsed(session.incident.elapsedSeconds)}</dd>
            </div>
            <div>
              <dt>{m.customerImpact}</dt>
              <dd>{formatNumber(customerImpact)}</dd>
            </div>
            <div className={`recovery-stat recovery-stat--${recovery.tone}`}>
              <dt>{m.recoveryState}</dt>
              <dd>{recovery.label}</dd>
            </div>
          </dl>
        </header>

        <section
          className={`recovery-banner recovery-banner--${recovery.tone}`}
          aria-live="polite"
          data-onboarding-target="region:recovery"
        >
          <span className="status-glyph" aria-hidden="true">
            {recovery.tone === 'recovered' ? '◆' : recovery.tone === 'temporary' ? '◇' : '▲'}
          </span>
          <div>
            <strong>{recovery.label}</strong>
            <span>{recovery.detail}</span>
          </div>
          {session.incident.completionReached && (
            <button
              ref={postmortemReturnRef}
              data-onboarding-target="region:postmortem"
              onClick={() => setViewMode('postmortem')}
              type="button"
            >
              {m.viewPostmortem}
            </button>
          )}
        </section>

        <div className="desktop-grid">
          <aside className="service-rail panel" aria-labelledby="service-map-title">
            <div className="panel-heading">
              <span>{m.infrastructure}</span>
              <h2 id="service-map-title">{m.servicePath}</h2>
            </div>
            <ol className="service-path">
              {session.scenario.services.map((service) => {
                const isPaging = service.name === pagerService;
                const status = session.incident.completionReached
                  ? m.serviceStatus.stable
                  : isPaging
                    ? m.serviceStatus.alerting
                    : service.dependsOn.length > 0
                      ? m.serviceStatus.dependency
                      : m.serviceStatus.observing;
                const tone = session.incident.completionReached
                  ? 'stable'
                  : isPaging
                    ? 'alert'
                    : 'watch';

                return (
                  <li className={`service-node service-node--${tone}`} key={service.id}>
                    <span className="service-link" aria-hidden="true" />
                    <div>
                      <strong>{ct(service.name)}</strong>
                      <span>{service.id}</span>
                    </div>
                    <span className="service-state">
                      <span aria-hidden="true">
                        {tone === 'stable' ? '●' : tone === 'alert' ? '▲' : '◆'}
                      </span>{' '}
                      {status}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="pager-card">
              <span>{m.pagerTrigger}</span>
              <strong>
                {pagerService === undefined ? m.serviceAlert : ct(String(pagerService))}
              </strong>
              <p>
                {pagerThreshold === undefined ? m.thresholdExceeded : ct(String(pagerThreshold))}
              </p>
            </div>
          </aside>

          <section className="workspace panel" aria-label={m.workspace}>
            <div className="tool-tabs" role="tablist" aria-label={m.investigationTools}>
              {tools.map((tool, index) => (
                <button
                  aria-controls="tool-panel"
                  aria-selected={activeTool === tool.id}
                  className={activeTool === tool.id ? 'tool-tab tool-tab--active' : 'tool-tab'}
                  data-onboarding-target={`tool:${tool.id}`}
                  id={`tool-tab-${tool.id}`}
                  key={tool.id}
                  ref={tool.id === 'war-room' ? warRoomTabRef : undefined}
                  onClick={() => setActiveTool(tool.id)}
                  onKeyDown={(event) => handleToolKeyDown(event, index)}
                  role="tab"
                  tabIndex={activeTool === tool.id ? 0 : -1}
                  type="button"
                >
                  <span>{tool.shortcut}</span> {m.tools[tool.id]}
                </button>
              ))}
            </div>

            <div
              aria-labelledby={`tool-tab-${activeTool}`}
              className="tool-panel"
              id="tool-panel"
              role="tabpanel"
            >
              {activeTool === 'logs' && (
                <div className="terminal-view">
                  <div className="view-heading">
                    <div>
                      <span>{m.logsEyebrow}</span>
                      <h2>{m.logsTitle}</h2>
                    </div>
                    <span className="stream-state">
                      ● {m.entries(formatNumber(logLines.length))}
                    </span>
                  </div>
                  <div className="log-lines" role="log" aria-label={m.logEntries}>
                    {logLines.map((line) => (
                      <p key={line.key}>
                        <time>{formatElapsed(line.atSeconds)}</time>
                        <span className={`log-level log-level--${line.level.toLowerCase()}`}>
                          {levelLabel[line.level]}
                        </span>
                        {line.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'metrics' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>{m.metricsEyebrow}</span>
                      <h2>{m.metricsTitle}</h2>
                    </div>
                    <span className="stream-state">
                      ● {m.signals(formatNumber(revealedSignals.length))}
                    </span>
                  </div>
                  <div className="metric-grid">
                    {revealedSignals
                      .filter(({ id }) => !id.startsWith('PAGER_'))
                      .map((signal) => (
                        <article className="metric-card" key={signal.id}>
                          <span>
                            {signal.serviceId === undefined
                              ? m.incidentScope
                              : serviceName(signal.serviceId)}
                          </span>
                          <strong>{signals.value(signal.id, signal.value)}</strong>
                          <p>{signals.label(signal.id)}</p>
                        </article>
                      ))}
                  </div>
                </div>
              )}

              {activeTool === 'database' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>{m.diagnosticsEyebrow}</span>
                      <h2>{m.diagnosticsTitle}</h2>
                    </div>
                    <span className="stream-state">● {m.queryConsole}</span>
                  </div>
                  {newDiscoveries.length === 0 ? (
                    <div className="empty-state">
                      <span aria-hidden="true">⌁</span>
                      <strong>{m.noDetailTitle}</strong>
                      <p>{m.noDetailBody}</p>
                    </div>
                  ) : (
                    <table className="discovery-table">
                      <caption>{m.discoveryCaption}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{m.observation}</th>
                          <th scope="col">{m.value}</th>
                          <th scope="col">{m.source}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newDiscoveries.map((signal) => (
                          <tr key={signal.id}>
                            <th scope="row">{signals.label(signal.id)}</th>
                            <td data-label={m.value}>{signals.value(signal.id, signal.value)}</td>
                            <td data-label={m.source}>
                              {signal.serviceId === undefined
                                ? m.incidentSource
                                : serviceName(signal.serviceId)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTool === 'status' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>{m.statusEyebrow}</span>
                      <h2>{m.statusTitle}</h2>
                    </div>
                    <span className="stream-state">● {m.actionDerived}</span>
                  </div>
                  <div className="status-summary">
                    <article>
                      <span>{m.underlyingCause}</span>
                      <strong>{session.incident.resolutionReached ? m.contained : m.open}</strong>
                      <p>{recovery.detail}</p>
                    </article>
                    {Object.entries(session.incident.resources).map(([id, resource]) => (
                      <article key={id}>
                        <span>{ct(humanize(id))}</span>
                        <strong>{formatNumber(resource.value)}</strong>
                        <p>{m.updatedByActions}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'evidence' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>{m.evidenceEyebrow}</span>
                      <h2>{m.evidenceTitle}</h2>
                    </div>
                    <span className="stream-state">
                      ● {m.discovered(formatNumber(campaignEvidence.length))}
                    </span>
                  </div>
                  {campaignEvidence.length === 0 ? (
                    <div className="empty-state">
                      <span aria-hidden="true">◇</span>
                      <strong>{m.noEvidenceTitle}</strong>
                      <p>{m.noEvidenceBody}</p>
                    </div>
                  ) : (
                    <div className="evidence-grid">
                      {campaignEvidence.map((item) => (
                        <article className="evidence-card" key={`${item.scenarioId}:${item.id}`}>
                          <span>
                            {item.scenarioId} / {item.id}
                          </span>
                          <h3>{ct(item.title)}</h3>
                          <p>{ct(item.description)}</p>
                        </article>
                      ))}
                    </div>
                  )}
                  {campaignNarratives.length > 0 && (
                    <section aria-label={m.anomalyHistory}>
                      <h3>{m.anomalyHistory}</h3>
                      <ol>
                        {campaignNarratives.map((item) => (
                          <li key={`${item.scenarioId}:${item.id}`}>
                            {item.scenarioId} / {ct(item.title)}: {ct(item.body)}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                  {session.campaignProgressError && (
                    <p role="alert">
                      {m.campaignRestoreFailed}{' '}
                      {errorMessage(session.campaignProgressError, locale)}
                    </p>
                  )}
                </div>
              )}

              {activeTool === 'war-room' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>{m.warRoomEyebrow}</span>
                      <h2>{m.warRoomTitle}</h2>
                    </div>
                    <span className="stream-state">
                      ● {m.pending(formatNumber(warRoom.pending.length))}
                    </span>
                  </div>
                  <div className="war-room-summary">
                    {warRoom.capacity.map(({ resourceId, current, max }) => (
                      <p key={resourceId}>
                        {ct(humanize(resourceId))}: {current}
                        {max === undefined ? '' : ` / ${max}`}
                      </p>
                    ))}
                    {warRoom.pending.length === 0 ? (
                      <p>{m.noPendingWork}</p>
                    ) : (
                      <ul aria-label={m.pendingWork}>
                        {warRoom.pending.map((work) => (
                          <li key={work.scheduleSequence}>
                            {m.pendingItem(
                              ct(work.role),
                              ct(work.title),
                              formatElapsed(
                                Math.max(0, work.dueAtSeconds - session.incident.elapsedSeconds),
                              ),
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {warRoom.messages.length === 0 ? (
                    <p className="activity-empty">{m.noTeamMessages}</p>
                  ) : (
                    <ol className="war-room-messages" aria-label={m.warRoomMessages}>
                      {warRoom.messages.map((message) => (
                        <li key={message.sequence}>
                          <time>{formatElapsed(message.atSeconds)}</time>
                          <strong>{ct(message.sender)}</strong>
                          <p>{ct(message.text)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="war-room-hint">{m.warRoomHint}</p>
                </div>
              )}
            </div>

            {session.scenario.warRoom.messages.length > 0 && (
              <p aria-label={m.warRoomUpdates} className="screen-reader-only" role="status">
                {latestWarRoomMessage === undefined
                  ? ''
                  : m.warRoomAnnouncement(
                      ct(latestWarRoomMessage.sender),
                      ct(latestWarRoomMessage.text),
                      warRoom.pending.length,
                    )}
              </p>
            )}

            <section
              aria-labelledby="activity-title"
              className="activity-strip"
              ref={resultRegionRef}
              tabIndex={-1}
            >
              <div className="activity-heading">
                <div>
                  <span>{m.activityEyebrow}</span>
                  <h2 id="activity-title">{m.activityTitle}</h2>
                </div>
                <span>{m.events(formatNumber(session.incident.eventLog.length))}</span>
              </div>
              {recentEvents.length === 0 ? (
                <p className="activity-empty">{m.awaitingAction}</p>
              ) : (
                <ol className="activity-list" aria-label={m.recentEvents}>
                  {recentEvents.map((line) => (
                    <li key={line.key}>
                      <time>{formatElapsed(line.atSeconds)}</time>
                      <span>{line.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </section>

          <aside className="action-rail panel" aria-labelledby="actions-title">
            <div className="panel-heading action-heading">
              <div>
                <span>{m.actionsEyebrow}</span>
                <h2 id="actions-title">{m.actionsTitle}</h2>
              </div>
              <span className="action-count">{formatNumber(availableActions.length)}</span>
            </div>
            <p className="action-intro">
              {session.incident.completionReached ? m.readOnlyIntro : m.actionsIntro}
            </p>

            {coach}

            <div className="action-list">
              {availableActions.map((action) => (
                <article className="action-card" key={action.id}>
                  <div className="action-meta">
                    <span>{categoryLabel[action.category]}</span>
                    <span>+{formatElapsed(action.durationSeconds)}</span>
                  </div>
                  <button
                    data-onboarding-target={`action:${action.id}`}
                    disabled={session.incident.completionReached}
                    onClick={(event) => performAction(action.id, event.currentTarget)}
                    type="button"
                  >
                    {ct(action.title)}
                  </button>
                  <p>
                    {action.requirements.length === 0
                      ? m.availableNow
                      : action.requirements
                          .map((condition) =>
                            formatCondition(condition, session.scenario, signals, ct, m),
                          )
                          .join(' · ')}
                  </p>
                </article>
              ))}
            </div>

            {session.lastError !== null && (
              <div className="command-error" role="alert">
                <strong>{errorLabel(session.lastError.code, locale)}</strong>
                <span>{errorMessage(session.lastError, locale)}</span>
              </div>
            )}

            {!reviewOnly && (
              <div className="session-controls" aria-label={m.saveControls} role="group">
                <button onClick={(event) => requestSave(event.currentTarget)} type="button">
                  {m.saveSession}
                </button>
                <button onClick={loadSession} type="button">
                  {m.loadSession}
                </button>
              </div>
            )}
            {persistenceNotice !== null && (
              <p aria-label={m.sessionPersistence} className="persistence-notice" role="status">
                {persistenceNotice}
              </p>
            )}
            {session.persistenceError !== null && (
              <div className="command-error" role="alert">
                <strong>{errorLabel(session.persistenceError.code, locale)}</strong>
                <span>{errorMessage(session.persistenceError, locale)}</span>
              </div>
            )}

            {!reviewOnly && (
              <button
                className="restart-button"
                onClick={(event) => requestRestart(event.currentTarget)}
                type="button"
              >
                {m.restartSession}
              </button>
            )}
          </aside>
        </div>
      </main>
      {activeNarrative !== undefined && (
        <ModalDialog
          channel={m.narrativeChannel}
          description={ct(activeNarrative.body)}
          descriptionId="narrative-body"
          initialFocusRef={narrativeContinueRef}
          role="dialog"
          title={ct(activeNarrative.title)}
          titleId="narrative-title"
        >
          <button ref={narrativeContinueRef} onClick={closeNarrative} type="button">
            {m.continueIncident}
          </button>
        </ModalDialog>
      )}
      {dialogView}
    </>
  );
}

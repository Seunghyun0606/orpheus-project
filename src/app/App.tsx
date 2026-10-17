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
import { Postmortem } from './Postmortem.tsx';
import { PresentationProvider, PresentationSettings } from './PresentationSettings.tsx';
import { AudioControls, type CueSubscription } from './AudioControls.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { restoreFocus } from './focus.ts';
import { buildIncidentLog } from './incident-log.ts';
import {
  formatElapsed,
  formatSignalValue,
  humanize,
  signalDirectory,
  signalLabel,
  type SignalDirectory,
} from './format.ts';

type ToolId = 'logs' | 'metrics' | 'database' | 'status' | 'evidence' | 'war-room';

const defaultSessionStore = createIncidentSessionStore(inc001Scenario, 1001, undefined, {
  storage: createLocalSaveStorage(CAMPAIGN_PROGRESS_KEY),
  catalog: scenarioCatalog,
});

const tools: readonly { id: ToolId; label: string; shortcut: string }[] = [
  { id: 'logs', label: 'Logs', shortcut: '01' },
  { id: 'metrics', label: 'Metrics', shortcut: '02' },
  { id: 'database', label: 'Diagnostics', shortcut: '03' },
  { id: 'status', label: 'Status', shortcut: '04' },
  { id: 'evidence', label: 'Evidence', shortcut: '05' },
  { id: 'war-room', label: 'War Room', shortcut: '06' },
];

export interface AppProps {
  store?: StoreApi<IncidentSessionState>;
  onBackToDesk?: () => void;
  reviewOnly?: boolean;
}

function formatCondition(
  condition: IncidentSessionState['scenario']['actions'][number]['requirements'][number],
  scenario: IncidentSessionState['scenario'],
  directory: SignalDirectory,
): string {
  switch (condition.type) {
    case 'action_completed':
      return `${scenario.actions.find(({ id }) => id === condition.actionId)?.title ?? humanize(condition.actionId)} completed`;
    case 'signal_revealed':
      return `${signalLabel(condition.signalId, directory)} observed`;
    case 'evidence':
      return `${scenario.evidence.find(({ id }) => id === condition.evidenceId)?.title ?? humanize(condition.evidenceId)} collected`;
    case 'mechanism_resolved':
      return `${scenario.incident.failureMechanisms.find(({ id }) => id === condition.mechanismId)?.label ?? humanize(condition.mechanismId)} contained`;
    case 'flag':
      return `${humanize(condition.flagId)} is ${String(condition.value)}`;
    case 'resource':
      return `${humanize(condition.resourceId)} ${condition.operator} ${condition.value}`;
    case 'signal':
      return `${signalLabel(condition.signalId, directory)} ${condition.operator} ${formatSignalValue(condition.signalId, condition.value, directory)}`;
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

function recoveryCopy(state: IncidentSessionState['incident']): {
  label: string;
  detail: string;
  tone: string;
} {
  if (state.completionReached) {
    return {
      label: 'Incident recovered',
      detail: 'Root cause contained; service indicators are stable.',
      tone: 'recovered',
    };
  }

  if (state.scheduledWork.some(({ kind }) => kind === 'temporary_expiration')) {
    return {
      label: 'Temporary stabilization',
      detail: 'Indicators improved, but the underlying cause remains open.',
      tone: 'temporary',
    };
  }

  if (state.eventLog.some(({ type }) => type === 'temporary_effect_expired')) {
    return {
      label: 'Degradation active',
      detail: 'Temporary relief ended while the underlying cause remained open.',
      tone: 'critical',
    };
  }

  return {
    label: 'Diagnosis in progress',
    detail: 'Customer impact is accumulating while the cause remains open.',
    tone: 'critical',
  };
}

export function App(props: AppProps) {
  return (
    <PresentationProvider>
      <IncidentScreen {...props} />
    </PresentationProvider>
  );
}

type PendingDialog =
  { kind: 'overwrite'; scenarioId: string; message: string } | { kind: 'restart' } | null;

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

  const activeNarrative = session.scenario.narratives.find(({ id }) => id === activeNarrativeId);
  const directory = signalDirectory(session.scenario.initialState.signals);
  const serviceName = (id: string) =>
    session.scenario.services.find((service) => service.id === id)?.name ?? humanize(id);
  const availableActions = selectAvailableActions(session);
  const revealedSignals = selectRevealedSignals(session);
  const recovery = recoveryCopy(session.incident);
  const customerImpact = session.incident.resources.CUSTOMER_IMPACT?.value ?? 0;
  const pagerService = revealedSignals.find(({ id }) => id === 'PAGER_SERVICE')?.value;
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
  );
  const recentEvents = logLines
    .filter(({ fromEvent }) => fromEvent)
    .slice(-8)
    .reverse();
  const campaignEvidence = selectCampaignEvidence(session);
  const campaignNarratives = selectCampaignNarratives(session);
  const latestWarRoomMessage = warRoom.messages.at(-1);
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
      setDialog({
        kind: 'overwrite',
        scenarioId: result.existingScenarioId,
        message: result.message,
      });
      return;
    }
    closeDialog();
  };

  const dialogView =
    dialog === null ? null : dialog.kind === 'overwrite' ? (
      <ModalDialog
        channel="Single local save slot"
        description={`${dialog.message} Recovered campaign evidence remains separate.`}
        descriptionId="overwrite-description"
        initialFocusRef={confirmOverwriteRef}
        onEscape={closeDialog}
        role="alertdialog"
        title="Replace the local save?"
        titleId="overwrite-title"
      >
        <button onClick={closeDialog} type="button">
          Keep existing save
        </button>
        <button ref={confirmOverwriteRef} onClick={confirmOverwrite} type="button">
          Confirm replacement
        </button>
      </ModalDialog>
    ) : (
      <ModalDialog
        channel="Destructive action"
        description="This response will be cleared and the incident will begin again from the pager. Your saved session and any evidence already recovered stay as they are."
        descriptionId="restart-description"
        initialFocusRef={keepSessionRef}
        onEscape={closeDialog}
        role="alertdialog"
        title="Restart this incident?"
        titleId="restart-title"
      >
        <button ref={keepSessionRef} onClick={closeDialog} type="button">
          Keep current response
        </button>
        <button className="danger-button" onClick={confirmRestart} type="button">
          Restart from the pager
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
    <div className="screen-toolbar" role="group" aria-label="Screen settings">
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

  if (viewMode === 'postmortem' && session.incident.completionReached) {
    return (
      <>
        <div inert={dialog !== null}>
          {toolbar}
          <Postmortem
            report={computePostmortem(session.scenario, session.incident)}
            persistenceNotice={session.persistenceNotice}
            persistenceError={session.persistenceError?.message ?? null}
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
            <p className="eyebrow">VANTAGE SYSTEMS // PRODUCTION RELIABILITY</p>
            <p className="brand">ORPHEUS</p>
            {onBackToDesk && (
              <button className="desk-return" onClick={onBackToDesk} type="button">
                Incident desk
              </button>
            )}
          </div>
          <div className="incident-identity">
            <span className="severity-badge">{session.scenario.severity}</span>
            <div>
              <p className="incident-code">{session.scenario.id}</p>
              <h1 ref={titleRef} tabIndex={-1}>
                {session.scenario.title}
              </h1>
            </div>
          </div>
          <dl className="header-stats">
            <div>
              <dt>Elapsed</dt>
              <dd data-testid="elapsed-time">{formatElapsed(session.incident.elapsedSeconds)}</dd>
            </div>
            <div>
              <dt>Customer impact</dt>
              <dd>{customerImpact.toLocaleString('en-US')}</dd>
            </div>
            <div className={`recovery-stat recovery-stat--${recovery.tone}`}>
              <dt>Recovery state</dt>
              <dd>{recovery.label}</dd>
            </div>
          </dl>
        </header>

        <section className={`recovery-banner recovery-banner--${recovery.tone}`} aria-live="polite">
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
              onClick={() => setViewMode('postmortem')}
              type="button"
            >
              View postmortem
            </button>
          )}
        </section>

        <div className="desktop-grid">
          <aside className="service-rail panel" aria-labelledby="service-map-title">
            <div className="panel-heading">
              <span>Infrastructure</span>
              <h2 id="service-map-title">Service path</h2>
            </div>
            <ol className="service-path">
              {session.scenario.services.map((service) => {
                const isPaging = service.name === pagerService;
                const status = session.incident.completionReached
                  ? 'STABLE'
                  : isPaging
                    ? 'ALERTING'
                    : service.dependsOn.length > 0
                      ? 'DEPENDENCY PATH'
                      : 'UNDER OBSERVATION';
                const tone = session.incident.completionReached
                  ? 'stable'
                  : isPaging
                    ? 'alert'
                    : 'watch';

                return (
                  <li className={`service-node service-node--${tone}`} key={service.id}>
                    <span className="service-link" aria-hidden="true" />
                    <div>
                      <strong>{service.name}</strong>
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
              <span>Pager trigger</span>
              <strong>{String(pagerService ?? 'Service alert')}</strong>
              <p>
                {String(
                  revealedSignals.find(({ id }) => id === 'PAGER_THRESHOLD')?.value ??
                    'Threshold exceeded',
                )}
              </p>
            </div>
          </aside>

          <section className="workspace panel" aria-label="Incident investigation workspace">
            <div className="tool-tabs" role="tablist" aria-label="Investigation tools">
              {tools.map((tool, index) => (
                <button
                  aria-controls="tool-panel"
                  aria-selected={activeTool === tool.id}
                  className={activeTool === tool.id ? 'tool-tab tool-tab--active' : 'tool-tab'}
                  id={`tool-tab-${tool.id}`}
                  key={tool.id}
                  ref={tool.id === 'war-room' ? warRoomTabRef : undefined}
                  onClick={() => setActiveTool(tool.id)}
                  onKeyDown={(event) => handleToolKeyDown(event, index)}
                  role="tab"
                  tabIndex={activeTool === tool.id ? 0 : -1}
                  type="button"
                >
                  <span>{tool.shortcut}</span> {tool.label}
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
                      <span>Incident event stream</span>
                      <h2>Incident logs</h2>
                    </div>
                    <span className="stream-state">● {logLines.length} ENTRIES</span>
                  </div>
                  <div className="log-lines" role="log" aria-label="Incident log entries">
                    {logLines.map((line) => (
                      <p key={line.key}>
                        <time>{formatElapsed(line.atSeconds)}</time>
                        <span className={`log-level log-level--${line.level.toLowerCase()}`}>
                          {line.level}
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
                      <span>Revealed telemetry</span>
                      <h2>Service metrics</h2>
                    </div>
                    <span className="stream-state">● {revealedSignals.length} SIGNALS</span>
                  </div>
                  <div className="metric-grid">
                    {revealedSignals
                      .filter(({ id }) => !id.startsWith('PAGER_'))
                      .map((signal) => (
                        <article className="metric-card" key={signal.id}>
                          <span>
                            {signal.serviceId === undefined
                              ? 'INCIDENT'
                              : serviceName(signal.serviceId)}
                          </span>
                          <strong>{formatSignalValue(signal.id, signal.value, directory)}</strong>
                          <p>{signalLabel(signal.id, directory)}</p>
                        </article>
                      ))}
                  </div>
                </div>
              )}

              {activeTool === 'database' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>Diagnostic observations</span>
                      <h2>Investigation detail</h2>
                    </div>
                    <span className="stream-state">● QUERY CONSOLE</span>
                  </div>
                  {newDiscoveries.length === 0 ? (
                    <div className="empty-state">
                      <span aria-hidden="true">⌁</span>
                      <strong>No investigation detail captured</strong>
                      <p>
                        Use observation and investigation actions to reveal additional findings.
                      </p>
                    </div>
                  ) : (
                    <table className="discovery-table">
                      <caption>Newly revealed incident observations</caption>
                      <thead>
                        <tr>
                          <th scope="col">Observation</th>
                          <th scope="col">Value</th>
                          <th scope="col">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newDiscoveries.map((signal) => (
                          <tr key={signal.id}>
                            <th scope="row">{signalLabel(signal.id, directory)}</th>
                            <td data-label="Value">
                              {formatSignalValue(signal.id, signal.value, directory)}
                            </td>
                            <td data-label="Source">
                              {signal.serviceId === undefined
                                ? 'Incident'
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
                      <span>Current response posture</span>
                      <h2>Incident status</h2>
                    </div>
                    <span className="stream-state">● ACTION DERIVED</span>
                  </div>
                  <div className="status-summary">
                    <article>
                      <span>Underlying cause</span>
                      <strong>{session.incident.resolutionReached ? 'Contained' : 'Open'}</strong>
                      <p>{recovery.detail}</p>
                    </article>
                    {Object.entries(session.incident.resources).map(([id, resource]) => (
                      <article key={id}>
                        <span>{humanize(id)}</span>
                        <strong>{resource.value.toLocaleString('en-US')}</strong>
                        <p>Updated by completed actions.</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'evidence' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>Recovered artifacts</span>
                      <h2>Evidence board</h2>
                    </div>
                    <span className="stream-state">● {campaignEvidence.length} DISCOVERED</span>
                  </div>
                  {campaignEvidence.length === 0 ? (
                    <div className="empty-state">
                      <span aria-hidden="true">◇</span>
                      <strong>No evidence recovered</strong>
                      <p>Investigate incident signals to preserve any discovered artifacts.</p>
                    </div>
                  ) : (
                    <div className="evidence-grid">
                      {campaignEvidence.map((item) => (
                        <article className="evidence-card" key={`${item.scenarioId}:${item.id}`}>
                          <span>
                            {item.scenarioId} / {item.id}
                          </span>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                        </article>
                      ))}
                    </div>
                  )}
                  {campaignNarratives.length > 0 && (
                    <section aria-label="Recovered anomaly history">
                      <h3>Recovered anomaly history</h3>
                      <ol>
                        {campaignNarratives.map((item) => (
                          <li key={`${item.scenarioId}:${item.id}`}>
                            {item.scenarioId} / {item.title}: {item.body}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                  {session.campaignProgressError && (
                    <p role="alert">
                      Campaign discoveries could not be restored:{' '}
                      {session.campaignProgressError.message}
                    </p>
                  )}
                </div>
              )}

              {activeTool === 'war-room' && (
                <div>
                  <div className="view-heading">
                    <div>
                      <span>Team response channel</span>
                      <h2>War Room</h2>
                    </div>
                    <span className="stream-state">● {warRoom.pending.length} PENDING</span>
                  </div>
                  <div className="war-room-summary">
                    {warRoom.capacity.map(({ resourceId, current, max }) => (
                      <p key={resourceId}>
                        {humanize(resourceId)}: {current}
                        {max === undefined ? '' : ` / ${max}`}
                      </p>
                    ))}
                    {warRoom.pending.length === 0 ? (
                      <p>No delegated work pending.</p>
                    ) : (
                      <ul aria-label="Pending delegated work">
                        {warRoom.pending.map((work) => (
                          <li key={work.scheduleSequence}>
                            {work.role}: {work.title} · ETA +
                            {formatElapsed(
                              Math.max(0, work.dueAtSeconds - session.incident.elapsedSeconds),
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {warRoom.messages.length === 0 ? (
                    <p className="activity-empty">No team messages yet.</p>
                  ) : (
                    <ol className="war-room-messages" aria-label="War Room messages">
                      {warRoom.messages.map((message) => (
                        <li key={message.sequence}>
                          <time>{formatElapsed(message.atSeconds)}</time>
                          <strong>{message.sender}</strong>
                          <p>{message.text}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="war-room-hint">
                    Delegate and communicate using the available actions.
                  </p>
                </div>
              )}
            </div>

            {session.scenario.warRoom.messages.length > 0 && (
              <p aria-label="War Room updates" className="screen-reader-only" role="status">
                {latestWarRoomMessage === undefined
                  ? ''
                  : `War Room message from ${latestWarRoomMessage.sender}: ${latestWarRoomMessage.text} ${warRoom.pending.length} delegated jobs pending.`}
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
                  <span>What just happened</span>
                  <h2 id="activity-title">Observable results</h2>
                </div>
                <span>{session.incident.eventLog.length} EVENTS</span>
              </div>
              {recentEvents.length === 0 ? (
                <p className="activity-empty">Awaiting operator action.</p>
              ) : (
                <ol className="activity-list" aria-label="Recent incident events">
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
                <span>Command boundary</span>
                <h2 id="actions-title">Available actions</h2>
              </div>
              <span className="action-count">{availableActions.length}</span>
            </div>
            <p className="action-intro">
              {session.incident.completionReached
                ? 'This completed incident record is read-only.'
                : 'Only actions available in the current incident state are shown. Each one moves the clock forward by its duration.'}
            </p>

            <div className="action-list">
              {availableActions.map((action) => (
                <article className="action-card" key={action.id}>
                  <div className="action-meta">
                    <span>{action.category}</span>
                    <span>+{formatElapsed(action.durationSeconds)}</span>
                  </div>
                  <button
                    disabled={session.incident.completionReached}
                    onClick={(event) => performAction(action.id, event.currentTarget)}
                    type="button"
                  >
                    {action.title}
                  </button>
                  <p>
                    {action.requirements.length === 0
                      ? 'Available now'
                      : action.requirements
                          .map((condition) =>
                            formatCondition(condition, session.scenario, directory),
                          )
                          .join(' · ')}
                  </p>
                </article>
              ))}
            </div>

            {session.lastError !== null && (
              <div className="command-error" role="alert">
                <strong>{humanize(session.lastError.code)}</strong>
                <span>{session.lastError.message}</span>
              </div>
            )}

            {!reviewOnly && (
              <div
                className="session-controls"
                aria-label="Local session save controls"
                role="group"
              >
                <button onClick={(event) => requestSave(event.currentTarget)} type="button">
                  Save session
                </button>
                <button onClick={loadSession} type="button">
                  Load saved session
                </button>
              </div>
            )}
            {session.persistenceNotice !== null && (
              <p aria-label="Session persistence" className="persistence-notice" role="status">
                {session.persistenceNotice}
              </p>
            )}
            {session.persistenceError !== null && (
              <div className="command-error" role="alert">
                <strong>{humanize(session.persistenceError.code)}</strong>
                <span>{session.persistenceError.message}</span>
              </div>
            )}

            {!reviewOnly && (
              <button
                className="restart-button"
                onClick={(event) => requestRestart(event.currentTarget)}
                type="button"
              >
                Restart incident session
              </button>
            )}
          </aside>
        </div>
      </main>
      {activeNarrative !== undefined && (
        <ModalDialog
          channel="Incident log buffer // transient signal"
          description={activeNarrative.body}
          descriptionId="narrative-body"
          initialFocusRef={narrativeContinueRef}
          role="dialog"
          title={activeNarrative.title}
          titleId="narrative-title"
        >
          <button ref={narrativeContinueRef} onClick={closeNarrative} type="button">
            Continue incident
          </button>
        </ModalDialog>
      )}
      {dialogView}
    </>
  );
}

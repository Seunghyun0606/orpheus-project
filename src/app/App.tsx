import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { computePostmortem, type EngineEvent, type ScalarValue } from '../engine/index.ts';
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
import { PresentationSettings } from './PresentationSettings.tsx';
import {
  readPresentationPreferences,
  savePresentationPreferences,
} from './presentation-settings.ts';

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

function humanize(id: string): string {
  return id
    .toLowerCase()
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSignalValue(id: string, value: ScalarValue): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && (id.includes('RATE') || id.endsWith('_CPU'))) {
    return `${value}%`;
  }
  return typeof value === 'number' ? value.toLocaleString('en-US') : value;
}

function formatCondition(
  condition: IncidentSessionState['scenario']['actions'][number]['requirements'][number],
): string {
  switch (condition.type) {
    case 'action_completed':
      return `${humanize(condition.actionId)} completed`;
    case 'signal_revealed':
      return `${humanize(condition.signalId)} observed`;
    case 'evidence':
      return `${humanize(condition.evidenceId)} collected`;
    case 'mechanism_resolved':
      return `${humanize(condition.mechanismId)} contained`;
    case 'flag':
      return `${humanize(condition.flagId)} is ${String(condition.value)}`;
    case 'resource':
      return `${humanize(condition.resourceId)} ${condition.operator} ${condition.value}`;
    case 'signal':
      return `${humanize(condition.signalId)} ${condition.operator} ${String(condition.value)}`;
  }
}

function describeEvent(event: EngineEvent): string {
  switch (event.type) {
    case 'action_completed':
      return `Action completed: ${humanize(event.sourceId ?? 'action')}`;
    case 'signal_changed':
      return `${humanize(event.targetId ?? 'signal')} changed from ${String(event.previousValue)} to ${String(event.value)}`;
    case 'signal_revealed':
      return `New observation: ${humanize(event.targetId ?? 'signal')}`;
    case 'action_unlocked':
      return `Action available: ${humanize(event.targetId ?? 'action')}`;
    case 'event_fired':
      return `Scheduled condition fired: ${humanize(event.sourceId ?? 'event')}`;
    case 'event_scheduled':
      return `Condition scheduled: ${humanize(event.sourceId ?? 'event')}`;
    case 'mechanism_resolved':
      return `Underlying mechanism contained: ${humanize(event.targetId ?? 'mechanism')}`;
    case 'resolution_reached':
      return 'Root-cause resolution reached';
    case 'completion_reached':
      return 'Incident recovery state reached';
    case 'narrative_triggered':
      return `Log anomaly detected: ${humanize(event.sourceId ?? 'narrative')}`;
    case 'war_room_message':
      return `War Room message: ${humanize(event.targetId ?? 'message')}`;
    default:
      return humanize(event.type);
  }
}

function chooseTool(action: IncidentSessionState['scenario']['actions'][number]): ToolId {
  if (action.category === 'DELEGATE' || action.category === 'COMMUNICATE') return 'war-room';
  const text = `${action.id} ${action.title}`.toLowerCase();
  if (text.includes('log')) return 'logs';
  if (text.includes('metric')) return 'metrics';
  if (action.category === 'DIAGNOSE' || action.category === 'INVESTIGATE') return 'database';
  if (text.includes('database') || text.includes('postgres') || text.includes('session')) {
    return 'database';
  }
  return 'status';
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

  if (state.eventLog.some(({ type }) => type === 'event_fired')) {
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

export function App({ store = defaultSessionStore, onBackToDesk, reviewOnly = false }: AppProps) {
  const session = useStore(store);
  const [presentationPreferences, setPresentationPreferences] = useState(
    readPresentationPreferences,
  );
  const [activeTool, setActiveTool] = useState<ToolId>('metrics');
  const [activeNarrativeId, setActiveNarrativeId] = useState<string | null>(null);
  const [overwritePrompt, setOverwritePrompt] = useState<{
    scenarioId: string;
    message: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'incident' | 'postmortem'>(
    store.getState().incident.completionReached ? 'postmortem' : 'incident',
  );
  const narrativeContinueRef = useRef<HTMLButtonElement>(null);
  const postmortemReturnRef = useRef<HTMLButtonElement>(null);
  const warRoomTabRef = useRef<HTMLButtonElement>(null);
  const confirmOverwriteRef = useRef<HTMLButtonElement>(null);
  const saveTriggerRef = useRef<HTMLButtonElement>(null);
  const hadOverwriteDialog = useRef(false);
  const activeNarrative = session.scenario.narratives.find(({ id }) => id === activeNarrativeId);
  const availableActions = selectAvailableActions(session);
  const revealedSignals = selectRevealedSignals(session);
  const recovery = recoveryCopy(session.incident);
  const customerImpact = session.incident.resources.CUSTOMER_IMPACT?.value ?? 0;
  const pagerService = revealedSignals.find(({ id }) => id === 'PAGER_SERVICE')?.value;
  const newDiscoveries = revealedSignals.filter(({ id }) => {
    const initial = session.scenario.initialState.signals.find((signal) => signal.id === id);
    return initial?.revealed === false;
  });
  const recentEvents = session.incident.eventLog.slice(-8).reverse();
  const warRoom = selectWarRoom(session);
  const campaignEvidence = selectCampaignEvidence(session);
  const campaignNarratives = selectCampaignNarratives(session);
  const latestWarRoomMessage = warRoom.messages.at(-1);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.crtEffects = presentationPreferences.crtEffects ? 'on' : 'off';
    root.dataset.motion = presentationPreferences.reducedAnimation ? 'reduce' : 'standard';
    root.dataset.textScale = presentationPreferences.textScale;
    savePresentationPreferences(presentationPreferences);
    return () => {
      delete root.dataset.crtEffects;
      delete root.dataset.motion;
      delete root.dataset.textScale;
    };
  }, [presentationPreferences]);

  useEffect(() => {
    if (activeNarrative !== undefined) narrativeContinueRef.current?.focus();
  }, [activeNarrative]);

  useEffect(() => {
    if (overwritePrompt !== null) {
      hadOverwriteDialog.current = true;
      confirmOverwriteRef.current?.focus();
    } else if (hadOverwriteDialog.current) {
      saveTriggerRef.current?.focus();
      hadOverwriteDialog.current = false;
    }
  }, [overwritePrompt]);

  useEffect(() => {
    if (
      viewMode === 'incident' &&
      session.incident.completionReached &&
      activeNarrative === undefined
    ) {
      postmortemReturnRef.current?.focus();
    }
  }, [viewMode, session.incident.completionReached, activeNarrative]);

  const performAction = (actionId: string) => {
    const action = session.scenario.actions.find(({ id }) => id === actionId);
    const result = session.performAction(actionId);
    if (!result.ok) return;
    const narrativeEvent = result.events.find(({ type }) => type === 'narrative_triggered');
    if (narrativeEvent?.sourceId !== undefined) {
      setActiveNarrativeId(narrativeEvent.sourceId);
      setActiveTool('logs');
    } else if (result.state.completionReached) {
      setViewMode('postmortem');
    } else if (action !== undefined) {
      const nextTool = chooseTool(action);
      setActiveTool(nextTool);
      if (nextTool === 'war-room') warRoomTabRef.current?.focus();
    }
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
    setActiveNarrativeId(null);
    setActiveTool('metrics');
    setViewMode('incident');
  };

  const requestSave = (trigger?: HTMLButtonElement) => {
    if (trigger !== undefined) saveTriggerRef.current = trigger;
    const result = session.save();
    if (!result.ok && result.code === 'OVERWRITE_CONFIRMATION_REQUIRED') {
      setOverwritePrompt(
        result.existingScenarioId === undefined
          ? null
          : { scenarioId: result.existingScenarioId, message: result.message },
      );
    }
  };

  const confirmOverwrite = () => {
    if (overwritePrompt === null) return;
    const result = session.save(overwritePrompt.scenarioId);
    setOverwritePrompt(
      !result.ok &&
        result.code === 'OVERWRITE_CONFIRMATION_REQUIRED' &&
        result.existingScenarioId !== undefined
        ? { scenarioId: result.existingScenarioId, message: result.message }
        : null,
    );
  };

  const overwriteDialog =
    overwritePrompt === null ? null : (
      <div className="narrative-overlay">
        <section
          aria-describedby="overwrite-description"
          aria-labelledby="overwrite-title"
          aria-modal="true"
          className="narrative-dialog"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOverwritePrompt(null);
            if (event.key === 'Tab') {
              const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
              const first = buttons[0];
              const last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
          role="alertdialog"
        >
          <span className="narrative-channel">Single local save slot</span>
          <h2 id="overwrite-title">Replace the local save?</h2>
          <p id="overwrite-description">
            {overwritePrompt.message} Recovered campaign evidence remains separate.
          </p>
          <button onClick={() => setOverwritePrompt(null)} type="button">
            Keep existing save
          </button>
          <button ref={confirmOverwriteRef} onClick={confirmOverwrite} type="button">
            Confirm replacement
          </button>
        </section>
      </div>
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

  if (viewMode === 'postmortem' && session.incident.completionReached) {
    return (
      <>
        <div inert={overwritePrompt !== null}>
          <PresentationSettings
            onChange={setPresentationPreferences}
            preferences={presentationPreferences}
          />
          <Postmortem
            report={computePostmortem(session.scenario, session.incident)}
            persistenceNotice={session.persistenceNotice}
            persistenceError={session.persistenceError?.message ?? null}
            onSave={requestSave}
            onLoad={loadSession}
            onReturn={() => setViewMode('incident')}
            onRestart={restartSession}
            onBackToDesk={onBackToDesk}
            reviewOnly={reviewOnly}
          />
        </div>
        {overwriteDialog}
      </>
    );
  }

  return (
    <>
      <main
        className="operations-shell"
        inert={activeNarrative !== undefined || overwritePrompt !== null}
      >
        <PresentationSettings
          onChange={setPresentationPreferences}
          preferences={presentationPreferences}
        />
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
              <h1>{session.scenario.title}</h1>
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
                    <span className="stream-state">● LIVE BUFFER</span>
                  </div>
                  <div className="log-lines" aria-label="Incident log entries">
                    <p>
                      <time>00:00:00</time>
                      <span className="log-level log-level--critical">CRITICAL</span>
                      {session.scenario.incident.trigger.label}
                    </p>
                    {session.scenario.incident.symptoms.map((symptom) => (
                      <p key={symptom.id}>
                        <time>{formatElapsed(session.incident.elapsedSeconds)}</time>
                        <span className="log-level">OBSERVE</span>
                        {symptom.label}
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
                              : humanize(signal.serviceId)}
                          </span>
                          <strong>{formatSignalValue(signal.id, signal.value)}</strong>
                          <p>{humanize(signal.id)}</p>
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
                            <th scope="row">{humanize(signal.id)}</th>
                            <td data-label="Value">{formatSignalValue(signal.id, signal.value)}</td>
                            <td data-label="Source">
                              {signal.serviceId === undefined
                                ? 'Incident'
                                : humanize(signal.serviceId)}
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

            <section className="activity-strip" aria-labelledby="activity-title">
              <div className="activity-heading">
                <div>
                  <span>Engine event stream</span>
                  <h2 id="activity-title">Observable results</h2>
                </div>
                <span>{session.incident.eventLog.length} EVENTS</span>
              </div>
              {recentEvents.length === 0 ? (
                <p className="activity-empty">Awaiting operator action.</p>
              ) : (
                <ol className="activity-list" tabIndex={0} aria-label="Recent incident events">
                  {recentEvents.map((event) => (
                    <li key={event.sequence}>
                      <time>{formatElapsed(event.atSeconds)}</time>
                      <span>{describeEvent(event)}</span>
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
                : 'Only actions available in the current incident state are shown.'}
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
                    onClick={() => performAction(action.id)}
                    type="button"
                  >
                    {action.title}
                  </button>
                  <p>
                    {action.requirements.length === 0
                      ? 'Available now'
                      : action.requirements.map(formatCondition).join(' · ')}
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
              <button className="restart-button" onClick={restartSession} type="button">
                Restart incident session
              </button>
            )}
          </aside>
        </div>
      </main>
      {activeNarrative !== undefined && (
        <div className="narrative-overlay">
          <section
            aria-describedby="narrative-body"
            aria-labelledby="narrative-title"
            aria-modal="true"
            className="narrative-dialog"
            role="dialog"
          >
            <span className="narrative-channel">Incident log buffer // transient signal</span>
            <h2 id="narrative-title">{activeNarrative.title}</h2>
            <p id="narrative-body">{activeNarrative.body}</p>
            <button
              ref={narrativeContinueRef}
              onClick={() => {
                setActiveNarrativeId(null);
                if (session.incident.completionReached) setViewMode('postmortem');
              }}
              type="button"
            >
              Continue incident
            </button>
          </section>
        </div>
      )}
      {overwriteDialog}
    </>
  );
}

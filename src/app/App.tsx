import { useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import type { EngineEvent, ScalarValue } from '../engine/index.ts';
import { inc001Scenario } from '../scenario/index.ts';
import {
  createIncidentSessionStore,
  selectAvailableActions,
  selectRevealedSignals,
  type IncidentSessionState,
} from '../store/incident-session.ts';

type ToolId = 'logs' | 'metrics' | 'database' | 'status';

const defaultSessionStore = createIncidentSessionStore(inc001Scenario, 1001);

const tools: readonly { id: ToolId; label: string; shortcut: string }[] = [
  { id: 'logs', label: 'Logs', shortcut: '01' },
  { id: 'metrics', label: 'Metrics', shortcut: '02' },
  { id: 'database', label: 'Database', shortcut: '03' },
  { id: 'status', label: 'Status', shortcut: '04' },
];

export interface AppProps {
  store?: StoreApi<IncidentSessionState>;
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
    default:
      return humanize(event.type);
  }
}

function chooseTool(action: IncidentSessionState['scenario']['actions'][number]): ToolId {
  const text = `${action.id} ${action.title}`.toLowerCase();
  if (text.includes('log')) return 'logs';
  if (text.includes('metric')) return 'metrics';
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

export function App({ store = defaultSessionStore }: AppProps) {
  const session = useStore(store);
  const [activeTool, setActiveTool] = useState<ToolId>('metrics');
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

  const performAction = (actionId: string) => {
    const action = session.scenario.actions.find(({ id }) => id === actionId);
    const result = session.performAction(actionId);
    if (result.ok && action !== undefined) setActiveTool(chooseTool(action));
  };

  return (
    <main className="operations-shell">
      <header className="incident-header">
        <div className="brand-lockup">
          <p className="eyebrow">VANTAGE SYSTEMS // PRODUCTION RELIABILITY</p>
          <p className="brand">ORPHEUS</p>
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
            {tools.map((tool) => (
              <button
                aria-controls={`tool-panel-${tool.id}`}
                aria-selected={activeTool === tool.id}
                className={activeTool === tool.id ? 'tool-tab tool-tab--active' : 'tool-tab'}
                id={`tool-tab-${tool.id}`}
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                role="tab"
                type="button"
              >
                <span>{tool.shortcut}</span> {tool.label}
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`tool-tab-${activeTool}`}
            className="tool-panel"
            id={`tool-panel-${activeTool}`}
            role="tabpanel"
          >
            {activeTool === 'logs' && (
              <div className="terminal-view">
                <div className="view-heading">
                  <div>
                    <span>Payment request stream</span>
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
                  {session.incident.triggeredNarrativeIds.map((id) => {
                    const narrative = session.scenario.narratives.find((item) => item.id === id);
                    return narrative === undefined ? null : (
                      <p className="log-anomaly" key={id}>
                        <time>{formatElapsed(session.incident.elapsedSeconds)}</time>
                        <span className="log-level">UNKNOWN</span>
                        {narrative.body}
                      </p>
                    );
                  })}
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
                          {signal.serviceId === undefined ? 'INCIDENT' : humanize(signal.serviceId)}
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
                    <span>PostgreSQL diagnostics</span>
                    <h2>Session investigation</h2>
                  </div>
                  <span className="stream-state">● QUERY CONSOLE</span>
                </div>
                {newDiscoveries.length === 0 ? (
                  <div className="empty-state">
                    <span aria-hidden="true">⌁</span>
                    <strong>No session detail captured</strong>
                    <p>
                      Inspect PostgreSQL, then inspect database sessions to reveal active findings.
                    </p>
                  </div>
                ) : (
                  <table className="discovery-table">
                    <caption>Newly revealed database observations</caption>
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
                          <td>{formatSignalValue(signal.id, signal.value)}</td>
                          <td>
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
          </div>

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
              <ol className="activity-list">
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
            Only actions available in the current incident state are shown.
          </p>

          <div className="action-list">
            {availableActions.map((action) => (
              <article className="action-card" key={action.id}>
                <div className="action-meta">
                  <span>{action.category}</span>
                  <span>+{formatElapsed(action.durationSeconds)}</span>
                </div>
                <button onClick={() => performAction(action.id)} type="button">
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

          <button className="restart-button" onClick={() => session.restart()} type="button">
            Restart incident session
          </button>
        </aside>
      </div>
    </main>
  );
}

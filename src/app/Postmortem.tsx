import { useEffect, useRef } from 'react';

import type { PostmortemMetric, PostmortemReport } from '../engine/index.ts';
import {
  formatElapsed,
  formatScalar,
  formatSignalValue,
  humanize,
  signalDirectory,
  signalLabel,
  type SignalDirectory,
  type SignalPresentation,
} from './format.ts';

export interface PostmortemProps {
  readonly report: PostmortemReport;
  readonly persistenceNotice: string | null;
  readonly persistenceError: string | null;
  readonly onSave: (trigger: HTMLButtonElement) => void;
  readonly onLoad: () => void;
  readonly onReturn: () => void;
  readonly onRestart: (trigger: HTMLButtonElement) => void;
  readonly onBackToDesk?: () => void;
  readonly reviewOnly?: boolean;
  readonly signals?: readonly SignalPresentation[];
}

function formatMetric(metric: PostmortemMetric, directory: SignalDirectory): string {
  return metric.source === 'elapsed_time'
    ? formatElapsed(Number(metric.value))
    : formatSignalValue(metric.refId ?? '', metric.value, directory);
}

export function Postmortem({
  report,
  persistenceNotice,
  persistenceError,
  onSave,
  onLoad,
  onReturn,
  onRestart,
  onBackToDesk,
  reviewOnly = false,
  signals,
}: PostmortemProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const directory = signalDirectory(signals);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="postmortem-shell">
      <header className="postmortem-header">
        <div>
          <p className="eyebrow">VANTAGE SYSTEMS // INCIDENT ARCHIVE</p>
          <p className="postmortem-kicker">{report.scenarioId} / RESPONSE RECORD</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Incident postmortem
          </h1>
          <p>
            {report.scenarioTitle} · Reconstructed from the incident state and recorded actions.
          </p>
        </div>
        <div className="postmortem-header-actions">
          {onBackToDesk && (
            <button onClick={onBackToDesk} type="button">
              Incident desk
            </button>
          )}
          <button onClick={onReturn} type="button">
            Return to incident record
          </button>
          {!reviewOnly && (
            <button onClick={(event) => onRestart(event.currentTarget)} type="button">
              Restart incident
            </button>
          )}
        </div>
      </header>

      <section className="postmortem-section" aria-labelledby="postmortem-outcomes">
        <div className="postmortem-section-heading">
          <span>01 / Measured outcomes</span>
          <h2 id="postmortem-outcomes">What the response changed</h2>
          <p>
            These are observations, not a grade. Time, impact, risk, and action counts come from the
            completed incident.
          </p>
        </div>
        <div className="postmortem-metrics">
          {report.metrics.map((metric) => (
            <article key={metric.id}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric, directory)}</strong>
              <small>{metric.source.replace('_', ' ')}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="postmortem-columns">
        <section className="postmortem-section" aria-labelledby="postmortem-cause">
          <div className="postmortem-section-heading">
            <span>02 / Root cause</span>
            <h2 id="postmortem-cause">Failure mechanism</h2>
          </div>
          <div className="postmortem-stack">
            {report.mechanisms.map((mechanism) => (
              <article className="postmortem-finding" key={mechanism.id}>
                <span>{mechanism.resolved ? 'CONTAINED' : 'NOT CONTAINED'}</span>
                <h3>{mechanism.label}</h3>
                {mechanism.description && <p>{mechanism.description}</p>}
              </article>
            ))}
          </div>
        </section>

        <section className="postmortem-section" aria-labelledby="postmortem-communication">
          <div className="postmortem-section-heading">
            <span>03 / Communication</span>
            <h2 id="postmortem-communication">Recorded updates</h2>
          </div>
          {report.communicationActions.length === 0 ? (
            <p className="postmortem-empty">No status update was recorded during this response.</p>
          ) : (
            <ol className="postmortem-list">
              {report.communicationActions.map((action) => (
                <li key={action.sequence}>
                  <strong>{action.title}</strong>
                  <span>
                    Action {action.sequence + 1} · {formatElapsed(action.durationSeconds)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="postmortem-section" aria-labelledby="postmortem-interventions">
        <div className="postmortem-section-heading">
          <span>04 / Causal review</span>
          <h2 id="postmortem-interventions">Mitigation and additional interventions</h2>
          <p>
            Non-resolving actions may have changed telemetry or bought time, but did not themselves
            contain a failure mechanism.
          </p>
        </div>
        {report.nonResolvingInterventions.length === 0 ? (
          <p className="postmortem-empty">No non-resolving intervention was recorded.</p>
        ) : (
          <div className="postmortem-stack">
            {report.nonResolvingInterventions.map((action) => (
              <article className="postmortem-finding" key={action.id}>
                <span>
                  {action.count} × {formatElapsed(action.durationSeconds)} EACH
                </span>
                <h3>{action.title}</h3>
                <p>
                  Did not contain the root cause. This describes its observed effect, not whether
                  the choice was right or wrong.
                </p>
                {action.signalChanges.length > 0 && (
                  <ul>
                    {action.signalChanges.map((change, index) => (
                      <li key={`${change.signalId}-${index}`}>
                        {signalLabel(change.signalId, directory)}:{' '}
                        {change.previousValue === undefined
                          ? '—'
                          : formatSignalValue(
                              change.signalId,
                              change.previousValue,
                              directory,
                            )}{' '}
                        →{' '}
                        {change.value === undefined
                          ? '—'
                          : formatSignalValue(change.signalId, change.value, directory)}
                      </li>
                    ))}
                  </ul>
                )}
                {action.resourceChanges.length > 0 && (
                  <ul>
                    {action.resourceChanges.map((change, index) => (
                      <li key={`${change.resourceId}-${index}`}>
                        {humanize(change.resourceId)}:{' '}
                        {change.previousValue === undefined
                          ? '—'
                          : formatScalar(change.previousValue)}{' '}
                        → {change.value === undefined ? '—' : formatScalar(change.value)}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
        {report.temporaryEffects.length > 0 && (
          <div className="postmortem-subsection">
            <h3>Temporary windows</h3>
            <ul>
              {report.temporaryEffects.map((effect, index) => (
                <li key={`${effect.effectId}-${index}`}>
                  {effect.actionTitle}: {humanize(effect.effectId)} started at{' '}
                  {formatElapsed(effect.startedAtSeconds)} and{' '}
                  {effect.expiredAtSeconds === undefined
                    ? 'remained active at the end of this record'
                    : `expired at ${formatElapsed(effect.expiredAtSeconds)}`}
                  .
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.firedEventIds.length > 0 && (
          <div className="postmortem-subsection">
            <h3>Delayed conditions observed</h3>
            <ul>
              {report.firedEventIds.map((id, index) => (
                <li key={`${id}-${index}`}>{humanize(id)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="postmortem-section" aria-labelledby="postmortem-actions">
        <div className="postmortem-section-heading">
          <span>05 / Action record</span>
          <h2 id="postmortem-actions">What happened, in order</h2>
        </div>
        <ol className="postmortem-list">
          {report.actions.map((action) => (
            <li key={action.sequence}>
              <strong>{action.title}</strong>
              <span>
                #{action.sequence + 1} · {action.category} · {formatElapsed(action.durationSeconds)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="postmortem-footer">
        {!reviewOnly && (
          <div className="session-controls" aria-label="Local session save controls" role="group">
            <button onClick={(event) => onSave(event.currentTarget)} type="button">
              Save session
            </button>
            <button onClick={onLoad} type="button">
              Load saved session
            </button>
          </div>
        )}
        {persistenceNotice !== null && (
          <p className="persistence-notice" role="status">
            {persistenceNotice}
          </p>
        )}
        {persistenceError !== null && (
          <p className="command-error" role="alert">
            {persistenceError}
          </p>
        )}
      </footer>
    </main>
  );
}

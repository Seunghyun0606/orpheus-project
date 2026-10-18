import { useEffect, useRef } from 'react';

import type { PostmortemMetric, PostmortemReport } from '../engine/index.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import {
  formatElapsed,
  formatScalar,
  humanize,
  signalDirectory,
  type SignalPresentation,
} from './format.ts';
import { localizedSignals, type LocalizedSignals } from './localized-format.ts';
import { actionCategoryLabels } from './messages/incident-terms.ts';
import { postmortemMessages } from './messages/postmortem.ts';

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

function formatMetric(metric: PostmortemMetric, signals: LocalizedSignals): string {
  return metric.source === 'elapsed_time'
    ? formatElapsed(Number(metric.value))
    : signals.value(metric.refId ?? '', metric.value);
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
  const m = useMessages(postmortemMessages);
  const categoryLabel = useMessages(actionCategoryLabels);
  const i18n = useI18n();
  const { ct, locale } = i18n;
  const localized = localizedSignals(signalDirectory(signals), i18n);
  const scalar = (value: Parameters<typeof formatScalar>[0]) =>
    typeof value === 'string' ? ct(value) : formatScalar(value, undefined, locale);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="postmortem-shell">
      <header className="postmortem-header">
        <div>
          <p className="eyebrow">{m.eyebrow}</p>
          <p className="postmortem-kicker">{m.kicker(report.scenarioId)}</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {m.title}
          </h1>
          <p>{m.subtitle(ct(report.scenarioTitle))}</p>
        </div>
        <div className="postmortem-header-actions">
          {onBackToDesk && (
            <button onClick={onBackToDesk} type="button">
              {m.incidentDesk}
            </button>
          )}
          <button onClick={onReturn} type="button">
            {m.returnToRecord}
          </button>
          {!reviewOnly && (
            <button onClick={(event) => onRestart(event.currentTarget)} type="button">
              {m.restartIncident}
            </button>
          )}
        </div>
      </header>

      <section className="postmortem-section" aria-labelledby="postmortem-outcomes">
        <div className="postmortem-section-heading">
          <span>{m.outcomesEyebrow}</span>
          <h2 id="postmortem-outcomes">{m.outcomesTitle}</h2>
          <p>{m.outcomesIntro}</p>
        </div>
        <div className="postmortem-metrics">
          {report.metrics.map((metric) => (
            <article key={metric.id}>
              <span>{ct(metric.label)}</span>
              <strong>{formatMetric(metric, localized)}</strong>
              <small>{m.metricSource[metric.source]}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="postmortem-columns">
        <section className="postmortem-section" aria-labelledby="postmortem-cause">
          <div className="postmortem-section-heading">
            <span>{m.causeEyebrow}</span>
            <h2 id="postmortem-cause">{m.causeTitle}</h2>
          </div>
          <div className="postmortem-stack">
            {report.mechanisms.map((mechanism) => (
              <article className="postmortem-finding" key={mechanism.id}>
                <span>{mechanism.resolved ? m.contained : m.notContained}</span>
                <h3>{ct(mechanism.label)}</h3>
                {mechanism.description && <p>{ct(mechanism.description)}</p>}
              </article>
            ))}
          </div>
        </section>

        <section className="postmortem-section" aria-labelledby="postmortem-communication">
          <div className="postmortem-section-heading">
            <span>{m.communicationEyebrow}</span>
            <h2 id="postmortem-communication">{m.communicationTitle}</h2>
          </div>
          {report.communicationActions.length === 0 ? (
            <p className="postmortem-empty">{m.noCommunication}</p>
          ) : (
            <ol className="postmortem-list">
              {report.communicationActions.map((action) => (
                <li key={action.sequence}>
                  <strong>{ct(action.title)}</strong>
                  <span>
                    {m.communicationAction(
                      action.sequence + 1,
                      formatElapsed(action.durationSeconds),
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="postmortem-section" aria-labelledby="postmortem-interventions">
        <div className="postmortem-section-heading">
          <span>{m.interventionsEyebrow}</span>
          <h2 id="postmortem-interventions">{m.interventionsTitle}</h2>
          <p>{m.interventionsIntro}</p>
        </div>
        {report.nonResolvingInterventions.length === 0 ? (
          <p className="postmortem-empty">{m.noInterventions}</p>
        ) : (
          <div className="postmortem-stack">
            {report.nonResolvingInterventions.map((action) => (
              <article className="postmortem-finding" key={action.id}>
                <span>
                  {m.interventionCount(action.count, formatElapsed(action.durationSeconds))}
                </span>
                <h3>{ct(action.title)}</h3>
                <p>{m.interventionNote}</p>
                {action.signalChanges.length > 0 && (
                  <ul>
                    {action.signalChanges.map((change, index) => (
                      <li key={`${change.signalId}-${index}`}>
                        {localized.label(change.signalId)}:{' '}
                        {change.previousValue === undefined
                          ? '—'
                          : localized.value(change.signalId, change.previousValue)}{' '}
                        →{' '}
                        {change.value === undefined
                          ? '—'
                          : localized.value(change.signalId, change.value)}
                      </li>
                    ))}
                  </ul>
                )}
                {action.resourceChanges.length > 0 && (
                  <ul>
                    {action.resourceChanges.map((change, index) => (
                      <li key={`${change.resourceId}-${index}`}>
                        {ct(humanize(change.resourceId))}:{' '}
                        {change.previousValue === undefined ? '—' : scalar(change.previousValue)} →{' '}
                        {change.value === undefined ? '—' : scalar(change.value)}
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
            <h3>{m.temporaryWindows}</h3>
            <ul>
              {report.temporaryEffects.map((effect, index) => (
                <li key={`${effect.effectId}-${index}`}>
                  {m.temporaryWindow(
                    ct(effect.actionTitle),
                    ct(humanize(effect.effectId)),
                    formatElapsed(effect.startedAtSeconds),
                    effect.expiredAtSeconds === undefined
                      ? undefined
                      : formatElapsed(effect.expiredAtSeconds),
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.firedEventIds.length > 0 && (
          <div className="postmortem-subsection">
            <h3>{m.delayedConditions}</h3>
            <ul>
              {report.firedEventIds.map((id, index) => (
                <li key={`${id}-${index}`}>{ct(humanize(id))}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="postmortem-section" aria-labelledby="postmortem-actions">
        <div className="postmortem-section-heading">
          <span>{m.actionsEyebrow}</span>
          <h2 id="postmortem-actions">{m.actionsTitle}</h2>
        </div>
        <ol className="postmortem-list">
          {report.actions.map((action) => (
            <li key={action.sequence}>
              <strong>{ct(action.title)}</strong>
              <span>
                #{action.sequence + 1} · {categoryLabel[action.category]} ·{' '}
                {formatElapsed(action.durationSeconds)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="postmortem-footer">
        {!reviewOnly && (
          <div className="session-controls" aria-label={m.saveControls} role="group">
            <button onClick={(event) => onSave(event.currentTarget)} type="button">
              {m.saveSession}
            </button>
            <button onClick={onLoad} type="button">
              {m.loadSession}
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

import { useMemo } from 'react';
import type { ScalarValue } from '../engine/index.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { projectCampaignInvestigation } from '../engine/campaign/investigation.ts';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { attemptScenario, closedPanelActions, forecastComparisons } from './campaign-copy.ts';
import {
  formatElapsed,
  formatScalar,
  formatSignalValue,
  humanize,
  signalDirectory,
  signalLabel,
} from './format.ts';
import { campaignToolsMessages } from './messages/campaign-tools.ts';

function evidenceTitle(composition: ResolvedCampaignPackage, id: string): string {
  const entry = composition.definition.evidence.find((item) => item.id === id);
  if (entry !== undefined)
    for (const scenario of composition.catalog.values())
      if (scenario.id === entry.scenarioId) {
        const evidence = scenario.evidence.find((item) => item.id === entry.evidenceId);
        if (evidence !== undefined) return evidence.title;
      }
  return humanize(id);
}

export function CampaignTools({
  composition,
  run,
  attemptId,
  actions,
  disabled,
  readOnly,
  onAction,
}: {
  composition: ResolvedCampaignPackage;
  run: CampaignRun;
  attemptId: string;
  actions: readonly { id: string; title: string; durationSeconds: number }[];
  disabled: boolean;
  readOnly: boolean;
  onAction: (id: string) => void;
}) {
  const { locale, ct } = useI18n();
  const m = useMessages(campaignToolsMessages);
  const view = useMemo(
    () => projectCampaignInvestigation(composition, run, attemptId),
    [composition, run, attemptId],
  );
  const attempt = run.attempts.find((a) => a.id === attemptId);
  const scenario = attempt === undefined ? undefined : attemptScenario(composition, attempt);
  const directory = signalDirectory(scenario?.initialState.signals);
  const comparisons = attempt === undefined ? [] : forecastComparisons(run, attemptId, scenario);
  // Authored string values are translated; numbers and booleans are formatted.
  const valueText = (formatted: string, value: ScalarValue) =>
    typeof value === 'string' ? ct(formatted) : formatted;
  if (!view.ok) return <p role="alert">{m.fileUnavailable(view.diagnostics.join(', '))}</p>;

  const closedActions = (actionIds: readonly string[]) =>
    attempt === undefined
      ? []
      : closedPanelActions(composition.definition, attempt, scenario, actionIds, actions, locale);

  return (
    <section aria-label={m.toolsLabel} className="campaign-tools">
      {view.diagnostics.length ? <p role="alert">{m.viewDiagnostics}</p> : null}
      {view.panels.map((panel) => {
        const closed = readOnly ? [] : closedActions(panel.actionIds);
        const open = readOnly ? [] : actions.filter((a) => panel.actionIds.includes(a.id));
        const panelTitle = ct(panel.title);
        return (
          <section className="panel console-panel" key={panel.id} aria-label={panelTitle}>
            <h2>{panelTitle}</h2>
            {panel.blocks.map((block, blockIndex) =>
              block.kind === 'paragraph' ? (
                <p className="campaign-document-text" key={block.id}>
                  {ct(block.text)}
                </p>
              ) : block.kind === 'table' ? (
                <div
                  className="campaign-table-scroll"
                  key={block.id}
                  tabIndex={0}
                  role="region"
                  aria-label={m.tableRegion(panelTitle, blockIndex + 1)}
                >
                  <table>
                    <caption>{m.tableCaption(panelTitle, blockIndex + 1)}</caption>
                    <thead>
                      <tr>
                        {block.columns.map((c, i) => (
                          <th key={i} scope="col">
                            {ct(c)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{ct(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : block.kind === 'narrative_stream' ? (
                <section key={block.id} aria-label={m.narrativeLabel}>
                  <p className="console-hint">{readOnly ? m.narrativeArchived : m.narrativeLive}</p>
                  {block.messages.map((message) => (
                    <article className="console-message" key={message.key}>
                      <h3>{ct(message.title)}</h3>
                      <p>
                        <time>{formatElapsed(message.atSeconds)}</time>
                      </p>
                      <p className="campaign-document-text">{ct(message.body)}</p>
                    </article>
                  ))}
                </section>
              ) : block.kind === 'war_room_stream' ? (
                <section key={block.id} aria-label={m.warRoomLabel}>
                  {block.messages.map((message) => (
                    <p key={message.key}>
                      <time>{formatElapsed(message.atSeconds)}</time> {ct(message.sender)}:{' '}
                      {ct(message.text)}
                    </p>
                  ))}
                  {block.pending.map((w) => (
                    <p key={w.key}>
                      {m.pending(
                        ct(w.role),
                        ct(w.title),
                        formatElapsed(w.dueAtSeconds),
                        formatElapsed(w.remainingSeconds),
                      )}
                    </p>
                  ))}
                  {block.capacity.map((c) => (
                    <p key={c.id}>
                      {ct(humanize(c.id))}: {c.value}
                      {c.max === undefined ? '' : ` / ${c.max}`}
                    </p>
                  ))}
                </section>
              ) : (
                <dl className="console-values" key={block.id}>
                  {block.values.map((v) => (
                    <div key={v.id}>
                      <dt>{ct(signalLabel(v.id, directory))}</dt>
                      <dd>
                        {valueText(formatSignalValue(v.id, v.value, directory, locale), v.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ),
            )}
            {open.length || closed.length ? (
              <div className="console-actions" role="group" aria-label={m.panelActions(panelTitle)}>
                {open.map((a) => (
                  <div className="console-action" key={a.id}>
                    <button
                      type="button"
                      data-onboarding-target={`action:${a.id}`}
                      aria-describedby={`action-cost-${panel.id}-${a.id}`}
                      disabled={disabled}
                      onClick={() => onAction(a.id)}
                    >
                      {ct(a.title)}
                    </button>
                    <span className="console-action-cost" id={`action-cost-${panel.id}-${a.id}`}>
                      {m.takes(formatElapsed(a.durationSeconds))}
                    </span>
                  </div>
                ))}
                {closed.map((a) => (
                  <div className="console-action console-action--closed" key={a.id}>
                    <button
                      type="button"
                      aria-describedby={`action-reason-${panel.id}-${a.id}`}
                      disabled
                    >
                      {ct(a.title)}
                    </button>
                    <span className="console-action-cost" id={`action-reason-${panel.id}-${a.id}`}>
                      {a.reason}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
      {view.relations.length ? (
        <section className="panel console-panel" aria-label={m.relationsLabel}>
          <h2>{m.relationsTitle}</h2>
          <ul>
            {view.relations.map((e) => (
              <li key={e.id}>
                {ct(evidenceTitle(composition, e.from))} — {ct(e.label)} —{' '}
                {ct(evidenceTitle(composition, e.to))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.postmortem ? (
        <section className="panel console-panel" aria-label={m.postmortemLabel}>
          <h2>{m.postmortemTitle}</h2>
          <p className="console-hint">{m.postmortemNote}</p>
          <dl className="console-values">
            {view.postmortem.metrics.map((metric) => (
              <div key={metric.id}>
                <dt>{ct(metric.label)}</dt>
                <dd>
                  {metric.source === 'elapsed_time'
                    ? formatElapsed(Number(metric.value))
                    : metric.refId === undefined
                      ? valueText(formatScalar(metric.value, undefined, locale), metric.value)
                      : valueText(
                          formatSignalValue(metric.refId, metric.value, directory, locale),
                          metric.value,
                        )}
                </dd>
              </div>
            ))}
          </dl>
          {comparisons.length ? (
            <section aria-label={m.forecastTitle}>
              <h3>{m.forecastTitle}</h3>
              <ul className="forecast-list">
                {comparisons.map((c) => (
                  <li key={c.key}>
                    <span>{m.forecast(ct(c.predicted), c.confidence)}</span>
                    <span>{m.you(ct(c.actual))}</span>
                    <strong>{c.matched ? m.matched : m.different}</strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

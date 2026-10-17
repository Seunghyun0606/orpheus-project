import { useMemo } from 'react';
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
  const view = useMemo(
    () => projectCampaignInvestigation(composition, run, attemptId),
    [composition, run, attemptId],
  );
  const attempt = run.attempts.find((a) => a.id === attemptId);
  const scenario = attempt === undefined ? undefined : attemptScenario(composition, attempt);
  const directory = signalDirectory(scenario?.initialState.signals);
  const comparisons = attempt === undefined ? [] : forecastComparisons(run, attemptId, scenario);
  if (!view.ok)
    return (
      <p role="alert">
        This incident file could not be opened. Technical detail: {view.diagnostics.join(', ')}
      </p>
    );

  const closedActions = (actionIds: readonly string[]) =>
    attempt === undefined
      ? []
      : closedPanelActions(composition.definition, attempt, scenario, actionIds, actions);

  return (
    <section aria-label="Campaign investigation tools" className="campaign-tools">
      {view.diagnostics.length ? (
        <p role="alert">Some investigation views could not be shown for this record.</p>
      ) : null}
      {view.panels.map((panel) => {
        const closed = readOnly ? [] : closedActions(panel.actionIds);
        const open = readOnly ? [] : actions.filter((a) => panel.actionIds.includes(a.id));
        return (
          <section className="panel console-panel" key={panel.id} aria-label={panel.title}>
            <h2>{panel.title}</h2>
            {panel.blocks.map((block, blockIndex) =>
              block.kind === 'paragraph' ? (
                <p className="campaign-document-text" key={block.id}>
                  {block.text}
                </p>
              ) : block.kind === 'table' ? (
                <div
                  className="campaign-table-scroll"
                  key={block.id}
                  tabIndex={0}
                  role="region"
                  aria-label={`${panel.title}: table ${blockIndex + 1}, scroll to read`}
                >
                  <table>
                    <caption>
                      Table {blockIndex + 1} — {panel.title}
                    </caption>
                    <thead>
                      <tr>
                        {block.columns.map((c, i) => (
                          <th key={i} scope="col">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : block.kind === 'narrative_stream' ? (
                <section key={block.id} aria-label="Recorded narrative history">
                  <p className="console-hint">
                    {readOnly
                      ? 'Archived record. Nothing new is delivered while you read it.'
                      : 'Messages recovered during this incident.'}
                  </p>
                  {block.messages.map((m) => (
                    <article className="console-message" key={m.key}>
                      <h3>{m.title}</h3>
                      <p>
                        <time>{formatElapsed(m.atSeconds)}</time>
                      </p>
                      <p className="campaign-document-text">{m.body}</p>
                    </article>
                  ))}
                </section>
              ) : block.kind === 'war_room_stream' ? (
                <section key={block.id} aria-label="Recorded War Room">
                  {block.messages.map((m) => (
                    <p key={m.key}>
                      <time>{formatElapsed(m.atSeconds)}</time> {m.sender}: {m.text}
                    </p>
                  ))}
                  {block.pending.map((w) => (
                    <p key={w.key}>
                      {w.role}: {w.title}. Due at {formatElapsed(w.dueAtSeconds)} (
                      {formatElapsed(w.remainingSeconds)} of action time left).
                    </p>
                  ))}
                  {block.capacity.map((c) => (
                    <p key={c.id}>
                      {humanize(c.id)}: {c.value}
                      {c.max === undefined ? '' : ` / ${c.max}`}
                    </p>
                  ))}
                </section>
              ) : (
                <dl className="console-values" key={block.id}>
                  {block.values.map((v) => (
                    <div key={v.id}>
                      <dt>{signalLabel(v.id, directory)}</dt>
                      <dd>{formatSignalValue(v.id, v.value, directory)}</dd>
                    </div>
                  ))}
                </dl>
              ),
            )}
            {open.length || closed.length ? (
              <div className="console-actions" role="group" aria-label={`${panel.title} actions`}>
                {open.map((a) => (
                  <div className="console-action" key={a.id}>
                    <button
                      type="button"
                      aria-describedby={`action-cost-${panel.id}-${a.id}`}
                      disabled={disabled}
                      onClick={() => onAction(a.id)}
                    >
                      {a.title}
                    </button>
                    <span className="console-action-cost" id={`action-cost-${panel.id}-${a.id}`}>
                      Takes {formatElapsed(a.durationSeconds)}
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
                      {a.title}
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
        <section className="panel console-panel" aria-label="Verified evidence relationships">
          <h2>How the evidence connects</h2>
          <ul>
            {view.relations.map((e) => (
              <li key={e.id}>
                {evidenceTitle(composition, e.from)} — {e.label} —{' '}
                {evidenceTitle(composition, e.to)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.postmortem ? (
        <section className="panel console-panel" aria-label="Campaign postmortem">
          <h2>Incident closed — postmortem</h2>
          <p className="console-hint">Observations from your response, not a grade.</p>
          <dl className="console-values">
            {view.postmortem.metrics.map((m) => (
              <div key={m.id}>
                <dt>{m.label}</dt>
                <dd>
                  {m.source === 'elapsed_time'
                    ? formatElapsed(Number(m.value))
                    : m.refId === undefined
                      ? formatScalar(m.value)
                      : formatSignalValue(m.refId, m.value, directory)}
                </dd>
              </div>
            ))}
          </dl>
          {comparisons.length ? (
            <section aria-label="ORPHEUS forecast vs what you did">
              <h3>ORPHEUS forecast vs what you did</h3>
              <ul className="forecast-list">
                {comparisons.map((c) => (
                  <li key={c.key}>
                    <span>
                      Forecast: {c.predicted} ({c.confidence})
                    </span>
                    <span>You: {c.actual}</span>
                    <strong>{c.matched ? 'As forecast' : 'Different from the forecast'}</strong>
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

import { useMemo } from 'react';
import { projectCampaignInvestigation } from '../engine/campaign/investigation.ts';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';

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
  if (!view.ok)
    return <p role="alert">Investigation authority unavailable: {view.diagnostics.join(', ')}</p>;
  return (
    <section aria-label="Campaign investigation tools">
      {view.diagnostics.length ? (
        <p role="alert">Some investigation views require valid observations.</p>
      ) : null}
      {view.panels.map((panel) => (
        <section className="panel" key={panel.id} aria-label={panel.title}>
          <h2>{panel.title}</h2>
          {panel.blocks.map((block) =>
            block.kind === 'paragraph' ? (
              <p key={block.id}>{block.text}</p>
            ) : block.kind === 'table' ? (
              <div className="campaign-table-scroll" key={block.id}>
                <table>
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
            ) : (
              <dl key={block.id}>
                {block.values.map((v) => (
                  <div key={v.id}>
                    <dt>{v.id}</dt>
                    <dd>{String(v.value)}</dd>
                  </div>
                ))}
              </dl>
            ),
          )}
          {!readOnly
            ? actions
                .filter((a) => panel.actionIds.includes(a.id))
                .map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    disabled={disabled}
                    onClick={() => onAction(a.id)}
                  >
                    {a.title} (+{a.durationSeconds}s)
                  </button>
                ))
            : null}
        </section>
      ))}
      {view.relations.length ? (
        <section aria-label="Verified evidence relationships">
          <h2>Evidence relationships</h2>
          {view.relations.map((e) => (
            <p key={e.id}>
              {e.from} — {e.label} — {e.to}
            </p>
          ))}
        </section>
      ) : null}
      {view.postmortem ? (
        <section className="panel" aria-label="Campaign postmortem">
          <h2>Postmortem</h2>
          <dl>
            {view.postmortem.metrics.map((m) => (
              <div key={m.id}>
                <dt>{m.label}</dt>
                <dd>{String(m.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </section>
  );
}

import { useMemo } from 'react';
import { projectCampaignEnding } from '../engine/campaign/ending-presentation.ts';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import type { EndingProseBlock } from '../scenario/ending-presentation.ts';

function EndingBlock({ block }: { block: EndingProseBlock }) {
  if (block.kind === 'policy_report')
    return (
      <figure>
        <figcaption>
          {block.provenance === 'authored_future'
            ? 'Authored future institutional report — not measured player behavior'
            : 'Authored policy record'}
        </figcaption>
        <p className="campaign-ending-text">{block.text}</p>
      </figure>
    );
  if (block.kind === 'dialogue')
    return (
      <blockquote>
        <p>{block.speaker}</p>
        <p className="campaign-ending-text">{block.text}</p>
      </blockquote>
    );
  return <p className="campaign-ending-text">{block.text}</p>;
}
// Pure renderer of the verified query. Story text/gates are never owned by React.
export function CampaignEnding({
  composition,
  run,
  attemptId,
  priorHead,
}: {
  composition: ResolvedCampaignPackage;
  run: CampaignRun;
  attemptId: string;
  priorHead: string;
}) {
  const view = useMemo(
    () => projectCampaignEnding(composition, run, { attemptId, priorHead }),
    [composition, run, attemptId, priorHead],
  );
  if (!view.ok)
    return <p role="alert">Ending presentation unavailable: {view.diagnostics.join(', ')}</p>;
  if (view.kind !== 'resolved')
    return <p role="status">Unresolved: {view.kind}. No ending prose selected.</p>;
  return (
    <section className="panel" aria-label="Resolved campaign ending">
      <h2>Ending: {view.endingId}</h2>
      <section aria-label="Actual final incident record">
        <h3>Actual final incident record</h3>
        <p>
          {view.boundary.scenarioId} / {view.boundary.attemptId} / {view.finalRecord.elapsedSeconds}{' '}
          seconds
        </p>
        <p>
          Decision completion: {view.finalRecord.completed ? 'Committed' : 'Not committed'}. Service
          recovery:{' '}
          {view.finalRecord.recovered
            ? 'Recovery criteria reached'
            : 'Recovery criteria not reached'}
          .
        </p>
        <div className="campaign-table-scroll">
          <table>
            <caption>Recorded service signals at this final attempt</caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Signal</th>
                <th scope="col">Recorded value</th>
              </tr>
            </thead>
            <tbody>
              {view.finalRecord.signals.map((signal) => (
                <tr key={signal.id}>
                  <th scope="row">{signal.service}</th>
                  <td>{signal.id}</td>
                  <td>{String(signal.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl>
          {view.finalRecord.resources.map((r) => (
            <div key={r.id}>
              <dt>{r.id}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {view.blocks.map((block) => (
        <EndingBlock key={block.id} block={block} />
      ))}
      {view.sections.map((section) => (
        <section key={section.id} aria-label={section.title}>
          <h3>{section.title}</h3>
          {section.blocks.map((block) => (
            <EndingBlock key={block.id} block={block} />
          ))}
        </section>
      ))}
      {view.closingBlocks.map((block) => (
        <EndingBlock key={block.id} block={block} />
      ))}
    </section>
  );
}

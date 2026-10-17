import { useMemo } from 'react';
import { projectCampaignEnding } from '../engine/campaign/ending-presentation.ts';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import type { EndingProseBlock } from '../scenario/ending-presentation.ts';
import { attemptScenario, subjectProfile } from './campaign-copy.ts';
import {
  formatElapsed,
  formatSignalValue,
  humanize,
  signalDirectory,
  signalLabel,
} from './format.ts';

function EndingBlock({ block }: { block: EndingProseBlock }) {
  if (block.kind === 'policy_report')
    return (
      <figure className="ending-report">
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
      <blockquote className="ending-dialogue">
        <p>{block.speaker}</p>
        <p className="campaign-ending-text">{block.text}</p>
      </blockquote>
    );
  return <p className="campaign-ending-text">{block.text}</p>;
}

// Read-only: shows only metrics the behavior ledger marked available.
export function SubjectProfile({ run }: { run: CampaignRun }) {
  const lines = subjectProfile(run);
  return (
    <section className="subject-profile" aria-labelledby="subject-profile-title">
      <p className="eyebrow">ORPHEUS // OBSERVATION FILE</p>
      <h3 id="subject-profile-title">ORPHEUS subject profile</h3>
      <p className="console-hint">
        Measured from what you actually did across the campaign. Read-only; there is no right
        profile.
      </p>
      {lines.length === 0 ? (
        <p>Not enough recorded behavior to build a profile.</p>
      ) : (
        <dl className="console-values">
          {lines.map((line) => (
            <div key={line.key}>
              <dt>{line.label}</dt>
              <dd>
                {line.value} <small>({line.detail})</small>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
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
    return (
      <p role="alert">
        Ending presentation unavailable. Technical detail: {view.diagnostics.join(', ')}
      </p>
    );
  if (view.kind !== 'resolved')
    return (
      <section className="panel finale" aria-label="Campaign finale">
        <p role="status">
          {view.kind === 'ambiguous'
            ? 'Your record points to more than one ending equally. No single ending is chosen for you.'
            : 'Your record does not match any authored ending. No ending is chosen for you.'}
        </p>
        <SubjectProfile run={run} />
      </section>
    );
  const attempt = run.attempts.find((a) => a.id === view.boundary.attemptId);
  const scenario = attempt === undefined ? undefined : attemptScenario(composition, attempt);
  const directory = signalDirectory(scenario?.initialState.signals);
  return (
    <section className="panel finale" aria-label="Resolved campaign ending">
      <p className="eyebrow">FINALE // CAMPAIGN ENDING</p>
      <h2 className="finale-title">{view.endingId}</h2>
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
      <section aria-label="Actual final incident record">
        <h3>Actual final incident record</h3>
        <p>
          {scenario?.title ?? humanize(view.boundary.scenarioId)} · closed at{' '}
          {formatElapsed(view.finalRecord.elapsedSeconds)}
        </p>
        <p>
          Decision completion: {view.finalRecord.completed ? 'Committed' : 'Not committed'}. Service
          recovery:{' '}
          {view.finalRecord.recovered
            ? 'Recovery criteria reached'
            : 'Recovery criteria not reached'}
          .
        </p>
        <div
          className="campaign-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Recorded service signals, scroll to read"
        >
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
                  <td>{signalLabel(signal.id, directory)}</td>
                  <td>{formatSignalValue(signal.id, signal.value, directory)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="console-values">
          {view.finalRecord.resources.map((r) => (
            <div key={r.id}>
              <dt>{humanize(r.id)}</dt>
              <dd>{r.value.toLocaleString('en-US')}</dd>
            </div>
          ))}
        </dl>
      </section>
      <SubjectProfile run={run} />
    </section>
  );
}

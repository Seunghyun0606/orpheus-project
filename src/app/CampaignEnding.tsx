import { useMemo } from 'react';
import { projectCampaignEnding } from '../engine/campaign/ending-presentation.ts';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import type { EndingProseBlock } from '../scenario/ending-presentation.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { attemptScenario, endingName, subjectProfile } from './campaign-copy.ts';
import {
  formatElapsed,
  formatSignalValue,
  humanize,
  signalDirectory,
  signalLabel,
} from './format.ts';
import { campaignEndingMessages } from './messages/campaign-ending.ts';

function EndingBlock({ block }: { block: EndingProseBlock }) {
  const { ct } = useI18n();
  const m = useMessages(campaignEndingMessages);
  if (block.kind === 'policy_report')
    return (
      <figure className="ending-report">
        <figcaption>
          {block.provenance === 'authored_future' ? m.authoredFuture : m.authoredPolicy}
        </figcaption>
        <p className="campaign-ending-text">{ct(block.text)}</p>
      </figure>
    );
  if (block.kind === 'dialogue')
    return (
      <blockquote className="ending-dialogue">
        <p>{m.speakers[block.speaker] ?? ct(block.speaker)}</p>
        <p className="campaign-ending-text">{ct(block.text)}</p>
      </blockquote>
    );
  return <p className="campaign-ending-text">{ct(block.text)}</p>;
}

// Read-only: shows only metrics the behavior ledger marked available.
export function SubjectProfile({ run }: { run: CampaignRun }) {
  const { locale } = useI18n();
  const m = useMessages(campaignEndingMessages);
  const lines = subjectProfile(run, locale);
  return (
    <section className="subject-profile" aria-labelledby="subject-profile-title">
      <p className="eyebrow">{m.profileEyebrow}</p>
      <h3 id="subject-profile-title">{m.profileTitle}</h3>
      <p className="console-hint">{m.profileNote}</p>
      {lines.length === 0 ? (
        <p>{m.profileEmpty}</p>
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
  const { locale, ct, formatNumber } = useI18n();
  const m = useMessages(campaignEndingMessages);
  const view = useMemo(
    () => projectCampaignEnding(composition, run, { attemptId, priorHead }),
    [composition, run, attemptId, priorHead],
  );
  if (!view.ok) return <p role="alert">{m.unavailable(view.diagnostics.join(', '))}</p>;
  if (view.kind !== 'resolved')
    return (
      <section className="panel finale" aria-label={m.finaleLabel}>
        <p role="status">{view.kind === 'ambiguous' ? m.ambiguous : m.none}</p>
        <SubjectProfile run={run} />
      </section>
    );
  const attempt = run.attempts.find((a) => a.id === view.boundary.attemptId);
  const scenario = attempt === undefined ? undefined : attemptScenario(composition, attempt);
  const directory = signalDirectory(scenario?.initialState.signals);
  return (
    <section className="panel finale" aria-label={m.resolvedLabel}>
      <p className="eyebrow">{m.eyebrow}</p>
      <h2 className="finale-title">{endingName(view.endingId, locale)}</h2>
      {view.blocks.map((block) => (
        <EndingBlock key={block.id} block={block} />
      ))}
      {view.sections.map((section) => (
        <section key={section.id} aria-label={ct(section.title)}>
          <h3>{ct(section.title)}</h3>
          {section.blocks.map((block) => (
            <EndingBlock key={block.id} block={block} />
          ))}
        </section>
      ))}
      {view.closingBlocks.map((block) => (
        <EndingBlock key={block.id} block={block} />
      ))}
      <section aria-label={m.recordTitle}>
        <h3>{m.recordTitle}</h3>
        <p>
          {m.closedAt(
            ct(scenario?.title ?? humanize(view.boundary.scenarioId)),
            formatElapsed(view.finalRecord.elapsedSeconds),
          )}
        </p>
        <p>
          {m.outcome(
            view.finalRecord.completed ? m.committed : m.notCommitted,
            view.finalRecord.recovered ? m.recovered : m.notRecovered,
          )}
        </p>
        <div
          className="campaign-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={m.signalsRegion}
        >
          <table>
            <caption>{m.signalsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{m.service}</th>
                <th scope="col">{m.signal}</th>
                <th scope="col">{m.value}</th>
              </tr>
            </thead>
            <tbody>
              {view.finalRecord.signals.map((signal) => {
                const value = formatSignalValue(signal.id, signal.value, directory, locale);
                return (
                  <tr key={signal.id}>
                    <th scope="row">{ct(signal.service)}</th>
                    <td>{ct(signalLabel(signal.id, directory))}</td>
                    <td>{typeof signal.value === 'string' ? ct(value) : value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="console-values">
          {view.finalRecord.resources.map((r) => (
            <div key={r.id}>
              <dt>{ct(humanize(r.id))}</dt>
              <dd>{formatNumber(r.value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <SubjectProfile run={run} />
    </section>
  );
}

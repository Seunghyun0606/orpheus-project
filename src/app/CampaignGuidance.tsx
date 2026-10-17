import type { RefObject } from 'react';
import type { CampaignView } from '../store/campaign-session.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import {
  actionTitleFrom,
  formatConfidence,
  guidanceOffer,
  guidanceReopen,
  ruleKind,
} from './campaign-copy.ts';

type Preparation = CampaignView['presentations'][number];

// In-fiction ORPHEUS advisory card. Display-only: the acknowledgement remains an
// explicit, visible click handled by the caller; nothing here acknowledges on
// mount, on query or on focus.
export function CampaignGuidance({
  view,
  composition,
  prep,
  acknowledged,
  blocked,
  presentationRef,
  onPrepare,
  onSelect,
  onAcknowledge,
}: {
  view: CampaignView | null;
  composition?: ResolvedCampaignPackage;
  prep: Preparation | undefined;
  acknowledged: boolean;
  blocked: boolean;
  presentationRef: RefObject<HTMLElement | null>;
  onPrepare: (ruleId: string) => void;
  onSelect: (preparationId: string) => void;
  onAcknowledge: (preparation: Preparation) => void;
}) {
  const scenario =
    prep === undefined
      ? undefined
      : composition?.catalog.get(scenarioVersionKey(prep.scenarioId, prep.contentVersion));
  const title = (actionId: string) =>
    actionTitleFrom(scenario, actionId, view?.availableActions ?? []);
  const reopen = (view?.presentations ?? []).filter((p) => p.id !== prep?.id);
  const offers = view?.availableOpportunityRuleIds ?? [];
  const forecast =
    prep?.kind !== 'prediction' ? null : prep.prediction?.ok &&
      prep.prediction.result.kind === 'predicted' ? (
      <p className="orpheus-forecast">
        ORPHEUS forecast: {title(prep.prediction.result.actionId)} —{' '}
        {formatConfidence(prep.prediction.result.confidence)}
      </p>
    ) : (
      <p className="orpheus-forecast">No forecast yet: not enough history to model you</p>
    );

  return (
    <section
      id="campaign-guidance"
      tabIndex={-1}
      className="panel orpheus-card"
      aria-labelledby="campaign-guidance-title"
    >
      <p className="eyebrow">ORPHEUS // ADVISORY CHANNEL</p>
      <h2 id="campaign-guidance-title">ORPHEUS</h2>
      {view?.presentationDiagnostics.length ? (
        <p role="alert">ORPHEUS guidance could not be checked against your record right now.</p>
      ) : null}
      {offers.length || reopen.length ? (
        <div className="orpheus-offers">
          {offers.map((id) => (
            <button key={id} type="button" disabled={blocked} onClick={() => onPrepare(id)}>
              {guidanceOffer[ruleKind(composition, id)]}
            </button>
          ))}
          {reopen.map((p) => (
            <button key={p.id} type="button" disabled={blocked} onClick={() => onSelect(p.id)}>
              {guidanceReopen[p.kind]}
            </button>
          ))}
        </div>
      ) : null}
      {prep ? (
        <section ref={presentationRef} className="orpheus-message" aria-label="ORPHEUS message">
          <p className="campaign-document-text">{prep.presentation.text}</p>
          {forecast}
          {prep.kind === 'recommendation' && prep.recommendedActionId !== undefined ? (
            <p className="orpheus-forecast">
              ORPHEUS recommends: {title(prep.recommendedActionId)}
            </p>
          ) : null}
          <p className="console-hint">
            {acknowledged
              ? 'Logged: you have read this message. What you do next is up to you.'
              : 'Your actions are paused until you confirm you have read this.'}
          </p>
          <button
            type="button"
            disabled={blocked || acknowledged}
            onClick={() => onAcknowledge(prep)}
          >
            I&apos;ve read this
          </button>
        </section>
      ) : offers.length || reopen.length ? null : (
        <p className="console-hint">ORPHEUS is quiet. Nothing is waiting for you.</p>
      )}
    </section>
  );
}

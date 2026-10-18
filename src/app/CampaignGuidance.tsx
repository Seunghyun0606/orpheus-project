import type { RefObject } from 'react';
import type { CampaignView } from '../store/campaign-session.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { actionTitleFrom, formatConfidence, advisorName, ruleKind } from './campaign-copy.ts';
import { campaignCopyMessages } from './messages/campaign-copy.ts';
import { campaignGuidanceMessages } from './messages/campaign-tools.ts';

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
  act = null,
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
  act?: number | null;
}) {
  const { locale, ct } = useI18n();
  const m = useMessages(campaignGuidanceMessages);
  const { guidanceOffer, guidanceReopen } = useMessages(campaignCopyMessages);
  const advisor = advisorName(act, locale);
  const scenario =
    prep === undefined
      ? undefined
      : composition?.catalog.get(scenarioVersionKey(prep.scenarioId, prep.contentVersion));
  const title = (actionId: string) =>
    ct(actionTitleFrom(scenario, actionId, view?.availableActions ?? []));
  const reopen = (view?.presentations ?? []).filter((p) => p.id !== prep?.id);
  const offers = view?.availableOpportunityRuleIds ?? [];
  const forecast =
    prep?.kind !== 'prediction' ? null : prep.prediction?.ok &&
      prep.prediction.result.kind === 'predicted' ? (
      <p className="orpheus-forecast">
        {m.forecast(
          title(prep.prediction.result.actionId),
          formatConfidence(prep.prediction.result.confidence),
        )}
      </p>
    ) : (
      <p className="orpheus-forecast">{m.noForecast}</p>
    );

  return (
    <section
      id="campaign-guidance"
      tabIndex={-1}
      className="panel orpheus-card"
      aria-labelledby="campaign-guidance-title"
    >
      <p className="eyebrow">{m.eyebrow(advisor)}</p>
      <h2 id="campaign-guidance-title">{advisor}</h2>
      {view?.presentationDiagnostics.length ? <p role="alert">{m.diagnostics}</p> : null}
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
        <section ref={presentationRef} className="orpheus-message" aria-label={m.messageLabel}>
          <p className="campaign-document-text">{ct(prep.presentation.text)}</p>
          {forecast}
          {prep.kind === 'recommendation' && prep.recommendedActionId !== undefined ? (
            <p className="orpheus-forecast">{m.recommends(title(prep.recommendedActionId))}</p>
          ) : null}
          <p className="console-hint">{acknowledged ? m.acknowledged : m.paused}</p>
          <button
            type="button"
            disabled={blocked || acknowledged}
            onClick={() => onAcknowledge(prep)}
          >
            {m.confirm}
          </button>
        </section>
      ) : offers.length || reopen.length ? null : (
        <p className="console-hint">{m.quiet(advisor)}</p>
      )}
    </section>
  );
}

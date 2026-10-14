import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { CampaignSessionState } from '../store/campaign-session.ts';
import { PresentationSettings } from './PresentationSettings.tsx';
import { defaultPresentationPreferences } from './presentation-settings.ts';
import {
  readPresentationPreferences,
  savePresentationPreferences,
} from './presentation-settings.ts';
import { CampaignTools } from './CampaignTools.tsx';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { CampaignEnding } from './CampaignEnding.tsx';
import { campaignAttemptHead, type CampaignRun } from '../engine/campaign/transitions.ts';

// The caller must supply an approved authority/isolated fixture adapter. Nothing
// in this component selects a campaign, fabricates history or enables MVP reveals.
export function CampaignDesk({
  store,
  seed,
  onBack,
  composition,
}: {
  store: StoreApi<CampaignSessionState>;
  seed: number;
  onBack: () => void;
  composition?: ResolvedCampaignPackage;
}) {
  const state = useStore(store);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [endingQuery, setEnding] = useState<{
    run: CampaignRun;
    attemptId: string;
    priorHead: string;
    result: ReturnType<CampaignSessionState['ending']>;
  } | null>(null);
  const [preferences, setPreferences] = useState(() =>
    composition ? readPresentationPreferences() : defaultPresentationPreferences,
  );
  const presentationRef = useRef<HTMLElement>(null);
  const run = state.run;
  const attempt = run?.attempts.find((a) => a.id === (reviewId ?? run.activeAttemptId));
  const reviewing = reviewId !== null;
  const prep =
    !reviewing && state.view?.presentations.find((p) => p.id === state.selectedPreparationId);
  const acknowledged =
    prep && run?.opportunities?.acknowledgements.some((a) => a.preparationId === prep.id);
  const blocked = state.busy || state.pendingOperationId !== null;
  // A reload, new durable operation or archive switch invalidates the query.
  // Store snapshots are immutable; never keep displaying a stale final winner.
  const currentEndingQuery =
    !blocked &&
    run &&
    attempt &&
    endingQuery?.run === run &&
    endingQuery.attemptId === attempt.id &&
    endingQuery.priorHead === campaignAttemptHead(attempt)
      ? endingQuery
      : null;
  const ending = currentEndingQuery?.result;
  const scale =
    preferences.textScale === 'extra-large'
      ? '150%'
      : preferences.textScale === 'large'
        ? '125%'
        : '100%';
  return (
    <main
      className="incident-hub campaign-desk"
      style={{ fontSize: scale }}
      data-reduced-animation={preferences.reducedAnimation}
      data-crt-effects={preferences.crtEffects}
    >
      <header>
        <p className="eyebrow">
          {composition
            ? 'VANTAGE SYSTEMS // CAMPAIGN OPERATIONS'
            : 'CAMPAIGN FRAMEWORK // EXPLICIT AUTHORITY'}
        </p>
        <h1>Campaign desk</h1>
        <p>
          {composition
            ? 'Version-pinned campaign. All actions commit through the campaign ledger.'
            : 'This opt-in framework does not change the three-incident MVP.'}
        </p>
        <button type="button" disabled={blocked} onClick={onBack}>
          Back to incident desk
        </button>
        <PresentationSettings
          preferences={preferences}
          onChange={(p) => {
            setPreferences(p);
            if (composition) savePresentationPreferences(p);
          }}
        />
      </header>
      {state.error ? <p role="alert">Campaign operation not confirmed: {state.error}</p> : null}
      {state.view?.actionDiagnostics.length ? (
        <p role="alert">Some response options require valid campaign observations.</p>
      ) : null}
      <p role="status">
        {state.busy
          ? 'Waiting for durable transaction completion'
          : state.pendingOperationId
            ? 'Pending identity retained — retry the same operation'
            : 'No pending operation'}
      </p>
      {state.pendingOperationId ? (
        <button type="button" disabled={state.busy} onClick={() => void state.retryPending()}>
          Retry pending operation
        </button>
      ) : null}
      <section className="panel" aria-labelledby="campaign-progress-title">
        <h2 id="campaign-progress-title">Progress and persistence</h2>
        <button
          type="button"
          disabled={
            state.busy ||
            (state.pendingOperationId !== null &&
              !['REVISION_CONFLICT', 'CONFLICTING_OPERATION'].includes(state.error ?? ''))
          }
          onClick={() => void state.load()}
        >
          Reload committed campaign
        </button>
        {state.readState === 'not_found' ? (
          <button type="button" disabled={blocked} onClick={() => void state.create()}>
            Create new campaign in empty run
          </button>
        ) : null}
        {state.view?.progress.ok && 'incidents' in state.view.progress
          ? state.view.progress.incidents.map((i) => (
              <div key={i.id}>
                <p>
                  {i.id}:{' '}
                  {i.result.ok
                    ? i.result.value
                      ? 'Eligible'
                      : 'Not yet eligible'
                    : 'Eligibility unresolved'}
                </p>
                <button
                  type="button"
                  disabled={blocked || reviewing || !i.result.ok || !i.result.value}
                  onClick={() => {
                    setEnding(null);
                    void state.start(i.id, seed);
                  }}
                >
                  Start new attempt: {i.id}
                </button>
              </div>
            ))
          : null}
        {state.view && !state.view.progress.ok ? (
          <p role="alert">Progression requires valid campaign observations.</p>
        ) : null}
      </section>
      <section className="panel" aria-labelledby="campaign-history-title">
        <h2 id="campaign-history-title">Attempt history</h2>
        {run?.attempts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setReviewId(a.id);
              setEnding(null);
            }}
          >
            Review attempt: {a.id}
          </button>
        ))}
        {reviewing ? (
          <>
            <p>Read-only archive. Viewing does not create exposures or responses.</p>
            <button
              type="button"
              onClick={() => {
                setReviewId(null);
                setEnding(null);
              }}
            >
              Return to live attempt
            </button>
          </>
        ) : null}
        {attempt ? (
          <p>
            {attempt.incident.scenarioId} / {attempt.incident.elapsedSeconds} seconds /{' '}
            {attempt.incident.completionReached ? 'Completed' : 'In progress'}
          </p>
        ) : null}
      </section>
      {composition && run && attempt ? (
        <CampaignTools
          composition={composition}
          run={run}
          attemptId={attempt.id}
          actions={state.view?.availableActions ?? []}
          disabled={blocked || !!(prep && !acknowledged)}
          readOnly={reviewing}
          onAction={(id) => {
            setEnding(null);
            void state.performAction(id);
          }}
        />
      ) : null}
      {!reviewing ? (
        <>
          <section className="panel" aria-labelledby="campaign-guidance-title">
            <h2 id="campaign-guidance-title">Gated guidance</h2>
            {state.view?.presentationDiagnostics.length ? (
              <p role="alert">Guidance needs valid authored observations.</p>
            ) : null}
            {state.view?.presentations.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={blocked}
                onClick={() => state.selectPresentation(p.id)}
              >
                Show prepared guidance: {p.ruleId}
              </button>
            ))}
            {state.view?.availableOpportunityRuleIds.map((id) => (
              <button
                key={id}
                type="button"
                disabled={blocked}
                onClick={() => void state.preparePresentation(id)}
              >
                Prepare guidance: {id}
              </button>
            ))}
            {prep ? (
              <section ref={presentationRef} aria-label="Authored presentation">
                <p>{prep.presentation.text}</p>
                {prep.kind === 'recommendation' ? (
                  <p>Recommended action: {prep.recommendedActionId}</p>
                ) : null}
                {prep.prediction?.ok && prep.prediction.result.kind === 'predicted' ? (
                  <p>
                    Predicted action: {prep.prediction.result.actionId}. Confidence:{' '}
                    {(prep.prediction.result.confidence * 100).toFixed(1)}%.
                  </p>
                ) : null}
                <p>
                  {acknowledged
                    ? 'Display acknowledgement durably committed'
                    : 'Prepared only — no response sample yet'}
                </p>
                <button
                  type="button"
                  disabled={blocked || acknowledged === true}
                  onClick={() => {
                    // Explicit visible-screen confirmation, never a query/mount effect.
                    if (
                      document.visibilityState === 'visible' &&
                      presentationRef.current?.isConnected
                    )
                      void state.acknowledgeVisiblePresentation(prep.id, prep.presentation.id);
                  }}
                >
                  Confirm displayed guidance
                </button>
              </section>
            ) : (
              <p>No approved guidance is displayed.</p>
            )}
          </section>
          {!composition ? (
            <section className="panel" aria-labelledby="campaign-action-title">
              <h2 id="campaign-action-title">Accepted actions</h2>
              {state.view?.availableActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={blocked || !!(prep && !acknowledged)}
                  onClick={() => {
                    setEnding(null);
                    void state.performAction(a.id);
                  }}
                >
                  {a.title} (+{a.durationSeconds}s)
                </button>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
      <section className="panel" aria-labelledby="campaign-evidence-title">
        <h2 id="campaign-evidence-title">Preserved evidence</h2>
        {state.view?.evidence.map((e) => (
          <article key={e.id}>
            <h3>{e.title}</h3>
            <p>{e.description}</p>
          </article>
        ))}
        {!state.view?.evidence.length ? <p>No verified campaign evidence collected.</p> : null}
      </section>
      {state.view?.branches?.ok && 'branches' in state.view.branches ? (
        <section className="panel" aria-label="Authored branches">
          <h2>Authored route eligibility</h2>
          {state.view.branches.branches
            .filter((b) => b.result.ok && b.result.value)
            .map((b) => (
              <p key={b.id}>Eligible route: {b.id}</p>
            ))}
        </section>
      ) : null}
      {attempt?.incident.completionReached ? (
        <section className="panel" aria-label="Ending framework query">
          <h2>Read-only ending framework</h2>
          <button
            type="button"
            disabled={blocked}
            onClick={() => {
              if (run)
                setEnding({
                  run,
                  attemptId: attempt.id,
                  priorHead: campaignAttemptHead(attempt),
                  result: composition ? null : state.ending(attempt.id),
                });
            }}
          >
            Query authored final context
          </button>
          {ending ? (
            <p>
              {ending.ok
                ? ending.result.kind === 'resolved'
                  ? `Resolved framework result: ${ending.result.endingId}`
                  : `Unresolved: ${ending.result.kind}`
                : 'Final context requires valid observations.'}
            </p>
          ) : null}
          {composition && run && currentEndingQuery ? (
            <CampaignEnding
              composition={composition}
              run={run}
              attemptId={currentEndingQuery.attemptId}
              priorHead={currentEndingQuery.priorHead}
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

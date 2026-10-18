import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { CampaignSessionState } from '../store/campaign-session.ts';
import { PresentationProvider, PresentationSettings } from './PresentationSettings.tsx';
import { usePresentationPreferences } from './presentation-settings.ts';
import { CampaignTools } from './CampaignTools.tsx';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { CampaignEnding } from './CampaignEnding.tsx';
import { CampaignAudio } from './CampaignAudio.tsx';
import { CampaignGuidance } from './CampaignGuidance.tsx';
import { CampaignRuntimeNotices } from './CampaignRuntimeNotices.tsx';
import { OnboardingCoach } from '../onboarding/OnboardingCoach.tsx';
import { campaignAttemptHead, type CampaignRun } from '../engine/campaign/transitions.ts';
import {
  actTitle,
  attemptScenario,
  advisorName,
  endingName,
  incidentTitle,
  isFinalIncident,
} from './campaign-copy.ts';
import { formatElapsed } from './format.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { campaignDeskMessages, type RotationStatus } from './messages/campaign-desk.ts';

type Attempt = CampaignRun['attempts'][number];

// The caller must supply an approved authority/isolated fixture adapter. Nothing
// in this component selects a campaign, fabricates history or enables MVP reveals.
export function CampaignDesk(props: {
  store: StoreApi<CampaignSessionState>;
  seed: number;
  onBack: () => void;
  composition?: ResolvedCampaignPackage;
}) {
  return (
    <PresentationProvider>
      <CampaignConsole {...props} />
    </PresentationProvider>
  );
}

function CampaignConsole({
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
  const { preferences } = usePresentationPreferences();
  const { locale, ct } = useI18n();
  const m = useMessages(campaignDeskMessages);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [endingQuery, setEnding] = useState<{
    run: CampaignRun;
    attemptId: string;
    priorHead: string;
    result: ReturnType<CampaignSessionState['ending']>;
  } | null>(null);
  const presentationRef = useRef<HTMLElement>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const keyboardAudio = useRef<(() => void) | null>(null);
  const run = state.run;
  const attempt = run?.attempts.find((a) => a.id === (reviewId ?? run.activeAttemptId));
  const reviewing = reviewId !== null;
  const prep = reviewing
    ? undefined
    : state.view?.presentations.find((p) => p.id === state.selectedPreparationId);
  const acknowledged =
    prep !== undefined &&
    (run?.opportunities?.acknowledgements.some((a) => a.preparationId === prep.id) ?? false);
  const blocked = state.busy || state.pendingOperationId !== null;
  const awaitingAck = prep !== undefined && !acknowledged;
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
  const title = (incidentId: string) => ct(incidentTitle(composition, incidentId));
  const attemptLabel = (a: Attempt) => {
    const sameIncident = run?.attempts.filter((item) => item.incidentId === a.incidentId) ?? [];
    const ordinal = sameIncident.findIndex((item) => item.id === a.id) + 1;
    return m.attemptLabel(title(a.incidentId), sameIncident.length > 1 ? ordinal : null);
  };

  const progress =
    state.view?.progress.ok && 'incidents' in state.view.progress
      ? state.view.progress.incidents
      : [];
  const act = run?.projection.act ?? null;
  const completed = new Set(run?.projection.completed ?? []);
  const live = run?.attempts.find((a) => a.id === run.activeAttemptId);
  const liveOpen = live !== undefined && !live.incident.completionReached;
  const eligible = (item: (typeof progress)[number]) => item.result.ok && item.result.value;
  const next = progress.find(
    (item) =>
      eligible(item) && !completed.has(item.id) && !(liveOpen && item.id === live.incidentId),
  );
  const board = progress.filter(
    (item) => item.act === act || (eligible(item) && !completed.has(item.id)),
  );
  // Archive grouped by incident, in the order incidents were first opened.
  const archive = (run?.attempts ?? []).reduce<{ incidentId: string; attempts: Attempt[] }[]>(
    (groups, a) => {
      const group = groups.find((g) => g.incidentId === a.incidentId);
      if (group) group.attempts.push(a);
      else groups.push({ incidentId: a.incidentId, attempts: [a] });
      return groups;
    },
    [],
  );
  const sealed = act === null ? 0 : progress.filter((item) => item.act > act).length;
  const finalComplete =
    attempt !== undefined &&
    attempt.incident.completionReached &&
    (composition === undefined || isFinalIncident(composition, attempt.incidentId));

  const start = (incidentId: string) => {
    setEnding(null);
    setReviewId(null);
    void state.start(incidentId, seed);
  };
  const queryEnding = () => {
    if (run && attempt)
      setEnding({
        run,
        attemptId: attempt.id,
        priorHead: campaignAttemptHead(attempt),
        result: composition ? null : state.ending(attempt.id),
      });
  };

  const advisor = advisorName(act, locale);
  const saveStatus = state.busy
    ? m.saveBusy
    : state.pendingOperationId
      ? m.savePending
      : state.readState === 'not_found'
        ? m.saveNotFound
        : state.readState === 'unread'
          ? m.saveUnread
          : m.saveDone;

  return (
    <main
      className="incident-hub campaign-desk"
      aria-label={m.desktopLabel}
      onKeyDownCapture={(event) => {
        if (
          !composition ||
          reviewing ||
          blocked ||
          event.repeat ||
          event.nativeEvent.isComposing ||
          event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          (event.target instanceof Element && event.target.closest('[data-audio-controls]'))
        )
          return;
        if (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace')
          keyboardAudio.current?.();
      }}
    >
      <nav className="campaign-jump-links" aria-label={m.shortcutsLabel}>
        <a href="#campaign-progress">{m.jumpRotation}</a>
        <a href="#campaign-tools">{m.jumpWorkspace}</a>
        {!reviewing ? <a href="#campaign-guidance">{advisor}</a> : null}
        <a href="#campaign-evidence">{m.jumpEvidence}</a>
        <a href="#campaign-history">{m.jumpArchive}</a>
        <a href="#campaign-settings">{m.jumpSettings}</a>
      </nav>
      <header className="console-header">
        <div>
          <p className="eyebrow">{composition ? m.eyebrowConsole : m.eyebrowFramework}</p>
          <h1>{act === null ? m.consoleTitle : actTitle(act, locale)}</h1>
          <p>{composition ? m.introCampaign : m.introFramework}</p>
        </div>
        <div className="console-header-actions">
          <button type="button" disabled={blocked} onClick={onBack}>
            {m.backToDesk}
          </button>
        </div>
        <div className="screen-toolbar" role="group" aria-label={m.screenSettings}>
          <section id="campaign-settings" tabIndex={-1} aria-label={m.displaySettings}>
            <PresentationSettings />
          </section>
          {composition ? (
            <CampaignAudio
              store={store}
              live={!reviewing}
              ambience={!!attempt && !attempt.incident.completionReached}
              keyboard={keyboardAudio}
              variant="compact"
            />
          ) : null}
        </div>
      </header>

      <section className="save-status" aria-label={m.recordStatus} aria-busy={state.busy}>
        <p role="status">
          <span aria-hidden="true">{state.pendingOperationId ? '▲ ' : '● '}</span>
          {saveStatus}
        </p>
        {state.pendingOperationId ? (
          <button type="button" disabled={state.busy} onClick={() => void state.retryPending()}>
            {m.retrySave}
          </button>
        ) : null}
        <button
          type="button"
          disabled={
            state.busy ||
            (state.pendingOperationId !== null &&
              !['REVISION_CONFLICT', 'CONFLICTING_OPERATION'].includes(state.error ?? ''))
          }
          onClick={() => void state.load()}
        >
          {m.reload}
        </button>
        {state.readState === 'not_found' ? (
          <button type="button" disabled={blocked} onClick={() => void state.create()}>
            {m.startRecord}
          </button>
        ) : null}
        {state.error ? (
          <p role="alert">
            {m.unconfirmed} <small>{m.technicalDetail(state.error)}</small>
          </p>
        ) : null}
        {state.view?.actionDiagnostics.length ? <p role="alert">{m.actionDiagnostics}</p> : null}
      </section>

      {composition?.presentations.some((p) => p.schemaVersion === 2) ? (
        <CampaignRuntimeNotices
          store={store}
          composition={composition}
          live={!reviewing}
          reducedMotion={preferences.reducedAnimation}
        />
      ) : null}

      <div className="console-grid">
        <section
          id="campaign-progress"
          tabIndex={-1}
          className="panel rotation-board"
          aria-labelledby="campaign-progress-title"
          aria-busy={state.busy}
        >
          <h2 id="campaign-progress-title">{m.rotationTitle}</h2>
          {liveOpen && !reviewing ? (
            <button
              type="button"
              className="primary-action"
              data-onboarding-target="region:rotation"
              onClick={() => workspaceHeadingRef.current?.focus()}
            >
              {m.continueIncident(title(live.incidentId))}
            </button>
          ) : next ? (
            <button
              type="button"
              className="primary-action"
              data-onboarding-target="region:rotation"
              disabled={blocked || reviewing}
              onClick={() => start(next.id)}
            >
              {m.nextIncident(title(next.id))}
            </button>
          ) : run ? (
            <p className="console-hint">{m.noNewIncident}</p>
          ) : null}
          {board.length ? (
            <ul className="rotation-list" aria-label={m.incidentsThisAct}>
              {board.map((item) => {
                const isLive = liveOpen && item.id === live.incidentId;
                const done = completed.has(item.id);
                const status: RotationStatus = isLive
                  ? 'in-progress'
                  : done
                    ? 'closed'
                    : !item.result.ok
                      ? 'unavailable'
                      : item.result.value
                        ? 'ready'
                        : 'locked';
                return (
                  <li key={item.id} className={`rotation-item rotation-item--${status}`}>
                    <span className="rotation-title">{title(item.id)}</span>
                    <span className="rotation-status">
                      <span aria-hidden="true">
                        {isLive
                          ? '▶'
                          : done
                            ? '◆'
                            : item.result.ok && item.result.value
                              ? '◇'
                              : '·'}
                      </span>{' '}
                      {m.status[status]}
                    </span>
                    {!isLive && !done && eligible(item) && item.id !== next?.id ? (
                      <button
                        type="button"
                        disabled={blocked || reviewing}
                        onClick={() => start(item.id)}
                      >
                        {m.startIncident(title(item.id))}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {sealed > 0 ? <p className="console-hint">{m.sealed(sealed)}</p> : null}
          {state.view && !state.view.progress.ok ? <p role="alert">{m.rotationUnchecked}</p> : null}
        </section>

        <section
          id="campaign-tools"
          tabIndex={-1}
          className="workspace-column"
          aria-label={m.workspaceLabel}
        >
          {attempt ? (
            <header className="panel console-incident">
              <p className="eyebrow">{reviewing ? m.eyebrowArchived : m.eyebrowActive}</p>
              <h2 ref={workspaceHeadingRef} tabIndex={-1}>
                {title(attempt.incidentId)}
              </h2>
              <p>
                {attempt.incident.completionReached ? m.closed : m.inProgress} ·{' '}
                {m.elapsed(formatElapsed(attempt.incident.elapsedSeconds))}
              </p>
              {reviewing ? (
                <>
                  <p>{m.archivedNote}</p>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      setReviewId(null);
                      setEnding(null);
                    }}
                  >
                    {m.backToCurrent}
                  </button>
                </>
              ) : null}
              {awaitingAck ? (
                <p className="console-hint" role="note">
                  {m.awaitingAck(advisor)}
                </p>
              ) : null}
            </header>
          ) : (
            <p className="panel console-hint">{m.noIncident}</p>
          )}
          {!reviewing ? (
            <CampaignGuidance
              act={act}
              view={state.view}
              composition={composition}
              prep={prep}
              acknowledged={acknowledged}
              blocked={blocked}
              presentationRef={presentationRef}
              onPrepare={(id) => void state.preparePresentation(id)}
              onSelect={(id) => state.selectPresentation(id)}
              onAcknowledge={(p) => {
                // Explicit visible-screen confirmation, never a query/mount effect.
                if (document.visibilityState === 'visible' && presentationRef.current?.isConnected)
                  void state.acknowledgeVisiblePresentation(p.id, p.presentation.id);
              }}
            />
          ) : null}
          {composition && attempt && !reviewing ? (
            <OnboardingCoach
              surface="campaign"
              state={attempt.incident}
              availableActionIds={(state.view?.availableActions ?? []).map(({ id }) => id)}
              actionTitle={(id) =>
                attemptScenario(composition, attempt)?.actions.find((action) => action.id === id)
                  ?.title
              }
            />
          ) : null}
          {composition && run && attempt ? (
            <CampaignTools
              composition={composition}
              run={run}
              attemptId={attempt.id}
              actions={state.view?.availableActions ?? []}
              disabled={blocked || awaitingAck}
              readOnly={reviewing}
              onAction={(id) => {
                setEnding(null);
                void state.performAction(id);
              }}
            />
          ) : null}
          {!composition && !reviewing && state.view?.availableActions.length ? (
            <section className="panel console-panel" aria-labelledby="campaign-action-title">
              <h2 id="campaign-action-title">{m.availableActions}</h2>
              <div className="console-actions">
                {state.view.availableActions.map((a) => (
                  <div className="console-action" key={a.id}>
                    <button
                      type="button"
                      aria-describedby={`framework-cost-${a.id}`}
                      disabled={blocked || awaitingAck}
                      onClick={() => {
                        setEnding(null);
                        void state.performAction(a.id);
                      }}
                    >
                      {ct(a.title)}
                    </button>
                    <span className="console-action-cost" id={`framework-cost-${a.id}`}>
                      {m.takes(formatElapsed(a.durationSeconds))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {finalComplete ? (
            <section className="panel finale-gate" aria-labelledby="campaign-finale-title">
              <p className="eyebrow">{m.eyebrowFinal}</p>
              <h2 id="campaign-finale-title">{m.finale}</h2>
              <p>{m.finaleNote}</p>
              <button type="button" disabled={blocked} onClick={queryEnding}>
                {m.readEnding}
              </button>
              {ending !== undefined && ending !== null ? (
                <p role="status">
                  {ending.ok
                    ? ending.result.kind === 'resolved'
                      ? m.endingReached(endingName(ending.result.endingId, locale))
                      : ending.result.kind === 'ambiguous'
                        ? m.endingAmbiguous
                        : m.endingNone
                    : m.endingUnchecked}
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
        </section>

        <aside className="console-side">
          <section
            id="campaign-evidence"
            data-onboarding-target="region:evidence tool:evidence"
            tabIndex={-1}
            className="panel evidence-board"
            aria-labelledby="campaign-evidence-title"
          >
            <h2 id="campaign-evidence-title">{m.evidenceBoard}</h2>
            {state.view?.evidence.length ? (
              <ul className="evidence-pins">
                {state.view.evidence.map((e) => (
                  <li key={e.id}>
                    <h3>{ct(e.title)}</h3>
                    <p>{ct(e.description)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="console-hint">{m.noEvidence}</p>
            )}
          </section>
          <section
            id="campaign-history"
            tabIndex={-1}
            className="panel"
            aria-labelledby="campaign-history-title"
          >
            <h2 id="campaign-history-title">{m.archive}</h2>
            {run?.attempts.length ? (
              <ul className="archive-list">
                {archive.map(({ incidentId, attempts }) => {
                  const entry = progress.find((item) => item.id === incidentId);
                  const replayable =
                    entry !== undefined &&
                    eligible(entry) &&
                    completed.has(incidentId) &&
                    !(liveOpen && live.incidentId === incidentId);
                  return (
                    <li key={incidentId}>
                      <span className="rotation-title">{title(incidentId)}</span>
                      {attempts.map((a) => (
                        <div className="archive-attempt" key={a.id}>
                          <button
                            type="button"
                            disabled={blocked || a.id === reviewId}
                            onClick={() => {
                              setReviewId(a.id);
                              setEnding(null);
                            }}
                          >
                            {m.reviewRecord(attemptLabel(a))}
                          </button>
                          <span className="console-hint">
                            {a.incident.completionReached ? m.closed : m.open} ·{' '}
                            {formatElapsed(a.incident.elapsedSeconds)}
                          </span>
                        </div>
                      ))}
                      {replayable ? (
                        <button
                          type="button"
                          disabled={blocked || reviewing}
                          onClick={() => start(incidentId)}
                        >
                          {m.replay(title(incidentId))}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="console-hint">{m.archiveEmpty}</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

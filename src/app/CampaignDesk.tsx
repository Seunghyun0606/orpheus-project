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
import { campaignAttemptHead, type CampaignRun } from '../engine/campaign/transitions.ts';
import { actTitle, incidentTitle, isFinalIncident } from './campaign-copy.ts';
import { formatElapsed } from './format.ts';

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
  const title = (incidentId: string) => incidentTitle(composition, incidentId);
  const attemptLabel = (a: Attempt) => {
    const sameIncident = run?.attempts.filter((item) => item.incidentId === a.incidentId) ?? [];
    const ordinal = sameIncident.findIndex((item) => item.id === a.id) + 1;
    return `${title(a.incidentId)}${sameIncident.length > 1 ? ` (attempt ${ordinal})` : ''}`;
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

  const saveStatus = state.busy
    ? 'Saving to your campaign record…'
    : state.pendingOperationId
      ? 'Your last action has not been saved yet.'
      : state.readState === 'not_found'
        ? 'No campaign record yet.'
        : state.readState === 'unread'
          ? 'Campaign record not loaded.'
          : 'All progress saved.';

  return (
    <main
      className="incident-hub campaign-desk"
      aria-label="Campaign operations desktop"
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
      <nav className="campaign-jump-links" aria-label="Campaign section shortcuts">
        <a href="#campaign-progress">Rotation</a>
        <a href="#campaign-tools">Workspace</a>
        {!reviewing ? <a href="#campaign-guidance">ORPHEUS</a> : null}
        <a href="#campaign-evidence">Evidence</a>
        <a href="#campaign-history">Archive</a>
        <a href="#campaign-settings">Settings</a>
      </nav>
      <header className="console-header">
        <div>
          <p className="eyebrow">
            {composition
              ? 'VANTAGE SYSTEMS // OPERATIONS CONSOLE'
              : 'VANTAGE SYSTEMS // CAMPAIGN FRAMEWORK (TEST CONTENT)'}
          </p>
          <h1>{act === null ? 'Operations console' : actTitle(act)}</h1>
          <p>
            {composition
              ? 'You are on the reliability rotation. Every incident you close stays on your record — and ORPHEUS is learning from how you close them.'
              : 'Opt-in framework console. It does not change the three-incident training rotation.'}
          </p>
        </div>
        <div className="console-header-actions">
          <button type="button" disabled={blocked} onClick={onBack}>
            Back to incident desk
          </button>
        </div>
        <div className="screen-toolbar" role="group" aria-label="Screen settings">
          <section id="campaign-settings" tabIndex={-1} aria-label="Display settings">
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

      <section className="save-status" aria-label="Campaign record status" aria-busy={state.busy}>
        <p role="status">
          <span aria-hidden="true">{state.pendingOperationId ? '▲ ' : '● '}</span>
          {saveStatus}
        </p>
        {state.pendingOperationId ? (
          <button type="button" disabled={state.busy} onClick={() => void state.retryPending()}>
            Retry save
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
          Reload saved campaign
        </button>
        {state.readState === 'not_found' ? (
          <button type="button" disabled={blocked} onClick={() => void state.create()}>
            Start a new campaign record
          </button>
        ) : null}
        {state.error ? (
          <p role="alert">
            The campaign record could not confirm that change. Your saved data is untouched.{' '}
            <small>Technical detail: {state.error}</small>
          </p>
        ) : null}
        {state.view?.actionDiagnostics.length ? (
          <p role="alert">Some response options could not be checked against your record.</p>
        ) : null}
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
          <h2 id="campaign-progress-title">Incident rotation</h2>
          {liveOpen && !reviewing ? (
            <button
              type="button"
              className="primary-action"
              onClick={() => workspaceHeadingRef.current?.focus()}
            >
              Continue: {title(live.incidentId)}
            </button>
          ) : next ? (
            <button
              type="button"
              className="primary-action"
              disabled={blocked || reviewing}
              onClick={() => start(next.id)}
            >
              Next incident: {title(next.id)}
            </button>
          ) : run ? (
            <p className="console-hint">No new incident is open on the rotation right now.</p>
          ) : null}
          {board.length ? (
            <ul className="rotation-list" aria-label="Incidents this act">
              {board.map((item) => {
                const isLive = liveOpen && item.id === live.incidentId;
                const done = completed.has(item.id);
                const status = isLive
                  ? 'In progress'
                  : done
                    ? 'Closed'
                    : !item.result.ok
                      ? 'Unavailable'
                      : item.result.value
                        ? 'Ready'
                        : 'Locked';
                return (
                  <li
                    key={item.id}
                    className={`rotation-item rotation-item--${status.toLowerCase().replace(' ', '-')}`}
                  >
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
                      {status}
                    </span>
                    {!isLive && !done && eligible(item) && item.id !== next?.id ? (
                      <button
                        type="button"
                        disabled={blocked || reviewing}
                        onClick={() => start(item.id)}
                      >
                        Start: {title(item.id)}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {sealed > 0 ? (
            <p className="console-hint">
              {sealed} more incident{sealed === 1 ? '' : 's'} sealed in later acts.
            </p>
          ) : null}
          {state.view && !state.view.progress.ok ? (
            <p role="alert">The rotation could not be checked against your record.</p>
          ) : null}
        </section>

        <section
          id="campaign-tools"
          tabIndex={-1}
          className="workspace-column"
          aria-label="Investigation workspace"
        >
          {attempt ? (
            <header className="panel console-incident">
              <p className="eyebrow">
                {reviewing ? 'ARCHIVED RECORD // READ ONLY' : 'ACTIVE INCIDENT'}
              </p>
              <h2 ref={workspaceHeadingRef} tabIndex={-1}>
                {title(attempt.incidentId)}
              </h2>
              <p>
                {attempt.incident.completionReached ? 'Closed' : 'In progress'} ·{' '}
                {formatElapsed(attempt.incident.elapsedSeconds)} elapsed
              </p>
              {reviewing ? (
                <>
                  <p>
                    You are reading an archived record. Nothing you open here changes your campaign
                    or what ORPHEUS knows about you.
                  </p>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      setReviewId(null);
                      setEnding(null);
                    }}
                  >
                    Back to current incident
                  </button>
                </>
              ) : null}
              {awaitingAck ? (
                <p className="console-hint" role="note">
                  ORPHEUS has a message for you. Actions resume once you confirm you have read it.
                </p>
              ) : null}
            </header>
          ) : (
            <p className="panel console-hint">
              No incident is open. Pick one from the rotation to begin.
            </p>
          )}
          {!reviewing ? (
            <CampaignGuidance
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
              <h2 id="campaign-action-title">Available actions</h2>
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
                      {a.title}
                    </button>
                    <span className="console-action-cost" id={`framework-cost-${a.id}`}>
                      Takes {formatElapsed(a.durationSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {finalComplete ? (
            <section className="panel finale-gate" aria-labelledby="campaign-finale-title">
              <p className="eyebrow">FINAL INCIDENT CLOSED</p>
              <h2 id="campaign-finale-title">Finale</h2>
              <p>
                The last incident is on the record. Read where your choices led. Reading it does not
                change anything.
              </p>
              <button type="button" disabled={blocked} onClick={queryEnding}>
                Read the ending
              </button>
              {ending !== undefined && ending !== null ? (
                <p role="status">
                  {ending.ok
                    ? ending.result.kind === 'resolved'
                      ? `Ending reached: ${ending.result.endingId}`
                      : ending.result.kind === 'ambiguous'
                        ? 'Your record points to more than one ending equally.'
                        : 'Your record does not match any authored ending.'
                    : 'The ending could not be checked against your record.'}
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
            tabIndex={-1}
            className="panel evidence-board"
            aria-labelledby="campaign-evidence-title"
          >
            <h2 id="campaign-evidence-title">Evidence board</h2>
            {state.view?.evidence.length ? (
              <ul className="evidence-pins">
                {state.view.evidence.map((e) => (
                  <li key={e.id}>
                    <h3>{e.title}</h3>
                    <p>{e.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="console-hint">No evidence pinned yet. Investigate to find some.</p>
            )}
          </section>
          <section
            id="campaign-history"
            tabIndex={-1}
            className="panel"
            aria-labelledby="campaign-history-title"
          >
            <h2 id="campaign-history-title">Archive</h2>
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
                            Review record: {attemptLabel(a)}
                          </button>
                          <span className="console-hint">
                            {a.incident.completionReached ? 'Closed' : 'Open'} ·{' '}
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
                          Replay: {title(incidentId)}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="console-hint">Closed incidents will be filed here.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

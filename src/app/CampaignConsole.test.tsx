// Isolated fixtures only; not production campaign reachability.
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignDesk } from './CampaignDesk.tsx';
import {
  actTitle,
  closedActionReasons,
  closedPanelActions,
  forecastComparisons,
  newestPackage,
  subjectProfile,
} from './campaign-copy.ts';
import { compositionFixture } from '../tests/fixtures/composition.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import type { CampaignRun } from '../engine/campaign/transitions.ts';
import type { ResolvedCampaignPackage } from '../scenario/campaign-package.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function session() {
  const f = compositionFixture();
  const factory = new IDBFactory();
  let sequence = 0;
  const ledger = createCampaignLedger(
    {
      definitions: new Map([
        [campaignDefinitionKey(f.definition.id, f.definition.version), f.definition],
      ]),
      scenarios: f.composition.catalog,
    },
    () => factory,
  );
  const store = createCampaignSessionStore({
    definition: f.definition,
    catalog: f.composition.catalog,
    runId: 'console-run',
    ledger,
    identity: () => 'console-' + sequence++,
  });
  await store.getState().load();
  await store.getState().create();
  return { ...f, store, ledger };
}

describe('player-facing campaign console', () => {
  it('shows an act banner, a titled rotation and a next-incident call to action without raw IDs', async () => {
    const f = await session();
    const user = userEvent.setup();
    render(
      <CampaignDesk store={f.store} composition={f.composition} seed={1001} onBack={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Act 6 — HUMAN SYSTEM' })).toBeVisible();
    expect(screen.getByText('All progress saved.')).toBeVisible();
    const rotation = screen.getByRole('region', { name: 'Incident rotation' });
    expect(within(rotation).getByText('Connection Saturation')).toBeInTheDocument();
    const next = within(rotation).getByRole('button', {
      name: 'Next incident: Connection Saturation',
    });
    expect(screen.queryByText(/stage-one|console-run|fixture-package/)).not.toBeInTheDocument();
    await user.click(next);
    await waitFor(() => expect(f.store.getState().run!.attempts).toHaveLength(1));
    expect(
      await within(rotation).findByRole('button', { name: 'Continue: Connection Saturation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Connection Saturation' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/stage-one/)).not.toBeInTheDocument();
  });

  it('presents ORPHEUS forecasts in-fiction, acknowledges only on an explicit click and compares them in the postmortem', async () => {
    const f = await session();
    for (let i = 0; i < 3; i++) {
      if (i === 0) await f.store.getState().start('stage-one', 1001);
      await f.store.getState().performAction('RESTART_API');
    }
    await f.store.getState().start('stage-one', 1001);
    const user = userEvent.setup();
    render(
      <CampaignDesk store={f.store} composition={f.composition} seed={1001} onBack={vi.fn()} />,
    );
    const offer = await screen.findByRole('button', {
      name: 'ORPHEUS has a forecast about you — show it',
    });
    await user.click(offer);
    const message = await screen.findByRole('region', { name: 'ORPHEUS message' });
    expect(within(message).getByText('TEST CONTENT — empirical prediction')).toBeVisible();
    expect(
      within(message).getByText(/^ORPHEUS forecast: Restart Payment API — \d+%$/),
    ).toBeVisible();
    expect(screen.queryByText(/RESTART_API|prediction:/)).not.toBeInTheDocument();
    // Showing the forecast is not an acknowledgement; actions wait for the click.
    expect(f.store.getState().run!.opportunities!.acknowledgements).toHaveLength(0);
    const restart = screen.getByRole('button', { name: 'Restart Payment API' });
    expect(restart).toBeDisabled();
    expect(restart).toHaveAccessibleDescription('Takes 01:00');
    await user.click(within(message).getByRole('button', { name: "I've read this" }));
    await waitFor(() => expect(restart).toBeEnabled());
    expect(f.store.getState().run!.opportunities!.acknowledgements).toHaveLength(1);
    await user.click(restart);
    await waitFor(() => expect(f.store.getState().run!.opportunities!.responses).toHaveLength(1));
    for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS'])
      expect(await f.store.getState().performAction(id)).toBe(true);
    const comparison = await screen.findByRole('region', {
      name: 'ORPHEUS forecast vs what you did',
    });
    expect(comparison).toHaveTextContent(/Forecast: Restart Payment API \(\d+%\)/);
    expect(comparison).toHaveTextContent('You: Restart Payment API');
    expect(comparison).toHaveTextContent('As forecast');
    expect(comparison).not.toHaveTextContent(/correct|score/i);
    // Closed incidents are filed in the archive; replay is offered exactly when the
    // engine's progression says a new attempt is eligible.
    const archive = screen.getByRole('region', { name: 'Archive' });
    expect(
      within(archive).getAllByRole('button', { name: /^Review record: Connection Saturation/ }),
    ).toHaveLength(2);
    const progress = f.store.getState().view!.progress;
    const eligible =
      progress.ok && 'incidents' in progress && progress.incidents[0]!.result.ok
        ? progress.incidents[0]!.result.value
        : false;
    expect(
      within(archive).queryAllByRole('button', { name: 'Replay: Connection Saturation' }),
    ).toHaveLength(eligible ? 1 : 0);
  });

  it('keeps archive review read-only and labels it in plain language', async () => {
    const f = await session();
    await f.store.getState().start('stage-one', 1001);
    const before = canonicalJson(f.store.getState().run);
    const user = userEvent.setup();
    render(
      <CampaignDesk store={f.store} composition={f.composition} seed={1001} onBack={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Review record: Connection Saturation' }));
    expect(screen.getByText(/You are reading an archived record/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'ORPHEUS' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart Payment API' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to current incident' }));
    expect(canonicalJson(f.store.getState().run)).toBe(before);
  });
});

describe('campaign console helpers', () => {
  it('lists campaign-gated panel actions as closed with a reason, derived only from the available list', () => {
    const f = compositionFixture();
    const definition = structuredClone(f.definition);
    const attempt = {
      incidentId: 'stage-one',
      incident: {
        contentVersion: f.scenario.contentVersion,
        completionReached: false,
        completedActionIds: ['OPEN_LOGS'],
      },
    } as unknown as CampaignRun['attempts'][number];
    definition.actionGates = ['RESTART_API', 'REINVESTIGATE_GHOST', 'OPEN_LOGS', 'SCALE_API'].map(
      (actionId) => ({
        id: actionId,
        incidentId: 'stage-one',
        contentVersion: f.scenario.contentVersion,
        actionId,
        eligibility: { type: 'compare', reference: 'act', operator: 'gte', expected: 1 },
      }),
    );
    const closed = closedPanelActions(
      definition,
      attempt,
      f.scenario,
      ['RESTART_API', 'REINVESTIGATE_GHOST', 'OPEN_LOGS', 'SCALE_API', 'INSPECT_DB'],
      [{ id: 'SCALE_API' }],
    );
    expect(closed).toEqual([
      { id: 'RESTART_API', title: 'Restart Payment API', reason: closedActionReasons.record },
      {
        id: 'REINVESTIGATE_GHOST',
        title: 'Reinvestigate Ghost',
        reason: closedActionReasons.known,
      },
    ]);
    expect(closedActionReasons.record).toBe("Not open to you: your record doesn't support this.");
    expect(closedActionReasons.known).toBe('Already on record.');
    expect(
      closedPanelActions(
        definition,
        { ...attempt, incident: { ...attempt.incident, completionReached: true } },
        f.scenario,
        ['RESTART_API'],
        [],
      ),
    ).toEqual([]);
  });

  it('builds the subject profile from available behavior metrics only', () => {
    const metric = (status: 'available' | 'unavailable', value = 0, n = 0, d = 0) =>
      status === 'available'
        ? { status, value, numerator: n, denominator: d, coverage: {}, provenance: [] }
        : {
            status,
            reason: 'NO_SAMPLES',
            numerator: 0,
            denominator: 0,
            coverage: {},
            provenance: [],
          };
    const run = {
      behavior: {
        metrics: {
          restartRate: metric('available', 0.25, 1, 4),
          averageInvestigationDepth: metric('available', 2.5, 5, 2),
          predictionDeviation: metric('available', 0, 0, 1),
          nullCooperationRate: metric('unavailable'),
        },
      },
    } as unknown as CampaignRun;
    expect(subjectProfile(run)).toEqual([
      {
        key: 'restartRate',
        label: 'Restarted a service as the response',
        value: '25%',
        detail: '1 of 4',
      },
      {
        key: 'averageInvestigationDepth',
        label: 'Investigation depth (distinct findings per incident)',
        value: '2.5',
        detail: 'across 2 incidents',
      },
      {
        key: 'predictionDeviation',
        label: 'Did something other than ORPHEUS forecast',
        value: '0%',
        detail: '0 of 1',
      },
    ]);
    expect(subjectProfile({} as CampaignRun)).toEqual([]);
  });

  it('pairs only shown predictions with the recorded response for the same attempt', () => {
    const run = {
      opportunities: {
        preparations: [
          {
            id: 'p1',
            kind: 'prediction',
            prediction: {
              ok: true,
              result: { kind: 'predicted', actionId: 'RESTART_API', confidence: 0.784 },
            },
          },
          {
            id: 'p2',
            kind: 'prediction',
            prediction: { ok: true, result: { kind: 'unknown', reason: 'EMPTY_HISTORY' } },
          },
          { id: 'p3', kind: 'recommendation', prediction: null },
        ],
        acknowledgements: [],
        responses: [
          { preparationId: 'p1', attemptId: 'a', actionId: 'SCALE_API' },
          { preparationId: 'p2', attemptId: 'a', actionId: 'SCALE_API' },
          { preparationId: 'p3', attemptId: 'a', actionId: 'SCALE_API' },
          { preparationId: 'p1', attemptId: 'other', actionId: 'RESTART_API' },
        ],
      },
    } as unknown as CampaignRun;
    expect(forecastComparisons(run, 'a', compositionFixture().scenario)).toEqual([
      {
        key: 'p1',
        predicted: 'Restart Payment API',
        confidence: '78%',
        actual: 'Scale Payment API',
        matched: false,
      },
    ]);
  });

  it('chooses the newest package version for a new campaign and names acts', () => {
    const pkg = (version: string) => ({ package: { version } }) as ResolvedCampaignPackage;
    expect(newestPackage([pkg('1.0.0'), pkg('1.10.0'), pkg('1.2.0')])?.package.version).toBe(
      '1.10.0',
    );
    expect(newestPackage([])).toBeUndefined();
    expect(actTitle(7)).toBe('Act 7 — THE BOARD');
    expect(actTitle(12)).toBe('Act 12');
  });
});

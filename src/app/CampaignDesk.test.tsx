import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignDesk } from './CampaignDesk.tsx';
import { AppShell } from './AppShell.tsx';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import {
  opportunityCampaignFixture,
  trainedFixture,
  prepareFixture,
  acknowledgeFixture,
  fixtureOperation,
} from '../tests/fixtures/opportunities.ts';
import { campaignCatalog } from '../tests/fixtures/campaign.ts';
import { fixtureLedger, fixtureIdentity } from '../tests/fixtures/ledger.ts';
import { endingFixture } from '../tests/fixtures/endings.ts';
import { rootCauseResolutionReplay } from '../tests/fixtures/inc-001-replays.ts';
import { elapsed } from '../tests/fixtures/prediction.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function setup(prepare = false) {
  const definition = opportunityCampaignFixture();
  let run = trainedFixture(definition);
  if (prepare) run = acknowledgeFixture(definition, prepareFixture(definition, run));
  const { ledger } = await fixtureLedger(definition, campaignCatalog, run);
  const options = {
    definition,
    catalog: campaignCatalog,
    runId: run.runId,
    ledger,
    identity: fixtureIdentity('screen'),
  };
  const store = createCampaignSessionStore(options);
  await store.getState().load();
  return { store, options, ledger };
}
describe('opt-in campaign framework presentation, not native certification', () => {
  it('actual visible confirmation is durable before a direct action, while remount/archive visits add no samples', async () => {
    const { store, ledger } = await setup();
    const user = userEvent.setup();
    const mounted = render(<CampaignDesk store={store} seed={1002} onBack={() => {}} />);
    await user.click(
      screen.getByRole('button', { name: 'ORPHEUS has something for you — show it' }),
    );
    expect(await screen.findByText('TEST CONTENT — empirical prediction')).toBeVisible();
    expect(screen.getByText(/ORPHEUS forecast: Restart Payment API — \d+%/)).toBeVisible();
    expect(store.getState().run!.opportunities!.acknowledgements).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Restart Payment API' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: "I've read this" }));
    await waitFor(() =>
      expect(screen.getByText(/Logged: you have read this message/)).toBeVisible(),
    );
    expect(store.getState().run!.opportunities!.acknowledgements).toHaveLength(1);
    const persisted = await ledger.read(store.getState().run!.runId);
    expect(persisted).toMatchObject({ ok: true, run: store.getState().run });
    const beforeReview = canonicalJson(store.getState().run);
    for (let i = 0; i < 2; i++) {
      await user.click(
        screen.getByRole('button', { name: 'Review record: Stage One (attempt 1)' }),
      );
      expect(screen.queryByRole('button', { name: "I've read this" })).not.toBeInTheDocument();
      expect(screen.getByText(/You are reading an archived record/)).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Back to current incident' }));
    }
    expect(canonicalJson(store.getState().run)).toBe(beforeReview);
    mounted.unmount();
    render(<CampaignDesk store={store} seed={1002} onBack={() => {}} />);
    expect(canonicalJson(store.getState().run)).toBe(beforeReview);
    await user.click(screen.getByRole('button', { name: 'Restart Payment API' }));
    await waitFor(() =>
      expect(store.getState().run!.behavior!.metrics.predictionDeviation).toMatchObject({
        numerator: 0,
        denominator: 1,
      }),
    );
    expect(store.getState().run!.attempts.at(-1)!.incident.elapsedSeconds).toBe(60);
    expect(store.getState().run!.opportunities!.responses).toHaveLength(1);
  });
  it('hidden documents cannot ACK and gated-off authoring is not displayed', async () => {
    const { store } = await setup();
    const user = userEvent.setup();
    render(<CampaignDesk store={store} seed={1002} onBack={() => {}} />);
    await user.click(
      screen.getByRole('button', { name: 'ORPHEUS has something for you — show it' }),
    );
    await screen.findByText('TEST CONTENT — empirical prediction');
    const revision = store.getState().run!.revision;
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await user.click(screen.getByRole('button', { name: "I've read this" }));
    expect(store.getState().run!.revision).toBe(revision);
    expect(store.getState().run!.opportunities!.acknowledgements).toHaveLength(0);
    hidden.mockRestore();
    cleanup();
    const definition = opportunityCampaignFixture();
    definition.opportunities!.rules[0]!.reveal = { type: 'not', child: elapsed };
    const run = trainedFixture(definition);
    const { ledger } = await fixtureLedger(definition, campaignCatalog, run);
    const gated = createCampaignSessionStore({
      definition,
      catalog: campaignCatalog,
      runId: run.runId,
      ledger,
    });
    await gated.getState().load();
    render(<CampaignDesk store={gated} seed={1002} onBack={() => {}} />);
    expect(screen.queryByText('TEST CONTENT — empirical prediction')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'ORPHEUS has something for you — show it' }),
    ).not.toBeInTheDocument();
    expect(gated.getState().run!.opportunities!.preparations).toHaveLength(0);
  });
  it('keeps command controls blocked until the ACK transaction finishes', async () => {
    const { options } = await setup();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = createCampaignSessionStore({
      ...options,
      ledger: {
        read: options.ledger.read,
        async commit(req) {
          const op = req.operation as { kind: string };
          if (op.kind === 'acknowledge_presentation') await barrier;
          return options.ledger.commit(req);
        },
      },
    });
    await store.getState().load();
    const user = userEvent.setup();
    render(<CampaignDesk store={store} seed={1002} onBack={() => {}} />);
    await user.click(
      screen.getByRole('button', { name: 'ORPHEUS has something for you — show it' }),
    );
    await screen.findByText('TEST CONTENT — empirical prediction');
    await user.click(screen.getByRole('button', { name: "I've read this" }));
    expect(store.getState().run!.opportunities!.acknowledgements).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Restart Payment API' })).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Restart Payment API' })).toBeEnabled(),
    );
    expect(store.getState().run!.behavior!.metrics.predictionDeviation.denominator).toBe(0);
  });
  it('exposes keyboard controls, 150% text, reduced-motion toggles and non-color cues without raw hidden values', async () => {
    const { store } = await setup();
    const user = userEvent.setup();
    const back = vi.fn();
    render(<CampaignDesk store={store} seed={1002} onBack={back} />);
    const before = canonicalJson(store.getState().run);
    await user.click(screen.getByText('Display settings'));
    await user.selectOptions(screen.getByLabelText('Text scale'), 'extra-large');
    await user.click(screen.getByLabelText('Reduce animation'));
    await user.click(screen.getByLabelText('CRT effects'));
    // One global setting: applied to the document, not a per-screen inline style.
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'extra-large');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(document.documentElement).toHaveAttribute('data-crt-effects', 'off');
    expect(screen.getByRole('main').style.fontSize).toBe('');
    expect(screen.getByText('All progress saved.')).toBeVisible();
    expect(
      screen.queryByText(/AI_DEPENDENCY|CORPORATE_ALIGNMENT|story completion/i),
    ).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Back to incident desk' }).focus();
    await user.keyboard('{Enter}');
    expect(back).toHaveBeenCalledOnce();
    expect(canonicalJson(store.getState().run)).toBe(before);
  });
  it('shared desk opts in explicitly and keeps legacy stores isolated across navigation', async () => {
    const { store } = await setup();
    const legacyIncident = { read: vi.fn(() => null), write: vi.fn() };
    const legacyProgress = { read: vi.fn(() => null), write: vi.fn() };
    const user = userEvent.setup();
    const { unmount } = render(
      <AppShell incidentStorage={legacyIncident} progressStorage={legacyProgress} />,
    );
    expect(
      screen.queryByRole('button', { name: 'Open opt-in campaign framework' }),
    ).not.toBeInTheDocument();
    unmount();
    render(
      <AppShell
        incidentStorage={legacyIncident}
        progressStorage={legacyProgress}
        campaign={{ store, seed: 1002 }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open opt-in campaign framework' }));
    await user.click(await screen.findByRole('button', { name: 'Back to incident desk' }));
    expect(screen.getByRole('heading', { name: 'The Orpheus Project' })).toBeVisible();
    expect(legacyIncident.write).not.toHaveBeenCalled();
    expect(legacyProgress.write).not.toHaveBeenCalled();
  });
  it('ending fixture query is read-only and data-driven, never a grant or production final incident', async () => {
    const { d, catalog } = endingFixture();
    let run: CampaignRun | null = null;
    function apply(payload: Parameters<typeof fixtureOperation>[2]) {
      const result = prepareCampaignOperation(d, catalog, run, fixtureOperation(d, run, payload));
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      run = result.run;
      return result.run;
    }
    apply({ kind: 'create' });
    apply({ kind: 'start', incidentId: 'stage-one', attemptId: 'final', seed: 1002 });
    for (const actionId of [
      'RESTORE_AUTHORITY',
      ...rootCauseResolutionReplay.commands.map((c) => c.actionId),
    ]) {
      const r = run! as CampaignRun;
      const a = r.attempts.at(-1)!;
      apply({
        kind: 'command',
        attemptId: a.id,
        priorHead: campaignAttemptHead(a),
        inputId: 'final-' + r.revision,
        commandSequence: a.incident.replayLog.length,
        command: { type: 'perform_action', actionId },
      });
    }
    const r = run! as CampaignRun;
    const { ledger } = await fixtureLedger(d, catalog, r);
    const store = createCampaignSessionStore({ definition: d, catalog, ledger, runId: r.runId });
    await store.getState().load();
    const before = canonicalJson(store.getState().run);
    render(<CampaignDesk store={store} seed={1002} onBack={() => {}} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Read the ending' }));
    expect(screen.getByText('Ending reached: CONTINUITY')).toBeVisible();
    expect(canonicalJson(store.getState().run)).toBe(before);
  });
});

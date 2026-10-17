// Deferred DOM fixtures only. Not native/full-campaign acceptance.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignEnding } from './CampaignEnding.tsx';
import { CampaignDesk } from './CampaignDesk.tsx';
import { endingPresentationFixture } from '../tests/fixtures/ending-presentation.ts';
import { fixtureLedger, fixtureIdentity } from '../tests/fixtures/ledger.ts';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';

afterEach(cleanup);
describe('DEC-058 read-only ending UI (deferred)', () => {
  it('shows actual final consequences, labels future fiction and never creates an approval button', () => {
    const f = endingPresentationFixture(),
      run = f.complete();
    const before = canonicalJson(run);
    render(<CampaignEnding composition={f.composition} run={run} {...f.request(run)} />);
    expect(screen.getByRole('heading', { name: 'CUSTODIAN' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Actual final incident record' })).toBeVisible();
    expect(
      screen.getByRole('table', { name: 'Recorded service signals at this final attempt' }),
    ).toBeVisible();
    expect(
      screen.getAllByText(/Authored future institutional report — not measured player behavior/),
    ).toHaveLength(2);
    expect(screen.getByText(/98.4%/)).toBeVisible();
    expect(screen.getByText(/MODEL LINEAGE:/)).toBeVisible();
    expect(screen.getByText(/If the system makes the recommendation/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'APPROVE ALL' })).not.toBeInTheDocument();
    // Finale framing plus a read-only profile of measured (available) behavior only.
    const profile = screen.getByRole('region', { name: 'ORPHEUS subject profile' });
    for (const [key, metric] of Object.entries(run.behavior?.metrics ?? {}))
      if (metric.status !== 'available')
        expect(profile).not.toHaveTextContent(new RegExp(key, 'i'));
    expect(within(profile).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/ENDING_PRESENTATION|CUSTODIAN_/)).not.toBeInTheDocument();
    expect(canonicalJson(run)).toBe(before);
  });
  it('does not mount hidden title/epilogue content or render forged flags', () => {
    const f = endingPresentationFixture(false),
      run = f.complete();
    const mounted = render(
      <CampaignEnding composition={f.composition} run={run} {...f.request(run)} />,
    );
    expect(screen.queryByText(/There is no Project ORPHEUS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PROMETHEUS/)).not.toBeInTheDocument();
    const forged = structuredClone(run);
    forged.projection.narrativeFlags.PROJECT_DISTRIBUTED = true;
    mounted.rerender(
      <CampaignEnding composition={f.composition} run={forged} {...f.request(forged)} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Ending presentation unavailable');
    expect(screen.queryByRole('heading', { name: 'CUSTODIAN' })).not.toBeInTheDocument();
  });
  it('queries only on request and invalidates stale displayed prose after durable reload', async () => {
    const f = endingPresentationFixture(),
      run = f.complete();
    const { ledger } = await fixtureLedger(f.d, f.catalog, run);
    const store = createCampaignSessionStore({
      definition: f.d,
      catalog: f.catalog,
      runId: run.runId,
      ledger,
      identity: fixtureIdentity('ending-screen'),
    });
    await store.getState().load();
    const before = canonicalJson(store.getState().run);
    const user = userEvent.setup();
    render(
      <CampaignDesk composition={f.composition} store={store} seed={1002} onBack={() => {}} />,
    );
    expect(screen.queryByRole('heading', { name: 'CUSTODIAN' })).not.toBeInTheDocument();
    const query = screen.getByRole('button', { name: 'Read the ending' });
    query.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'CUSTODIAN' })).toBeVisible();
    expect(canonicalJson(store.getState().run)).toBe(before);
    await user.click(screen.getByRole('button', { name: 'Reload saved campaign' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'CUSTODIAN' })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Read the ending' }));
    expect(screen.getByRole('heading', { name: 'CUSTODIAN' })).toBeVisible();
    expect(canonicalJson(store.getState().run)).toBe(before);
    const persisted = await ledger.read(run.runId);
    expect(persisted).toMatchObject({ ok: true, run: store.getState().run });
  });
});

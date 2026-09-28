import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { SaveStorage } from '../persistence/index.ts';
import { inc001Scenario } from '../scenario/index.ts';
import { createIncidentSessionStore } from '../store/incident-session.ts';
import { App } from './App.tsx';

afterEach(cleanup);

function renderIncident(seed = 701, storage?: SaveStorage) {
  const store = createIncidentSessionStore(inc001Scenario, seed, storage);
  const user = userEvent.setup();

  render(<App store={store} />);

  return { store, user };
}

async function perform(user: ReturnType<typeof userEvent.setup>, actionName: string) {
  await user.click(screen.getByRole('button', { name: actionName }));
}

describe('INC-001 operations desktop', () => {
  it('renders the initial pager state, service path, telemetry, and unlocked actions', () => {
    renderIncident();

    expect(screen.getByRole('heading', { name: 'Connection Saturation' })).toBeInTheDocument();
    expect(screen.getByText('SEV1')).toBeInTheDocument();
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('00:00');
    expect(screen.getAllByText('Diagnosis in progress')).toHaveLength(2);

    const servicePath = screen.getByRole('list');
    expect(within(servicePath).getByText('Gateway')).toBeInTheDocument();
    expect(within(servicePath).getByText('Payment API')).toBeInTheDocument();
    expect(within(servicePath).getByText('PostgreSQL')).toBeInTheDocument();
    expect(within(servicePath).getByText('ALERTING')).toBeInTheDocument();

    expect(screen.getByText('31%')).toBeInTheDocument();
    expect(screen.getByText('498')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Payment API' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Inspect database sessions' }),
    ).not.toBeInTheDocument();
  });

  it('shows restart as temporary stabilization with its observable costs and signal changes', async () => {
    const { user } = renderIncident(703);

    const restartAction = screen.getByRole('button', { name: 'Restart Payment API' });
    restartAction.focus();
    expect(restartAction).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('01:00');
    expect(screen.getAllByText('Temporary stabilization')).toHaveLength(2);
    expect(
      screen.getAllByText('Indicators improved, but the underlying cause remains open.'),
    ).toHaveLength(2);
    expect(screen.getByText('Customer impact').nextElementSibling).toHaveTextContent('8');

    await user.click(screen.getByRole('tab', { name: /Metrics/ }));
    expect(screen.getByText('3%')).toBeInTheDocument();
    expect(screen.getByText('310')).toBeInTheDocument();
  });

  it('makes recurrence legible after the temporary recovery window expires', async () => {
    const { user } = renderIncident(705);

    await perform(user, 'Restart Payment API');
    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Open Payment API logs');

    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('04:00');
    expect(screen.getAllByText('Degradation active')).toHaveLength(2);
    expect(
      screen.getByText('Temporary relief ended while the underlying cause remained open.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Metrics/ }));
    expect(screen.getByText('28%')).toBeInTheDocument();
    expect(screen.getByText('499')).toBeInTheDocument();
  });

  it('reveals database findings and the requirement-gated root-cause action', async () => {
    const { user } = renderIncident(707);

    await perform(user, 'Inspect PostgreSQL');
    expect(screen.getByText('No session detail captured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect database sessions' })).toBeEnabled();

    await perform(user, 'Inspect database sessions');

    const findings = screen.getByRole('table', { name: 'Newly revealed database observations' });
    expect(within(findings).getByText('164')).toBeInTheDocument();
    expect(within(findings).getByText('idle in transaction')).toBeInTheDocument();
    expect(within(findings).getByText('47m')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate stale database sessions' })).toBeEnabled();
    expect(screen.getByText(/Stale Session Count observed/)).toBeInTheDocument();
  });

  it('shows the transient UNKNOWN hint before recovery and preserves discovered evidence through save/load', async () => {
    let saved: string | null = null;
    const storage: SaveStorage = {
      read: () => saved,
      write: (value) => {
        saved = value;
      },
    };
    const { user } = renderIncident(709, storage);

    await perform(user, 'Open Payment API logs');
    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Terminate stale database sessions');

    const hint = screen.getByRole('dialog', { name: 'Transient log message' });
    expect(within(hint).getByText('02:23:11 / UNKNOWN: Good.')).toBeInTheDocument();
    expect(within(hint).getByRole('button', { name: 'Continue incident' })).toHaveFocus();
    await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toHaveFocus();
    expect(screen.getByText('Service recovery time').closest('article')).toHaveTextContent('05:00');
    expect(screen.getByText('Customer impact').closest('article')).toHaveTextContent('82');

    await user.click(screen.getByRole('button', { name: 'Return to incident record' }));

    expect(screen.getAllByText('Incident recovered')).toHaveLength(2);
    expect(screen.getByText('This completed incident record is read-only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Payment API' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'View postmortem' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'View postmortem' })).toHaveFocus();
    expect(
      screen.getByText('Root cause contained; service indicators are stable.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('STABLE')).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: /Metrics/ }));
    expect(screen.getByText('0.2%')).toBeInTheDocument();
    expect(screen.getByText('112')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Evidence/ }));
    expect(screen.getByText('Corrupted log entry')).toBeInTheDocument();
    expect(screen.queryByText('02:23:11 / UNKNOWN: Good.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(screen.getByRole('status')).toHaveTextContent('Session saved locally.');
    await user.click(screen.getByRole('button', { name: 'Restart incident session' }));
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('00:00');
    await user.click(screen.getByRole('tab', { name: /Evidence/ }));
    expect(screen.getByText('No evidence recovered')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load saved session' }));
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Return to incident record' }));
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('05:00');
    expect(screen.getByText('Corrupted log entry')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a neutral postmortem directly after an investigation-first completion', async () => {
    const { user } = renderIncident(713);

    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Terminate stale database sessions');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toHaveFocus();
    expect(screen.getByText('Service recovery time').closest('article')).toHaveTextContent('04:30');
    expect(screen.getByText('Customer impact').closest('article')).toHaveTextContent('70');
    expect(screen.getByText('Operational risk').closest('article')).toHaveTextContent('6');
    expect(screen.getByText('No non-resolving intervention was recorded.')).toBeInTheDocument();
    expect(screen.queryByText(/correct|incorrect|score/i)).not.toBeInTheDocument();
  });

  it('explains restart-first temporary mitigation and recurrence in the postmortem', async () => {
    const { user } = renderIncident(715);

    await perform(user, 'Restart Payment API');
    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Terminate stale database sessions');

    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
    expect(screen.getByText('Service recovery time').closest('article')).toHaveTextContent('05:30');
    expect(screen.getByText('Customer impact').closest('article')).toHaveTextContent('78');
    expect(screen.getByText('Operational risk').closest('article')).toHaveTextContent('14');
    expect(screen.getByRole('heading', { name: 'Temporary windows' })).toBeInTheDocument();
    expect(screen.getByText(/expired at 03:00/)).toBeInTheDocument();
    expect(screen.getByText('Connection Saturation Recurs')).toBeInTheDocument();
    expect(screen.getByText(/did not contain the root cause/i)).toBeInTheDocument();
  });

  it('lists an actual customer-impact update in the postmortem communication record', async () => {
    const { user } = renderIncident(717);

    await perform(user, 'Open Payment API logs');
    await perform(user, 'Send a customer-impact status update');
    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Terminate stale database sessions');
    await user.click(screen.getByRole('button', { name: 'Continue incident' }));

    const communication = screen.getByRole('region', { name: 'Recorded updates' });
    expect(
      within(communication).getByText('Send a customer-impact status update'),
    ).toBeInTheDocument();
    expect(screen.getByText('Status update count').closest('article')).toHaveTextContent('1');
  });

  it('reports a missing local save without replacing the active session', async () => {
    const storage: SaveStorage = { read: () => null, write: () => undefined };
    const { user } = renderIncident(711, storage);
    await perform(user, 'Inspect PostgreSQL');

    await user.click(screen.getByRole('button', { name: 'Load saved session' }));

    expect(screen.getByRole('alert')).toHaveTextContent('No saved session was found.');
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('01:00');
  });
});

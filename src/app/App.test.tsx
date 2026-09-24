import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { inc001Scenario } from '../scenario/index.ts';
import { createIncidentSessionStore } from '../store/incident-session.ts';
import { App } from './App.tsx';

afterEach(cleanup);

function renderIncident(seed = 701) {
  const store = createIncidentSessionStore(inc001Scenario, seed);
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

  it('reaches root-cause recovery and surfaces the discovered UNKNOWN log artifact', async () => {
    const { user } = renderIncident(709);

    await perform(user, 'Open Payment API logs');
    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Terminate stale database sessions');

    expect(screen.getAllByText('Incident recovered')).toHaveLength(2);
    expect(
      screen.getByText('Root cause contained; service indicators are stable.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('STABLE')).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: /Metrics/ }));
    expect(screen.getByText('0.2%')).toBeInTheDocument();
    expect(screen.getByText('112')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Logs/ }));
    expect(screen.getByText('02:23:11 / UNKNOWN: Good.')).toBeInTheDocument();
  });
});

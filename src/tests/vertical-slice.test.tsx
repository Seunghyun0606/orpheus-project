import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../app/App.tsx';
import { presentationStorageKey } from '../app/presentation-settings.ts';
import type { SaveStorage } from '../persistence/index.ts';
import { inc001Scenario } from '../scenario/index.ts';
import { createIncidentSessionStore } from '../store/incident-session.ts';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(presentationStorageKey);
});

describe('INC-001 complete vertical slice', () => {
  it('operates from Pager to UNKNOWN evidence, local restore, and postmortem by keyboard', async () => {
    let saved: string | null = null;
    const storage: SaveStorage = {
      read: () => saved,
      write: (value) => {
        saved = value;
      },
    };
    const store = createIncidentSessionStore(inc001Scenario, 901, storage);
    const user = userEvent.setup();
    render(<App store={store} />);

    async function reachByTab(target: HTMLElement) {
      for (let attempt = 0; attempt < 60 && document.activeElement !== target; attempt += 1) {
        await user.tab();
      }
      expect(target).toHaveFocus();
    }

    async function activate(name: string) {
      const button = screen.getByRole('button', { name });
      await reachByTab(button);
      await user.keyboard('{Enter}');
    }

    expect(screen.getByText('SEV1')).toBeInTheDocument();
    expect(screen.getByText('31%')).toBeInTheDocument();
    expect(screen.getByText('498')).toBeInTheDocument();
    expect(screen.getAllByText('Diagnosis in progress')).toHaveLength(2);

    await activate('Open Payment API logs');
    expect(screen.getByRole('heading', { name: 'Incident logs' })).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();

    await activate('Inspect PostgreSQL');
    await activate('Inspect database sessions');
    const findings = screen.getByRole('table', { name: 'Newly revealed database observations' });
    expect(within(findings).getByText('164')).toBeInTheDocument();
    expect(within(findings).getByText('idle in transaction')).toBeInTheDocument();

    const databaseTab = screen.getByRole('tab', { name: /Database/ });
    await reachByTab(databaseTab);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Status/ })).toHaveFocus();
    expect(screen.getByText('Open')).toBeInTheDocument();

    await activate('Terminate stale database sessions');
    const hint = screen.getByRole('dialog', { name: 'Transient log message' });
    expect(within(hint).getByText('02:23:11 / UNKNOWN: Good.')).toBeInTheDocument();
    expect(within(hint).getByRole('button', { name: 'Continue incident' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toHaveFocus();
    expect(screen.getByText('Service recovery time').closest('article')).toHaveTextContent('05:00');
    expect(screen.getByText('Customer impact').closest('article')).toHaveTextContent('82');

    await activate('Return to incident record');
    expect(screen.getByRole('button', { name: 'View postmortem' })).toHaveFocus();
    expect(screen.getAllByText('Incident recovered')).toHaveLength(2);
    const activeTabAfterReturn = screen.getByRole('tab', { selected: true });
    await reachByTab(activeTabAfterReturn);
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Evidence/ })).toHaveFocus();
    expect(screen.getByText('Corrupted log entry')).toBeInTheDocument();

    await activate('Save session');
    expect(screen.getByRole('status')).toHaveTextContent('Session saved locally.');
    await activate('Restart incident session');
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('00:00');
    await activate('Load saved session');
    expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toHaveFocus();
    await activate('Return to incident record');
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('05:00');
    const metricsTab = screen.getByRole('tab', { name: /Metrics/ });
    await reachByTab(metricsTab);
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Evidence/ })).toHaveFocus();
    expect(screen.getByText('Corrupted log entry')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Payment API' })).toBeDisabled();
  });
});

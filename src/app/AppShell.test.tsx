import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { encodeSave, type SaveStorage } from '../persistence/index.ts';
import { getScenario } from '../scenario/index.ts';
import { createIncidentState } from '../engine/index.ts';
import { AppShell } from './AppShell.tsx';
import { presentationStorageKey } from './presentation-settings.ts';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: SaveStorage = {
    read: () => value,
    write: (next) => {
      value = next;
    },
  };
  return {
    storage,
    read: () => value,
    replace: (next: string) => {
      value = next;
    },
  };
}

function savedIncident(id: string, seed = 1234): string {
  const scenario = getScenario(id);
  if (scenario === undefined) throw new Error(`Missing ${id}`);
  return encodeSave(scenario, seed, createIncidentState(scenario, { seed }));
}

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(presentationStorageKey);
});

const routes = [
  [
    'INC-001',
    [
      'Open Payment API logs',
      'Inspect PostgreSQL',
      'Inspect database sessions',
      'Terminate stale database sessions',
    ],
  ],
  [
    'INC-002',
    [
      'Open Identity API and verifier logs',
      'Trace a failed payment authorization',
      'Compare build 1847 with the stable deployment',
      'Ask Sam to inspect the verifier key set',
      'Distribute the new key set to Token Verifier',
    ],
  ],
  [
    'INC-003',
    [
      'Open Receipt Worker logs',
      'Trace the repeatedly rejected receipt',
      'Compare partner batch 781 with accepted receipts',
      'Ask Jin to confirm the customer impact',
      'Add a scoped dead-letter rule for the malformed format',
    ],
  ],
] as const;

describe('three-incident desktop', () => {
  it('carries completed discoveries into the next incident without replacing the incident slot', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage();
    const progress = memoryStorage();
    render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    for (const name of routes[0][1]) {
      await user.click(screen.getByRole('button', { name }));
      const hint = screen.queryByRole('dialog');
      if (hint) await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));
    }
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    await user.click(screen.getByRole('button', { name: 'Start INC-002' }));
    await user.click(screen.getByRole('tab', { name: /Evidence/ }));
    expect(screen.getByRole('heading', { name: 'Corrupted log entry' })).toBeInTheDocument();
    expect(incident.read()).toBeNull();
  });

  it('reviews a completed record without discarding an unfinished replay of that incident', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage();
    const progress = memoryStorage();
    render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    for (const name of routes[0][1]) {
      await user.click(screen.getByRole('button', { name }));
      const hint = screen.queryByRole('dialog');
      if (hint) await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));
    }
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    await user.click(screen.getByRole('button', { name: 'Restart INC-001' }));
    await user.click(screen.getByRole('button', { name: 'Open Payment API logs' }));
    const elapsed = screen.getByTestId('elapsed-time').textContent;
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    await user.click(screen.getByRole('button', { name: 'Review INC-001' }));
    expect(screen.queryByRole('button', { name: 'Restart incident' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save session' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    await user.click(screen.getByRole('button', { name: 'Continue INC-001' }));
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent(elapsed ?? '');
    expect(screen.getByRole('heading', { name: 'Connection Saturation' })).toBeInTheDocument();
  });

  it.each(routes)(
    'plays %s through postmortem and revisits its archived record',
    async (id, actions) => {
      const user = userEvent.setup();
      const incident = memoryStorage();
      const progress = memoryStorage();
      const view = render(
        <AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />,
      );
      expect(screen.getByRole('heading', { name: 'The Orpheus Project' })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: `Start ${id}` }));
      const scenario = getScenario(id);
      if (scenario === undefined) throw new Error(`Missing ${id}`);
      expect(screen.getByRole('heading', { name: scenario.title })).toBeInTheDocument();
      for (const name of actions) {
        await user.click(screen.getByRole('button', { name }));
        const hint = screen.queryByRole('dialog');
        if (hint) await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));
      }
      expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
      expect(progress.read()).not.toBeNull();
      await user.click(screen.getByRole('button', { name: 'Incident desk' }));
      expect(screen.getByRole('button', { name: `Review ${id}` })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: `Review ${id}` }));
      expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
      expect(screen.getByText(new RegExp(scenario.title))).toBeInTheDocument();
      view.unmount();
      render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
      await user.click(screen.getByRole('button', { name: `Review ${id}` }));
      expect(screen.getByRole('heading', { name: 'Incident postmortem' })).toBeInTheDocument();
    },
  );

  it('keeps the single slot until cross-incident replacement is confirmed, then resumes it', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage();
    const progress = memoryStorage();
    const view = render(
      <AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />,
    );
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    await user.click(screen.getByRole('button', { name: 'Open Payment API logs' }));
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    const firstSave = incident.read();
    expect(firstSave).toContain('INC-001');
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    await user.click(screen.getByRole('button', { name: 'Start INC-002' }));
    const trigger = screen.getByRole('button', { name: 'Save session' });
    await user.click(trigger);
    const dialog = screen.getByRole('alertdialog', { name: 'Replace the local save?' });
    expect(dialog).toHaveTextContent('INC-001');
    expect(incident.read()).toBe(firstSave);
    expect(within(dialog).getByRole('button', { name: 'Confirm replacement' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(within(dialog).getByRole('button', { name: 'Keep existing save' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(incident.read()).toBe(firstSave);
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(incident.read()).toContain('INC-002');
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    view.unmount();
    render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
    await user.click(screen.getByRole('button', { name: 'Resume saved INC-002' }));
    expect(screen.getByRole('heading', { name: 'Bad Deployment' })).toBeInTheDocument();
  });

  it('does not erase malformed or incompatible saves when a new incident is saved', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage('{broken');
    const progress = memoryStorage();
    const view = render(
      <AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Saved incident');
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(incident.read()).toBe('{broken');
    expect(screen.getByRole('alert')).toHaveTextContent('not valid JSON');
    view.unmount();

    const incompatible = JSON.parse(savedIncident('INC-002')) as { contentVersion: string };
    incompatible.contentVersion = '99.0.0';
    incident.replace(JSON.stringify(incompatible));
    render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    const before = incident.read();
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(incident.read()).toBe(before);
    expect(screen.getByRole('alert')).toHaveTextContent('unsupported scenario content version');
  });

  it('keeps incident entry available when the separate campaign archive is malformed', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage();
    const progress = memoryStorage('{broken');
    render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Campaign progress');
    await user.click(screen.getByRole('button', { name: 'Start INC-003' }));
    expect(screen.getByRole('heading', { name: 'Queue Backlog' })).toBeInTheDocument();
    expect(progress.read()).toBe('{broken');
  });

  it('requires a new confirmation if another incident replaces the slot while the dialog is open', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage(savedIncident('INC-001'));
    const progress = memoryStorage();
    render(<AppShell incidentStorage={incident.storage} progressStorage={progress.storage} />);
    await user.click(screen.getByRole('button', { name: 'Start INC-002' }));
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    incident.replace(savedIncident('INC-003'));
    await user.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('INC-003');
    expect(incident.read()).toContain('INC-003');
  });

  it('requires a fresh confirmation when the same other incident slot changes during the dialog', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage(savedIncident('INC-001'));
    render(
      <AppShell incidentStorage={incident.storage} progressStorage={memoryStorage().storage} />,
    );
    await user.click(screen.getByRole('button', { name: 'Start INC-002' }));
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    const replacement = savedIncident('INC-001', 9876);
    incident.replace(replacement);
    await user.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(incident.read()).toBe(replacement);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('INC-001');
    expect(screen.getByRole('button', { name: 'Confirm replacement' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(incident.read()).toContain('INC-002');
  });

  it('does not let an old confirmation overwrite a newly saved current incident', async () => {
    const user = userEvent.setup();
    const incident = memoryStorage(savedIncident('INC-001'));
    render(
      <AppShell incidentStorage={incident.storage} progressStorage={memoryStorage().storage} />,
    );
    await user.click(screen.getByRole('button', { name: 'Start INC-002' }));
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    const replacement = savedIncident('INC-002', 9876);
    incident.replace(replacement);
    await user.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(incident.read()).toBe(replacement);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'changed while confirmation was open',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm replacement' }));
    expect(incident.read()).not.toBe(replacement);
    expect(JSON.parse(incident.read() ?? '{}')).toMatchObject({
      scenarioId: 'INC-002',
      seed: 1002,
    });
  });
});

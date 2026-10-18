import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { encodeSave, type SaveStorage } from '../persistence/index.ts';
import { getScenario } from '../scenario/index.ts';
import { createIncidentState } from '../engine/index.ts';
import { installContentDictionary } from '../i18n/content.ts';
import { AppShell } from './AppShell.tsx';
import { presentationStorageKey } from './presentation-settings.ts';
import { briefingStorageKey } from './briefing.ts';

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
  vi.restoreAllMocks();
  window.localStorage.removeItem(presentationStorageKey);
  window.localStorage.removeItem(briefingStorageKey);
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
      let unknownSeen = false;
      for (const name of actions) {
        await user.click(screen.getByRole('button', { name }));
        if (name.startsWith('Ask ')) {
          expect(screen.getByRole('heading', { name: 'War Room' })).toBeInTheDocument();
          expect(screen.getByRole('list', { name: 'Pending delegated work' })).toBeInTheDocument();
        }
        const hint = screen.queryByRole('dialog');
        if (hint) {
          expect(hint).toHaveTextContent('UNKNOWN');
          unknownSeen = true;
          await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));
        }
      }
      expect(unknownSeen).toBe(true);
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

describe('desk onboarding, global settings and destructive restarts', () => {
  it('shows a first-run briefing that is remembered once dismissed', async () => {
    const user = userEvent.setup();
    const view = render(
      <AppShell
        incidentStorage={memoryStorage().storage}
        progressStorage={memoryStorage().storage}
      />,
    );
    const briefing = screen.getByRole('region', { name: 'How a shift works' });
    expect(briefing).toHaveTextContent(/pager/i);
    expect(briefing).toHaveTextContent(/Nothing is graded/);
    expect(briefing).toHaveTextContent(/Training rotation/);
    expect(briefing).toHaveTextContent(/Full campaign/);
    await user.click(within(briefing).getByRole('button', { name: 'Got it — hide this briefing' }));
    expect(screen.queryByRole('region', { name: 'How a shift works' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(briefingStorageKey)).toBe('dismissed');
    view.unmount();
    render(
      <AppShell
        incidentStorage={memoryStorage().storage}
        progressStorage={memoryStorage().storage}
      />,
    );
    expect(screen.queryByRole('region', { name: 'How a shift works' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show shift briefing' }));
    expect(screen.getByRole('region', { name: 'How a shift works' })).toBeInTheDocument();
  });

  it('keeps the desk usable when local storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(
      <AppShell
        incidentStorage={memoryStorage().storage}
        progressStorage={memoryStorage().storage}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Got it — hide this briefing' }));
    expect(screen.queryByRole('region', { name: 'How a shift works' })).not.toBeInTheDocument();
  });

  it('offers one display setting on the desk that carries into every incident screen', async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        incidentStorage={memoryStorage().storage}
        progressStorage={memoryStorage().storage}
      />,
    );
    await user.click(screen.getByText('Display settings'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Text scale' }), 'large');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Colour theme' }),
      'high-contrast',
    );
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'large');
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'large');
    expect(document.documentElement).toHaveAttribute('data-theme', 'high-contrast');
    await user.click(screen.getByText('Display settings'));
    expect(screen.getByRole('combobox', { name: 'Text scale' })).toHaveValue('large');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Text scale' }), 'standard');
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'standard');
  });

  it('asks before discarding an unfinished response from the desk', async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        incidentStorage={memoryStorage().storage}
        progressStorage={memoryStorage().storage}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start INC-001' }));
    await user.click(screen.getByRole('button', { name: 'Open Payment API logs' }));
    const elapsed = screen.getByTestId('elapsed-time').textContent;
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    const restart = screen.getByRole('button', { name: 'Restart INC-001' });
    await user.click(restart);
    const dialog = screen.getByRole('alertdialog', { name: 'Restart Connection Saturation?' });
    expect(within(dialog).getByRole('button', { name: 'Keep my progress' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep my progress' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(restart).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Continue INC-001' }));
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent(elapsed ?? '');
    await user.click(screen.getByRole('button', { name: 'Incident desk' }));
    await user.click(screen.getByRole('button', { name: 'Restart INC-001' }));
    await user.click(screen.getByRole('button', { name: 'Restart from the pager' }));
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('00:00');
  });
});

describe('incident desk in Korean', () => {
  it('switches the desk, saved-slot errors and the overwrite prompt to Korean', async () => {
    installContentDictionary(
      'ko',
      new Map([
        ['Connection Saturation', '커넥션 포화'],
        ['Bad Deployment', '잘못된 배포'],
      ]),
    );
    const user = userEvent.setup();
    const incident = memoryStorage('{broken');
    render(
      <AppShell incidentStorage={incident.storage} progressStorage={memoryStorage().storage} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saved incident: The saved session is not valid JSON.',
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'ko');
    expect(screen.getByRole('region', { name: '근무는 이렇게 진행됩니다' })).toHaveTextContent(
      '채점하지 않습니다.',
    );
    expect(screen.getByRole('heading', { name: '로테이션 선택' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '커넥션 포화' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장된 인시던트: 저장된 세션이 올바른 JSON이 아닙니다.',
    );

    incident.replace(savedIncident('INC-001'));
    await user.click(screen.getByRole('button', { name: 'INC-002 시작' }));
    expect(screen.getByRole('heading', { name: '잘못된 배포' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '세션 저장' }));
    const dialog = screen.getByRole('alertdialog', { name: '로컬 저장을 교체할까요?' });
    expect(dialog).toHaveTextContent('저장 슬롯에 INC-001 기록이 들어 있습니다.');
    await user.click(within(dialog).getByRole('button', { name: '기존 저장 유지' }));
    await user.click(screen.getByRole('button', { name: '장애 대응 데스크' }));
    expect(screen.getByRole('button', { name: '저장된 INC-001 이어하기' })).toBeInTheDocument();
  });
});

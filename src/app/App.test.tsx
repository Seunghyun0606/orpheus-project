import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { SaveStorage } from '../persistence/index.ts';
import { getScenario, inc001Scenario, scenarioCatalog } from '../scenario/index.ts';
import { createIncidentSessionStore } from '../store/incident-session.ts';
import { installContentDictionary } from '../i18n/content.ts';
import { App } from './App.tsx';
import { formatElapsed } from './format.ts';
import { presentationStorageKey } from './presentation-settings.ts';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(presentationStorageKey);
});

function renderIncident(seed = 701, storage?: SaveStorage) {
  const store = createIncidentSessionStore(inc001Scenario, seed, storage);
  const user = userEvent.setup();

  const { unmount } = render(<App store={store} />);

  return { store, user, unmount };
}

async function perform(user: ReturnType<typeof userEvent.setup>, actionName: string) {
  await user.click(screen.getByRole('button', { name: actionName }));
}

describe('INC-001 operations desktop', () => {
  it('shows prior-incident discoveries from the separate campaign archive in the shared Evidence tab', async () => {
    let progress: string | null = null;
    const progressStorage: SaveStorage = {
      read: () => progress,
      write: (value) => {
        progress = value;
      },
    };
    const incidentStorage: SaveStorage = { read: () => null, write: () => {} };
    const first = createIncidentSessionStore(inc001Scenario, 701, incidentStorage, {
      storage: progressStorage,
      catalog: scenarioCatalog,
    });
    for (const actionId of [
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]) {
      expect(first.getState().performAction(actionId).ok).toBe(true);
    }
    const secondScenario = getScenario('INC-002');
    if (secondScenario === undefined) throw new Error('Missing INC-002');
    const second = createIncidentSessionStore(secondScenario, 702, incidentStorage, {
      storage: progressStorage,
      catalog: scenarioCatalog,
    });
    const user = userEvent.setup();
    render(<App store={second} />);
    await user.click(screen.getByRole('tab', { name: /Evidence/ }));
    expect(screen.getByRole('heading', { name: 'Corrupted log entry' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Recovered anomaly history' })).getByRole('list'),
    ).toHaveTextContent('UNKNOWN: Good.');
  });

  it('persists display controls independently of the incident and restores them after remount', async () => {
    const { user, unmount } = renderIncident();

    await user.click(screen.getByText('Display settings'));
    await user.click(screen.getByRole('checkbox', { name: 'CRT effects' }));
    await user.click(screen.getByRole('checkbox', { name: 'Reduce animation' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Text scale' }), 'extra-large');

    expect(document.documentElement).toHaveAttribute('data-crt-effects', 'off');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'extra-large');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Colour theme' }),
      'high-contrast',
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'high-contrast');
    expect(JSON.parse(window.localStorage.getItem(presentationStorageKey) ?? '{}')).toEqual({
      crtEffects: false,
      reducedAnimation: true,
      textScale: 'extra-large',
      colorTheme: 'high-contrast',
      language: 'en',
    });

    // Settings are global: leaving a screen must not reset the document.
    unmount();
    expect(document.documentElement).toHaveAttribute('data-text-scale', 'extra-large');
    expect(document.documentElement).toHaveAttribute('data-theme', 'high-contrast');
    renderIncident();
    await user.click(screen.getByText('Display settings'));
    expect(screen.getByRole('checkbox', { name: 'CRT effects' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Reduce animation' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Text scale' })).toHaveValue('extra-large');
    expect(screen.getByRole('combobox', { name: 'Colour theme' })).toHaveValue('high-contrast');
    expect(screen.getByRole('heading', { name: 'Connection Saturation' })).toBeInTheDocument();
  });

  it('supports arrow, Home, and End navigation among investigation tabs', async () => {
    const { user } = renderIncident();
    const metrics = screen.getByRole('tab', { name: /Metrics/ });
    metrics.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Diagnostics/ })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Investigation detail' })).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /War Room/ })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Evidence/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /Logs/ })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /War Room/ })).toHaveFocus();
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
  });

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

  it('keeps diagnosis open when delegation finishes without temporary mitigation', async () => {
    const scenario = getScenario('INC-002');
    if (scenario === undefined) throw new Error('Missing INC-002');
    const store = createIncidentSessionStore(scenario, 704, {
      read: () => null,
      write: () => {},
    });
    expect(store.getState().performAction('ASK_SAM_CHECK_KEYSET').ok).toBe(true);
    for (let index = 0; index < 4; index += 1) {
      expect(store.getState().performAction('OPEN_LOGS').ok).toBe(true);
    }
    expect(store.getState().incident.eventLog).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'event_fired' })]),
    );
    render(<App store={store} />);
    expect(screen.getAllByText('Diagnosis in progress')).toHaveLength(2);
    expect(screen.queryByText('Degradation active')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Temporary relief ended while the underlying cause remained open.'),
    ).not.toBeInTheDocument();
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
    expect(screen.getByText('No investigation detail captured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect database sessions' })).toBeEnabled();

    await perform(user, 'Inspect database sessions');

    const findings = screen.getByRole('table', { name: 'Newly revealed incident observations' });
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
    expect(screen.getByRole('status', { name: 'Session persistence' })).toHaveTextContent(
      'Session saved locally.',
    );
    await user.click(screen.getByRole('button', { name: 'Restart incident session' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Restart this incident?' });
    await user.click(within(confirm).getByRole('button', { name: 'Restart from the pager' }));
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

  it('stamps every log line with its own event time and streams anomaly and War Room entries', async () => {
    const scenario = getScenario('INC-002');
    if (scenario === undefined) throw new Error('Missing INC-002');
    const store = createIncidentSessionStore(scenario, 731, { read: () => null, write: () => {} });
    const user = userEvent.setup();
    render(<App store={store} />);

    // Sam's delegated result (due at 120s) lands during the deployment comparison
    // and completes the evidence set that surfaces the anomaly.
    await perform(user, 'Ask Sam to inspect the verifier key set');
    await perform(user, 'Open Identity API and verifier logs');
    await perform(user, 'Trace a failed payment authorization');
    await perform(user, 'Compare build 1847 with the stable deployment');
    const hint = screen.getByRole('dialog', { name: 'Unattributed deployment annotation' });
    await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));

    await user.click(screen.getByRole('tab', { name: /Logs/ }));
    const log = screen.getByRole('log', { name: 'Incident log entries' });
    const firstAction = store
      .getState()
      .incident.eventLog.find(
        (event) => event.type === 'action_completed' && event.sourceId === 'OPEN_LOGS',
      );
    if (firstAction === undefined) throw new Error('Missing first action event');
    const firstLine = within(log)
      .getByText(/Completed: Open Identity API and verifier logs/)
      .closest('p');
    expect(firstLine).toHaveTextContent(formatElapsed(firstAction.atSeconds));
    expect(store.getState().incident.elapsedSeconds).toBeGreaterThan(firstAction.atSeconds);
    expect(firstLine).not.toHaveTextContent(
      formatElapsed(store.getState().incident.elapsedSeconds),
    );
    expect(
      within(log).getByText(/Log anomaly flagged: Unattributed deployment annotation/),
    ).toBeInTheDocument();
    expect(within(log).getAllByText('TEAM').length).toBeGreaterThan(0);
  });

  it('moves focus to the observable results after an action and back to the trigger after a narrative', async () => {
    const { user } = renderIncident(733);
    await perform(user, 'Open Payment API logs');
    expect(screen.getByRole('region', { name: 'Observable results' })).toHaveFocus();
    cleanup();

    const scenario = getScenario('INC-002');
    if (scenario === undefined) throw new Error('Missing INC-002');
    const store = createIncidentSessionStore(scenario, 735, { read: () => null, write: () => {} });
    render(<App store={store} />);
    await perform(user, 'Ask Sam to inspect the verifier key set');
    await perform(user, 'Open Identity API and verifier logs');
    await perform(user, 'Trace a failed payment authorization');
    const trigger = screen.getByRole('button', {
      name: 'Compare build 1847 with the stable deployment',
    });
    await user.click(trigger);
    const hint = screen.getByRole('dialog', { name: 'Unattributed deployment annotation' });
    await user.click(within(hint).getByRole('button', { name: 'Continue incident' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    if (trigger.isConnected) expect(trigger).toHaveFocus();
    else expect(screen.getByRole('region', { name: 'Observable results' })).toHaveFocus();
  });

  it('asks before restarting, and declining keeps the response and returns focus', async () => {
    const { user } = renderIncident(737);
    await perform(user, 'Inspect PostgreSQL');
    const restart = screen.getByRole('button', { name: 'Restart incident session' });
    await user.click(restart);
    const dialog = screen.getByRole('alertdialog', { name: 'Restart this incident?' });
    expect(within(dialog).getByRole('button', { name: 'Keep current response' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(within(dialog).getByRole('button', { name: 'Restart from the pager' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(within(dialog).getByRole('button', { name: 'Keep current response' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(restart).toHaveFocus();
    expect(screen.getByTestId('elapsed-time')).toHaveTextContent('01:00');
  });

  it('announces existing synthetic audio cues for actions while staying muted by default', async () => {
    const { user } = renderIncident(739);
    expect(screen.getByText(/Sound settings \(muted\)/)).toBeInTheDocument();
    await perform(user, 'Open Payment API logs');
    expect(screen.getByText(/Action completed and committed\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable / resume audio' })).toBeInTheDocument();
  });
});

describe('INC-001 operations desktop in Korean', () => {
  it('shows UI copy, authored content and persistence messages in the display language', async () => {
    window.localStorage.setItem(presentationStorageKey, JSON.stringify({ language: 'ko' }));
    installContentDictionary(
      'ko',
      new Map([
        ['Connection Saturation', '커넥션 포화'],
        ['Payment API', '결제 API'],
        ['Inspect PostgreSQL', 'PostgreSQL 점검하기'],
        ['Customer Impact', '고객 피해'],
      ]),
    );
    const storage: SaveStorage = { read: () => null, write: () => undefined };
    const { user } = renderIncident(711, storage);

    expect(screen.getByRole('heading', { name: '커넥션 포화' })).toBeInTheDocument();
    expect(screen.getAllByText('진단 중')).toHaveLength(2);
    expect(within(screen.getByRole('list')).getByText('결제 API')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText(/경보 중/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /지표/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByText('완화').length).toBeGreaterThan(0);
    expect(screen.getAllByText('진단').length).toBeGreaterThan(0);

    // The tool heuristic keeps reading the authored English title.
    await perform(user, 'PostgreSQL 점검하기');
    expect(screen.getByRole('region', { name: '관찰 가능한 결과' })).toHaveFocus();
    expect(screen.getByText(/완료: PostgreSQL 점검하기/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '저장된 세션 불러오기' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('저장 없음');
    expect(alert).toHaveTextContent('저장된 세션이 없습니다.');

    await user.click(screen.getByRole('tab', { name: /상태/ }));
    expect(screen.getByText('고객 피해', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '인시던트 세션 다시 시작' }));
    expect(
      screen.getByRole('alertdialog', { name: '이 인시던트를 다시 시작할까요?' }),
    ).toBeInTheDocument();
  });

  it('localizes the save notice and the postmortem', async () => {
    window.localStorage.setItem(presentationStorageKey, JSON.stringify({ language: 'ko' }));
    installContentDictionary('ko', new Map([['Connection Saturation', '커넥션 포화']]));
    let saved: string | null = null;
    const { store, user } = renderIncident(721, {
      read: () => saved,
      write: (value) => {
        saved = value;
      },
    });
    await user.click(screen.getByRole('button', { name: '세션 저장' }));
    expect(screen.getByRole('status', { name: '세션 저장 상태' })).toHaveTextContent(
      '세션을 이 기기에 저장했습니다.',
    );
    expect(store.getState().persistenceNotice).toBe('Session saved locally.');

    await perform(user, 'Inspect PostgreSQL');
    await perform(user, 'Inspect database sessions');
    await perform(user, 'Terminate stale database sessions');
    expect(screen.getByRole('heading', { name: '인시던트 사후 분석' })).toHaveFocus();
    expect(screen.getByText(/커넥션 포화 · 인시던트 상태와 기록된 조치로/)).toBeInTheDocument();
    expect(screen.getByText('02 / 근본 원인')).toBeInTheDocument();
  });
});

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';
import { decodeSave, encodeSave } from '../persistence/save.ts';
import { getLegacyScenarioForMigration } from '../scenario/legacy-catalog.ts';
import {
  getScenario,
  validateScenarioObject,
  diagnosticCodes,
  type Scenario,
} from '../scenario/index.ts';
import { createIncidentSessionStore, selectWarRoom } from '../store/incident-session.ts';
import { App } from '../app/App.tsx';

afterEach(cleanup);

describe.each([
  ['INC-001', 'ASK_JIN_CONFIRM_IMPACT', 'JIN_IMPACT_RESULT', 'JIN_IMPACT_REPORT'],
  ['INC-002', 'ASK_SAM_CHECK_KEYSET', 'SAM_KEYSET_RESULT', 'SAM_KEYSET_REPORT'],
  ['INC-003', 'ASK_JIN_CONFIRM_IMPACT', 'JIN_IMPACT_RESULT', 'JIN_IMPACT_REPORT'],
] as const)('%s bundled War Room', (id, actionId, eventId, messageId) => {
  it('schedules authored work, persists it, and reports at the exact ETA', () => {
    const scenario = getScenario(id);
    if (scenario === undefined) throw new Error(`Missing ${id}`);
    let state = createIncidentState(scenario, { seed: 147 });
    expect(selectWarRoom({ scenario, incident: state }).messages).toHaveLength(2);
    state = perform(state, scenario, actionId);
    expect(state.resources.TEAM_CAPACITY?.value).toBe(2);
    expect(state.scheduledWork).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'timer_event', eventId, dueAtSeconds: 120 }),
      ]),
    );
    const restored = decodeSave(encodeSave(scenario, 147, state), scenario);
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.incident).toEqual(state);
    state = restored.value.incident;
    while (state.elapsedSeconds < 120) state = perform(state, scenario, 'OPEN_METRICS');
    expect(state.resources.TEAM_CAPACITY?.value).toBe(3);
    expect(state.eventLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'war_room_message', targetId: messageId, atSeconds: 120 }),
      ]),
    );
    expect(selectWarRoom({ scenario, incident: state }).pending).toHaveLength(0);
    const replay = replayCommands(
      scenario,
      { seed: 147 },
      state.replayLog.map(({ command }) => command),
    );
    expect(replay.ok).toBe(true);
    expect(replay.state).toEqual(state);
  });
});

it('makes bundled INC-001 team communication playable from the shared desktop', async () => {
  const scenario = getScenario('INC-001');
  if (scenario === undefined) throw new Error('Missing INC-001');
  const store = createIncidentSessionStore(scenario, 148, {
    read: () => null,
    write: () => undefined,
  });
  const user = userEvent.setup();
  render(<App store={store} />);
  await user.click(screen.getByRole('button', { name: 'Ask Jin to confirm customer impact' }));
  expect(screen.getByRole('tab', { name: /War Room/ })).toHaveFocus();
  expect(screen.getByRole('list', { name: 'Pending delegated work' })).toHaveTextContent(
    'ETA +01:40',
  );
  expect(screen.getByRole('list', { name: 'War Room messages' })).toHaveTextContent(
    'I will verify customer reports',
  );
});

function warRoomFixture(id: 'INC-002' | 'INC-003'): Scenario {
  const bundled = getLegacyScenarioForMigration(id, '1.0.0', '1.1.0');
  if (bundled === undefined) throw new Error(`Missing ${id}`);
  const candidate = structuredClone(bundled);
  candidate.contentVersion = '1.0.1-test';
  candidate.warRoom = {
    roles: [
      { id: 'MAYA', name: 'Maya / SRE Lead' },
      { id: 'SAM', name: 'Sam / Platform' },
    ],
    messages: [
      {
        id: 'MAYA_OPEN',
        roleId: 'MAYA',
        text: 'The service is degraded. Cause is not confirmed.',
        initial: true,
      },
      {
        id: 'SAM_OPEN',
        roleId: 'SAM',
        text: 'My dashboard looks normal, but it may be delayed.',
        initial: true,
      },
      {
        id: 'SAM_ACK',
        roleId: 'SAM',
        text: 'I will inspect the underlying service. ETA two minutes.',
        initial: false,
      },
      {
        id: 'SAM_RESULT',
        roleId: 'SAM',
        text: 'The service has a specific failure signal.',
        initial: false,
      },
      { id: 'MAYA_UPDATE', roleId: 'MAYA', text: 'We are still investigating.', initial: false },
    ],
  };
  candidate.actions.push({
    id: 'ASK_SAM',
    title: 'Ask Sam to investigate',
    category: 'DELEGATE',
    durationSeconds: 20,
    initiallyAvailable: true,
    requirements: [{ type: 'resource', resourceId: 'TEAM_CAPACITY', operator: 'gte', value: 1 }],
    costs: [{ resourceId: 'TEAM_CAPACITY', amount: -1 }],
    effects: [
      { type: 'post_message', messageId: 'SAM_ACK' },
      { type: 'schedule_event', eventId: 'SAM_RESULT_TIMER' },
    ],
    temporaryEffects: [],
    delegation: { roleId: 'SAM', eventId: 'SAM_RESULT_TIMER', capacityResourceId: 'TEAM_CAPACITY' },
  });
  candidate.actions.push({
    id: 'UPDATE_WAR_ROOM',
    title: 'Update the War Room',
    category: 'COMMUNICATE',
    durationSeconds: 15,
    initiallyAvailable: true,
    requirements: [],
    costs: [],
    effects: [{ type: 'post_message', messageId: 'MAYA_UPDATE' }],
    temporaryEffects: [],
  });
  candidate.events.push({
    id: 'SAM_RESULT_TIMER',
    type: 'timer',
    delaySeconds: 120,
    cancellationConditions: [],
    effects: [
      { type: 'change_resource', resourceId: 'TEAM_CAPACITY', amount: 1 },
      { type: 'post_message', messageId: 'SAM_RESULT' },
    ],
  });
  const validated = validateScenarioObject(candidate, `${id}-war-room`);
  if (!validated.success) throw new Error(JSON.stringify(validated.diagnostics));
  return validated.scenario;
}

function perform(
  state: ReturnType<typeof createIncidentState>,
  scenario: Scenario,
  actionId: string,
) {
  const result = executeCommand(state, scenario, { type: 'perform_action', actionId });
  if (!result.ok) throw new Error(`${actionId}: ${result.message}`);
  return result.state;
}

describe.each(['INC-002', 'INC-003'] as const)('%s War Room fixture', (id) => {
  it('validates authored roles, ETA, capacity and delayed messages, then replays and restores them', () => {
    const scenario = warRoomFixture(id);
    const initial = createIncidentState(scenario, { seed: 149 });
    expect(selectWarRoom({ scenario, incident: initial }).messages).toHaveLength(2);

    const pending = perform(initial, scenario, 'ASK_SAM');
    expect(pending.elapsedSeconds).toBe(20);
    expect(pending.resources.TEAM_CAPACITY?.value).toBe(2);
    expect(pending.scheduledWork).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'timer_event',
          eventId: 'SAM_RESULT_TIMER',
          dueAtSeconds: 120,
        }),
      ]),
    );
    const pendingView = selectWarRoom({ scenario, incident: pending });
    expect(pendingView.pending[0]?.dueAtSeconds).toBe(120);
    expect(pendingView.messages.map((message) => message.text)).toContain(
      'I will inspect the underlying service. ETA two minutes.',
    );

    const restored = decodeSave(encodeSave(scenario, 149, pending), scenario);
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.incident).toEqual(pending);
    expect(selectWarRoom({ scenario, incident: restored.value.incident })).toEqual(pendingView);

    let state = pending;
    for (const actionId of ['OPEN_LOGS', 'OPEN_METRICS', 'OPEN_LOGS', 'OPEN_METRICS']) {
      state = perform(state, scenario, actionId);
    }
    expect(state.elapsedSeconds).toBe(120);
    expect(state.resources.TEAM_CAPACITY?.value).toBe(3);
    expect(selectWarRoom({ scenario, incident: state }).pending).toHaveLength(0);
    expect(state.eventLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'war_room_message',
          targetId: 'SAM_RESULT',
          atSeconds: 120,
        }),
      ]),
    );
    const replay = replayCommands(
      scenario,
      { seed: 149 },
      state.replayLog.map(({ command }) => command),
    );
    expect(replay.ok).toBe(true);
    expect(replay.state).toEqual(state);
  });

  it('does not overbook team capacity while delegated work remains pending', () => {
    const scenario = warRoomFixture(id);
    let state = createIncidentState(scenario, { seed: 153 });
    for (let index = 0; index < 3; index += 1) state = perform(state, scenario, 'ASK_SAM');
    expect(state.resources.TEAM_CAPACITY?.value).toBe(0);
    expect(selectWarRoom({ scenario, incident: state }).pending).toHaveLength(3);
    const rejected = executeCommand(state, scenario, {
      type: 'perform_action',
      actionId: 'ASK_SAM',
    });
    expect(rejected).toMatchObject({ ok: false, code: 'ACTION_REQUIREMENTS_UNMET' });
    expect(rejected.state).toBe(state);
  });

  it('shows unresolved, conflicting reports and keyboard-accessible pending work in the shared desktop', async () => {
    const scenario = warRoomFixture(id);
    const store = createIncidentSessionStore(scenario, 151, {
      read: () => null,
      write: () => undefined,
    });
    const user = userEvent.setup();
    render(<App store={store} />);

    const metrics = screen.getByRole('tab', { name: /Metrics/ });
    metrics.focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /War Room/ })).toHaveFocus();
    const messageList = screen.getByRole('list', { name: 'War Room messages' });
    expect(within(messageList).getByText(/Cause is not confirmed/)).toBeInTheDocument();
    expect(within(messageList).getByText(/dashboard looks normal/)).toBeInTheDocument();
    expect(screen.queryByText(/correct|incorrect/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ask Sam to investigate' }));
    expect(screen.getByRole('tab', { name: /War Room/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /War Room/ })).toHaveFocus();
    expect(screen.getByRole('list', { name: 'Pending delegated work' })).toHaveTextContent(
      'ETA +01:40',
    );
    expect(screen.getByText('Team Capacity: 2 / 3')).toBeInTheDocument();
    expect(within(messageList).getByText(/ETA two minutes/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'War Room updates' })).toHaveTextContent(
      '1 delegated jobs pending',
    );
    await user.click(screen.getByRole('button', { name: 'Update the War Room' }));
    expect(within(messageList).getByText('We are still investigating.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ask Sam to investigate' }));
    await user.click(screen.getByRole('button', { name: 'Ask Sam to investigate' }));
    expect(
      screen.queryByRole('button', { name: 'Ask Sam to investigate' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /War Room/ })).toHaveFocus();
  });
});

it('rejects malformed delegation and unknown War Room references before play', () => {
  const scenario = warRoomFixture('INC-002');
  const action = scenario.actions.find(({ id }) => id === 'ASK_SAM');
  if (action === undefined || action.delegation === undefined)
    throw new Error('Missing fixture action');
  action.requirements = [];
  action.delegation.roleId = 'UNKNOWN';
  action.effects.push({ type: 'post_message', messageId: 'UNKNOWN' });
  const result = validateScenarioObject(scenario, 'bad-war-room.yaml');
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected validation failure');
  expect(result.diagnostics.map(({ code }) => code)).toContain(diagnosticCodes.invalidDelegation);
  expect(result.diagnostics.map(({ code }) => code)).toContain(diagnosticCodes.unknownReference);
});

it('rejects delegation capacity changes that cannot occupy exactly one slot', () => {
  const scenario = warRoomFixture('INC-003');
  const action = scenario.actions.find(({ id }) => id === 'ASK_SAM');
  if (action === undefined) throw new Error('Missing fixture action');
  action.costs.push({ resourceId: 'TEAM_CAPACITY', amount: -1 });
  const result = validateScenarioObject(scenario, 'double-capacity-cost.yaml');
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected validation failure');
  expect(result.diagnostics.map(({ code }) => code)).toContain(diagnosticCodes.invalidDelegation);
});

it('rejects capacity refunds hidden in temporary effects and invalid resource bounds', () => {
  const scenario = warRoomFixture('INC-003');
  const action = scenario.actions.find(({ id }) => id === 'ASK_SAM');
  const capacity = scenario.initialState.resources.find(({ id }) => id === 'TEAM_CAPACITY');
  if (action === undefined || capacity === undefined) throw new Error('Missing fixture data');
  action.temporaryEffects.push({
    id: 'HIDDEN_REFUND',
    durationSeconds: 30,
    apply: [{ type: 'change_resource', resourceId: 'TEAM_CAPACITY', amount: 1 }],
    expire: [],
  });
  capacity.max = 0;
  const result = validateScenarioObject(scenario, 'hidden-refund.yaml');
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected validation failure');
  expect(result.diagnostics.map(({ code }) => code)).toContain(diagnosticCodes.invalidDelegation);
});

it('documents why adding initially available War Room actions to shipped content needs a save decision', () => {
  const original = getLegacyScenarioForMigration('INC-002', '1.0.0', '1.1.0');
  if (original === undefined) throw new Error('Missing bundled incident');
  const oldSave = encodeSave(original, 155, createIncidentState(original, { seed: 155 }));
  const expanded = warRoomFixture('INC-002');
  expanded.contentVersion = original.contentVersion;
  expect(decodeSave(oldSave, expanded)).toMatchObject({ ok: false, code: 'REPLAY_MISMATCH' });
});

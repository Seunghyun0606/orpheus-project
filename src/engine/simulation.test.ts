import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseScenarioYaml, type Scenario } from '../scenario/index.ts';
import {
  createIncidentState,
  createSeededRngState,
  drawRandom,
  executeCommand,
  getAvailableActionIds,
  replayCommands,
  type EngineCommand,
} from './index.ts';

function loadScenario(): Scenario {
  const file = path.resolve('src/scenario/__fixtures__/valid-inc-001-shape.yaml');
  const result = parseScenarioYaml(readFileSync(file, 'utf8'), file);
  if (!result.success) throw new Error('Expected the engine fixture to be valid.');
  return result.scenario;
}

function perform(actionId: string): EngineCommand {
  return { type: 'perform_action', actionId };
}

function executeSuccessfully(
  state: ReturnType<typeof createIncidentState>,
  scenario: Scenario,
  actionId: string,
) {
  const result = executeCommand(state, scenario, perform(actionId));
  if (!result.ok) throw new Error(`Expected ${actionId} to execute: ${result.code}`);
  return result;
}

describe('headless incident simulation', () => {
  it('applies action costs and effects, advances time, and propagates unlocks and narrative evidence', () => {
    const scenario = loadScenario();
    const initial = createIncidentState(scenario, { seed: 7 });

    expect(getAvailableActionIds(initial, scenario)).not.toContain('TERMINATE_STALE_SESSIONS');

    const result = executeSuccessfully(initial, scenario, 'INSPECT_SESSIONS');

    expect(result.state.elapsedSeconds).toBe(90);
    expect(result.state.resources.TEAM_CAPACITY?.value).toBe(2);
    expect(result.state.signals.STALE_SESSIONS?.revealed).toBe(true);
    expect(getAvailableActionIds(result.state, scenario)).toContain('TERMINATE_STALE_SESSIONS');
    expect(result.state.completedActionIds).toContain('INSPECT_SESSIONS');
    expect(result.state.triggeredNarrativeIds).toContain('UNKNOWN_GOOD');
    expect(result.state.revealedEvidenceIds).toContain('CORRUPTED_LOG_ENTRY');
  });

  it('rejects an unmet action atomically without changing the original state', () => {
    const scenario = structuredClone(loadScenario());
    const action = scenario.actions.find(({ id }) => id === 'TERMINATE_STALE_SESSIONS');
    if (action === undefined) throw new Error('Missing fixture action.');
    action.initiallyAvailable = true;
    const initial = createIncidentState(scenario, { seed: 11 });
    const snapshot = structuredClone(initial);

    const result = executeCommand(initial, scenario, perform(action.id));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected action rejection.');
    expect(result.code).toBe('ACTION_REQUIREMENTS_UNMET');
    expect(result.state).toBe(initial);
    expect(result.events).toEqual([]);
    expect(initial).toEqual(snapshot);
  });

  it('expires temporary effects before timer events at the same timestamp', () => {
    const scenario = loadScenario();
    let state = createIncidentState(scenario, { seed: 17 });
    state = executeSuccessfully(state, scenario, 'RESTART_API').state;
    state = executeSuccessfully(state, scenario, 'INSPECT_SESSIONS').state;
    const result = executeSuccessfully(state, scenario, 'OPEN_METRICS');

    const simultaneous = result.events.filter(({ atSeconds }) => atSeconds === 180);
    const expiryIndex = simultaneous.findIndex(({ type }) => type === 'temporary_effect_expired');
    const timerIndex = simultaneous.findIndex(
      ({ type, sourceId }) => type === 'event_fired' && sourceId === 'CONNECTION_REBOUND',
    );

    expect(expiryIndex).toBeGreaterThanOrEqual(0);
    expect(timerIndex).toBeGreaterThan(expiryIndex);
    expect(result.state.signals.DB_CONNECTIONS?.value).toBe(499);
    expect(result.state.scheduledWork).toEqual([]);
  });

  it('evaluates timer cancellation conditions when the event becomes due', () => {
    const scenario = loadScenario();
    let state = createIncidentState(scenario, { seed: 23 });
    state = executeSuccessfully(state, scenario, 'RESTART_API').state;
    state = executeSuccessfully(state, scenario, 'INSPECT_SESSIONS').state;
    const result = executeSuccessfully(state, scenario, 'TERMINATE_STALE_SESSIONS');

    expect(result.state.resolvedMechanismIds).toContain('STALE_SESSION_POOL');
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'event_cancelled',
        sourceId: 'CONNECTION_REBOUND',
        atSeconds: 180,
      }),
    );
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: 'event_fired', sourceId: 'CONNECTION_REBOUND' }),
    );
  });

  it('cancels scheduled events explicitly while preserving other work and resource mutations', () => {
    const scenario = structuredClone(loadScenario());
    const openMetrics = scenario.actions.find(({ id }) => id === 'OPEN_METRICS');
    if (openMetrics === undefined) throw new Error('Missing fixture action.');
    openMetrics.effects = [
      { type: 'change_resource', resourceId: 'CUSTOMER_IMPACT', amount: 5 },
      { type: 'cancel_event', eventId: 'CONNECTION_REBOUND' },
    ];

    let state = createIncidentState(scenario, { seed: 27 });
    state = executeSuccessfully(state, scenario, 'RESTART_API').state;
    const result = executeSuccessfully(state, scenario, 'OPEN_METRICS');

    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(5);
    expect(result.state.scheduledWork).toEqual([
      expect.objectContaining({
        kind: 'temporary_expiration',
        temporaryEffectId: 'RESTART_RELIEF',
      }),
    ]);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'event_cancelled',
        sourceId: 'OPEN_METRICS',
        targetId: 'CONNECTION_REBOUND',
      }),
    );
  });

  it('propagates declarative conditional events and narratives to a fixed point', () => {
    const scenario = structuredClone(loadScenario());
    const openMetrics = scenario.actions.find(({ id }) => id === 'OPEN_METRICS');
    if (openMetrics === undefined) throw new Error('Missing fixture action.');
    openMetrics.effects = [{ type: 'reveal_signal', signalId: 'STALE_SESSIONS' }];
    scenario.events.push({
      id: 'UNLOCK_FROM_SIGNAL',
      type: 'conditional',
      conditions: [{ type: 'signal_revealed', signalId: 'STALE_SESSIONS' }],
      once: true,
      effects: [
        { type: 'unlock_action', actionId: 'TERMINATE_STALE_SESSIONS' },
        { type: 'reveal_evidence', evidenceId: 'CORRUPTED_LOG_ENTRY' },
      ],
    });
    scenario.narratives.push({
      id: 'CHAINED_NARRATIVE',
      title: 'Chained narrative',
      body: 'The evidence condition propagated.',
      conditions: [{ type: 'evidence', evidenceId: 'CORRUPTED_LOG_ENTRY' }],
      effects: [{ type: 'set_flag', flagId: 'ROOT_CAUSE_RESOLVED', value: true }],
    });

    const initial = createIncidentState(scenario, { seed: 29 });
    const result = executeSuccessfully(initial, scenario, 'OPEN_METRICS');

    expect(result.state.unlockedActionIds).toContain('TERMINATE_STALE_SESSIONS');
    expect(result.state.revealedEvidenceIds).toContain('CORRUPTED_LOG_ENTRY');
    expect(result.state.triggeredNarrativeIds).toContain('CHAINED_NARRATIVE');
    expect(result.state.completionReached).toBe(true);
  });

  it('replays the same seed and ordered inputs into deeply equal state and events', () => {
    const scenario = loadScenario();
    const commands = [
      perform('RESTART_API'),
      perform('INSPECT_SESSIONS'),
      perform('OPEN_METRICS'),
      perform('TERMINATE_STALE_SESSIONS'),
    ];

    const first = replayCommands(scenario, { seed: 101 }, commands);
    const second = replayCommands(scenario, { seed: 101 }, commands);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second).toEqual(first);
    if (!first.ok) throw new Error('Expected successful replay.');
    expect(first.state.replayLog.map(({ command }) => command)).toEqual(commands);
    expect(first.state.replayLog.map(({ sequence }) => sequence)).toEqual([0, 1, 2, 3]);
  });

  it('provides a serializable seeded RNG boundary with reproducible draws', () => {
    const first = drawRandom(createSeededRngState(31337));
    const firstNext = drawRandom(first.state);
    const second = drawRandom(createSeededRngState(31337));
    const secondNext = drawRandom(second.state);

    expect([first.value, firstNext.value]).toEqual([second.value, secondNext.value]);
    expect(firstNext.state.draws).toBe(2);
    expect(firstNext.value).toBeGreaterThanOrEqual(0);
    expect(firstNext.value).toBeLessThan(1);
  });
});

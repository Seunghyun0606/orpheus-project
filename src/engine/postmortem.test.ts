import { describe, expect, it } from 'vitest';

import { inc001Scenario } from '../scenario/index.ts';
import { createIncidentState, executeCommand, replayCommands } from './simulation.ts';
import { computePostmortem } from './postmortem.ts';

function complete(actions: readonly string[]) {
  let state = createIncidentState(inc001Scenario, { seed: 901 });
  for (const actionId of actions) {
    const result = executeCommand(state, inc001Scenario, { type: 'perform_action', actionId });
    if (!result.ok) throw new Error(`Expected ${actionId} to complete`);
    state = result.state;
  }
  return state;
}

describe('action-derived INC-001 postmortem', () => {
  it('resolves every configured input and explains the investigation-first route', () => {
    const state = complete(['INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS']);
    const report = computePostmortem(inc001Scenario, state);
    const values = Object.fromEntries(report.metrics.map(({ id, value }) => [id, value]));

    expect(report.metrics.map(({ id }) => id)).toEqual(
      inc001Scenario.postmortem.scoringInputs.map(({ id }) => id),
    );
    expect(values).toEqual({
      RECOVERY_TIME: 270,
      FINAL_ERROR_RATE: 0.2,
      CUSTOMER_DAMAGE: 70,
      OPERATIONAL_EXPOSURE: 6,
      RESTART_COUNT: 0,
      SCALE_COUNT: 0,
      ROLLBACK_COUNT: 0,
      COMMUNICATION_COUNT: 0,
    });
    expect(report.mechanisms).toEqual([
      expect.objectContaining({ id: 'STALE_SESSION_POOL', resolved: true }),
    ]);
    expect(report.nonResolvingInterventions).toEqual([]);
    expect(report.temporaryEffects).toEqual([]);
    expect(report.actions.map(({ id }) => id)).toEqual(state.actionHistory);
  });

  it('distinguishes restart-first mitigation, recurrence, cost, and risk without grading it', () => {
    const state = complete([
      'RESTART_API',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]);
    const report = computePostmortem(inc001Scenario, state);
    const values = Object.fromEntries(report.metrics.map(({ id, value }) => [id, value]));

    expect(values).toMatchObject({
      RECOVERY_TIME: 330,
      CUSTOMER_DAMAGE: 78,
      OPERATIONAL_EXPOSURE: 14,
      RESTART_COUNT: 1,
    });
    expect(report.nonResolvingInterventions).toEqual([
      expect.objectContaining({
        id: 'RESTART_API',
        count: 1,
        signalChanges: expect.arrayContaining([
          expect.objectContaining({ signalId: 'API_ERROR_RATE', value: 3 }),
        ]),
        resourceChanges: expect.arrayContaining([
          expect.objectContaining({ resourceId: 'CUSTOMER_IMPACT', value: 8 }),
          expect.objectContaining({ resourceId: 'OPERATIONAL_RISK', value: 8 }),
        ]),
      }),
    ]);
    expect(report.temporaryEffects).toEqual([
      expect.objectContaining({
        actionId: 'RESTART_API',
        effectId: 'RESTART_RECOVERY_WINDOW',
        expiredAtSeconds: 180,
      }),
    ]);
    expect(report.firedEventIds).toContain('CONNECTION_SATURATION_RECURS');

    const replay = replayCommands(
      inc001Scenario,
      { seed: 901 },
      state.replayLog.map(({ command }) => command),
    );
    if (!replay.ok) throw new Error('Expected deterministic replay to succeed');
    expect(computePostmortem(inc001Scenario, replay.state)).toEqual(report);
  });

  it('reports communication from the recorded actions', () => {
    const state = complete([
      'OPEN_LOGS',
      'COMMUNICATE_STATUS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]);
    const report = computePostmortem(inc001Scenario, state);

    expect(report.communicationActions).toEqual([
      expect.objectContaining({
        id: 'COMMUNICATE_STATUS',
        title: 'Send a customer-impact status update',
      }),
    ]);
    expect(report.metrics.find(({ id }) => id === 'COMMUNICATION_COUNT')?.value).toBe(1);
  });

  it('refuses an incomplete or mismatched incident', () => {
    const state = createIncidentState(inc001Scenario, { seed: 901 });
    expect(() => computePostmortem(inc001Scenario, state)).toThrow('completed incident');
    expect(() =>
      computePostmortem(inc001Scenario, { ...state, scenarioId: 'OTHER', completionReached: true }),
    ).toThrow('do not match');
  });
});

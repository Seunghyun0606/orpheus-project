import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseScenarioYaml, type Scenario } from './index.ts';

const scenarioFile = path.resolve('src/scenario/data/incidents/inc-001.yaml');

function loadInc001(): { scenario: Scenario; source: string } {
  const source = readFileSync(scenarioFile, 'utf8');
  const result = parseScenarioYaml(source, scenarioFile);
  if (!result.success) {
    throw new Error(`Expected INC-001 to be valid: ${JSON.stringify(result.diagnostics)}`);
  }
  return { scenario: result.scenario, source };
}

function action(scenario: Scenario, id: string): Scenario['actions'][number] {
  const value = scenario.actions.find((candidate) => candidate.id === id);
  if (value === undefined) throw new Error(`Missing action ${id}.`);
  return value;
}

describe('INC-001 authored scenario', () => {
  it('defines the service path, pager context, and exact initial signals', () => {
    const { scenario } = loadInc001();

    expect(scenario.id).toBe('INC-001');
    expect(scenario.severity).toBe('SEV1');
    expect(scenario.services).toEqual([
      expect.objectContaining({ id: 'GATEWAY', dependsOn: ['PAYMENT_API'] }),
      expect.objectContaining({ id: 'PAYMENT_API', dependsOn: ['POSTGRESQL'] }),
      expect.objectContaining({ id: 'POSTGRESQL', dependsOn: [] }),
    ]);
    expect(
      Object.fromEntries(scenario.initialState.signals.map(({ id, value }) => [id, value])),
    ).toMatchObject({
      API_ERROR_RATE: 31,
      DB_CONNECTIONS: 498,
      DB_CONNECTION_LIMIT: 500,
      DB_CPU: 41,
      API_CPU: 67,
      PAGER_SERVICE: 'Payment API',
      PAGER_THRESHOLD: 'Error Rate > 20%',
      STALE_SESSION_COUNT: 164,
      STALE_SESSION_STATE: 'idle in transaction',
      STALE_SESSION_AVERAGE_AGE: '47m',
    });
    expect(scenario.initialState.resources).toContainEqual(
      expect.objectContaining({ id: 'CUSTOMER_IMPACT', value: 0 }),
    );
  });

  it('authors the required initial actions and investigation unlock path', () => {
    const { scenario } = loadInc001();
    const initiallyAvailable = scenario.actions
      .filter(({ initiallyAvailable }) => initiallyAvailable)
      .map(({ id }) => id);

    expect(initiallyAvailable).toEqual([
      'OPEN_LOGS',
      'OPEN_METRICS',
      'RESTART_API',
      'SCALE_API',
      'ROLLBACK',
      'INSPECT_DB',
    ]);
    expect(action(scenario, 'INSPECT_DB').effects).toContainEqual({
      type: 'unlock_action',
      actionId: 'INSPECT_SESSIONS',
    });
    expect(action(scenario, 'INSPECT_SESSIONS').effects).toEqual(
      expect.arrayContaining([
        { type: 'reveal_signal', signalId: 'STALE_SESSION_COUNT' },
        { type: 'reveal_signal', signalId: 'STALE_SESSION_STATE' },
        { type: 'reveal_signal', signalId: 'STALE_SESSION_AVERAGE_AGE' },
        { type: 'unlock_action', actionId: 'TERMINATE_STALE_SESSIONS' },
      ]),
    );
  });

  it('encodes restart recovery, conditional recurrence, and root-cause resolution in data', () => {
    const { scenario } = loadInc001();
    const restart = action(scenario, 'RESTART_API');
    const recurrence = scenario.events.find(({ id }) => id === 'CONNECTION_SATURATION_RECURS');
    const terminate = action(scenario, 'TERMINATE_STALE_SESSIONS');

    expect(restart.temporaryEffects).toContainEqual(
      expect.objectContaining({
        durationSeconds: 180,
        apply: expect.arrayContaining([
          { type: 'set_signal', signalId: 'API_ERROR_RATE', value: 3 },
          { type: 'set_signal', signalId: 'DB_CONNECTIONS', value: 310 },
        ]),
      }),
    );
    expect(recurrence).toMatchObject({
      type: 'timer',
      delaySeconds: 180,
      cancellationConditions: [{ type: 'mechanism_resolved', mechanismId: 'STALE_SESSION_POOL' }],
      effects: [
        { type: 'set_signal', signalId: 'DB_CONNECTIONS', value: 499 },
        { type: 'set_signal', signalId: 'API_ERROR_RATE', value: 28 },
      ],
    });
    expect(terminate.effects).toEqual(
      expect.arrayContaining([
        { type: 'resolve_mechanism', mechanismId: 'STALE_SESSION_POOL' },
        { type: 'set_signal', signalId: 'DB_CONNECTIONS', value: 112 },
        { type: 'set_signal', signalId: 'API_ERROR_RATE', value: 0.2 },
      ]),
    );
    for (const id of ['SCALE_API', 'ROLLBACK']) {
      expect(action(scenario, id).effects).not.toContainEqual(
        expect.objectContaining({ type: 'resolve_mechanism' }),
      );
    }
  });

  it('keeps the UNKNOWN hook conditional, preserves evidence, and omits later reveals', () => {
    const { scenario, source } = loadInc001();
    const narrative = scenario.narratives.find(({ id }) => id === 'UNKNOWN_GOOD');

    expect(narrative).toMatchObject({
      body: '02:23:11 / UNKNOWN: Good.',
      conditions: expect.arrayContaining([
        { type: 'action_completed', actionId: 'OPEN_LOGS' },
        { type: 'action_completed', actionId: 'INSPECT_SESSIONS' },
        { type: 'mechanism_resolved', mechanismId: 'STALE_SESSION_POOL' },
      ]),
      effects: [{ type: 'reveal_evidence', evidenceId: 'CORRUPTED_LOG_ENTRY' }],
    });
    expect(scenario.evidence).toContainEqual(
      expect.objectContaining({
        id: 'CORRUPTED_LOG_ENTRY',
        sourceNarrativeId: 'UNKNOWN_GOOD',
      }),
    );
    expect(source).not.toMatch(/\b(?:NULL|ORPHEUS)\b/i);
  });

  it('defines completion and explainable postmortem inputs', () => {
    const { scenario } = loadInc001();

    expect(scenario.completion.conditions).toEqual(
      expect.arrayContaining([
        { type: 'flag', flagId: 'ROOT_CAUSE_RESOLVED', value: true },
        { type: 'signal', signalId: 'API_ERROR_RATE', operator: 'lte', value: 0.2 },
      ]),
    );
    expect(scenario.postmortem.scoringInputs.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'RECOVERY_TIME',
        'FINAL_ERROR_RATE',
        'CUSTOMER_DAMAGE',
        'OPERATIONAL_EXPOSURE',
        'RESTART_COUNT',
        'SCALE_COUNT',
        'ROLLBACK_COUNT',
        'COMMUNICATION_COUNT',
      ]),
    );
  });
});

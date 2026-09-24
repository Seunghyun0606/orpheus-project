import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { replayCommands, type EngineEvent, type ReplaySuccess } from '../engine/index.ts';
import { parseScenarioYaml, type Scenario } from '../scenario/index.ts';
import {
  rootCauseResolutionReplay,
  temporaryMitigationReplay,
  type ReplayFixture,
} from './fixtures/inc-001-replays.ts';

const scenarioFile = path.resolve('src/scenario/data/incidents/inc-001.yaml');

function loadInc001(): Scenario {
  const result = parseScenarioYaml(readFileSync(scenarioFile, 'utf8'), scenarioFile);
  if (!result.success) {
    throw new Error(`Expected INC-001 to be valid: ${JSON.stringify(result.diagnostics)}`);
  }
  return result.scenario;
}

function replayDeterministically(scenario: Scenario, fixture: ReplayFixture): ReplaySuccess {
  const first = replayCommands(scenario, { seed: fixture.seed }, fixture.commands);
  const second = replayCommands(scenario, { seed: fixture.seed }, fixture.commands);

  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (!first.ok || !second.ok) {
    throw new Error(`Expected replay fixture ${fixture.id} to complete successfully.`);
  }

  expect(second.state).toEqual(first.state);
  expect(second.events).toEqual(first.events);
  expect(first.state.replayLog.map(({ command }) => command)).toEqual(fixture.commands);
  return first;
}

function expectSignalChange(
  events: readonly EngineEvent[],
  atSeconds: number,
  signalId: string,
  value: number,
): void {
  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'signal_changed',
      atSeconds,
      targetId: signalId,
      value,
    }),
  );
}

describe('INC-001 headless replay fixtures', () => {
  it('proves temporary mitigation improves immediately and recurs after 180 seconds', () => {
    const result = replayDeterministically(loadInc001(), temporaryMitigationReplay);

    expectSignalChange(result.events, 0, 'API_ERROR_RATE', 3);
    expectSignalChange(result.events, 0, 'DB_CONNECTIONS', 310);
    expectSignalChange(result.events, 180, 'API_ERROR_RATE', 28);
    expectSignalChange(result.events, 180, 'DB_CONNECTIONS', 499);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'event_fired',
        atSeconds: 180,
        sourceId: 'CONNECTION_SATURATION_RECURS',
      }),
    );
    expect(result.state.elapsedSeconds).toBe(180);
    expect(result.state.signals.API_ERROR_RATE?.value).toBe(28);
    expect(result.state.signals.DB_CONNECTIONS?.value).toBe(499);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(56);
    expect(result.state.resolutionReached).toBe(false);
    expect(result.state.completionReached).toBe(false);
    expect(result.state.scheduledWork).toEqual([]);
  });

  it('proves investigation, root-cause resolution, UNKNOWN evidence, and durable recovery', () => {
    const result = replayDeterministically(loadInc001(), rootCauseResolutionReplay);

    expect(result.state.signals.STALE_SESSION_COUNT).toEqual({ value: 164, revealed: true });
    expect(result.state.signals.STALE_SESSION_STATE).toEqual({
      value: 'idle in transaction',
      revealed: true,
    });
    expect(result.state.signals.STALE_SESSION_AVERAGE_AGE).toEqual({
      value: '47m',
      revealed: true,
    });
    expectSignalChange(result.events, 180, 'DB_CONNECTIONS', 112);
    expectSignalChange(result.events, 180, 'API_ERROR_RATE', 0.2);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'narrative_triggered',
        atSeconds: 180,
        sourceId: 'UNKNOWN_GOOD',
      }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'evidence_revealed',
        atSeconds: 180,
        sourceId: 'UNKNOWN_GOOD',
        targetId: 'CORRUPTED_LOG_ENTRY',
      }),
    );
    expect(result.state.elapsedSeconds).toBe(300);
    expect(result.state.signals.DB_CONNECTIONS?.value).toBe(112);
    expect(result.state.signals.API_ERROR_RATE?.value).toBe(0.2);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(82);
    expect(result.state.resolvedMechanismIds).toContain('STALE_SESSION_POOL');
    expect(result.state.triggeredNarrativeIds).toContain('UNKNOWN_GOOD');
    expect(result.state.revealedEvidenceIds).toContain('CORRUPTED_LOG_ENTRY');
    expect(result.state.resolutionReached).toBe(true);
    expect(result.state.completionReached).toBe(true);
    expect(result.state.scheduledWork).toEqual([]);
  });
});

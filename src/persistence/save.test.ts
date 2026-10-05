import { describe, expect, it } from 'vitest';

import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';
import { getLegacyScenarioForMigration } from '../scenario/legacy-catalog.ts';
import { getScenario, inc001Scenario } from '../scenario/index.ts';
import { decodeSave, encodeSave } from './save.ts';

function investigatedState() {
  let state = createIncidentState(inc001Scenario, { seed: 811 });
  for (const actionId of [
    'OPEN_LOGS',
    'INSPECT_DB',
    'INSPECT_SESSIONS',
    'TERMINATE_STALE_SESSIONS',
  ]) {
    const result = executeCommand(state, inc001Scenario, { type: 'perform_action', actionId });
    if (!result.ok) throw new Error(`Expected ${actionId} to complete`);
    state = result.state;
  }
  return state;
}

describe('versioned incident save', () => {
  it('restores authoritative state, replay entries, narrative and evidence exactly', () => {
    const state = investigatedState();
    const restored = decodeSave(encodeSave(inc001Scenario, 811, state), inc001Scenario);

    if (!restored.ok) throw new Error(`${restored.code}: ${restored.message}`);
    expect(restored.value.seed).toBe(811);
    expect(restored.value.incident).toEqual(state);
    expect(restored.value.incident.replayLog).toEqual(state.replayLog);
    expect(restored.value.incident.triggeredNarrativeIds).toContain('UNKNOWN_GOOD');
    expect(restored.value.incident.revealedEvidenceIds).toContain('CORRUPTED_LOG_ENTRY');
  });

  it('reports malformed, incompatible, and replay-inconsistent saves explicitly', () => {
    const original = JSON.parse(encodeSave(inc001Scenario, 811, investigatedState()));

    expect(decodeSave('{', inc001Scenario)).toMatchObject({
      ok: false,
      code: 'MALFORMED_SAVE',
    });
    expect(
      decodeSave(JSON.stringify({ ...original, schemaVersion: 2 }), inc001Scenario),
    ).toMatchObject({
      ok: false,
      code: 'INCOMPATIBLE_SCHEMA',
    });
    expect(
      decodeSave(JSON.stringify({ ...original, contentVersion: '2.0.0' }), inc001Scenario),
    ).toMatchObject({ ok: false, code: 'INCOMPATIBLE_CONTENT' });
    expect(
      decodeSave(JSON.stringify({ ...original, scenarioId: 'OTHER' }), inc001Scenario),
    ).toMatchObject({
      ok: false,
      code: 'SCENARIO_MISMATCH',
    });
    expect(decodeSave(JSON.stringify({ ...original, incident: {} }), inc001Scenario)).toMatchObject(
      {
        ok: false,
        code: 'MALFORMED_SAVE',
      },
    );
    const tampered = structuredClone(original);
    tampered.incident.resources.CUSTOMER_IMPACT.value += 1;
    expect(decodeSave(JSON.stringify(tampered), inc001Scenario)).toMatchObject({
      ok: false,
      code: 'REPLAY_MISMATCH',
    });
  });

  it('preserves scheduled recurrence when a temporary mitigation is saved mid-incident', () => {
    const initial = createIncidentState(inc001Scenario, { seed: 823 });
    const restart = executeCommand(initial, inc001Scenario, {
      type: 'perform_action',
      actionId: 'RESTART_API',
    });
    if (!restart.ok) throw new Error('Expected restart to complete');

    const restored = decodeSave(encodeSave(inc001Scenario, 823, restart.state), inc001Scenario);
    if (!restored.ok) throw new Error(`${restored.code}: ${restored.message}`);
    expect(restored.value.incident.scheduledWork).toEqual(restart.state.scheduledWork);

    const actions = ['INSPECT_DB', 'INSPECT_SESSIONS', 'OPEN_LOGS'];
    let original = restart.state;
    let loaded = restored.value.incident;
    for (const actionId of actions) {
      const first = executeCommand(original, inc001Scenario, { type: 'perform_action', actionId });
      const second = executeCommand(loaded, inc001Scenario, { type: 'perform_action', actionId });
      if (!first.ok || !second.ok) throw new Error(`Expected ${actionId} to complete`);
      original = first.state;
      loaded = second.state;
    }
    expect(loaded).toEqual(original);
    expect(loaded.signals.DB_CONNECTIONS?.value).toBe(499);
  });
});

describe('1.0.0 scenario save migration', () => {
  const completedPaths = [
    ['INC-001', ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS']],
    ['INC-002', ['OPEN_LOGS', 'TRACE_AUTH_REQUEST', 'COMPARE_DEPLOYMENT', 'ROLLBACK_BUILD_1847']],
    ['INC-003', ['OPEN_LOGS', 'TRACE_RETRY', 'COMPARE_BATCH', 'QUARANTINE_MESSAGE']],
  ] as const;

  it.each(completedPaths)(
    'verifies and migrates completed %s progress without losing evidence',
    (id, actions) => {
      const legacy = getLegacyScenarioForMigration(id, '1.0.0', '1.1.0');
      const current = getScenario(id);
      if (legacy === undefined || current === undefined) throw new Error(`Missing ${id} versions`);
      const oldReplay = replayCommands(
        legacy,
        { seed: 911 },
        actions.map((actionId) => ({ type: 'perform_action', actionId })),
      );
      if (!oldReplay.ok) throw new Error(`Legacy ${id} replay failed`);
      expect(oldReplay.state.completionReached).toBe(true);
      const saved = encodeSave(legacy, 911, oldReplay.state);
      const restored = decodeSave(saved, current);
      if (!restored.ok) throw new Error(`${restored.code}: ${restored.message}`);
      expect(restored.value.migratedFromContentVersion).toBe('1.0.0');
      expect(restored.value.incident.contentVersion).toBe(current.contentVersion);
      expect(restored.value.incident.completionReached).toBe(oldReplay.state.completionReached);
      expect(restored.value.incident.revealedEvidenceIds).toEqual(
        oldReplay.state.revealedEvidenceIds,
      );
      expect(restored.value.incident.signals).toEqual(oldReplay.state.signals);
      expect(restored.value.incident.resources).toEqual(oldReplay.state.resources);
      expect(restored.value.incident.scheduledWork).toEqual(oldReplay.state.scheduledWork);
      expect(restored.value.incident.eventLog).toEqual(oldReplay.state.eventLog);
      expect(restored.value.incident.replayLog).toEqual(oldReplay.state.replayLog);
      const savedAgain = decodeSave(encodeSave(current, 911, restored.value.incident), current);
      expect(savedAgain).toMatchObject({ ok: true });
      if (savedAgain.ok) expect(savedAgain.value.migratedFromContentVersion).toBeUndefined();
    },
  );

  it('keeps a pending 1.0.0 timer intact after migration and subsequent actions', () => {
    const legacy = getLegacyScenarioForMigration('INC-001', '1.0.0', '1.1.0');
    if (legacy === undefined) throw new Error('Missing legacy INC-001');
    const oldState = createIncidentState(legacy, { seed: 913 });
    const restart = executeCommand(oldState, legacy, {
      type: 'perform_action',
      actionId: 'RESTART_API',
    });
    if (!restart.ok) throw new Error('Legacy restart failed');
    const restored = decodeSave(encodeSave(legacy, 913, restart.state), inc001Scenario);
    if (!restored.ok) throw new Error(`${restored.code}: ${restored.message}`);
    expect(restored.value.incident.scheduledWork).toEqual(restart.state.scheduledWork);
    let migrated = restored.value.incident;
    for (const actionId of ['INSPECT_DB', 'INSPECT_SESSIONS', 'OPEN_LOGS']) {
      const step = executeCommand(migrated, inc001Scenario, { type: 'perform_action', actionId });
      if (!step.ok) throw new Error(`${actionId}: ${step.message}`);
      migrated = step.state;
    }
    expect(migrated.signals.DB_CONNECTIONS?.value).toBe(499);
    expect(
      migrated.eventLog.some(
        ({ type, sourceId }) =>
          type === 'event_fired' && sourceId === 'CONNECTION_SATURATION_RECURS',
      ),
    ).toBe(true);
  });

  it('rejects tampered legacy saves before replaying them against current content', () => {
    const legacy = getLegacyScenarioForMigration('INC-001', '1.0.0', '1.1.0');
    if (legacy === undefined) throw new Error('Missing legacy INC-001');
    const save = JSON.parse(encodeSave(legacy, 915, createIncidentState(legacy, { seed: 915 })));
    save.incident.resources.CUSTOMER_IMPACT.value = 99;
    expect(decodeSave(JSON.stringify(save), inc001Scenario)).toMatchObject({
      ok: false,
      code: 'REPLAY_MISMATCH',
    });
    expect(
      decodeSave(encodeSave(legacy, 915, createIncidentState(legacy, { seed: 915 })), {
        ...inc001Scenario,
        contentVersion: '2.0.0',
      }),
    ).toMatchObject({ ok: false, code: 'INCOMPATIBLE_CONTENT' });
  });
});

describe('1.1.0 narrative-content migration', () => {
  it.each([
    ['INC-002', ['OPEN_LOGS', 'TRACE_AUTH_REQUEST', 'COMPARE_DEPLOYMENT']],
    ['INC-003', ['OPEN_LOGS', 'TRACE_RETRY', 'COMPARE_BATCH']],
  ] as const)('verifies and migrates %s without losing prior artifacts', (id, actions) => {
    const current = getScenario(id);
    const legacy = getLegacyScenarioForMigration(id, '1.1.0', '1.2.0');
    if (current === undefined || legacy === undefined) throw new Error(`Missing ${id} versions`);
    const replay = replayCommands(
      legacy,
      { seed: 1515 },
      actions.map((actionId) => ({ type: 'perform_action' as const, actionId })),
    );
    if (!replay.ok) throw new Error(`Failed ${id} legacy replay`);
    const restored = decodeSave(encodeSave(legacy, 1515, replay.state), current);
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.migratedFromContentVersion).toBe('1.1.0');
    expect(restored.value.incident.contentVersion).toBe('1.2.0');
    expect(restored.value.incident.revealedEvidenceIds).toEqual(replay.state.revealedEvidenceIds);
  });
});

import { describe, expect, it } from 'vitest';

import { createIncidentState, executeCommand } from '../engine/index.ts';
import { inc001Scenario } from '../scenario/index.ts';
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

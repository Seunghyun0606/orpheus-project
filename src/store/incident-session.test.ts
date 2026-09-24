import { describe, expect, it } from 'vitest';

import { inc001Scenario } from '../scenario/index.ts';
import {
  createIncidentSessionStore,
  selectAvailableActions,
  selectRevealedSignals,
} from './incident-session.ts';

describe('INC-001 browser incident session', () => {
  it('loads the authored YAML and exposes only initially available actions', () => {
    const store = createIncidentSessionStore(inc001Scenario, 101);

    expect(store.getState().scenario).toMatchObject({
      id: 'INC-001',
      contentVersion: '1.0.0',
    });
    expect(selectAvailableActions(store.getState()).map(({ id }) => id)).toEqual([
      'OPEN_LOGS',
      'OPEN_METRICS',
      'RESTART_API',
      'SCALE_API',
      'ROLLBACK',
      'INSPECT_DB',
    ]);
    expect(selectRevealedSignals(store.getState()).map(({ id }) => id)).not.toContain(
      'STALE_SESSION_COUNT',
    );
  });

  it('routes actions through the engine and projects unlocked actions and revealed signals', () => {
    const store = createIncidentSessionStore(inc001Scenario, 103);

    expect(store.getState().performAction('INSPECT_DB').ok).toBe(true);
    expect(store.getState().incident.elapsedSeconds).toBe(60);
    expect(selectAvailableActions(store.getState()).map(({ id }) => id)).toContain(
      'INSPECT_SESSIONS',
    );

    expect(store.getState().performAction('INSPECT_SESSIONS').ok).toBe(true);
    expect(selectRevealedSignals(store.getState())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'STALE_SESSION_COUNT', value: 164 }),
        expect.objectContaining({ id: 'STALE_SESSION_STATE', value: 'idle in transaction' }),
        expect.objectContaining({ id: 'STALE_SESSION_AVERAGE_AGE', value: '47m' }),
      ]),
    );
    expect(selectAvailableActions(store.getState()).map(({ id }) => id)).toContain(
      'TERMINATE_STALE_SESSIONS',
    );
  });

  it('keeps rejected commands atomic and exposes an inspectable error', () => {
    const store = createIncidentSessionStore(inc001Scenario, 107);
    const before = structuredClone(store.getState().incident);

    const result = store.getState().performAction('TERMINATE_STALE_SESSIONS');

    expect(result.ok).toBe(false);
    expect(store.getState().incident).toEqual(before);
    expect(store.getState().lastError).toMatchObject({
      code: 'ACTION_LOCKED',
      message: expect.any(String),
    });
  });

  it('restarts to the same deterministic initial state with the same seed', () => {
    const store = createIncidentSessionStore(inc001Scenario, 109);
    const initial = structuredClone(store.getState().incident);

    store.getState().performAction('RESTART_API');
    expect(store.getState().incident).not.toEqual(initial);

    store.getState().restart();
    expect(store.getState().incident).toEqual(initial);
    expect(store.getState().lastError).toBeNull();
  });
});

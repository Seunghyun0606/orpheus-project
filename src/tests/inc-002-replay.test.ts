import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  computePostmortem,
  createIncidentState,
  executeCommand,
  replayCommands,
  type ReplaySuccess,
} from '../engine/index.ts';
import { validateScenarioCatalog, type Scenario } from '../scenario/index.ts';
import {
  keysetUpdateReplay,
  renewedRoutingReplay,
  rollbackReplay,
  temporaryRoutingReplay,
  type Inc002ReplayFixture,
} from './fixtures/inc-002-replays.ts';

function loadInc002(): Scenario {
  const files = ['inc-001.yaml', 'inc-002.yaml'].map((name) => {
    const file = path.resolve('src/scenario/data/incidents', name);
    return { file, source: readFileSync(file, 'utf8') };
  });
  const catalog = validateScenarioCatalog(files);
  if (!catalog.success) {
    throw new Error(
      `Expected incident catalog to be valid: ${JSON.stringify(catalog.diagnostics)}`,
    );
  }
  const scenario = catalog.scenarios.get('INC-002');
  if (scenario === undefined) throw new Error('INC-002 is absent from the validated catalog.');
  return scenario;
}

function replayDeterministically(scenario: Scenario, fixture: Inc002ReplayFixture): ReplaySuccess {
  const first = replayCommands(scenario, { seed: fixture.seed }, fixture.commands);
  const second = replayCommands(scenario, { seed: fixture.seed }, fixture.commands);
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (!first.ok || !second.ok) throw new Error(`Replay ${fixture.id} failed.`);
  expect(second.state).toEqual(first.state);
  expect(second.events).toEqual(first.events);
  expect(first.state.replayLog.map(({ command }) => command)).toEqual(fixture.commands);
  return first;
}

describe('INC-002 Bad Deployment headless replays', () => {
  it('requires a trace and deployment comparison before causal intervention', () => {
    const scenario = loadInc002();
    const initial = createIncidentState(scenario, { seed: 2000 });
    const earlyRollback = executeCommand(initial, scenario, {
      type: 'perform_action',
      actionId: 'ROLLBACK_BUILD_1847',
    });
    expect(earlyRollback.ok).toBe(false);
    if (!earlyRollback.ok) expect(earlyRollback.code).toBe('ACTION_LOCKED');
    expect(initial.signals.PAGER_SERVICE).toEqual({ value: 'Payment Gateway', revealed: true });
    expect(initial.signals.DEPLOYMENT_BUILD?.revealed).toBe(false);
    expect(initial.signals.ISSUER_KEY_ID?.revealed).toBe(false);
  });

  it('shows routing relief followed by delayed recurrence without resolution', () => {
    const result = replayDeterministically(loadInc002(), temporaryRoutingReplay);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'signal_changed',
        atSeconds: 0,
        targetId: 'AUTH_ERROR_RATE',
        value: 5,
      }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'event_fired',
        atSeconds: 180,
        sourceId: 'ROUTING_WINDOW_EXPIRES',
      }),
    );
    expect(result.state.elapsedSeconds).toBe(185);
    expect(result.state.signals.AUTH_ERROR_RATE?.value).toBe(32);
    expect(result.state.signals.RETRY_RATE?.value).toBe(190);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(84);
    expect(result.state.resolutionReached).toBe(false);
    expect(result.state.completionReached).toBe(false);
  });

  it('renews the routing timer without firing the previous window during relief', () => {
    const scenario = loadInc002();
    const beforeRenewedExpiry = replayCommands(
      scenario,
      { seed: 2004 },
      renewedRoutingReplay.commands.slice(0, 7),
    );
    expect(beforeRenewedExpiry.ok).toBe(true);
    if (!beforeRenewedExpiry.ok) throw new Error('Expected the renewed routing prefix to replay.');
    expect(beforeRenewedExpiry.state.elapsedSeconds).toBe(190);
    expect(beforeRenewedExpiry.state.signals.AUTH_ERROR_RATE?.value).toBe(5);
    expect(beforeRenewedExpiry.events).toContainEqual(
      expect.objectContaining({
        type: 'event_cancelled',
        atSeconds: 65,
        sourceId: 'ROUTE_STABLE_REGION',
        targetId: 'ROUTING_WINDOW_EXPIRES',
      }),
    );
    expect(
      beforeRenewedExpiry.events.some(
        ({ type, sourceId }) => type === 'event_fired' && sourceId === 'ROUTING_WINDOW_EXPIRES',
      ),
    ).toBe(false);

    const afterRenewedExpiry = replayDeterministically(scenario, renewedRoutingReplay);
    expect(afterRenewedExpiry.state.elapsedSeconds).toBe(250);
    expect(afterRenewedExpiry.state.signals.AUTH_ERROR_RATE?.value).toBe(32);
    expect(
      afterRenewedExpiry.events.filter(
        ({ type, sourceId }) => type === 'event_fired' && sourceId === 'ROUTING_WINDOW_EXPIRES',
      ),
    ).toEqual([expect.objectContaining({ atSeconds: 245 })]);
  });

  it('uses temporary routing and then rollback to contain the incompatible rollout', () => {
    const scenario = loadInc002();
    const investigated = replayCommands(
      scenario,
      { seed: rollbackReplay.seed },
      rollbackReplay.commands.slice(0, -1),
    );
    expect(investigated.ok).toBe(true);
    if (!investigated.ok) throw new Error('Expected the pre-rollback investigation to replay.');
    expect(investigated.state.signals.ISSUER_KEY_ID).toEqual({ value: 'K72', revealed: true });
    expect(investigated.state.signals.VERIFIER_KEY_ID).toEqual({ value: 'K71', revealed: true });
    expect(investigated.state.signals.DEPLOYMENT_BUILD).toEqual({ value: '1847', revealed: true });

    const result = replayDeterministically(scenario, rollbackReplay);
    expect(result.state.signals.LOG_REJECTION?.revealed).toBe(true);
    expect(result.state.signals.ISSUER_KEY_ID).toEqual({ value: 'K71', revealed: true });
    expect(result.state.signals.VERIFIER_KEY_ID).toEqual({ value: 'K71', revealed: true });
    expect(result.state.signals.DEPLOYMENT_BUILD).toEqual({ value: '1846', revealed: true });
    expect(result.state.revealedEvidenceIds).toEqual([
      'KEYSET_MISMATCH_TRACE',
      'DEPLOYMENT_ORDER_RECORD',
    ]);
    expect(result.state.elapsedSeconds).toBe(250);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(79);
    expect(result.state.resources.OPERATIONAL_RISK?.value).toBe(20);
    expect(result.state.signals.AUTH_ERROR_RATE?.value).toBe(1);
    expect(result.state.resolutionReached).toBe(true);
    expect(result.state.completionReached).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'event_cancelled',
        sourceId: 'ROLLBACK_BUILD_1847',
        targetId: 'ROUTING_WINDOW_EXPIRES',
      }),
    );
    expect(
      result.events.some(
        ({ type, sourceId }) => type === 'event_fired' && sourceId === 'ROUTING_WINDOW_EXPIRES',
      ),
    ).toBe(false);

    const report = computePostmortem(scenario, result.state);
    expect(report.nonResolvingInterventions.map(({ id }) => id)).toEqual(['ROUTE_STABLE_REGION']);
    expect(report.mechanisms).toContainEqual(
      expect.objectContaining({ id: 'ISSUER_VERIFIER_KEY_MISMATCH', resolved: true }),
    );
    expect(report.metrics.find(({ id }) => id === 'CUSTOMER_DAMAGE')?.value).toBe(79);
    expect(report.metrics.find(({ id }) => id === 'ROLLBACK_COUNT')?.value).toBe(1);
  });

  it('contains the same mechanism through a slower key-set update with different costs', () => {
    const scenario = loadInc002();
    const result = replayDeterministically(scenario, keysetUpdateReplay);
    expect(result.state.elapsedSeconds).toBe(295);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(103);
    expect(result.state.resources.OPERATIONAL_RISK?.value).toBe(4);
    expect(result.state.resources.COST?.value).toBe(90);
    expect(result.state.signals.AUTH_ERROR_RATE?.value).toBe(0.5);
    expect(result.state.signals.ISSUER_KEY_ID).toEqual({ value: 'K72', revealed: true });
    expect(result.state.signals.VERIFIER_KEY_ID).toEqual({ value: 'K72', revealed: true });
    expect(result.state.resolutionReached).toBe(true);
    expect(result.state.completionReached).toBe(true);

    const report = computePostmortem(scenario, result.state);
    expect(report.nonResolvingInterventions).toEqual([]);
    expect(report.communicationActions.map(({ id }) => id)).toEqual(['COMMUNICATE_STATUS']);
    expect(report.metrics.find(({ id }) => id === 'KEYSET_UPDATE_COUNT')?.value).toBe(1);
    expect(report.metrics.find(({ id }) => id === 'CUSTOMER_DAMAGE')?.value).toBe(103);
  });
});

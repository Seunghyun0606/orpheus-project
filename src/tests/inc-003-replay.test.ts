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
  deadLetterReplay,
  quarantineReplay,
  renewedConsumersReplay,
  temporaryConsumersReplay,
  type Inc003ReplayFixture,
} from './fixtures/inc-003-replays.ts';

function loadInc003(): Scenario {
  const files = ['inc-001.yaml', 'inc-002.yaml', 'inc-003.yaml'].map((name) => {
    const file = path.resolve('src/scenario/data/incidents', name);
    return { file, source: readFileSync(file, 'utf8') };
  });
  const catalog = validateScenarioCatalog(files);
  if (!catalog.success) {
    throw new Error(
      `Expected incident catalog to be valid: ${JSON.stringify(catalog.diagnostics)}`,
    );
  }
  const scenario = catalog.scenarios.get('INC-003');
  if (scenario === undefined) throw new Error('INC-003 is absent from the validated catalog.');
  return scenario;
}

function replayDeterministically(scenario: Scenario, fixture: Inc003ReplayFixture): ReplaySuccess {
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

describe('INC-003 Queue Backlog headless replays', () => {
  it('gates causal actions on queue trace and batch evidence', () => {
    const scenario = loadInc003();
    const initial = createIncidentState(scenario, { seed: 3000 });
    expect(initial.signals.PAGER_SERVICE).toEqual({ value: 'Receipt Worker', revealed: true });
    expect(initial.signals.TRACED_MESSAGE_ID?.revealed).toBe(false);
    const early = executeCommand(initial, scenario, {
      type: 'perform_action',
      actionId: 'QUARANTINE_MESSAGE',
    });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe('ACTION_LOCKED');

    const compared = executeCommand(initial, scenario, {
      type: 'perform_action',
      actionId: 'COMPARE_BATCH',
    });
    expect(compared.ok).toBe(true);
    if (!compared.ok) throw new Error('Expected batch comparison to complete.');
    const withoutTrace = executeCommand(compared.state, scenario, {
      type: 'perform_action',
      actionId: 'QUARANTINE_MESSAGE',
    });
    expect(withoutTrace.ok).toBe(false);
    if (!withoutTrace.ok) expect(withoutTrace.code).toBe('ACTION_REQUIREMENTS_UNMET');
  });

  it('shows temporary consumer relief and delayed backlog rebound', () => {
    const result = replayDeterministically(loadInc003(), temporaryConsumersReplay);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'signal_changed',
        atSeconds: 0,
        targetId: 'QUEUE_DEPTH',
        value: 5900,
      }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'event_fired',
        atSeconds: 180,
        sourceId: 'BACKLOG_REBOUNDS',
      }),
    );
    expect(result.state.elapsedSeconds).toBe(240);
    expect(result.state.signals.QUEUE_DEPTH?.value).toBe(24000);
    expect(result.state.signals.OLDEST_MESSAGE_AGE?.value).toBe(31);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(114);
    expect(result.state.resolutionReached).toBe(false);
    expect(result.state.completionReached).toBe(false);
  });

  it('renews the consumer window without firing its previous rebound timer', () => {
    const scenario = loadInc003();
    const beforeRenewedExpiry = replayCommands(
      scenario,
      { seed: renewedConsumersReplay.seed },
      renewedConsumersReplay.commands.slice(0, 7),
    );
    expect(beforeRenewedExpiry.ok).toBe(true);
    if (!beforeRenewedExpiry.ok) throw new Error('Expected the renewed consumer prefix to replay.');
    expect(beforeRenewedExpiry.state.elapsedSeconds).toBe(220);
    expect(beforeRenewedExpiry.state.signals.QUEUE_DEPTH?.value).toBe(5900);
    expect(
      beforeRenewedExpiry.events.some(
        ({ type, sourceId }) => type === 'event_fired' && sourceId === 'BACKLOG_REBOUNDS',
      ),
    ).toBe(false);

    const result = replayDeterministically(scenario, renewedConsumersReplay);
    expect(result.state.elapsedSeconds).toBe(260);
    expect(
      result.events.filter(
        ({ type, sourceId }) => type === 'event_fired' && sourceId === 'BACKLOG_REBOUNDS',
      ),
    ).toEqual([expect.objectContaining({ atSeconds: 260 })]);
    expect(result.state.signals.QUEUE_DEPTH?.value).toBe(24000);
  });

  it('quarantines the message after temporary scaling and preserves investigation evidence', () => {
    const scenario = loadInc003();
    const result = replayDeterministically(scenario, quarantineReplay);
    expect(result.state.signals.TRACED_MESSAGE_ID).toEqual({
      value: 'batch-781/message-44',
      revealed: true,
    });
    expect(result.state.signals.TRACED_MESSAGE_SCHEMA).toEqual({
      value: 'legacy_v3',
      revealed: true,
    });
    expect(result.state.revealedEvidenceIds).toEqual([
      'REPEATED_MESSAGE_TRACE',
      'PARTNER_BATCH_RECORD',
    ]);
    expect(result.state.elapsedSeconds).toBe(265);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(78);
    expect(result.state.resources.OPERATIONAL_RISK?.value).toBe(18);
    expect(result.state.signals.QUEUE_DEPTH?.value).toBe(1200);
    expect(result.state.resolutionReached).toBe(true);
    expect(result.state.completionReached).toBe(true);
    for (const actionId of ['SCALE_CONSUMERS', 'ADD_DEAD_LETTER_RULE']) {
      const afterResolution = executeCommand(result.state, scenario, {
        type: 'perform_action',
        actionId,
      });
      expect(afterResolution.ok).toBe(false);
      if (!afterResolution.ok) expect(afterResolution.code).toBe('ACTION_REQUIREMENTS_UNMET');
    }
    expect(
      result.events.some(
        ({ type, sourceId }) => type === 'event_fired' && sourceId === 'BACKLOG_REBOUNDS',
      ),
    ).toBe(false);

    const report = computePostmortem(scenario, result.state);
    expect(report.nonResolvingInterventions.map(({ id }) => id)).toEqual(['SCALE_CONSUMERS']);
    expect(report.mechanisms).toContainEqual(
      expect.objectContaining({ id: 'POISON_MESSAGE_HEAD_OF_LINE', resolved: true }),
    );
    expect(report.metrics.find(({ id }) => id === 'CUSTOMER_DAMAGE')?.value).toBe(78);
    expect(report.metrics.find(({ id }) => id === 'QUARANTINE_COUNT')?.value).toBe(1);
  });

  it('uses a slower dead-letter rule with different impact, risk, and cost', () => {
    const scenario = loadInc003();
    const result = replayDeterministically(scenario, deadLetterReplay);
    expect(result.state.elapsedSeconds).toBe(295);
    expect(result.state.resources.CUSTOMER_IMPACT?.value).toBe(106);
    expect(result.state.resources.OPERATIONAL_RISK?.value).toBe(4);
    expect(result.state.resources.COST?.value).toBe(100);
    expect(result.state.signals.QUEUE_DEPTH?.value).toBe(1800);
    expect(result.state.signals.OLDEST_MESSAGE_AGE?.value).toBe(3);
    expect(result.state.resolutionReached).toBe(true);
    expect(result.state.completionReached).toBe(true);

    const report = computePostmortem(scenario, result.state);
    expect(report.nonResolvingInterventions).toEqual([]);
    expect(report.communicationActions.map(({ id }) => id)).toEqual(['COMMUNICATE_STATUS']);
    expect(report.metrics.find(({ id }) => id === 'DEAD_LETTER_RULE_COUNT')?.value).toBe(1);
    expect(report.metrics.find(({ id }) => id === 'CUSTOMER_DAMAGE')?.value).toBe(106);
  });
});

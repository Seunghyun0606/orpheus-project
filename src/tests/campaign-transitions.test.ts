import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  getCampaignProgression,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import { parseCampaignYaml, validateCampaignDefinition } from '../scenario/campaign.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { replayCommands } from '../engine/simulation.ts';
import { campaignCatalog, campaignFixture, operation, always } from './fixtures/campaign.ts';
import { rootCauseResolutionReplay } from './fixtures/inc-001-replays.ts';

const commands = rootCauseResolutionReplay.commands;
function apply(run: CampaignRun | null, op: CampaignOperation, d = campaignFixture()): CampaignRun {
  const result = prepareCampaignOperation(d, campaignCatalog, run, op);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.run;
}
function start(d = campaignFixture()): CampaignRun {
  const run = apply(null, operation(null, { kind: 'create' }), d);
  return apply(
    run,
    operation(run, { kind: 'start', attemptId: 'first', incidentId: 'stage-one', seed: 1002 }),
    d,
  );
}
function perform(run: CampaignRun, actionId: string, d = campaignFixture()): CampaignRun {
  const attempt = run.attempts.find((item) => item.id === run.activeAttemptId)!;
  return apply(
    run,
    operation(run, {
      kind: 'command',
      attemptId: attempt.id,
      inputId: 'input-' + run.revision,
      commandSequence: attempt.incident.replayLog.length,
      priorHead: campaignAttemptHead(attempt),
      command: { type: 'perform_action', actionId },
    }),
    d,
  );
}
function complete(run: CampaignRun, d = campaignFixture()): CampaignRun {
  return commands.reduce((current, command) => perform(current, command.actionId, d), run);
}
function snapshot(count: number): string {
  const result = replayCommands(inc001Scenario, { seed: 1002 }, commands.slice(0, count));
  if (!result.ok) throw new Error('Fixture replay failed');
  return JSON.stringify(
    {
      schemaVersion: 1,
      scenarioId: inc001Scenario.id,
      contentVersion: inc001Scenario.contentVersion,
      seed: 1002,
      incident: result.state,
    },
    null,
    2,
  );
}

describe('data-driven pure campaign transitions', () => {
  it('parses YAML and rejects schema/version/unknown reference/duplicate/missing initial values', () => {
    const fixture = campaignFixture();
    expect(parseCampaignYaml(stringify(fixture), campaignCatalog).ok).toBe(true);
    expect(parseCampaignYaml('a: [', campaignCatalog).ok).toBe(false);
    for (const invalid of [
      { ...fixture, schemaVersion: 2 },
      { ...fixture, extra: true },
      { ...fixture, initial: { ...fixture.initial, values: {} } },
      { ...fixture, references: [...fixture.references, fixture.references[0]] },
      { ...fixture, incidents: [{ ...fixture.incidents[0], contentVersion: 'unknown' }] },
      { ...fixture, acts: [{ id: 1, eligibility: { ...always, reference: 'missing' } }] },
    ])
      expect(validateCampaignDefinition(invalid, campaignCatalog).ok).toBe(false);
  });
  it('replays identical definitions, seed and ordered inputs into equal state/events', () => {
    const run = complete(start());
    const replay = replayCampaign(campaignFixture(), campaignCatalog, run.operations);
    expect(replay.ok && replay.run).toEqual(run);
    expect(run.projection).toMatchObject({
      evidence: ['artifact'],
      narratives: ['hint'],
      completed: ['stage-one'],
      values: { curiosity: 3, operationalSafety: 1 },
      alignment: { corporate: 2 },
      narrativeFlags: { discovered: true },
    });
    expect(run.attempts[0]!.incident.completionReached).toBe(true);
  });
  it('keeps equal-seed retries and unfinished history, but effect receipts apply once per run', () => {
    let run = perform(start(), 'OPEN_METRICS');
    const oldAttempt = canonicalJson(run.attempts[0]);
    run = apply(
      run,
      operation(run, { kind: 'start', attemptId: 'retry', incidentId: 'stage-one', seed: 1002 }),
    );
    run = complete(run);
    const receipts = canonicalJson(run.effectReceipts);
    run = apply(
      run,
      operation(run, {
        kind: 'start',
        attemptId: 'retry-again',
        incidentId: 'stage-one',
        seed: 1002,
      }),
    );
    run = complete(run);
    expect(canonicalJson(run.attempts[0])).toBe(oldAttempt);
    expect(run.attempts.map((item) => item.acceptedInputIds.length)).toEqual([1, 4, 4]);
    expect(run.projection.values.curiosity).toBe(3);
    expect(canonicalJson(run.effectReceipts)).toBe(receipts);
    expect(replayCampaign(campaignFixture(), campaignCatalog, run.operations)).toMatchObject({
      ok: true,
      run,
    });
  });
  it('duplicate delivery reconciles at current head, but conflicting identity/payload fails read-only', () => {
    let run = perform(start(), 'OPEN_METRICS');
    const old = run.operations.at(-1)!;
    run = perform(run, 'OPEN_LOGS');
    const before = canonicalJson(run);
    expect(prepareCampaignOperation(campaignFixture(), campaignCatalog, run, old)).toEqual({
      ok: true,
      disposition: 'duplicate',
      run,
    });
    expect(
      prepareCampaignOperation(campaignFixture(), campaignCatalog, run, { ...old, sequence: 999 })
        .ok,
    ).toBe(false);
    expect(canonicalJson(run)).toBe(before);
    expect(replayCampaign(campaignFixture(), campaignCatalog, [...run.operations, old]).ok).toBe(
      false,
    );
  });
  it('rejects stale heads, missing predecessors, reused inputs, rejected commands and forged projections', () => {
    const run = start();
    const attempt = run.attempts[0]!;
    const op = operation(run, {
      kind: 'command',
      attemptId: attempt.id,
      inputId: 'input',
      commandSequence: 0,
      priorHead: campaignAttemptHead(attempt),
      command: { type: 'perform_action', actionId: 'OPEN_LOGS' },
    });
    const before = canonicalJson(run);
    for (const bad of [
      { ...op, sequence: 99 },
      { ...op, priorHead: 'not-the-head' },
      { ...op, commandSequence: 1 },
      { ...op, command: { type: 'perform_action', actionId: 'missing' } },
      { ...op, command: { type: 'perform_action', actionId: 'TERMINATE_STALE_SESSIONS' } },
    ])
      expect(prepareCampaignOperation(campaignFixture(), campaignCatalog, run, bad).ok).toBe(false);
    const changed = apply(run, op);
    expect(
      prepareCampaignOperation(campaignFixture(), campaignCatalog, changed, {
        ...op,
        operationId: 'new',
        sequence: changed.revision + 1,
        commandSequence: 1,
        priorHead: campaignAttemptHead(changed.attempts[0]!),
      }).ok,
    ).toBe(false);
    const forged = JSON.parse(before) as CampaignRun;
    forged.projection.values.curiosity = 900;
    expect(prepareCampaignOperation(campaignFixture(), campaignCatalog, forged, op).ok).toBe(false);
    expect(canonicalJson(run)).toBe(before);
  });
  it('authored completion changes Act and gates the next incident without incident-ID branching', () => {
    const d = campaignFixture(true);
    const initial = start(d);
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        initial,
        operation(initial, { kind: 'start', attemptId: 'early', incidentId: 'stage-two', seed: 1 }),
      ).ok,
    ).toBe(false);
    const run = complete(initial, d);
    expect(run.projection.act).toBe(2);
    expect(getCampaignProgression(d, campaignCatalog, run)).toMatchObject({
      ok: true,
      incidents: [
        { id: 'stage-one', result: { ok: true } },
        { id: 'stage-two', result: { ok: true, value: true } },
      ],
    });
    expect(
      apply(
        run,
        operation(run, { kind: 'start', attemptId: 'next', incidentId: 'stage-two', seed: 1 }),
        d,
      ).activeAttemptId,
    ).toBe('next');
  });
  it('confirmed checkpoint retains RNG/resources/pending work and excludes prefix membership/effects/inputs', () => {
    const run = start();
    const bytes = snapshot(3);
    const restored = apply(
      run,
      operation(run, {
        kind: 'checkpoint',
        attemptId: 'restored',
        incidentId: 'stage-one',
        sourceBytes: bytes,
        confirmed: true,
      }),
    );
    const attempt = restored.attempts.at(-1)!;
    expect(attempt.sourceBytes).toBe(bytes);
    expect(attempt.baselineCommandCount).toBe(3);
    expect(attempt.baselineEventCount).toBe(attempt.incident.eventLog.length);
    expect(attempt.acceptedInputIds).toEqual([]);
    expect(restored.projection.evidence).toEqual([]);
    expect(restored.effectReceipts).toEqual([]);
    const continued = perform(restored, 'TERMINATE_STALE_SESSIONS');
    expect(continued.attempts.at(-1)!.acceptedInputIds).toHaveLength(1);
    expect(continued.projection.completed).toEqual(['stage-one']);
    expect(replayCampaign(campaignFixture(), campaignCatalog, continued.operations)).toMatchObject({
      ok: true,
      run: continued,
    });
    expect(
      prepareCampaignOperation(
        campaignFixture(),
        campaignCatalog,
        run,
        operation(run, {
          kind: 'checkpoint',
          attemptId: 'completed',
          incidentId: 'stage-one',
          sourceBytes: snapshot(4),
          confirmed: true,
        }),
      ).ok,
    ).toBe(false);
  });
  it('adopts only source-verified discoveries, without historical completion/flags/effects or silent partial import', () => {
    const run = start();
    const bytes = snapshot(4);
    const adopted = apply(
      run,
      operation(run, { kind: 'adopt', sourceBytes: [bytes], confirmed: true }),
    );
    expect(adopted.projection).toMatchObject({
      evidence: ['artifact'],
      narratives: ['hint'],
      completed: [],
      narrativeFlags: { discovered: false },
      values: { curiosity: 0 },
      alignment: { corporate: 0 },
    });
    expect(adopted.effectReceipts).toEqual([]);
    const repeated = apply(
      adopted,
      operation(adopted, { kind: 'adopt', sourceBytes: [bytes], confirmed: true }),
    );
    expect(repeated.projection).toEqual(adopted.projection);
    const genuinelyNew = complete(repeated);
    expect(genuinelyNew.projection.values.curiosity).toBe(3);
    for (const sources of [[bytes, '{}'], [bytes.replace('"seed": 1002', '"seed": 1003')]]) {
      expect(
        prepareCampaignOperation(
          campaignFixture(),
          campaignCatalog,
          run,
          operation(run, { kind: 'adopt', sourceBytes: sources, confirmed: true }),
        ).ok,
      ).toBe(false);
    }
    expect(run.projection.evidence).toEqual([]);
  });
  it('unavailable metric under a decisive sibling diagnoses without awarding another route/effect', () => {
    const d = campaignFixture();
    d.incidents[0]!.eligibility = {
      type: 'any',
      children: [always, { type: 'compare', reference: 'metric', operator: 'gte', expected: 0 }],
    };
    const run = apply(null, operation(null, { kind: 'create' }), d);
    expect(
      prepareCampaignOperation(
        d,
        campaignCatalog,
        run,
        operation(run, { kind: 'start', attemptId: 'none', incidentId: 'stage-one', seed: 1 }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: 'metric' }],
    });
    expect(run.attempts).toEqual([]);
  });
  it('definition/scenario changes under the same version never reinterpret a run', () => {
    const run = start();
    const changed = campaignFixture();
    changed.effects[0]!.values.curiosity = 99;
    expect(
      prepareCampaignOperation(
        changed,
        campaignCatalog,
        run,
        operation(run, { kind: 'adopt', sourceBytes: [snapshot(4)], confirmed: true }),
      ).ok,
    ).toBe(false);
    const scenario = { ...inc001Scenario, title: 'changed under same version' };
    const catalog = new Map([...campaignCatalog].map(([key]) => [key, scenario]));
    expect(
      prepareCampaignOperation(
        campaignFixture(),
        catalog,
        run,
        operation(run, { kind: 'adopt', sourceBytes: [snapshot(4)], confirmed: true }),
      ).ok,
    ).toBe(false);
  });
  it('a distinct attempt can reuse an attempt-local input label without replaying the old input', () => {
    let run = start();
    const make = (current: CampaignRun): CampaignOperation =>
      operation(current, {
        kind: 'command',
        attemptId: current.activeAttemptId!,
        inputId: 'local-zero',
        commandSequence: 0,
        priorHead: campaignAttemptHead(current.attempts.at(-1)!),
        command: { type: 'perform_action', actionId: 'OPEN_LOGS' },
      });
    run = apply(run, make(run));
    run = apply(
      run,
      operation(run, { kind: 'start', attemptId: 'second', incidentId: 'stage-one', seed: 1002 }),
    );
    run = apply(run, make(run));
    expect(run.attempts.map((item) => item.acceptedInputIds.length)).toEqual([1, 1]);
  });
  it('preserves pending scheduled work and RNG from a confirmed baseline without new input credit', () => {
    const replay = replayCommands(inc001Scenario, { seed: 71 }, [
      { type: 'perform_action', actionId: 'ASK_JIN_CONFIRM_IMPACT' },
      { type: 'perform_action', actionId: 'RESTART_API' },
    ]);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.state.scheduledWork.length).toBeGreaterThan(0);
    const bytes = JSON.stringify({
      schemaVersion: 1,
      scenarioId: inc001Scenario.id,
      contentVersion: inc001Scenario.contentVersion,
      seed: 71,
      incident: replay.state,
    });
    const run = start();
    const restored = apply(
      run,
      operation(run, {
        kind: 'checkpoint',
        attemptId: 'pending',
        incidentId: 'stage-one',
        sourceBytes: bytes,
        confirmed: true,
      }),
    );
    const attempt = restored.attempts.at(-1)!;
    expect(attempt.incident.scheduledWork).toEqual(replay.state.scheduledWork);
    expect(attempt.incident.rng).toEqual(replay.state.rng);
    expect(attempt.incident.resources).toEqual(replay.state.resources);
    expect(attempt.acceptedInputIds).toEqual([]);
    expect(restored.effectReceipts).toEqual([]);
  });
  it('diagnostic effects never publish a partial batch, numeric overflow or unresolved ending flag', () => {
    const d = campaignFixture();
    d.effects[0]!.condition = {
      type: 'any',
      children: [always, { type: 'compare', reference: 'metric', operator: 'eq', expected: 0 }],
    };
    let run = start(d);
    for (const command of commands.slice(0, 3)) run = perform(run, command.actionId, d);
    const before = canonicalJson(run);
    const attempt = run.attempts[0]!;
    const op = operation(run, {
      kind: 'command',
      attemptId: attempt.id,
      inputId: 'final',
      commandSequence: attempt.incident.replayLog.length,
      priorHead: campaignAttemptHead(attempt),
      command: { type: 'perform_action', actionId: 'TERMINATE_STALE_SESSIONS' },
    });
    expect(prepareCampaignOperation(d, campaignCatalog, run, op).ok).toBe(false);
    expect(canonicalJson(run)).toBe(before);
    const invalid = campaignFixture();
    invalid.effects[0]!.endingFlags.closed = true;
    expect(validateCampaignDefinition(invalid, campaignCatalog).ok).toBe(false);
    const overflow = campaignFixture();
    overflow.initial.values.curiosity = Number.MAX_VALUE;
    overflow.effects[0]!.values.curiosity = Number.MAX_VALUE;
    let overflowing = start(overflow);
    for (const command of commands.slice(0, 3))
      overflowing = perform(overflowing, command.actionId, overflow);
    const head = overflowing.attempts[0]!;
    const result = prepareCampaignOperation(
      overflow,
      campaignCatalog,
      overflowing,
      operation(overflowing, {
        kind: 'command',
        attemptId: head.id,
        inputId: 'overflow',
        commandSequence: head.incident.replayLog.length,
        priorHead: campaignAttemptHead(head),
        command: { type: 'perform_action', actionId: 'TERMINATE_STALE_SESSIONS' },
      }),
    );
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'NONFINITE_EFFECT' }] });
    expect(overflowing.effectReceipts).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  getCampaignBehavior,
  getCampaignProgression,
  resumeCampaignAssociation,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { parseCampaignYaml, validateCampaignDefinition } from '../scenario/campaign.ts';
import { metricKeys } from '../scenario/behavior.ts';
import { validateScenarioObject } from '../scenario/validator.ts';
import { encodeSave } from '../persistence/save.ts';
import { replayCommands } from '../engine/simulation.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';
import { behaviorCampaignFixture, behaviorOperation } from './fixtures/behavior.ts';

const definition = behaviorCampaignFixture();
function apply(
  prior: CampaignRun | null,
  op: CampaignOperation,
  d = definition,
  catalog = campaignCatalog,
): CampaignRun {
  const result = prepareCampaignOperation(d, catalog, prior, op);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.run;
}
function create(d = definition, runId = 'fixture-run') {
  return apply(null, { ...behaviorOperation(d, null, { kind: 'create' }), runId }, d);
}
function start(prior = create(), name = 'attempt', d = definition) {
  return apply(
    prior,
    behaviorOperation(d, prior, {
      kind: 'start',
      attemptId: name,
      incidentId: 'stage-one',
      seed: 17,
    }),
    d,
  );
}
function commandOp(prior: CampaignRun, actionId: string, d = definition) {
  const attempt = prior.attempts.at(-1)!;
  return behaviorOperation(d, prior, {
    kind: 'command',
    attemptId: attempt.id,
    inputId: 'input-' + prior.revision,
    commandSequence: attempt.incident.replayLog.length,
    priorHead: campaignAttemptHead(attempt),
    command: { type: 'perform_action', actionId },
  });
}
function act(prior: CampaignRun, actionId: string, d = definition) {
  return apply(prior, commandOp(prior, actionId, d), d);
}
function actions(prior: CampaignRun, ids: string[]) {
  return ids.reduce((run, id) => act(run, id), prior);
}
function sourceBytes(ids: string[]) {
  const result = replayCommands(
    inc001Scenario,
    { seed: 17 },
    ids.map((actionId) => ({ type: 'perform_action', actionId })),
  );
  if (!result.ok) throw new Error(result.error.message);
  return encodeSave(inc001Scenario, 17, result.state);
}
function checkpoint(bytes: string, prior = create(), name = 'checkpoint') {
  return apply(
    prior,
    behaviorOperation(definition, prior, {
      kind: 'checkpoint',
      attemptId: name,
      incidentId: 'stage-one',
      sourceBytes: bytes,
      confirmed: true,
    }),
  );
}
const supported = () => {
  const d = behaviorCampaignFixture();
  const m = d.behavior!.scenarios[0]!;
  if (m.coverage !== 'supported') throw new Error('fixture coverage');
  return { d, m };
};

describe('versioned player behavior from new identified official inputs', () => {
  it('round-trips strict YAML and exposes all ten fields without inventing opportunities', () => {
    const parsed = parseCampaignYaml(stringify(definition), campaignCatalog);
    expect(parsed).toEqual({ ok: true, definition });
    const run = start();
    expect(Object.keys(run.behavior!.metrics)).toEqual([...metricKeys]);
    for (const key of metricKeys)
      expect(run.behavior!.metrics[key]).toMatchObject({
        status: 'unavailable',
        numerator: 0,
        denominator: 0,
      });
    const used = actions(run, ['OPEN_LOGS', 'UPDATE_WAR_ROOM', 'RESTART_API']);
    for (const key of [
      'aiRecommendationAcceptanceRate',
      'safetyPreference',
      'collateralDamageTolerance',
      'companyReportingRate',
      'nullCooperationRate',
      'predictionDeviation',
    ] as const)
      expect(used.behavior!.metrics[key]).toMatchObject({
        status: 'unavailable',
        reason: 'NO_RECORDED_OPPORTUNITIES',
        numerator: 0,
        denominator: 0,
      });
  });
  it('uses only authored operational interventions as rate denominators, with real observed zero', () => {
    const information = actions(start(), [
      'OPEN_LOGS',
      'OPEN_METRICS',
      'OPEN_LOGS',
      'OPEN_METRICS',
      'UPDATE_WAR_ROOM',
      'INSPECT_DB',
    ]);
    expect(information.behavior!.metrics.restartRate).toMatchObject({
      status: 'unavailable',
      denominator: 0,
    });
    const run = actions(information, ['RESTART_API', 'ROLLBACK', 'SCALE_API']);
    expect(run.behavior!.metrics.restartRate).toMatchObject({
      status: 'available',
      value: 1 / 3,
      numerator: 1,
      denominator: 3,
    });
    expect(run.behavior!.metrics.rollbackRate).toMatchObject({ value: 1 / 3 });
    expect(act(start(), 'SCALE_API').behavior!.metrics.restartRate).toMatchObject({
      status: 'available',
      value: 0,
      numerator: 0,
      denominator: 1,
    });
  });
  it('pools raw eligible counts across unfinished/abandoned attempts instead of averaging rates', () => {
    let run = actions(start(), ['RESTART_API', 'SCALE_API']);
    run = start(run, 'second');
    run = actions(run, ['RESTART_API', ...Array<string>(9).fill('SCALE_API')]);
    expect(run.behavior!.metrics.restartRate).toMatchObject({
      value: 2 / 12,
      numerator: 2,
      denominator: 12,
    });
    expect(run.behavior!.metrics.averageInvestigationDepth).toMatchObject({
      value: 0,
      denominator: 2,
    });
    expect(run.behavior!.attempts).toHaveLength(2);
  });
  it('retains exact deterministic provenance, distinct attempt/input identity and run isolation', () => {
    const first = actions(start(), ['OPEN_LOGS', 'RESTART_API']);
    const next = act(start(first, 'second'), 'RESTART_API');
    expect(next.behavior!.attempts[0]!.samples[1]!.source).toMatchObject({
      runId: next.runId,
      attemptId: 'attempt',
      inputId: 'input-2',
      operationId: 'op-3',
      operationSequence: 3,
      commandSequence: 1,
      scenarioId: inc001Scenario.id,
      contentVersion: inc001Scenario.contentVersion,
      modelVersion: 'test-model-v1',
      classificationVersion: 'test-classes-v1',
      formulaVersion: 1,
    });
    const replay = replayCampaign(definition, campaignCatalog, next.operations);
    expect(replay.ok && canonicalJson(replay.run)).toBe(canonicalJson(next));
    expect(getCampaignBehavior(definition, campaignCatalog, next)).toEqual({
      ok: true,
      behavior: next.behavior,
    });
    const other = act(start(create(definition, 'another-run')), 'SCALE_API');
    expect(other.behavior!.metrics.restartRate).toMatchObject({ value: 0, denominator: 1 });
    expect(other.behavior!.attempts[0]!.samples[0]!.source.runId).toBe('another-run');
  });
  it('does not count duplicate delivery, rejected commands, conflicting inputs or UI attempt starts', () => {
    const initial = start();
    const op = commandOp(initial, 'RESTART_API');
    const run = apply(initial, op);
    expect(prepareCampaignOperation(definition, campaignCatalog, run, op)).toEqual({
      ok: true,
      disposition: 'duplicate',
      run,
    });
    const unchanged = canonicalJson(run);
    for (const bad of [
      commandOp(run, 'NOT_AN_ACTION'),
      commandOp(run, 'TERMINATE_STALE_SESSIONS'),
      { ...commandOp(run, 'SCALE_API'), inputId: op.kind === 'command' ? op.inputId : '' },
    ])
      expect(prepareCampaignOperation(definition, campaignCatalog, run, bad).ok).toBe(false);
    expect(canonicalJson(run)).toBe(unchanged);
    expect(start(run, 'empty-retry').behavior!.metrics.restartRate).toEqual(
      run.behavior!.metrics.restartRate,
    );
  });
  it('counts distinct investigation keys once per eligible attempt and includes eligible zero-depth attempts', () => {
    const investigated = actions(start(), [
      'OPEN_LOGS',
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
    ]);
    expect(investigated.behavior!.attempts[0]!.distinctKeys).toEqual(['logs', 'sessions']);
    expect(investigated.behavior!.attempts[0]!.observations).toHaveLength(3);
    const empty = start(investigated, 'empty');
    expect(empty.behavior!.metrics.averageInvestigationDepth).toMatchObject({
      value: 2,
      denominator: 1,
    });
    const second = act(empty, 'SCALE_API');
    expect(second.behavior!.metrics.averageInvestigationDepth).toMatchObject({
      value: 1,
      numerator: 2,
      denominator: 2,
    });
    const third = act(start(second, 'third'), 'OPEN_LOGS');
    expect(third.behavior!.metrics.averageInvestigationDepth).toMatchObject({
      value: 1,
      numerator: 3,
      denominator: 3,
    });
    expect(
      investigated.attempts[0]!.incident.actionHistory.filter((id) => id === 'OPEN_LOGS'),
    ).toHaveLength(2);
  });
  it('requires relevant, fresh, earlier investigation from the same attempt without retroactive correction', () => {
    const unrelated = actions(start(), ['OPEN_LOGS', 'RESTART_API']);
    expect(unrelated.behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      value: 0,
      denominator: 1,
    });
    const investigated = actions(unrelated, ['INSPECT_DB', 'INSPECT_SESSIONS']);
    expect(investigated.behavior!.metrics.evidenceBeforeActionRate).toMatchObject({ numerator: 0 });
    const positive = act(investigated, 'RESTART_API');
    expect(positive.behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      value: 1 / 2,
      numerator: 1,
      denominator: 2,
    });
    expect(positive.behavior!.attempts[0]!.samples.at(-1)!.support).toHaveLength(1);
    const expired = actions(positive, Array<string>(5).fill('OPEN_METRICS'));
    expect(act(expired, 'SCALE_API').behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      numerator: 1,
      denominator: 3,
    });
    expect(
      act(start(positive, 'retry'), 'RESTART_API').behavior!.metrics.evidenceBeforeActionRate,
    ).toMatchObject({ numerator: 1, denominator: 3 });
  });
  it('cannot use the same command result as its own pre-action support', () => {
    const { d, m } = supported();
    const query = m.actions.find((a) => a.actionId === 'INSPECT_SESSIONS')!;
    query.evidenceEligible = true;
    m.supportRules.push({
      ...m.supportRules[0]!,
      id: 'query-support',
      actionId: query.actionId,
      relevance: { type: 'compare', reference: 'action', operator: 'eq', expected: query.actionId },
    });
    const run = act(act(start(create(d), 'attempt', d), 'INSPECT_DB', d), 'INSPECT_SESSIONS', d);
    expect(run.behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      value: 0,
      denominator: 1,
    });
    expect(
      act(run, 'INSPECT_SESSIONS', d).behavior!.metrics.evidenceBeforeActionRate,
    ).toMatchObject({ value: 1 / 2, denominator: 2 });
  });
  it('keeps checkpoint prefixes/imported membership out of samples and new investigation', () => {
    const bytes = sourceBytes(['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS']);
    const inherited = checkpoint(bytes);
    expect(inherited.behavior!.metrics.averageInvestigationDepth).toMatchObject({
      status: 'unavailable',
      denominator: 0,
    });
    expect(act(inherited, 'RESTART_API').behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      value: 0,
    });
    const fresh = act(inherited, 'INSPECT_SESSIONS');
    expect(act(fresh, 'RESTART_API').behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      value: 1,
    });
    expect(fresh.behavior!.attempts[0]!.distinctKeys).toEqual(['sessions']);
    const completed = sourceBytes([
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]);
    const prior = create();
    const adopted = apply(
      prior,
      behaviorOperation(definition, prior, {
        kind: 'adopt',
        sourceBytes: [completed],
        confirmed: true,
      }),
    );
    expect(adopted.projection.evidence).toEqual(['artifact']);
    expect(adopted.behavior).toEqual(prior.behavior);
    expect(
      act(start(adopted), 'RESTART_API').behavior!.metrics.evidenceBeforeActionRate,
    ).toMatchObject({ value: 0 });
  });
  it('does not treat pending or inherited delegation as a received observation', () => {
    const pending = act(start(), 'ASK_JIN_CONFIRM_IMPACT');
    expect(pending.behavior!.metrics.averageInvestigationDepth).toMatchObject({ value: 0 });
    const mitigated = act(pending, 'RESTART_API');
    expect(mitigated.behavior!.metrics.evidenceBeforeActionRate).toMatchObject({ value: 0 });
    const returned = actions(mitigated, ['OPEN_METRICS', 'OPEN_METRICS']);
    const observation = returned.behavior!.attempts[0]!.observations.find(
      (o) => o.key === 'impact',
    )!;
    expect(observation.source.inputId).toBe(
      pending.behavior!.attempts[0]!.samples[0]!.source.inputId,
    );
    expect(observation.resultOperationId).not.toBe(observation.source.operationId);
    expect(act(returned, 'SCALE_API').behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      numerator: 1,
      denominator: 2,
    });
    const inherited = actions(checkpoint(sourceBytes(['ASK_JIN_CONFIRM_IMPACT'])), [
      'RESTART_API',
      'OPEN_METRICS',
      'OPEN_METRICS',
    ]);
    expect(inherited.behavior!.attempts[0]!.observations).toEqual([]);
    expect(act(inherited, 'SCALE_API').behavior!.metrics.evidenceBeforeActionRate).toMatchObject({
      numerator: 0,
    });
  });
  it('traces concurrent identical delegated returns to their source inputs in scheduling order', () => {
    const run = actions(start(), [
      'ASK_JIN_CONFIRM_IMPACT',
      'ASK_JIN_CONFIRM_IMPACT',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
    ]);
    const returned = run.behavior!.attempts[0]!.observations.filter((o) => o.key === 'impact');
    expect(returned.map((o) => o.source.inputId)).toEqual(['input-1', 'input-2']);
    expect(run.behavior!.attempts[0]!.distinctKeys).toEqual(['impact']);
  });
  it('preserves exact-head resume but starts a confirmed checkpoint retry with empty support', () => {
    const run = actions(start(), ['INSPECT_DB', 'INSPECT_SESSIONS']);
    const bytes = sourceBytes(['INSPECT_DB', 'INSPECT_SESSIONS']);
    const head = run.attempts.at(-1)!;
    const association: CampaignOperation = {
      operationId: 'association',
      runId: run.runId,
      sequence: run.revision + 1,
      definitionId: definition.id,
      definitionVersion: definition.version,
      replayVersion: 1,
      canonicalVersion: 1,
      kind: 'associate',
      attemptId: head.id,
      priorHead: campaignAttemptHead(head),
      sourceBytes: bytes,
    };
    const associated = apply(run, association);
    expect(
      resumeCampaignAssociation(definition, campaignCatalog, associated, 'association', bytes).ok,
    ).toBe(true);
    expect(associated.behavior).toEqual(run.behavior);
    expect(act(associated, 'RESTART_API').behavior!.metrics.evidenceBeforeActionRate).toMatchObject(
      { value: 1 },
    );
    expect(
      act(checkpoint(bytes, associated, 'new-baseline'), 'RESTART_API').behavior!.metrics
        .evidenceBeforeActionRate,
    ).toMatchObject({ value: 0 });
  });
  it('reports unsupported coverage without silently presenting supported subsets as universal behavior', () => {
    const d = behaviorCampaignFixture();
    d.behavior!.scenarios[0] = {
      scenarioId: inc001Scenario.id,
      contentVersion: inc001Scenario.contentVersion,
      coverage: 'unsupported',
      reason: 'fixture-unsupported',
    };
    const run = act(start(create(d), 'attempt', d), 'RESTART_API', d);
    for (const key of [
      'restartRate',
      'rollbackRate',
      'evidenceBeforeActionRate',
      'averageInvestigationDepth',
    ] as const)
      expect(run.behavior!.metrics[key]).toMatchObject({
        status: 'unavailable',
        reason: 'UNSUPPORTED_COVERAGE',
        denominator: 0,
        coverage: { supportedCommandAttempts: 0, unsupportedCommandAttempts: 1 },
      });
  });
  it('consumes verified metrics in conditions, including unavailable leaf diagnostics', () => {
    const d = behaviorCampaignFixture();
    d.incidents[1]!.act = 1;
    d.incidents[1]!.eligibility = {
      type: 'compare',
      reference: 'metric',
      operator: 'eq',
      expected: 0,
    };
    const initial = start(create(d), 'attempt', d);
    expect(getCampaignProgression(d, campaignCatalog, initial)).toMatchObject({
      ok: true,
      incidents: [{}, { result: { ok: false } }],
    });
    const observed = act(initial, 'SCALE_API', d);
    expect(getCampaignProgression(d, campaignCatalog, observed)).toMatchObject({
      ok: true,
      incidents: [{}, { result: { ok: true, value: true } }],
    });
  });
  it('evaluates post-event metrics at that event, not later observations in the same command batch', () => {
    const { d, m } = supported();
    d.references.find((r) => r.id === 'metric')!.key = 'averageInvestigationDepth';
    m.investigations.push({
      id: 'completion-observation',
      key: 'completion-observation',
      actionId: 'TERMINATE_STALE_SESSIONS',
      result: { kind: 'action_completed' },
    });
    d.effects[0]!.condition = { type: 'compare', reference: 'metric', operator: 'eq', expected: 2 };
    let run = start(create(d), 'attempt', d);
    for (const id of ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS'])
      run = act(run, id, d);
    expect(run.projection.values.curiosity).toBe(3);
    expect(run.behavior!.metrics.averageInvestigationDepth).toMatchObject({ value: 3 });
    const observation = run.behavior!.attempts[0]!.observations.at(-1)!;
    expect(run.effectReceipts.find((r) => r.effectId === 'discovery')!.eventSequence).toBeLessThan(
      observation.eventSequence,
    );
  });
  it.each(['pre_command', 'post_event'] as const)(
    'respects %s metric boundaries without changing a prior projection',
    (boundary) => {
      const d = behaviorCampaignFixture();
      d.effects[0]!.boundary = boundary;
      d.effects[0]!.condition = {
        type: 'compare',
        reference: 'metric',
        operator: 'eq',
        expected: boundary === 'pre_command' ? 1 : 1 / 2,
      };
      let run = start(create(d), 'attempt', d);
      for (const id of ['RESTART_API', 'OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS'])
        run = act(run, id, d);
      const prior = canonicalJson(run);
      const next = act(run, 'TERMINATE_STALE_SESSIONS', d);
      expect(next.projection.values.curiosity).toBe(3);
      expect(next.behavior!.metrics.restartRate).toMatchObject({ value: 1 / 2 });
      expect(canonicalJson(run)).toBe(prior);
    },
  );
  it('validates explicit compatible mappings and preserves counts/key meaning under one pinned model', () => {
    const { d, m } = supported();
    const alternate = structuredClone(inc001Scenario);
    alternate.contentVersion = '1.1.1-fixture';
    const catalog = new Map(campaignCatalog);
    catalog.set(scenarioVersionKey(alternate.id, alternate.contentVersion), alternate);
    d.incidents[0]!.compatibleContentVersions = [alternate.contentVersion];
    const mapping = structuredClone(m);
    mapping.contentVersion = alternate.contentVersion;
    d.behavior!.scenarios.push(mapping);
    expect(validateCampaignDefinition(d, catalog).ok).toBe(true);
    const created = apply(null, behaviorOperation(d, null, { kind: 'create' }), d, catalog);
    let run = apply(
      created,
      behaviorOperation(d, created, {
        kind: 'start',
        attemptId: 'alternate',
        incidentId: 'stage-one',
        seed: 17,
        contentVersion: alternate.contentVersion,
      }),
      d,
      catalog,
    );
    run = apply(run, commandOp(run, 'OPEN_LOGS', d), d, catalog);
    expect(run.behavior!.attempts[0]!.observations[0]!.source.contentVersion).toBe(
      alternate.contentVersion,
    );
    expect(run.behavior!.metrics.averageInvestigationDepth).toMatchObject({ value: 1 });
    mapping.investigations[0]!.key = 'sessions';
    const invalid = validateCampaignDefinition(d, catalog);
    expect(invalid.ok ? [] : invalid.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_BEHAVIOR_REFERENCE',
          path: expect.stringContaining('conflictingKey'),
        }),
      ]),
    );
  });
  it('credits verified direct signal/message observations but not an already revealed signal without a new result', () => {
    const { d, m } = supported();
    m.investigations[1]!.result = {
      kind: 'signal_revealed',
      signalId: 'STALE_SESSION_COUNT',
      delivery: { kind: 'action' },
    };
    m.investigations.push({
      id: 'update',
      key: 'update',
      actionId: 'UPDATE_WAR_ROOM',
      result: {
        kind: 'war_room_message',
        messageId: 'OPERATOR_UPDATE',
        delivery: { kind: 'action' },
      },
    });
    const fresh = act(act(start(create(d), 'attempt', d), 'INSPECT_DB', d), 'INSPECT_SESSIONS', d);
    expect(fresh.behavior!.attempts[0]!.observations[0]!.key).toBe('sessions');
    expect(act(fresh, 'INSPECT_SESSIONS', d).behavior!.attempts[0]!.observations).toHaveLength(1);
    expect(act(fresh, 'UPDATE_WAR_ROOM', d).behavior!.attempts[0]!.distinctKeys).toEqual([
      'sessions',
      'update',
    ]);
  });
  it('isolates an inherited timer from a new timer with the same ID and due time', () => {
    const { d, m } = supported();
    const scenario = structuredClone(inc001Scenario);
    scenario.contentVersion = '1.1.1-same-due-fixture';
    scenario.actions.find((a) => a.id === 'ASK_JIN_CONFIRM_IMPACT')!.durationSeconds = 0;
    for (const incident of d.incidents) incident.contentVersion = scenario.contentVersion;
    m.contentVersion = scenario.contentVersion;
    const catalog = new Map([[scenarioVersionKey(scenario.id, scenario.contentVersion), scenario]]);
    const replay = replayCommands(scenario, { seed: 17 }, [
      { type: 'perform_action', actionId: 'ASK_JIN_CONFIRM_IMPACT' },
    ]);
    if (!replay.ok) throw new Error('fixture replay');
    const bytes = encodeSave(scenario, 17, replay.state);
    const created = apply(null, behaviorOperation(d, null, { kind: 'create' }), d, catalog);
    let run = apply(
      created,
      behaviorOperation(d, created, {
        kind: 'checkpoint',
        attemptId: 'checkpoint',
        incidentId: 'stage-one',
        sourceBytes: bytes,
        confirmed: true,
      }),
      d,
      catalog,
    );
    for (const id of [
      'ASK_JIN_CONFIRM_IMPACT',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
      'OPEN_METRICS',
    ])
      run = apply(run, commandOp(run, id, d), d, catalog);
    const reports = run.behavior!.attempts[0]!.observations.filter((o) => o.key === 'impact');
    expect(reports).toHaveLength(1);
    expect(reports[0]!.source.commandSequence).toBe(1);
    expect(reports[0]!.source.inputId).toBe('input-1');
    expect(
      run.attempts[0]!.incident.eventLog.filter(
        (e) => e.type === 'war_room_message' && e.targetId === 'JIN_IMPACT_REPORT',
      ),
    ).toHaveLength(2);
  });
  it('retains old model-less record shape/authority and cannot attach, forge or substitute a model', () => {
    const oldDefinition = campaignFixture();
    const old = apply(null, operation(null, { kind: 'create' }), oldDefinition);
    expect(Object.hasOwn(old, 'behavior')).toBe(false);
    expect(getCampaignBehavior(oldDefinition, campaignCatalog, old)).toEqual({
      ok: true,
      behavior: null,
    });
    expect(
      prepareCampaignOperation(
        definition,
        campaignCatalog,
        old,
        behaviorOperation(definition, old, {
          kind: 'start',
          attemptId: 'attempt',
          incidentId: 'stage-one',
          seed: 17,
        }),
      ).ok,
    ).toBe(false);
    const run = act(start(), 'RESTART_API');
    const modified = structuredClone(definition);
    modified.behavior!.classificationVersion = 'different-classes';
    expect(getCampaignBehavior(modified, campaignCatalog, run).ok).toBe(false);
    const changedVersion = structuredClone(definition);
    changedVersion.behavior!.version = 'different-model';
    expect(getCampaignBehavior(changedVersion, campaignCatalog, run).ok).toBe(false);
    const forged = structuredClone(run);
    forged.behavior!.metrics.restartRate = {
      ...forged.behavior!.metrics.restartRate,
      status: 'available',
      value: 0,
    };
    expect(getCampaignBehavior(definition, campaignCatalog, forged).ok).toBe(false);
  });
});

describe('strict behavior classifications and versioned observation rules', () => {
  it.each([
    ['resolution', 'action'],
    ['completion', 'action'],
    ['resolution', 'timer'],
    ['completion', 'timer'],
  ] as const)('rejects engine milestone source %s for %s observations', (sourceId, delivery) => {
    const { d, m } = supported();
    const scenario = structuredClone(inc001Scenario);
    const rule = m.investigations[2]!;
    if (rule.result.kind !== 'war_room_message') throw new Error('fixture result');
    if (delivery === 'action') {
      const action = scenario.actions.find((a) => a.id === 'UPDATE_WAR_ROOM')!;
      m.actions.find((a) => a.actionId === action.id)!.actionId = sourceId;
      action.id = sourceId;
      rule.actionId = sourceId;
      rule.result = {
        kind: 'war_room_message',
        messageId: 'OPERATOR_UPDATE',
        delivery: { kind: 'action' },
      };
      // The same output from a milestone must not refresh this direct observation.
      scenario.resolution.effects.push({ type: 'post_message', messageId: 'OPERATOR_UPDATE' });
      scenario.completion.effects.push({ type: 'post_message', messageId: 'OPERATOR_UPDATE' });
    } else {
      const event = scenario.events.find((e) => e.id === 'JIN_IMPACT_RESULT')!;
      const action = scenario.actions.find((a) => a.id === rule.actionId)!;
      action.delegation!.eventId = sourceId;
      for (const effect of action.effects)
        if (effect.type === 'schedule_event' && effect.eventId === event.id)
          effect.eventId = sourceId;
      event.id = sourceId;
      rule.result.delivery = { kind: 'timer', eventId: sourceId };
    }
    expect(validateScenarioObject(scenario).success).toBe(true);
    const catalog = new Map([[scenarioVersionKey(scenario.id, scenario.contentVersion), scenario]]);
    const result = validateCampaignDefinition(d, catalog);
    expect(result.ok ? [] : result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_BEHAVIOR_REFERENCE',
          path: expect.stringContaining('ambiguousResultSource'),
        }),
      ]),
    );
  });
  it.each(['multiple-schedulers', 'source-id-collision'] as const)(
    'diagnoses ambiguous timer provenance: %s',
    (kind) => {
      const { d, m } = supported();
      const scenario = structuredClone(inc001Scenario);
      const action = scenario.actions.find((a) => a.id === 'OPEN_METRICS')!;
      if (kind === 'multiple-schedulers')
        action.effects.push({ type: 'schedule_event', eventId: 'JIN_IMPACT_RESULT' });
      else {
        m.actions.find((a) => a.actionId === action.id)!.actionId = 'JIN_IMPACT_RESULT';
        action.id = 'JIN_IMPACT_RESULT';
      }
      const catalog = new Map([
        [scenarioVersionKey(scenario.id, scenario.contentVersion), scenario],
      ]);
      const result = validateCampaignDefinition(d, catalog);
      expect(result.ok ? [] : result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_BEHAVIOR_REFERENCE',
            path: expect.stringContaining(
              kind === 'multiple-schedulers' ? 'timerOrigin' : 'ambiguousResultSource',
            ),
          }),
        ]),
      );
    },
  );
  it.each([
    [
      'unknown formula',
      (d: ReturnType<typeof behaviorCampaignFixture>) => {
        Object.assign(d.behavior!, { formulaVersion: 2 });
      },
    ],
    [
      'missing coverage',
      (d: ReturnType<typeof behaviorCampaignFixture>) => {
        d.behavior!.scenarios = [];
      },
    ],
  ])('rejects %s without runtime fallback', (_, modify) => {
    const d = behaviorCampaignFixture();
    modify(d);
    expect(validateCampaignDefinition(d, campaignCatalog).ok).toBe(false);
  });
  it.each([
    'missing-action',
    'unknown-action',
    'duplicate-action',
    'bad-subset',
    'unknown-reference',
    'bad-reference-type',
    'bad-reference-version',
    'missing-rule',
    'missing-freshness',
    'bad-support-key',
    'conflicting-key',
    'pending-as-result',
    'invalid-result',
    'unknown-timer',
  ])('rejects %s rather than guessing or clamping', (kind) => {
    const { d, m } = supported();
    if (kind === 'missing-action') m.actions.pop();
    if (kind === 'unknown-action') m.actions[0]!.actionId = 'not-a-scenario-action';
    if (kind === 'duplicate-action') m.actions.push(m.actions[0]!);
    if (kind === 'bad-subset') m.actions[0]!.restart = true;
    if (kind === 'unknown-reference')
      m.supportRules[0]!.freshness = {
        type: 'compare',
        reference: 'unknown',
        operator: 'lt',
        expected: 1,
      };
    if (kind === 'bad-reference-type') m.references[0]!.valueType = 'string';
    if (kind === 'bad-reference-version') m.references[0]!.version = 'newest';
    if (kind === 'missing-rule') m.supportRules = [];
    if (kind === 'missing-freshness') Reflect.deleteProperty(m.supportRules[0]!, 'freshness');
    if (kind === 'bad-support-key') m.supportRules[0]!.investigationKeys = ['unknown'];
    if (kind === 'conflicting-key') m.investigations[1]!.key = 'logs';
    if (kind === 'pending-as-result') m.investigations[2]!.result = { kind: 'action_completed' };
    if (kind === 'invalid-result')
      m.investigations[1]!.result = {
        kind: 'signal_revealed',
        signalId: 'DB_CPU',
        delivery: { kind: 'action' },
      };
    if (kind === 'unknown-timer')
      m.investigations[2]!.result = {
        kind: 'war_room_message',
        messageId: 'JIN_IMPACT_REPORT',
        delivery: { kind: 'timer', eventId: 'unknown' },
      };
    expect(validateCampaignDefinition(d, campaignCatalog).ok).toBe(false);
  });
});

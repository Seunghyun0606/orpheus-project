import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { IDBFactory } from 'fake-indexeddb';
import { getCampaignPrediction } from '../engine/player-model/prediction.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  getCampaignBranches,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import {
  validateCampaignDefinition,
  parseCampaignYaml,
  type CampaignDefinition,
} from '../scenario/campaign.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { validateScenarioObject } from '../scenario/validator.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { encodeSave } from '../persistence/save.ts';
import { replayCommands } from '../engine/simulation.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';
import { predictionCampaignFixture, elapsed } from './fixtures/prediction.ts';

function setup(d = predictionCampaignFixture(), catalog = campaignCatalog) {
  const op = (
    prior: CampaignRun | null,
    payload: Parameters<typeof operation>[1],
  ): CampaignOperation => ({
    ...operation(prior, payload),
    definitionId: d.id,
    definitionVersion: d.version,
  });
  const apply = (prior: CampaignRun | null, input: CampaignOperation) => {
    const result = prepareCampaignOperation(d, catalog, prior, input);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.run;
  };
  const create = () => apply(null, op(null, { kind: 'create' }));
  const start = (prior = create(), name = 'attempt', contentVersion?: string) =>
    apply(
      prior,
      op(prior, {
        kind: 'start',
        attemptId: name,
        incidentId: 'stage-one',
        seed: 17,
        ...(contentVersion ? { contentVersion } : {}),
      }),
    );
  const command = (run: CampaignRun, actionId: string) => {
    const attempt = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    return op(run, {
      kind: 'command',
      attemptId: attempt.id,
      inputId: 'input-' + run.revision,
      commandSequence: attempt.incident.replayLog.length,
      priorHead: campaignAttemptHead(attempt),
      command: { type: 'perform_action', actionId },
    });
  };
  const act = (prior: CampaignRun, actionId: string) => apply(prior, command(prior, actionId));
  const actions = (run: CampaignRun, ids: string[]) => ids.reduce(act, run);
  const predict = (run: CampaignRun) =>
    getCampaignPrediction(d, catalog, run, { contextId: 'pressure' });
  return { d, catalog, op, apply, create, start, command, act, actions, predict };
}
function mapping(d: CampaignDefinition) {
  const m = d.prediction!.scenarios[0]!;
  if (m.coverage !== 'supported') throw new Error('fixture mapping');
  return m;
}
function result(run: ReturnType<typeof getCampaignPrediction>) {
  if (!run.ok) throw new Error(JSON.stringify(run.diagnostics));
  return run.result;
}
function save(ids: string[]) {
  const replay = replayCommands(
    inc001Scenario,
    { seed: 17 },
    ids.map((actionId) => ({ type: 'perform_action', actionId })),
  );
  if (!replay.ok) throw new Error('fixture replay');
  return encodeSave(inc001Scenario, 17, replay.state);
}

describe('new-definition-only empirical campaign prediction', () => {
  it('round-trips strict authored YAML without changing model-less records', () => {
    const s = setup();
    expect(parseCampaignYaml(stringify(s.d), s.catalog)).toEqual({ ok: true, definition: s.d });
    const old = setup(campaignFixture());
    const run = old.start();
    expect(Object.hasOwn(run, 'prediction')).toBe(false);
    expect(Object.hasOwn(run, 'behavior')).toBe(false);
    expect(old.predict(run)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'NO_PINNED_PREDICTION_MODEL' }],
    });
    expect(getCampaignBranches(old.d, old.catalog, run)).toMatchObject({ ok: true, branches: [] });
    expect(getCampaignPrediction(s.d, s.catalog, run, { contextId: 'pressure' }).ok).toBe(false);
    expect(replayCampaign(old.d, old.catalog, run.operations)).toMatchObject({ ok: true, run });
  });
  it('uses pooled raw counts, keeps causal source contexts, and updates only subsequent calculations', () => {
    const s = setup();
    let run = s.actions(s.start(), ['RESTART_API', 'RESTART_API', 'RESTART_API', 'ROLLBACK']);
    const bytes = canonicalJson(run);
    const before = result(s.predict(run));
    expect(before).toMatchObject({
      kind: 'predicted',
      candidateId: 'restart',
      confidence: 3 / 4,
      eligibleTotal: 4,
    });
    expect(before).toEqual(result(s.predict(run)));
    if (before.kind !== 'predicted') throw new Error('fixture prediction');
    expect(before.samples[0]).toMatchObject({
      runId: run.runId,
      attemptId: 'attempt',
      inputId: 'input-1',
      operationSequence: 2,
      preHistoryBoundary: 1,
      commandSequence: 0,
    });
    expect(before.samples.every((s) => s.preHistoryBoundary < s.operationSequence)).toBe(true);
    expect(before.boundary).toMatchObject({
      historyBoundary: run.revision,
      modelVersion: 'empirical-v1',
      classificationVersion: 'contexts-v1',
      formulaVersion: 1,
    });
    run = s.act(run, 'ROLLBACK');
    expect(s.predict(run)).toMatchObject({
      ok: true,
      result: { kind: 'predicted', confidence: 3 / 5, eligibleTotal: 5 },
    });
    expect(before.confidence).toBe(3 / 4);
    expect(canonicalJson(replayCampaign(s.d, s.catalog, JSON.parse(bytes).operations))).toBe(
      canonicalJson({ ok: true, disposition: 'candidate', run: JSON.parse(bytes) }),
    );
    expect(run.behavior!.metrics.predictionDeviation).toMatchObject({
      status: 'unavailable',
      reason: 'NO_RECORDED_OPPORTUNITIES',
    });
  });
  it.each([
    [[], 1, 'EMPTY_HISTORY'],
    [['RESTART_API'], 2, 'INSUFFICIENT_SUPPORT'],
    [['RESTART_API', 'ROLLBACK'], 1, 'TOP_TIE'],
  ] as const)('returns honest UNKNOWN for %s with authored support %s', (ids, min, reason) => {
    const d = predictionCampaignFixture();
    d.prediction!.contexts[0]!.minimumSamples = min;
    const s = setup(d);
    expect(s.predict(s.actions(s.start(), [...ids]))).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason },
    });
  });
  it('does not let a tie below the unique top override empirical selection', () => {
    const s = setup();
    expect(
      s.predict(s.actions(s.start(), ['RESTART_API', 'RESTART_API', 'ROLLBACK', 'SCALE_API'])),
    ).toMatchObject({
      ok: true,
      result: { kind: 'predicted', confidence: 1 / 2, candidateId: 'restart' },
    });
  });
  it('can raise confidence after a matching action without scripted decline or changing prior output', () => {
    const s = setup();
    const run = s.actions(s.start(), ['RESTART_API', 'RESTART_API', 'RESTART_API', 'ROLLBACK']);
    const before = result(s.predict(run));
    expect(before).toMatchObject({ kind: 'predicted', confidence: 3 / 4 });
    expect(s.predict(s.act(run, 'RESTART_API'))).toMatchObject({
      ok: true,
      result: { confidence: 4 / 5 },
    });
    expect(before).toMatchObject({ confidence: 3 / 4 });
  });
  it('pools genuine abandoned attempts and excludes UI starts, duplicate and rejected inputs', () => {
    const s = setup();
    let run = s.actions(s.start(), ['RESTART_API', 'ROLLBACK']);
    run = s.start(run, 'retry');
    run = s.actions(run, ['RESTART_API', ...Array<string>(9).fill('SCALE_API')]);
    const prior = canonicalJson(run);
    const last = run.operations.at(-1)!;
    expect(prepareCampaignOperation(s.d, s.catalog, run, last)).toMatchObject({
      ok: true,
      disposition: 'duplicate',
      run,
    });
    expect(prepareCampaignOperation(s.d, s.catalog, run, s.command(run, 'NOT_AN_ACTION')).ok).toBe(
      false,
    );
    expect(s.predict(run)).toMatchObject({
      ok: true,
      result: {
        kind: 'predicted',
        candidateId: 'scale',
        confidence: 9 / 12,
        eligibleTotal: 12,
        counts: [
          { candidateId: 'restart', count: 2 },
          { candidateId: 'rollback', count: 1 },
          { candidateId: 'scale', count: 9 },
        ],
      },
    });
    expect(canonicalJson(run)).toBe(prior);
    expect(s.predict(s.start(s.create()))).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason: 'EMPTY_HISTORY' },
    });
  });
  it('filters currently unavailable candidates out of both winning counts and denominator', () => {
    const d = predictionCampaignFixture();
    const m = mapping(d);
    m.contexts[0]!.choices[0]!.eligible = {
      type: 'compare',
      reference: 'elapsed',
      operator: 'lt',
      expected: 200,
    };
    const s = setup(d);
    const run = s.actions(s.start(), ['RESTART_API', 'RESTART_API', 'RESTART_API', 'ROLLBACK']);
    expect(s.predict(run)).toMatchObject({
      ok: true,
      result: { kind: 'predicted', candidateId: 'rollback', confidence: 1, eligibleTotal: 1 },
    });
  });
  it('uses real engine action locks/requirements in addition to authored eligibility', () => {
    const d = predictionCampaignFixture();
    d.prediction!.contexts[0]!.candidates = ['terminate'];
    mapping(d).contexts[0]!.choices = [
      { actionId: 'TERMINATE_STALE_SESSIONS', candidateId: 'terminate', eligible: elapsed },
    ];
    const s = setup(d);
    expect(s.predict(s.start())).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason: 'EMPTY_CANDIDATES' },
    });
    expect(s.predict(s.actions(s.start(), ['INSPECT_DB', 'INSPECT_SESSIONS']))).toMatchObject({
      ok: true,
      result: {
        kind: 'unknown',
        reason: 'EMPTY_HISTORY',
        availableCandidates: [{ candidateId: 'terminate' }],
      },
    });
  });
  it('does not promote future action results into a historical comparable context', () => {
    const d = predictionCampaignFixture();
    const rules = mapping(d).contexts[0]!;
    d.prediction!.contexts[0]!.candidates = ['inspect', 'restart'];
    rules.when = { type: 'compare', reference: 'sessions', operator: 'eq', expected: true };
    rules.choices = [
      { actionId: 'INSPECT_SESSIONS', candidateId: 'inspect', eligible: elapsed },
      { actionId: 'RESTART_API', candidateId: 'restart', eligible: elapsed },
    ];
    const s = setup(d);
    const run = s.actions(s.start(), ['INSPECT_DB', 'INSPECT_SESSIONS']);
    expect(s.predict(run)).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason: 'EMPTY_HISTORY' },
    });
    const later = result(s.predict(s.act(run, 'INSPECT_SESSIONS')));
    expect(later).toMatchObject({ kind: 'predicted', candidateId: 'inspect', eligibleTotal: 1 });
    if (later.kind === 'gated') throw new Error('fixture gate');
    expect(later.samples[0]!.observations.sessions).toEqual({ status: 'available', value: true });
  });
  it('does not use inherited checkpoint commands or imported discovery snapshots as choices', () => {
    const s = setup();
    let prior = s.create();
    const bytes = save(['RESTART_API', 'ROLLBACK']);
    prior = s.apply(
      prior,
      s.op(prior, {
        kind: 'checkpoint',
        attemptId: 'baseline',
        incidentId: 'stage-one',
        sourceBytes: bytes,
        confirmed: true,
      }),
    );
    expect(s.predict(prior)).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason: 'EMPTY_HISTORY' },
    });
    expect(s.predict(s.act(prior, 'RESTART_API'))).toMatchObject({
      ok: true,
      result: { kind: 'predicted', eligibleTotal: 1, samples: [{ commandSequence: 2 }] },
    });
    const created = s.create();
    const adopted = s.apply(
      created,
      s.op(created, {
        kind: 'adopt',
        sourceBytes: [
          save(['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS']),
        ],
        confirmed: true,
      }),
    );
    expect(s.predict(s.start(adopted))).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason: 'EMPTY_HISTORY' },
    });
  });
  it('gates prediction before the authored reveal without emitting counts or deviation samples', () => {
    const d = predictionCampaignFixture();
    mapping(d).contexts[0]!.reveal = {
      type: 'compare',
      reference: 'act',
      operator: 'gte',
      expected: 8,
    };
    const s = setup(d);
    const run = s.act(s.start(), 'RESTART_API');
    const before = canonicalJson(run);
    const hidden = result(s.predict(run));
    expect(hidden.kind).toBe('gated');
    for (const key of ['confidence', 'counts', 'samples', 'candidateId', 'observations'])
      expect(Object.hasOwn(hidden, key)).toBe(false);
    expect(canonicalJson(run)).toBe(before);
    expect(run.behavior!.metrics.predictionDeviation.status).toBe('unavailable');
  });
  it('diagnoses unavailable required observations even under a decisive true sibling', () => {
    const d = predictionCampaignFixture();
    mapping(d).contexts[0]!.when = {
      type: 'any',
      children: [elapsed, { type: 'compare', reference: 'metric', operator: 'gte', expected: 0 }],
    };
    const s = setup(d);
    expect(s.predict(s.start())).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION' }],
    });
  });
  it('diagnoses unavailable historical context rather than dropping it after the metric becomes available', () => {
    const d = predictionCampaignFixture();
    mapping(d).contexts[0]!.when = {
      type: 'any',
      children: [elapsed, { type: 'compare', reference: 'metric', operator: 'gte', expected: 0 }],
    };
    const s = setup(d);
    expect(s.predict(s.act(s.start(), 'RESTART_API'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: 'op-2.metric' }],
    });
  });
  it('reports an inapplicable context as a diagnostic, not UNKNOWN or a fabricated zero', () => {
    const d = predictionCampaignFixture();
    mapping(d).contexts[0]!.when = {
      type: 'compare',
      reference: 'elapsed',
      operator: 'lt',
      expected: 0,
    };
    const s = setup(d);
    expect(s.predict(s.start())).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'INAPPLICABLE_PREDICTION_CONTEXT' }],
    });
  });
  it('preserves old authorities, rejects altered versions and forged projections', () => {
    const s = setup();
    const run = s.act(s.start(), 'RESTART_API');
    for (const modify of [
      (d: CampaignDefinition) => {
        d.prediction!.classificationVersion = 'other';
      },
      (d: CampaignDefinition) => {
        d.prediction!.contexts[0]!.minimumSamples = 9;
      },
    ]) {
      const d = structuredClone(s.d);
      modify(d);
      expect(getCampaignPrediction(d, s.catalog, run, { contextId: 'pressure' }).ok).toBe(false);
    }
    const forged = structuredClone(run);
    forged.projection.act = 8;
    expect(s.predict(forged).ok).toBe(false);
    expect(getCampaignPrediction(s.d, s.catalog, run, { contextId: 'unknown' })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNKNOWN_PREDICTION_CONTEXT' }],
    });
    expect(
      getCampaignPrediction(s.d, s.catalog, run, { contextId: 'pressure', version: 'latest' }).ok,
    ).toBe(false);
  });
  it('requires explicit exact-version mappings for cross-version choice comparability', () => {
    const d = predictionCampaignFixture();
    const scenario = structuredClone(inc001Scenario);
    scenario.contentVersion = '1.1.1-prediction-fixture';
    const catalog = new Map(campaignCatalog);
    catalog.set(scenarioVersionKey(scenario.id, scenario.contentVersion), scenario);
    d.incidents[0]!.compatibleContentVersions = [scenario.contentVersion];
    expect(validateCampaignDefinition(d, catalog).ok).toBe(false);
    const prediction = structuredClone(mapping(d));
    prediction.contentVersion = scenario.contentVersion;
    d.prediction!.scenarios.push(prediction);
    const behavior = structuredClone(d.behavior!.scenarios[0]!);
    behavior.contentVersion = scenario.contentVersion;
    d.behavior!.scenarios.push(behavior);
    expect(validateCampaignDefinition(d, catalog).ok).toBe(true);
    const s = setup(d, catalog);
    const run = s.act(
      s.start(s.act(s.start(), 'RESTART_API'), 'compatible', scenario.contentVersion),
      'ROLLBACK',
    );
    expect(s.predict(run)).toMatchObject({
      ok: true,
      result: { kind: 'unknown', reason: 'TOP_TIE', eligibleTotal: 2 },
    });
  });
  it('pools explicitly equivalent candidates even when a compatible version changes the action ID', () => {
    const d = predictionCampaignFixture();
    const scenario = structuredClone(inc001Scenario);
    scenario.contentVersion = '1.1.1-renamed-fixture';
    scenario.actions.find((a) => a.id === 'RESTART_API')!.id = 'RESTART_WORKER';
    for (const ref of scenario.postmortem.scoringInputs)
      if (ref.source === 'action_count' && ref.refId === 'RESTART_API')
        ref.refId = 'RESTART_WORKER';
    expect(validateScenarioObject(scenario).success).toBe(true);
    const catalog = new Map(campaignCatalog);
    catalog.set(scenarioVersionKey(scenario.id, scenario.contentVersion), scenario);
    d.incidents[0]!.compatibleContentVersions = [scenario.contentVersion];
    const prediction = structuredClone(mapping(d));
    prediction.contentVersion = scenario.contentVersion;
    prediction.contexts[0]!.choices.find((c) => c.actionId === 'RESTART_API')!.actionId =
      'RESTART_WORKER';
    d.prediction!.scenarios.push(prediction);
    const behavior = structuredClone(d.behavior!.scenarios[0]!);
    behavior.contentVersion = scenario.contentVersion;
    if (behavior.coverage !== 'supported') throw new Error('fixture');
    behavior.actions.find((a) => a.actionId === 'RESTART_API')!.actionId = 'RESTART_WORKER';
    const rule = behavior.supportRules.find((r) => r.actionId === 'RESTART_API')!;
    rule.actionId = 'RESTART_WORKER';
    rule.relevance = {
      type: 'compare',
      reference: 'action',
      operator: 'eq',
      expected: 'RESTART_WORKER',
    };
    d.behavior!.scenarios.push(behavior);
    const s = setup(d, catalog);
    const run = s.act(
      s.start(s.act(s.start(), 'RESTART_API'), 'compatible', scenario.contentVersion),
      'RESTART_WORKER',
    );
    expect(s.predict(run)).toMatchObject({
      ok: true,
      result: {
        kind: 'predicted',
        candidateId: 'restart',
        actionId: 'RESTART_WORKER',
        confidence: 1,
        eligibleTotal: 2,
      },
    });
  });
  it('diagnoses unsupported historical coverage instead of presenting a partial universal model', () => {
    const d = predictionCampaignFixture();
    const scenario = structuredClone(inc001Scenario);
    scenario.contentVersion = '1.1.1-unsupported-fixture';
    const catalog = new Map(campaignCatalog);
    catalog.set(scenarioVersionKey(scenario.id, scenario.contentVersion), scenario);
    d.incidents[0]!.compatibleContentVersions = [scenario.contentVersion];
    d.prediction!.scenarios.push({
      scenarioId: scenario.id,
      contentVersion: scenario.contentVersion,
      coverage: 'unsupported',
      reason: 'fixture',
    });
    d.behavior!.scenarios.push({
      scenarioId: scenario.id,
      contentVersion: scenario.contentVersion,
      coverage: 'unsupported',
      reason: 'fixture',
    });
    const s = setup(d, catalog);
    let run = s.start(s.create(), 'unsupported', scenario.contentVersion);
    run = s.act(run, 'RESTART_API');
    run = s.start(run, 'supported');
    expect(s.predict(run)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNSUPPORTED_PREDICTION_COVERAGE' }],
    });
  });
  it('reloads pure predictions from a committed ledger without a persisted prediction cache', async () => {
    const s = setup();
    const factory = new IDBFactory();
    const authorities = {
      definitions: new Map([[campaignDefinitionKey(s.d.id, s.d.version), s.d]]),
      scenarios: s.catalog,
    };
    const ledger = createCampaignLedger(authorities, () => factory);
    let run = s.create();
    const created = await ledger.commit({
      runId: run.runId,
      expectedRevision: null,
      operation: run.operations[0],
      candidate: run,
    });
    expect(created.ok).toBe(true);
    for (const next of [s.start(run), s.act(s.start(run), 'RESTART_API')]) {
      // Commit each operation separately; the second candidate includes the same start.
      const committed = await ledger.commit({
        runId: run.runId,
        expectedRevision: run.revision,
        operation: next.operations.at(-1),
        candidate: next,
      });
      expect(committed.ok).toBe(true);
      run = next;
    }
    const loaded = await createCampaignLedger(authorities, () => factory).read(run.runId);
    if (!loaded.ok || !loaded.run) throw new Error('fixture reload');
    expect(s.predict(loaded.run)).toEqual(s.predict(run));
    expect(Object.hasOwn(loaded.run, 'prediction')).toBe(false);
    const duplicate = await ledger.commit({
      runId: run.runId,
      expectedRevision: run.revision - 1,
      operation: run.operations.at(-1),
      candidate: run,
    });
    expect(duplicate).toMatchObject({ ok: true, disposition: 'duplicate' });
    expect(s.predict(run)).toMatchObject({ ok: true, result: { eligibleTotal: 1 } });
  });
});

describe('authored branch queries and strict prediction validation', () => {
  it('rejects malformed scenario authority with diagnostics rather than throwing during model validation', () => {
    const d = predictionCampaignFixture();
    const malformed = new Map(campaignCatalog);
    malformed.set(
      scenarioVersionKey(inc001Scenario.id, inc001Scenario.contentVersion),
      {} as typeof inc001Scenario,
    );
    expect(validateCampaignDefinition(d, malformed)).toMatchObject({ ok: false });
  });
  it('evaluates investigation/safety/reporting/dependency fixtures without granting effects', () => {
    const s = setup();
    const run = s.start();
    const before = canonicalJson(run);
    expect(getCampaignBranches(s.d, s.catalog, run)).toMatchObject({
      ok: true,
      branches: [
        { id: 'investigation', result: { value: false } },
        { id: 'safety', result: { value: false } },
        { id: 'reporting', result: { value: false } },
        { id: 'dependency', result: { value: false } },
      ],
    });
    expect(canonicalJson(run)).toBe(before);
    const d = predictionCampaignFixture();
    d.initial.values.operationalSafety = 2;
    d.initial.values.aiDependency = 2;
    d.initial.alignment.corporate = 2;
    d.initial.evidence = ['artifact'];
    const all = setup(d);
    const routes = getCampaignBranches(d, all.catalog, all.start());
    expect(
      routes.ok &&
        'branches' in routes &&
        routes.branches.every((b) => b.result.ok && b.result.value),
    ).toBe(true);
  });
  it('does not hide unavailable branch references behind an unmet reveal condition', () => {
    const d = predictionCampaignFixture();
    d.branches![0]!.eligibility = {
      type: 'compare',
      reference: 'metric',
      operator: 'gte',
      expected: 0,
    };
    d.branches![0]!.reveal = { type: 'compare', reference: 'act', operator: 'gte', expected: 8 };
    const s = setup(d);
    expect(getCampaignBranches(d, s.catalog, s.start())).toMatchObject({
      ok: true,
      branches: [
        { result: { ok: false, diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION' }] } },
        {},
        {},
        {},
      ],
    });
  });
  it('derives branch changes from actual discovery while retaining earlier read-only outcomes', () => {
    const s = setup();
    const run = s.start();
    const before = getCampaignBranches(s.d, s.catalog, run);
    const discovered = s.actions(run, [
      'OPEN_LOGS',
      'INSPECT_DB',
      'INSPECT_SESSIONS',
      'TERMINATE_STALE_SESSIONS',
    ]);
    expect(getCampaignBranches(s.d, s.catalog, discovered)).toMatchObject({
      ok: true,
      branches: [
        { result: { value: true } },
        { result: { value: false } },
        { result: { value: true } },
        { result: { value: false } },
      ],
    });
    expect(getCampaignBranches(s.d, s.catalog, run)).toEqual(before);
  });
  it.each([
    'duplicate-model-context',
    'missing-coverage',
    'unknown-candidate',
    'unknown-action',
    'duplicate-action',
    'duplicate-candidate',
    'unknown-context',
    'missing-context',
    'unknown-signal',
    'unknown-flag',
    'reference-type',
    'reference-version',
    'unknown-condition',
    'zero-support',
    'unknown-formula',
    'branch-version',
    'branch-reference',
    'unknown-evidence',
    'unknown-campaign-reference',
    'unknown-model-version',
    'duplicate-branch',
  ])('rejects %s rather than silently substituting data', (kind) => {
    const d = predictionCampaignFixture();
    const m = mapping(d);
    const c = m.contexts[0]!;
    if (kind === 'duplicate-model-context') d.prediction!.contexts.push(d.prediction!.contexts[0]!);
    if (kind === 'missing-coverage') d.prediction!.scenarios = [];
    if (kind === 'unknown-candidate') c.choices[0]!.candidateId = 'unknown';
    if (kind === 'unknown-action') c.choices[0]!.actionId = 'unknown';
    if (kind === 'duplicate-action') c.choices.push(c.choices[0]!);
    if (kind === 'duplicate-candidate') c.choices[1]!.candidateId = c.choices[0]!.candidateId;
    if (kind === 'unknown-context') c.contextId = 'unknown';
    if (kind === 'missing-context') m.contexts = [];
    if (kind === 'unknown-signal') {
      m.references[0]!.source = 'signal';
      m.references[0]!.key = 'unknown';
    }
    if (kind === 'unknown-flag') {
      m.references[0]!.source = 'flag';
      m.references[0]!.key = 'unknown';
    }
    if (kind === 'reference-type') m.references[0]!.valueType = 'boolean';
    if (kind === 'reference-version') m.references[0]!.version = 'latest';
    if (kind === 'unknown-condition')
      c.when = { type: 'compare', reference: 'unknown', operator: 'eq', expected: 1 };
    if (kind === 'zero-support') d.prediction!.contexts[0]!.minimumSamples = 0;
    if (kind === 'unknown-formula') Object.assign(d.prediction!, { formulaVersion: 2 });
    if (kind === 'branch-version') d.branches![0]!.version = 'latest';
    if (kind === 'branch-reference')
      d.branches![0]!.eligibility = {
        type: 'compare',
        reference: 'unknown',
        operator: 'eq',
        expected: true,
      };
    if (kind === 'unknown-evidence') {
      m.references[0]!.source = 'evidence';
      m.references[0]!.key = 'unknown';
      m.references[0]!.valueType = 'boolean';
    }
    if (kind === 'unknown-campaign-reference') {
      m.references[0]!.source = 'campaign';
      m.references[0]!.key = 'unknown';
    }
    if (kind === 'unknown-model-version') d.prediction!.version = 'latest';
    if (kind === 'duplicate-branch') d.branches!.push(d.branches![0]!);
    expect(validateScenarioObject(inc001Scenario).success).toBe(true);
    expect(validateCampaignDefinition(d, campaignCatalog).ok).toBe(false);
  });
});

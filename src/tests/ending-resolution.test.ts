// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { IDBFactory } from 'fake-indexeddb';
import { resolveCampaignEnding } from '../engine/campaign/endings.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  prepareCampaignOperation,
  replayCampaign,
  campaignAttemptHead,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import { parseCampaignYaml, validateCampaignDefinition } from '../scenario/campaign.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import { campaignFixture, campaignCatalog, operation } from './fixtures/campaign.ts';
import { endingFixture, endingCases, endingCompare } from './fixtures/endings.ts';
import { rootCauseResolutionReplay } from './fixtures/inc-001-replays.ts';
import { replayCommands } from '../engine/simulation.ts';
import { encodeSave } from '../persistence/save.ts';

function setup(f = endingFixture()) {
  const { d, catalog } = f;
  const op = (
    run: CampaignRun | null,
    payload: Parameters<typeof operation>[1],
  ): CampaignOperation => ({
    ...operation(run, payload),
    definitionId: d.id,
    definitionVersion: d.version,
  });
  const apply = (run: CampaignRun | null, input: CampaignOperation) => {
    const next = prepareCampaignOperation(d, catalog, run, input);
    if (!next.ok) throw new Error(JSON.stringify(next.diagnostics));
    return next.run;
  };
  const create = () => apply(null, op(null, { kind: 'create' }));
  const start = (run = create(), attemptId = 'final') =>
    apply(run, op(run, { kind: 'start', incidentId: 'stage-one', attemptId, seed: 1002 }));
  const act = (run: CampaignRun, actionId: string) => {
    const attempt = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    return apply(
      run,
      op(run, {
        kind: 'command',
        attemptId: attempt.id,
        inputId: 'input-' + run.revision,
        commandSequence: attempt.incident.replayLog.length,
        priorHead: campaignAttemptHead(attempt),
        command: { type: 'perform_action', actionId },
      }),
    );
  };
  const complete = (run: CampaignRun) =>
    rootCauseResolutionReplay.commands.reduce((r, c) => act(r, c.actionId), run);
  const request = (run: CampaignRun, attemptId = 'final') => ({
    attemptId,
    priorHead: campaignAttemptHead(run.attempts.find((a) => a.id === attemptId)!),
  });
  const resolve = (run: CampaignRun, attemptId = 'final') =>
    resolveCampaignEnding(d, catalog, run, request(run, attemptId));
  return { ...f, op, apply, create, start, act, complete, request, resolve };
}
function result(value: ReturnType<typeof resolveCampaignEnding>) {
  if (!value.ok) throw new Error(JSON.stringify(value.diagnostics));
  return value.result;
}

describe('new-definition-only authored ending resolution', () => {
  it.each([
    ['elapsedSeconds', 'current', 'number', 0, 'gte'],
    ['resource', 'CUSTOMER_IMPACT', 'number', 0, 'gte'],
    ['flag', 'ROOT_CAUSE_RESOLVED', 'boolean', true, 'eq'],
    ['evidence', 'CORRUPTED_LOG_ENTRY', 'boolean', true, 'eq'],
  ] as const)(
    'binds declared final %s observations from verified state',
    (source, key, valueType, expected, operator) => {
      const f = endingFixture();
      f.d.endings!.finals[0]!.references.push({
        id: 'final-observation',
        version: f.d.endings!.version,
        source,
        key,
        valueType,
      });
      f.d.endings!.entries[0]!.condition = endingCompare('final-observation', expected, operator);
      const s = setup(f);
      expect(result(s.resolve(s.complete(s.start())))).toMatchObject({
        kind: 'resolved',
        endingId: 'CONTINUITY',
      });
    },
  );
  it('new ending-enabled definitions can omit behavior when no metric is referenced', () => {
    const f = endingFixture();
    delete f.d.behavior;
    delete f.d.endings!.behaviorVersion;
    f.d.endings!.finals[0]!.references = f.d.endings!.finals[0]!.references.filter(
      (r) => r.id !== 'metric',
    );
    const s = setup(f);
    const run = s.complete(s.act(s.start(), endingCases[0].action));
    expect(Object.hasOwn(run, 'behavior')).toBe(false);
    expect(result(s.resolve(run))).toMatchObject({ kind: 'resolved', endingId: 'CONTINUITY' });
  });
  for (const c of endingCases) {
    it(c.id + ': positive is deterministic, replayable and read-only', () => {
      const s = setup();
      const run = s.complete(s.act(s.start(), c.action));
      const bytes = canonicalJson(run);
      const resolved = s.resolve(run);
      expect(result(resolved)).toMatchObject({
        kind: 'resolved',
        endingId: c.id,
        matched: [{ id: c.id, priorityRank: 10 }],
      });
      expect(result(resolved).finalActions.map((a) => a.actionId)).toContain(c.action);
      expect(s.resolve(run)).toEqual(resolved);
      const replay = replayCampaign(s.d, s.catalog, run.operations);
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(s.resolve(replay.run)).toEqual(resolved);
      expect(canonicalJson(run)).toBe(bytes);
      expect(run.projection.endingFlags).toEqual({ closed: false });
    });
    it(c.id + ': choice exclusion yields no match, never a fallback', () => {
      const s = setup();
      expect(result(s.resolve(s.complete(s.start())))).toMatchObject({
        kind: 'no-match',
        matched: [],
      });
    });
    it(c.id + ': authored numeric boundary is inclusive and excludes below threshold', () => {
      const build = (value: number) => {
        const f = endingFixture();
        if (c.metric === 'corporate' || c.metric === 'null')
          f.d.initial.alignment[c.metric] = value;
        else f.d.initial.values[c.metric] = value;
        const s = setup(f);
        return result(s.resolve(s.complete(s.act(s.start(), c.action))));
      };
      expect(build(5)).toMatchObject({ kind: 'resolved', endingId: c.id });
      expect(build(4.999)).toMatchObject({ kind: 'no-match' });
    });
  }
  it('round-trips authored YAML; absent endings leave old record authority and shape intact', () => {
    const f = endingFixture();
    expect(parseCampaignYaml(stringify(f.d), f.catalog)).toEqual({ ok: true, definition: f.d });
    const d = campaignFixture();
    const old = prepareCampaignOperation(
      d,
      campaignCatalog,
      null,
      operation(null, { kind: 'create' }),
    );
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    const bytes = canonicalJson(old.run);
    expect(
      resolveCampaignEnding(d, campaignCatalog, old.run, { attemptId: 'none', priorHead: 'none' }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'MISSING_ENDING_DEFINITION' }] });
    expect(canonicalJson(old.run)).toBe(bytes);
    expect(Object.hasOwn(JSON.parse(old.run.definitionAuthority), 'endings')).toBe(false);
  });
  it('preserves committed authority: changing conditions, ranks or model version cannot attach to a run', () => {
    const s = setup();
    const run = s.complete(s.act(s.start(), endingCases[0].action));
    for (const change of [
      (d: typeof s.d) => {
        d.endings!.entries[0]!.priorityRank++;
      },
      (d: typeof s.d) => {
        d.endings!.entries[0]!.condition = endingCompare('act', 1, 'gte');
      },
      (d: typeof s.d) => {
        d.endings!.version = 'later';
      },
    ]) {
      const d = structuredClone(s.d);
      change(d);
      expect(resolveCampaignEnding(d, s.catalog, run, s.request(run)).ok).toBe(false);
    }
  });
  it('unique preferred match resolves despite lower-ranked tie and independent of file order', () => {
    const f = endingFixture();
    f.d.endings!.entries.forEach((e, i) => {
      e.condition = endingCompare('complete', true);
      e.priorityRank = i === 3 ? 1 : 2;
    });
    const a = setup(f);
    const x = result(a.resolve(a.complete(a.start())));
    const reversed = structuredClone(f);
    reversed.d.endings!.entries.reverse();
    const b = setup(reversed);
    expect(result(b.resolve(b.complete(b.start())))).toEqual(x);
    expect(x).toMatchObject({ kind: 'resolved', endingId: 'SHUTDOWN', matched: expect.any(Array) });
  });
  it('top tie is ambiguous with no ending flag or alphabetic/file-order selection', () => {
    const s = setup();
    const run = s.complete(s.act(s.act(s.start(), endingCases[0].action), endingCases[1].action));
    expect(result(s.resolve(run))).toMatchObject({
      kind: 'ambiguous',
      topIds: ['CONTINUITY', 'LIBERATION'],
    });
    expect(run.projection.endingFlags).toEqual({ closed: false });
  });
  it('lower-priority unavailable condition and decisive siblings block another winner', () => {
    const f = endingFixture();
    f.d.references.push({
      id: 'deviation',
      version: f.d.version,
      source: 'metric',
      key: 'predictionDeviation',
      valueType: 'number',
      contexts: ['ending'],
    });
    f.d.endings!.finals[0]!.references.push({
      id: 'deviation',
      version: f.d.endings!.version,
      source: 'campaign',
      key: 'deviation',
      valueType: 'number',
    });
    f.d.endings!.entries[1]!.priorityRank = 100;
    f.d.endings!.entries[1]!.condition = {
      type: 'any',
      children: [endingCompare('complete', true), endingCompare('deviation', 0)],
    };
    const s = setup(f);
    expect(s.resolve(s.complete(s.act(s.start(), endingCases[0].action)))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: 'LIBERATION.deviation' }],
    });
  });
  it('an unmet final eligibility is diagnostic rather than valid no-match', () => {
    const f = endingFixture();
    f.d.endings!.finals[0]!.eligible = endingCompare('act', 10, 'gte');
    f.d.endings!.entries[0]!.condition = endingCompare('metric', 0);
    const s = setup(f);
    expect(s.resolve(s.complete(s.start()))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'INELIGIBLE_FINAL_CONTEXT' }],
    });
  });
  it('missing, stale, foreign, unfinished or tampered final context diagnoses', () => {
    const s = setup();
    const unfinished = s.start();
    const run = s.complete(unfinished);
    expect(s.resolve(unfinished)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'MISSING_FINAL_COMPLETION' }],
    });
    for (const request of [
      undefined,
      {},
      { ...s.request(run), attemptId: 'foreign' },
      s.request(unfinished),
      { ...s.request(run), finalActions: [] },
    ])
      expect(resolveCampaignEnding(s.d, s.catalog, run, request).ok).toBe(false);
    const bad = structuredClone(run);
    bad.attempts[0]!.incident.signals.API_ERROR_RATE!.value = 0;
    expect(s.resolve(bad)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'INVALID_PRIOR_RECORD' }],
    });
  });
  it('unsupported final incident and valid-but-unmet final narrative gate diagnose', () => {
    const f = endingFixture();
    f.d.endings!.finals[0]!.incidentId = 'stage-two';
    const s = setup(f);
    expect(s.resolve(s.complete(s.start()))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNSUPPORTED_FINAL_CONTEXT' }],
    });
  });
  it('checkpoint inherited final choices do not supply new final-action presence', () => {
    const s = setup();
    const commands = [
      { type: 'perform_action' as const, actionId: endingCases[0].action },
      ...rootCauseResolutionReplay.commands.slice(0, 3),
    ];
    const replay = replayCommands(s.scenario, { seed: 1002 }, commands);
    if (!replay.ok) throw new Error('checkpoint fixture');
    const sourceBytes = encodeSave(s.scenario, 1002, replay.state);
    let run = s.apply(
      s.create(),
      s.op(s.create(), {
        kind: 'checkpoint',
        incidentId: 'stage-one',
        attemptId: 'final',
        confirmed: true,
        sourceBytes,
      }),
    );
    run = s.act(run, 'TERMINATE_STALE_SESSIONS');
    expect(result(s.resolve(run))).toMatchObject({ kind: 'no-match' });
    expect(result(s.resolve(run)).finalActions.map((a) => a.actionId)).toEqual([
      'TERMINATE_STALE_SESSIONS',
    ]);
  });
  it('another attempt cannot supply the final action', () => {
    const s = setup();
    let run = s.act(s.start(undefined, 'earlier'), endingCases[0].action);
    run = s.complete(s.start(run));
    expect(result(s.resolve(run))).toMatchObject({ kind: 'no-match' });
  });
  it('explicit discovery import retains membership but supplies neither final action nor completion', () => {
    const s = setup();
    const source = replayCommands(s.scenario, { seed: 1002 }, [
      { type: 'perform_action', actionId: endingCases[0].action },
      ...rootCauseResolutionReplay.commands,
    ]);
    if (!source.ok) throw new Error('import fixture');
    const sourceBytes = encodeSave(s.scenario, 1002, source.state);
    const created = s.create();
    const adopted = s.apply(
      created,
      s.op(created, { kind: 'adopt', confirmed: true, sourceBytes: [sourceBytes] }),
    );
    expect(adopted.projection.evidence).toContain('artifact');
    expect(adopted.projection.completed).toEqual([]);
    expect(result(s.resolve(s.complete(s.start(adopted))))).toMatchObject({ kind: 'no-match' });
  });
  it('known zero behavior is available, unlike an unobserved opportunity-dependent metric', () => {
    const f = endingFixture();
    f.d.endings!.entries[0]!.condition = endingCompare('metric', 0);
    const s = setup(f);
    expect(result(s.resolve(s.complete(s.start())))).toMatchObject({
      kind: 'resolved',
      endingId: 'CONTINUITY',
    });
  });
  it('strict unavailable observations diagnose beneath false gate and false AND sibling', () => {
    const f = endingFixture();
    f.d.endings!.finals[0]!.eligible = endingCompare('act', 10, 'gte');
    f.d.references.push({
      id: 'deviation',
      version: f.d.version,
      source: 'metric',
      key: 'predictionDeviation',
      valueType: 'number',
      contexts: ['ending'],
    });
    f.d.endings!.finals[0]!.references.push({
      id: 'deviation',
      version: f.d.endings!.version,
      source: 'campaign',
      key: 'deviation',
      valueType: 'number',
    });
    f.d.endings!.entries[0]!.condition = {
      type: 'all',
      children: [endingCompare('act', 10, 'gte'), endingCompare('deviation', 0)],
    };
    const s = setup(f);
    expect(s.resolve(s.complete(s.start()))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: 'CONTINUITY.deviation' }],
    });
  });
  it('completed legacy checkpoint cannot become a final attempt', () => {
    const s = setup();
    const source = replayCommands(s.scenario, { seed: 1002 }, rootCauseResolutionReplay.commands);
    if (!source.ok) throw new Error('completed checkpoint fixture');
    const run = s.create();
    expect(
      prepareCampaignOperation(
        s.d,
        s.catalog,
        run,
        s.op(run, {
          kind: 'checkpoint',
          confirmed: true,
          incidentId: 'stage-one',
          attemptId: 'final',
          sourceBytes: encodeSave(s.scenario, 1002, source.state),
        }),
      ).ok,
    ).toBe(false);
  });
  it('supports arbitrary authored ending IDs rather than a hardcoded ten-case selector', () => {
    const f = endingFixture();
    f.d.endings!.entries[0]!.id = 'AUTHOR_TEST_ALTERNATIVE';
    const s = setup(f);
    expect(result(s.resolve(s.complete(s.act(s.start(), endingCases[0].action))))).toMatchObject({
      kind: 'resolved',
      endingId: 'AUTHOR_TEST_ALTERNATIVE',
    });
  });
  it('rejects executable, cyclic and malformed request/record inputs without executing getters', () => {
    const s = setup();
    const run = s.complete(s.start());
    let calls = 0;
    const executable = { ...run };
    Object.defineProperty(executable, 'operations', {
      enumerable: true,
      get: () => {
        calls++;
        return run.operations;
      },
    });
    expect(resolveCampaignEnding(s.d, s.catalog, executable, s.request(run)).ok).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const request of [cyclic, null, { attemptId: 'final', priorHead: NaN }])
      expect(resolveCampaignEnding(s.d, s.catalog, run, request).ok).toBe(false);
    expect(calls).toBe(0);
  });
  it('fake IndexedDB round-trip keeps the exact result and identity without a grant', async () => {
    const s = setup();
    const run = s.complete(s.act(s.start(), endingCases[9].action));
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(
      {
        definitions: new Map([[campaignDefinitionKey(s.d.id, s.d.version), s.d]]),
        scenarios: s.catalog,
      },
      () => factory,
    );
    let prior: CampaignRun | null = null;
    for (const op of run.operations) {
      const candidate = s.apply(prior, op);
      const write = await ledger.commit({
        runId: run.runId,
        expectedRevision: prior?.revision ?? null,
        operation: op,
        candidate,
      });
      expect(write.ok).toBe(true);
      prior = candidate;
    }
    const loaded = await ledger.read(run.runId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok && loaded.run) expect(s.resolve(loaded.run)).toEqual(s.resolve(run));
  });
  const invalid: [string, (d: ReturnType<typeof endingFixture>['d']) => void][] = [
    [
      'schema version',
      (d) => {
        (d.endings as unknown as { schemaVersion: number }).schemaVersion = 2;
      },
    ],
    [
      'ending version',
      (d) => {
        d.endings!.entries[0]!.version = 'unknown';
      },
    ],
    [
      'negative rank',
      (d) => {
        d.endings!.entries[0]!.priorityRank = -1;
      },
    ],
    [
      'fractional rank',
      (d) => {
        d.endings!.entries[0]!.priorityRank = 0.5;
      },
    ],
    [
      'duplicate ending',
      (d) => {
        d.endings!.entries.push(d.endings!.entries[0]!);
      },
    ],
    [
      'duplicate final',
      (d) => {
        d.endings!.finals.push(d.endings!.finals[0]!);
      },
    ],
    [
      'unknown action',
      (d) => {
        d.endings!.finals[0]!.references.find((r) => r.source === 'action')!.key = 'unknown';
      },
    ],
    [
      'unknown flag',
      (d) => {
        d.endings!.finals[0]!.references.push({
          id: 'flag',
          version: d.endings!.version,
          source: 'flag',
          valueType: 'boolean',
          key: 'unknown',
        });
      },
    ],
    [
      'unknown evidence',
      (d) => {
        d.references.find((r) => r.id === 'artifact')!.key = 'unknown';
      },
    ],
    [
      'unknown signal',
      (d) => {
        d.endings!.finals[0]!.references.find((r) => r.source === 'signal')!.key = 'unknown';
      },
    ],
    [
      'unknown metric model',
      (d) => {
        d.endings!.behaviorVersion = 'unknown';
      },
    ],
    [
      'missing metric model',
      (d) => {
        delete d.endings!.behaviorVersion;
      },
    ],
    [
      'unknown prediction model',
      (d) => {
        d.endings!.predictionVersion = 'unknown';
      },
    ],
    [
      'unknown content version',
      (d) => {
        d.endings!.finals[0]!.contentVersion = 'unknown';
      },
    ],
    [
      'unknown ending predicate',
      (d) => {
        d.endings!.entries[0]!.condition = endingCompare('unknown', true);
      },
    ],
    [
      'empty condition',
      (d) => {
        d.endings!.entries[0]!.condition = { type: 'all', children: [] };
      },
    ],
    [
      'mixed type',
      (d) => {
        d.endings!.entries[0]!.condition = endingCompare('act', true);
      },
    ],
    [
      'unknown reference version',
      (d) => {
        d.endings!.finals[0]!.references[0]!.version = 'unknown';
      },
    ],
  ];
  it.each(invalid)('rejects invalid %s before selection', (_name, change) => {
    const f = endingFixture();
    change(f.d);
    expect(validateCampaignDefinition(f.d, f.catalog).ok).toBe(false);
  });
});

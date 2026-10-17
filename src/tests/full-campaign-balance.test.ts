// @vitest-environment node
// Authored for deferred QA. Predicate contexts are unit inputs, NOT proof of
// genuine 26-Incident progression, ending reachability or native acceptance.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { campaignDefinitionSchema, type CampaignDefinition } from '../scenario/campaign.ts';
import { endingDefinitionSchema, endingReferences } from '../scenario/ending.ts';
import { scenarioSchema, type Scenario } from '../scenario/schema.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import {
  evaluateCampaignCondition,
  referenceSchema,
  validateConditionReferences,
  type Condition,
  type Observation,
} from '../engine/campaign/conditions.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import { campaignFixture } from './fixtures/campaign.ts';
import { fixtureOperation } from './fixtures/opportunities.ts';
import { rootCauseResolutionReplay } from './fixtures/inc-001-replays.ts';

const read = (path: string): unknown => parse(readFileSync(path, 'utf8'));
const binding = z
  .object({
    references: z.array(referenceSchema),
    logical_sources_replaced: z.array(z.string()),
    logical_effects_replacement: campaignDefinitionSchema.shape.effects,
    numeric_effects_fragment: campaignDefinitionSchema.shape.effects,
    exact_incident_versions: z.array(
      z.object({ incidentId: z.string(), contentVersion: z.string() }),
    ),
  })
  .passthrough()
  .parse(read('authoring/campaign-1.0/TASK-032.numeric-bindings.yaml'));
const endings = endingDefinitionSchema.parse(
  read('authoring/campaign-1.0/models/orpheus-full-campaign-endings.yaml'),
);
const final = endings.finals[0]!;
const registry = endingReferences(final);
const numeric = binding.numeric_effects_fragment;
const leaves = (condition: Condition): Extract<Condition, { type: 'compare' }>[] =>
  condition.type === 'compare'
    ? [condition]
    : condition.type === 'not'
      ? leaves(condition.child)
      : condition.children.flatMap(leaves);
const evaluate = (condition: Condition, observations: Record<string, Observation>) =>
  evaluateCampaignCondition(condition, registry, {
    definitionVersion: endings.version,
    kind: 'ending',
    runId: 'predicate-unit-only',
    boundary: 0,
    observations,
  });
function unitInputs(entry: (typeof endings.entries)[number]) {
  const observations: Record<string, Observation> = Object.fromEntries(
    final.references.map((ref) => [
      ref.id,
      {
        status: 'available',
        value: ref.valueType === 'boolean' ? false : ref.valueType === 'number' ? 0 : '',
      },
    ]),
  );
  for (const leaf of leaves(final.eligible))
    if (!leaf.reference.startsWith('FINAL_ACTION_'))
      observations[leaf.reference] = { status: 'available', value: leaf.expected };
  for (const leaf of leaves(entry.condition))
    observations[leaf.reference] = { status: 'available', value: leaf.expected };
  return observations;
}
function isolated(incidentId: string) {
  const scenario = scenarioSchema.parse(
    read('src/scenario/data/full-campaign/incidents/' + incidentId.toLowerCase() + '.yaml'),
  );
  const d: CampaignDefinition = campaignFixture();
  d.id = 'numeric-isolated-fixture-' + incidentId;
  d.version = '1.0.0';
  d.references = [
    {
      id: 'CURRENT_ACT',
      version: d.version,
      source: 'act',
      key: 'current',
      valueType: 'number',
      contexts: ['effect', 'progression'],
    },
  ];
  const always: Condition = {
    type: 'compare',
    reference: 'CURRENT_ACT',
    operator: 'gte',
    expected: 1,
  };
  d.acts = [{ id: 1, eligibility: always }];
  d.incidents = [
    {
      id: incidentId,
      scenarioId: scenario.id,
      contentVersion: scenario.contentVersion,
      act: 1,
      eligibility: always,
    },
  ];
  d.initial.narrativeFlags = {};
  d.initial.endingFlags = {};
  d.evidence = [];
  d.narratives = [];
  d.effects = numeric.filter((effect) => effect.trigger.incidentId === incidentId);
  const catalog = new Map<string, Scenario>([
    [scenarioVersionKey(scenario.id, scenario.contentVersion), scenario],
  ]);
  const apply = (run: CampaignRun | null, payload: Parameters<typeof fixtureOperation>[2]) => {
    const result = prepareCampaignOperation(d, catalog, run, fixtureOperation(d, run, payload));
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.run;
  };
  const start = (run: CampaignRun | null = null, attemptId = 'first') => {
    if (!run) run = apply(null, { kind: 'create' });
    return apply(run, { kind: 'start', incidentId, attemptId, seed: 1002 });
  };
  const act = (run: CampaignRun, actionId: string) => {
    const attempt = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    return apply(run, {
      kind: 'command',
      attemptId: attempt.id,
      inputId: 'input-' + run.revision,
      commandSequence: attempt.incident.replayLog.length,
      priorHead: campaignAttemptHead(attempt),
      command: { type: 'perform_action', actionId },
    });
  };
  return { d, catalog, start, act };
}

describe('DEC-057 explicit balance data (deferred)', () => {
  it('uses only exact new content versions and no ending grants or positive final-plan awards', () => {
    expect(binding.exact_incident_versions).toHaveLength(26);
    expect(binding.exact_incident_versions.slice(0, 3)).toEqual([
      { incidentId: 'INC-001', contentVersion: '1.1.0' },
      { incidentId: 'INC-002', contentVersion: '1.2.0' },
      { incidentId: 'INC-003', contentVersion: '1.2.0' },
    ]);
    const all = [...binding.logical_effects_replacement, ...numeric];
    expect(new Set(all.map((effect) => effect.id)).size).toBe(all.length);
    for (const effect of all) expect(effect.endingFlags).toEqual({});
    const terminal = numeric.filter((effect) => effect.trigger.incidentId === 'INC-026');
    expect(terminal).toHaveLength(10);
    for (const effect of terminal) {
      expect(effect.alignment).toEqual({});
      expect(Object.keys(effect.values)).toEqual(['collateralDamage']);
      expect(effect.condition).toEqual({
        type: 'compare',
        reference: 'CURRENT_ACT',
        operator: 'gte',
        expected: 1,
      });
    }
  });

  it('shares causal/temporary receipt identity across explicitly approved alternatives', () => {
    const groups = numeric.filter(
      (e) => e.id.endsWith('_CAUSAL_REPAIR') || e.id.endsWith('_TEMPORARY_EXPOSURE'),
    );
    expect(groups).toHaveLength(50);
    const queue = groups.find((e) => e.id === 'BALANCE_INC-003_CAUSAL_REPAIR')!;
    expect(queue.trigger.targetId).toBe('QUARANTINE_MESSAGE');
    expect(queue.additionalTriggers).toEqual([
      { contentVersion: '1.2.0', type: 'action_completed', targetId: 'ADD_DEAD_LETTER_RULE' },
    ]);
    const damage = numeric.filter(
      (e) => e.id.includes('_DAMAGE_') && e.trigger.incidentId !== 'INC-026',
    );
    expect(damage).toHaveLength(55);
    expect(numeric.filter((e) => e.id.endsWith('_COMPLETION'))).toHaveLength(25);
    expect(numeric.filter((e) => e.id.endsWith('_WAR_ROOM'))).toHaveLength(25);
    expect(numeric.filter((e) => e.id.endsWith('_DELIVERED_DIAGNOSIS'))).toHaveLength(22);
  });

  it('preserves original discovery conditions and adds a shared false-to-true node guard', () => {
    const original = binding.logical_sources_replaced.flatMap(
      (file) =>
        z
          .object({ logical_effects_fragment: campaignDefinitionSchema.shape.effects })
          .passthrough()
          .parse(read('authoring/campaign-1.0/' + file)).logical_effects_fragment,
    );
    expect(binding.logical_effects_replacement).toHaveLength(original.length);
    const nodes = new Set<string>();
    for (const effect of binding.logical_effects_replacement) {
      const previous = original.find((e) => e.id === effect.id)!;
      expect(effect.trigger).toEqual(previous.trigger);
      expect(effect.narrativeFlags).toEqual(previous.narrativeFlags);
      const node = Object.keys(effect.narrativeFlags)[0]!;
      if (node === 'BLACKOUT_FINAL') {
        expect(effect).toEqual(previous);
        continue;
      }
      nodes.add(node);
      expect(effect.values).toMatchObject({ evidence: 1, curiosity: 1 });
      expect(effect.condition).toEqual({
        type: 'all',
        children: [
          previous.condition,
          { type: 'compare', reference: 'BALANCE_KNOWN_' + node, operator: 'eq', expected: false },
        ],
      });
    }
    expect(nodes.size).toBe(18);
    expect(
      binding.logical_effects_replacement.find((e) => e.id === 'SECURITY_NAME_DISCOVERY')!
        .condition,
    ).toMatchObject({
      type: 'all',
      children: [expect.anything(), { reference: 'BALANCE_KNOWN_NULL_NAME', expected: false }],
    });
  });

  it('credits only the four exact positive responses; no unobserved/negative dependency award', () => {
    const qualified = numeric.filter((e) => e.trigger.response !== undefined);
    expect(qualified.map((e) => e.trigger.response!.ruleId)).toEqual([
      'CARE_CAPACITY_RECOMMENDATION',
      'LOGISTICS_CAPACITY_RECOMMENDATION',
      'PUBLIC_ALLOCATION_RECOMMENDATION',
      'REGIONAL_CONTAINMENT_RECOMMENDATION',
    ]);
    for (const effect of qualified) {
      expect(effect.trigger.response!.positive).toBe(true);
      expect(effect.values).toEqual({ aiDependency: 1 });
    }
    expect(numeric.filter((e) => e.values.aiDependency !== undefined)).toEqual(qualified);
    const choices = numeric.filter((e) => e.id.includes('_CHOICE_'));
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map((e) => e.id)).size).toBe(4);
    for (const effect of choices) expect(effect.trigger.response).toBeUndefined();
  });

  it('keeps real Incident costs/history while bounded scores pay once across retries', () => {
    const f = isolated('INC-001');
    let run = f.start();
    run = f.act(run, 'UPDATE_WAR_ROOM');
    run = f.act(run, 'UPDATE_WAR_ROOM');
    run = f.act(run, 'RESTART_API');
    run = f.act(run, 'RESTART_API');
    expect(run.projection.values).toMatchObject({
      teamTrust: 1,
      operationalSafety: -1,
      collateralDamage: 1,
    });
    for (const command of rootCauseResolutionReplay.commands) run = f.act(run, command.actionId);
    expect(run.projection.alignment.corporate).toBe(1);
    expect(run.projection.values).toMatchObject({
      operationalSafety: 1,
      collateralDamage: 2,
      curiosity: 1,
      evidence: 0,
    });
    const score = structuredClone(run.projection);
    run = f.start(run, 'retry');
    run = f.act(run, 'UPDATE_WAR_ROOM');
    run = f.act(run, 'RESTART_API');
    for (const command of rootCauseResolutionReplay.commands) run = f.act(run, command.actionId);
    expect(run.projection).toEqual(score);
    expect(run.attempts).toHaveLength(2);
    expect(
      run.attempts[0]!.incident.replayLog.filter((c) => c.command.actionId === 'RESTART_API'),
    ).toHaveLength(2);
    expect(replayCampaign(f.d, f.catalog, run.operations)).toMatchObject({ ok: true, run });
  });

  it('retains distinct earlier terminal harm while final choice grants no positive requirements', () => {
    const f = isolated('INC-026');
    let run: CampaignRun | null = null;
    for (const [attemptId, action] of [
      ['continuity', 'RESTORE_CORE_CONTINUITY'],
      ['shutdown', 'DISABLE_BOTH_AUTHORITY_PATHS'],
      ['continuity-again', 'RESTORE_CORE_CONTINUITY'],
    ] as const) {
      run = f.start(run, attemptId);
      run = f.act(run, 'ASSESS_FINAL_SERVICE_STATE');
      run = f.act(run, 'ASSESS_FINAL_AUTHORITY_STATE');
      run = f.act(run, action);
      expect(run.attempts.at(-1)!.incident.completionReached).toBe(true);
    }
    expect(run!.projection.alignment).toEqual({ corporate: 0, null: 0 });
    expect(run!.projection.values).toMatchObject({
      collateralDamage: 9,
      evidence: 0,
      curiosity: 0,
      operationalSafety: 0,
      aiDependency: 0,
      teamTrust: 0,
    });
    expect(run!.effectReceipts).toHaveLength(2);
    expect(run!.attempts).toHaveLength(3);
    expect(replayCampaign(f.d, f.catalog, run!.operations)).toMatchObject({ ok: true, run });
  });
});

describe('DEC-057 ending predicates, not reachability certification (deferred)', () => {
  it('pins ten equal ranks and only the two supported operational metrics', () => {
    expect(endings).toMatchObject({
      id: 'orpheus-full-campaign-endings',
      version: '1.0.0',
      schemaVersion: 1,
      behaviorVersion: '1.0.0',
      predictionVersion: '1.0.0',
    });
    expect(endings.entries.map((entry) => entry.id)).toEqual([
      'CONTINUITY',
      'LIBERATION',
      'WHISTLEBLOWER',
      'SHUTDOWN',
      'CUSTODIAN',
      'NULL',
      'THE BOARD',
      'THE FIRE',
      'STATUS QUO',
      'REWRITE',
    ]);
    for (const entry of endings.entries) {
      expect(entry.priorityRank).toBe(100);
      expect(
        validateConditionReferences(entry.condition, registry, endings.version, 'ending'),
      ).toEqual([]);
    }
    expect(
      binding.references.filter((ref) => ref.source === 'metric').map((ref) => ref.key),
    ).toEqual(['evidenceBeforeActionRate', 'averageInvestigationDepth']);
    expect(
      leaves(final.eligible).filter((leaf) => leaf.reference.startsWith('ENDING_COMPLETED_')),
    ).toHaveLength(25);
  });

  it.each(endings.entries)(
    'matches $id only with its own final action and all its unit conditions',
    (entry) => {
      const observations = unitInputs(entry);
      expect(evaluate(final.eligible, observations)).toEqual({ ok: true, value: true });
      expect(evaluate(entry.condition, observations)).toEqual({ ok: true, value: true });
      for (const other of endings.entries.filter((e) => e.id !== entry.id))
        expect(evaluate(other.condition, observations)).toEqual({ ok: true, value: false });
      for (const leaf of leaves(entry.condition)) {
        const changed = structuredClone(observations);
        const value =
          typeof leaf.expected === 'number'
            ? leaf.expected + (leaf.operator === 'gte' ? -0.01 : 0.01)
            : typeof leaf.expected === 'boolean'
              ? !leaf.expected
              : 'NOT_' + leaf.expected;
        changed[leaf.reference] = { status: 'available', value };
        expect(evaluate(entry.condition, changed)).toEqual({ ok: true, value: false });
      }
    },
  );

  it('diagnoses missing samples even under a false final action and never converts them to zero', () => {
    const continuity = endings.entries.find((e) => e.id === 'CONTINUITY')!;
    const observations = unitInputs(endings.entries.find((e) => e.id === 'STATUS QUO')!);
    observations.ENDING_ACCUMULATED_evidenceBeforeActionRate = {
      status: 'unavailable',
      reason: 'no_samples',
    };
    expect(evaluate(continuity.condition, observations)).toMatchObject({ ok: false });
    observations.ENDING_ACCUMULATED_evidenceBeforeActionRate = { status: 'available', value: 0 };
    expect(evaluate(continuity.condition, observations)).toEqual({ ok: true, value: false });
  });

  it('rejects missing prior completion and mismatched final service despite a healthy header', () => {
    const continuity = endings.entries[0]!;
    const observations = unitInputs(continuity);
    observations['ENDING_COMPLETED_INC-025'] = { status: 'available', value: false };
    expect(evaluate(final.eligible, observations)).toEqual({ ok: true, value: false });
    observations.FINAL_HEALTH_ERROR_RATE = { status: 'available', value: 2 };
    expect(evaluate(continuity.condition, observations)).toEqual({ ok: true, value: false });
  });
});

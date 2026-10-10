import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../engine/campaign/canonical.ts';
import { replayCommands } from '../engine/simulation.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import { validateCampaignDefinition } from '../scenario/campaign.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';
import { rootCauseResolutionReplay } from './fixtures/inc-001-replays.ts';

// A synthetic immutable variant, never substituted into production/frozen content.
const variant = {
  ...inc001Scenario,
  contentVersion: '9.0.0-fixture',
  title: 'Compatible fixture',
};
const catalog = new Map(campaignCatalog).set(
  scenarioVersionKey(variant.id, variant.contentVersion),
  variant,
);
function fixture() {
  const definition = campaignFixture();
  definition.incidents[0]!.compatibleContentVersions = [variant.contentVersion];
  for (const effect of definition.effects) {
    const { type, targetId } = effect.trigger;
    effect.additionalTriggers = [
      {
        contentVersion: variant.contentVersion,
        type,
        ...(targetId === undefined ? {} : { targetId }),
      },
    ];
  }
  return definition;
}
function apply(run: CampaignRun | null, op: CampaignOperation, definition = fixture()) {
  const result = prepareCampaignOperation(definition, catalog, run, op);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.run;
}
function create(definition = fixture()) {
  return apply(null, operation(null, { kind: 'create' }), definition);
}
function begin(
  run: CampaignRun,
  attemptId: string,
  contentVersion?: string,
  definition = fixture(),
) {
  return apply(
    run,
    operation(run, {
      kind: 'start',
      attemptId,
      incidentId: 'stage-one',
      seed: 1002,
      ...(contentVersion === undefined ? {} : { contentVersion }),
    }),
    definition,
  );
}
function finish(run: CampaignRun, definition = fixture()) {
  for (const command of rootCauseResolutionReplay.commands) {
    const attempt = run.attempts.at(-1)!;
    run = apply(
      run,
      operation(run, {
        kind: 'command',
        attemptId: attempt.id,
        inputId: 'local-' + attempt.incident.replayLog.length,
        commandSequence: attempt.incident.replayLog.length,
        priorHead: campaignAttemptHead(attempt),
        command,
      }),
      definition,
    );
  }
  return run;
}
describe('explicit compatible campaign content and shared effects', () => {
  it('isolates alternate runs with equal seed, commands and local identities', () => {
    const first = finish(begin(create(), 'same-attempt'));
    const other = apply(null, { ...operation(null, { kind: 'create' }), runId: 'alternate-run' });
    const second = finish(begin(other, 'same-attempt'));
    expect(second.projection).toEqual(first.projection);
    expect(first.projection.values.curiosity).toBe(3);
    expect(second.effectReceipts).toHaveLength(2);
    expect(second.attempts[0]!.acceptedInputIds).toEqual(first.attempts[0]!.acceptedInputIds);
    expect(second.operations.map((op) => op.operationId)).toEqual(
      first.operations.map((op) => op.operationId),
    );
    const before = canonicalJson(second);
    expect(prepareCampaignOperation(fixture(), catalog, second, first.operations[2])).toMatchObject(
      { ok: false, diagnostics: [{ code: 'INCOMPATIBLE_AUTHORITY' }] },
    );
    expect(canonicalJson(second)).toBe(before);
    expect(replayCampaign(fixture(), catalog, second.operations)).toMatchObject({
      ok: true,
      run: second,
    });
  });
  it('uses the authored pre-command or post-event boundary for a newly revealed evidence predicate', () => {
    for (const boundary of ['pre_command', 'post_event'] as const) {
      const definition = fixture();
      definition.references.push({
        id: 'artifact-presence',
        version: definition.version,
        source: 'evidence',
        key: 'artifact',
        valueType: 'boolean',
        contexts: ['effect'],
      });
      definition.effects[0]!.boundary = boundary;
      definition.effects[0]!.condition = {
        type: 'compare',
        reference: 'artifact-presence',
        operator: 'eq',
        expected: true,
      };
      const run = finish(begin(create(definition), 'boundary', undefined, definition), definition);
      expect(run.projection.evidence).toEqual(['artifact']);
      expect(run.projection.values.curiosity).toBe(boundary === 'pre_command' ? 0 : 3);
      expect(run.effectReceipts.some((receipt) => receipt.effectId === 'discovery')).toBe(
        boundary === 'post_event',
      );
      expect(replayCampaign(definition, catalog, run.operations)).toMatchObject({ ok: true, run });
    }
  });
  it.each([false, true])(
    'retains both version histories and first receipts without reaward (reverse=%s)',
    (reverse) => {
      const versions = [inc001Scenario.contentVersion, variant.contentVersion];
      if (reverse) versions.reverse();
      const first = finish(begin(create(), 'first-version', versions[0]));
      const receipts = canonicalJson(first.effectReceipts);
      const second = finish(begin(first, 'second-version', versions[1]));
      expect(second.projection).toEqual(first.projection);
      expect(canonicalJson(second.effectReceipts)).toBe(receipts);
      expect(second.attempts.map((attempt) => attempt.incident.contentVersion)).toEqual(versions);
      expect(second.attempts.map((attempt) => attempt.acceptedInputIds.length)).toEqual([4, 4]);
      expect(second.attempts.every((attempt) => attempt.incident.completionReached)).toBe(true);
      expect(replayCampaign(fixture(), catalog, second.operations)).toMatchObject({
        ok: true,
        run: second,
      });
    },
  );
  it('maps two newly emitted events in one command batch to one shared effect receipt', () => {
    const definition = fixture();
    definition.effects[0]!.additionalTriggers!.push({
      contentVersion: inc001Scenario.contentVersion,
      type: 'narrative_triggered',
      targetId: 'UNKNOWN_GOOD',
    });
    const started = begin(create(definition), 'dual', undefined, definition);
    const prefix = rootCauseResolutionReplay.commands.slice(0, 3);
    let prior = started;
    for (const command of prefix) {
      const attempt = prior.attempts.at(-1)!;
      prior = apply(
        prior,
        operation(prior, {
          kind: 'command',
          attemptId: attempt.id,
          inputId: 'prefix-' + attempt.incident.replayLog.length,
          commandSequence: attempt.incident.replayLog.length,
          priorHead: campaignAttemptHead(attempt),
          command,
        }),
        definition,
      );
    }
    const beforeEvents = prior.attempts[0]!.incident.eventLog.length;
    const attempt = prior.attempts[0]!;
    const run = apply(
      prior,
      operation(prior, {
        kind: 'command',
        attemptId: attempt.id,
        inputId: 'final',
        commandSequence: attempt.incident.replayLog.length,
        priorHead: campaignAttemptHead(attempt),
        command: rootCauseResolutionReplay.commands[3]!,
      }),
      definition,
    );
    const source = run.effectReceipts.find((receipt) => receipt.effectId === 'discovery')!;
    const commandEvents = run.attempts[0]!.incident.eventLog.slice(beforeEvents);
    expect(commandEvents.some((event) => event.type === 'evidence_revealed')).toBe(true);
    expect(commandEvents.some((event) => event.type === 'narrative_triggered')).toBe(true);
    expect(run.effectReceipts.filter((receipt) => receipt.effectId === 'discovery')).toHaveLength(
      1,
    );
    expect(run.projection.values.curiosity).toBe(3);
    expect(source.operationId).toBe(run.operations.at(-1)!.operationId);
    expect(replayCampaign(definition, catalog, run.operations)).toMatchObject({ ok: true, run });
  });
  it('restores an allowed variant exactly without importing baseline effects or reawarding existing receipts', () => {
    const first = finish(begin(create(), 'primary'));
    const receipts = canonicalJson(first.effectReceipts);
    const replay = replayCommands(
      variant,
      { seed: 1002 },
      rootCauseResolutionReplay.commands.slice(0, 3),
    );
    if (!replay.ok) throw new Error('Fixture replay failed');
    const bytes = JSON.stringify({
      schemaVersion: 1,
      scenarioId: variant.id,
      contentVersion: variant.contentVersion,
      seed: 1002,
      incident: replay.state,
    });
    const restored = apply(
      first,
      operation(first, {
        kind: 'checkpoint',
        attemptId: 'baseline',
        incidentId: 'stage-one',
        sourceBytes: bytes,
        confirmed: true,
      }),
    );
    expect(restored.attempts.at(-1)!.sourceBytes).toBe(bytes);
    expect(restored.attempts.at(-1)!.incident.contentVersion).toBe(variant.contentVersion);
    expect(restored.attempts.at(-1)!.baselineCommandCount).toBe(3);
    expect(restored.attempts.at(-1)!.acceptedInputIds).toEqual([]);
    expect(restored.projection).toEqual(first.projection);
    const head = restored.attempts.at(-1)!;
    const continued = apply(
      restored,
      operation(restored, {
        kind: 'command',
        attemptId: head.id,
        inputId: 'new-final',
        commandSequence: 3,
        priorHead: campaignAttemptHead(head),
        command: rootCauseResolutionReplay.commands[3]!,
      }),
    );
    expect(continued.attempts.at(-1)!.acceptedInputIds).toEqual(['new-final']);
    expect(canonicalJson(continued.effectReceipts)).toBe(receipts);
    expect(replayCampaign(fixture(), catalog, continued.operations)).toMatchObject({
      ok: true,
      run: continued,
    });
    expect(
      prepareCampaignOperation(
        campaignFixture(),
        catalog,
        create(campaignFixture()),
        operation(create(campaignFixture()), {
          kind: 'checkpoint',
          attemptId: 'undeclared',
          incidentId: 'stage-one',
          sourceBytes: bytes,
          confirmed: true,
        }),
      ).ok,
    ).toBe(false);
  });
  it('never infers compatibility from catalog presence and keeps omitted start versions pinned to primary', () => {
    const definition = campaignFixture();
    const run = create(definition);
    expect(
      prepareCampaignOperation(
        definition,
        catalog,
        run,
        operation(run, {
          kind: 'start',
          attemptId: 'undeclared',
          incidentId: 'stage-one',
          seed: 1002,
          contentVersion: variant.contentVersion,
        }),
      ).ok,
    ).toBe(false);
    const primary = begin(run, 'primary', undefined, definition);
    expect(primary.attempts[0]!.incident.contentVersion).toBe(inc001Scenario.contentVersion);
    expect(replayCampaign(definition, campaignCatalog, primary.operations)).toMatchObject({
      ok: true,
      run: primary,
    });
  });
  it('does not auto-apply unmapped primary effects to an allowed compatible version', () => {
    const definition = fixture();
    delete definition.effects[0]!.additionalTriggers;
    const run = finish(
      begin(create(definition), 'unmapped', variant.contentVersion, definition),
      definition,
    );
    expect(run.projection.evidence).toEqual(['artifact']);
    expect(run.projection.values.curiosity).toBe(0);
    expect(run.effectReceipts.map((receipt) => receipt.effectId)).toEqual(['completion']);
  });
  it('rejects missing/duplicate/unknown versions, unknown targets and per-version semantics overrides', () => {
    const invalid = [];
    let definition = fixture();
    definition.incidents[0]!.compatibleContentVersions = [inc001Scenario.contentVersion];
    invalid.push(definition);
    definition = fixture();
    definition.incidents[0]!.compatibleContentVersions = ['missing'];
    invalid.push(definition);
    definition = fixture();
    definition.effects[0]!.additionalTriggers![0]!.contentVersion = 'missing';
    invalid.push(definition);
    definition = fixture();
    definition.effects[0]!.additionalTriggers!.push(definition.effects[0]!.additionalTriggers![0]!);
    invalid.push(definition);
    definition = fixture();
    definition.effects[0]!.additionalTriggers![0]!.targetId = 'unknown';
    invalid.push(definition);
    definition = fixture();
    invalid.push({
      ...definition,
      effects: [
        {
          ...definition.effects[0],
          additionalTriggers: [
            { ...definition.effects[0]!.additionalTriggers![0], values: { curiosity: 99 } },
          ],
        },
      ],
    });
    for (const input of invalid) expect(validateCampaignDefinition(input, catalog).ok).toBe(false);
    expect(validateCampaignDefinition(fixture(), campaignCatalog).ok).toBe(false);
  });
  it('rejects changed definition or scenario authorities rather than reinterpret the prior receipt', () => {
    const run = finish(begin(create(), 'first'));
    const before = canonicalJson(run);
    const changed = fixture();
    changed.effects[0]!.values.curiosity = 99;
    const op = operation(run, {
      kind: 'start',
      attemptId: 'second',
      incidentId: 'stage-one',
      seed: 1002,
      contentVersion: variant.contentVersion,
    });
    expect(prepareCampaignOperation(changed, catalog, run, op).ok).toBe(false);
    const swapped = new Map(catalog).set(
      scenarioVersionKey(inc001Scenario.id, inc001Scenario.contentVersion),
      { ...inc001Scenario, title: 'changed' },
    );
    expect(prepareCampaignOperation(fixture(), swapped, run, op).ok).toBe(false);
    const forged = structuredClone(run);
    forged.effectReceipts[0]!.semantics = canonicalJson(changed.effects[0]);
    expect(prepareCampaignOperation(fixture(), catalog, forged, op).ok).toBe(false);
    expect(canonicalJson(run)).toBe(before);
  });
});

// Prepared for deferred QA. These fixtures are not production content/balance.
import { describe, expect, it } from 'vitest';
import { opportunityCampaignFixture, fixtureOperation } from './fixtures/opportunities.ts';
import { campaignCatalog, campaignFixture } from './fixtures/campaign.ts';
import { validateCampaignDefinition } from '../scenario/campaign.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { replayCommands } from '../engine/simulation.ts';
import { encodeSave } from '../persistence/save.ts';
import {
  prepareCampaignOperation,
  replayCampaign,
  campaignAttemptHead,
  getCampaignActionAvailability,
  checkCampaignSourceAdmission,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';

function fixture() {
  const d = opportunityCampaignFixture();
  d.version = 'action-guard-fixture-v2';
  for (const r of d.references) r.version = d.version;
  for (const b of d.branches!) b.version = d.version;
  const s = structuredClone([...campaignCatalog.values()][0]!);
  s.initialState.signals.push({ id: 'TEST_SECRET', value: 'TEST ONLY', revealed: false });
  s.evidence.push(
    { id: 'TEST_PRIOR_CLUE', title: 'Test prerequisite', description: 'Fixture only' },
    {
      id: 'TEST_SECRET_EVIDENCE',
      title: 'Test protected clue',
      description: 'Fixture only',
      sourceNarrativeId: 'TEST_SECRET_NARRATIVE',
    },
  );
  s.actions.push(
    {
      id: 'GATHER_TEST_CLUE',
      title: 'Fixture prerequisite investigation',
      category: 'INVESTIGATE',
      durationSeconds: 10,
      initiallyAvailable: true,
      requirements: [],
      costs: [],
      temporaryEffects: [],
      effects: [{ type: 'reveal_evidence', evidenceId: 'TEST_PRIOR_CLUE' }],
    },
    {
      id: 'READ_TEST_SECRET',
      title: 'Fixture protected investigation',
      category: 'INVESTIGATE',
      durationSeconds: 10,
      initiallyAvailable: true,
      requirements: [{ type: 'evidence', evidenceId: 'TEST_PRIOR_CLUE' }],
      costs: [],
      temporaryEffects: [],
      effects: [{ type: 'reveal_signal', signalId: 'TEST_SECRET' }],
    },
  );
  s.narratives.push({
    id: 'TEST_SECRET_NARRATIVE',
    title: 'Fixture protected narrative',
    body: 'TEST ONLY',
    conditions: [{ type: 'action_completed', actionId: 'READ_TEST_SECRET' }],
    effects: [{ type: 'reveal_evidence', evidenceId: 'TEST_SECRET_EVIDENCE' }],
  });
  const mapping = d.behavior!.scenarios[0]!;
  if (mapping.coverage !== 'supported') throw new Error('fixture coverage');
  for (const actionId of ['GATHER_TEST_CLUE', 'READ_TEST_SECRET'])
    mapping.actions.push({
      actionId,
      operational: false,
      restart: false,
      rollback: false,
      evidenceEligible: false,
    });
  d.evidence.push(
    { id: 'prior', scenarioId: s.id, evidenceId: 'TEST_PRIOR_CLUE' },
    { id: 'secret', scenarioId: s.id, evidenceId: 'TEST_SECRET_EVIDENCE' },
  );
  d.narratives.push({
    id: 'secret-narrative',
    scenarioId: s.id,
    narrativeId: 'TEST_SECRET_NARRATIVE',
  });
  d.references.push({
    id: 'prior-clue',
    version: d.version,
    valueType: 'boolean',
    source: 'evidence',
    key: 'prior',
    contexts: ['action'],
  });
  d.actionGates = d.incidents.map((i) => ({
    id: i.id + '-guard',
    incidentId: i.id,
    contentVersion: i.contentVersion,
    actionId: 'READ_TEST_SECRET',
    eligibility: { type: 'compare', reference: 'prior-clue', operator: 'eq', expected: true },
  }));
  const catalog = new Map([[scenarioVersionKey(s.id, s.contentVersion), s]]);
  type Payload = Parameters<typeof fixtureOperation>[2];
  const prepare = (run: CampaignRun | null, payload: Payload) =>
    prepareCampaignOperation(d, catalog, run, fixtureOperation(d, run, payload));
  const apply = (run: CampaignRun | null, payload: Payload) => {
    const r = prepare(run, payload);
    if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
    return r.run;
  };
  const start = () =>
    apply(apply(null, { kind: 'create' }), {
      kind: 'start',
      attemptId: 'attempt',
      incidentId: 'stage-one',
      seed: 1002,
    });
  const command = (run: CampaignRun, actionId: string) => {
    const a = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    return prepare(run, {
      kind: 'command',
      attemptId: a.id,
      inputId: 'input-' + run.revision,
      commandSequence: a.incident.replayLog.length,
      priorHead: campaignAttemptHead(a),
      command: { type: 'perform_action', actionId },
    });
  };
  const perform = (run: CampaignRun, actionId: string) => {
    const r = command(run, actionId);
    if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
    return r.run;
  };
  return { d, s, catalog, prepare, apply, start, command, perform };
}
describe('new-authority action gates — authored, not executed', () => {
  it('rejects protected commands before state/time/history changes', () => {
    const f = fixture(),
      run = f.start(),
      before = canonicalJson(run);
    const r = f.command(run, 'READ_TEST_SECRET');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.diagnostics.map((d) => d.code)).toContain('INELIGIBLE_CAMPAIGN_ACTION');
    expect(canonicalJson(run)).toBe(before);
    expect(run.attempts[0]!.incident.elapsedSeconds).toBe(0);
  });
  it('uses the same predicate for projection, accepted command and replay', () => {
    const f = fixture();
    let run = f.start();
    run = f.perform(run, 'GATHER_TEST_CLUE');
    const before = canonicalJson(run);
    const availability = getCampaignActionAvailability(f.d, f.catalog, run);
    expect(availability.ok && availability.actionIds).toContain('READ_TEST_SECRET');
    expect(canonicalJson(run)).toBe(before);
    run = f.perform(run, 'READ_TEST_SECRET');
    expect(run.projection.evidence).toContain('secret');
    const replay = replayCampaign(f.d, f.catalog, run.operations);
    expect(replay.ok && replay.run).toEqual(run);
  });
  it('diagnoses unavailable guard leaves even under a decisive Boolean sibling', () => {
    const f = fixture();
    f.d.references.find((r) => r.id === 'metric')!.contexts.push('action');
    f.d.references.find((r) => r.id === 'act')!.contexts.push('action');
    f.d.actionGates![0]!.eligibility = {
      type: 'any',
      children: [
        { type: 'compare', reference: 'act', operator: 'gte', expected: 0 },
        { type: 'compare', reference: 'metric', operator: 'eq', expected: 0 },
      ],
    };
    const run = f.perform(f.start(), 'GATHER_TEST_CLUE');
    const view = getCampaignActionAvailability(f.d, f.catalog, run);
    expect(view.diagnostics.map((d) => d.code)).toContain('UNAVAILABLE_OBSERVATION');
    expect(view.ok && view.actionIds.includes('READ_TEST_SECRET')).toBe(false);
    const r = f.command(run, 'READ_TEST_SECRET');
    expect(!r.ok && r.diagnostics.map((d) => d.code)).toContain('UNAVAILABLE_OBSERVATION');
  });
  it('validates duplicate/reference/version bindings and uncovered reused scenarios', () => {
    const f = fixture();
    expect(validateCampaignDefinition(f.d, f.catalog).ok).toBe(true);
    for (const mutate of [
      () => f.d.actionGates!.push(structuredClone(f.d.actionGates![0]!)),
      () => {
        f.d.actionGates![0]!.contentVersion = 'absent';
      },
      () => {
        f.d.actionGates!.pop();
      },
      () => {
        f.d.actionGates![0]!.eligibility = {
          type: 'compare',
          reference: 'absent',
          operator: 'eq',
          expected: true,
        };
      },
    ]) {
      const original = structuredClone(f.d.actionGates!);
      mutate();
      expect(validateCampaignDefinition(f.d, f.catalog).ok).toBe(false);
      f.d.actionGates = original;
    }
  });
  it('rejects initial, timer and condition-bypassing protected reveals', () => {
    const f = fixture();
    f.s.initialState.signals.find((s) => s.id === 'TEST_SECRET')!.revealed = true;
    expect(validateCampaignDefinition(f.d, f.catalog).ok).toBe(false);
    f.s.initialState.signals.find((s) => s.id === 'TEST_SECRET')!.revealed = false;
    f.s.events.push({
      id: 'LEAK',
      type: 'timer',
      delaySeconds: 1,
      cancellationConditions: [],
      effects: [{ type: 'reveal_signal', signalId: 'TEST_SECRET' }],
    });
    expect(validateCampaignDefinition(f.d, f.catalog).ok).toBe(false);
    f.s.events.pop();
    f.s.actions
      .find((a) => a.id === 'READ_TEST_SECRET')!
      .effects.push({ type: 'trigger_narrative', narrativeId: 'TEST_SECRET_NARRATIVE' });
    expect(validateCampaignDefinition(f.d, f.catalog).ok).toBe(false);
  });
  it('rejects an entire protected import batch despite local replay and current evidence', () => {
    const f = fixture();
    const run = f.perform(f.start(), 'GATHER_TEST_CLUE');
    const replay = replayCommands(
      f.s,
      { seed: 1002 },
      ['GATHER_TEST_CLUE', 'READ_TEST_SECRET'].map((actionId) => ({
        type: 'perform_action' as const,
        actionId,
      })),
    );
    if (!replay.ok) throw new Error('local fixture');
    const protectedBytes = encodeSave(f.s, 1002, replay.state);
    const safeBytes = encodeSave(f.s, 1002, run.attempts[0]!.incident);
    const before = canonicalJson(run);
    expect(checkCampaignSourceAdmission(f.d, f.catalog, run, protectedBytes).ok).toBe(false);
    const adopted = f.prepare(run, {
      kind: 'adopt',
      sourceBytes: [safeBytes, protectedBytes],
      confirmed: true,
    });
    expect(!adopted.ok && adopted.diagnostics.map((d) => d.code)).toContain(
      'UNPROVEN_PROTECTED_SOURCE',
    );
    const checkpoint = f.prepare(run, {
      kind: 'checkpoint',
      attemptId: 'foreign',
      incidentId: 'stage-one',
      sourceBytes: protectedBytes,
      confirmed: true,
    });
    expect(!checkpoint.ok && checkpoint.diagnostics.map((d) => d.code)).toContain(
      'UNPROVEN_PROTECTED_SOURCE',
    );
    expect(canonicalJson(run)).toBe(before);
  });
  it('accepts exact protected source bytes only after an official same-run association', () => {
    const f = fixture();
    let run = f.perform(f.start(), 'GATHER_TEST_CLUE');
    run = f.perform(run, 'READ_TEST_SECRET');
    const a = run.attempts[0]!,
      bytes = encodeSave(f.s, 1002, a.incident);
    run = f.apply(run, {
      kind: 'associate',
      attemptId: a.id,
      priorHead: campaignAttemptHead(a),
      sourceBytes: bytes,
    });
    expect(checkCampaignSourceAdmission(f.d, f.catalog, run, bytes).ok).toBe(true);
    const result = f.prepare(run, {
      kind: 'checkpoint',
      attemptId: 'restored',
      incidentId: 'stage-one',
      sourceBytes: bytes,
      confirmed: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.projection.evidence).toEqual(run.projection.evidence);
    expect(result.run.attempts.at(-1)!.acceptedInputIds).toEqual([]);
  });
  it('keeps definitions without guards free of implicit new fields', () => {
    const d = campaignFixture();
    const checked = validateCampaignDefinition(d, campaignCatalog);
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(canonicalJson(checked.definition)).toBe(canonicalJson(d));
  });
});

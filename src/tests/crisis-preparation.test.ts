// Deferred QA authoring. Regional preparation is not final completion or campaign admission.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';
import { validateVersionedScenarioCatalog } from '../scenario/catalog.ts';
import {
  investigationPresentationSchema,
  validateInvestigationPresentation,
} from '../scenario/presentation.ts';
import { validateActionGates } from '../scenario/action-gates.ts';
import { evaluateActionGate } from '../engine/campaign/action-gates.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import { behaviorDefinitionSchema, validateBehaviorDefinition } from '../scenario/behavior.ts';
import {
  predictionDefinitionSchema,
  validatePredictionDefinition,
} from '../scenario/prediction.ts';

const read = (path: string) => parse(readFileSync(path, 'utf8'));
const plan = read('src/tests/fixtures/crisis-preparation-replays.yaml');
const bindings = read('.project-os/planning/TASK-031.crisis-preparation-bindings.yaml');
function fixture() {
  const file = 'src/scenario/data/full-campaign/incidents/inc-025.yaml';
  const result = validateVersionedScenarioCatalog([{ file, source: readFileSync(file, 'utf8') }]);
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  const scenario = result.scenarios.get('INC-025@1.0.0')!;
  // Isolated structural guard authority only, not a complete v2 campaign.
  const d = {
    ...read('.project-os/planning/TASK-028.model-bindings.yaml').definition_header_fragment,
    references: [read('.project-os/planning/TASK-028.action-bindings.yaml').references[0]],
    initial: read('.project-os/planning/TASK-028.model-bindings.yaml').initial_fragment,
    acts: [],
    incidents: [
      { id: scenario.id, scenarioId: scenario.id, contentVersion: scenario.contentVersion, act: 9 },
    ],
    actionGates: bindings.actionGates,
    evidence: bindings.evidence_bindings_fragment,
    narratives: bindings.narrative_bindings_fragment,
    effects: [],
  } as CampaignDefinition;
  return { scenario, catalog: result.scenarios, d };
}
describe('TASK-031 crisis preparation — deferred QA', () => {
  it('declares explicit regional model rows without guidance or authority-receipt support', () => {
    const { scenario: s, catalog } = fixture();
    const rows = read('.project-os/planning/TASK-031.crisis-model-bindings.yaml');
    const root = '.project-os/planning/M5/models/';
    const behavior = behaviorDefinitionSchema.parse({
      ...read(root + 'orpheus-player-behavior.yaml'),
      scenarios: rows.behavior_scenarios,
    });
    const prediction = predictionDefinitionSchema.parse({
      ...read(root + 'orpheus-player-prediction.yaml'),
      scenarios: rows.prediction_scenarios,
    });
    const allowed = [{ scenarioId: s.id, contentVersion: s.contentVersion }];
    expect(validateBehaviorDefinition(behavior, allowed, catalog)).toEqual([]);
    expect(validatePredictionDefinition(prediction, allowed, catalog, [])).toEqual([]);
    const mapping = behavior.scenarios[0]!;
    if (mapping.coverage !== 'supported') throw new Error('Missing regional coverage');
    expect(mapping.supportRules.flatMap((r) => r.investigationKeys)).not.toContain(
      'INC-025/INSPECT_CURRENT_AUTHORITY_REQUESTS',
    );
    for (const row of prediction.scenarios) {
      if (row.coverage !== 'supported') throw new Error('Missing regional prediction coverage');
      for (const context of row.contexts)
        expect(context.reveal).toEqual({
          type: 'compare',
          reference: 'ELAPSED',
          operator: 'lt',
          expected: 0,
        });
    }
  });
  it('retains approved INC-025 identity, seven nodes and the Act-9-only current request boundary', () => {
    const { scenario: s, catalog, d } = fixture();
    expect(s).toMatchObject({ id: 'INC-025', title: 'Continuity Fracture', act: 9 });
    expect(s.services).toHaveLength(7);
    expect(validateActionGates(d, catalog)).toEqual([]);
    const p = investigationPresentationSchema.parse(
      read('src/scenario/data/full-campaign/presentations/inc-025.yaml'),
    );
    expect(validateInvestigationPresentation(p, s, d)).toEqual([]);
    for (const [act, expected] of [
      [8, false],
      [9, true],
    ] as const)
      expect(
        evaluateActionGate(d, s.id, s.contentVersion, 'INSPECT_CURRENT_AUTHORITY_REQUESTS', {
          kind: 'action',
          definitionVersion: d.version,
          runId: 'unit-preparation',
          boundary: 0,
          observations: { CURRENT_ACT: { status: 'available', value: act } },
        }),
      ).toMatchObject({ ok: true, value: expected });
  });
  it('recovers regionally through contrasting paths without choosing global authority or an ending', () => {
    const { scenario: s } = fixture();
    for (const path of [
      plan.recovery,
      plan.temporaryRecovery,
      plan.expirationRecovery,
      plan.delegationRecovery,
    ]) {
      const commands = path.map((actionId: string) => ({
        type: 'perform_action' as const,
        actionId,
      }));
      const result = replayCommands(s, { seed: plan.seed }, commands);
      expect(result).toEqual(replayCommands(s, { seed: plan.seed }, commands));
      if (!result.ok) throw new Error('Rejected regional path');
      expect(result.state.completionReached).toBe(true);
      expect(result.state.signals.ERROR_RATE!.value).toBe(0.5);
      expect(result.state.signals.CONFLICTING_REGIONAL_ROUTES!.value).toBe(1);
      expect(result.state.signals.GLOBAL_AUTHORITY_CONFLICT!.value).toBe('UNRESOLVED');
      for (const [id, value] of Object.entries(plan.globalStatuses))
        expect(result.state.signals[id + '_STATUS']!.value).toBe(value);
      expect(result.state.flags.FINAL_DECISION_COMMITTED).toBeUndefined();
      expect(result.state.triggeredNarrativeIds).not.toContain('BLACKOUT_FINAL');
      expect(result.state.revealedEvidenceIds).not.toContain('CURRENT_AUTHORITY_REQUESTS');
    }
  });
  it('distinguishes temporary relief, expiry and newly delivered team evidence', () => {
    const { scenario: s } = fixture();
    const temporary = executeCommand(createIncidentState(s, { seed: plan.seed }), s, {
      type: 'perform_action',
      actionId: 'CONTAIN_AFFECTED_REGION',
    });
    if (!temporary.ok) throw new Error('Rejected containment');
    expect(temporary.state.completionReached).toBe(false);
    expect(temporary.state.signals.ERROR_RATE!.value).toBe(4);
    const expired = replayCommands(
      s,
      { seed: plan.seed },
      plan.expirationRecovery
        .slice(0, 14)
        .map((actionId: string) => ({ type: 'perform_action' as const, actionId })),
    );
    if (!expired.ok) throw new Error('Rejected expiry path');
    expect(expired.state.signals.ERROR_RATE!.value).toBe(37);
    expect(expired.state.signals.CONFLICTING_REGIONAL_ROUTES!.value).toBe(88);
    const delegated = replayCommands(
      s,
      { seed: plan.seed },
      plan.delegationRecovery.map((actionId: string) => ({
        type: 'perform_action' as const,
        actionId,
      })),
    );
    if (!delegated.ok) throw new Error('Rejected team path');
    expect(delegated.state.revealedEvidenceIds).toContain('TEAM_DIAGNOSIS');
    expect(delegated.state.resources.TEAM_CAPACITY!.value).toBe(3);
  });
  it('delivers competing request receipts only after current investigation, without final flags or awards', () => {
    const { scenario: s } = fixture();
    const initial = createIncidentState(s, { seed: plan.seed });
    expect(
      executeCommand(initial, s, {
        type: 'perform_action',
        actionId: 'INSPECT_CURRENT_AUTHORITY_REQUESTS',
      }).ok,
    ).toBe(false);
    const result = replayCommands(
      s,
      { seed: plan.seed },
      plan.authorityRecovery.map((actionId: string) => ({
        type: 'perform_action' as const,
        actionId,
      })),
    );
    if (!result.ok) throw new Error('Rejected authority investigation');
    expect(result.state.revealedEvidenceIds).toContain('CURRENT_AUTHORITY_REQUESTS');
    for (const id of ['ORPHEUS_REQUEST', 'NULL_REQUEST', 'BOARD_REQUEST'])
      expect(
        result.state.eventLog.some((e) => e.type === 'war_room_message' && e.targetId === id),
      ).toBe(true);
    expect(bindings.logical_effects_fragment).toEqual([]);
    expect(result.state.flags.FINAL_DECISION_COMMITTED).toBeUndefined();
  });
});

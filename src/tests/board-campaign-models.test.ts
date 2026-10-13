// Deferred authored checks only. Full production composition/acceptance is absent.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { behaviorDefinitionSchema, validateBehaviorDefinition } from '../scenario/behavior.ts';
import {
  predictionDefinitionSchema,
  validatePredictionDefinition,
} from '../scenario/prediction.ts';
import { validateVersionedScenarioCatalog } from '../scenario/catalog.ts';

const read = (path: string) => parse(readFileSync(path, 'utf8'));
const modelRoot = '.project-os/planning/M5/models/';
describe('TASK-030 bounded model repair and Board rows — deferred QA', () => {
  it('restores complete INC-010/011/012 rows without output artifacts or missing action classifications', () => {
    const raw = readFileSync(modelRoot + 'orpheus-player-behavior.yaml', 'utf8');
    expect(raw).not.toContain('Warning: truncated output');
    expect(raw).not.toContain('tokens truncated');
    const behavior = behaviorDefinitionSchema.parse(parse(raw));
    const repair = read('.project-os/planning/TASK-030.behavior-repair.yaml');
    expect(behavior.scenarios).toHaveLength(18);
    for (const row of repair.scenarios)
      expect(behavior.scenarios.find((m) => m.scenarioId === row.scenarioId)).toEqual(row);
    const reporting = behavior.scenarios.find((m) => m.scenarioId === 'INC-011')!;
    if (reporting.coverage !== 'supported') throw new Error('Missing supported reporting mapping');
    for (const actionId of [
      'SEND_GENERATOR_OWNERSHIP_REPORT',
      'WITHHOLD_GENERATOR_OWNERSHIP_REPORT',
    ])
      expect(reporting.actions.find((a) => a.actionId === actionId)).toMatchObject({
        operational: false,
        restart: false,
        rollback: false,
        evidenceEligible: false,
      });
  });
  it('composes explicit 22-Incident rows against authored sources without publishing an official campaign', () => {
    const fragment = read('.project-os/planning/TASK-030.model-bindings.yaml');
    const behavior = read(modelRoot + 'orpheus-player-behavior.yaml');
    const prediction = read(modelRoot + 'orpheus-player-prediction.yaml');
    const files = Array.from(
      { length: 22 },
      (_, i) =>
        'src/scenario/data/full-campaign/incidents/inc-' + String(i + 1).padStart(3, '0') + '.yaml',
    );
    const result = validateVersionedScenarioCatalog(
      files.map((file) => ({
        file,
        source: readFileSync(file, 'utf8'),
      })),
    );
    if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
    const allowed = [...result.scenarios.values()].map((s) => ({
      scenarioId: s.id,
      contentVersion: s.contentVersion,
    }));
    const b = behaviorDefinitionSchema.parse({
      ...behavior,
      scenarios: [...behavior.scenarios, ...fragment.behavior_scenarios],
    });
    const p = predictionDefinitionSchema.parse({
      ...prediction,
      scenarios: [...prediction.scenarios, ...fragment.prediction_scenarios],
    });
    const references = [
      ...read('.project-os/planning/TASK-028.action-bindings.yaml').references,
      ...read('.project-os/planning/TASK-029.action-bindings.yaml').references,
      ...read('.project-os/planning/TASK-030.action-bindings.yaml').references,
      ...read('.project-os/planning/TASK-029.branch-bindings.yaml').references,
    ];
    expect(validateBehaviorDefinition(b, allowed, result.scenarios)).toEqual([]);
    expect(validatePredictionDefinition(p, allowed, result.scenarios, references)).toEqual([]);
    expect(b.scenarios).toHaveLength(22);
    expect(p.scenarios).toHaveLength(22);
    expect(p.contexts.every((c) => c.minimumSamples === 3)).toBe(true);
    for (const m of fragment.prediction_scenarios)
      for (const c of m.contexts)
        expect(c.reveal).toEqual({
          type: 'compare',
          reference: 'ELAPSED',
          operator: 'lt',
          expected: 0,
        });
  });
  it('counts only distinct direct optional investigations, never operational or causal-support samples', () => {
    const fragment = read('.project-os/planning/TASK-030.model-bindings.yaml');
    const consumers = read('.project-os/planning/TASK-030.branch-consumer-bindings.yaml');
    for (const c of consumers.consumers) {
      const mapping = fragment.behavior_scenarios.find(
        (m: { scenarioId: string }) => m.scenarioId === c.incidentId,
      );
      expect(mapping.actions.find((a: { actionId: string }) => a.actionId === c.actionId)).toEqual({
        actionId: c.actionId,
        operational: false,
        restart: false,
        rollback: false,
        evidenceEligible: false,
      });
      expect(
        mapping.investigations.find((i: { actionId: string }) => i.actionId === c.actionId),
      ).toMatchObject({
        key: c.incidentId + '/' + c.actionId,
        result: { kind: 'action_completed' },
      });
      expect(
        mapping.supportRules.flatMap((r: { investigationKeys: string[] }) => r.investigationKeys),
      ).not.toContain(c.incidentId + '/' + c.actionId);
    }
  });
});

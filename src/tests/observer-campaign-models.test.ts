// Authored for deferred verification, not a production package or official run.
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
describe('TASK-031 Observer model authoring — deferred QA', () => {
  it('composes explicit 24-Incident coverage without adding production admission or exposure', () => {
    const root = '.project-os/planning/M5/models/';
    const behavior = read(root + 'orpheus-player-behavior.yaml');
    const prediction = read(root + 'orpheus-player-prediction.yaml');
    const board = read('.project-os/planning/TASK-030.model-bindings.yaml');
    const observer = read('.project-os/planning/TASK-031.model-bindings.yaml');
    const files = Array.from(
      { length: 24 },
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
    const b = behaviorDefinitionSchema.parse({
      ...behavior,
      scenarios: [
        ...behavior.scenarios,
        ...board.behavior_scenarios,
        ...observer.behavior_scenarios,
      ],
    });
    const p = predictionDefinitionSchema.parse({
      ...prediction,
      scenarios: [
        ...prediction.scenarios,
        ...board.prediction_scenarios,
        ...observer.prediction_scenarios,
      ],
    });
    const allowed = [...result.scenarios.values()].map((s) => ({
      scenarioId: s.id,
      contentVersion: s.contentVersion,
    }));
    const references = [28, 29, 30, 31].flatMap(
      (n) => read('.project-os/planning/TASK-0' + n + '.action-bindings.yaml').references,
    );
    expect(validateBehaviorDefinition(b, allowed, result.scenarios)).toEqual([]);
    expect(validatePredictionDefinition(p, allowed, result.scenarios, references)).toEqual([]);
    expect(b.scenarios).toHaveLength(24);
    expect(p.scenarios).toHaveLength(24);
    for (const row of observer.prediction_scenarios)
      for (const context of row.contexts)
        expect(context.reveal).toEqual({
          type: 'compare',
          reference: 'ELAPSED',
          operator: 'lt',
          expected: 0,
        });
    expect(read(root + 'orpheus-player-opportunities.yaml').rules).toHaveLength(7);
  });
  it('keeps record investigations distinct from service interventions and causal support', () => {
    const models = read('.project-os/planning/TASK-031.model-bindings.yaml');
    const records = read('.project-os/planning/TASK-031.action-bindings.yaml');
    for (const gate of records.actionGates) {
      const row = models.behavior_scenarios.find(
        (r: { scenarioId: string }) => r.scenarioId === gate.incidentId,
      );
      expect(
        row.actions.find((a: { actionId: string }) => a.actionId === gate.actionId),
      ).toMatchObject({
        operational: false,
        restart: false,
        rollback: false,
        evidenceEligible: false,
      });
      expect(
        row.investigations.find((i: { actionId: string }) => i.actionId === gate.actionId),
      ).toMatchObject({ result: { kind: 'action_completed' } });
      expect(
        row.supportRules.flatMap((r: { investigationKeys: string[] }) => r.investigationKeys),
      ).not.toContain(gate.incidentId + '/' + gate.actionId);
    }
  });
});

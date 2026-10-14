// @vitest-environment node
// Deferred authoring checks only. Runtime registration is not a validation PASS.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { authorFullCampaign } from './full-campaign.mjs';

const read = (path) => parse(readFileSync(path, 'utf8'));
const authored = () =>
  authorFullCampaign(
    (file) => read('.project-os/planning/' + file),
    (file) => read('src/scenario/data/full-campaign/' + file),
    read('src/scenario/data/full-campaign-manifest.yaml'),
  );
describe('DEC-059/060 complete composition source data (deferred)', () => {
  it('reconstructs exact candidate objects from approved source fragments', () => {
    const data = authored();
    const priorCandidate = read('.project-os/planning/M5/composition/campaign-definition.yaml');
    expect(priorCandidate).not.toHaveProperty('replayAccess');
    expect(data.definition).toEqual({ ...priorCandidate, replayAccess: 'completed_prior_acts' });
    expect(data.definition).toEqual(
      read('src/scenario/data/full-campaign/definitions/campaign.yaml'),
    );
    expect(data.package).toEqual(read('.project-os/planning/M5/composition/campaign-package.yaml'));
    expect(data.package).toEqual(read('src/scenario/data/full-campaign/packages/campaign.yaml'));
    expect(authored()).toEqual(data);
  });
  it('retains exact complete inventories without publishing fixtures or initialized metric values', () => {
    const { definition: d, package: p } = authored();
    expect(d.incidents).toHaveLength(26);
    expect(d.acts).toHaveLength(9);
    expect(d.behavior.scenarios).toHaveLength(26);
    expect(d.prediction.scenarios).toHaveLength(26);
    expect(d.opportunities.rules).toHaveLength(10);
    expect(d.endings.entries).toHaveLength(10);
    expect(p.presentations).toHaveLength(26);
    expect(d.initial.act).toBe(1);
    expect(d.initial.completed).toEqual([]);
    expect(d.initial.evidence).toEqual([]);
    expect(d.initial.narratives).toEqual([]);
    expect(Object.values(d.initial.narrativeFlags).every((flag) => flag === false)).toBe(true);
    expect(d.initial).not.toHaveProperty('playerModel');
    expect(d.initial).not.toHaveProperty('metrics');
    expect(d.incidents.every((i) => !Object.hasOwn(i, 'compatibleContentVersions'))).toBe(true);
    expect(d.prediction.scenarios.find((s) => s.scenarioId === 'INC-026').coverage).toBe(
      'unsupported',
    );
  });
  it('authors sequential completion conditions and only the eight monotonic Act effects', () => {
    const { definition: d } = authored();
    for (const [index, incident] of d.incidents.entries()) {
      expect(incident.eligibility.children).toEqual([
        { type: 'compare', reference: 'CURRENT_ACT', operator: 'gte', expected: incident.act },
        ...d.incidents.slice(0, index).map((earlier) => ({
          type: 'compare',
          reference: 'PROGRESSION_COMPLETED_' + earlier.id,
          operator: 'eq',
          expected: true,
        })),
      ]);
    }
    const transitions = d.effects.filter((e) => e.id.startsWith('PROGRESSION_ACT_'));
    expect(transitions).toHaveLength(8);
    for (const [index, effect] of transitions.entries()) {
      expect(effect.act).toBe(index + 2);
      expect(effect.condition.children[0]).toEqual({
        type: 'compare',
        reference: 'CURRENT_ACT',
        operator: 'eq',
        expected: index + 1,
      });
      expect(effect.trigger.type).toBe('completion_reached');
      expect(effect.alignment).toEqual({});
      expect(effect.values).toEqual({});
      expect(effect.narrativeFlags).toEqual({});
      expect(effect.endingFlags).toEqual({});
    }
  });
});

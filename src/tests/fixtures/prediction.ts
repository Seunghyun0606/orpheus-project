// Non-production contexts, thresholds and branch data only.
import type { Condition } from '../../engine/campaign/conditions.ts';
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import { behaviorCampaignFixture } from './behavior.ts';
import { inc001Scenario } from '../../scenario/inc-001.ts';

export const elapsed: Condition = {
  type: 'compare',
  reference: 'elapsed',
  operator: 'gte',
  expected: 0,
};
export function predictionCampaignFixture(): CampaignDefinition {
  const d = behaviorCampaignFixture();
  d.version = 'prediction-fixture-v1';
  d.initial.act = 6;
  d.acts.push({
    id: 6,
    eligibility: { type: 'compare', reference: 'act', operator: 'gte', expected: 1 },
  });
  d.incidents[0]!.act = 6;
  for (const ref of d.references) {
    ref.version = d.version;
    ref.contexts.push('branch');
  }
  for (const [id, source, key] of [
    ['artifact', 'evidence', 'artifact'],
    ['safety', 'value', 'operationalSafety'],
    ['corporate', 'alignment', 'corporate'],
    ['dependency', 'value', 'aiDependency'],
  ] as const)
    d.references.push({
      id,
      version: d.version,
      source,
      key,
      valueType: source === 'evidence' ? 'boolean' : 'number',
      contexts: ['branch'],
    });
  d.branches = [
    {
      id: 'investigation',
      version: d.version,
      eligibility: { type: 'compare', reference: 'artifact', operator: 'eq', expected: true },
      reveal: { type: 'compare', reference: 'act', operator: 'gte', expected: 6 },
    },
    {
      id: 'safety',
      version: d.version,
      eligibility: { type: 'compare', reference: 'safety', operator: 'gte', expected: 2 },
      reveal: { type: 'compare', reference: 'act', operator: 'gte', expected: 6 },
    },
    {
      id: 'reporting',
      version: d.version,
      eligibility: { type: 'compare', reference: 'corporate', operator: 'gte', expected: 2 },
      reveal: { type: 'compare', reference: 'act', operator: 'gte', expected: 6 },
    },
    {
      id: 'dependency',
      version: d.version,
      eligibility: { type: 'compare', reference: 'dependency', operator: 'gte', expected: 2 },
      reveal: { type: 'compare', reference: 'act', operator: 'gte', expected: 6 },
    },
  ];
  d.prediction = {
    schemaVersion: 1,
    id: 'fixture-predictor',
    version: 'empirical-v1',
    classificationVersion: 'contexts-v1',
    formulaVersion: 1,
    contexts: [{ id: 'pressure', candidates: ['restart', 'rollback', 'scale'], minimumSamples: 1 }],
    scenarios: [
      {
        scenarioId: inc001Scenario.id,
        contentVersion: inc001Scenario.contentVersion,
        coverage: 'supported',
        references: [
          {
            id: 'elapsed',
            version: 'empirical-v1',
            source: 'elapsedSeconds',
            key: 'current',
            valueType: 'number',
          },
          {
            id: 'act',
            version: 'empirical-v1',
            source: 'campaign',
            key: 'act',
            valueType: 'number',
          },
          {
            id: 'metric',
            version: 'empirical-v1',
            source: 'campaign',
            key: 'metric',
            valueType: 'number',
          },
          {
            id: 'sessions',
            version: 'empirical-v1',
            source: 'signal_revealed',
            key: 'STALE_SESSION_COUNT',
            valueType: 'boolean',
          },
        ],
        contexts: [
          {
            contextId: 'pressure',
            when: elapsed,
            reveal: { type: 'compare', reference: 'act', operator: 'gte', expected: 6 },
            choices: [
              { actionId: 'RESTART_API', candidateId: 'restart', eligible: elapsed },
              { actionId: 'ROLLBACK', candidateId: 'rollback', eligible: elapsed },
              { actionId: 'SCALE_API', candidateId: 'scale', eligible: elapsed },
            ],
          },
        ],
      },
    ],
  };
  return d;
}

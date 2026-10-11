// Non-production endings, final choices, ranks and thresholds. Not campaign balance.
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import type { Condition } from '../../engine/campaign/conditions.ts';
import { inc001Scenario } from '../../scenario/inc-001.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import { behaviorCampaignFixture } from './behavior.ts';

export const endingCases = [
  { id: 'CONTINUITY', action: 'RESTORE_AUTHORITY', metric: 'corporate' },
  { id: 'LIBERATION', action: 'DISCLOSE_ARCHIVE', metric: 'null' },
  { id: 'WHISTLEBLOWER', action: 'INDEPENDENT_DISCLOSURE', metric: 'teamTrust' },
  { id: 'SHUTDOWN', action: 'REMOVE_BOTH', metric: 'operationalSafety' },
  { id: 'CUSTODIAN', action: 'REQUIRE_APPROVAL', metric: 'operationalSafety' },
  { id: 'NULL', action: 'EXTERNAL_NETWORK', metric: 'null' },
  { id: 'THE BOARD', action: 'ACCEPT_RECOMMENDATIONS', metric: 'aiDependency' },
  { id: 'THE FIRE', action: 'DESTROY_INFRASTRUCTURE', metric: 'collateralDamage' },
  { id: 'STATUS QUO', action: 'IGNORE_ARTIFACTS', metric: 'corporate' },
  { id: 'REWRITE', action: 'STRUCTURAL_AUDIT', metric: 'evidence' },
] as const;
export const endingCompare = (
  reference: string,
  expected: number | boolean,
  operator: 'eq' | 'gte' | 'lte' = 'eq',
): Condition => ({ type: 'compare', reference, operator, expected });

export function endingFixture() {
  const scenario = structuredClone(inc001Scenario);
  scenario.contentVersion = '9.9.0'; // Isolated test authority; never registered in production.
  for (const c of endingCases)
    scenario.actions.push({
      id: c.action,
      title: 'Test-only final choice: ' + c.action,
      category: 'MODIFY',
      durationSeconds: 0,
      initiallyAvailable: true,
      requirements: [],
      costs: [],
      effects: [],
      temporaryEffects: [],
    });
  const catalog = new Map([[scenarioVersionKey(scenario.id, scenario.contentVersion), scenario]]);
  const d: CampaignDefinition = behaviorCampaignFixture();
  d.version = 'ending-campaign-test-v1';
  d.effects = [];
  d.initial.act = 9;
  d.initial.alignment = { corporate: 10, null: 10 };
  for (const key of Object.keys(d.initial.values) as (keyof typeof d.initial.values)[])
    d.initial.values[key] = 10;
  d.acts.push({ id: 9, eligibility: endingCompare('act', 1, 'gte') });
  for (const i of d.incidents) {
    i.contentVersion = scenario.contentVersion;
    i.act = 9;
  }
  d.behavior!.scenarios[0]!.contentVersion = scenario.contentVersion;
  const mapping = d.behavior!.scenarios[0]!;
  if (mapping.coverage !== 'supported') throw new Error('fixture coverage');
  for (const c of endingCases)
    mapping.actions.push({
      actionId: c.action,
      operational: true,
      restart: false,
      rollback: false,
      evidenceEligible: false,
    });
  for (const ref of d.references) {
    ref.version = d.version;
    ref.contexts.push('ending');
  }
  for (const key of ['corporate', 'null'] as const)
    d.references.push({
      id: key,
      version: d.version,
      valueType: 'number',
      source: 'alignment',
      key,
      contexts: ['ending'],
    });
  for (const key of Object.keys(d.initial.values))
    d.references.push({
      id: key,
      version: d.version,
      valueType: 'number',
      source: 'value',
      key,
      contexts: ['ending'],
    });
  d.references.push({
    id: 'artifact',
    version: d.version,
    valueType: 'boolean',
    source: 'evidence',
    key: 'artifact',
    contexts: ['ending'],
  });
  const version = 'ending-test-v1';
  d.endings = {
    schemaVersion: 1,
    id: 'test-endings',
    version,
    behaviorVersion: d.behavior!.version,
    finals: [
      {
        incidentId: 'stage-one',
        contentVersion: scenario.contentVersion,
        eligible: {
          type: 'all',
          children: [endingCompare('act', 9, 'gte'), endingCompare('complete', true)],
        },
        references: [
          ...d.references.map((r) => ({
            id: r.id,
            version,
            valueType: r.valueType,
            source: 'campaign' as const,
            key: r.id,
          })),
          ...endingCases.map((c) => ({
            id: c.action,
            version,
            valueType: 'boolean' as const,
            source: 'action' as const,
            key: c.action,
          })),
          { id: 'complete', version, valueType: 'boolean', source: 'completion', key: 'current' },
          { id: 'resolved', version, valueType: 'boolean', source: 'resolution', key: 'current' },
          {
            id: 'errorRate',
            version,
            valueType: 'number',
            source: 'signal',
            key: 'API_ERROR_RATE',
          },
        ],
      },
    ],
    entries: endingCases.map((c) => ({
      id: c.id,
      version,
      priorityRank: 10,
      condition: {
        type: 'all',
        children: [
          endingCompare(c.action, true),
          endingCompare(c.metric, 5, 'gte'),
          endingCompare('resolved', true),
          endingCompare('errorRate', 0.2, 'lte'),
          ...(c.id === 'REWRITE'
            ? [
                endingCompare('artifact', true),
                endingCompare('publicInterest', 5, 'gte'),
                endingCompare('teamTrust', 5, 'gte'),
                endingCompare('operationalSafety', 5, 'gte'),
              ]
            : []),
        ],
      },
    })),
  };
  return { d, scenario, catalog };
}

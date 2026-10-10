// Test-only classifications/freshness: never production balance or content.
import type { BehaviorDefinition } from '../../scenario/behavior.ts';
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import type { CampaignOperation, CampaignRun } from '../../engine/campaign/transitions.ts';
import { inc001Scenario } from '../../scenario/inc-001.ts';
import { campaignFixture, operation } from './campaign.ts';

export function behaviorFixture(): BehaviorDefinition {
  const interventions = ['RESTART_API', 'SCALE_API', 'ROLLBACK', 'TERMINATE_STALE_SESSIONS'];
  return {
    schemaVersion: 1,
    id: 'test-behavior',
    version: 'test-model-v1',
    classificationVersion: 'test-classes-v1',
    formulaVersion: 1,
    scenarios: [
      {
        scenarioId: inc001Scenario.id,
        contentVersion: inc001Scenario.contentVersion,
        coverage: 'supported',
        references: [
          {
            id: 'age',
            version: 'test-model-v1',
            valueType: 'number',
            source: 'ageSeconds',
            key: 'current',
          },
          {
            id: 'action',
            version: 'test-model-v1',
            valueType: 'string',
            source: 'actionId',
            key: 'current',
          },
        ],
        actions: inc001Scenario.actions.map((action) => ({
          actionId: action.id,
          operational: interventions.includes(action.id),
          restart: action.id === 'RESTART_API',
          rollback: action.id === 'ROLLBACK',
          evidenceEligible: interventions.includes(action.id),
        })),
        investigations: [
          { id: 'logs', key: 'logs', actionId: 'OPEN_LOGS', result: { kind: 'action_completed' } },
          {
            id: 'sessions',
            key: 'sessions',
            actionId: 'INSPECT_SESSIONS',
            result: { kind: 'action_completed' },
          },
          {
            id: 'impact',
            key: 'impact',
            actionId: 'ASK_JIN_CONFIRM_IMPACT',
            result: {
              kind: 'war_room_message',
              messageId: 'JIN_IMPACT_REPORT',
              delivery: { kind: 'timer', eventId: 'JIN_IMPACT_RESULT' },
            },
          },
        ],
        supportRules: interventions.map((actionId) => ({
          id: 'support-' + actionId,
          actionId,
          investigationKeys: ['sessions', 'impact'],
          relevance: { type: 'compare', reference: 'action', operator: 'eq', expected: actionId },
          freshness: { type: 'compare', reference: 'age', operator: 'lte', expected: 120 },
        })),
      },
    ],
  };
}
export function behaviorCampaignFixture(): CampaignDefinition {
  const definition = campaignFixture();
  definition.version = 'with-behavior-v1';
  definition.references.forEach((ref) => {
    ref.version = definition.version;
  });
  definition.behavior = behaviorFixture();
  return definition;
}
export function behaviorOperation(
  definition: CampaignDefinition,
  run: CampaignRun | null,
  payload: Parameters<typeof operation>[1],
): CampaignOperation {
  return {
    ...operation(run, payload),
    definitionId: definition.id,
    definitionVersion: definition.version,
  };
}

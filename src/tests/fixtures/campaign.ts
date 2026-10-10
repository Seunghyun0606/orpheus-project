// All campaign values/thresholds here are fixtures, never production tuning.
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import { inc001Scenario } from '../../scenario/inc-001.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import type { Condition } from '../../engine/campaign/conditions.ts';
import type { CampaignOperation, CampaignRun } from '../../engine/campaign/transitions.ts';

export const campaignCatalog = new Map([
  [scenarioVersionKey(inc001Scenario.id, inc001Scenario.contentVersion), inc001Scenario],
]);
export const always: Condition = {
  type: 'compare',
  reference: 'act',
  operator: 'gte',
  expected: 1,
};
export function campaignFixture(advance = false): CampaignDefinition {
  return {
    schemaVersion: 1,
    id: 'fixture-only',
    version: 'fixture-v1',
    replayVersion: 1,
    references: [
      {
        id: 'act',
        version: 'fixture-v1',
        source: 'act',
        key: 'current',
        valueType: 'number',
        contexts: ['progression', 'effect'],
      },
      {
        id: 'completed',
        version: 'fixture-v1',
        source: 'completed',
        key: 'stage-one',
        valueType: 'boolean',
        contexts: ['progression', 'effect'],
      },
      {
        id: 'metric',
        version: 'fixture-v1',
        source: 'metric',
        key: 'restartRate',
        valueType: 'number',
        contexts: ['progression', 'effect'],
      },
    ],
    initial: {
      act: 1,
      alignment: { corporate: 0, null: 0 },
      values: {
        publicInterest: 0,
        operationalSafety: 0,
        curiosity: 0,
        evidence: 0,
        teamTrust: 0,
        aiDependency: 0,
        collateralDamage: 0,
      },
      evidence: [],
      narratives: [],
      completed: [],
      narrativeFlags: { discovered: false },
      endingFlags: { closed: false },
    },
    acts: [
      { id: 1, eligibility: always },
      {
        id: 2,
        eligibility: { type: 'compare', reference: 'completed', operator: 'eq', expected: true },
      },
    ],
    incidents: [
      {
        id: 'stage-one',
        scenarioId: inc001Scenario.id,
        contentVersion: inc001Scenario.contentVersion,
        act: 1,
        eligibility: always,
      },
      {
        id: 'stage-two',
        scenarioId: inc001Scenario.id,
        contentVersion: inc001Scenario.contentVersion,
        act: 2,
        eligibility: always,
      },
    ],
    evidence: [
      { id: 'artifact', scenarioId: inc001Scenario.id, evidenceId: 'CORRUPTED_LOG_ENTRY' },
    ],
    narratives: [{ id: 'hint', scenarioId: inc001Scenario.id, narrativeId: 'UNKNOWN_GOOD' }],
    effects: [
      {
        id: 'discovery',
        trigger: {
          incidentId: 'stage-one',
          type: 'evidence_revealed',
          targetId: 'CORRUPTED_LOG_ENTRY',
        },
        boundary: 'post_event',
        condition: always,
        alignment: { corporate: 2 },
        values: { curiosity: 3 },
        narrativeFlags: { discovered: true },
        endingFlags: {},
      },
      {
        id: 'completion',
        trigger: { incidentId: 'stage-one', type: 'completion_reached' },
        boundary: 'post_event',
        condition: always,
        alignment: {},
        values: { operationalSafety: 1 },
        narrativeFlags: {},
        endingFlags: {},
        ...(advance ? { act: 2 } : {}),
      },
    ],
  };
}
type OperationPayload =
  | { kind: 'create' }
  | { kind: 'start'; attemptId: string; incidentId: string; seed: number; contentVersion?: string }
  | {
      kind: 'checkpoint';
      attemptId: string;
      incidentId: string;
      sourceBytes: string;
      confirmed: true;
    }
  | { kind: 'adopt'; sourceBytes: string[]; confirmed: true }
  | {
      kind: 'command';
      attemptId: string;
      inputId: string;
      commandSequence: number;
      priorHead: string;
      command: { type: 'perform_action'; actionId: string };
    };
export function operation(run: CampaignRun | null, payload: OperationPayload): CampaignOperation {
  const sequence = run ? run.revision + 1 : 0;
  return {
    operationId: 'op-' + sequence,
    runId: run?.runId ?? 'fixture-run',
    sequence,
    definitionId: 'fixture-only',
    definitionVersion: 'fixture-v1',
    replayVersion: 1,
    canonicalVersion: 1,
    ...payload,
  };
}

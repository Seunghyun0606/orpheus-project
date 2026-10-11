// Non-production v2 authoring. No bundled content or user stores are changed.
import { predictionCampaignFixture, elapsed } from './prediction.ts';
import { campaignCatalog } from './campaign.ts';
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import type { OpportunityRule } from '../../scenario/opportunity.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  type CampaignOperation,
  type CampaignRun,
} from '../../engine/campaign/transitions.ts';

export function opportunityCampaignFixture(): CampaignDefinition {
  const d = predictionCampaignFixture();
  d.version = 'presentation-fixture-v2';
  d.replayVersion = 2;
  d.recordVersion = 2;
  for (const ref of d.references) ref.version = d.version;
  for (const branch of d.branches!) branch.version = d.version;
  d.opportunities = {
    schemaVersion: 1,
    id: 'fixture-presentations',
    version: 'presentations-v1',
    formulaVersion: 1,
    behaviorVersion: d.behavior!.version,
    predictionVersion: d.prediction!.version,
    rules: [
      {
        id: 'prediction',
        version: 'presentations-v1',
        incidentId: 'stage-one',
        contentVersion: d.incidents[0]!.contentVersion,
        metric: 'predictionDeviation',
        kind: 'prediction',
        contextId: 'pressure',
        presentation: { id: 'fixture-prediction', text: 'TEST CONTENT — empirical prediction' },
        consumption: 'single_response',
        replacement: 'none',
        references: [
          {
            id: 'elapsed',
            version: 'presentations-v1',
            valueType: 'number',
            source: 'elapsedSeconds',
            key: 'current',
          },
          {
            id: 'age',
            version: 'presentations-v1',
            valueType: 'number',
            source: 'ageSeconds',
            key: 'current',
          },
        ],
        available: elapsed,
        reveal: elapsed,
        valid: { type: 'compare', reference: 'age', operator: 'lte', expected: 300 },
        responses: ['RESTART_API', 'ROLLBACK', 'SCALE_API'].map((actionId) => ({
          actionId,
          eligible: elapsed,
        })),
      },
    ],
  };
  return d;
}
export function choiceRule(
  d: CampaignDefinition,
  metric: OpportunityRule['metric'],
): OpportunityRule {
  const base = d.opportunities!.rules[0]!;
  const { contextId: _context, ...rest } = base;
  void _context;
  return {
    ...rest,
    id: metric,
    kind: 'choice',
    metric,
    presentation: { id: 'fixture-' + metric, text: 'TEST CONTENT — explicit choice' },
    responses: [
      { actionId: 'RESTART_API', eligible: elapsed, positive: elapsed },
      { actionId: 'ROLLBACK', eligible: elapsed, positive: { type: 'not', child: elapsed } },
    ],
  };
}
type Payload<T = CampaignOperation> = T extends CampaignOperation
  ? Omit<
      T,
      | 'operationId'
      | 'runId'
      | 'sequence'
      | 'definitionId'
      | 'definitionVersion'
      | 'replayVersion'
      | 'canonicalVersion'
    >
  : never;
export function fixtureOperation(
  d: CampaignDefinition,
  run: CampaignRun | null,
  payload: Payload,
): CampaignOperation {
  const sequence = run ? run.revision + 1 : 0;
  return {
    operationId: 'op-' + sequence,
    runId: run?.runId ?? 'fixture-v2-run',
    sequence,
    definitionId: d.id,
    definitionVersion: d.version,
    replayVersion: d.replayVersion,
    canonicalVersion: 1,
    ...payload,
  } as CampaignOperation;
}
export function applyFixture(
  d: CampaignDefinition,
  run: CampaignRun | null,
  payload: Payload,
): CampaignRun {
  const result = prepareCampaignOperation(
    d,
    campaignCatalog,
    run,
    fixtureOperation(d, run, payload),
  );
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.run;
}
export function startFixture(
  d: CampaignDefinition,
  run: CampaignRun | null = null,
  attemptId = 'attempt',
): CampaignRun {
  if (!run) run = applyFixture(d, null, { kind: 'create' });
  return applyFixture(d, run, { kind: 'start', attemptId, incidentId: 'stage-one', seed: 1002 });
}
export function commandFixture(
  d: CampaignDefinition,
  run: CampaignRun,
  actionId: string,
): CampaignRun {
  const a = run.attempts.find((t) => t.id === run.activeAttemptId)!;
  return applyFixture(d, run, {
    kind: 'command',
    attemptId: a.id,
    inputId: 'input-' + run.revision,
    commandSequence: a.incident.replayLog.length,
    priorHead: campaignAttemptHead(a),
    command: { type: 'perform_action', actionId },
  });
}
export function prepareFixture(
  d: CampaignDefinition,
  run: CampaignRun,
  id = 'p-' + run.revision,
  ruleId = 'prediction',
): CampaignRun {
  const a = run.attempts.find((t) => t.id === run.activeAttemptId)!;
  return applyFixture(d, run, {
    kind: 'prepare_opportunity',
    attemptId: a.id,
    priorHead: campaignAttemptHead(a),
    preparationId: id,
    ruleId,
  });
}
export function acknowledgeFixture(d: CampaignDefinition, run: CampaignRun): CampaignRun {
  const p = run.opportunities!.preparations.at(-1)!;
  return applyFixture(d, run, {
    kind: 'acknowledge_presentation',
    attemptId: p.attemptId,
    priorHead: p.priorHead,
    preparationId: p.id,
    surfaceId: p.presentation.id,
  });
}
export function trainedFixture(d: CampaignDefinition): CampaignRun {
  let training = startFixture(d, null, 'training');
  for (let i = 0; i < 3; i++) training = commandFixture(d, training, 'RESTART_API');
  return startFixture(d, training);
}

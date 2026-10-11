import { z } from 'zod';
import {
  conditionSchema,
  validateConditionReferences,
  orderedDiagnostics,
  type Reference,
  type CampaignDiagnostic,
} from '../engine/campaign/conditions.ts';
import type { CampaignDefinition } from './campaign.ts';
import { scenarioVersionKey } from './catalog.ts';
import { scenarioSchema, type Scenario } from './schema.ts';

export const opportunityMetrics = [
  'predictionDeviation',
  'aiRecommendationAcceptanceRate',
  'safetyPreference',
  'collateralDamageTolerance',
  'companyReportingRate',
  'nullCooperationRate',
] as const;
const id = z.string().min(1);
export const opportunityDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: id,
    formulaVersion: z.literal(1),
    behaviorVersion: id,
    predictionVersion: id.optional(),
    rules: z
      .array(
        z
          .object({
            id,
            version: id,
            incidentId: id,
            contentVersion: id,
            metric: z.enum(opportunityMetrics),
            kind: z.enum(['prediction', 'recommendation', 'choice']),
            contextId: id.optional(),
            recommendedActionId: id.optional(),
            presentation: z.object({ id, text: id }).strict(),
            consumption: z.literal('single_response'),
            replacement: z.literal('none'),
            references: z.array(
              z
                .object({
                  id,
                  version: id,
                  valueType: z.enum(['number', 'boolean', 'string']),
                  source: z.enum([
                    'campaign',
                    'elapsedSeconds',
                    'ageSeconds',
                    'signal',
                    'resource',
                    'flag',
                    'evidence',
                  ]),
                  key: id,
                })
                .strict(),
            ),
            available: conditionSchema,
            reveal: conditionSchema,
            valid: conditionSchema,
            responses: z
              .array(
                z
                  .object({
                    actionId: id,
                    eligible: conditionSchema,
                    positive: conditionSchema.optional(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type OpportunityDefinition = z.infer<typeof opportunityDefinitionSchema>;
export type OpportunityRule = OpportunityDefinition['rules'][number];
export function opportunityReferences(rule: OpportunityRule): Reference[] {
  return rule.references.map((r) => ({
    id: r.id,
    version: r.version,
    valueType: r.valueType,
    source: 'value',
    key: r.id,
    contexts: ['branch'],
  }));
}
export function validateOpportunityDefinition(
  model: OpportunityDefinition,
  d: CampaignDefinition,
  catalog: ReadonlyMap<string, Scenario>,
): CampaignDiagnostic[] {
  const issues: CampaignDiagnostic[] = [];
  const issue = (path: string) => {
    issues.push({ code: 'INVALID_OPPORTUNITY_REFERENCE', path });
  };
  if (model.behaviorVersion !== d.behavior?.version) issue('opportunities.behaviorVersion');
  if (model.predictionVersion !== undefined && model.predictionVersion !== d.prediction?.version)
    issue('opportunities.predictionVersion');
  if (new Set(model.rules.map((r) => r.id)).size !== model.rules.length)
    issue('opportunities.rules');
  for (const rule of model.rules) {
    const path = 'opportunities.' + rule.id;
    if (rule.version !== model.version) issue(path + '.version');
    const inc = d.incidents.find((i) => i.id === rule.incidentId);
    const parsed = scenarioSchema.safeParse(
      inc && catalog.get(scenarioVersionKey(inc.scenarioId, rule.contentVersion)),
    );
    if (
      !inc ||
      ![inc.contentVersion, ...(inc.compatibleContentVersions ?? [])].includes(
        rule.contentVersion,
      ) ||
      !parsed.success
    ) {
      issue(path + '.contentVersion');
      continue;
    }
    const scenario = parsed.data;
    if (rule.kind === 'prediction') {
      if (
        rule.metric !== 'predictionDeviation' ||
        rule.contextId === undefined ||
        !d.prediction ||
        model.predictionVersion !== d.prediction.version ||
        rule.recommendedActionId !== undefined
      )
        issue(path + '.prediction');
      const mapping = d.prediction?.scenarios.find(
        (s) => s.scenarioId === scenario.id && s.contentVersion === scenario.contentVersion,
      );
      const context =
        mapping?.coverage === 'supported' &&
        mapping.contexts.find((c) => c.contextId === rule.contextId);
      if (
        !context ||
        rule.responses.some((r) => !context.choices.some((c) => c.actionId === r.actionId))
      )
        issue(path + '.context');
    } else if (rule.kind === 'recommendation') {
      if (
        rule.metric !== 'aiRecommendationAcceptanceRate' ||
        rule.contextId !== undefined ||
        !scenario.actions.some((a) => a.id === rule.recommendedActionId)
      )
        issue(path + '.recommendation');
    } else if (
      ['predictionDeviation', 'aiRecommendationAcceptanceRate'].includes(rule.metric) ||
      rule.contextId !== undefined ||
      rule.recommendedActionId !== undefined
    )
      issue(path + '.choice');
    if (
      new Set(rule.references.map((r) => r.id)).size !== rule.references.length ||
      new Set(rule.responses.map((r) => r.actionId)).size !== rule.responses.length
    )
      issue(path + '.duplicates');
    for (const ref of rule.references) {
      let type: string | undefined;
      if (ref.source === 'campaign')
        type = d.references.find(
          (r) => r.id === ref.key && r.contexts.includes('branch'),
        )?.valueType;
      else if (ref.source === 'elapsedSeconds' || ref.source === 'ageSeconds')
        type = ref.key === 'current' ? 'number' : undefined;
      else if (ref.source === 'signal')
        type = typeof scenario.initialState.signals.find((s) => s.id === ref.key)?.value;
      else if (
        ref.source === 'resource' &&
        scenario.initialState.resources.some((r) => r.id === ref.key)
      )
        type = 'number';
      else if (ref.source === 'flag' && scenario.initialState.flags.some((f) => f.id === ref.key))
        type = 'boolean';
      else if (ref.source === 'evidence' && scenario.evidence.some((e) => e.id === ref.key))
        type = 'boolean';
      if (ref.version !== model.version || ref.valueType !== type) issue(path + '.' + ref.id);
    }
    for (const response of rule.responses) {
      if (!scenario.actions.some((a) => a.id === response.actionId))
        issue(path + '.' + response.actionId);
      if ((rule.kind === 'choice') !== (response.positive !== undefined))
        issue(path + '.' + response.actionId + '.positive');
    }
    for (const tree of [
      rule.available,
      rule.reveal,
      rule.valid,
      ...rule.responses.flatMap((r) => [r.eligible, ...(r.positive ? [r.positive] : [])]),
    ])
      issues.push(
        ...validateConditionReferences(tree, opportunityReferences(rule), model.version, 'branch'),
      );
  }
  return orderedDiagnostics(issues);
}

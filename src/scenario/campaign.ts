import { z } from 'zod';
import { parseDocument } from 'yaml';

import {
  conditionSchema,
  referenceSchema,
  validateConditionReferences,
  orderedDiagnostics,
  type CampaignDiagnostic,
} from '../engine/campaign/conditions.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { scenarioVersionKey } from './catalog.ts';
import { scenarioSchema, type Scenario } from './schema.ts';
import { validateScenarioObject } from './validator.ts';
import { behaviorDefinitionSchema, validateBehaviorDefinition, metricKeys } from './behavior.ts';
import { predictionDefinitionSchema, validatePredictionDefinition } from './prediction.ts';
import { endingDefinitionSchema, validateEndingDefinition } from './ending.ts';
export { metricKeys } from './behavior.ts';

const id = z.string().min(1);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const alignmentSchema = z
  .object({ corporate: z.number().finite(), null: z.number().finite() })
  .strict();
export const valuesSchema = z
  .object({
    publicInterest: z.number().finite(),
    operationalSafety: z.number().finite(),
    curiosity: z.number().finite(),
    evidence: z.number().finite(),
    teamTrust: z.number().finite(),
    aiDependency: z.number().finite(),
    collateralDamage: z.number().finite(),
  })
  .strict();
export const campaignDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: id,
    replayVersion: z.literal(1),
    behavior: behaviorDefinitionSchema.optional(),
    prediction: predictionDefinitionSchema.optional(),
    endings: endingDefinitionSchema.optional(),
    branches: z
      .array(
        z
          .object({ id, version: id, eligibility: conditionSchema, reveal: conditionSchema })
          .strict(),
      )
      .min(1)
      .optional(),
    references: z.array(referenceSchema),
    initial: z
      .object({
        act: integer,
        alignment: alignmentSchema,
        values: valuesSchema,
        evidence: z.array(id),
        narratives: z.array(id),
        completed: z.array(id),
        narrativeFlags: z.record(id, z.boolean()),
        endingFlags: z.record(id, z.boolean()),
      })
      .strict(),
    acts: z.array(z.object({ id: integer, eligibility: conditionSchema }).strict()).min(1),
    incidents: z
      .array(
        z
          .object({
            id,
            scenarioId: id,
            contentVersion: id,
            compatibleContentVersions: z.array(id).min(1).optional(),
            act: integer,
            eligibility: conditionSchema,
          })
          .strict(),
      )
      .min(1),
    evidence: z.array(z.object({ id, scenarioId: id, evidenceId: id }).strict()),
    narratives: z.array(z.object({ id, scenarioId: id, narrativeId: id }).strict()),
    effects: z.array(
      z
        .object({
          id,
          trigger: z
            .object({
              incidentId: id,
              type: z.enum(['evidence_revealed', 'narrative_triggered', 'completion_reached']),
              targetId: id.optional(),
            })
            .strict(),
          additionalTriggers: z
            .array(
              z
                .object({
                  contentVersion: id,
                  type: z.enum(['evidence_revealed', 'narrative_triggered', 'completion_reached']),
                  targetId: id.optional(),
                })
                .strict(),
            )
            .min(1)
            .optional(),
          // Explicit authored boundary; there is no inferred pre/post condition policy.
          boundary: z.enum(['pre_command', 'post_event']),
          condition: conditionSchema,
          alignment: alignmentSchema.partial(),
          values: valuesSchema.partial(),
          narrativeFlags: z.record(id, z.boolean()),
          endingFlags: z.record(id, z.boolean()),
          act: integer.optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type CampaignDefinition = z.infer<typeof campaignDefinitionSchema>;
export function campaignContentVersions(
  incident: CampaignDefinition['incidents'][number],
): string[] {
  return [incident.contentVersion, ...(incident.compatibleContentVersions ?? [])];
}
export function campaignEffectTriggers(
  effect: CampaignDefinition['effects'][number],
  incident: CampaignDefinition['incidents'][number],
) {
  return [
    {
      contentVersion: incident.contentVersion,
      type: effect.trigger.type,
      ...(effect.trigger.targetId === undefined ? {} : { targetId: effect.trigger.targetId }),
    },
    ...(effect.additionalTriggers ?? []),
  ];
}
export type CampaignDefinitionResult =
  { ok: true; definition: CampaignDefinition } | { ok: false; diagnostics: CampaignDiagnostic[] };

export function validateCampaignDefinition(
  input: unknown,
  catalog: ReadonlyMap<string, Scenario>,
): CampaignDefinitionResult {
  try {
    canonicalJson(input);
  } catch {
    return { ok: false, diagnostics: [{ code: 'INVALID_CAMPAIGN_JSON', path: '$' }] };
  }
  const parsed = campaignDefinitionSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      diagnostics: orderedDiagnostics(
        parsed.error.issues.map((issue) => ({
          code: 'INVALID_CAMPAIGN_SCHEMA',
          path: issue.path.join('.'),
        })),
      ),
    };
  const d = parsed.data;
  // Validate catalog entries before traversing reference arrays. Bad authorities
  // are diagnostics, not an exception during prediction/branch authoring.
  const scenarioFor = (scenarioId: string, contentVersion: string) => {
    const checked = scenarioSchema.safeParse(
      catalog.get(scenarioVersionKey(scenarioId, contentVersion)),
    );
    return checked.success ? checked.data : undefined;
  };
  const issues: CampaignDiagnostic[] = [];
  if (d.endings) issues.push(...validateEndingDefinition(d.endings, d, catalog));
  if (d.prediction)
    issues.push(
      ...validatePredictionDefinition(
        d.prediction,
        d.incidents.flatMap((item) =>
          campaignContentVersions(item).map((contentVersion) => ({
            scenarioId: item.scenarioId,
            contentVersion,
          })),
        ),
        catalog,
        d.references,
      ),
    );
  if (d.branches) {
    if (new Set(d.branches.map((b) => b.id)).size !== d.branches.length)
      issues.push({ code: 'INVALID_BRANCH_REFERENCE', path: 'branches' });
    for (const branch of d.branches) {
      if (branch.version !== d.version)
        issues.push({ code: 'INVALID_BRANCH_REFERENCE', path: branch.id + '.version' });
      for (const tree of [branch.eligibility, branch.reveal])
        issues.push(...validateConditionReferences(tree, d.references, d.version, 'branch'));
    }
  }
  if (d.behavior)
    issues.push(
      ...validateBehaviorDefinition(
        d.behavior,
        d.incidents.flatMap((item) =>
          campaignContentVersions(item).map((contentVersion) => ({
            scenarioId: item.scenarioId,
            contentVersion,
          })),
        ),
        catalog,
      ),
    );
  const issue = (path: string): void => {
    issues.push({ code: 'INVALID_CAMPAIGN_REFERENCE', path });
  };
  const unique = (keys: readonly (string | number)[], path: string): void => {
    if (new Set(keys).size !== keys.length) issue(path);
  };
  for (const key of [
    'references',
    'acts',
    'incidents',
    'evidence',
    'narratives',
    'effects',
  ] as const)
    unique(
      d[key].map((item) => item.id),
      key,
    );
  for (const key of ['evidence', 'narratives', 'completed'] as const)
    unique(d.initial[key], 'initial.' + key);
  const conditions = (
    node: CampaignDefinition['acts'][number]['eligibility'],
    kind: 'effect' | 'progression',
  ): void => {
    issues.push(...validateConditionReferences(node, d.references, d.version, kind));
  };
  const hasAct = (act: number): boolean => d.acts.some((item) => item.id === act);
  if (!hasAct(d.initial.act)) issue('initial.act');
  for (const act of d.acts) conditions(act.eligibility, 'progression');
  for (const item of d.incidents) {
    if (!hasAct(item.act)) issue(item.id + '.act');
    unique(campaignContentVersions(item), item.id + '.contentVersions');
    for (const contentVersion of campaignContentVersions(item)) {
      const scenario = scenarioFor(item.scenarioId, contentVersion);
      if (
        !scenario ||
        !scenarioSchema.safeParse(scenario).success ||
        !validateScenarioObject(scenario).success ||
        scenario.id !== item.scenarioId ||
        scenario.contentVersion !== contentVersion
      )
        issue(item.id + '.scenario');
    }
    conditions(item.eligibility, 'progression');
  }
  for (const item of [...d.evidence, ...d.narratives]) {
    const incidents = d.incidents.filter((candidate) => candidate.scenarioId === item.scenarioId);
    if (!incidents.length) issue(item.id);
    for (const incident of incidents) {
      for (const contentVersion of campaignContentVersions(incident)) {
        const scenario = scenarioFor(incident.scenarioId, contentVersion);
        if (
          'evidenceId' in item
            ? !scenario?.evidence.some((entry) => entry.id === item.evidenceId)
            : !scenario?.narratives.some((entry) => entry.id === item.narrativeId)
        )
          issue(item.id);
      }
    }
  }
  for (const ref of d.references) {
    if (ref.version !== d.version) issue(ref.id);
    const keys: Record<typeof ref.source, readonly string[]> = {
      act: ['current'],
      alignment: Object.keys(d.initial.alignment),
      value: Object.keys(d.initial.values),
      evidence: d.evidence.map((item) => item.id),
      completed: d.incidents.map((item) => item.id),
      narrative_flag: Object.keys(d.initial.narrativeFlags),
      ending_flag: Object.keys(d.initial.endingFlags),
      metric: metricKeys,
    };
    if (!keys[ref.source].includes(ref.key)) issue(ref.id);
    const expectedType = ['act', 'alignment', 'value', 'metric'].includes(ref.source)
      ? 'number'
      : 'boolean';
    if (ref.valueType !== expectedType) issue(ref.id + '.valueType');
  }
  for (const [key, allowed] of [
    ['evidence', d.evidence.map((item) => item.id)],
    ['narratives', d.narratives.map((item) => item.id)],
    ['completed', d.incidents.map((item) => item.id)],
  ] as const)
    for (const entry of d.initial[key]) if (!allowed.includes(entry)) issue('initial.' + key);
  for (const effect of d.effects) {
    // Only TASK-023's verified resolved-ending transition may grant ending flags.
    if (Object.keys(effect.endingFlags).length) issue(effect.id + '.unsupportedEndingGrant');
    const incident = d.incidents.find((item) => item.id === effect.trigger.incidentId);
    if (!incident) issue(effect.id + '.trigger');
    else {
      const triggers = campaignEffectTriggers(effect, incident);
      unique(triggers.map(canonicalJson), effect.id + '.triggers');
      for (const trigger of triggers) {
        const scenario = scenarioFor(incident.scenarioId, trigger.contentVersion);
        if (!campaignContentVersions(incident).includes(trigger.contentVersion) || !scenario)
          issue(effect.id + '.trigger.contentVersion');
        else if (trigger.type === 'evidence_revealed') {
          if (!scenario.evidence.some((item) => item.id === trigger.targetId))
            issue(effect.id + '.trigger.targetId');
        } else if (trigger.type === 'narrative_triggered') {
          if (!scenario.narratives.some((item) => item.id === trigger.targetId))
            issue(effect.id + '.trigger.targetId');
        } else if (trigger.targetId !== undefined) issue(effect.id + '.trigger.targetId');
      }
    }
    conditions(effect.condition, 'effect');
    for (const key of Object.keys(effect.narrativeFlags))
      if (!Object.hasOwn(d.initial.narrativeFlags, key))
        issue(effect.id + '.narrativeFlags.' + key);
    for (const key of Object.keys(effect.endingFlags))
      if (!Object.hasOwn(d.initial.endingFlags, key)) issue(effect.id + '.endingFlags.' + key);
    if (effect.act !== undefined && !hasAct(effect.act)) issue(effect.id + '.act');
  }
  // Canonical validation also rejects executable/non-JSON input before publication.
  try {
    canonicalJson(input);
  } catch {
    issue('$');
  }
  return issues.length
    ? { ok: false, diagnostics: orderedDiagnostics(issues) }
    : { ok: true, definition: d };
}

export function parseCampaignYaml(
  source: string,
  catalog: ReadonlyMap<string, Scenario>,
): CampaignDefinitionResult {
  try {
    const document = parseDocument(source, { prettyErrors: false });
    if (!document.errors.length) return validateCampaignDefinition(document.toJS(), catalog);
  } catch {
    // Parser/conversion failures, including alias limits, are invalid input, not engine crashes.
  }
  return { ok: false, diagnostics: [{ code: 'INVALID_CAMPAIGN_YAML', path: '$' }] };
}

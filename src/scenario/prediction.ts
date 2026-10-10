import { z } from 'zod';
import {
  conditionSchema,
  validateConditionReferences,
  orderedDiagnostics,
  type Reference,
  type CampaignDiagnostic,
} from '../engine/campaign/conditions.ts';
import { scenarioVersionKey } from './catalog.ts';
import { scenarioSchema, type Scenario } from './schema.ts';

const id = z.string().min(1);
const reference = z
  .object({
    id,
    version: id,
    valueType: z.enum(['number', 'boolean', 'string']),
    source: z.enum([
      'campaign',
      'elapsedSeconds',
      'signal',
      'resource',
      'flag',
      'signal_revealed',
      'evidence',
    ]),
    key: id,
  })
  .strict();
const supported = z
  .object({
    scenarioId: id,
    contentVersion: id,
    coverage: z.literal('supported'),
    references: z.array(reference),
    contexts: z
      .array(
        z
          .object({
            contextId: id,
            when: conditionSchema,
            reveal: conditionSchema,
            choices: z
              .array(
                z.object({ actionId: id, candidateId: id, eligible: conditionSchema }).strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export const predictionDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: id,
    classificationVersion: id,
    formulaVersion: z.literal(1),
    contexts: z
      .array(
        z
          .object({
            id,
            candidates: z.array(id).min(1),
            minimumSamples: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          })
          .strict(),
      )
      .min(1),
    scenarios: z
      .array(
        z.discriminatedUnion('coverage', [
          supported,
          z
            .object({
              scenarioId: id,
              contentVersion: id,
              coverage: z.literal('unsupported'),
              reason: id,
            })
            .strict(),
        ]),
      )
      .min(1),
  })
  .strict();
export type PredictionDefinition = z.infer<typeof predictionDefinitionSchema>;
export type PredictionScenario = z.infer<typeof supported>;

export function predictionReferences(mapping: PredictionScenario): Reference[] {
  return mapping.references.map((ref) => ({
    id: ref.id,
    version: ref.version,
    valueType: ref.valueType,
    source: 'value',
    key: ref.id,
    contexts: ['branch'],
  }));
}

export function validatePredictionDefinition(
  model: PredictionDefinition,
  allowed: readonly { scenarioId: string; contentVersion: string }[],
  catalog: ReadonlyMap<string, Scenario>,
  campaignReferences: readonly Reference[],
): CampaignDiagnostic[] {
  const issues: CampaignDiagnostic[] = [];
  const issue = (path: string) => {
    issues.push({ code: 'INVALID_PREDICTION_REFERENCE', path });
  };
  const unique = (keys: string[], path: string) => {
    if (new Set(keys).size !== keys.length) issue(path);
  };
  const key = (entry: { scenarioId: string; contentVersion: string }) =>
    scenarioVersionKey(entry.scenarioId, entry.contentVersion);
  unique(
    model.contexts.map((c) => c.id),
    'prediction.contexts',
  );
  for (const context of model.contexts)
    unique(context.candidates, 'prediction.' + context.id + '.candidates');
  unique(model.scenarios.map(key), 'prediction.scenarios');
  for (const entry of allowed)
    if (!model.scenarios.some((m) => key(m) === key(entry)))
      issue('prediction.coverage.' + key(entry));
  for (const mapping of model.scenarios) {
    const path = 'prediction.' + key(mapping);
    if (!allowed.some((m) => key(m) === key(mapping))) issue(path);
    const parsedScenario = scenarioSchema.safeParse(catalog.get(key(mapping)));
    if (!parsedScenario.success || mapping.coverage === 'unsupported') continue;
    const scenario = parsedScenario.data;
    unique(
      mapping.references.map((r) => r.id),
      path + '.references',
    );
    unique(
      mapping.contexts.map((c) => c.contextId),
      path + '.contexts',
    );
    for (const context of model.contexts)
      if (!mapping.contexts.some((c) => c.contextId === context.id))
        issue(path + '.context.' + context.id);
    for (const ref of mapping.references) {
      let type: string | undefined;
      if (ref.source === 'campaign') {
        const source = campaignReferences.find(
          (r) => r.id === ref.key && r.contexts.includes('branch'),
        );
        type = source?.valueType;
      } else if (ref.source === 'elapsedSeconds')
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
      else if (
        ref.source === 'signal_revealed' &&
        scenario.initialState.signals.some((s) => s.id === ref.key)
      )
        type = 'boolean';
      else if (ref.source === 'evidence' && scenario.evidence.some((e) => e.id === ref.key))
        type = 'boolean';
      if (ref.version !== model.version || type !== ref.valueType)
        issue(path + '.references.' + ref.id);
    }
    for (const context of mapping.contexts) {
      const group = model.contexts.find((c) => c.id === context.contextId);
      if (!group) issue(path + '.' + context.contextId);
      unique(
        context.choices.map((c) => c.actionId),
        path + '.' + context.contextId + '.actions',
      );
      unique(
        context.choices.map((c) => c.candidateId),
        path + '.' + context.contextId + '.candidates',
      );
      for (const choice of context.choices)
        if (
          !scenario.actions.some((a) => a.id === choice.actionId) ||
          !group?.candidates.includes(choice.candidateId)
        )
          issue(path + '.' + context.contextId + '.' + choice.actionId);
      for (const tree of [context.when, context.reveal, ...context.choices.map((c) => c.eligible)])
        issues.push(
          ...validateConditionReferences(
            tree,
            predictionReferences(mapping),
            model.version,
            'branch',
          ),
        );
    }
  }
  return orderedDiagnostics(issues);
}

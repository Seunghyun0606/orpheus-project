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

const id = z.string().min(1);
export const endingDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: id,
    behaviorVersion: id.optional(),
    predictionVersion: id.optional(),
    finals: z
      .array(
        z
          .object({
            incidentId: id,
            contentVersion: id,
            eligible: conditionSchema,
            references: z.array(
              z
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
                    'evidence',
                    'action',
                    'completion',
                    'resolution',
                  ]),
                  key: id,
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .min(1),
    entries: z
      .array(
        z
          .object({
            id,
            version: id,
            priorityRank: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
            condition: conditionSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type EndingDefinition = z.infer<typeof endingDefinitionSchema>;
export type EndingFinal = EndingDefinition['finals'][number];

export function endingReferences(final: EndingFinal): Reference[] {
  return final.references.map((ref) => ({
    id: ref.id,
    version: ref.version,
    valueType: ref.valueType,
    source: 'value',
    key: ref.id,
    contexts: ['ending'],
  }));
}

// The full campaign authority pins these models and exact final content versions.
export function validateEndingDefinition(
  model: EndingDefinition,
  campaign: CampaignDefinition,
  catalog: ReadonlyMap<string, Scenario>,
): CampaignDiagnostic[] {
  const issues: CampaignDiagnostic[] = [];
  const issue = (path: string) => {
    issues.push({ code: 'INVALID_ENDING_REFERENCE', path });
  };
  const unique = (keys: string[], path: string) => {
    if (new Set(keys).size !== keys.length) issue(path);
  };
  unique(
    model.entries.map((e) => e.id),
    'endings.entries',
  );
  unique(
    model.finals.map((f) => JSON.stringify([f.incidentId, f.contentVersion])),
    'endings.finals',
  );
  if (model.behaviorVersion !== undefined && model.behaviorVersion !== campaign.behavior?.version)
    issue('endings.behaviorVersion');
  if (
    model.predictionVersion !== undefined &&
    model.predictionVersion !== campaign.prediction?.version
  )
    issue('endings.predictionVersion');
  for (const entry of model.entries)
    if (entry.version !== model.version) issue('endings.' + entry.id + '.version');
  for (const final of model.finals) {
    const path = 'endings.' + JSON.stringify([final.incidentId, final.contentVersion]);
    const incident = campaign.incidents.find((i) => i.id === final.incidentId);
    const allowed = incident && [
      incident.contentVersion,
      ...(incident.compatibleContentVersions ?? []),
    ];
    const parsed = scenarioSchema.safeParse(
      incident && catalog.get(scenarioVersionKey(incident.scenarioId, final.contentVersion)),
    );
    if (!allowed?.includes(final.contentVersion) || !parsed.success) {
      issue(path + '.contentVersion');
      continue;
    }
    const scenario = parsed.data;
    unique(
      final.references.map((r) => r.id),
      path + '.references',
    );
    for (const ref of final.references) {
      let type: string | undefined;
      if (ref.source === 'campaign') {
        const source = campaign.references.find(
          (r) => r.id === ref.key && r.contexts.includes('ending'),
        );
        type = source?.valueType;
        if (
          source?.source === 'metric' &&
          (!campaign.behavior || model.behaviorVersion !== campaign.behavior.version)
        )
          issue(path + '.references.' + ref.id + '.behaviorVersion');
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
      else if (ref.source === 'evidence' && scenario.evidence.some((e) => e.id === ref.key))
        type = 'boolean';
      else if (ref.source === 'action' && scenario.actions.some((a) => a.id === ref.key))
        type = 'boolean';
      else if (
        (ref.source === 'completion' || ref.source === 'resolution') &&
        ref.key === 'current'
      )
        type = 'boolean';
      if (ref.version !== model.version || ref.valueType !== type)
        issue(path + '.references.' + ref.id);
    }
    for (const tree of [final.eligible, ...model.entries.map((entry) => entry.condition)])
      issues.push(
        ...validateConditionReferences(tree, endingReferences(final), model.version, 'ending'),
      );
  }
  return orderedDiagnostics(issues);
}

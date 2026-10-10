import { z } from 'zod';
import {
  conditionSchema,
  validateConditionReferences,
  orderedDiagnostics,
  type CampaignDiagnostic,
  type Reference,
} from '../engine/campaign/conditions.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { scenarioVersionKey } from './catalog.ts';
import { scenarioSchema, type Scenario, type ScenarioEffect } from './schema.ts';

export const metricKeys = [
  'restartRate',
  'rollbackRate',
  'evidenceBeforeActionRate',
  'aiRecommendationAcceptanceRate',
  'averageInvestigationDepth',
  'safetyPreference',
  'collateralDamageTolerance',
  'companyReportingRate',
  'nullCooperationRate',
  'predictionDeviation',
] as const;
export type BehaviorMetricKey = (typeof metricKeys)[number];
const id = z.string().min(1);
const delivery = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('action') }).strict(),
  z.object({ kind: z.literal('timer'), eventId: id }).strict(),
]);
const result = z.discriminatedUnion('kind', [
  // An explicitly authored immediate tool observation, not a generic action category.
  z.object({ kind: z.literal('action_completed') }).strict(),
  z.object({ kind: z.literal('signal_revealed'), signalId: id, delivery }).strict(),
  z.object({ kind: z.literal('war_room_message'), messageId: id, delivery }).strict(),
]);
export const behaviorReferenceSchema = z
  .object({
    id,
    version: id,
    valueType: z.enum(['number', 'boolean', 'string']),
    source: z.enum([
      'elapsedSeconds',
      'ageSeconds',
      'supportKey',
      'actionId',
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
    references: z.array(behaviorReferenceSchema),
    actions: z.array(
      z
        .object({
          actionId: id,
          operational: z.boolean(),
          restart: z.boolean(),
          rollback: z.boolean(),
          evidenceEligible: z.boolean(),
        })
        .strict(),
    ),
    investigations: z.array(z.object({ id, key: id, actionId: id, result }).strict()),
    supportRules: z.array(
      z
        .object({
          id,
          actionId: id,
          investigationKeys: z.array(id).min(1),
          relevance: conditionSchema,
          freshness: conditionSchema,
        })
        .strict(),
    ),
  })
  .strict();
export const behaviorDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: id,
    classificationVersion: id,
    formulaVersion: z.literal(1),
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
export type BehaviorDefinition = z.infer<typeof behaviorDefinitionSchema>;
export type BehaviorScenario = z.infer<typeof supported>;

// Use the shared strict tree evaluator without granting arbitrary property access.
export function behaviorConditionReferences(mapping: BehaviorScenario): Reference[] {
  return mapping.references.map((ref) => ({
    id: ref.id,
    version: ref.version,
    valueType: ref.valueType,
    source: 'value',
    key: ref.id,
    contexts: ['effect'],
  }));
}

export function validateBehaviorDefinition(
  model: BehaviorDefinition,
  allowed: readonly { scenarioId: string; contentVersion: string }[],
  catalog: ReadonlyMap<string, Scenario>,
): CampaignDiagnostic[] {
  const issues: CampaignDiagnostic[] = [];
  const issue = (path: string): void => {
    issues.push({ code: 'INVALID_BEHAVIOR_REFERENCE', path });
  };
  const unique = (keys: string[], path: string): void => {
    if (new Set(keys).size !== keys.length) issue(path);
  };
  const key = (entry: { scenarioId: string; contentVersion: string }) =>
    scenarioVersionKey(entry.scenarioId, entry.contentVersion);
  unique(model.scenarios.map(key), 'behavior.scenarios');
  for (const entry of allowed)
    if (!model.scenarios.some((m) => key(m) === key(entry)))
      issue('behavior.coverage.' + key(entry));
  const semantics = new Map<string, string>();
  for (const mapping of model.scenarios) {
    const path = 'behavior.' + key(mapping);
    if (!allowed.some((m) => key(m) === key(mapping))) issue(path);
    const parsedScenario = scenarioSchema.safeParse(catalog.get(key(mapping)));
    if (!parsedScenario.success || mapping.coverage === 'unsupported') continue;
    const scenario = parsedScenario.data;
    unique(
      mapping.actions.map((a) => a.actionId),
      path + '.actions',
    );
    unique(
      mapping.references.map((r) => r.id),
      path + '.references',
    );
    unique(
      mapping.investigations.map((r) => r.id),
      path + '.investigations',
    );
    unique(
      mapping.supportRules.map((r) => r.id),
      path + '.supportRules',
    );
    for (const action of scenario.actions)
      if (!mapping.actions.some((a) => a.actionId === action.id))
        issue(path + '.actions.' + action.id);
    for (const action of mapping.actions) {
      if (
        !scenario.actions.some((a) => a.id === action.actionId) ||
        ((action.restart || action.rollback) && !action.operational)
      )
        issue(path + '.actions.' + action.actionId);
      if (
        action.evidenceEligible &&
        !mapping.supportRules.some((r) => r.actionId === action.actionId)
      )
        issue(path + '.supportRules.' + action.actionId);
    }
    for (const ref of mapping.references) {
      let type: string | undefined;
      if (['elapsedSeconds', 'ageSeconds'].includes(ref.source))
        type = ref.key === 'current' ? 'number' : undefined;
      else if (['supportKey', 'actionId'].includes(ref.source))
        type = ref.key === 'current' ? 'string' : undefined;
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
    // Timer origins must be statically unambiguous in this first representation.
    // No guessing the parent of schedule_event from the most recent UI command.
    const otherEffects: ScenarioEffect[] = [
      ...scenario.events.flatMap((e) => e.effects),
      ...scenario.narratives.flatMap((n) => n.effects),
      ...scenario.resolution.effects,
      ...scenario.completion.effects,
      ...scenario.actions.flatMap((a) =>
        a.temporaryEffects.flatMap((t) => [...t.apply, ...t.expire]),
      ),
    ];
    for (const rule of mapping.investigations) {
      const action = scenario.actions.find((a) => a.id === rule.actionId);
      if (!action) {
        issue(path + '.' + rule.id);
        continue;
      }
      let effects = action.effects;
      if (rule.result.kind === 'action_completed') {
        if (action.delegation || effects.some((e) => e.type === 'schedule_event'))
          issue(path + '.' + rule.id + '.pendingResult');
      } else {
        const sourceId =
          rule.result.delivery.kind === 'timer' ? rule.result.delivery.eventId : rule.actionId;
        const ambiguousSource =
          rule.result.delivery.kind === 'timer'
            ? scenario.actions.some((a) => a.id === sourceId)
            : scenario.events.some((e) => e.id === sourceId);
        if (
          ambiguousSource ||
          scenario.id === sourceId ||
          scenario.narratives.some((n) => n.id === sourceId) ||
          scenario.actions.some((a) => a.temporaryEffects.some((t) => t.id === sourceId))
        )
          issue(path + '.' + rule.id + '.ambiguousResultSource');
        if (rule.result.delivery.kind === 'timer') {
          const eventId = rule.result.delivery.eventId;
          const event = scenario.events.find((e) => e.id === eventId && e.type === 'timer');
          const schedulers = scenario.actions.flatMap((a) =>
            a.effects
              .filter((e) => e.type === 'schedule_event' && e.eventId === eventId)
              .map(() => a.id),
          );
          if (
            !event ||
            schedulers.length !== 1 ||
            schedulers[0] !== action.id ||
            otherEffects.some((e) => e.type === 'schedule_event' && e.eventId === eventId)
          )
            issue(path + '.' + rule.id + '.timerOrigin');
          effects = event?.effects ?? [];
        }
        const output = rule.result;
        if (
          !effects.some((e) =>
            output.kind === 'signal_revealed'
              ? e.type === 'reveal_signal' && e.signalId === output.signalId
              : e.type === 'post_message' && e.messageId === output.messageId,
          )
        )
          issue(path + '.' + rule.id + '.result');
      }
      // Delivery/source IDs may differ across compatible versions; the observation
      // key's result meaning must not silently change within the pinned model.
      const meaning = canonicalJson(
        rule.result.kind === 'action_completed'
          ? { kind: rule.result.kind, actionId: rule.actionId }
          : rule.result.kind === 'signal_revealed'
            ? { kind: rule.result.kind, signalId: rule.result.signalId }
            : { kind: rule.result.kind, messageId: rule.result.messageId },
      );
      const old = semantics.get(rule.key);
      if (old !== undefined && old !== meaning) issue(path + '.' + rule.id + '.conflictingKey');
      semantics.set(rule.key, meaning);
    }
    for (const rule of mapping.supportRules) {
      if (!mapping.actions.some((a) => a.actionId === rule.actionId && a.evidenceEligible))
        issue(path + '.' + rule.id + '.action');
      unique(rule.investigationKeys, path + '.' + rule.id + '.keys');
      for (const k of rule.investigationKeys)
        if (!mapping.investigations.some((r) => r.key === k))
          issue(path + '.' + rule.id + '.key.' + k);
      for (const tree of [rule.relevance, rule.freshness])
        issues.push(
          ...validateConditionReferences(
            tree,
            behaviorConditionReferences(mapping),
            model.version,
            'effect',
          ),
        );
    }
  }
  return orderedDiagnostics(issues);
}

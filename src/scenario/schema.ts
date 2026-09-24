import { z } from 'zod';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const contentVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const idSchema = z
  .string()
  .min(1)
  .regex(idPattern, 'Ids may contain letters, numbers, periods, underscores, and hyphens.');

const scalarSchema = z.union([z.number().finite(), z.string(), z.boolean()]);

const signalConditionSchema = z
  .object({
    type: z.literal('signal'),
    signalId: idSchema,
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
    value: scalarSchema,
  })
  .strict();

const resourceConditionSchema = z
  .object({
    type: z.literal('resource'),
    resourceId: idSchema,
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
    value: z.number().finite(),
  })
  .strict();

const flagConditionSchema = z
  .object({
    type: z.literal('flag'),
    flagId: idSchema,
    value: z.boolean(),
  })
  .strict();

const signalRevealedConditionSchema = z
  .object({
    type: z.literal('signal_revealed'),
    signalId: idSchema,
  })
  .strict();

const evidenceConditionSchema = z
  .object({
    type: z.literal('evidence'),
    evidenceId: idSchema,
  })
  .strict();

const actionCompletedConditionSchema = z
  .object({
    type: z.literal('action_completed'),
    actionId: idSchema,
  })
  .strict();

const mechanismResolvedConditionSchema = z
  .object({
    type: z.literal('mechanism_resolved'),
    mechanismId: idSchema,
  })
  .strict();

export const conditionSchema = z.discriminatedUnion('type', [
  signalConditionSchema,
  resourceConditionSchema,
  flagConditionSchema,
  signalRevealedConditionSchema,
  evidenceConditionSchema,
  actionCompletedConditionSchema,
  mechanismResolvedConditionSchema,
]);

const setSignalEffectSchema = z
  .object({ type: z.literal('set_signal'), signalId: idSchema, value: scalarSchema })
  .strict();
const changeSignalEffectSchema = z
  .object({ type: z.literal('change_signal'), signalId: idSchema, amount: z.number().finite() })
  .strict();
const changeResourceEffectSchema = z
  .object({
    type: z.literal('change_resource'),
    resourceId: idSchema,
    amount: z.number().finite(),
  })
  .strict();
const setFlagEffectSchema = z
  .object({ type: z.literal('set_flag'), flagId: idSchema, value: z.boolean() })
  .strict();
const scheduleEventEffectSchema = z
  .object({ type: z.literal('schedule_event'), eventId: idSchema })
  .strict();
const cancelEventEffectSchema = z
  .object({ type: z.literal('cancel_event'), eventId: idSchema })
  .strict();
const revealSignalEffectSchema = z
  .object({ type: z.literal('reveal_signal'), signalId: idSchema })
  .strict();
const unlockActionEffectSchema = z
  .object({ type: z.literal('unlock_action'), actionId: idSchema })
  .strict();
const revealEvidenceEffectSchema = z
  .object({ type: z.literal('reveal_evidence'), evidenceId: idSchema })
  .strict();
const triggerNarrativeEffectSchema = z
  .object({ type: z.literal('trigger_narrative'), narrativeId: idSchema })
  .strict();
const resolveMechanismEffectSchema = z
  .object({ type: z.literal('resolve_mechanism'), mechanismId: idSchema })
  .strict();

export const effectSchema = z.discriminatedUnion('type', [
  setSignalEffectSchema,
  changeSignalEffectSchema,
  changeResourceEffectSchema,
  setFlagEffectSchema,
  scheduleEventEffectSchema,
  cancelEventEffectSchema,
  revealSignalEffectSchema,
  unlockActionEffectSchema,
  revealEvidenceEffectSchema,
  triggerNarrativeEffectSchema,
  resolveMechanismEffectSchema,
]);

const causalElementSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .strict();

const serviceSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    dependsOn: z.array(idSchema).default([]),
  })
  .strict();

const signalSchema = z
  .object({
    id: idSchema,
    value: scalarSchema,
    revealed: z.boolean().default(false),
    serviceId: idSchema.optional(),
  })
  .strict();

const resourceSchema = z
  .object({
    id: idSchema,
    value: z.number().finite(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .strict()
  .refine(
    ({ min, max }) => min === undefined || max === undefined || min <= max,
    'Resource min must not exceed max.',
  );

const flagSchema = z.object({ id: idSchema, value: z.boolean() }).strict();

const resourceCostSchema = z.object({ resourceId: idSchema, amount: z.number().finite() }).strict();

const temporaryEffectSchema = z
  .object({
    id: idSchema,
    durationSeconds: z.number().int().positive(),
    apply: z.array(effectSchema).min(1),
    expire: z.array(effectSchema).default([]),
  })
  .strict();

const actionSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    category: z.enum([
      'OBSERVE',
      'DIAGNOSE',
      'DELEGATE',
      'MITIGATE',
      'MODIFY',
      'COMMUNICATE',
      'INVESTIGATE',
    ]),
    durationSeconds: z.number().int().nonnegative(),
    initiallyAvailable: z.boolean().default(false),
    requirements: z.array(conditionSchema).default([]),
    costs: z.array(resourceCostSchema).default([]),
    effects: z.array(effectSchema).default([]),
    temporaryEffects: z.array(temporaryEffectSchema).default([]),
  })
  .strict();

const timerEventSchema = z
  .object({
    id: idSchema,
    type: z.literal('timer'),
    delaySeconds: z.number().int().nonnegative(),
    targetServiceId: idSchema.optional(),
    cancellationConditions: z.array(conditionSchema).default([]),
    effects: z.array(effectSchema).min(1),
  })
  .strict();

const conditionalEventSchema = z
  .object({
    id: idSchema,
    type: z.literal('conditional'),
    targetServiceId: idSchema.optional(),
    conditions: z.array(conditionSchema).min(1),
    once: z.boolean().default(true),
    effects: z.array(effectSchema).min(1),
  })
  .strict();

export const eventSchema = z.discriminatedUnion('type', [timerEventSchema, conditionalEventSchema]);

const evidenceSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    sourceNarrativeId: idSchema.optional(),
  })
  .strict();

const narrativeSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    body: z.string().min(1),
    conditions: z.array(conditionSchema).default([]),
    effects: z.array(effectSchema).default([]),
  })
  .strict();

const conditionGroupSchema = z
  .object({
    mode: z.enum(['all', 'any']).default('all'),
    conditions: z.array(conditionSchema).min(1),
    effects: z.array(effectSchema).default([]),
  })
  .strict();

const scoringInputSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    source: z.enum(['elapsed_time', 'signal', 'resource', 'action_count']),
    refId: idSchema.optional(),
  })
  .strict()
  .superRefine(({ source, refId }, context) => {
    if (source !== 'elapsed_time' && refId === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['refId'],
        message: `Postmortem source ${source} requires refId.`,
      });
    }
    if (source === 'elapsed_time' && refId !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['refId'],
        message: 'Postmortem source elapsed_time must not define refId.',
      });
    }
  });

export const scenarioSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: z.string().regex(contentVersionPattern, 'Expected a semantic version.'),
    id: idSchema,
    title: z.string().min(1),
    act: z.number().int().positive(),
    severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']),
    services: z.array(serviceSchema).min(1),
    initialState: z
      .object({
        signals: z.array(signalSchema).min(1),
        resources: z.array(resourceSchema).min(1),
        flags: z.array(flagSchema).default([]),
      })
      .strict(),
    incident: z
      .object({
        trigger: causalElementSchema,
        contributingFactors: z.array(causalElementSchema).default([]),
        failureMechanisms: z.array(causalElementSchema).min(1),
        symptoms: z.array(causalElementSchema).min(1),
        amplifiers: z.array(causalElementSchema).default([]),
      })
      .strict(),
    actions: z.array(actionSchema).min(1),
    events: z.array(eventSchema).default([]),
    evidence: z.array(evidenceSchema).default([]),
    narratives: z.array(narrativeSchema).default([]),
    resolution: conditionGroupSchema,
    completion: conditionGroupSchema,
    postmortem: z.object({ scoringInputs: z.array(scoringInputSchema).min(1) }).strict(),
  })
  .strict();

export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioCondition = z.infer<typeof conditionSchema>;
export type ScenarioEffect = z.infer<typeof effectSchema>;
export type ScenarioEvent = z.infer<typeof eventSchema>;

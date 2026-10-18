import { parse } from 'yaml';
import { z } from 'zod';

// Story episodes (DEC-072): an Incident told as authored scenes. Evidence is
// collected by the scenes themselves; the player chooses a direction, makes a
// deduction once per Act, takes a timed decision and decides what to report.
// Text is English; translations live in the content catalogs (DEC-071).

export const END = 'END';

const id = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'IDs are UPPER_SNAKE_CASE');
const sceneId = z.string().regex(/^[a-z][a-z0-9-]*$/, 'scene IDs are lower-kebab-case');
const text = z.string().trim().min(1);

export const storyValues = [
  'publicInterest',
  'operationalSafety',
  'curiosity',
  'evidence',
  'teamTrust',
  'aiDependency',
  'collateralDamage',
] as const;
export const storyAlignments = ['corporate', 'null'] as const;

export type StoryValue = (typeof storyValues)[number];
export type StoryAlignment = (typeof storyAlignments)[number];

const delta = z.number().int();

const effectsSchema = z.strictObject({
  values: z.partialRecord(z.enum(storyValues), delta).optional(),
  alignment: z.partialRecord(z.enum(storyAlignments), delta).optional(),
  flags: z.record(id, z.boolean()).optional(),
  // Episode-local strain on customers and the team, shown as a meter.
  pressure: delta.optional(),
});

// All listed conditions must hold. `chose` entries are "scene.OPTION".
const choiceRef = z.string().regex(/^[a-z][a-z0-9-]*\.[A-Z][A-Z0-9_]*$/);
// Inclusive bounds on an accumulated value or alignment.
const bound = z
  .strictObject({ gte: z.number().int().optional(), lte: z.number().int().optional() })
  .refine((b) => b.gte !== undefined || b.lte !== undefined, 'give gte and/or lte');
const conditionSchema = z.strictObject({
  chose: z.array(choiceRef).min(1).optional(),
  notChose: z.array(choiceRef).min(1).optional(),
  has: z.array(id).min(1).optional(),
  lacks: z.array(id).min(1).optional(),
  flags: z.record(id, z.boolean()).optional(),
  solved: z.boolean().optional(),
  timedOut: z.boolean().optional(),
  // Accumulated across the campaign; beats only (the validator rejects them on
  // options, whose availability must be decided by choices and flags).
  values: z.partialRecord(z.enum(storyValues), bound).optional(),
  // This episode's pressure so far (beats only, like values).
  pressure: bound.optional(),
  alignment: z.partialRecord(z.enum(storyAlignments), bound).optional(),
});

const when = { when: conditionSchema.optional() };
const beatSchema = z.union([
  z.strictObject({ narrate: text, ...when }),
  z.strictObject({ speaker: id, text, ...when }),
  z.strictObject({ log: text, ...when }),
  z.strictObject({
    metric: z.strictObject({
      label: text,
      value: text,
      trend: z.enum(['up', 'down', 'flat']).optional(),
    }),
    ...when,
  }),
  z.strictObject({ collect: id, ...when }),
]);
const beats = z.array(beatSchema);

const optionSchema = z.strictObject({
  id,
  text,
  // Short visible cost, e.g. "Fast · will come back". Never "right"/"wrong".
  consequence: text.optional(),
  ...when,
  beats: beats.optional(),
  effects: effectsSchema.optional(),
  next: sceneId.or(z.literal(END)).optional(),
});

const next = { next: sceneId.or(z.literal(END)) };
const base = { id: sceneId, title: text.optional(), beats: beats.optional() };

const briefingSchema = z.strictObject({
  ...base,
  type: z.literal('briefing'),
  effects: effectsSchema.optional(),
  ...next,
});

const choiceSchema = z.strictObject({
  ...base,
  type: z.literal('choice'),
  prompt: text,
  // On by default for decisions; expiry applies the authored default option.
  timer: z
    .strictObject({ seconds: z.number().int().min(5), default: id, beats: beats.optional() })
    .optional(),
  options: z.array(optionSchema).min(2),
  next: sceneId.or(z.literal(END)).optional(),
});

const outcome = z.strictObject({ beats: beats.optional(), effects: effectsSchema.optional() });
const deductionSchema = z.strictObject({
  ...base,
  type: z.literal('deduction'),
  prompt: text,
  solution: z.array(id).min(1),
  attempts: z.number().int().min(1).max(3).default(2),
  // Said after each miss that leaves another attempt.
  hint: beats.optional(),
  solved: outcome,
  missed: outcome,
  ...next,
});

const sceneSchema = z.discriminatedUnion('type', [briefingSchema, choiceSchema, deductionSchema]);

export const episodeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^INC-\d{3}$/),
  act: z.number().int().min(1).max(9),
  title: text,
  cast: z.array(z.strictObject({ id, name: text })).min(1),
  evidence: z
    .array(
      z.strictObject({
        id,
        title: text,
        body: text,
        kind: z.enum(['operational', 'story']),
        // Collected on every path (checked by the validator).
        guaranteed: z.boolean().optional(),
      }),
    )
    .min(1),
  // Clue words shown in bold wherever they appear (in either language).
  keywords: z.array(text).optional(),
  start: sceneId,
  scenes: z.array(sceneSchema).min(1),
});

export type Episode = z.infer<typeof episodeSchema>;
export type Scene = Episode['scenes'][number];
export type ChoiceScene = Extract<Scene, { type: 'choice' }>;
export type DeductionScene = Extract<Scene, { type: 'deduction' }>;
export type StoryOption = ChoiceScene['options'][number];
export type Beat = z.infer<typeof beatSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Effects = z.infer<typeof effectsSchema>;

export function parseEpisode(source: string): Episode {
  return episodeSchema.parse(parse(source));
}

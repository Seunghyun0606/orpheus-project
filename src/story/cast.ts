import { parse } from 'yaml';
import { z } from 'zod';

import type { Episode } from './schema.ts';

// The cast file (DEC-072): who the player has met, shown in the status window.
// A person becomes known when one of their speakers talks (or once the episode
// in `from` begins, or once its `evidence` is collected); each line of their
// profile unlocks as the campaign goes on.
// Text is English; translations live in src/i18n/content/<locale>/story-cast.yaml.

const id = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'IDs are UPPER_SNAKE_CASE');
const episodeId = z.string().regex(/^INC-\d{3}$/);
const text = z.string().trim().min(1);

// Both given: both must hold. Neither: known as soon as the person is.
// `after`: that episode has ended (any later episode, or its own close).
// `flag`: the campaign flag is set (reveal flags are set mid-episode).
const unlock = { after: episodeId.optional(), flag: id.optional() };

const entrySchema = z.strictObject({ text, ...unlock });

const characterSchema = z
  .strictObject({
    id,
    // Episode cast IDs whose lines make this person known.
    speakers: z.array(id).default([]),
    // Known once this episode begins, spoken or not (log voices, the player).
    from: episodeId.optional(),
    // With `from`: known in that episode only once this evidence is collected
    // (a voice met in the logs), and from the next episode on.
    evidence: id.optional(),
    name: text,
    role: text,
    // Later names, roles and portraits, the last unlocked one wins. A portrait
    // names a file in godot/assets/portraits/ (without .png); the default is
    // the lower-case character id.
    updates: z
      .array(
        z
          .strictObject({
            name: text.optional(),
            role: text.optional(),
            portrait: z
              .string()
              .regex(/^[a-z0-9-]+$/)
              .optional(),
            ...unlock,
          })
          .refine(
            (u) => u.name !== undefined || u.role !== undefined || u.portrait !== undefined,
            'give name, role and/or portrait',
          ),
      )
      .default([]),
    traits: z.array(entrySchema).min(1),
    background: z.array(entrySchema).min(1),
  })
  .refine((c) => c.speakers.length > 0 || c.from !== undefined, 'give speakers or from')
  .refine((c) => c.evidence === undefined || c.from !== undefined, 'evidence needs from');

export const castSchema = z.strictObject({ characters: z.array(characterSchema).min(1) });

export type Cast = z.infer<typeof castSchema>;
export type Character = Cast['characters'][number];

export const parseCast = (source: string): Cast => castSchema.parse(parse(source));

export function validateCast(cast: Cast, episodes: readonly Episode[]): string[] {
  const problems: string[] = [];
  const episodeIds = new Set(episodes.map((episode) => episode.id));
  const castIds = new Set(episodes.flatMap((episode) => episode.cast.map((member) => member.id)));
  const flagsSet = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node !== null && typeof node === 'object') {
      const effects = (node as { effects?: { flags?: Record<string, boolean> } }).effects;
      for (const [flag, on] of Object.entries(effects?.flags ?? {})) if (on) flagsSet.add(flag);
      Object.values(node).forEach(visit);
    }
  };
  visit(episodes);
  const seen = new Set<string>();
  for (const character of cast.characters) {
    const at = character.id;
    if (seen.has(at)) problems.push(`${at}: duplicate character`);
    seen.add(at);
    for (const speaker of character.speakers)
      if (!castIds.has(speaker)) problems.push(`${at}: speaker ${speaker} is in no episode cast`);
    const from = episodes.find((episode) => episode.id === character.from);
    if (
      character.evidence !== undefined &&
      !from?.evidence.some((e) => e.id === character.evidence)
    )
      problems.push(`${at}: ${character.from} has no evidence ${character.evidence}`);
    const unlocks = [
      { after: character.from },
      ...character.updates,
      ...character.traits,
      ...character.background,
    ];
    for (const { after, flag } of unlocks) {
      if (after !== undefined && !episodeIds.has(after))
        problems.push(`${at}: episode ${after} does not exist`);
      if (flag !== undefined && !flagsSet.has(flag))
        problems.push(`${at}: no episode sets flag ${flag}`);
    }
  }
  return problems;
}

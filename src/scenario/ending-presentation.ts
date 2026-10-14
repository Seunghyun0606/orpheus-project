import { z } from 'zod';
import {
  conditionSchema,
  validateConditionReferences,
  type Reference,
} from '../engine/campaign/conditions.ts';
import type { CampaignDefinition } from './campaign.ts';
import { idSchema } from './schema.ts';

const text = z.string().min(1);
// Ending IDs intentionally use the existing ending schema's string identity:
// THE BOARD/THE FIRE/STATUS QUO contain spaces, unlike block/package IDs.
export const endingProseBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), id: idSchema, text }).strict(),
  z.object({ kind: z.literal('dialogue'), id: idSchema, speaker: text, text }).strict(),
  z
    .object({
      kind: z.literal('policy_report'),
      id: idSchema,
      text,
      provenance: z.enum(['authored_policy', 'authored_future']),
    })
    .strict(),
]);
const blocks = z.array(endingProseBlockSchema).min(1);
export const endingPresentationSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    version: text,
    definitionId: idSchema,
    definitionVersion: text,
    endingDefinitionId: text,
    endingDefinitionVersion: text,
    references: z.array(
      z
        .object({
          id: idSchema,
          version: text,
          source: z.literal('campaign'),
          key: idSchema,
          valueType: z.literal('boolean'),
        })
        .strict(),
    ),
    entries: z.array(z.object({ endingId: text, blocks }).strict()).min(1),
    sections: z.array(
      z
        .object({
          id: idSchema,
          title: text,
          endingIds: z.array(text).min(1),
          reveal: conditionSchema,
          blocks,
        })
        .strict(),
    ),
    closingBlocks: blocks,
  })
  .strict();
export type EndingPresentation = z.infer<typeof endingPresentationSchema>;
export type EndingProseBlock = z.infer<typeof endingProseBlockSchema>;
export function endingPresentationReferences(p: EndingPresentation): Reference[] {
  return p.references.map((ref) => ({
    id: ref.id,
    version: ref.version,
    valueType: ref.valueType,
    source: 'value',
    key: ref.id,
    contexts: ['ending'],
  }));
}
export function validateEndingPresentation(p: EndingPresentation, d: CampaignDefinition): string[] {
  const issues: string[] = [];
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) issues.push('DUPLICATE_ENDING_' + label);
  };
  if (
    p.definitionId !== d.id ||
    p.definitionVersion !== d.version ||
    !d.endings ||
    p.endingDefinitionId !== d.endings.id ||
    p.endingDefinitionVersion !== d.endings.version
  )
    issues.push('ENDING_PRESENTATION_AUTHORITY_MISMATCH');
  unique(
    p.entries.map((e) => e.endingId),
    'PROSE_ENTRY',
  );
  unique(
    p.sections.map((s) => s.id),
    'SECTION',
  );
  unique(
    p.references.map((r) => r.id),
    'REVEAL_REFERENCE',
  );
  const expected = new Set(d.endings?.entries.map((e) => e.id) ?? []);
  if (p.entries.length !== expected.size || p.entries.some((e) => !expected.has(e.endingId)))
    issues.push('ENDING_PROSE_COVERAGE');
  const allBlocks = [
    ...p.entries.flatMap((e) => e.blocks),
    ...p.sections.flatMap((s) => s.blocks),
    ...p.closingBlocks,
  ];
  unique(
    allBlocks.map((b) => b.id),
    'PROSE_BLOCK',
  );
  for (const ref of p.references) {
    const parent = d.references.find((r) => r.id === ref.key && r.contexts.includes('ending'));
    // Prose gates expose known discoveries only, not raw alignment/model scores.
    if (
      ref.version !== p.version ||
      !parent ||
      parent.version !== d.version ||
      parent.source !== 'narrative_flag' ||
      parent.valueType !== ref.valueType
    )
      issues.push('INVALID_ENDING_REVEAL_REFERENCE');
  }
  for (const section of p.sections) {
    unique(section.endingIds, 'SECTION_MEMBER');
    if (section.endingIds.some((id) => !expected.has(id)))
      issues.push('UNKNOWN_ENDING_SECTION_MEMBER');
    issues.push(
      ...validateConditionReferences(
        section.reveal,
        endingPresentationReferences(p),
        p.version,
        'ending',
      ).map((i) => i.code),
    );
  }
  return [...new Set(issues)].sort();
}

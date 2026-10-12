import { z } from 'zod';
import { conditionSchema as scenarioConditionSchema, idSchema, type Scenario } from './schema.ts';
import { conditionSchema, validateConditionReferences } from '../engine/campaign/conditions.ts';
import type { CampaignDefinition } from './campaign.ts';

const version = z.string().min(1);
export const presentationBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), id: idSchema, text: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('table'),
      id: idSchema,
      columns: z.array(z.string().min(1)).min(1),
      rows: z.array(z.array(z.string())),
    })
    .strict()
    .refine(
      (b) => b.rows.every((row) => row.length === b.columns.length),
      'Table rows must match columns.',
    ),
  z
    .object({ kind: z.literal('signals'), id: idSchema, signalIds: z.array(idSchema).min(1) })
    .strict(),
]);
export const investigationPresentationSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    version,
    scenarioId: idSchema,
    contentVersion: version,
    panels: z
      .array(
        z
          .object({
            id: idSchema,
            title: z.string().min(1),
            kind: z.enum([
              'logs',
              'metrics',
              'diagnostics',
              'status',
              'documents',
              'deployment',
              'trace',
              'infrastructure',
              'war_room',
            ]),
            // Both boundaries are explicit; navigation does not change either authority.
            reveal: z.array(scenarioConditionSchema).min(1),
            campaignReveal: conditionSchema,
            actionIds: z.array(idSchema),
            blocks: z.array(presentationBlockSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    evidenceRelations: z.array(
      z.object({ id: idSchema, from: idSchema, to: idSchema, label: z.string().min(1) }).strict(),
    ),
  })
  .strict();
export type InvestigationPresentation = z.infer<typeof investigationPresentationSchema>;

export function validateInvestigationPresentation(
  p: InvestigationPresentation,
  s: Scenario,
  d: CampaignDefinition,
): string[] {
  const issues: string[] = [];
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) issues.push('DUPLICATE_' + label);
  };
  if (p.scenarioId !== s.id || p.contentVersion !== s.contentVersion)
    issues.push('PRESENTATION_SCENARIO_MISMATCH');
  unique(
    p.panels.map((x) => x.id),
    'PANEL',
  );
  unique(
    p.evidenceRelations.map((x) => x.id),
    'RELATION',
  );
  for (const panel of p.panels) {
    unique(panel.actionIds, 'ACTION');
    unique(
      panel.blocks.map((b) => b.id),
      'BLOCK',
    );
    for (const id of panel.actionIds)
      if (!s.actions.some((a) => a.id === id)) issues.push('UNKNOWN_PRESENTATION_ACTION');
    for (const b of panel.blocks)
      if (b.kind === 'signals') {
        unique(b.signalIds, 'SIGNAL');
        for (const id of b.signalIds)
          if (!s.initialState.signals.some((x) => x.id === id))
            issues.push('UNKNOWN_PRESENTATION_SIGNAL');
      }
    for (const c of panel.reveal) {
      const known =
        c.type === 'signal' || c.type === 'signal_revealed'
          ? s.initialState.signals.some((x) => x.id === c.signalId)
          : c.type === 'resource'
            ? s.initialState.resources.some((x) => x.id === c.resourceId)
            : c.type === 'flag'
              ? s.initialState.flags.some((x) => x.id === c.flagId)
              : c.type === 'evidence'
                ? s.evidence.some((x) => x.id === c.evidenceId)
                : c.type === 'action_completed'
                  ? s.actions.some((x) => x.id === c.actionId)
                  : s.incident.failureMechanisms.some((x) => x.id === c.mechanismId);
      if (!known) issues.push('UNKNOWN_PRESENTATION_CONDITION');
      if (c.type === 'signal') {
        const signal = s.initialState.signals.find((x) => x.id === c.signalId);
        if (
          signal &&
          (typeof signal.value !== typeof c.value ||
            (typeof c.value !== 'number' && !['eq', 'neq'].includes(c.operator)))
        )
          issues.push('INVALID_PRESENTATION_COMPARISON');
      }
    }
    issues.push(
      ...validateConditionReferences(panel.campaignReveal, d.references, d.version, 'branch').map(
        (x) => x.code,
      ),
    );
  }
  for (const edge of p.evidenceRelations)
    if (![edge.from, edge.to].every((id) => d.evidence.some((e) => e.id === id)))
      issues.push('UNKNOWN_PRESENTATION_EVIDENCE');
  return [...new Set(issues)].sort();
}

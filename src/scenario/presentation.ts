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
export const investigationPresentationV1Schema = z
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
export const narrativeDeliverySchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('transient'),
      durationMs: z.number().int().min(1).max(60000),
      reducedMotionMode: z.literal('until_dismissed'),
      historyMode: z.literal('recorded'),
    })
    .strict(),
  z
    .object({
      mode: z.literal('until_dismissed'),
      reducedMotionMode: z.literal('until_dismissed'),
      historyMode: z.literal('recorded'),
    })
    .strict(),
]);
export type NarrativeDelivery = z.infer<typeof narrativeDeliverySchema>;
export const runtimePresentationBlockSchema = z.discriminatedUnion('kind', [
  ...presentationBlockSchema.options,
  z
    .object({
      kind: z.literal('narrative_stream'),
      id: idSchema,
      entries: z.array(
        z.object({ narrativeId: idSchema, delivery: narrativeDeliverySchema }).strict(),
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('war_room_stream'),
      id: idSchema,
      messageIds: z.array(idSchema),
      delegationActionIds: z.array(idSchema),
      capacityResourceIds: z.array(idSchema),
    })
    .strict(),
]);
export const investigationPresentationV2Schema = investigationPresentationV1Schema
  .extend({
    schemaVersion: z.literal(2),
    panels: z
      .array(
        investigationPresentationV1Schema.shape.panels.element
          .extend({
            blocks: z.array(runtimePresentationBlockSchema).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export const investigationPresentationSchema = z.discriminatedUnion('schemaVersion', [
  investigationPresentationV1Schema,
  investigationPresentationV2Schema,
]);
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
  if (p.schemaVersion === 2) {
    const delegated = s.actions.filter((a) => a.delegation);
    const narratives: string[] = [],
      messages: string[] = [],
      delegations: string[] = [],
      resources: string[] = [];
    for (const panel of p.panels)
      for (const block of panel.blocks) {
        if (block.kind === 'narrative_stream') {
          if (panel.kind !== 'logs') issues.push('INVALID_NARRATIVE_STREAM_PANEL');
          if (s.narratives.length && !block.entries.length) issues.push('EMPTY_NARRATIVE_STREAM');
          narratives.push(...block.entries.map((e) => e.narrativeId));
        } else if (block.kind === 'war_room_stream') {
          if (panel.kind !== 'war_room') issues.push('INVALID_WAR_ROOM_STREAM_PANEL');
          if (s.warRoom.messages.length && !block.messageIds.length)
            issues.push('EMPTY_MESSAGE_STREAM');
          if (
            delegated.length &&
            (!block.delegationActionIds.length || !block.capacityResourceIds.length)
          )
            issues.push('EMPTY_DELEGATION_STREAM');
          messages.push(...block.messageIds);
          delegations.push(...block.delegationActionIds);
          resources.push(...block.capacityResourceIds);
        }
      }
    const coverage = (actual: string[], expected: string[], kind: string) => {
      if (
        new Set(actual).size !== actual.length ||
        actual.length !== expected.length ||
        actual.some((id) => !expected.includes(id))
      )
        issues.push('INVALID_STREAM_' + kind + '_COVERAGE');
    };
    coverage(
      narratives,
      s.narratives.map((n) => n.id),
      'NARRATIVE',
    );
    coverage(
      messages,
      s.warRoom.messages.map((m) => m.id),
      'MESSAGE',
    );
    coverage(
      delegations,
      delegated.map((a) => a.id),
      'DELEGATION',
    );
    coverage(
      resources,
      [...new Set(delegated.map((a) => a.delegation!.capacityResourceId))],
      'CAPACITY',
    );
    if (
      s.warRoom.messages.some((m) => !s.warRoom.roles.some((r) => r.id === m.roleId)) ||
      delegated.some((a) => !s.warRoom.roles.some((r) => r.id === a.delegation!.roleId))
    )
      issues.push('UNKNOWN_STREAM_ROLE');
    if (resources.some((id) => !s.initialState.resources.some((r) => r.id === id)))
      issues.push('UNKNOWN_STREAM_RESOURCE');
  }
  return [...new Set(issues)].sort();
}

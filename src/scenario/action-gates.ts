import { z } from 'zod';
import {
  conditionSchema,
  validateConditionReferences,
  type CampaignDiagnostic,
} from '../engine/campaign/conditions.ts';
import type { CampaignDefinition } from './campaign.ts';
import type { Scenario, ScenarioEffect } from './schema.ts';
import { scenarioSchema } from './schema.ts';
import { scenarioVersionKey } from './catalog.ts';

const id = z.string().min(1);
export const actionGateSchema = z
  .object({
    id,
    incidentId: id,
    contentVersion: id,
    actionId: id,
    eligibility: conditionSchema,
  })
  .strict();

// Derived authoring analysis only; never a saved cache or keyword-based story rule.
export function protectedActionOutputs(d: CampaignDefinition, s: Scenario) {
  const actionIds = new Set(
    (d.actionGates ?? [])
      .filter((g) => {
        const i = d.incidents.find((i) => i.id === g.incidentId);
        return i?.scenarioId === s.id && g.contentVersion === s.contentVersion;
      })
      .map((g) => g.actionId),
  );
  const evidence = new Set<string>(),
    signals = new Set<string>(),
    narratives = new Set<string>(),
    messages = new Set<string>(),
    flags = new Set<string>();
  const collect = (effects: readonly ScenarioEffect[]) => {
    for (const e of effects) {
      if (e.type === 'reveal_evidence') evidence.add(e.evidenceId);
      if (e.type === 'reveal_signal') signals.add(e.signalId);
      if (e.type === 'trigger_narrative') narratives.add(e.narrativeId);
      if (e.type === 'post_message') messages.add(e.messageId);
      if (e.type === 'set_flag') flags.add(e.flagId);
    }
  };
  for (const a of s.actions)
    if (actionIds.has(a.id)) {
      collect(a.effects);
      for (const t of a.temporaryEffects) {
        collect(t.apply);
        collect(t.expire);
      }
    }
  // Automatic narrative evaluation is safe only after a mandatory accepted guard action.
  for (const n of s.narratives)
    if (n.conditions.some((c) => c.type === 'action_completed' && actionIds.has(c.actionId)))
      narratives.add(n.id);
  let changed = true;
  while (changed) {
    const size = narratives.size + evidence.size + signals.size + messages.size + flags.size;
    for (const n of s.narratives)
      if (
        n.conditions.some(
          (c) =>
            (c.type === 'evidence' && evidence.has(c.evidenceId)) ||
            ((c.type === 'signal' || c.type === 'signal_revealed') && signals.has(c.signalId)) ||
            (c.type === 'flag' && flags.has(c.flagId)),
        )
      )
        narratives.add(n.id);
    for (const n of s.narratives) if (narratives.has(n.id)) collect(n.effects);
    changed = size !== narratives.size + evidence.size + signals.size + messages.size + flags.size;
  }
  return { actionIds, evidence, signals, narratives, messages, flags };
}

export function validateActionGates(
  d: CampaignDefinition,
  catalog: ReadonlyMap<string, Scenario>,
): CampaignDiagnostic[] {
  const issues: CampaignDiagnostic[] = [];
  const add = (code: string, path: string) => issues.push({ code, path });
  if (!d.actionGates) return issues;
  if (d.replayVersion !== 2 || d.recordVersion !== 2)
    add('INVALID_ACTION_GATE_VERSION', 'actionGates');
  const ids = new Set<string>(),
    bindings = new Set<string>();
  const scenarios = new Map<string, Scenario>();
  for (const g of d.actionGates) {
    const binding = JSON.stringify([g.incidentId, g.contentVersion, g.actionId]);
    if (ids.has(g.id) || bindings.has(binding)) add('DUPLICATE_ACTION_GATE', g.id);
    ids.add(g.id);
    bindings.add(binding);
    const i = d.incidents.find((i) => i.id === g.incidentId);
    const parsed =
      i &&
      scenarioSchema.safeParse(catalog.get(scenarioVersionKey(i.scenarioId, g.contentVersion)));
    const s = parsed?.success ? parsed.data : undefined;
    if (
      !i ||
      ![i.contentVersion, ...(i.compatibleContentVersions ?? [])].includes(g.contentVersion) ||
      !s ||
      !s.actions.some((a) => a.id === g.actionId)
    ) {
      add('INVALID_ACTION_GATE_BINDING', g.id);
      continue;
    }
    scenarios.set(scenarioVersionKey(s.id, s.contentVersion), s);
    issues.push(...validateConditionReferences(g.eligibility, d.references, d.version, 'action'));
  }
  for (const [key, s] of scenarios) {
    const p = protectedActionOutputs(d, s);
    for (const i of d.incidents.filter(
      (i) =>
        i.scenarioId === s.id &&
        [i.contentVersion, ...(i.compatibleContentVersions ?? [])].includes(s.contentVersion),
    ))
      for (const actionId of p.actionIds)
        if (!bindings.has(JSON.stringify([i.id, s.contentVersion, actionId])))
          add('MISSING_ACTION_GATE_BINDING', i.id + '.' + actionId);
    const revealsProtected = (e: ScenarioEffect) =>
      (e.type === 'reveal_evidence' && p.evidence.has(e.evidenceId)) ||
      ((e.type === 'reveal_signal' || e.type === 'set_signal' || e.type === 'change_signal') &&
        p.signals.has(e.signalId)) ||
      (e.type === 'trigger_narrative' && p.narratives.has(e.narrativeId));
    const protectedEffect = (e: ScenarioEffect) =>
      revealsProtected(e) ||
      (e.type === 'post_message' && p.messages.has(e.messageId)) ||
      (e.type === 'set_flag' && p.flags.has(e.flagId));
    for (const a of s.actions)
      if (
        !p.actionIds.has(a.id) &&
        [...a.effects, ...a.temporaryEffects.flatMap((t) => [...t.apply, ...t.expire])].some(
          protectedEffect,
        )
      )
        add('UNGUARDED_REVEAL_PATH', key + '.actions.' + a.id);
    // trigger_narrative bypasses local conditions in the standalone simulation.
    // Protected prose must use condition-driven evaluation after action completion.
    for (const a of s.actions)
      if (
        [...a.effects, ...a.temporaryEffects.flatMap((t) => [...t.apply, ...t.expire])].some(
          (e) => e.type === 'trigger_narrative' && p.narratives.has(e.narrativeId),
        )
      )
        add('UNGUARDED_REVEAL_PATH', key + '.actions.' + a.id + '.explicitNarrativeTrigger');
    for (const n of s.narratives) {
      if (n.effects.some((e) => e.type === 'trigger_narrative' && p.narratives.has(e.narrativeId)))
        add('UNGUARDED_REVEAL_PATH', key + '.narratives.' + n.id + '.explicitNarrativeTrigger');
      const protectedNarrative = p.narratives.has(n.id) || n.effects.some(protectedEffect);
      if (
        protectedNarrative &&
        !n.conditions.some((c) => c.type === 'action_completed' && p.actionIds.has(c.actionId))
      )
        add('UNGUARDED_REVEAL_PATH', key + '.narratives.' + n.id);
    }
    for (const e of s.events)
      if (e.effects.some(protectedEffect)) add('UNGUARDED_REVEAL_PATH', key + '.events.' + e.id);
    if ([...s.resolution.effects, ...s.completion.effects].some(protectedEffect))
      add('UNGUARDED_REVEAL_PATH', key + '.completion');
    for (const signal of s.initialState.signals)
      if (signal.revealed && p.signals.has(signal.id))
        add('INITIAL_PROTECTED_REVEAL', key + '.signals.' + signal.id);
    for (const message of s.warRoom.messages)
      if (message.initial && p.messages.has(message.id))
        add('INITIAL_PROTECTED_REVEAL', key + '.messages.' + message.id);
    for (const e of d.evidence)
      if (
        e.scenarioId === s.id &&
        p.evidence.has(e.evidenceId) &&
        d.initial.evidence.includes(e.id)
      )
        add('INITIAL_PROTECTED_REVEAL', 'initial.evidence.' + e.id);
    for (const n of d.narratives)
      if (
        n.scenarioId === s.id &&
        p.narratives.has(n.narrativeId) &&
        d.initial.narratives.includes(n.id)
      )
        add('INITIAL_PROTECTED_REVEAL', 'initial.narratives.' + n.id);
  }
  return issues;
}

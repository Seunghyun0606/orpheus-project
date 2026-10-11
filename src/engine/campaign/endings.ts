import { z } from 'zod';
import { validateCampaignDefinition } from '../../scenario/campaign.ts';
import { endingReferences } from '../../scenario/ending.ts';
import type { Scenario } from '../../scenario/schema.ts';
import { canonicalJson } from './canonical.ts';
import {
  campaignAttemptHead,
  campaignObservations,
  replayCampaign,
  type CampaignRun,
} from './transitions.ts';
import {
  evaluateCampaignCondition,
  orderedDiagnostics,
  type CampaignDiagnostic,
  type Observation,
} from './conditions.ts';

export interface EndingBoundary {
  runId: string;
  historyBoundary: number;
  attemptId: string;
  incidentId: string;
  scenarioId: string;
  contentVersion: string;
  priorHead: string;
  definitionId: string;
  definitionVersion: string;
  endingDefinitionId: string;
  endingDefinitionVersion: string;
}
export interface EndingAction {
  operationId: string;
  inputId: string;
  operationSequence: number;
  commandSequence: number;
  actionId: string;
}
interface EndingSupport {
  boundary: EndingBoundary;
  finalActions: EndingAction[];
  matched: { id: string; version: string; priorityRank: number }[];
}
export type EndingResult =
  | { ok: false; diagnostics: CampaignDiagnostic[] }
  | {
      ok: true;
      result: EndingSupport &
        (
          | { kind: 'resolved'; endingId: string }
          | { kind: 'ambiguous'; topIds: string[] }
          | { kind: 'no-match' }
        );
    };
const fail = (code: string, path = '$'): EndingResult => ({
  ok: false,
  diagnostics: [{ code, path }],
});
const requestSchema = z
  .object({ attemptId: z.string().min(1), priorHead: z.string().min(1) })
  .strict();

// Read-only tool/test query: no ending grant, storage I/O or caller-owned final state.
export function resolveCampaignEnding(
  definition: unknown,
  catalog: ReadonlyMap<string, Scenario>,
  run: CampaignRun,
  request: unknown,
): EndingResult {
  try {
    canonicalJson(run);
    canonicalJson(request);
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success) return fail('INVALID_ENDING_REQUEST');
    const checked = validateCampaignDefinition(definition, catalog);
    if (!checked.ok) return checked;
    const d = checked.definition;
    const verified = replayCampaign(d, catalog, run.operations);
    if (!verified.ok || canonicalJson(verified.run) !== canonicalJson(run))
      return fail('INVALID_PRIOR_RECORD');
    const model = d.endings;
    if (!model) return fail('MISSING_ENDING_DEFINITION');
    const attempt = verified.run.attempts.find((a) => a.id === parsed.data.attemptId);
    if (!attempt || campaignAttemptHead(attempt) !== parsed.data.priorHead)
      return fail('INVALID_FINAL_ATTEMPT');
    const mapping = model.finals.find(
      (f) =>
        f.incidentId === attempt.incidentId && f.contentVersion === attempt.incident.contentVersion,
    );
    if (!mapping) return fail('UNSUPPORTED_FINAL_CONTEXT');
    const incident = attempt.incident;
    // An inherited/legacy completion cannot establish a new official final completion.
    if (
      !incident.completionReached ||
      !incident.eventLog
        .slice(attempt.baselineEventCount)
        .some((e) => e.type === 'completion_reached')
    )
      return fail('MISSING_FINAL_COMPLETION');
    const finalActions: EndingAction[] = run.operations.flatMap((op) =>
      op.kind === 'command' && op.attemptId === attempt.id
        ? [
            {
              operationId: op.operationId,
              inputId: op.inputId,
              operationSequence: op.sequence,
              commandSequence: op.commandSequence,
              actionId: op.command.actionId,
            },
          ]
        : [],
    );
    const campaign = campaignObservations(d, verified.run);
    const observations = Object.fromEntries(
      mapping.references.map((ref): [string, Observation] => {
        if (ref.source === 'campaign') return [ref.id, campaign[ref.key]!];
        let value: string | number | boolean;
        switch (ref.source) {
          case 'elapsedSeconds':
            value = incident.elapsedSeconds;
            break;
          case 'signal':
            value = incident.signals[ref.key]!.value;
            break;
          case 'resource':
            value = incident.resources[ref.key]!.value;
            break;
          case 'flag':
            value = incident.flags[ref.key]!;
            break;
          case 'evidence':
            value = incident.revealedEvidenceIds.includes(ref.key);
            break;
          case 'action':
            value = finalActions.some((a) => a.actionId === ref.key);
            break;
          case 'completion':
            value = incident.completionReached;
            break;
          case 'resolution':
            value = incident.resolutionReached;
            break;
        }
        return [ref.id, { status: 'available', value }];
      }),
    );
    const context = {
      definitionVersion: model.version,
      kind: 'ending' as const,
      runId: run.runId,
      boundary: run.revision,
      observations,
    };
    const registry = endingReferences(mapping);
    const eligible = evaluateCampaignCondition(mapping.eligible, registry, context);
    const diagnostics: CampaignDiagnostic[] = eligible.ok ? [] : eligible.diagnostics;
    const matched: EndingSupport['matched'] = [];
    // Validate/evaluate every candidate, even beneath an unmet final gate or lower rank.
    for (const entry of model.entries) {
      const result = evaluateCampaignCondition(entry.condition, registry, context);
      if (!result.ok)
        diagnostics.push(
          ...result.diagnostics.map((e) => ({ ...e, path: entry.id + '.' + e.path })),
        );
      else if (result.value)
        matched.push({ id: entry.id, version: entry.version, priorityRank: entry.priorityRank });
    }
    if (diagnostics.length) return { ok: false, diagnostics: orderedDiagnostics(diagnostics) };
    if (eligible.ok && !eligible.value) return fail('INELIGIBLE_FINAL_CONTEXT');
    matched.sort(
      (a, b) => a.priorityRank - b.priorityRank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const support: EndingSupport = {
      boundary: {
        runId: run.runId,
        historyBoundary: run.revision,
        attemptId: attempt.id,
        incidentId: attempt.incidentId,
        scenarioId: incident.scenarioId,
        contentVersion: incident.contentVersion,
        priorHead: parsed.data.priorHead,
        definitionId: d.id,
        definitionVersion: d.version,
        endingDefinitionId: model.id,
        endingDefinitionVersion: model.version,
      },
      finalActions,
      matched,
    };
    if (!matched.length) return { ok: true, result: { ...support, kind: 'no-match' } };
    const top = matched.filter((e) => e.priorityRank === matched[0]!.priorityRank);
    return {
      ok: true,
      result:
        top.length === 1
          ? { ...support, kind: 'resolved', endingId: top[0]!.id }
          : { ...support, kind: 'ambiguous', topIds: top.map((e) => e.id) },
    };
  } catch {
    return fail('INVALID_JSON_OR_RECORD');
  }
}

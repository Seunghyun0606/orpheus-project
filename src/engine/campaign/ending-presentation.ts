import type { ResolvedCampaignPackage } from '../../scenario/campaign-package.ts';
import {
  endingPresentationSchema,
  validateEndingPresentation,
  endingPresentationReferences,
  type EndingProseBlock,
} from '../../scenario/ending-presentation.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import { evaluateCampaignCondition, type Observation } from './conditions.ts';
import { resolveCampaignEnding, type EndingBoundary } from './endings.ts';
import { campaignObservations, type CampaignRun } from './transitions.ts';

export type EndingPresentationResult =
  | { ok: false; diagnostics: string[] }
  | { ok: true; kind: 'no-match' | 'ambiguous'; topIds: string[] }
  | {
      ok: true;
      kind: 'resolved';
      endingId: string;
      boundary: EndingBoundary;
      blocks: EndingProseBlock[];
      sections: { id: string; title: string; blocks: EndingProseBlock[] }[];
      closingBlocks: EndingProseBlock[];
      finalRecord: {
        elapsedSeconds: number;
        completed: boolean;
        recovered: boolean;
        signals: { id: string; service: string; value: number | string | boolean }[];
        resources: { id: string; value: number }[];
      };
    };

// Caller supplies an exact request, not a precomputed/possibly stale winner or
// editable score object. No I/O, ACK, discovery, effect, ending grant or mutation.
export function projectCampaignEnding(
  p: ResolvedCampaignPackage,
  run: CampaignRun,
  request: { attemptId: string; priorHead: string },
): EndingPresentationResult {
  const fail = (diagnostics: string[]): EndingPresentationResult => ({ ok: false, diagnostics });
  try {
    const parsed = endingPresentationSchema.safeParse(p.endingPresentation);
    const binding = p.package.endingPresentation;
    if (!parsed.success || !binding) return fail(['MISSING_ENDING_PRESENTATION']);
    const prose = parsed.data;
    if (
      binding.id !== prose.id ||
      binding.version !== prose.version ||
      p.package.definitionId !== p.definition.id ||
      p.package.definitionVersion !== p.definition.version
    )
      return fail(['ENDING_PRESENTATION_BINDING_MISMATCH']);
    const issues = validateEndingPresentation(prose, p.definition);
    if (issues.length) return fail(issues);
    const resolved = resolveCampaignEnding(p.definition, p.catalog, run, request);
    if (!resolved.ok) return fail(resolved.diagnostics.map((d) => d.code + ':' + d.path));
    const result = resolved.result;
    if (result.kind !== 'resolved')
      return {
        ok: true,
        kind: result.kind,
        topIds: result.kind === 'ambiguous' ? result.topIds : [],
      };
    const attempt = run.attempts.find((a) => a.id === result.boundary.attemptId)!;
    const scenario = p.catalog.get(
      scenarioVersionKey(attempt.incident.scenarioId, attempt.incident.contentVersion),
    );
    const entry = prose.entries.find((e) => e.endingId === result.endingId);
    if (!scenario || !entry) return fail(['MISSING_RESOLVED_ENDING_AUTHORITY']);
    const campaign = campaignObservations(p.definition, run);
    const observations = Object.fromEntries(
      prose.references.map((ref): [string, Observation] => [
        ref.id,
        campaign[ref.key] ?? { status: 'unavailable', reason: 'missing_campaign_reference' },
      ]),
    );
    const sections: Extract<EndingPresentationResult, { kind: 'resolved' }>['sections'] = [];
    const diagnostics: string[] = [];
    // Validate/evaluate every declared gate, including a decisive nonmember.
    // Hidden content is never returned to the renderer before gate validation.
    for (const section of prose.sections) {
      const gate = evaluateCampaignCondition(section.reveal, endingPresentationReferences(prose), {
        definitionVersion: prose.version,
        kind: 'ending',
        runId: run.runId,
        boundary: run.revision,
        observations,
      });
      if (!gate.ok) diagnostics.push(...gate.diagnostics.map((d) => d.code + ':' + d.path));
      else if (gate.value && section.endingIds.includes(result.endingId))
        sections.push({
          id: section.id,
          title: section.title,
          blocks: structuredClone(section.blocks),
        });
    }
    if (diagnostics.length) return fail([...new Set(diagnostics)].sort());
    const incident = attempt.incident;
    return {
      ok: true,
      kind: 'resolved',
      endingId: result.endingId,
      boundary: result.boundary,
      blocks: structuredClone(entry.blocks),
      sections,
      closingBlocks: structuredClone(prose.closingBlocks),
      finalRecord: {
        elapsedSeconds: incident.elapsedSeconds,
        completed: incident.completionReached,
        recovered: incident.resolutionReached,
        signals: scenario.initialState.signals.flatMap((s) => {
          const actual = incident.signals[s.id];
          if (!s.serviceId || !actual?.revealed) return [];
          const service = scenario.services.find((v) => v.id === s.serviceId)?.name ?? s.serviceId;
          return [{ id: s.id, service, value: actual.value }];
        }),
        resources: scenario.initialState.resources.map((r) => ({
          id: r.id,
          value: incident.resources[r.id]!.value,
        })),
      },
    };
  } catch {
    return fail(['INVALID_ENDING_PRESENTATION_RECORD']);
  }
}

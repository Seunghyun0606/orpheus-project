import { evaluateCondition } from '../simulation.ts';
import { computePostmortem } from '../postmortem.ts';
import { evaluateCampaignCondition } from './conditions.ts';
import { campaignObservations, verifyCampaignRun, type CampaignRun } from './transitions.ts';
import type { ResolvedCampaignPackage } from '../../scenario/campaign-package.ts';
import { scenarioVersionKey } from '../../scenario/catalog.ts';
import { projectNarrativeStream, projectWarRoomStream } from './runtime-streams.ts';

// Read-only projection; no command, ACK, discovery or effect is generated here.
export function projectCampaignInvestigation(
  p: ResolvedCampaignPackage,
  run: CampaignRun,
  attemptId: string,
) {
  try {
    return projectVerifiedInvestigation(p, run, attemptId);
  } catch {
    return { ok: false as const, diagnostics: ['INVALID_INVESTIGATION_RECORD'] };
  }
}
function projectVerifiedInvestigation(
  p: ResolvedCampaignPackage,
  run: CampaignRun,
  attemptId: string,
) {
  const verifiedRun = verifyCampaignRun(p.definition, p.catalog, run);
  if (!verifiedRun) return { ok: false as const, diagnostics: ['INVALID_INVESTIGATION_RECORD'] };
  const verified = { run: verifiedRun };
  const attempt = verified.run.attempts.find((a) => a.id === attemptId);
  if (!attempt) return { ok: false as const, diagnostics: ['UNKNOWN_ATTEMPT'] };
  const s = p.catalog.get(
    scenarioVersionKey(attempt.incident.scenarioId, attempt.incident.contentVersion),
  );
  const view = p.presentations.find(
    (v) =>
      v.scenarioId === attempt.incident.scenarioId &&
      v.contentVersion === attempt.incident.contentVersion,
  );
  if (!s || !view) return { ok: false as const, diagnostics: ['MISSING_INVESTIGATION_AUTHORITY'] };
  const diagnostics: string[] = [];
  const panels = view.panels
    .filter((panel) => {
      const gate = evaluateCampaignCondition(panel.campaignReveal, p.definition.references, {
        definitionVersion: p.definition.version,
        kind: 'branch',
        runId: run.runId,
        boundary: run.revision,
        observations: campaignObservations(p.definition, verified.run),
      });
      if (!gate.ok) {
        diagnostics.push(...gate.diagnostics.map((d) => d.code));
        return false;
      }
      return gate.value && panel.reveal.every((c) => evaluateCondition(attempt.incident, c));
    })
    .map((panel) => ({
      ...panel,
      blocks: panel.blocks.map((b) =>
        b.kind === 'narrative_stream'
          ? projectNarrativeStream(b, s, attempt.incident, verified.run, attemptId)
          : b.kind === 'war_room_stream'
            ? projectWarRoomStream(b, s, attempt.incident)
            : b.kind === 'signals'
              ? {
                  ...b,
                  values: b.signalIds.flatMap((id) => {
                    const signal = attempt.incident.signals[id];
                    return signal?.revealed ? [{ id, value: signal.value }] : [];
                  }),
                }
              : b,
      ),
    }));
  return {
    ok: true as const,
    panels,
    diagnostics: [...new Set(diagnostics)],
    relations: view.evidenceRelations.filter(
      (e) => run.projection.evidence.includes(e.from) && run.projection.evidence.includes(e.to),
    ),
    postmortem: attempt.incident.completionReached ? computePostmortem(s, attempt.incident) : null,
  };
}

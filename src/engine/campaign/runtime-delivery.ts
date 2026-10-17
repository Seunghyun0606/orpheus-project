import { canonicalJson } from './canonical.ts';
import { verifyCampaignRun, type CampaignRun, type CampaignOperation } from './transitions.ts';
import { projectCampaignInvestigation } from './investigation.ts';
import type { EngineEvent, IncidentState } from '../types.ts';
import type { ResolvedCampaignPackage } from '../../scenario/campaign-package.ts';
import type { RecordedNarrative } from './runtime-streams.ts';

// Pure proof only. Observer suffixes never confer operation/event ownership.
export function getFreshRuntimeNarratives(
  p: ResolvedCampaignPackage,
  run: CampaignRun,
  update: { readonly operation: CampaignOperation; readonly events: readonly EngineEvent[] },
  readFloor: number,
): RecordedNarrative[] {
  try {
    const op = update.operation;
    if (
      op.kind !== 'command' ||
      op.sequence !== run.revision ||
      op.sequence <= readFloor ||
      op.attemptId !== run.activeAttemptId
    )
      return [];
    const index = run.operations.findIndex((o) => o.operationId === op.operationId);
    if (index <= 0 || canonicalJson(run.operations[index]) !== canonicalJson(op)) return [];
    const view = projectCampaignInvestigation(p, run, op.attemptId);
    if (!view.ok) return [];
    // The command is the final operation, so the verified record is its result.
    // Replay accepted it only at priorHead: the attempt's exact pre-command state.
    const after = verifyCampaignRun(p.definition, p.catalog, run);
    if (!after || index !== run.operations.length - 1) return [];
    const a = after.attempts.find((a) => a.id === op.attemptId);
    const prior = JSON.parse(op.priorHead) as IncidentState;
    if (!a || !Array.isArray(prior.eventLog)) return [];
    const start = Math.max(prior.eventLog.length, a.baselineEventCount);
    const owned = a.incident.eventLog.slice(start);
    // Require the exact command delta, not an arbitrary subset or old genuine event.
    if (canonicalJson(update.events) !== canonicalJson(owned)) return [];
    const events = new Set(
      owned.filter((e) => e.type === 'narrative_triggered').map((e) => e.sequence),
    );
    return view.panels
      .flatMap((panel) =>
        panel.blocks.flatMap((b) =>
          b.kind === 'narrative_stream'
            ? b.messages.filter((m) => events.has(m.eventSequence))
            : [],
        ),
      )
      .sort((a, b) => a.eventSequence - b.eventSequence);
  } catch {
    return [];
  }
}

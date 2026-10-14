import { canonicalJson } from './canonical.ts';
import { replayCampaign, type CampaignRun, type CampaignOperation } from './transitions.ts';
import { projectCampaignInvestigation } from './investigation.ts';
import type { EngineEvent } from '../types.ts';
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
    const before = replayCampaign(p.definition, p.catalog, run.operations.slice(0, index));
    const after = replayCampaign(p.definition, p.catalog, run.operations.slice(0, index + 1));
    if (!before.ok || !after.ok || canonicalJson(after.run) !== canonicalJson(run)) return [];
    const a = after.run.attempts.find((a) => a.id === op.attemptId);
    const prior = before.run.attempts.find((a) => a.id === op.attemptId);
    if (!a || !prior) return [];
    const start = Math.max(prior.incident.eventLog.length, a.baselineEventCount);
    const owned = a.incident.eventLog.slice(start);
    // Require the exact command delta, not an arbitrary subset or old genuine event.
    if (canonicalJson(update.events) !== canonicalJson(owned)) return [];
    const events = new Set(
      owned.filter((e) => e.type === 'narrative_triggered').map((e) => e.sequence),
    );
    return view.panels.flatMap((panel) =>
      panel.blocks.flatMap((b) =>
        b.kind === 'narrative_stream' ? b.messages.filter((m) => events.has(m.eventSequence)) : [],
      ),
    );
  } catch {
    return [];
  }
}

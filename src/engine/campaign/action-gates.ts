import type { CampaignDefinition } from '../../scenario/campaign.ts';
import type { Scenario } from '../../scenario/schema.ts';
import type { IncidentState } from '../types.ts';
import { getAvailableActionIds } from '../simulation.ts';
import {
  evaluateCampaignCondition,
  orderedDiagnostics,
  type ConditionContext,
  type ConditionResult,
} from './conditions.ts';

// Caller supplies the verified pre-command boundary, not a UI Boolean.
export function evaluateActionGate(
  d: CampaignDefinition,
  incidentId: string,
  contentVersion: string,
  actionId: string,
  context: ConditionContext,
): ConditionResult {
  const gates = (d.actionGates ?? []).filter(
    (g) =>
      g.incidentId === incidentId && g.contentVersion === contentVersion && g.actionId === actionId,
  );
  if (gates.length > 1)
    return { ok: false, diagnostics: [{ code: 'DUPLICATE_ACTION_GATE', path: actionId }] };
  if (!gates.length) return { ok: true, value: true };
  return evaluateCampaignCondition(gates[0]!.eligibility, d.references, {
    ...context,
    kind: 'action',
  });
}

export function selectCampaignActionIds(
  d: CampaignDefinition,
  s: Scenario,
  incidentId: string,
  incident: IncidentState,
  context: ConditionContext,
  scope?: readonly string[],
) {
  const local = incident.completionReached ? [] : getAvailableActionIds(incident, s);
  const checked = local
    .filter((id) => !scope || scope.includes(id))
    .map((id) => ({
      id,
      result: evaluateActionGate(d, incidentId, incident.contentVersion, id, context),
    }));
  return {
    actionIds: checked.filter((c) => c.result.ok && c.result.value).map((c) => c.id),
    diagnostics: orderedDiagnostics(
      checked.flatMap((c) => (c.result.ok ? [] : c.result.diagnostics)),
    ),
  };
}

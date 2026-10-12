// Authored for deferred verification. No campaign/model/ending acceptance here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createIncidentState, executeCommand, replayCommands } from '../engine/index.ts';
import { validateVersionedScenarioCatalog, scenarioVersionKey } from '../scenario/catalog.ts';

interface EarlyReplayCase {
  id: string;
  scenarioId: string;
  contentVersion: string;
  seed: number;
  investigationRecovery: string[];
  temporaryRecovery: string[];
  expirationObservation: string[];
  delegationRecovery: string[];
  alternateRecovery?: string[];
  expectations: {
    mechanism: string;
    healthySignals: Record<string, number>;
    teamEvidence: string;
  };
}
const plans = parse(readFileSync('src/tests/fixtures/early-campaign-replays.yaml', 'utf8')) as {
  cases: EarlyReplayCase[];
};
function catalog() {
  const files = Array.from(
    { length: 8 },
    (_, i) => 'src/scenario/data/full-campaign/incidents/inc-00' + (i + 1) + '.yaml',
  );
  const result = validateVersionedScenarioCatalog(
    files.map((file) => ({
      file,
      source: readFileSync(file, 'utf8'),
    })),
  );
  if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
  return result.scenarios;
}
describe('early campaign operational data only — deferred QA', () => {
  it('has eight authored authorities and preserves the existing three source authorities', () => {
    expect(catalog().size).toBe(8);
    for (const id of ['inc-001', 'inc-002', 'inc-003']) {
      const current = readFileSync('src/scenario/data/incidents/' + id + '.yaml', 'utf8');
      const reused = readFileSync(
        'src/scenario/data/full-campaign/incidents/' + id + '.yaml',
        'utf8',
      );
      expect(reused.replaceAll('\r\n', '\n')).toBe(current.replaceAll('\r\n', '\n'));
    }
  });
  for (const fixture of plans.cases) {
    it(fixture.id + ' retains deterministic contrasting recovery paths', () => {
      const scenario = catalog().get(
        scenarioVersionKey(fixture.scenarioId, fixture.contentVersion),
      )!;
      for (const path of [
        fixture.investigationRecovery,
        fixture.temporaryRecovery,
        fixture.expirationObservation,
        fixture.delegationRecovery,
        ...(fixture.alternateRecovery ? [fixture.alternateRecovery] : []),
      ]) {
        const commands = path.map((actionId) => ({ type: 'perform_action' as const, actionId }));
        const first = replayCommands(scenario, { seed: fixture.seed }, commands);
        const again = replayCommands(scenario, { seed: fixture.seed }, commands);
        expect(first.ok).toBe(true);
        expect(again).toEqual(first);
        if (!first.ok) throw new Error(fixture.id + ' rejected');
        expect(first.state.completionReached).toBe(true);
        for (const [id, value] of Object.entries(fixture.expectations.healthySignals))
          expect(first.state.signals[id]?.value).toBe(value);
        expect(first.state.resources.CUSTOMER_IMPACT!.value).toBeGreaterThan(0);
      }
    });
    it(fixture.id + ' distinguishes a temporary window from resolution', () => {
      const scenario = catalog().get(
        scenarioVersionKey(fixture.scenarioId, fixture.contentVersion),
      )!;
      const initial = createIncidentState(scenario, { seed: fixture.seed });
      const mitigation = executeCommand(initial, scenario, {
        type: 'perform_action',
        actionId: fixture.temporaryRecovery[0]!,
      });
      expect(mitigation.ok).toBe(true);
      if (!mitigation.ok) throw new Error('mitigation rejected');
      expect(mitigation.state.signals.ERROR_RATE!.value).toBe(4);
      expect(mitigation.state.completionReached).toBe(false);
      const rootBeforeEvidence = executeCommand(initial, scenario, {
        type: 'perform_action',
        actionId: fixture.investigationRecovery.at(-1)!,
      });
      expect(rootBeforeEvidence.ok).toBe(false);
      const expired = replayCommands(
        scenario,
        { seed: fixture.seed },
        fixture.expirationObservation
          .slice(0, 13)
          .map((actionId) => ({ type: 'perform_action' as const, actionId })),
      );
      expect(expired.ok).toBe(true);
      if (!expired.ok) throw new Error('expiry path rejected');
      expect(expired.state.completionReached).toBe(false);
      expect(expired.state.signals.ERROR_RATE!.value).toBe(37);
    });
    it(fixture.id + ' returns delegated capacity without fabricating campaign samples', () => {
      const scenario = catalog().get(
        scenarioVersionKey(fixture.scenarioId, fixture.contentVersion),
      )!;
      const result = replayCommands(
        scenario,
        { seed: fixture.seed },
        fixture.delegationRecovery.map((actionId) => ({
          type: 'perform_action' as const,
          actionId,
        })),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('delegation rejected');
      expect(result.state.resources.TEAM_CAPACITY!.value).toBe(3);
      expect(result.state.revealedEvidenceIds).toContain(fixture.expectations.teamEvidence);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'war_room_message', targetId: 'TEAM_REPORT' }),
      );
    });
  }
});

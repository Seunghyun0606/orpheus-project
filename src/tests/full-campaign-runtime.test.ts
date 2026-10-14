// @vitest-environment node
// Authored for deferred QA. No caller-edited campaign scores or production-store I/O.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectProductionCampaignSources } from '../scenario/production-catalog.ts';
import { parsePackageYaml, type ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  getCampaignProgression,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import { fixtureOperation } from './fixtures/opportunities.ts';
import { rootCauseResolutionReplay } from './fixtures/inc-001-replays.ts';
import { canonicalJson } from '../engine/campaign/canonical.ts';

function sourceData() {
  const root = 'src/scenario/data/full-campaign';
  const sources: Record<string, string> = {};
  for (const folder of [
    'incidents',
    'presentations',
    'definitions',
    'packages',
    'ending-presentations',
  ])
    for (const file of readdirSync(root + '/' + folder).filter((name) => name.endsWith('.yaml')))
      sources[root + '/' + folder + '/' + file] = readFileSync(
        root + '/' + folder + '/' + file,
        'utf8',
      );
  return {
    sources,
    manifest: parsePackageYaml(
      readFileSync('src/scenario/data/full-campaign-manifest.yaml', 'utf8'),
    ),
  };
}
function composition(): ResolvedCampaignPackage {
  const { sources, manifest } = sourceData();
  const result = inspectProductionCampaignSources(sources, manifest);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.registry.resolve('orpheus-full-campaign', '1.0.0')!;
}
describe('DEC-060 complete opt-in package connection (deferred)', () => {
  it('requires the full exact authorities, pins the new access policy and accepts no latest alias', () => {
    const p = composition();
    expect(p.definition.replayAccess).toBe('completed_prior_acts');
    expect(p.definition.incidents).toHaveLength(26);
    expect(p.definition.acts).toHaveLength(9);
    expect(p.definition.endings!.entries).toHaveLength(10);
    expect(p.endingPresentation!.entries).toHaveLength(10);
    expect(p.package.definitionVersion).toBe('1.0.0');
    expect(p.definition.initial.completed).toEqual([]);
    const { sources, manifest } = sourceData();
    for (const field of [
      '/incidents/inc-026.yaml',
      '/definitions/campaign.yaml',
      '/packages/campaign.yaml',
      '/ending-presentations/endings.yaml',
    ]) {
      const omitted = Object.fromEntries(
        Object.entries(sources).filter(([path]) => !path.endsWith(field)),
      );
      expect(inspectProductionCampaignSources(omitted, manifest).ok).toBe(false);
    }
  });
  it('starts only the first operational Incident and preserves genuine first completion without skipping', () => {
    const p = composition(),
      d = p.definition;
    const apply = (run: CampaignRun | null, payload: Parameters<typeof fixtureOperation>[2]) => {
      const result = prepareCampaignOperation(d, p.catalog, run, fixtureOperation(d, run, payload));
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      return result.run;
    };
    let run = apply(null, { kind: 'create' });
    const progress = getCampaignProgression(d, p.catalog, run);
    if (!progress.ok) throw new Error(JSON.stringify(progress.diagnostics));
    expect(
      progress.incidents.filter((i) => i.result.ok && i.result.value).map((i) => i.id),
    ).toEqual(['INC-001']);
    const before = canonicalJson(run);
    expect(
      prepareCampaignOperation(
        d,
        p.catalog,
        run,
        fixtureOperation(d, run, {
          kind: 'start',
          attemptId: 'skip',
          incidentId: 'INC-004',
          seed: 1002,
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(canonicalJson(run)).toBe(before);
    run = apply(run, { kind: 'start', attemptId: 'first', incidentId: 'INC-001', seed: 1002 });
    for (const command of rootCauseResolutionReplay.commands) {
      const a = run.attempts.at(-1)!;
      run = apply(run, {
        kind: 'command',
        attemptId: a.id,
        inputId: 'input-' + run.revision,
        commandSequence: a.incident.replayLog.length,
        priorHead: campaignAttemptHead(a),
        command,
      });
    }
    expect(run.projection.completed).toEqual(['INC-001']);
    expect(run.projection.act).toBe(1);
    expect(run.projection.alignment.corporate).toBe(1);
    expect(run.projection.values).toMatchObject({ operationalSafety: 2, collateralDamage: 1 });
    expect(run.projection.narrativeFlags.ORPHEUS_ACTIVE).toBe(false);
    const next = getCampaignProgression(d, p.catalog, run);
    if (!next.ok) throw new Error(JSON.stringify(next.diagnostics));
    expect(next.incidents.filter((i) => i.result.ok && i.result.value).map((i) => i.id)).toEqual([
      'INC-001',
      'INC-002',
    ]);
    expect(replayCampaign(d, p.catalog, run.operations)).toMatchObject({ ok: true, run });
  });
});

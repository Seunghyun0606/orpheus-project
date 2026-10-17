// @vitest-environment node
// Campaign 1.2 (DEC-070): composition reproducibility, per-Incident authoring checks
// and whole-campaign play through the real campaign engine for two player profiles.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { authorCampaign12, readBindings, VERSION } from './campaign-1.2.mjs';
import { checkIncident } from './check-incident.mjs';
import { sourceInventory } from '../release-support.mjs';
import { inspectProductionCampaignSources } from '../../src/scenario/production-catalog.ts';
import {
  campaignAttemptHead,
  getCampaignActionAvailability,
  prepareCampaignOperation,
} from '../../src/engine/campaign/transitions.ts';
import { getCampaignPrediction } from '../../src/engine/player-model/prediction.ts';
import { resolveCampaignEnding } from '../../src/engine/campaign/endings.ts';
import { rootCauseResolutionReplay } from '../../src/tests/fixtures/inc-001-replays.ts';
import { keysetUpdateReplay } from '../../src/tests/fixtures/inc-002-replays.ts';
import { quarantineReplay } from '../../src/tests/fixtures/inc-003-replays.ts';

const read = (file) => parse(readFileSync(file, 'utf8'));
const bindings = readBindings(read);
const byIncident = new Map(bindings.map((b) => [b.incidentId, b]));
const MVP_ROUTES = {
  'INC-001': rootCauseResolutionReplay.commands.map((c) => c.actionId),
  'INC-002': keysetUpdateReplay.commands.map((c) => c.actionId),
  'INC-003': quarantineReplay.commands.map((c) => c.actionId),
};

function driver(p) {
  const d = p.definition;
  const catalog = p.catalog;
  let run = null;
  let counter = 0;
  const submit = (payload, commit = true) => {
    const sequence = run ? run.revision + 1 : 0;
    const result = prepareCampaignOperation(d, catalog, run, {
      operationId: 'op-' + sequence,
      runId: 'campaign-1.2-test',
      sequence,
      definitionId: d.id,
      definitionVersion: d.version,
      replayVersion: d.replayVersion,
      canonicalVersion: 1,
      ...payload,
    });
    if (commit) {
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      run = result.run;
    }
    return result;
  };
  const active = () => run.attempts.find((a) => a.id === run.activeAttemptId);
  const available = () => {
    const result = getCampaignActionAvailability(d, catalog, run);
    return result.ok ? result.actionIds : [];
  };
  const command = (actionId, commit = true) =>
    submit(
      {
        kind: 'command',
        attemptId: active().id,
        inputId: 'input-' + counter++,
        commandSequence: active().incident.replayLog.length,
        priorHead: campaignAttemptHead(active()),
        command: { type: 'perform_action', actionId },
      },
      commit,
    );
  submit({ kind: 'create' });
  return {
    d,
    catalog,
    get run() {
      return run;
    },
    active,
    available,
    command,
    submit,
    start: (incidentId) =>
      submit({ kind: 'start', incidentId, attemptId: 'attempt-' + counter++, seed: 4172 }),
  };
}

const completing = (b) => b.routes.filter((r) => r.expect?.completed === true);
// Careful: the most thorough completing route. Reckless: a completing route that
// reaches for a temporary fix first when one exists, otherwise the shortest one.
function routeFor(incidentId, profile) {
  const b = byIncident.get(incidentId);
  if (!b) return MVP_ROUTES[incidentId];
  const routes = completing(b).sort((x, y) => x.actions.length - y.actions.length);
  if (profile === 'careful') return routes.at(-1).actions;
  const temporary = new Set(
    b.operational.filter((o) => o.role === 'temporary').map((o) => o.actionId),
  );
  return (routes.find((r) => temporary.has(r.actions[0])) ?? routes[0]).actions;
}

function playCampaign(p, profile) {
  const g = driver(p);
  const predictions = [];
  for (const incident of g.d.incidents) {
    if (incident.id === 'INC-026') break;
    g.start(incident.id);
    const causal = byIncident.get(incident.id)?.causalObservationSignal;
    let probed = false;
    for (const actionId of routeFor(incident.id, profile)) {
      const attempt = g.active().incident;
      if (attempt.completionReached) break;
      if (!probed && incident.act >= 4 && causal && attempt.signals[causal]?.revealed) {
        probed = true;
        const forecast = getCampaignPrediction(g.d, g.catalog, g.run, {
          contextId: 'AFTER_CAUSAL_OBSERVATION',
        });
        predictions.push({
          incident: incident.id,
          kind: forecast.ok ? forecast.result.kind : 'error',
        });
      }
      if (!g.available().includes(actionId)) continue; // already on record or gated
      const result = g.command(actionId, false);
      if (!result.ok) continue; // a temporary fix that this state refuses
      g.command(actionId);
    }
    expect(g.active().incident.completionReached, incident.id + ' completes').toBe(true);
  }
  return { g, predictions };
}

function finalChoices(g) {
  g.start('INC-026');
  for (const a of ['ASSESS_FINAL_SERVICE_STATE', 'ASSESS_FINAL_AUTHORITY_STATE']) g.command(a);
  const plans = g.d.endings.entries.map((e) => ({
    endingId: e.id,
    actionId: e.condition.children
      .find((c) => c.reference?.startsWith('FINAL_ACTION_'))
      .reference.slice('FINAL_ACTION_'.length),
  }));
  const open = plans.filter((plan) => g.available().includes(plan.actionId));
  return { plans, open };
}

describe('campaign 1.2 composition', () => {
  let registry;
  beforeAll(() => {
    const result = inspectProductionCampaignSources(
      sourceInventory(),
      read('src/scenario/data/full-campaign-manifest.yaml'),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    registry = result.registry;
  });

  it('is exactly what the composer derives from 1.1.0 and the authored Incidents', () => {
    const files = authorCampaign12(read);
    for (const [file, value] of Object.entries(files)) expect(read(file)).toEqual(value);
    const p = registry.resolve('orpheus-full-campaign', VERSION);
    for (const b of bindings)
      expect(p.definition.incidents.find((i) => i.id === b.incidentId).contentVersion).toBe(
        VERSION,
      );
    // Older packages stay resolvable with their own content.
    expect(registry.resolve('orpheus-full-campaign', '1.1.0')).toBeDefined();
    expect(registry.resolve('orpheus-full-campaign', '1.0.0')).toBeDefined();
  });

  it('redesigns INC-004 through INC-026 and every Incident passes its authoring check', () => {
    expect(bindings.map((b) => b.incidentId)).toEqual(
      Array.from({ length: 23 }, (_, i) => 'INC-' + String(i + 4).padStart(3, '0')),
    );
    for (const b of bindings) {
      const { errors } = checkIncident(b.incidentId, { quiet: true });
      expect(errors, b.incidentId).toEqual([]);
    }
  }, 120_000);

  it('plays the whole campaign carefully, exposes forecasts from Act 4 and offers earned plans', () => {
    const p = registry.resolve('orpheus-full-campaign', VERSION);
    const { g, predictions } = playCampaign(p, 'careful');
    expect(g.run.projection.act).toBe(9);
    expect(predictions.filter((x) => x.kind === 'predicted').length).toBeGreaterThan(0);
    expect(predictions.some((x) => x.kind === 'error')).toBe(false);
    const { open } = finalChoices(g);
    expect(open.map((o) => o.actionId)).toContain('DISABLE_BOTH_AUTHORITY_PATHS');
    // Every plan on offer resolves to its own ending.
    for (const plan of open) {
      const candidate = g.command(plan.actionId, false);
      expect(candidate.ok, plan.actionId).toBe(true);
      const attempt = candidate.run.attempts.find((a) => a.id === candidate.run.activeAttemptId);
      const ending = resolveCampaignEnding(g.d, g.catalog, candidate.run, {
        attemptId: attempt.id,
        priorHead: campaignAttemptHead(attempt),
      });
      expect(ending, plan.actionId).toMatchObject({
        ok: true,
        result: { kind: 'resolved', endingId: plan.endingId },
      });
    }
  }, 600_000);

  it('a reckless operator is offered a different set of final plans', () => {
    const p = registry.resolve('orpheus-full-campaign', VERSION);
    const careful = finalChoices(playCampaign(p, 'careful').g).open.map((o) => o.actionId);
    const reckless = finalChoices(playCampaign(p, 'reckless').g).open.map((o) => o.actionId);
    expect(reckless).toContain('DISABLE_BOTH_AUTHORITY_PATHS');
    expect(reckless).not.toEqual(careful);
  }, 900_000);
});

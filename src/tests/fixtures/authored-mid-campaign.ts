// TEST ONLY: partial authoring composition. Never imported by the production loader.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { behaviorDefinitionSchema } from '../../scenario/behavior.ts';
import { predictionDefinitionSchema } from '../../scenario/prediction.ts';
import { opportunityDefinitionSchema } from '../../scenario/opportunity.ts';
import { validateVersionedScenarioCatalog } from '../../scenario/catalog.ts';
import type { CampaignDefinition } from '../../scenario/campaign.ts';
import {
  prepareCampaignOperation,
  campaignAttemptHead,
  type CampaignRun,
} from '../../engine/campaign/transitions.ts';
import { fixtureOperation } from './opportunities.ts';

const read = (path: string) => parse(readFileSync(path, 'utf8'));
export function authoredMidFixture() {
  const files = Array.from(
    { length: 18 },
    (_, i) =>
      'src/scenario/data/full-campaign/incidents/inc-' + String(i + 1).padStart(3, '0') + '.yaml',
  );
  const checked = validateVersionedScenarioCatalog(
    files.map((file) => ({ file, source: readFileSync(file, 'utf8') })),
  );
  if (!checked.success) throw new Error(JSON.stringify(checked.diagnostics));
  const catalog = checked.scenarios;
  const earlier = read('.project-os/planning/TASK-028.action-bindings.yaml');
  const mid = read('.project-os/planning/TASK-029.action-bindings.yaml');
  const baseline = read('.project-os/planning/TASK-028.model-bindings.yaml');
  const route = read('.project-os/planning/TASK-029.branch-bindings.yaml');
  const modelRoot = '.project-os/planning/M5/models/';
  const definition: CampaignDefinition = {
    schemaVersion: 1,
    id: 'TEST-ONLY-MID-AUTHORING',
    version: '1.0.0',
    replayVersion: 2,
    recordVersion: 2,
    // Isolate Act-6 opportunity behavior in unit fixtures. Production Act-1
    // initialization/progression is not selected or changed by this override.
    initial: {
      ...baseline.initial_fragment,
      act: 6,
      narrativeFlags: {
        ...baseline.initial_fragment.narrativeFlags,
        ...mid.initial_narrative_flags_fragment,
      },
    },
    references: [...earlier.references, ...mid.references, ...route.references],
    branches: route.branches,
    acts: [1, 2, 3, 4, 5, 6].map((id) => ({
      id,
      eligibility: {
        type: 'compare' as const,
        reference: 'CURRENT_ACT',
        operator: 'gte' as const,
        expected: id,
      },
    })),
    incidents: [...catalog.values()].map((s) => ({
      id: s.id,
      scenarioId: s.id,
      contentVersion: s.contentVersion,
      act: s.act,
      eligibility: {
        type: 'compare' as const,
        reference: 'CURRENT_ACT',
        operator: 'gte' as const,
        expected: s.act,
      },
    })),
    evidence: [...catalog.values()].flatMap((s) =>
      s.evidence.map((e) => ({ id: s.id + '.' + e.id, scenarioId: s.id, evidenceId: e.id })),
    ),
    narratives: [...catalog.values()].flatMap((s) =>
      s.narratives.map((n) => ({ id: s.id + '.' + n.id, scenarioId: s.id, narrativeId: n.id })),
    ),
    effects: [...earlier.logical_effects_fragment, ...mid.logical_effects_fragment],
    actionGates: [...earlier.actionGates, ...mid.actionGates],
    behavior: behaviorDefinitionSchema.parse(read(modelRoot + 'orpheus-player-behavior.yaml')),
    prediction: predictionDefinitionSchema.parse(
      read(modelRoot + 'orpheus-player-prediction.yaml'),
    ),
    opportunities: opportunityDefinitionSchema.parse(
      read(modelRoot + 'orpheus-player-opportunities.yaml'),
    ),
  };
  const apply = (run: CampaignRun | null, payload: Parameters<typeof fixtureOperation>[2]) => {
    const result = prepareCampaignOperation(
      definition,
      catalog,
      run,
      fixtureOperation(definition, run, payload),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.run;
  };
  const command = (run: CampaignRun, actionId: string) => {
    const a = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    return apply(run, {
      kind: 'command',
      attemptId: a.id,
      inputId: 'input-' + run.revision,
      commandSequence: a.incident.replayLog.length,
      priorHead: campaignAttemptHead(a),
      command: { type: 'perform_action', actionId },
    });
  };
  const start = (
    incidentId: string,
    run: CampaignRun | null = null,
    attemptId = 'test-attempt',
  ) => {
    if (!run) run = apply(null, { kind: 'create' });
    return apply(run, { kind: 'start', incidentId, attemptId, seed: 4172 });
  };
  const plans = read('src/tests/fixtures/mid-campaign-replays.yaml').cases as {
    id: string;
    discoveryRecovery: string[];
  }[];
  const investigate = (
    incidentId: string,
    previous: CampaignRun | null = null,
    attemptId = 'test-attempt',
  ) => {
    let run = start(incidentId, previous, attemptId);
    for (const actionId of plans.find((p) => p.id === incidentId)!.discoveryRecovery.slice(0, -1))
      run = command(run, actionId);
    return run;
  };
  const prepare = (run: CampaignRun, ruleId: string) => {
    const a = run.attempts.find((a) => a.id === run.activeAttemptId)!;
    return apply(run, {
      kind: 'prepare_opportunity',
      attemptId: a.id,
      priorHead: campaignAttemptHead(a),
      preparationId: 'preparation-' + run.revision,
      ruleId,
    });
  };
  const acknowledge = (run: CampaignRun) => {
    const p = run.opportunities!.preparations.at(-1)!;
    return apply(run, {
      kind: 'acknowledge_presentation',
      attemptId: p.attemptId,
      preparationId: p.id,
      surfaceId: p.presentation.id,
      priorHead: p.priorHead,
    });
  };
  return { definition, catalog, apply, command, start, investigate, prepare, acknowledge };
}

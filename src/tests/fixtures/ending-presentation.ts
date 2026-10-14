// Isolated resolver/prose fixtures. Not genuine 26-Incident reachability.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { endingFixture, endingCases } from './endings.ts';
import { endingPresentationSchema } from '../../scenario/ending-presentation.ts';
import {
  createCampaignPackageRegistry,
  type CampaignPackage,
} from '../../scenario/campaign-package.ts';
import type { InvestigationPresentation } from '../../scenario/presentation.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  type CampaignRun,
} from '../../engine/campaign/transitions.ts';
import { fixtureOperation } from './opportunities.ts';
import { rootCauseResolutionReplay } from './inc-001-replays.ts';

export function endingPresentationFixture(discovery = true) {
  const { d, scenario, catalog } = endingFixture();
  d.id = 'ending-prose-fixture-only';
  d.initial.narrativeFlags.PROJECT_DISTRIBUTED = false;
  d.references.push(
    {
      id: 'ENDING_PRESENTATION_PROJECT_DISTRIBUTED',
      version: d.version,
      valueType: 'boolean',
      source: 'narrative_flag',
      key: 'PROJECT_DISTRIBUTED',
      contexts: ['ending'],
    },
    {
      id: 'PROSE_FIXTURE_ACT',
      version: d.version,
      valueType: 'number',
      source: 'act',
      key: 'current',
      contexts: ['branch', 'effect'],
    },
  );
  if (discovery)
    d.effects.push({
      id: 'fixture-known-distribution',
      trigger: {
        incidentId: 'stage-one',
        type: 'evidence_revealed',
        targetId: 'CORRUPTED_LOG_ENTRY',
      },
      boundary: 'post_event',
      condition: { type: 'compare', reference: 'PROSE_FIXTURE_ACT', operator: 'gte', expected: 1 },
      alignment: {},
      values: {},
      narrativeFlags: { PROJECT_DISTRIBUTED: true },
      endingFlags: {},
    });
  const prose = endingPresentationSchema.parse(
    parse(
      readFileSync('src/scenario/data/full-campaign/ending-presentations/endings.yaml', 'utf8'),
    ),
  );
  prose.id = 'fixture-ending-prose';
  prose.version = 'fixture-prose-v1';
  prose.definitionId = d.id;
  prose.definitionVersion = d.version;
  prose.endingDefinitionId = d.endings!.id;
  prose.endingDefinitionVersion = d.endings!.version;
  for (const ref of prose.references) ref.version = prose.version;
  const investigation: InvestigationPresentation = {
    schemaVersion: 1,
    id: 'fixture-investigation',
    version: 'fixture-view-v1',
    scenarioId: scenario.id,
    contentVersion: scenario.contentVersion,
    panels: [
      {
        id: 'fixture-status',
        title: 'Fixture status',
        kind: 'status',
        campaignReveal: {
          type: 'compare',
          reference: 'PROSE_FIXTURE_ACT',
          operator: 'gte',
          expected: 1,
        },
        reveal: [{ type: 'resource', resourceId: 'CUSTOMER_IMPACT', operator: 'gte', value: 0 }],
        actionIds: [],
        blocks: [{ id: 'fixture-text', kind: 'paragraph', text: 'TEST ONLY — status' }],
      },
    ],
    evidenceRelations: [],
  };
  const pkg: CampaignPackage = {
    schemaVersion: 1,
    id: 'fixture-ending-package',
    version: 'fixture-package-v1',
    definitionId: d.id,
    definitionVersion: d.version,
    endingPresentation: { id: prose.id, version: prose.version },
    scenarios: [{ scenarioId: scenario.id, contentVersion: scenario.contentVersion }],
    presentations: [
      {
        id: investigation.id,
        version: investigation.version,
        scenarioId: scenario.id,
        contentVersion: scenario.contentVersion,
      },
    ],
  };
  const inputs = {
    packages: [pkg],
    definitions: [d],
    scenarios: catalog,
    presentations: [investigation],
    endingPresentations: [prose],
  };
  const registry = createCampaignPackageRegistry(inputs);
  if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
  const composition = registry.registry.all()[0]!;
  const apply = (run: CampaignRun | null, payload: Parameters<typeof fixtureOperation>[2]) => {
    const result = prepareCampaignOperation(d, catalog, run, fixtureOperation(d, run, payload));
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.run;
  };
  const start = (run: CampaignRun | null = null, attemptId = 'final') => {
    if (!run) run = apply(null, { kind: 'create' });
    return apply(run, { kind: 'start', attemptId, incidentId: 'stage-one', seed: 1002 });
  };
  const act = (run: CampaignRun, actionId: string) => {
    const a = run.attempts.find((t) => t.id === run.activeAttemptId)!;
    return apply(run, {
      kind: 'command',
      attemptId: a.id,
      commandSequence: a.incident.replayLog.length,
      inputId: 'input-' + run.revision,
      priorHead: campaignAttemptHead(a),
      command: { type: 'perform_action', actionId },
    });
  };
  const complete = (endingId = 'CUSTODIAN') => {
    let run = start();
    const choice = endingCases.find((c) => c.id === endingId)!;
    run = act(run, choice.action);
    for (const command of rootCauseResolutionReplay.commands) run = act(run, command.actionId);
    return run;
  };
  const request = (run: CampaignRun, attemptId = 'final') => ({
    attemptId,
    priorHead: campaignAttemptHead(run.attempts.find((t) => t.id === attemptId)!),
  });
  return {
    d,
    scenario,
    catalog,
    prose,
    pkg,
    inputs,
    composition,
    apply,
    start,
    act,
    complete,
    request,
  };
}

// Offline deterministic composition of approved authoring data only. The caller
// supplies YAML objects. No I/O, runtime validator, test execution or acceptance.
const logicalSources = [
  'TASK-028.action-bindings.yaml',
  'TASK-029.action-bindings.yaml',
  'TASK-030.action-bindings.yaml',
  'TASK-031.action-bindings.yaml',
  'TASK-031.crisis-preparation-bindings.yaml',
  'TASK-031.blackout-action-bindings.yaml',
];
const modelExtensions = [
  'TASK-030.model-bindings.yaml',
  'TASK-031.model-bindings.yaml',
  'TASK-031.crisis-model-bindings.yaml',
  'TASK-031.blackout-model-bindings.yaml',
];
const compare = (reference, operator, expected) => ({
  type: 'compare',
  reference,
  operator,
  expected,
});
const completedId = (id) => 'PROGRESSION_COMPLETED_' + id;

function unique(items, field = 'id') {
  const byId = new Map();
  for (const item of items) {
    const prior = byId.get(item[field]);
    if (prior && JSON.stringify(prior) !== JSON.stringify(item))
      throw new Error('Conflicting authoring identity: ' + item[field]);
    if (!prior) byId.set(item[field], item);
  }
  return [...byId.values()];
}
export function authorFullCampaign(readPlanning, readContent, manifest) {
  const proposal = readPlanning('TASK-027.full-progression-proposal.yaml');
  const initialBindings = readPlanning('TASK-028.model-bindings.yaml');
  const logical = logicalSources.map(readPlanning);
  const extensions = modelExtensions.map(readPlanning);
  const branch = readPlanning('TASK-029.branch-bindings.yaml');
  const scores = readPlanning('TASK-032.numeric-bindings.yaml');
  const prose = readPlanning('TASK-032.ending-presentation-bindings.yaml');
  const initial = structuredClone(initialBindings.initial_fragment);
  if (Object.keys(initial.alignment).sort().join(',') !== 'corporate,null')
    throw new Error('Initial alignment keys must be corporate and quoted YAML null.');
  for (const source of logical) {
    for (const [key, value] of Object.entries(source.initial_narrative_flags_fragment ?? {})) {
      if (
        value !== false ||
        (Object.hasOwn(initial.narrativeFlags, key) && initial.narrativeFlags[key] !== value)
      )
        throw new Error('Unapproved initial flag: ' + key);
      initial.narrativeFlags[key] = value;
    }
  }
  const incidents = manifest.incidents.map((entry, index) => {
    const contentVersion = scores.exact_incident_versions.find(
      (v) => v.incidentId === entry.id,
    )?.contentVersion;
    if (!contentVersion) throw new Error('Missing exact content identity: ' + entry.id);
    const children = [
      compare('CURRENT_ACT', 'gte', entry.act),
      ...manifest.incidents
        .slice(0, index)
        .map((earlier) => compare(completedId(earlier.id), 'eq', true)),
    ];
    return {
      id: entry.id,
      scenarioId: entry.id,
      contentVersion,
      act: entry.act,
      eligibility: { type: 'all', children },
    };
  });
  const refs = manifest.incidents.map((entry) => ({
    id: completedId(entry.id),
    version: proposal.identities.campaign.version,
    source: 'completed',
    key: entry.id,
    valueType: 'boolean',
    contexts: ['progression', 'effect'],
  }));
  const acts = [...new Set(manifest.incidents.map((i) => i.act))].map((act) => ({
    id: act,
    eligibility: {
      type: 'all',
      children: [
        compare('CURRENT_ACT', 'gte', 1),
        ...manifest.incidents
          .filter((i) => i.act < act)
          .map((i) => compare(completedId(i.id), 'eq', true)),
      ],
    },
  }));
  const progression = proposal.proposal.act_progression.boundaries.map((boundary) => {
    const index = manifest.incidents.findIndex((i) => i.id === boundary.incidentId);
    if (index < 0) throw new Error('Unknown progression boundary');
    return {
      id: 'PROGRESSION_ACT_' + boundary.from + '_TO_' + boundary.to,
      trigger: { incidentId: boundary.incidentId, type: 'completion_reached' },
      boundary: 'post_event',
      condition: {
        type: 'all',
        children: [
          compare('CURRENT_ACT', 'eq', boundary.from),
          ...manifest.incidents
            .slice(0, index + 1)
            .map((i) => compare(completedId(i.id), 'eq', true)),
        ],
      },
      alignment: {},
      values: {},
      narrativeFlags: {},
      endingFlags: {},
      act: boundary.to,
    };
  });
  // Preserve explicit logical aliases used by authored evidence relations, then
  // bind each otherwise unmapped local item once. These are registry identities,
  // never grants, inferred narrative flags or additional discovery awards.
  const evidence = unique(logical.flatMap((s) => s.evidence_bindings_fragment ?? []));
  const narratives = unique(logical.flatMap((s) => s.narrative_bindings_fragment ?? []));
  const views = [];
  for (const incident of incidents) {
    const scenario = readContent('incidents/' + incident.id.toLowerCase() + '.yaml');
    for (const item of scenario.evidence)
      if (!evidence.some((e) => e.scenarioId === scenario.id && e.evidenceId === item.id))
        evidence.push({
          id: scenario.id + '.' + item.id,
          scenarioId: scenario.id,
          evidenceId: item.id,
        });
    for (const item of scenario.narratives)
      if (!narratives.some((e) => e.scenarioId === scenario.id && e.narrativeId === item.id))
        narratives.push({
          id: scenario.id + '.' + item.id,
          scenarioId: scenario.id,
          narrativeId: item.id,
        });
    const view = readContent('presentations/' + incident.id.toLowerCase() + '.yaml');
    views.push({
      id: view.id,
      version: view.version,
      scenarioId: view.scenarioId,
      contentVersion: view.contentVersion,
    });
  }
  const behavior = structuredClone(readPlanning('M5/models/orpheus-player-behavior.yaml'));
  behavior.scenarios.push(...extensions.flatMap((e) => e.behavior_scenarios ?? []));
  const prediction = structuredClone(readPlanning('M5/models/orpheus-player-prediction.yaml'));
  prediction.scenarios.push(...extensions.flatMap((e) => e.prediction_scenarios ?? []));
  const opportunities = structuredClone(
    readPlanning('M5/models/orpheus-player-opportunities.yaml'),
  );
  opportunities.rules.push(
    ...readPlanning('TASK-032.recommendation-bindings.yaml').rules_extension,
  );
  const definition = {
    ...initialBindings.definition_header_fragment,
    replayAccess: 'completed_prior_acts', // DEC-060, never injected into old definitions.
    references: unique([
      ...logical.flatMap((s) => s.references ?? []),
      ...branch.references,
      ...scores.references,
      ...prose.references_fragment,
      ...refs,
    ]),
    initial,
    acts,
    incidents,
    evidence: unique(evidence),
    narratives: unique(narratives),
    effects: unique([
      ...scores.logical_effects_replacement,
      ...scores.numeric_effects_fragment,
      ...progression,
    ]),
    actionGates: unique(logical.flatMap((s) => s.actionGates ?? [])),
    branches: structuredClone(branch.branches),
    behavior,
    prediction,
    opportunities,
    endings: structuredClone(readPlanning('M5/models/orpheus-full-campaign-endings.yaml')),
  };
  return {
    definition,
    package: {
      ...proposal.identities.package,
      definitionId: definition.id,
      definitionVersion: definition.version,
      scenarios: incidents.map((i) => ({
        scenarioId: i.scenarioId,
        contentVersion: i.contentVersion,
      })),
      presentations: views,
      ...prose.package_binding_fragment,
    },
  };
}

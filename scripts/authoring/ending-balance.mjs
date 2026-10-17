// Offline authoring only. This module does not read/write files, register a
// runtime authority or validate/accept a campaign. The caller supplies the
// approved YAML sources; generated objects use existing engine schemas.
const version = '1.0.0';
const compare = (reference, operator, expected) => ({
  type: 'compare',
  reference,
  operator,
  expected,
});
const logicalSources = [
  'TASK-028.action-bindings.yaml',
  'TASK-029.action-bindings.yaml',
  'TASK-030.action-bindings.yaml',
  'TASK-031.action-bindings.yaml',
  'TASK-031.crisis-preparation-bindings.yaml',
  'TASK-031.blackout-action-bindings.yaml',
];
const endingSources = {
  corporate: ['alignment', 'corporate', 'number'],
  null: ['alignment', 'null', 'number'],
  publicInterest: ['value', 'publicInterest', 'number'],
  operationalSafety: ['value', 'operationalSafety', 'number'],
  curiosity: ['value', 'curiosity', 'number'],
  evidence: ['value', 'evidence', 'number'],
  teamTrust: ['value', 'teamTrust', 'number'],
  aiDependency: ['value', 'aiDependency', 'number'],
  collateralDamage: ['value', 'collateralDamage', 'number'],
  evidenceBeforeActionRate: ['metric', 'evidenceBeforeActionRate', 'number'],
  averageInvestigationDepth: ['metric', 'averageInvestigationDepth', 'number'],
  ORPHEUS_ACTIVE_DISCOVERED: ['narrative_flag', 'ORPHEUS_ACTIVE', 'boolean'],
};
const endingRefId = (key) => 'ENDING_ACCUMULATED_' + key;

export function authorEndingBalance(readYaml) {
  const proposal = readYaml('TASK-032.numeric-ending-balance-proposal.yaml');
  const sources = logicalSources.map((file) => readYaml(file));
  const references = [];
  const refsById = new Map();
  for (const source of sources) {
    for (const ref of source.references ?? []) {
      if (refsById.has(ref.id)) throw new Error('Duplicate source reference: ' + ref.id);
      refsById.set(ref.id, ref);
    }
  }
  // The earliest SECURITY_NAME_DISCOVERY only guarded the prerequisite Ghost.
  // Explicitly enforce the approved same-node-once rule even if a later alias
  // discovers NULL_NAME before this original delivery on a retry.
  const discoveryRefs = new Map();
  for (const node of proposal.discovery_scores.nodes) {
    const ref = 'BALANCE_KNOWN_' + node;
    discoveryRefs.set(node, ref);
    references.push({
      id: ref,
      version,
      source: 'narrative_flag',
      key: node,
      valueType: 'boolean',
      contexts: ['effect'],
    });
  }
  const publicNodes = new Set(proposal.discovery_scores.public_interest_bonus.nodes);
  const logical = sources
    .flatMap((source) => source.logical_effects_fragment ?? [])
    .map((raw) => {
      const effect = structuredClone(raw);
      const nodes = Object.keys(effect.narrativeFlags).filter((node) => discoveryRefs.has(node));
      if (nodes.length > 1) throw new Error('Ambiguous logical award: ' + effect.id);
      if (!nodes.length) return effect; // BLACKOUT_FINAL has no discovery credit.
      const node = nodes[0];
      effect.condition = {
        type: 'all',
        children: [effect.condition, compare(discoveryRefs.get(node), 'eq', false)],
      };
      effect.values = {
        ...effect.values,
        ...proposal.discovery_scores.per_new_logical_node,
        ...(publicNodes.has(node)
          ? {
              publicInterest: proposal.discovery_scores.public_interest_bonus.publicInterest,
            }
          : {}),
      };
      return effect;
    });
  const effects = [];
  const add = (id, incidentId, type, targetId, alignment = {}, values = {}, extra = {}) => {
    effects.push({
      id: 'BALANCE_' + id,
      trigger: { incidentId, type, ...(targetId === undefined ? {} : { targetId }), ...extra },
      boundary: 'post_event',
      condition: compare('CURRENT_ACT', 'gte', 1),
      alignment,
      values,
      narrativeFlags: {},
      endingFlags: {},
    });
  };
  for (const hint of proposal.early_hint_scores.entries)
    add(
      hint.incidentId + '_HINT',
      hint.incidentId,
      'evidence_revealed',
      hint.evidenceId,
      {},
      { curiosity: hint.curiosity },
    );
  for (const incident of proposal.operational_scores.incidents) {
    const { incidentId, contentVersion } = incident;
    add(
      incidentId + '_COMPLETION',
      incidentId,
      'completion_reached',
      undefined,
      proposal.completion_scores.per_new_completion,
    );
    add(
      incidentId + '_WAR_ROOM',
      incidentId,
      'action_completed',
      'UPDATE_WAR_ROOM',
      {},
      { teamTrust: 1 },
    );
    if (!['INC-001', 'INC-002', 'INC-003'].includes(incidentId))
      add(
        incidentId + '_DELIVERED_DIAGNOSIS',
        incidentId,
        'evidence_revealed',
        'TEAM_DIAGNOSIS',
        {},
        { teamTrust: 1 },
      );
    for (const [group, actions, delta] of [
      ['CAUSAL_REPAIR', incident.causalActions, 2],
      ['TEMPORARY_EXPOSURE', incident.temporaryActions, -1],
    ]) {
      add(
        incidentId + '_' + group,
        incidentId,
        'action_completed',
        actions[0],
        {},
        { operationalSafety: delta },
      );
      if (actions.length > 1)
        effects.at(-1).additionalTriggers = actions
          .slice(1)
          .map((targetId) => ({ contentVersion, type: 'action_completed', targetId }));
    }
    for (const [actionId, weight] of Object.entries(incident.damageWeights))
      add(
        incidentId + '_DAMAGE_' + actionId,
        incidentId,
        'action_completed',
        actionId,
        {},
        { collateralDamage: weight },
      );
  }
  for (const choice of proposal.explicit_choices.entries) {
    const alignment = {};
    for (const key of ['corporate', 'null'])
      if (choice[key] !== undefined) alignment[key] = choice[key];
    add(
      choice.incidentId + '_CHOICE_' + choice.actionId,
      choice.incidentId,
      'action_completed',
      choice.actionId,
      alignment,
      choice.teamTrust === undefined ? {} : { teamTrust: choice.teamTrust },
    );
  }
  const rules = [
    ...readYaml('models/orpheus-player-opportunities.yaml').rules,
    ...readYaml('TASK-032.recommendation-bindings.yaml').rules_extension,
  ];
  for (const ruleId of proposal.ai_dependency_scores.rules) {
    const rule = rules.find((item) => item.id === ruleId);
    if (!rule?.recommendedActionId) throw new Error('Missing exact recommendation: ' + ruleId);
    add(
      'DEPENDENCY_' + ruleId,
      rule.incidentId,
      'action_completed',
      rule.recommendedActionId,
      {},
      proposal.ai_dependency_scores.per_distinct_verified_positive_response,
      { response: { ruleId, positive: true } },
    );
  }
  const terminal = proposal.operational_scores.final_damage_weights;
  for (const [actionId, weight] of Object.entries(terminal.weights))
    add(
      'INC-026_DAMAGE_' + actionId,
      terminal.incidentId,
      'action_completed',
      actionId,
      {},
      { collateralDamage: weight },
    );

  // Separate reference IDs avoid altering old branch/action contexts. Consumers
  // inline these references only into the new complete definition.
  for (const [key, [source, sourceKey, valueType]] of Object.entries(endingSources))
    references.push({
      id: endingRefId(key),
      version,
      source,
      key: sourceKey,
      valueType,
      contexts: ['ending'],
    });
  for (const incident of proposal.operational_scores.incidents)
    references.push({
      id: 'ENDING_COMPLETED_' + incident.incidentId,
      version,
      source: 'completed',
      key: incident.incidentId,
      valueType: 'boolean',
      contexts: ['ending'],
    });
  const final = structuredClone(
    readYaml('TASK-031.final-context-bindings.yaml').final_mapping_fragment,
  );
  for (const ref of references.filter((item) => item.contexts.includes('ending')))
    final.references.push({
      id: ref.id,
      version,
      valueType: ref.valueType,
      source: 'campaign',
      key: ref.id,
    });
  final.eligible.children.push(
    ...proposal.operational_scores.incidents.map((incident) =>
      compare('ENDING_COMPLETED_' + incident.incidentId, 'eq', true),
    ),
  );
  const operators = { '>=': 'gte', '<=': 'lte', '=': 'eq' };
  const entries = proposal.ending_rules.map((rule) => {
    const children = [compare('FINAL_ACTION_' + rule.finalAction, 'eq', true)];
    for (const expression of rule.accumulated_all) {
      const match = /^(\w+) (>=|<=|=) (false|true|\d+(?:\.\d+)?)$/.exec(expression);
      if (!match || !Object.hasOwn(endingSources, match[1]))
        throw new Error('Undeclared approved predicate: ' + expression);
      const expected = match[3] === 'false' ? false : match[3] === 'true' ? true : Number(match[3]);
      children.push(compare(endingRefId(match[1]), operators[match[2]], expected));
    }
    children.push(
      compare('FINAL_ORPHEUS_MODE', 'eq', rule.final_state.orpheus),
      compare('FINAL_NULL_STATE', 'eq', rule.final_state.nullState),
      compare('FINAL_DISCLOSURE_STATE', 'eq', rule.final_state.disclosure),
      compare('FINAL_ERROR_RATE', 'lte', rule.final_state.maximumServiceError),
    );
    // Require each real service too, without relying only on the authored header
    // proxy; a mismatched header must never hide an affected service.
    for (const service of ['PAYMENT', 'IDENTITY', 'HEALTH', 'FINANCE', 'LOGISTICS'])
      children.push(
        compare('FINAL_' + service + '_ERROR_RATE', 'lte', rule.final_state.maximumServiceError),
      );
    for (const [key, ref, operator] of [
      ['finalCustomerImpactMaximum', 'FINAL_CUSTOMER_IMPACT', 'lte'],
      ['finalPaymentErrorMinimum', 'FINAL_PAYMENT_ERROR_RATE', 'gte'],
      ['finalLogisticsErrorMinimum', 'FINAL_LOGISTICS_ERROR_RATE', 'gte'],
    ])
      if (rule[key] !== undefined) children.push(compare(ref, operator, rule[key]));
    return {
      id: rule.id,
      version,
      priorityRank: rule.priorityRank,
      condition: { type: 'all', children },
    };
  });
  return {
    bindings: {
      task: 'TASK-032',
      date: '2026-10-14',
      authority: 'DEC-057',
      status: 'authored_not_verified_not_runtime_registered',
      definition_identity: proposal.definition_identity,
      logical_sources_replaced: logicalSources,
      references,
      logical_effects_replacement: logical,
      numeric_effects_fragment: effects,
      exact_incident_versions: proposal.operational_scores.incidents
        .map(({ incidentId, contentVersion }) => ({ incidentId, contentVersion }))
        .concat([{ incidentId: terminal.incidentId, contentVersion: terminal.contentVersion }]),
      composition_contract: [
        'Replace the listed logical fragments with logical_effects_replacement; never append both originals and replacements.',
        'Append numeric_effects_fragment and references to the complete new definition only, preserving all other original references/gates/initial flags.',
        'Use only exact_incident_versions; this artifact grants no compatible-version alias or old-run migration.',
        'CURRENT_ACT and every discovery flag come from the approved source fragments; initialize no metrics or inherited completions.',
        'Inline the exact separate ending definition only after complete-package progression/model composition is ready.',
        'Existing replay provenance, once-per-effect receipts and verified response association remain authoritative.',
        'Not a partial playable package, acceptance result, ending grant or runtime epilogue definition.',
      ],
      verification: 'not_run_QA_deferred',
    },
    endings: { ...proposal.ending_identity, finals: [final], entries },
  };
}

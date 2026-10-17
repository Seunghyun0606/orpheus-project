// The campaign-facing surface of an Incident: every Scenario identifier that the
// approved campaign definition binds to (effects, action gates, opportunity
// rules, branches and endings). A redesigned content version may change any
// operational mechanic, but must keep these identifiers so the campaign layer,
// reveal graph and balance keep their meaning.

const BINDING_SECTIONS = ['effects', 'actionGates', 'branches'];

function collectStrings(value, out) {
  if (typeof value === 'string') out.add(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object')
    for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/**
 * @param {object} definition approved campaign definition (parsed YAML)
 * @param {object} scenario the Incident's currently bound Scenario (parsed YAML)
 */
export function incidentInterface(definition, scenario) {
  const id = scenario.id;
  const scoped = [];
  for (const section of BINDING_SECTIONS)
    for (const item of definition[section] ?? [])
      if (item.incidentId === id || item.trigger?.incidentId === id) scoped.push(item);
  for (const rule of definition.opportunities?.rules ?? [])
    if (rule.incidentId === id) scoped.push(rule);
  for (const final of definition.endings?.finals ?? [])
    if (final.incidentId === id) scoped.push(final);
  const strings = collectStrings(scoped, new Set());
  const pick = (ids) => [...new Set(ids)].filter((x) => strings.has(x)).sort();
  return {
    incidentId: id,
    title: scenario.title,
    act: scenario.act,
    actions: pick(scenario.actions.map((a) => a.id)),
    signals: pick(scenario.initialState.signals.map((s) => s.id)),
    flags: pick((scenario.initialState.flags ?? []).map((f) => f.id)),
    // Every evidence record and narrative is a story beat or a balance input.
    evidence: scenario.evidence.map((e) => e.id).sort(),
    narratives: scenario.narratives.map((n) => n.id).sort(),
  };
}

/** Returns human-readable problems; an empty list means the interface is kept. */
export function interfaceProblems(required, scenario) {
  const problems = [];
  const has = {
    actions: new Set(scenario.actions.map((a) => a.id)),
    signals: new Set(scenario.initialState.signals.map((s) => s.id)),
    flags: new Set((scenario.initialState.flags ?? []).map((f) => f.id)),
    evidence: new Set(scenario.evidence.map((e) => e.id)),
    narratives: new Set(scenario.narratives.map((n) => n.id)),
  };
  if (scenario.id !== required.incidentId) problems.push('id must stay ' + required.incidentId);
  if (scenario.title !== required.title) problems.push('title must stay ' + required.title);
  if (scenario.act !== required.act) problems.push('act must stay ' + required.act);
  for (const kind of Object.keys(has))
    for (const item of required[kind])
      if (!has[kind].has(item)) problems.push(`missing ${kind.replace(/s$/, '')} ${item}`);
  return problems;
}

/**
 * Campaign evidence/narrative registry entries for a redesigned Scenario. Kept
 * records retain their registry identity; new records get `<Incident>.<ID>`.
 */
export function campaignRegistries(definition, scenario) {
  const id = scenario.id;
  const short = (x) => id + '.' + x.replace(/^(RECORD_|DISCOVERY_)/, '');
  const build = (section, items, field) => {
    const kept = new Map(
      definition[section].filter((e) => e.scenarioId === id).map((e) => [e[field], e]),
    );
    return items.map((x) => kept.get(x) ?? { id: short(x), scenarioId: id, [field]: x });
  };
  return {
    evidence: build(
      'evidence',
      scenario.evidence.map((e) => e.id),
      'evidenceId',
    ),
    narratives: build(
      'narratives',
      scenario.narratives.map((n) => n.id),
      'narrativeId',
    ),
  };
}

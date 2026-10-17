// Campaign 1.2 composition (DEC-070). Derives the 1.2.0 definition, package and
// ending prose from the approved 1.1.0 authorities plus the redesigned Incidents
// and their bindings in authoring/campaign-1.2/. Older authorities are never
// rewritten. Usage: node scripts/authoring/campaign-1.2.mjs --write
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { campaignRegistries } from './incident-interface.mjs';

export const ROOT = 'src/scenario/data/full-campaign/';
export const AUTHORING = 'authoring/campaign-1.2/';
export const BINDINGS = AUTHORING + 'incidents/';
export const BASE_VERSION = '1.1.0';
export const VERSION = '1.2.0';

const compare = (reference, operator, expected) => ({
  type: 'compare',
  reference,
  operator,
  expected,
});
const pad = (id) => id.toLowerCase();

/** Bindings for every redesigned Incident, ordered by Incident ID. */
export function readBindings(read, list = () => readdirSync(BINDINGS)) {
  return list()
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => read(BINDINGS + f));
}

const OPERATIONAL = new Set(['MITIGATE', 'MODIFY']);
const INVESTIGATIVE = new Set(['OBSERVE', 'INVESTIGATE', 'DIAGNOSE']);

/** Delegated reports: the message each delegation's timer posts. */
function delegatedReports(scenario) {
  return scenario.actions
    .filter((a) => a.delegation)
    .map((a) => {
      const event = scenario.events.find((e) => e.id === a.delegation.eventId);
      const post = event?.effects.find((e) => e.type === 'post_message');
      if (!post) throw new Error('DELEGATION_WITHOUT_REPORT:' + scenario.id + '/' + a.id);
      return { actionId: a.id, messageId: post.messageId, eventId: event.id };
    });
}

// Final decisions (INC-026) are commitments, not operational habits: they do not
// enter restart/rollback or evidence-before-action rates.
const habitual = (bindings) => bindings.operational.filter((o) => o.role !== 'final');

export function behaviorMapping(base, scenario, bindings) {
  const sid = scenario.id;
  const ops = new Map(habitual(bindings).map((o) => [o.actionId, o]));
  const choices = new Set(bindings.choiceActions ?? []);
  const reports = delegatedReports(scenario);
  const key = (x) => sid + '/' + x;
  const supportKeys = [
    ...(bindings.support ?? []).map(key),
    ...reports.map((r) => key(r.messageId)),
  ];
  return {
    scenarioId: sid,
    contentVersion: scenario.contentVersion,
    coverage: 'supported',
    references: structuredClone(base.references),
    actions: scenario.actions.map((a) => {
      const op = ops.get(a.id);
      return {
        actionId: a.id,
        operational: Boolean(op),
        restart: Boolean(op?.restart),
        rollback: Boolean(op?.rollback),
        evidenceEligible: Boolean(op),
      };
    }),
    investigations: [
      ...scenario.actions
        .filter((a) => INVESTIGATIVE.has(a.category) && !choices.has(a.id))
        .map((a) => ({
          id: key(a.id),
          key: key(a.id),
          actionId: a.id,
          result: { kind: 'action_completed' },
        })),
      ...reports.map((r) => ({
        id: key(r.messageId),
        key: key(r.messageId),
        actionId: r.actionId,
        result: {
          kind: 'war_room_message',
          messageId: r.messageId,
          delivery: { kind: 'timer', eventId: r.eventId },
        },
      })),
    ],
    supportRules: habitual(bindings).map((o) => ({
      id: sid + '/SUPPORT/' + o.actionId,
      actionId: o.actionId,
      investigationKeys: supportKeys,
      relevance: compare('CURRENT_ACTION', 'eq', o.actionId),
      freshness: {
        type: 'all',
        children: [compare('OBSERVATION_AGE', 'gte', 0), compare('OBSERVATION_AGE', 'lte', 180)],
      },
    })),
  };
}

export function predictionMapping(base, scenario, bindings, template = base) {
  if (base.coverage !== 'supported') base = template;
  return {
    scenarioId: scenario.id,
    contentVersion: scenario.contentVersion,
    coverage: 'supported',
    references: base.references.map((r) =>
      r.id === 'CAUSAL_OBSERVATION'
        ? { ...structuredClone(r), key: bindings.causalObservationSignal }
        : structuredClone(r),
    ),
    contexts: base.contexts.map((context) => ({
      contextId: context.contextId,
      when: structuredClone(context.when),
      reveal: structuredClone(context.reveal),
      choices: bindings.operational
        .filter((o) => o.candidate !== undefined)
        .map((o) => ({
          actionId: o.actionId,
          candidateId: o.candidate,
          eligible: compare('ELAPSED', 'gte', 0),
        })),
    })),
  };
}

function balanceEffects(effects, sid, bindings) {
  const prefix = 'BALANCE_' + sid + '_';
  const trigger = (targetId) => ({ incidentId: sid, type: 'action_completed', targetId });
  const extra = (ids) =>
    ids.map((targetId) => ({ contentVersion: VERSION, type: 'action_completed', targetId }));
  const withTriggers = (effect, ids) => {
    const next = { ...effect, trigger: trigger(ids[0]) };
    delete next.additionalTriggers;
    if (ids.length > 1) next.additionalTriggers = extra(ids.slice(1));
    return next;
  };
  const causal = bindings.operational.filter((o) => o.role === 'causal').map((o) => o.actionId);
  const temporary = bindings.operational
    .filter((o) => o.role === 'temporary')
    .map((o) => o.actionId);
  const template = effects.find((e) => e.id.startsWith(prefix + 'DAMAGE_'));
  const out = [];
  let damageInserted = false;
  for (const effect of effects) {
    if (effect.id.startsWith(prefix + 'DAMAGE_')) {
      if (damageInserted) continue;
      damageInserted = true;
      for (const o of bindings.operational)
        out.push({
          ...structuredClone(template),
          id: prefix + 'DAMAGE_' + o.actionId,
          trigger: trigger(o.actionId),
          values: { collateralDamage: o.collateralDamage },
        });
    } else if (effect.id === prefix + 'CAUSAL_REPAIR') out.push(withTriggers(effect, causal));
    else if (effect.id === prefix + 'TEMPORARY_EXPOSURE') {
      if (temporary.length) out.push(withTriggers(effect, temporary));
    } else if (effect.trigger.incidentId === sid && effect.additionalTriggers)
      out.push({
        ...effect,
        additionalTriggers: effect.additionalTriggers.map((t) => ({
          ...t,
          contentVersion: VERSION,
        })),
      });
    else out.push(effect);
  }
  return out;
}

// Catch-up re-investigations appear only while the record is still undiscovered.
function catchUpGate(gate, effects) {
  if (!gate.actionId.startsWith('REINVESTIGATE_')) return gate;
  const record = 'RECORD_' + gate.actionId.slice('REINVESTIGATE_'.length);
  const discovery = effects.find(
    (e) =>
      e.trigger.type === 'evidence_revealed' &&
      e.trigger.targetId === record &&
      e.trigger.incidentId === gate.incidentId &&
      e.condition.type === 'all',
  );
  const flag = discovery?.condition.children.find(
    (c) => c.type === 'compare' && /_DISCOVERED$/.test(c.reference) && c.expected === false,
  );
  if (!flag) return gate;
  const children = gate.eligibility.type === 'all' ? gate.eligibility.children : [gate.eligibility];
  return {
    ...gate,
    eligibility: { type: 'all', children: [...children, compare(flag.reference, 'eq', false)] },
  };
}

export function authorCampaign12(read, bindingsList = readBindings(read)) {
  const base = read(ROOT + 'definitions/campaign-' + BASE_VERSION + '.yaml');
  const d = structuredClone(base);
  d.version = VERSION;
  for (const ref of d.references) ref.version = VERSION;
  for (const branch of d.branches) branch.version = VERSION;

  // Shape of a supported prediction mapping, for Incidents that had none (INC-026).
  const template = base.prediction.scenarios.find((m) => m.coverage === 'supported');
  const scenarios = new Map();
  for (const bindings of bindingsList) {
    const sid = bindings.incidentId;
    const scenario = read(ROOT + 'incidents/' + pad(sid) + '-' + VERSION + '.yaml');
    if (scenario.id !== sid || scenario.contentVersion !== VERSION)
      throw new Error('SCENARIO_BINDING_MISMATCH:' + sid);
    scenarios.set(sid, scenario);

    d.incidents.find((i) => i.id === sid).contentVersion = VERSION;
    const registries = campaignRegistries(base, scenario);
    for (const section of ['evidence', 'narratives']) {
      const at = d[section].findIndex((e) => e.scenarioId === sid);
      d[section] = d[section].filter((e) => e.scenarioId !== sid);
      d[section].splice(at < 0 ? d[section].length : at, 0, ...registries[section]);
    }
    d.effects = balanceEffects(d.effects, sid, bindings);
    d.actionGates = d.actionGates.map((g) =>
      g.incidentId === sid ? catchUpGate({ ...g, contentVersion: VERSION }, d.effects) : g,
    );
    for (const rule of d.opportunities.rules)
      if (rule.incidentId === sid) rule.contentVersion = VERSION;
    const bIndex = d.behavior.scenarios.findIndex((s) => s.scenarioId === sid);
    d.behavior.scenarios[bIndex] = behaviorMapping(
      d.behavior.scenarios[bIndex],
      scenario,
      bindings,
    );
    const pIndex = d.prediction.scenarios.findIndex((s) => s.scenarioId === sid);
    d.prediction.scenarios[pIndex] = predictionMapping(
      d.prediction.scenarios[pIndex],
      scenario,
      bindings,
      template,
    );
    for (const final of d.endings.finals)
      if (final.incidentId === sid) final.contentVersion = VERSION;
  }

  // The player model and endings change meaning in 1.2, so each gets its own version.
  for (const model of ['behavior', 'prediction', 'opportunities', 'endings'])
    bumpVersions(d[model], d[model].version, VERSION);
  for (const model of [d.opportunities, d.endings]) {
    model.behaviorVersion = d.behavior.version;
    model.predictionVersion = d.prediction.version;
  }
  const authored = read(AUTHORING + 'opportunities.yaml');
  for (const rule of d.opportunities.rules)
    if (authored.texts[rule.id]) rule.presentation.text = authored.texts[rule.id];
  exposePredictions(d, scenarios, authored.predictions);
  const finalBindings = bindingsList.find((b) => b.final);
  if (finalBindings) gateFinalPlans(d, finalBindings);
  const prose = endingProse(
    d,
    read(ROOT + 'ending-presentations/endings-' + BASE_VERSION + '.yaml'),
    read(AUTHORING + 'ending-prose.yaml'),
  );

  const pkg = structuredClone(read(ROOT + 'packages/campaign-' + BASE_VERSION + '.yaml'));
  pkg.version = VERSION;
  pkg.definitionVersion = VERSION;
  pkg.endingPresentation.version = VERSION;
  pkg.scenarios = d.incidents.map((i) => ({
    scenarioId: i.scenarioId,
    contentVersion: i.contentVersion,
  }));
  pkg.presentations = pkg.presentations.map((view) =>
    scenarios.has(view.scenarioId) ? { ...view, version: VERSION, contentVersion: VERSION } : view,
  );

  return {
    [ROOT + 'definitions/campaign-' + VERSION + '.yaml']: d,
    [ROOT + 'packages/campaign-' + VERSION + '.yaml']: pkg,
    [ROOT + 'ending-presentations/endings-' + VERSION + '.yaml']: prose,
  };
}

// --- Player model and endings (DEC-070 priority 4) -------------------------------

/** Replace every nested `version: from` with `to` inside one model. */
function bumpVersions(value, from, to) {
  if (Array.isArray(value)) for (const item of value) bumpVersions(item, from, to);
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value))
      if (key === 'version' && item === from) value[key] = to;
      else bumpVersions(item, from, to);
}

const ref = (id, source, key, valueType, version) => ({ id, version, source, key, valueType });
const containedFlag = (scenario) =>
  (scenario.initialState.flags ?? []).some((f) => f.id === 'FINAL_DECISION_COMMITTED')
    ? 'FINAL_DECISION_COMMITTED'
    : 'ROOT_CAUSE_CONTAINED';

/**
 * From Act 4 the player can ask ORPHEUS for its forecast of their next decision.
 * The after-observation context becomes visible while the cause is unresolved, and
 * every such Incident carries a prediction opportunity with ORPHEUS's lead-in.
 */
function exposePredictions(d, scenarios, lines) {
  const model = d.prediction.version;
  const opportunityVersion = d.opportunities.version;
  for (const incident of d.incidents) {
    if (incident.act < 4) continue;
    const scenario = scenarios.get(incident.id);
    const mapping = d.prediction.scenarios.find((m) => m.scenarioId === incident.id);
    if (!scenario || mapping?.coverage !== 'supported') continue;
    const flag = containedFlag(scenario);
    for (const [id, source, key, type] of [
      ['CURRENT_ACT', 'campaign', 'CURRENT_ACT', 'number'],
      ['CAUSE_CONTAINED', 'flag', flag, 'boolean'],
    ])
      if (!mapping.references.some((r) => r.id === id))
        mapping.references.push(ref(id, source, key, type, model));
    const visible = {
      type: 'all',
      children: [
        compare('CURRENT_ACT', 'gte', incident.act),
        compare('CAUSE_CONTAINED', 'eq', false),
      ],
    };
    const after = mapping.contexts.find((c) => c.contextId === 'AFTER_CAUSAL_OBSERVATION');
    const hidden =
      after.reveal.type === 'compare' &&
      after.reveal.reference === 'ELAPSED' &&
      after.reveal.operator === 'lt';
    if (hidden) after.reveal = visible;

    const text = lines[incident.id];
    if (!text) throw new Error('MISSING_PREDICTION_LINE:' + incident.id);
    const existing = d.opportunities.rules.find(
      (r) => r.incidentId === incident.id && r.kind === 'prediction',
    );
    if (existing) {
      existing.presentation.text = text;
      continue;
    }
    const id = 'PREDICTION_' + incident.id.replace('-', '_');
    const condition = hidden ? visible : structuredClone(after.reveal);
    d.opportunities.rules.push({
      id,
      version: opportunityVersion,
      incidentId: incident.id,
      contentVersion: incident.contentVersion,
      metric: 'predictionDeviation',
      kind: 'prediction',
      contextId: 'AFTER_CAUSAL_OBSERVATION',
      presentation: { id: 'PRESENTATION_' + id, text },
      consumption: 'single_response',
      replacement: 'none',
      references: [
        ref('ELAPSED', 'elapsedSeconds', 'current', 'number', opportunityVersion),
        ref('EXPOSURE_AGE', 'ageSeconds', 'current', 'number', opportunityVersion),
        ref('CURRENT_ACT', 'campaign', 'CURRENT_ACT', 'number', opportunityVersion),
        ref('CAUSE_CONTAINED', 'flag', flag, 'boolean', opportunityVersion),
      ],
      available: structuredClone(condition),
      reveal: structuredClone(condition),
      valid: {
        type: 'all',
        children: [
          structuredClone(condition),
          compare('EXPOSURE_AGE', 'gte', 0),
          compare('EXPOSURE_AGE', 'lte', 180),
        ],
      },
      responses: after.choices.map((c) => ({
        actionId: c.actionId,
        eligible: structuredClone(condition),
      })),
    });
  }
}

/**
 * Final plans are offered only when the player's accumulated record already meets
 * the matching ending, so every offered plan resolves to an ending. Pulling the plug
 * (SHUTDOWN) asks nothing beyond finishing the campaign and is always available.
 */
function gateFinalPlans(d, finalBindings) {
  const endingRefs = new Set(
    d.references.filter((r) => r.id.startsWith('ENDING_ACCUMULATED_')).map((r) => r.id),
  );
  for (const r of d.references) if (endingRefs.has(r.id)) r.contexts = ['ending', 'action'];
  const shutdown = d.endings.entries.find((e) => e.id === 'SHUTDOWN');
  shutdown.condition.children = shutdown.condition.children.filter(
    (c) =>
      ![
        'ENDING_ACCUMULATED_operationalSafety',
        'ENDING_ACCUMULATED_evidenceBeforeActionRate',
      ].includes(c.reference),
  );
  const damage = new Map(finalBindings.operational.map((o) => [o.actionId, o.collateralDamage]));
  for (const entry of d.endings.entries) {
    const plan = entry.condition.children.find((c) => c.reference?.startsWith('FINAL_ACTION_'));
    const actionId = plan.reference.slice('FINAL_ACTION_'.length);
    // The plan's own consequences land after the gate; reserve room for them.
    const record = entry.condition.children
      .filter((c) => endingRefs.has(c.reference))
      .map((c) =>
        c.reference === 'ENDING_ACCUMULATED_collateralDamage' && c.operator === 'lte'
          ? { ...c, expected: c.expected - (damage.get(actionId) ?? 0) }
          : structuredClone(c),
      );
    const gate = d.actionGates.find((g) => g.incidentId === 'INC-026' && g.actionId === actionId);
    if (!gate) throw new Error('MISSING_FINAL_PLAN_GATE:' + actionId);
    const children =
      gate.eligibility.type === 'all' ? gate.eligibility.children : [gate.eligibility];
    gate.eligibility = { type: 'all', children: [...children, ...record] };
  }
}

/** Ending prose 1.2.0 from authoring/campaign-1.2/ending-prose.yaml. */
function endingProse(d, base, source) {
  const prose = {
    ...structuredClone(base),
    version: VERSION,
    definitionVersion: VERSION,
    endingDefinitionVersion: d.endings.version,
    references: [],
    entries: structuredClone(source.entries),
    sections: [],
    closingBlocks: structuredClone(source.closingBlocks),
  };
  for (const section of source.sections) {
    const known = 'KNOWN_' + section.flag;
    const parent = 'ENDING_PRESENTATION_' + section.flag;
    if (!d.references.some((r) => r.id === parent))
      d.references.push({
        ...ref(parent, 'narrative_flag', section.flag, 'boolean', VERSION),
        contexts: ['ending'],
      });
    if (!prose.references.some((r) => r.id === known))
      prose.references.push(ref(known, 'campaign', parent, 'boolean', VERSION));
    prose.sections.push({
      id: section.id,
      title: section.title,
      endingIds: section.endingIds,
      reveal: compare(known, 'eq', true),
      blocks: structuredClone(section.blocks),
    });
  }
  return prose;
}

const HEADER =
  '# Generated by scripts/authoring/campaign-1.2.mjs from campaign 1.1.0 and\n' +
  '# authoring/campaign-1.2. Edit the sources and regenerate; do not edit by hand.\n';

export function serialize(value) {
  return HEADER + stringify(value, { lineWidth: 0 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--write') throw new Error('Usage: campaign-1.2.mjs --write');
  const files = authorCampaign12((p) => parse(readFileSync(p, 'utf8')));
  for (const [file, value] of Object.entries(files)) {
    if (!file.includes('-' + VERSION + '.')) throw new Error('REFUSING_OLD_AUTHORITY:' + file);
    writeFileSync(file, serialize(value), 'utf8');
  }
  console.log(
    `Wrote ${Object.keys(files).length} campaign ${VERSION} authorities` +
      (existsSync(BINDINGS)
        ? ` from ${readBindings((p) => parse(readFileSync(p, 'utf8'))).length} redesigned Incidents.`
        : '.'),
  );
}

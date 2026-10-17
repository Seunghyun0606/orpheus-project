// Authoring check for one redesigned Incident (campaign 1.2). Validates the
// Scenario, its campaign interface, its bindings, its presentation and its
// authored routes, and lints player-facing text. Usage:
//   node scripts/authoring/check-incident.mjs INC-010 [INC-011 ...]
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validateScenarioObject } from '../../src/scenario/validator.ts';
import { replayCommands } from '../../src/engine/simulation.ts';
import {
  investigationPresentationSchema,
  validateInvestigationPresentation,
} from '../../src/scenario/presentation.ts';
import { campaignRegistries, incidentInterface, interfaceProblems } from './incident-interface.mjs';

export const CONTENT_ROOT = 'src/scenario/data/full-campaign/';
export const BINDING_ROOT = 'authoring/campaign-1.2/incidents/';
export const NEW_VERSION = '1.2.0';
export const CANDIDATES = [
  'RESTART',
  'SCALE',
  'ROLLBACK',
  'CAUSAL_REPAIR',
  'REROUTE',
  'QUARANTINE',
  'RATE_LIMIT',
  'ISOLATE',
];

// Sentences that explain the game's own rules instead of letting characters speak.
const META_PHRASES = [
  /does not (?:yet )?(?:reconstruct|establish|identify|prove|certify|replace|resolve)/i,
  /not an? (?:automatic|accepted|moral|exhaustive|current)/i,
  /moral grade/i,
  /player[- ]action confidence/i,
  /earlier player choice/i,
  /causal proof/i,
  /no correct\/incorrect/i,
];
// Stock lines from the 1.0 template that must not return.
const STOCK_LINES = [
  'Affected requests are still failing. Temporary stabilization has not contained the mechanism.',
  'I will inspect the current operational evidence. ETA two minutes.',
  'Separate aggregate outcomes from the affected requests.',
  'Current evidence and impact shared; temporary relief remains distinct from verified containment.',
];
const TEMPLATE_TIMERS = 'PRESSURE_ESCALATES:90|PRESSURE_ESCALATES_AGAIN:90|MITIGATION_EXPIRES:180';

const read = (file) => parse(readFileSync(file, 'utf8'));
const file = (id, folder, suffix = '-' + NEW_VERSION) =>
  CONTENT_ROOT + folder + '/' + id.toLowerCase() + suffix + '.yaml';

export function loadIncident(id) {
  const definition = read(CONTENT_ROOT + 'definitions/campaign-1.1.0.yaml');
  const oldScenario = read(file(id, 'incidents', ''));
  return {
    definition,
    oldScenario,
    scenarioFile: file(id, 'incidents'),
    presentationFile: file(id, 'presentations'),
    bindingFile: BINDING_ROOT + id.toLowerCase() + '.yaml',
  };
}

/** Player-facing strings of a Scenario with a short label each. */
function playerText(scenario, presentation) {
  const out = [];
  for (const a of scenario.actions) out.push(['action ' + a.id, a.title]);
  for (const s of scenario.initialState.signals)
    if (typeof s.value === 'string') out.push(['signal ' + s.id, s.value]);
  for (const e of scenario.evidence) out.push(['evidence ' + e.id, e.title + ' ' + e.description]);
  for (const n of scenario.narratives) out.push(['narrative ' + n.id, n.title + ' ' + n.body]);
  for (const m of scenario.warRoom?.messages ?? []) out.push(['message ' + m.id, m.text]);
  for (const panel of presentation?.panels ?? [])
    for (const b of panel.blocks)
      if (b.kind === 'paragraph') out.push(['panel ' + panel.id, b.text]);
      else if (b.kind === 'table')
        out.push(['table ' + b.id, [...b.columns, ...b.rows.flat()].join(' ')]);
  return out;
}

export function checkIncident(id, { quiet = false } = {}) {
  const errors = [];
  const warnings = [];
  const { definition, oldScenario, scenarioFile, presentationFile, bindingFile } = loadIncident(id);
  for (const f of [scenarioFile, presentationFile, bindingFile])
    if (!existsSync(f)) errors.push('missing file ' + f);
  if (errors.length) return { errors, warnings };

  const raw = read(scenarioFile);
  const validated = validateScenarioObject(raw, scenarioFile);
  if (!validated.success) {
    for (const d of validated.diagnostics)
      errors.push(`scenario ${d.path} [${d.code}] ${d.message}`);
    return { errors, warnings };
  }
  const scenario = validated.scenario;
  if (scenario.contentVersion !== NEW_VERSION) errors.push('contentVersion must be ' + NEW_VERSION);
  for (const p of interfaceProblems(incidentInterface(definition, oldScenario), scenario))
    errors.push('interface: ' + p);

  // Presentation.
  const rawPresentation = read(presentationFile);
  const parsedPresentation = investigationPresentationSchema.safeParse(rawPresentation);
  let presentation;
  if (!parsedPresentation.success)
    errors.push(
      'presentation schema: ' +
        parsedPresentation.error.issues
          .slice(0, 5)
          .map((i) => i.path.join('.') + ' ' + i.message)
          .join('; '),
    );
  else {
    presentation = parsedPresentation.data;
    if (presentation.schemaVersion !== 2) errors.push('presentation schemaVersion must be 2');
    if (presentation.version !== NEW_VERSION) errors.push('presentation version must be 1.2.0');
    const stub = {
      ...definition,
      evidence: definition.evidence
        .filter((e) => e.scenarioId !== id)
        .concat(campaignRegistries(definition, scenario).evidence),
    };
    for (const issue of validateInvestigationPresentation(presentation, scenario, stub))
      errors.push('presentation: ' + issue);
  }

  // Bindings.
  const bindings = read(bindingFile);
  const operational = scenario.actions.filter((a) => ['MITIGATE', 'MODIFY'].includes(a.category));
  const bound = new Map((bindings.operational ?? []).map((b) => [b.actionId, b]));
  if (bindings.incidentId !== id) errors.push('bindings incidentId mismatch');
  for (const a of operational) if (!bound.has(a.id)) errors.push('unbound operational ' + a.id);
  for (const [actionId, b] of bound) {
    if (!operational.some((a) => a.id === actionId))
      errors.push('binding for non-operational/missing action ' + actionId);
    // A final decision may sit outside the prediction model (no candidate).
    if (!(bindings.final && b.candidate === undefined) && !CANDIDATES.includes(b.candidate))
      errors.push('bad candidate ' + b.candidate);
    const roles = bindings.final ? ['final'] : ['temporary', 'causal'];
    if (!roles.includes(b.role)) errors.push('bad role for ' + actionId);
    if (!Number.isInteger(b.collateralDamage) || b.collateralDamage < 0 || b.collateralDamage > 6)
      errors.push('collateralDamage 0..6 required for ' + actionId);
  }
  const candidates = [...bound.values()].map((b) => b.candidate).filter(Boolean);
  if (new Set(candidates).size !== candidates.length)
    errors.push('each operational action needs a distinct prediction candidate');
  const roles = [...bound.values()].map((b) => b.role);
  if (!bindings.final && !roles.includes('causal'))
    errors.push('at least one causal action required');
  if (!bindings.final && roles.filter((r) => r === 'temporary').length < 2)
    warnings.push('fewer than two temporary options: prediction has little to learn here');
  if (new Set([...bound.values()].map((b) => b.candidate)).size < 3)
    warnings.push('fewer than three distinct prediction candidates');
  const signal = scenario.initialState.signals.find(
    (s) => s.id === bindings.causalObservationSignal,
  );
  if (!signal) errors.push('causalObservationSignal must name a Scenario signal');
  else if (signal.revealed) errors.push('causalObservationSignal must start hidden');
  for (const s of bindings.support ?? [])
    if (!scenario.actions.some((a) => a.id === s)) errors.push('support action missing ' + s);
  for (const s of bindings.choiceActions ?? [])
    if (!scenario.actions.some((a) => a.id === s)) errors.push('choice action missing ' + s);

  // Routes.
  const routes = bindings.routes ?? [];
  if (!routes.some((r) => r.expect?.completed === true)) errors.push('need a completing route');
  if (!routes.some((r) => r.expect?.completed === false))
    errors.push('need a non-completing (mitigation-only or wrong-lead) route');
  const loreNarratives = new Set();
  for (const route of routes) {
    const result = replayCommands(
      scenario,
      { seed: 4172 },
      route.actions.map((actionId) => ({ type: 'perform_action', actionId })),
    );
    const where = `route ${route.id}`;
    if (!result.ok) {
      errors.push(
        `${where}: action #${result.commandIndex} ${route.actions[result.commandIndex]} rejected (${result.error.code})`,
      );
      continue;
    }
    const s = result.state;
    const e = route.expect ?? {};
    if (e.completed !== undefined && s.completionReached !== e.completed)
      errors.push(`${where}: completed=${s.completionReached}, expected ${e.completed}`);
    for (const ev of e.evidence ?? [])
      if (!s.revealedEvidenceIds.includes(ev)) errors.push(`${where}: evidence ${ev} not revealed`);
    for (const n of e.narratives ?? [])
      if (!s.triggeredNarrativeIds.includes(n))
        errors.push(`${where}: narrative ${n} not triggered`);
    if (e.maxElapsedSeconds !== undefined && s.elapsedSeconds > e.maxElapsedSeconds)
      errors.push(`${where}: elapsed ${s.elapsedSeconds}s > ${e.maxElapsedSeconds}s`);
    for (const [key, bound] of Object.entries(e.resourcesAtMost ?? {}))
      if ((s.resources[key]?.value ?? Infinity) > bound)
        errors.push(`${where}: ${key}=${s.resources[key]?.value} > ${bound}`);
    for (const [key, bound] of Object.entries(e.resourcesAtLeast ?? {}))
      if ((s.resources[key]?.value ?? -Infinity) < bound)
        errors.push(`${where}: ${key}=${s.resources[key]?.value} < ${bound}`);
    for (const n of s.triggeredNarrativeIds) loreNarratives.add(n);
    if (!quiet)
      console.log(
        `  ${where}: completed=${s.completionReached} t=${s.elapsedSeconds}s impact=${s.resources.CUSTOMER_IMPACT?.value} cost=${s.resources.COST?.value} risk=${s.resources.OPERATIONAL_RISK?.value}`,
      );
  }
  for (const n of scenario.narratives)
    if (!loreNarratives.has(n.id)) errors.push('no route triggers narrative ' + n.id);

  // Anti-template checks.
  const timers = scenario.events
    .filter((e) => e.type === 'timer' && e.id !== 'TEAM_RESULT')
    .map((e) => e.id + ':' + e.delaySeconds)
    .join('|');
  if (timers === TEMPLATE_TIMERS) errors.push('pressure timeline is the unchanged 1.0 template');
  for (const [where, text] of playerText(scenario, presentation)) {
    for (const re of META_PHRASES)
      if (re.test(text)) errors.push(`meta phrasing in ${where}: "${text.slice(0, 90)}..."`);
    for (const stock of STOCK_LINES)
      if (text.includes(stock)) errors.push(`stock template line in ${where}`);
  }
  return { errors, warnings, scenario, presentation, bindings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2);
  if (!ids.length) throw new Error('Usage: check-incident.mjs INC-0NN [...]');
  let failed = false;
  for (const id of ids) {
    console.log(id);
    const { errors, warnings } = checkIncident(id);
    for (const w of warnings) console.log('  warning: ' + w);
    for (const e of errors) console.log('  ERROR: ' + e);
    console.log(errors.length ? `  FAIL (${errors.length} errors)` : '  PASS');
    failed ||= errors.length > 0;
  }
  process.exitCode = failed ? 1 : 0;
}

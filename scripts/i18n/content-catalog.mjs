// Content translation catalogs (DEC-071). Authored content stays English and
// hash-pinned; each catalog under src/i18n/content/<locale>/ lists the
// player-facing English strings of one content group with their translation.
//
//   node scripts/i18n/content-catalog.mjs           add new strings, drop stale ones
//   node scripts/i18n/content-catalog.mjs --check   fail on missing/stale/untranslated
//   node scripts/i18n/content-catalog.mjs --report  per-catalog coverage, never fails
//   node scripts/i18n/content-catalog.mjs --only story-inc-010   write one catalog only
//   node scripts/i18n/content-catalog.mjs --harmonize
//       give an English string translated differently in several catalogs its
//       most common translation everywhere (ties: the earliest catalog wins)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isScalar, parse, visit } from 'yaml';

const LOCALES = ['ko'];
const DATA = 'src/scenario/data/';
const CAMPAIGN = DATA + 'full-campaign/';
const PACKAGE = CAMPAIGN + 'packages/campaign-1.2.0.yaml';
export const CATALOG_DIR = (locale) => `src/i18n/content/${locale}/`;

// Keys whose string values reach the screen. Everything else is an identifier,
// enum, reference or authoring metadata.
const TEXT_KEYS = new Set([
  'title',
  'name',
  'value',
  'label',
  'description',
  'body',
  'text',
  'columns',
  'rows',
  'unit',
]);
// Story episodes (DEC-072) speak through their own keys.
const STORY_TEXT_KEYS = new Set([
  ...TEXT_KEYS,
  'narrate',
  'log',
  'prompt',
  'consequence',
  'keywords',
]);
const STORY = 'src/story/data/';

// Identifiers, numbers, timestamps and machine tokens read the same in every language.
const NOT_TEXT = [
  /^[A-Z0-9_@.\-/:]+$/,
  /^[-+]?[\d.,:%/\s×x$€£~<>=()+-]*\d[\d.,:%/\s×x$€£~<>=()+-]*$/,
  /^[a-z0-9][a-z0-9._\-/:@]*[0-9._\-/:@][a-z0-9._\-/:@]*$/,
];
const isText = (value) =>
  typeof value === 'string' && value.trim().length > 0 && !NOT_TEXT.some((re) => re.test(value));

// Mirrors src/app/format.ts humanize(): the fallback label for IDs without one.
export const humanize = (id) =>
  id
    .toLowerCase()
    .split(/[_-]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function collect(node, key, out, keys = TEXT_KEYS) {
  if (typeof node === 'string') {
    if (keys.has(key) && isText(node)) out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collect(item, key, out, keys);
  } else if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collect(v, k, out, keys);
  }
}

// Scenario IDs shown through the humanize() fallback: unlabelled signals,
// resources, flags and unlabelled mechanisms.
function humanizedIds(scenario, out) {
  for (const signal of scenario.initialState?.signals ?? [])
    if (signal.label === undefined) out.push(humanize(signal.id));
  for (const resource of scenario.initialState?.resources ?? []) out.push(humanize(resource.id));
  const visit = (node) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node !== null && typeof node === 'object') {
      if (typeof node.flagId === 'string') out.push(humanize(node.flagId));
      if (typeof node.resourceId === 'string') out.push(humanize(node.resourceId));
      if (typeof node.capacityResourceId === 'string') out.push(humanize(node.capacityResourceId));
      Object.values(node).forEach(visit);
    }
  };
  visit(scenario.actions);
  visit(scenario.events);
}

const load = (file) => parse(readFileSync(file, 'utf8'));

function findVersioned(dir, match) {
  for (const f of readdirSync(dir).sort()) {
    if (!/\.ya?ml$/.test(f)) continue;
    const doc = load(dir + f);
    if (match(doc)) return { file: dir + f, doc };
  }
  throw new Error(`No content in ${dir} matches the campaign 1.2.0 package.`);
}

// One catalog per content group: the desk training Incidents, each campaign
// Incident (scenario + investigation presentation), the campaign, its endings
// and each story episode.
export function contentGroups() {
  const groups = [];
  for (const f of readdirSync(DATA + 'incidents').sort()) {
    const doc = load(DATA + 'incidents/' + f);
    groups.push({
      name: 'desk-' + doc.id.toLowerCase(),
      sources: [{ file: DATA + 'incidents/' + f, doc }],
    });
  }
  const pkg = load(PACKAGE);
  for (const s of pkg.scenarios) {
    const scenario = findVersioned(
      CAMPAIGN + 'incidents/',
      (d) => d.id === s.scenarioId && d.contentVersion === s.contentVersion,
    );
    const p = pkg.presentations.find((x) => x.scenarioId === s.scenarioId);
    const sources = [scenario];
    if (p)
      sources.push(
        findVersioned(CAMPAIGN + 'presentations/', (d) => d.id === p.id && d.version === p.version),
      );
    groups.push({ name: s.scenarioId.toLowerCase(), sources });
  }
  groups.push({
    name: 'campaign',
    sources: [
      findVersioned(
        CAMPAIGN + 'definitions/',
        (d) => d.id === pkg.definitionId && d.version === pkg.definitionVersion,
      ),
    ],
  });
  groups.push({
    name: 'endings',
    sources: [
      findVersioned(
        CAMPAIGN + 'ending-presentations/',
        (d) => d.id === pkg.endingPresentation.id && d.version === pkg.endingPresentation.version,
      ),
    ],
  });
  if (existsSync(STORY))
    for (const f of readdirSync(STORY).sort()) {
      if (!/\.ya?ml$/.test(f)) continue;
      let doc;
      try {
        doc = load(STORY + f);
      } catch (error) {
        // An episode being written may not parse yet; its catalog waits.
        console.warn(`skipping ${STORY + f}: ${error.message.split('\n')[0]}`);
        continue;
      }
      if (typeof doc?.id !== 'string') continue;
      groups.push({
        name: 'story-' + doc.id.toLowerCase(),
        story: true,
        sources: [{ file: STORY + f, doc }],
      });
    }
  for (const group of groups) {
    const strings = [];
    for (const { doc } of group.sources) {
      collect(doc, '', strings, group.story ? STORY_TEXT_KEYS : TEXT_KEYS);
      if (doc.initialState) humanizedIds(doc, strings);
    }
    group.strings = [...new Set(strings)];
  }
  return groups;
}

function readCatalog(file) {
  if (!existsSync(file)) return [];
  const doc = parse(readFileSync(file, 'utf8'));
  return Array.isArray(doc?.entries) ? doc.entries : [];
}

function writeCatalog(file, group, entries) {
  const header =
    `# ${group.name}: player-facing strings of\n` +
    group.sources.map(({ file: f }) => `#   ${f}\n`).join('') +
    '# Generated by scripts/i18n/content-catalog.mjs; translate `ko` only. Entries are\n' +
    '# keyed by the exact English text. Keep technical tokens (IDs, hosts, numbers) as is.\n';
  const doc = new Document({ entries });
  visit(doc, {
    Scalar(_, node) {
      if (isScalar(node) && typeof node.value === 'string' && node.value.includes('\n'))
        node.type = 'BLOCK_LITERAL';
    },
  });
  writeFileSync(file, header + doc.toString({ lineWidth: 0 }), 'utf8');
}

export function syncCatalogs({ mode = 'write', only } = {}) {
  const problems = [];
  const report = [];
  const translations = new Map();
  for (const locale of LOCALES) {
    const dir = CATALOG_DIR(locale);
    if (mode === 'write') mkdirSync(dir, { recursive: true });
    const expected = new Set();
    for (const group of contentGroups()) {
      if (only !== undefined && group.name !== only) {
        expected.add(`${group.name}.yaml`);
        continue;
      }
      const file = `${dir}${group.name}.yaml`;
      expected.add(`${group.name}.yaml`);
      const existing = readCatalog(file);
      const known = new Map(existing.map((e) => [e.en, e.ko ?? null]));
      const entries = group.strings.map((en) => ({ en, ko: known.get(en) ?? null }));
      const missing = group.strings.filter((en) => !known.has(en));
      const stale = existing.filter((e) => !group.strings.includes(e.en));
      const untranslated = entries.filter((e) => typeof e.ko !== 'string' || e.ko.length === 0);
      for (const e of entries)
        if (typeof e.ko === 'string' && e.ko.length > 0) {
          const prior = translations.get(e.en);
          // The runtime dictionary is keyed by English text alone, so one
          // string can only have one translation.
          if (prior && prior.ko !== e.ko)
            problems.push(
              `${file}: "${e.en.slice(0, 50)}" is translated differently in ${prior.group}`,
            );
          else translations.set(e.en, { ko: e.ko, group: group.name });
        }
      report.push(
        `${locale}/${group.name}: ${entries.length - untranslated.length}/${entries.length} translated` +
          (missing.length ? `, ${missing.length} new` : '') +
          (stale.length ? `, ${stale.length} stale` : ''),
      );
      if (mode === 'write') {
        if (missing.length || stale.length || !existsSync(file)) writeCatalog(file, group, entries);
      } else {
        if (missing.length) problems.push(`${file}: ${missing.length} strings not in the catalog`);
        if (stale.length) problems.push(`${file}: ${stale.length} entries no longer in content`);
        if (untranslated.length)
          problems.push(`${file}: ${untranslated.length} entries without a translation`);
      }
    }
    if (existsSync(dir))
      for (const f of readdirSync(dir))
        if (!expected.has(f)) problems.push(`${dir}${f}: no content group uses this catalog`);
  }
  return { problems, report };
}

export function harmonizeCatalogs() {
  const changed = new Map();
  for (const locale of LOCALES) {
    const dir = CATALOG_DIR(locale);
    const groups = contentGroups().map((group) => ({
      group,
      file: `${dir}${group.name}.yaml`,
      entries: readCatalog(`${dir}${group.name}.yaml`),
    }));
    const votes = new Map();
    for (const { entries } of groups)
      for (const { en, ko } of entries) {
        if (typeof ko !== 'string' || ko.length === 0) continue;
        const counts = votes.get(en) ?? new Map();
        counts.set(ko, (counts.get(ko) ?? 0) + 1);
        votes.set(en, counts);
      }
    const chosen = new Map();
    for (const [en, counts] of votes)
      if (counts.size > 1)
        chosen.set(en, [...counts].reduce((best, next) => (next[1] > best[1] ? next : best))[0]);
    for (const { group, file, entries } of groups) {
      let dirty = false;
      const next = entries.map((entry) => {
        const ko = chosen.get(entry.en);
        if (ko === undefined || ko === entry.ko) return entry;
        dirty = true;
        return { ...entry, ko };
      });
      if (dirty) {
        writeCatalog(file, group, next);
        changed.set(file, next.filter((e, i) => e !== entries[i]).length);
      }
    }
  }
  return changed;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url) &&
  process.argv.includes('--harmonize')
) {
  for (const [file, count] of harmonizeCatalogs()) console.log(`${file}: ${count} entries aligned`);
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--check')
    ? 'check'
    : process.argv.includes('--report')
      ? 'report'
      : 'write';
  const at = process.argv.indexOf('--only');
  const only = at >= 0 ? process.argv[at + 1] : undefined;
  const { problems, report } = syncCatalogs({ mode, only });
  if (mode !== 'check') for (const line of report) console.log(line);
  for (const p of problems) console.error(p);
  if (mode === 'check') {
    if (problems.length) process.exitCode = 1;
    else console.log('Content translation catalogs are complete.');
  }
}

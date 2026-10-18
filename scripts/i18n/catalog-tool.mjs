// Translator helper for content catalogs, so the English key never has to be
// retyped:
//   node scripts/i18n/catalog-tool.mjs dump <group> [locale]
//       prints {"<index>": "<english>"} for untranslated entries (all with --all)
//   node scripts/i18n/catalog-tool.mjs apply <group> <translations.json> [locale]
//       translations.json is {"<index>": "<translation>"}; fills those entries
//   node scripts/i18n/catalog-tool.mjs known <group> [locale]
//       prints {"<index>": "<translation>"} for untranslated entries whose English
//       text another catalog already translates; reuse these exactly (one English
//       string can only have one translation)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isScalar, parse, parseDocument, visit } from 'yaml';

import { CATALOG_DIR } from './content-catalog.mjs';

const [command, group, arg3, arg4] = process.argv.slice(2).filter((a) => a !== '--all');
const all = process.argv.includes('--all');
const locale = (command === 'apply' ? arg4 : arg3) ?? 'ko';
const file = `${CATALOG_DIR(locale)}${group}.yaml`;
const source = readFileSync(file, 'utf8');
const doc = parseDocument(source);
const entries = doc.get('entries').items;

if (command === 'known') {
  const known = new Map();
  for (const other of readdirSync(CATALOG_DIR(locale))) {
    if (other === `${group}.yaml`) continue;
    for (const entry of parse(readFileSync(CATALOG_DIR(locale) + other, 'utf8'))?.entries ?? [])
      if (typeof entry[locale] === 'string' && entry[locale].length > 0)
        known.set(entry.en, entry[locale]);
  }
  const out = {};
  entries.forEach((entry, index) => {
    const ko = entry.get(locale);
    if ((typeof ko !== 'string' || ko.length === 0) && known.has(entry.get('en')))
      out[index] = known.get(entry.get('en'));
  });
  console.log(JSON.stringify(out, null, 1));
} else if (command === 'dump') {
  const out = {};
  entries.forEach((entry, index) => {
    const ko = entry.get(locale);
    if (all || typeof ko !== 'string' || ko.length === 0) out[index] = entry.get('en');
  });
  console.log(JSON.stringify(out, null, 1));
} else if (command === 'apply') {
  const translations = JSON.parse(readFileSync(arg3, 'utf8'));
  let applied = 0;
  for (const [key, value] of Object.entries(translations)) {
    const entry = entries[Number(key)];
    if (entry === undefined || typeof value !== 'string' || value.length === 0) {
      console.error(`skipped ${key}: no such entry or empty translation`);
      continue;
    }
    entry.set(locale, value);
    applied += 1;
  }
  // Multi-line text is written as a literal block: a folded plain scalar can
  // turn a line ending in ':' into an unparseable mapping.
  visit(doc, {
    Scalar(_, node) {
      if (isScalar(node) && typeof node.value === 'string' && node.value.includes('\n'))
        node.type = 'BLOCK_LITERAL';
    },
  });
  const header = source.slice(0, source.indexOf('entries:'));
  writeFileSync(
    file,
    header +
      doc
        .toString({ lineWidth: 0, blockQuote: 'literal' })
        .slice(doc.toString({ lineWidth: 0, blockQuote: 'literal' }).indexOf('entries:')),
    'utf8',
  );
  const remaining = entries.filter((e) => {
    const ko = e.get(locale);
    return typeof ko !== 'string' || ko.length === 0;
  }).length;
  console.log(`${file}: applied ${applied}; ${remaining} of ${entries.length} still untranslated`);
} else {
  console.error('usage: catalog-tool.mjs dump|known|apply <group> ...');
  process.exitCode = 2;
}

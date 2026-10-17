// Campaign 1.2 lore consistency. A verified record (RECORD_<KEY>) is written once,
// in the earliest Incident that holds it, and every later Incident that re-hosts it
// for catch-up reading quotes that canonical text verbatim.
// Usage: node scripts/authoring/sync-lore.mjs [--check]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const DIR = 'src/scenario/data/full-campaign/incidents/';
const VERSION_SUFFIX = '-1.2.0.yaml';

const find = (doc, list, id) => {
  const items = doc.getIn(list.split('.'));
  return items?.items.find((n) => n.get('id') === id);
};

export function syncLore({ write = false } = {}) {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(VERSION_SUFFIX))
    .sort();
  const docs = files.map((f) => ({
    file: DIR + f,
    doc: parseDocument(readFileSync(DIR + f, 'utf8')),
  }));
  const canonical = new Map();
  for (const { doc } of docs)
    for (const e of doc.getIn(['evidence']).items) {
      const id = e.get('id');
      if (!id.startsWith('RECORD_') || canonical.has(id)) continue;
      const key = id.slice('RECORD_'.length);
      canonical.set(id, {
        signal: find(doc, 'initialState.signals', id)?.get('value') ?? e.get('description'),
        title: e.get('title'),
        description: e.get('description'),
        report: find(doc, 'warRoom.messages', 'REPORT_' + key)?.get('text'),
        action:
          find(doc, 'actions', 'REINVESTIGATE_' + key)?.get('title') ??
          'Archive: ' + e.get('title'),
      });
    }
  const changed = [];
  for (const { file, doc } of docs) {
    let dirty = false;
    const set = (node, key, value) => {
      if (node && value !== undefined && node.get(key) !== value) {
        node.set(key, value);
        dirty = true;
      }
    };
    for (const e of doc.getIn(['evidence']).items) {
      const id = e.get('id');
      const c = canonical.get(id);
      if (!c) continue;
      const key = id.slice('RECORD_'.length);
      const reinvestigate = find(doc, 'actions', 'REINVESTIGATE_' + key);
      if (!reinvestigate) continue; // the original discovery keeps its own staging
      set(e, 'title', c.title);
      set(e, 'description', c.description);
      set(find(doc, 'initialState.signals', id), 'value', c.signal);
      set(find(doc, 'warRoom.messages', 'REPORT_' + key), 'text', c.report);
      set(reinvestigate, 'title', c.action);
      const narrative = find(doc, 'narratives', 'DISCOVERY_' + key);
      const trigger = narrative
        ?.get('conditions')
        ?.items.find((x) => x.get('type') === 'action_completed')
        ?.get('actionId');
      if (trigger === 'REINVESTIGATE_' + key) {
        set(narrative, 'title', c.title);
        set(narrative, 'body', c.description);
      }
    }
    if (dirty) {
      changed.push(file);
      if (write) writeFileSync(file, doc.toString({ lineWidth: 100 }), 'utf8');
    }
  }
  return { canonical: canonical.size, changed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { canonical, changed } = syncLore({ write: !check });
  console.log(
    `${canonical} canonical records; ${changed.length} Incident files ${check ? 'out of sync' : 'updated'}`,
  );
  for (const f of changed) console.log('  ' + f);
  if (check && changed.length) process.exitCode = 1;
}

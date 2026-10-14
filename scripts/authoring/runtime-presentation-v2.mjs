// DEC-068 deterministic additive authoring. Never overwrite an old authority.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { resolve } from 'node:path';

export function authorRuntimePresentationV2(read) {
  const root = 'src/scenario/data/full-campaign/';
  const definition = structuredClone(read(root + 'definitions/campaign.yaml'));
  definition.version = '1.1.0';
  for (const ref of definition.references) ref.version = '1.1.0';
  for (const branch of definition.branches) branch.version = '1.1.0';
  const prose = structuredClone(read(root + 'ending-presentations/endings.yaml'));
  prose.version = '1.1.0';
  prose.definitionVersion = '1.1.0';
  for (const ref of prose.references) ref.version = '1.1.0';
  const pkg = structuredClone(read(root + 'packages/campaign.yaml'));
  pkg.version = '1.1.0';
  pkg.definitionVersion = '1.1.0';
  pkg.endingPresentation.version = '1.1.0';
  for (const view of pkg.presentations) view.version = '1.1.0';
  const files = {
    [root + 'definitions/campaign-1.1.0.yaml']: definition,
    [root + 'packages/campaign-1.1.0.yaml']: pkg,
    [root + 'ending-presentations/endings-1.1.0.yaml']: prose,
  };
  for (let i = 1; i <= 26; i++) {
    const name = 'inc-' + String(i).padStart(3, '0');
    const scenario = read(root + 'incidents/' + name + '.yaml');
    const view = structuredClone(read(root + 'presentations/' + name + '.yaml'));
    view.schemaVersion = 2;
    view.version = '1.1.0';
    if (i === 26) {
      for (const [id, title, kind] of [
        ['runtime-narratives', 'Recorded runtime narratives', 'logs'],
        ['runtime-war-room', 'War Room event history', 'war_room'],
      ])
        view.panels.push({
          id,
          title,
          kind,
          actionIds: [],
          blocks: [],
          reveal: [{ type: 'resource', resourceId: 'CUSTOMER_IMPACT', operator: 'gte', value: 0 }],
          campaignReveal: {
            type: 'compare',
            reference: 'CURRENT_ACT',
            operator: 'gte',
            expected: 9,
          },
        });
    }
    const logs = view.panels.find(
      (p) => p.id === (i <= 3 ? 'observations' : i === 26 ? 'runtime-narratives' : 'logs'),
    );
    const team = view.panels.find((p) => p.id === (i === 26 ? 'runtime-war-room' : 'team'));
    if (!logs || !team) throw new Error('MISSING_APPROVED_STREAM_PANEL:' + scenario.id);
    logs.blocks.push({
      kind: 'narrative_stream',
      id: 'INCIDENT_NARRATIVE_HISTORY',
      entries: scenario.narratives.map((n) => ({
        narrativeId: n.id,
        delivery: {
          ...(i === 1 && n.id === 'UNKNOWN_GOOD'
            ? { mode: 'transient', durationMs: 800 }
            : { mode: 'until_dismissed' }),
          reducedMotionMode: 'until_dismissed',
          historyMode: 'recorded',
        },
      })),
    });
    team.blocks = team.blocks.filter(
      (b) =>
        !(
          b.kind === 'paragraph' &&
          scenario.warRoom.messages.some((m) => m.initial && m.id === b.id && m.text === b.text)
        ),
    );
    const delegated = scenario.actions.filter((a) => a.delegation);
    team.blocks.push({
      kind: 'war_room_stream',
      id: 'INCIDENT_WAR_ROOM',
      messageIds: scenario.warRoom.messages.map((m) => m.id),
      delegationActionIds: delegated.map((a) => a.id),
      capacityResourceIds: [...new Set(delegated.map((a) => a.delegation.capacityResourceId))],
    });
    files[root + 'presentations/' + name + '-1.1.0.yaml'] = view;
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--write-new') throw new Error('EXPLICIT_NEW_AUTHORING_REQUIRED');
  const files = authorRuntimePresentationV2((p) => parse(readFileSync(p, 'utf8')));
  if (Object.keys(files).some(existsSync)) throw new Error('EXISTING_AUTHORITY_PRESERVED');
  for (const [file, value] of Object.entries(files))
    writeFileSync(file, stringify(value), { encoding: 'utf8', flag: 'wx' });
  console.log('Authored ' + Object.keys(files).length + ' new authorities; old files untouched.');
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getLegacyScenarioForMigration } from './legacy-catalog.ts';
import { getScenario } from './bundled-catalog.ts';

// Git blob identities from the shipped 1.0.0 content. Do not update these
// when changing current scenarios: old saves require the exact old rules.
const snapshots = [
  ['INC-001', 'inc-001.v1.0.0.yaml', 'd02d23b73e98209fa34e0b5cf05022357c5f7e8e'],
  ['INC-002', 'inc-002.v1.0.0.yaml', 'c8ab78f5da412dbd498624012f79d4e5e23a8b99'],
  ['INC-003', 'inc-003.v1.0.0.yaml', '85bc1329afce60b2571d3f9134468142660fddda'],
] as const;

describe('frozen 1.0.0 replay authorities', () => {
  it.each(snapshots)('preserves exact shipped %s bytes', (id, file, expectedHash) => {
    const bytes = Buffer.from(
      readFileSync(path.resolve('src/scenario/legacy', file), 'utf8').replace(/\r\n/g, '\n'),
      'utf8',
    );
    const actualHash = createHash('sha1')
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest('hex');
    expect(actualHash).toBe(expectedHash);
    expect(getLegacyScenarioForMigration(id, '1.0.0', '1.1.0')).toMatchObject({
      id,
      contentVersion: '1.0.0',
    });
  });

  it.each(snapshots)('keeps all 1.0.0 %s action rules unchanged in 1.1.0', (id) => {
    const legacy = getLegacyScenarioForMigration(id, '1.0.0', '1.1.0');
    const current = getScenario(id);
    if (legacy === undefined || current === undefined) throw new Error(`Missing ${id} versions`);
    expect(current.contentVersion).toBe('1.1.0');
    expect(current.initialState).toEqual(legacy.initialState);
    expect(current.services).toEqual(legacy.services);
    expect(current.incident).toEqual(legacy.incident);
    expect(current.resolution).toEqual(legacy.resolution);
    expect(current.completion).toEqual(legacy.completion);
    expect(current.narratives).toEqual(legacy.narratives);
    expect(current.evidence).toEqual(legacy.evidence);
    expect(current.postmortem).toEqual(legacy.postmortem);
    for (const oldAction of legacy.actions) {
      expect(current.actions.find(({ id: actionId }) => actionId === oldAction.id)).toEqual(
        oldAction,
      );
    }
    for (const oldEvent of legacy.events) {
      expect(current.events.find(({ id: eventId }) => eventId === oldEvent.id)).toEqual(oldEvent);
    }
  });

  it('does not silently apply a 1.0.0 snapshot to unapproved target versions', () => {
    expect(getLegacyScenarioForMigration('INC-001', '1.0.0', '2.0.0')).toBeUndefined();
    expect(getLegacyScenarioForMigration('INC-001', '0.9.0', '1.1.0')).toBeUndefined();
  });
});

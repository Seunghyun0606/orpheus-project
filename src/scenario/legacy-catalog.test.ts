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
    const version11 =
      id === 'INC-001' ? getScenario(id) : getLegacyScenarioForMigration(id, '1.1.0', '1.2.0');
    if (legacy === undefined || version11 === undefined) throw new Error(`Missing ${id} versions`);
    expect(version11.contentVersion).toBe('1.1.0');
    expect(version11.initialState).toEqual(legacy.initialState);
    expect(version11.services).toEqual(legacy.services);
    expect(version11.incident).toEqual(legacy.incident);
    expect(version11.resolution).toEqual(legacy.resolution);
    expect(version11.completion).toEqual(legacy.completion);
    expect(version11.narratives).toEqual(legacy.narratives);
    expect(version11.evidence).toEqual(legacy.evidence);
    expect(version11.postmortem).toEqual(legacy.postmortem);
    for (const oldAction of legacy.actions) {
      expect(version11.actions.find(({ id: actionId }) => actionId === oldAction.id)).toEqual(
        oldAction,
      );
    }
    for (const oldEvent of legacy.events) {
      expect(version11.events.find(({ id: eventId }) => eventId === oldEvent.id)).toEqual(oldEvent);
    }
  });

  it.each([
    ['INC-002', 'inc-002.v1.1.0.yaml', 'e15777aa75e7d0d77242f8ec5e4504589d03359a'],
    ['INC-003', 'inc-003.v1.1.0.yaml', '64ee8497846694789c1fc6eba0ed4a0164beeb6c'],
  ] as const)('preserves exact shipped %s 1.1.0 bytes', (id, file, expectedHash) => {
    const bytes = Buffer.from(
      readFileSync(path.resolve('src/scenario/legacy', file), 'utf8').replace(/\r\n/g, '\n'),
      'utf8',
    );
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    expect(hash).toBe(expectedHash);
    expect(getLegacyScenarioForMigration(id, '1.1.0', '1.2.0')?.contentVersion).toBe('1.1.0');
  });

  it('does not silently apply a 1.0.0 snapshot to unapproved target versions', () => {
    expect(getLegacyScenarioForMigration('INC-001', '1.0.0', '2.0.0')).toBeUndefined();
    expect(getLegacyScenarioForMigration('INC-001', '0.9.0', '1.1.0')).toBeUndefined();
  });
});

import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { replayCommands } from '../engine/index.ts';
import { validateScenarioCatalog } from './catalog.ts';
import { getScenario, scenarioCatalog } from './bundled-catalog.ts';
import { diagnosticCodes } from './validator.ts';

const fixture = (name: string) => path.resolve('src/scenario/__fixtures__', name);
const source = (name: string) => readFileSync(fixture(name), 'utf8');

describe('scenario catalog', () => {
  it('loads a second fixture through the same validated path as INC-001', () => {
    const result = validateScenarioCatalog([
      { file: 'first.yaml', source: source('valid-inc-001-shape.yaml') },
      { file: 'second.yaml', source: source('valid-second-incident.yaml') },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid catalog.');
    expect([...result.scenarios.keys()]).toEqual(['INC-001-TEST', 'INC-002-FIXTURE']);
    expect(result.scenarios.get('INC-002-FIXTURE')?.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'CONTAIN_TEST_CAUSE' })]),
    );
    expect(getScenario('INC-001')).toBe(scenarioCatalog.get('INC-001'));

    const second = result.scenarios.get('INC-002-FIXTURE');
    if (second === undefined) throw new Error('Expected second incident fixture.');
    const commands = [
      { type: 'perform_action', actionId: 'INSPECT_TEST_API' },
      { type: 'perform_action', actionId: 'CONTAIN_TEST_CAUSE' },
    ] as const;
    const firstReplay = replayCommands(second, { seed: 29 }, commands);
    const secondReplay = replayCommands(second, { seed: 29 }, commands);
    expect(firstReplay.ok).toBe(true);
    expect(secondReplay).toEqual(firstReplay);
    if (firstReplay.ok) expect(firstReplay.state.completionReached).toBe(true);
  });

  it('aggregates duplicate scenario ids and invalid references across files', () => {
    const result = validateScenarioCatalog([
      { file: 'a-first.yaml', source: source('valid-second-incident.yaml') },
      { file: 'b-duplicate.yaml', source: source('valid-second-incident.yaml') },
      { file: 'broken.yaml', source: source('invalid-references.yaml') },
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid catalog.');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'b-duplicate.yaml',
          path: '$.id',
          code: diagnosticCodes.duplicateId,
        }),
        expect.objectContaining({
          file: 'broken.yaml',
          code: diagnosticCodes.unknownReference,
        }),
      ]),
    );
    expect('scenarios' in result).toBe(false);
  });

  it('reports a duplicate id even when that same file has invalid references', () => {
    const invalidDuplicate = source('invalid-references.yaml').replace(
      'id: INVALID-REFERENCES',
      'id: INC-002-FIXTURE',
    );
    const result = validateScenarioCatalog([
      { file: 'a-valid.yaml', source: source('valid-second-incident.yaml') },
      { file: 'b-invalid-duplicate.yaml', source: invalidDuplicate },
    ]);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid catalog.');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'b-invalid-duplicate.yaml',
          path: '$.id',
          code: diagnosticCodes.duplicateId,
        }),
        expect.objectContaining({
          file: 'b-invalid-duplicate.yaml',
          code: diagnosticCodes.unknownReference,
        }),
      ]),
    );
  });

  it('rejects an empty catalog and a CLI directory with no scenarios', () => {
    const result = validateScenarioCatalog([]);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected empty catalog to fail.');
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: diagnosticCodes.emptyCatalog }),
    ]);

    const directory = mkdtempSync(path.join(tmpdir(), 'orpheus-empty-catalog-'));
    try {
      const command = spawnSync(process.execPath, ['scripts/validate-scenarios.mjs', directory], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(command.status).toBe(1);
      expect(command.stderr).toContain('[EMPTY_CATALOG]');
    } finally {
      rmdirSync(directory);
    }
  });

  it('fails the CLI when two otherwise valid scenario files have the same id', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'orpheus-catalog-'));
    const first = path.join(directory, 'a-first.yaml');
    const duplicate = path.join(directory, 'b-duplicate.yaml');
    try {
      writeFileSync(first, source('valid-second-incident.yaml'), 'utf8');
      writeFileSync(duplicate, source('valid-second-incident.yaml'), 'utf8');
      const result = spawnSync(process.execPath, ['scripts/validate-scenarios.mjs', directory], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[DUPLICATE_ID]');
      expect(result.stderr).toContain('$.id');
    } finally {
      unlinkSync(first);
      unlinkSync(duplicate);
      rmdirSync(directory);
    }
  });
});

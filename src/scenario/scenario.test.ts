import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { diagnosticCodes, parseScenarioYaml } from './index.ts';

const fixture = (name: string) => path.resolve('src/scenario/__fixtures__', name);
const readFixture = (name: string) => readFileSync(fixture(name), 'utf8');

describe('scenario contract', () => {
  it('parses a versioned INC-001-shaped scenario into validated engine input', () => {
    const result = parseScenarioYaml(
      readFixture('valid-inc-001-shape.yaml'),
      'valid-inc-001-shape.yaml',
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid scenario fixture.');

    expect(result.scenario.schemaVersion).toBe(1);
    expect(result.scenario.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'RESTART_API', temporaryEffects: expect.any(Array) }),
        expect.objectContaining({ id: 'TERMINATE_STALE_SESSIONS' }),
      ]),
    );
    expect(result.scenario.events[0]).toMatchObject({
      id: 'CONNECTION_REBOUND',
      type: 'timer',
      delaySeconds: 180,
    });
    expect(result.scenario.evidence[0]?.id).toBe('CORRUPTED_LOG_ENTRY');
    expect(result.scenario.completion.conditions).toHaveLength(1);
  });

  it('returns only diagnostics when unvalidated input fails', () => {
    const result = parseScenarioYaml('schemaVersion: 99\nid: BROKEN', 'broken.yaml');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid scenario input.');
    expect('scenario' in result).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(1);
    expect(result.diagnostics.every(({ file }) => file === 'broken.yaml')).toBe(true);
  });

  it('aggregates duplicate ids and every invalid reference', () => {
    const result = parseScenarioYaml(
      readFixture('invalid-references.yaml'),
      'invalid-references.yaml',
    );

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid reference fixture.');

    expect(result.diagnostics.length).toBeGreaterThanOrEqual(15);
    expect(result.diagnostics.map(({ code }) => code)).toContain(diagnosticCodes.duplicateId);
    expect(result.diagnostics.map(({ code }) => code)).toContain(diagnosticCodes.unknownReference);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '$.services[0].dependsOn[0]' }),
        expect.objectContaining({ path: '$.actions[0].requirements[0].evidenceId' }),
        expect.objectContaining({ path: '$.events[0].targetServiceId' }),
        expect.objectContaining({ path: '$.postmortem.scoringInputs[0].refId' }),
      ]),
    );
    expect(
      result.diagnostics.every(({ file, path, code, message }) => file && path && code && message),
    ).toBe(true);
  });

  it('reports unknown effect and event discriminators instead of ignoring them', () => {
    const result = parseScenarioYaml(readFixture('unknown-types.yaml'), 'unknown-types.yaml');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected unknown discriminator fixture.');

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: diagnosticCodes.unknownEffectType }),
        expect.objectContaining({ code: diagnosticCodes.unknownEventType }),
      ]),
    );
  });

  it('reports YAML syntax failures with a stable diagnostic', () => {
    const result = parseScenarioYaml('actions: [', 'syntax.yaml');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected YAML parse failure.');
    expect(result.diagnostics[0]).toMatchObject({
      file: 'syntax.yaml',
      path: '$',
      code: diagnosticCodes.yamlParse,
    });
  });
});

describe('scenario validation command', () => {
  const run = (fixtureName: string) =>
    spawnSync(process.execPath, ['scripts/validate-scenarios.mjs', fixture(fixtureName)], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

  it('exits zero for valid scenario content', () => {
    const result = run('valid-inc-001-shape.yaml');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Scenario validation passed: 1 file(s).');
  });

  it('exits non-zero and prints aggregate diagnostics for invalid content', () => {
    const result = run('invalid-references.yaml');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[DUPLICATE_ID]');
    expect(result.stderr).toContain('[UNKNOWN_REFERENCE]');
    expect(result.stderr).toContain('Scenario validation failed');
  });
});

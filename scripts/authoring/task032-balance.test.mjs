// @vitest-environment node
// Deferred authoring reproducibility checks, not full-run/native acceptance.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { authorTask032Balance } from './task032-balance.mjs';

const read = (file) => parse(readFileSync('.project-os/planning/' + file, 'utf8'));
describe('DEC-057 offline authoring reproducibility', () => {
  it('reconstructs the exact committed numeric and ending artifacts without mutating sources', () => {
    const generated = authorTask032Balance(read);
    expect(generated.bindings).toEqual(read('TASK-032.numeric-bindings.yaml'));
    expect(generated.endings).toEqual(read('M5/models/orpheus-full-campaign-endings.yaml'));
    expect(authorTask032Balance(read)).toEqual(generated);
  });
});

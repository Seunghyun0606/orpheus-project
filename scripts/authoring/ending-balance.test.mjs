// @vitest-environment node
// Deferred authoring reproducibility checks, not full-run/native acceptance.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { authorEndingBalance } from './ending-balance.mjs';

const read = (file) => parse(readFileSync('authoring/campaign-1.0/' + file, 'utf8'));
describe('DEC-057 offline authoring reproducibility', () => {
  it('reconstructs the exact committed numeric and ending artifacts without mutating sources', () => {
    const generated = authorEndingBalance(read);
    expect(generated.bindings).toEqual(read('TASK-032.numeric-bindings.yaml'));
    expect(generated.endings).toEqual(read('models/orpheus-full-campaign-endings.yaml'));
    expect(authorEndingBalance(read)).toEqual(generated);
  });
});

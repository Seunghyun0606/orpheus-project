// @vitest-environment node
// Deferred source reproducibility check, not full-campaign/native acceptance.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { authorEndingPresentations } from './ending-presentations.mjs';

describe('DEC-058 exact source-based ending prose', () => {
  it('reconstructs the authored sidecar from the approved draft and proposal', () => {
    const read = (path) => parse(readFileSync(path, 'utf8'));
    const generated = authorEndingPresentations(
      read('authoring/campaign-1.0/TASK-032.ending-narrative-draft.yaml'),
      read('authoring/campaign-1.0/TASK-032.ending-presentation-proposal.yaml'),
    );
    expect(generated).toEqual(
      read('src/scenario/data/full-campaign/ending-presentations/endings.yaml'),
    );
  });
});

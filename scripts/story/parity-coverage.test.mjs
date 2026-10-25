import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEpisode } from '../../src/story/schema.ts';
import { emptyCarry } from '../../src/story/runner.ts';
import { enumeratePaths } from '../../src/story/validate.ts';
import {
  representativePaths,
  threeWayCarries,
  thresholdRuns,
  tripleKeys,
} from './parity-coverage.mjs';

const episode = parseEpisode(`
schemaVersion: 1
id: INC-099
act: 9
title: Boundary fixture generator test
start: call
cast: [{id: TEST, name: Test}]
evidence: [{id: TEST, title: Test, body: Test, kind: operational}]
scenes:
  - id: call
    type: briefing
    effects: {values: {teamTrust: 4}, alignment: {corporate: 2}}
    next: decide
  - id: decide
    type: choice
    prompt: Test
    beats:
      - log: bounded
        when: {values: {teamTrust: {gte: 10, lte: 12}}}
      - log: compound
        when: {values: {teamTrust: {gte: 10}}, alignment: {corporate: {gte: 5}}}
      - log: flag-a
        when: {flags: {A: true}}
      - log: flag-b
        when: {flags: {B: false}}
      - log: flag-c
        when: {flags: {C: true}}
      - log: flag-d
        when: {flags: {D: false}}
    options:
      - id: FIRST
        text: First
        beats:
          - log: before-effects
            when: {alignment: {corporate: {lte: 5}}}
        effects: {alignment: {corporate: 100}}
        next: tail
      - id: SECOND
        text: Second
        next: tail
  - id: tail
    type: briefing
    beats:
      - log: second-only
        when: {notChose: [decide.FIRST], values: {teamTrust: {gte: 10}}}
    next: END
`);

test('boundaries account for earlier effects, compound bounds and nonnumeric gates', () => {
  const result = thresholdRuns(episode, [
    { carry: emptyCarry, paths: enumeratePaths(episode).paths },
  ]);
  assert.equal(result.runs.length, 18);
  assert.equal(result.coverage.length, 18);
  assert.ok(result.coverage.some((entry) => entry.holds));
  assert.ok(result.coverage.some((entry) => !entry.holds));
  assert.ok(result.coverage.every((entry) => !entry.previouslyCovered));
  const run =
    result.runs[result.coverage.findIndex((entry) => entry.label.endsWith('corporate.lte=5@5'))];
  assert.equal(run.carry.alignment.corporate, 3);
  assert.equal(run.paths[0].state.alignment.corporate, 105);
  assert.ok(run.paths[0].state.feed.some((entry) => entry.text === 'before-effects'));
  const tail =
    result.runs[
      result.coverage.findIndex((entry) => entry.label.includes('/tail/') && entry.holds)
    ];
  assert.equal(tail.paths[0].state.choices.decide, 'SECOND');
  assert.ok(tail.paths[0].state.feed.some((entry) => entry.text === 'second-only'));
});

test('three-way carries cover every assignment of every flag triple deterministically', () => {
  const flags = Array.from({ length: 13 }, (_, index) => `FLAG_${index}`);
  const many = structuredClone(episode);
  many.scenes[1].beats = flags.map((flag) => ({ log: flag, when: { flags: { [flag]: true } } }));
  const carries = threeWayCarries(many);
  assert.deepEqual(carries, threeWayCarries(many));
  assert.ok(carries.length < 64);
  assert.equal(new Set(carries.flatMap((carry) => tripleKeys(flags, carry))).size, 286 * 8);
});

test('representative paths retain every feed entry, including gated dialogue', () => {
  const carry = threeWayCarries(episode)[0];
  const keys = (paths) =>
    new Set(paths.flatMap((path) => path.state.feed.map((entry) => JSON.stringify(entry))));
  assert.deepEqual(
    keys(representativePaths(episode, carry)),
    keys(enumeratePaths(episode, carry).paths),
  );
});

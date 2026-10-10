import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  evaluateCampaignCondition,
  type Condition,
  type ConditionContext,
  type Observation,
  type Reference,
} from '../engine/campaign/conditions.ts';

const refs: Reference[] = ['a', 'b'].map((id) => ({
  id,
  version: 'test-only-v1',
  valueType: 'boolean',
  source: 'narrative_flag',
  key: id,
  contexts: ['progression', 'effect', 'branch', 'ending'],
}));
const compare = (reference: string): Condition => ({
  type: 'compare',
  reference,
  operator: 'eq',
  expected: true,
});
function context(a: Observation, b: Observation): ConditionContext {
  return {
    definitionVersion: 'test-only-v1',
    runId: 'run',
    boundary: 0,
    kind: 'branch',
    observations: { a, b },
  };
}
const known = (value: boolean): Observation => ({ status: 'available', value });
const unavailable: Observation = { status: 'unavailable', reason: 'No eligible samples' };

describe('strict campaign conditions', () => {
  for (const a of [true, false, null])
    for (const b of [true, false, null]) {
      for (const type of ['all', 'any'] as const)
        it(`${type}(${a},${b}) requires every reference`, () => {
          const result = evaluateCampaignCondition(
            { type, children: [compare('a'), compare('b')] },
            refs,
            context(a === null ? unavailable : known(a), b === null ? unavailable : known(b)),
          );
          if (a === null || b === null) expect(result.ok).toBe(false);
          else expect(result).toEqual({ ok: true, value: type === 'all' ? a && b : a || b });
        });
    }
  for (const value of [true, false, null])
    it(`NOT(${value})`, () => {
      const result = evaluateCampaignCondition(
        { type: 'not', child: compare('a') },
        refs,
        context(value === null ? unavailable : known(value), known(false)),
      );
      expect(result).toEqual(
        value === null
          ? { ok: false, diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: 'a' }] }
          : { ok: true, value: !value },
      );
    });
  it('checks nondecisive nested operands and canonical diagnostic order', () => {
    const inner: Condition = { type: 'any', children: [compare('a'), compare('b')] };
    const children: Condition[] = [compare('a'), inner];
    for (const ordered of [children, [...children].reverse()])
      expect(
        evaluateCampaignCondition(
          { type: 'all', children: ordered },
          refs,
          context(known(false), unavailable),
        ),
      ).toEqual({ ok: false, diagnostics: [{ code: 'UNAVAILABLE_OBSERVATION', path: 'b' }] });
  });
  it('known false and zero are available; absent context is not false', () => {
    const numeric: Reference[] = [{ ...refs[0]!, valueType: 'number', source: 'metric' }];
    const input = { type: 'compare', reference: 'a', operator: 'eq', expected: 0 };
    expect(
      evaluateCampaignCondition(input, numeric, {
        ...context(known(false), known(false)),
        observations: { a: { status: 'available', value: 0 } },
      }),
    ).toEqual({ ok: true, value: true });
    expect(
      evaluateCampaignCondition(input, numeric, {
        ...context(known(false), known(false)),
        observations: {},
      }).ok,
    ).toBe(false);
  });
  it.each([
    { type: 'all', children: [] },
    { type: 'any', children: [] },
    { type: 'not', children: [compare('a')] },
    { type: 'not', child: compare('a'), extra: true },
    { type: 'compare', reference: 'missing', operator: 'eq', expected: false },
    { type: 'compare', reference: 'a', operator: 'gte', expected: true },
    { type: 'compare', reference: 'a', operator: 'eq', expected: 'true' },
    { type: 'compare', reference: 'a', operator: 'eq', expected: Number.NaN },
  ])('rejects malformed/unregistered conditions %j', (input) => {
    expect(evaluateCampaignCondition(input, refs, context(known(false), known(true))).ok).toBe(
      false,
    );
  });
  it('unsupported version and malformed unavailable context diagnose, even with a decisive sibling', () => {
    expect(
      evaluateCampaignCondition(compare('a'), refs, {
        ...context(known(false), known(true)),
        definitionVersion: 'unknown',
      }).ok,
    ).toBe(false);
    const bad = {
      ...context(unavailable, known(true)),
      observations: { a: { status: 'unavailable' as const, reason: '' } },
    };
    expect(evaluateCampaignCondition(compare('a'), refs, bad).ok).toBe(false);
  });
  it('repeated evaluation cannot mutate context or create observations', () => {
    const data = context(known(false), known(true));
    const before = canonicalJson(data);
    expect(evaluateCampaignCondition(compare('a'), refs, data)).toEqual(
      evaluateCampaignCondition(compare('a'), refs, data),
    );
    expect(canonicalJson(data)).toBe(before);
  });
});

describe('canonical identity, not authentication', () => {
  it('rejects property accessors before executing them', () => {
    let reads = 0;
    const object = Object.defineProperty({}, 'value', {
      enumerable: true,
      get: () => {
        reads++;
        return 1;
      },
    });
    const array = Object.defineProperty([1], '0', {
      enumerable: true,
      get: () => {
        reads++;
        return 1;
      },
    });
    expect(() => canonicalJson(object)).toThrow();
    expect(() => canonicalJson(array)).toThrow();
    expect(reads).toBe(0);
  });
  it('sorts keys ordinally, keeps arrays and Unicode strings unchanged', () => {
    expect(canonicalJson({ z: 1, A: 2, a: 3 })).toBe('{"A":2,"a":3,"z":1}');
    expect(canonicalJson({ b: 2, a: [1, 2] })).toBe(canonicalJson({ a: [1, 2], b: 2 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    expect(canonicalJson('\u00e9')).not.toBe(canonicalJson('e\u0301'));
  });
  it.each([
    undefined,
    Number.NaN,
    Infinity,
    () => true,
    new Date(0),
    { a: undefined },
    new Array(1),
  ])('rejects unsupported payload instead of coercing %j', (input) => {
    expect(() => canonicalJson(input)).toThrow();
  });
});

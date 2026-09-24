import type { SeededRng, SeededRngState } from './types.ts';

const UINT32_RANGE = 0x1_0000_0000;

function normalizeUint32(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('RNG seed and state must be finite numbers.');
  }
  return Math.trunc(value) >>> 0;
}

export function createSeededRngState(seed: number): SeededRngState {
  const normalized = normalizeUint32(seed);
  return { seed: normalized, state: normalized, draws: 0 };
}

/** Mulberry32: a compact deterministic generator with explicit serializable state. */
export const seededRng: SeededRng = {
  next(current) {
    const state = (normalizeUint32(current.state) + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    value = ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;

    return {
      state: { seed: current.seed, state, draws: current.draws + 1 },
      value,
    };
  },
};

export function drawRandom(
  state: SeededRngState,
  rng: SeededRng = seededRng,
): { readonly state: SeededRngState; readonly value: number } {
  return rng.next(state);
}

import type { SimulationClock } from './types.ts';

export const actionDrivenClock: SimulationClock = {
  advance(currentSeconds, durationSeconds) {
    if (!Number.isSafeInteger(currentSeconds) || currentSeconds < 0) {
      throw new RangeError('Current simulation time must be a non-negative safe integer.');
    }
    if (!Number.isSafeInteger(durationSeconds) || durationSeconds < 0) {
      throw new RangeError('Duration must be a non-negative safe integer.');
    }

    const result = currentSeconds + durationSeconds;
    if (!Number.isSafeInteger(result)) {
      throw new RangeError('Simulation time exceeded the safe integer range.');
    }
    return result;
  },
};

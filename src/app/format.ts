import type { ScalarValue } from '../engine/index.ts';

// Shared presentation formatting. Authored labels/units always win; the ID
// heuristics below are only a fallback for content written before `label`/`unit`.

export interface SignalPresentation {
  readonly id: string;
  readonly label?: string;
  readonly unit?: string;
}

export type SignalDirectory = ReadonlyMap<string, SignalPresentation>;

export function signalDirectory(
  signals: readonly SignalPresentation[] | undefined,
): SignalDirectory {
  return new Map((signals ?? []).map((signal) => [signal.id, signal]));
}

export function humanize(id: string): string {
  return id
    .toLowerCase()
    .split(/[_-]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function signalLabel(id: string, directory?: SignalDirectory): string {
  return directory?.get(id)?.label ?? humanize(id);
}

function legacyUnit(id: string): string | undefined {
  return id.includes('RATE') || id.endsWith('_CPU') ? '%' : undefined;
}

export function formatScalar(value: ScalarValue, unit?: string): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value !== 'number') return value;
  const number = value.toLocaleString('en-US');
  if (unit === undefined) return number;
  return unit === '%' ? `${number}%` : `${number} ${unit}`;
}

export function formatSignalValue(
  id: string,
  value: ScalarValue,
  directory?: SignalDirectory,
): string {
  return formatScalar(value, directory?.get(id)?.unit ?? legacyUnit(id));
}

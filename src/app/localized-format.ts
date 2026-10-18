import type { ScalarValue } from '../engine/index.ts';
import type { Locale } from '../i18n/locale.ts';
import { formatSignalValue, signalLabel, type SignalDirectory } from './format.ts';

// The parts of useI18n() that non-React helpers need. English is the identity.
export interface ContentTranslator {
  readonly locale: Locale;
  readonly ct: (text: string) => string;
}

export const englishContent: ContentTranslator = { locale: 'en', ct: (text) => text };

export interface LocalizedSignals {
  readonly label: (id: string) => string;
  readonly value: (id: string, value: ScalarValue) => string;
}

// Signal labels, string values and units are authored content; numbers follow
// the display locale. With English this is exactly signalLabel/formatSignalValue.
export function localizedSignals(
  directory: SignalDirectory,
  { ct, locale }: ContentTranslator,
): LocalizedSignals {
  const translatedUnits: SignalDirectory = new Map(
    [...directory].map(([id, signal]) => [
      id,
      signal.unit === undefined ? signal : { ...signal, unit: ct(signal.unit) },
    ]),
  );
  return {
    label: (id) => ct(signalLabel(id, directory)),
    value: (id, value) =>
      typeof value === 'string' ? ct(value) : formatSignalValue(id, value, translatedUnits, locale),
  };
}

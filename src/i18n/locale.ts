// Display language (DEC-071). Localization is presentation-only: authored
// content bytes, replay identity and saved records never depend on it.

export type Locale = 'en' | 'ko';

export const supportedLocales: readonly Locale[] = ['ko', 'en'];

export const localeNames: Readonly<Record<Locale, string>> = {
  ko: '한국어',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ko';
}

// First run follows the system language; anything other than Korean is English.
export function detectLocale(
  languages: readonly string[] | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.languages,
): Locale {
  return languages?.[0]?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

// UI copy is written once per language in the module that renders it. Both
// languages must define the same keys, so a missing translation fails typecheck.
export interface MessageCatalog<T> {
  readonly en: T;
  readonly ko: T;
}

export function defineMessages<T extends object>(catalog: MessageCatalog<T>): MessageCatalog<T> {
  return catalog;
}

export function numberLocale(locale: Locale): string {
  return locale === 'ko' ? 'ko-KR' : 'en-US';
}

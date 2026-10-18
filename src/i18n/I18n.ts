import { createContext, useContext, useMemo } from 'react';

import { PresentationContext } from '../app/presentation-settings.ts';
import { translateContent, type ContentDictionary } from './content.ts';
import { numberLocale, type Locale, type MessageCatalog } from './locale.ts';

// Supplied by the root PresentationProvider once the active language's content
// dictionary has loaded; undefined means authored English.
export const ContentDictionaryContext = createContext<ContentDictionary | undefined>(undefined);

export interface I18n {
  readonly locale: Locale;
  // Translate authored content text (titles, logs, messages, table cells).
  readonly ct: (text: string) => string;
  readonly formatNumber: (value: number) => string;
}

// Screens rendered without a PresentationProvider (isolated tests) are English.
export function useLocale(): Locale {
  return useContext(PresentationContext)?.preferences.language ?? 'en';
}

export function useI18n(): I18n {
  const locale = useLocale();
  const dictionary = useContext(ContentDictionaryContext);
  return useMemo(() => {
    const active = locale === 'en' ? undefined : dictionary;
    const numbers = new Intl.NumberFormat(numberLocale(locale));
    return {
      locale,
      ct: (text: string) => translateContent(active, text),
      formatNumber: (value: number) => numbers.format(value),
    };
  }, [locale, dictionary]);
}

export function useMessages<T>(catalog: MessageCatalog<T>): T {
  return catalog[useLocale()];
}

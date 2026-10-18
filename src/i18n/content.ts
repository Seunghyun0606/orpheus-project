import { parse } from 'yaml';

import type { Locale } from './locale.ts';

// Authored content (Incidents, presentations, campaign, endings) is written in
// English and pinned by hash. Translations are a separate, gettext-style
// dictionary keyed by the exact English text, so every string the engine or a
// presentation hands to the UI can be translated at render time without
// touching the content itself. Text without an entry is shown in English.

export type ContentDictionary = ReadonlyMap<string, string>;

export interface ContentCatalogEntry {
  readonly en: string;
  readonly ko: string | null;
}

export function parseContentCatalog(source: string): readonly ContentCatalogEntry[] {
  const document: unknown = parse(source);
  const entries =
    document !== null && typeof document === 'object' && 'entries' in document
      ? (document as { entries: unknown }).entries
      : undefined;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry: unknown) => {
    if (entry === null || typeof entry !== 'object') return [];
    const { en, ko } = entry as Record<string, unknown>;
    return typeof en === 'string'
      ? [{ en, ko: typeof ko === 'string' && ko.length > 0 ? ko : null }]
      : [];
  });
}

export function buildContentDictionary(sources: Iterable<string>): ContentDictionary {
  const dictionary = new Map<string, string>();
  for (const source of sources)
    for (const { en, ko } of parseContentCatalog(source)) if (ko !== null) dictionary.set(en, ko);
  return dictionary;
}

// Story-episode catalogs ship to Godot as .po files (DEC-072); the web client
// only needs the incident and campaign content.
const koreanSources = import.meta.glob<string>(
  ['./content/ko/*.yaml', '!./content/ko/story-*.yaml'],
  {
    query: '?raw',
    import: 'default',
  },
);

const loading = new Map<Locale, Promise<ContentDictionary>>();
const loaded = new Map<Locale, ContentDictionary>();

// English is the authored language and needs no dictionary. Korean catalogs are
// a separate chunk, fetched once and shared by every screen.
export function loadContentDictionary(locale: Locale): Promise<ContentDictionary | undefined> {
  if (locale === 'en') return Promise.resolve(undefined);
  let pending = loading.get(locale);
  if (pending === undefined) {
    pending = Promise.all(Object.values(koreanSources).map((load) => load())).then((sources) => {
      const dictionary = buildContentDictionary(sources);
      loaded.set(locale, dictionary);
      return dictionary;
    });
    loading.set(locale, pending);
  }
  return pending;
}

export function loadedContentDictionary(locale: Locale): ContentDictionary | undefined {
  return locale === 'en' ? undefined : loaded.get(locale);
}

// Test and QA hook: install a dictionary without the async chunk load.
export function installContentDictionary(locale: Locale, dictionary: ContentDictionary): void {
  loaded.set(locale, dictionary);
  loading.set(locale, Promise.resolve(dictionary));
}

export function translateContent(dictionary: ContentDictionary | undefined, text: string): string {
  return dictionary?.get(text) ?? text;
}

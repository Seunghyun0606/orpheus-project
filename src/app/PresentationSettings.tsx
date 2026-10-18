import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  loadContentDictionary,
  loadedContentDictionary,
  type ContentDictionary,
} from '../i18n/content.ts';
import { ContentDictionaryContext, useMessages } from '../i18n/I18n.ts';
import { defineMessages, isLocale, localeNames, supportedLocales } from '../i18n/locale.ts';

import {
  PresentationContext,
  applyPresentationPreferences,
  readPresentationPreferences,
  savePresentationPreferences,
  usePresentationPreferences,
  type ColorTheme,
  type PresentationPreferences,
  type TextScale,
} from './presentation-settings.ts';

// One shared preference state for every screen. A nested provider is a
// pass-through, so screens can also be mounted on their own (tests, QA entry)
// without creating a second, diverging copy of the settings.
export function PresentationProvider({ children }: { children: ReactNode }) {
  const parent = useContext(PresentationContext);
  if (parent !== null) return <>{children}</>;
  return <RootPresentationProvider>{children}</RootPresentationProvider>;
}

function RootPresentationProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PresentationPreferences>(
    readPresentationPreferences,
  );

  const language = preferences.language;
  // Usually preloaded before the first paint (main.tsx); a language switch shows
  // authored English until the dictionary chunk arrives.
  const [dictionary, setDictionary] = useState<{
    language: string;
    value: ContentDictionary | undefined;
  }>(() => ({ language, value: loadedContentDictionary(language) }));

  useEffect(() => {
    applyPresentationPreferences(preferences);
    savePresentationPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    let current = true;
    void loadContentDictionary(language).then(
      (value) => {
        if (current) setDictionary({ language, value });
      },
      () => {
        // A missing dictionary chunk leaves the authored English in place.
      },
    );
    return () => {
      current = false;
    };
  }, [language]);

  const value = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  const contentDictionary =
    dictionary.language === language ? dictionary.value : loadedContentDictionary(language);
  return (
    <PresentationContext.Provider value={value}>
      <ContentDictionaryContext.Provider value={contentDictionary}>
        {children}
      </ContentDictionaryContext.Provider>
    </PresentationContext.Provider>
  );
}

const messages = defineMessages({
  en: {
    summary: 'Display settings',
    language: 'Language',
    crt: 'CRT effects',
    reduceAnimation: 'Reduce animation',
    textScale: 'Text scale',
    scaleStandard: 'Standard (100%)',
    scaleLarge: 'Large (125%)',
    scaleExtraLarge: 'Extra large (150%)',
    theme: 'Colour theme',
    themeStandard: 'Phosphor green (standard)',
    themeHighContrast: 'High contrast',
    note: "Settings apply to every screen. High contrast also removes scanlines and glow. Your system's reduced-motion and forced-colour settings are always respected.",
  },
  ko: {
    summary: '화면 설정',
    language: '언어',
    crt: 'CRT 효과',
    reduceAnimation: '애니메이션 줄이기',
    textScale: '글자 크기',
    scaleStandard: '기본 (100%)',
    scaleLarge: '크게 (125%)',
    scaleExtraLarge: '아주 크게 (150%)',
    theme: '색상 테마',
    themeStandard: '형광 녹색 (기본)',
    themeHighContrast: '고대비',
    note: '설정은 모든 화면에 적용됩니다. 고대비 테마는 주사선과 번짐 효과도 끕니다. 시스템의 동작 줄이기와 강제 색상 설정은 항상 따릅니다.',
  },
});

export function PresentationSettings() {
  const { preferences, setPreferences } = usePresentationPreferences();
  const m = useMessages(messages);
  const update = (patch: Partial<PresentationPreferences>) =>
    setPreferences({ ...preferences, ...patch });

  return (
    <details className="presentation-settings">
      <summary>{m.summary}</summary>
      <div className="presentation-settings-controls">
        <label>
          {m.language}
          <select
            lang={preferences.language}
            onChange={(event) => {
              const language = event.currentTarget.value;
              if (isLocale(language)) update({ language });
            }}
            value={preferences.language}
          >
            {supportedLocales.map((locale) => (
              <option key={locale} lang={locale} value={locale}>
                {localeNames[locale]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            checked={preferences.crtEffects}
            onChange={(event) => update({ crtEffects: event.currentTarget.checked })}
            type="checkbox"
          />
          {m.crt}
        </label>
        <label>
          <input
            checked={preferences.reducedAnimation}
            onChange={(event) => update({ reducedAnimation: event.currentTarget.checked })}
            type="checkbox"
          />
          {m.reduceAnimation}
        </label>
        <label>
          {m.textScale}
          <select
            onChange={(event) => update({ textScale: event.currentTarget.value as TextScale })}
            value={preferences.textScale}
          >
            <option value="standard">{m.scaleStandard}</option>
            <option value="large">{m.scaleLarge}</option>
            <option value="extra-large">{m.scaleExtraLarge}</option>
          </select>
        </label>
        <label>
          {m.theme}
          <select
            onChange={(event) => update({ colorTheme: event.currentTarget.value as ColorTheme })}
            value={preferences.colorTheme}
          >
            <option value="standard">{m.themeStandard}</option>
            <option value="high-contrast">{m.themeHighContrast}</option>
          </select>
        </label>
        <p className="presentation-settings-note">{m.note}</p>
      </div>
    </details>
  );
}

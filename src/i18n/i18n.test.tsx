import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PresentationProvider, PresentationSettings } from '../app/PresentationSettings.tsx';
import {
  presentationStorageKey,
  readPresentationPreferences,
} from '../app/presentation-settings.ts';
import {
  buildContentDictionary,
  installContentDictionary,
  parseContentCatalog,
} from './content.ts';
import { useI18n } from './I18n.ts';
import { detectLocale } from './locale.ts';

afterEach(() => {
  window.localStorage.clear();
});

function Probe({ text }: { text: string }) {
  const { ct, formatNumber, locale } = useI18n();
  return (
    <p data-testid="probe">
      {locale}|{ct(text)}|{formatNumber(1234.5)}
    </p>
  );
}

describe('display language', () => {
  it('follows the system language on first run only', () => {
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko');
    expect(detectLocale(['en-GB', 'ko'])).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
    window.localStorage.setItem(presentationStorageKey, JSON.stringify({ language: 'ko' }));
    expect(readPresentationPreferences().language).toBe('ko');
    window.localStorage.setItem(presentationStorageKey, JSON.stringify({ language: 'fr' }));
    expect(readPresentationPreferences().language).toBe(detectLocale());
  });

  it('parses catalogs and ignores untranslated entries', () => {
    const source = 'entries:\n  - en: Alpha\n    ko: 알파\n  - en: Beta\n    ko: null\n';
    expect(parseContentCatalog(source)).toEqual([
      { en: 'Alpha', ko: '알파' },
      { en: 'Beta', ko: null },
    ]);
    expect([...buildContentDictionary([source])]).toEqual([['Alpha', '알파']]);
  });

  it('switches every screen between English and Korean from the settings', async () => {
    installContentDictionary('ko', new Map([['Payment API', '결제 API']]));
    const user = userEvent.setup();
    render(
      <PresentationProvider>
        <PresentationSettings />
        <Probe text="Payment API" />
      </PresentationProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('en|Payment API|1,234.5');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'ko');
    expect(document.documentElement).toHaveAttribute('lang', 'ko');
    expect(screen.getByTestId('probe')).toHaveTextContent('ko|결제 API|1,234.5');
    expect(screen.getByText('화면 설정')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '언어' })).toHaveValue('ko');
    // Text without a translation stays in authored English.
    await user.selectOptions(screen.getByRole('combobox', { name: '언어' }), 'en');
    expect(screen.getByTestId('probe')).toHaveTextContent('en|Payment API');
  });
});

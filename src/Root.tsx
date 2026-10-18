import { lazy, Suspense } from 'react';

import { readPresentationPreferences } from './app/presentation-settings.ts';

// The desk (scenario catalog, engine and stores) is a separate chunk so the
// entry bundle stays small; React and this boot screen load first. A Korean
// session also waits for its content dictionary so nothing flashes in English.
const AppShell = lazy(async () => {
  const [shell] = await Promise.all([
    import('./app/AppShell.tsx'),
    import('./i18n/content.ts')
      .then(({ loadContentDictionary }) =>
        loadContentDictionary(readPresentationPreferences().language),
      )
      .catch(() => undefined),
  ]);
  return { default: shell.AppShell };
});

export function Root() {
  const korean = readPresentationPreferences().language === 'ko';
  return (
    <Suspense
      fallback={
        <main className="incident-hub boot-screen">
          <p className="eyebrow">VANTAGE SYSTEMS // INCIDENT DESK</p>
          <p role="status">
            {korean ? '장애 대응 데스크에 연결하는 중…' : 'Connecting to the incident desk…'}
          </p>
        </main>
      }
    >
      <AppShell />
    </Suspense>
  );
}

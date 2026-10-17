import { lazy, Suspense } from 'react';

// The desk (scenario catalog, engine and stores) is a separate chunk so the
// entry bundle stays small; React and this boot screen load first.
const AppShell = lazy(async () => ({ default: (await import('./app/AppShell.tsx')).AppShell }));

export function Root() {
  return (
    <Suspense
      fallback={
        <main className="incident-hub boot-screen">
          <p className="eyebrow">VANTAGE SYSTEMS // INCIDENT DESK</p>
          <p role="status">Connecting to the incident desk…</p>
        </main>
      }
    >
      <AppShell />
    </Suspense>
  );
}

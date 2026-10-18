import { useRef, useState } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { PackageResult, ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { campaignDefinitionKey, createCampaignLedger } from '../persistence/campaign-ledger.ts';
import {
  createCampaignSessionStore,
  type CampaignSessionState,
} from '../store/campaign-session.ts';
import { CampaignDesk } from './CampaignDesk.tsx';
import { PresentationProvider, PresentationSettings } from './PresentationSettings.tsx';
import { actTitle, newestPackage } from './campaign-copy.ts';
import { useI18n, useMessages } from '../i18n/I18n.ts';
import { campaignEntryMessages, type CampaignEntryMessages } from './messages/campaign-entry.ts';

export type CampaignPackageLoader = () => Promise<PackageResult>;
const loadFullCampaign: CampaignPackageLoader = async () =>
  (await import('../scenario/full-campaign.ts')).loadProductionCampaignPackages();

// Summaries and errors keep data, not text, so they follow a language switch.
interface SavedRunSummary {
  readonly id: string;
  readonly progress: { readonly act: number; readonly closed: number } | null;
  readonly version: string | null;
}

type EntryError =
  | { readonly key: keyof CampaignEntryMessages['errors'] }
  | { readonly key: keyof CampaignEntryMessages['codeErrors']; readonly code: string };

function errorText(m: CampaignEntryMessages, error: EntryError): string {
  return 'code' in error ? m.codeErrors[error.key](error.code) : m.errors[error.key];
}

export function FullCampaignEntry(props: {
  onBack: () => void;
  loader?: CampaignPackageLoader;
  factory?: () => IDBFactory | undefined;
  identity?: () => string;
}) {
  return (
    <PresentationProvider>
      <CampaignEntryScreen {...props} />
    </PresentationProvider>
  );
}

function CampaignEntryScreen({
  onBack,
  loader = loadFullCampaign,
  factory,
  identity = () => crypto.randomUUID(),
}: {
  onBack: () => void;
  loader?: CampaignPackageLoader;
  factory?: () => IDBFactory | undefined;
  identity?: () => string;
}) {
  const [result, setResult] = useState<PackageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const { locale } = useI18n();
  const m = useMessages(campaignEntryMessages);
  const [error, setError] = useState<EntryError | null>(null);
  const [runs, setRuns] = useState<SavedRunSummary[]>([]);
  const [session, setSession] = useState<{
    store: StoreApi<CampaignSessionState>;
    composition: ResolvedCampaignPackage;
  } | null>(null);
  const flight = useRef(false);
  const ledger = useRef<ReturnType<typeof createCampaignLedger> | null>(null);
  const newest = result?.ok ? newestPackage(result.registry.all()) : undefined;

  // Explicit, read-only discovery. Nothing is created or migrated here.
  async function inspect() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    setRuns([]);
    ledger.current = null;
    try {
      const checked = await loader();
      setResult(checked);
      if (!checked.ok) return;
      const entries = checked.registry.all();
      if (!entries.length) {
        setError({ key: 'empty' });
        return;
      }
      ledger.current = createCampaignLedger(
        {
          definitions: new Map(
            entries.map((p) => [
              campaignDefinitionKey(p.definition.id, p.definition.version),
              p.definition,
            ]),
          ),
          scenarios: new Map(entries.flatMap((p) => [...p.catalog])),
        },
        factory,
      );
      const discovered = await ledger.current.listRunIds();
      if (!discovered.ok) {
        setError({ key: 'listFailed', code: discovered.code });
        return;
      }
      const summaries: SavedRunSummary[] = [];
      for (const id of discovered.runIds) {
        const saved = await ledger.current.read(id);
        if (!saved.ok || !saved.run) {
          summaries.push({ id, progress: null, version: null });
          continue;
        }
        const creation = saved.run.operations[0];
        summaries.push({
          id,
          progress: {
            act: saved.run.projection.act,
            closed: saved.run.projection.completed.length,
          },
          version: creation?.definitionVersion ?? null,
        });
      }
      setRuns(summaries);
    } catch {
      setError({ key: 'storage' });
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function open(p: ResolvedCampaignPackage | null, runId?: string) {
    if (flight.current || !result?.ok || !ledger.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    try {
      const id = runId ?? identity(),
        saved = await ledger.current.read(id);
      if (!saved.ok) {
        setError({ key: 'openFailed', code: saved.code });
        return;
      }
      if (runId && !saved.run) {
        setError({ key: 'runGone' });
        return;
      }
      if (!runId && saved.run) {
        setError({ key: 'identityExists' });
        return;
      }
      const creation = saved.run?.operations[0];
      const composition = creation
        ? result.registry.resolve(creation.definitionId, creation.definitionVersion)
        : p;
      if (!composition) {
        setError({ key: 'unknownVersion' });
        return;
      }
      const store = createCampaignSessionStore({
        definition: composition.definition,
        catalog: composition.catalog,
        runId: id,
        ledger: ledger.current,
        identity,
      });
      if (!(await store.getState().load())) {
        const code = store.getState().error;
        setError(code ? { key: 'store', code } : null);
        return;
      }
      if (!runId && store.getState().readState !== 'not_found') {
        setError({ key: 'identityExists' });
        return;
      }
      // Keep the store even when create acknowledgement is lost: retry must retain
      // its exact run/operation identity, not create a second official campaign.
      setSession({ store, composition });
      if (!runId) await store.getState().create();
    } catch {
      setError({ key: 'unconfirmed' });
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  if (session)
    return (
      <CampaignDesk
        store={session.store}
        composition={session.composition}
        seed={1001}
        onBack={() => setSession(null)}
      />
    );
  const incidentCount = newest?.definition.incidents.length;
  return (
    <main className="incident-hub campaign-entry" aria-label={m.entryLabel} aria-busy={busy}>
      <header>
        <p className="eyebrow">{m.eyebrow}</p>
        <h1>{m.title}</h1>
        <p>{m.intro}</p>
        <div className="screen-toolbar" role="group" aria-label={m.screenSettings}>
          <PresentationSettings />
        </div>
        <button type="button" disabled={busy} onClick={onBack}>
          {m.backToDesk}
        </button>
      </header>
      <section className="panel campaign-entry-panel" aria-labelledby="campaign-entry-title">
        <h2 id="campaign-entry-title">{m.filesTitle}</h2>
        {result === null ? (
          <>
            <p>{m.nothingCreated}</p>
            <button type="button" disabled={busy} onClick={() => void inspect()}>
              {m.openFiles}
            </button>
          </>
        ) : null}
        {busy ? <p role="status">{m.checking}</p> : null}
        {error ? <p role="alert">{errorText(m, error)}</p> : null}
        {result && !result.ok ? (
          <p role="status">
            {m.notInBuild} <small>{m.technicalDetail(result.diagnostics.join(', '))}</small>
          </p>
        ) : null}
        {newest ? (
          <div className="campaign-entry-choice">
            <button
              type="button"
              className="primary-action"
              disabled={busy}
              aria-describedby="new-campaign-detail"
              onClick={() => void open(newest)}
            >
              {m.newCampaign}
            </button>
            <p className="console-hint" id="new-campaign-detail">
              {incidentCount === undefined ? '' : m.incidentCount(incidentCount)}
              {newest.presentations.every((v) => v.schemaVersion === 1) ? m.staticViews : ''}
              <small>{m.contentVersion(newest.package.version)}</small>
            </p>
          </div>
        ) : null}
        {runs.length ? (
          <section aria-labelledby="saved-campaigns-title">
            <h3 id="saved-campaigns-title">{m.savedTitle}</h3>
            <ul className="archive-list">
              {runs.map((run, index) => (
                <li key={run.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-describedby={`saved-run-${index}`}
                    onClick={() => void open(null, run.id)}
                  >
                    {m.continue}
                  </button>
                  <span className="console-hint" id={`saved-run-${index}`}>
                    {run.progress === null
                      ? m.detailsUnavailable
                      : m.runDetail(actTitle(run.progress.act, locale), run.progress.closed)}
                    {run.version === null ? null : <small>{m.savedVersion(run.version)}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {result !== null && !busy ? (
          <button type="button" className="link-button" onClick={() => void inspect()}>
            {m.checkAgain}
          </button>
        ) : null}
      </section>
    </main>
  );
}

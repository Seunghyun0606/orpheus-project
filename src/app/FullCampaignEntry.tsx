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

export type CampaignPackageLoader = () => Promise<PackageResult>;
const loadFullCampaign: CampaignPackageLoader = async () =>
  (await import('../scenario/full-campaign.ts')).loadProductionCampaignPackages();

interface SavedRunSummary {
  readonly id: string;
  readonly detail: string;
  readonly version: string | null;
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
  const [error, setError] = useState<string | null>(null);
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
        setError('No complete campaign is available in this build.');
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
        setError(`Saved campaigns could not be listed. Technical detail: ${discovered.code}`);
        return;
      }
      const summaries: SavedRunSummary[] = [];
      for (const id of discovered.runIds) {
        const saved = await ledger.current.read(id);
        if (!saved.ok || !saved.run) {
          summaries.push({
            id,
            detail: 'Details unavailable; the save is kept as-is.',
            version: null,
          });
          continue;
        }
        const creation = saved.run.operations[0];
        const closed = saved.run.projection.completed.length;
        summaries.push({
          id,
          detail: `${actTitle(saved.run.projection.act)} · ${closed} incident${closed === 1 ? '' : 's'} closed`,
          version: creation?.definitionVersion ?? null,
        });
      }
      setRuns(summaries);
    } catch {
      setError('Campaign files or local storage are unavailable right now.');
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
        setError(`This save could not be opened. Technical detail: ${saved.code}`);
        return;
      }
      if (runId && !saved.run) {
        setError('Saved run is no longer available.');
        return;
      }
      if (!runId && saved.run) {
        setError('New run identity already exists; preserved without overwrite.');
        return;
      }
      const creation = saved.run?.operations[0];
      const composition = creation
        ? result.registry.resolve(creation.definitionId, creation.definitionVersion)
        : p;
      if (!composition) {
        setError(
          'This save was made with a campaign version this build does not include. It is preserved unchanged.',
        );
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
        setError(store.getState().error);
        return;
      }
      if (!runId && store.getState().readState !== 'not_found') {
        setError('New run identity already exists; preserved without overwrite.');
        return;
      }
      // Keep the store even when create acknowledgement is lost: retry must retain
      // its exact run/operation identity, not create a second official campaign.
      setSession({ store, composition });
      if (!runId) await store.getState().create();
    } catch {
      setError('Campaign operation not confirmed; saved data is preserved.');
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
    <main className="incident-hub campaign-entry" aria-label="Full campaign entry" aria-busy={busy}>
      <header>
        <p className="eyebrow">VANTAGE SYSTEMS // RELIABILITY ROTATION</p>
        <h1>Full campaign</h1>
        <p>
          The long rotation: incidents across nine acts, one continuous record. Each incident plays
          like the training ones, but your choices carry forward, and something in the stack starts
          to notice how you make them.
        </p>
        <div className="screen-toolbar" role="group" aria-label="Screen settings">
          <PresentationSettings />
        </div>
        <button type="button" disabled={busy} onClick={onBack}>
          Back to incident desk
        </button>
      </header>
      <section className="panel campaign-entry-panel" aria-labelledby="campaign-entry-title">
        <h2 id="campaign-entry-title">Campaign files</h2>
        {result === null ? (
          <>
            <p>
              Nothing is created until you choose. Your training-rotation saves are kept separately.
            </p>
            <button type="button" disabled={busy} onClick={() => void inspect()}>
              Open campaign files
            </button>
          </>
        ) : null}
        {busy ? <p role="status">Checking campaign files…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {result && !result.ok ? (
          <p role="status">
            The full campaign is not available in this build.{' '}
            <small>Technical detail: {result.diagnostics.join(', ')}</small>
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
              New campaign
            </button>
            <p className="console-hint" id="new-campaign-detail">
              {incidentCount === undefined ? '' : `${incidentCount} incidents. `}
              {newest.presentations.every((v) => v.schemaVersion === 1)
                ? 'Investigation views are static in this version (no live narrative or War Room feed). '
                : ''}
              <small>Content version {newest.package.version}</small>
            </p>
          </div>
        ) : null}
        {runs.length ? (
          <section aria-labelledby="saved-campaigns-title">
            <h3 id="saved-campaigns-title">Saved campaigns</h3>
            <ul className="archive-list">
              {runs.map((run, index) => (
                <li key={run.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-describedby={`saved-run-${index}`}
                    onClick={() => void open(null, run.id)}
                  >
                    Continue
                  </button>
                  <span className="console-hint" id={`saved-run-${index}`}>
                    {run.detail}
                    {run.version === null ? null : <small> · version {run.version}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {result !== null && !busy ? (
          <button type="button" className="link-button" onClick={() => void inspect()}>
            Check campaign files again
          </button>
        ) : null}
      </section>
    </main>
  );
}

import { useRef, useState } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { PackageResult, ResolvedCampaignPackage } from '../scenario/campaign-package.ts';
import { campaignDefinitionKey, createCampaignLedger } from '../persistence/campaign-ledger.ts';
import {
  createCampaignSessionStore,
  type CampaignSessionState,
} from '../store/campaign-session.ts';
import { CampaignDesk } from './CampaignDesk.tsx';

export type CampaignPackageLoader = () => Promise<PackageResult>;
const loadFullCampaign: CampaignPackageLoader = async () =>
  (await import('../scenario/full-campaign.ts')).loadProductionCampaignPackages();
export function FullCampaignEntry({
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
  const [runIds, setRunIds] = useState<string[]>([]);
  const [session, setSession] = useState<{
    store: StoreApi<CampaignSessionState>;
    composition: ResolvedCampaignPackage;
  } | null>(null);
  const flight = useRef(false);
  const ledger = useRef<ReturnType<typeof createCampaignLedger> | null>(null);
  async function inspect() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    setRunIds([]);
    ledger.current = null;
    try {
      const checked = await loader();
      setResult(checked);
      if (!checked.ok) {
        setRunIds([]);
        return;
      }
      const entries = checked.registry.all();
      if (!entries.length) {
        setError('No complete campaign package is available.');
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
        setError(discovered.code);
        return;
      }
      setRunIds(discovered.runIds);
    } catch {
      setError('Campaign package or storage is unavailable.');
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
        setError(saved.code);
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
        setError('Unsupported campaign package; saved data is preserved.');
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
  return (
    <main className="incident-hub" aria-label="Full campaign entry" aria-busy={busy}>
      <h1>Full campaign</h1>
      <button type="button" disabled={busy} onClick={onBack}>
        Back to incident desk
      </button>
      <p>No campaign is created automatically. Existing incident saves remain unchanged.</p>
      <button type="button" disabled={busy} onClick={() => void inspect()}>
        Inspect campaign packages and saved runs
      </button>
      {busy ? <p role="status">Waiting for verified campaign data</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {result && !result.ok ? (
        <p role="status">Full campaign content unavailable: {result.diagnostics.join(', ')}</p>
      ) : null}
      {result?.ok
        ? result.registry.all().map((p) => (
            <button
              type="button"
              key={campaignDefinitionKey(p.definition.id, p.definition.version)}
              disabled={busy}
              onClick={() => void open(p)}
            >
              Create campaign {p.package.id} / {p.package.version}
            </button>
          ))
        : null}
      {runIds.map((id) => (
        <button type="button" key={id} disabled={busy} onClick={() => void open(null, id)}>
          Restore run {id}
        </button>
      ))}
    </main>
  );
}

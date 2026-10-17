import { useState } from 'react';
import { useStore } from 'zustand';
import { CampaignDesk } from '../app/CampaignDesk.tsx';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { campaignDefinitionKey, createCampaignLedger } from '../persistence/campaign-ledger.ts';
import { replayCampaign } from '../engine/campaign/transitions.ts';
import { opportunityCampaignFixture, trainedFixture } from '../tests/fixtures/opportunities.ts';
import { campaignCatalog } from '../tests/fixtures/campaign.ts';
import '../ui/base.css';

// This module is reachable only from the explicit, separately built QA HTML entry.
// No legacy port, normal-app initialization, global fake IDB or production ending.
const definition = opportunityCampaignFixture();
definition.version = 'native-qa-fixture-v1';
for (const reference of definition.references) reference.version = definition.version;
for (const branch of definition.branches!) branch.version = definition.version;
definition.opportunities!.rules[0]!.reveal = {
  type: 'compare',
  reference: 'elapsed',
  operator: 'gte',
  expected: 15,
};
const ledger = createCampaignLedger({
  definitions: new Map([[campaignDefinitionKey(definition.id, definition.version), definition]]),
  scenarios: campaignCatalog,
});
const pointerKey = 'orpheus.qa.native.selected-run.v1';
type Session = ReturnType<typeof createCampaignSessionStore>;
function session(runId: string) {
  return createCampaignSessionStore({ definition, catalog: campaignCatalog, ledger, runId });
}
function Audit({ store }: { store: Session }) {
  const state = useStore(store);
  const metric = state.run?.behavior?.metrics.predictionDeviation;
  return (
    <aside className="panel" aria-label="Isolated QA evidence">
      <h2>TEST CONTENT ONLY — native QA evidence</h2>
      <p>
        Run: {state.run?.runId ?? 'not loaded'} / Revision: {state.run?.revision ?? 'none'}
      </p>
      <p>
        ACKs: {state.run?.opportunities?.acknowledgements.length ?? 0} / Responses:{' '}
        {state.run?.opportunities?.responses.length ?? 0}
      </p>
      <p>
        Fixture deviation samples: {metric?.numerator ?? 0}/{metric?.denominator ?? 0}
      </p>
      <p>
        Viewport: {window.innerWidth} × {window.innerHeight} CSS pixels
      </p>
      <p>Separate QA profile. No normal saves or ending grants.</p>
      <button
        disabled={state.busy || state.pendingOperationId !== null}
        onClick={() => location.reload()}
      >
        Reload QA WebView
      </button>
    </aside>
  );
}
export function NativeQa() {
  const [store, setStore] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open(fresh: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const runId = fresh ? 'qa024-' + crypto.randomUUID() : localStorage.getItem(pointerKey);
      if (!runId?.startsWith('qa024-')) throw new Error('No isolated fixture pointer');
      if (fresh) {
        const existing = await ledger.read(runId);
        if (!existing.ok || existing.run) throw new Error('Fresh fixture identity not empty');
        const operations = trainedFixture(definition).operations.map((op) => ({ ...op, runId }));
        for (let i = 0; i < operations.length; i++) {
          const prefix = replayCampaign(definition, campaignCatalog, operations.slice(0, i + 1));
          if (!prefix.ok) throw new Error('Invalid fixture training prefix');
          const result = await ledger.commit({
            runId,
            expectedRevision: i ? i - 1 : null,
            operation: operations[i],
            candidate: prefix.run,
          });
          if (!result.ok) throw new Error(result.code);
        }
        localStorage.setItem(pointerKey, runId);
      }
      const next = session(runId);
      if (!(await next.getState().load()) || !next.getState().run)
        throw new Error('Fixture read failed');
      setStore(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'QA initialization failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="qa-native-entry">
      <section className="panel">
        <h1>Orpheus QA - TASK-024</h1>
        <p>
          Explicit fixture-only entry, isolated WebView data. Create preserves all prior QA runs.
        </p>
        <button disabled={busy || store !== null} onClick={() => void open(true)}>
          Create fresh isolated fixture
        </button>
        <button disabled={busy || store !== null} onClick={() => void open(false)}>
          Restore isolated fixture
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </section>
      {store ? (
        <>
          <Audit store={store} />
          <CampaignDesk
            store={store}
            seed={1002}
            onBack={() => {
              const state = store.getState();
              if (!state.busy && !state.pendingOperationId) setStore(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

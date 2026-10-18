import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compositionFixture } from './fixtures/composition.ts';
import { createCampaignPackageRegistry, parsePackageYaml } from '../scenario/campaign-package.ts';
import { createCampaignSessionStore } from '../store/campaign-session.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import { projectCampaignInvestigation } from '../engine/campaign/investigation.ts';
import { CampaignDesk } from '../app/CampaignDesk.tsx';
import { FullCampaignEntry } from '../app/FullCampaignEntry.tsx';
import { AppShell } from '../app/AppShell.tsx';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import { inspectProductionCampaignSources } from '../scenario/full-campaign.ts';
import { CampaignTools } from '../app/CampaignTools.tsx';
import { fullCampaignManifestSchema } from '../scenario/production-catalog.ts';
import manifestSource from '../scenario/data/full-campaign-manifest.yaml?raw';
import { runScenarioValidationCli } from '../scenario/cli.ts';
import { presentationStorageKey } from '../app/presentation-settings.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});
function session() {
  const f = compositionFixture(),
    factory = new IDBFactory();
  let sequence = 0;
  const ledger = createCampaignLedger(
    {
      definitions: new Map([
        [campaignDefinitionKey(f.definition.id, f.definition.version), f.definition],
      ]),
      scenarios: f.composition.catalog,
    },
    () => factory,
  );
  const store = createCampaignSessionStore({
    definition: f.definition,
    catalog: f.composition.catalog,
    runId: 'fixture-run',
    ledger,
    identity: () => 'identity-' + sequence++,
  });
  return { ...f, ledger, store, factory };
}
describe('strict pinned campaign composition', () => {
  it('does not treat missing, malformed or a small fixture package as complete production', () => {
    const f = compositionFixture();
    expect(inspectProductionCampaignSources({})).toEqual({
      ok: false,
      diagnostics: ['FULL_CAMPAIGN_CONTENT_UNAVAILABLE'],
    });
    expect(
      inspectProductionCampaignSources({
        './data/full-campaign/packages/bad.yaml': 'id: one\nid: two',
      }).ok,
    ).toBe(false);
    const sources = {
      './data/full-campaign/incidents/fixture.yaml': JSON.stringify(f.scenario),
      './data/full-campaign/definitions/fixture.yaml': JSON.stringify(f.definition),
      './data/full-campaign/packages/fixture.yaml': JSON.stringify(f.pkg),
      './data/full-campaign/presentations/fixture.yaml': JSON.stringify(f.presentation),
    };
    expect(inspectProductionCampaignSources(sources)).toEqual({
      ok: false,
      diagnostics: ['INCOMPLETE_PRODUCTION_PACKAGE'],
    });
    expect(
      inspectProductionCampaignSources({ ...sources, './data/full-campaign/unknown.yaml': '{}' }),
    ).toEqual({
      ok: false,
      diagnostics: ['UNKNOWN_PRODUCTION_SOURCE'],
    });
    const manifest = fullCampaignManifestSchema.parse(parsePackageYaml(manifestSource));
    manifest.incidents[1]!.id = manifest.incidents[0]!.id;
    expect(fullCampaignManifestSchema.safeParse(manifest).success).toBe(false);
  });
  it('validates the manifest category without misclassifying it as an incident', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runScenarioValidationCli([])).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });
  it('rejects unknown package/presentation shapes and duplicate YAML keys', () => {
    const f = compositionFixture();
    expect(() => parsePackageYaml('id: a\nid: b')).toThrow();
    for (const bad of [
      { ...f.pkg, schemaVersion: 2 },
      { ...f.pkg, extra: true },
    ])
      expect(createCampaignPackageRegistry({ ...f.inputs, packages: [bad] }).ok).toBe(false);
    expect(
      createCampaignPackageRegistry({
        ...f.inputs,
        presentations: [{ ...f.presentation, html: '<script>' }],
      }).ok,
    ).toBe(false);
  });
  it('rejects absent, mismatched, duplicate and latest-fallback bindings', () => {
    const f = compositionFixture();
    for (const pkg of [
      { ...f.pkg, definitionVersion: 'newest' },
      { ...f.pkg, presentations: [] },
      { ...f.pkg, scenarios: [...f.pkg.scenarios, ...f.pkg.scenarios] },
      { ...f.pkg, presentations: [{ ...f.pkg.presentations[0]!, version: 'newest' }] },
    ])
      expect(createCampaignPackageRegistry({ ...f.inputs, packages: [pkg] }).ok).toBe(false);
    expect(createCampaignPackageRegistry({ ...f.inputs, packages: [f.pkg, f.pkg] }).ok).toBe(false);
    expect(f.registry.resolve(f.definition.id, 'newest')).toBeUndefined();
  });
  it('validates action, signal, evidence and explicit gate references and table shapes', () => {
    const f = compositionFixture();
    const invalid = [
      { ...f.presentation, panels: [{ ...f.presentation.panels[0]!, actionIds: ['UNKNOWN'] }] },
      {
        ...f.presentation,
        panels: [
          {
            ...f.presentation.panels[0]!,
            blocks: [{ kind: 'signals', id: 'bad', signalIds: ['UNKNOWN'] }],
          },
        ],
      },
      {
        ...f.presentation,
        panels: [
          {
            ...f.presentation.panels[0]!,
            blocks: [
              { kind: 'signals', id: 'bad', signalIds: ['API_ERROR_RATE', 'API_ERROR_RATE'] },
            ],
          },
        ],
      },
      {
        ...f.presentation,
        evidenceRelations: [{ id: 'bad', from: 'UNKNOWN', to: 'artifact', label: 'bad' }],
      },
      { ...f.presentation, panels: [{ ...f.presentation.panels[0]!, reveal: [] }] },
      {
        ...f.presentation,
        panels: [
          {
            ...f.presentation.panels[0]!,
            campaignReveal: {
              type: 'compare',
              reference: 'UNKNOWN',
              operator: 'eq',
              expected: true,
            },
          },
        ],
      },
      {
        ...f.presentation,
        panels: [
          {
            ...f.presentation.panels[0]!,
            blocks: [{ kind: 'table', id: 'bad', columns: ['one'], rows: [['one', 'two']] }],
          },
        ],
      },
    ];
    for (const view of invalid)
      expect(createCampaignPackageRegistry({ ...f.inputs, presentations: [view] }).ok).toBe(false);
  });
  it('owns immutable snapshots rather than caller maps and mutable records', () => {
    const f = compositionFixture();
    f.presentation.panels[0]!.title = 'changed';
    f.definition.initial.act = 999;
    const p = f.registry.all()[0]!;
    expect(p.presentations[0]!.panels[0]!.title).toBe('Fixture investigation logs');
    expect(p.definition.initial.act).toBe(6);
    (p.catalog as Map<string, unknown>).clear();
    expect(f.registry.all()[0]!.catalog.size).toBe(1);
  });
  it('projects only revealed values and gated documents without creating inputs', async () => {
    const f = session();
    await f.store.getState().load();
    await f.store.getState().create();
    await f.store.getState().start('stage-one', 1001);
    const run = f.store.getState().run!,
      before = canonicalJson(run);
    const result = projectCampaignInvestigation(f.composition, run, run.activeAttemptId!);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('projection');
    expect(result.panels.map((p) => p.id)).toEqual(['logs']);
    const values = result.panels[0]!.blocks.find((b) => b.kind === 'signals');
    expect(values?.kind === 'signals' && values.values.map((v) => v.id)).toEqual([
      'API_ERROR_RATE',
    ]);
    expect(result.relations).toEqual([]);
    expect(canonicalJson(run)).toBe(before);
    expect(
      projectCampaignInvestigation(f.composition, { ...run, revision: 999 }, run.activeAttemptId!)
        .ok,
    ).toBe(false);
  });
  it('fails a referenced unavailable metric even under a known true sibling', async () => {
    const f = compositionFixture();
    f.presentation.panels[0]!.campaignReveal = {
      type: 'any',
      children: [
        f.presentation.panels[0]!.campaignReveal,
        { type: 'compare', reference: 'metric', operator: 'eq', expected: 0 },
      ],
    };
    const checked = createCampaignPackageRegistry(f.inputs);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error('fixture');
    const s = session();
    await s.store.getState().load();
    await s.store.getState().create();
    await s.store.getState().start('stage-one', 1);
    const run = s.store.getState().run!,
      result = projectCampaignInvestigation(checked.registry.all()[0]!, run, run.activeAttemptId!);
    expect(result.ok && result.panels.length).toBe(0);
    expect(result.ok && result.diagnostics).toContain('UNAVAILABLE_OBSERVATION');
  });
});
describe('explicit storage discovery and desktop boundary', () => {
  it('rejects a creation collision including a run appearing between the two reads', async () => {
    const user = userEvent.setup(),
      f = session();
    await f.store.getState().load();
    await f.store.getState().create();
    const before = canonicalJson(f.store.getState().run);
    render(
      <FullCampaignEntry
        onBack={vi.fn()}
        factory={() => f.factory}
        loader={async () => ({ ok: true, registry: f.registry })}
        identity={() => 'fixture-run'}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open campaign files' }));
    const create = await screen.findByRole('button', { name: 'New campaign' });
    // Saved runs are summarised by an explicit read-only discovery pass.
    const resume = await screen.findByRole('button', { name: 'Continue' });
    expect(resume).toHaveAccessibleDescription(/Act 6 — HUMAN SYSTEM · 0 incidents closed/);
    expect(resume).not.toHaveTextContent('fixture-run');
    await waitFor(() => expect(create).toBeEnabled());
    // Discovery itself reads saved runs (read-only) to describe them, so the race
    // is armed only afterwards: the first creation read observes absence and the
    // second sees the concurrent writer's run.
    const original = IDBObjectStore.prototype.get;
    let checks = 0;
    const get = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
      this: IDBObjectStore,
      query,
    ) {
      if (query === 'fixture-run' && checks++ === 0) return original.call(this, 'not-yet-created');
      return original.call(this, query);
    });
    await user.click(create);
    expect(await screen.findByRole('alert')).toHaveTextContent('New run identity already exists');
    expect(
      screen.queryByRole('main', { name: 'Campaign operations desktop' }),
    ).not.toBeInTheDocument();
    get.mockRestore();
    const saved = await f.ledger.read('fixture-run');
    expect(saved.ok && canonicalJson(saved.run)).toBe(before);
  });
  it('preserves malformed saved data after read-only discovery and failed validation', async () => {
    const f = session();
    const malformed = { runId: 'damaged', operations: [], untouched: 'retain' };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = f.factory.open('orpheus.campaign', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('runs', { keyPath: 'runId' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('runs', 'readwrite');
      tx.objectStore('runs').put(malformed);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    expect(await f.ledger.listRunIds()).toEqual({ ok: true, runIds: ['damaged'] });
    expect(await f.ledger.read('damaged')).toEqual({ ok: false, code: 'INVALID_LEDGER_RECORD' });
    const preserved = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('runs', 'readonly');
      const request = tx.objectStore('runs').get('damaged');
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
    expect(preserved).toEqual(malformed);
    db.close();
  });
  it('renders authored markup literally rather than executing it', async () => {
    const f = session();
    f.presentation.panels[0]!.blocks[0] = {
      kind: 'paragraph',
      id: 'literal',
      text: '<img src=x onerror="alert(1)"><script>run()</script>',
    };
    const checked = createCampaignPackageRegistry(f.inputs);
    if (!checked.ok) throw new Error('fixture');
    await f.store.getState().load();
    await f.store.getState().create();
    await f.store.getState().start('stage-one', 1);
    const run = f.store.getState().run!;
    const { container } = render(
      <CampaignTools
        composition={checked.registry.all()[0]!}
        run={run}
        attemptId={run.activeAttemptId!}
        actions={[]}
        disabled={false}
        readOnly
        onAction={vi.fn()}
      />,
    );
    expect(
      screen.getByText('<img src=x onerror="alert(1)"><script>run()</script>'),
    ).toBeInTheDocument();
    expect(container.querySelector('img, script')).toBeNull();
  });
  it('requires visible ACK and commits the eligible response through composed tools', async () => {
    const user = userEvent.setup(),
      f = session();
    await f.store.getState().load();
    await f.store.getState().create();
    await f.store.getState().start('stage-one', 1001);
    for (let i = 0; i < 3; i++) await f.store.getState().performAction('RESTART_API');
    await f.store.getState().start('stage-one', 1001);
    await f.store.getState().preparePresentation('prediction');
    const preparation = f.store.getState().run!.opportunities!.preparations.at(-1)!;
    f.store.getState().selectPresentation(preparation.id);
    render(
      <CampaignDesk store={f.store} composition={f.composition} seed={1001} onBack={vi.fn()} />,
    );
    const restart = screen.getByRole('button', { name: /^Restart Payment API/ });
    expect(restart).toBeDisabled();
    expect(f.store.getState().run!.opportunities!.acknowledgements).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: "I've read this" }));
    await waitFor(() => expect(restart).toBeEnabled());
    expect(f.store.getState().run!.opportunities!.acknowledgements).toHaveLength(1);
    await user.click(restart);
    await waitFor(() => expect(f.store.getState().pendingOperationId).toBeNull());
    expect(f.store.getState().run!.opportunities!.responses).toHaveLength(1);
    const saved = await f.ledger.read('fixture-run');
    expect(saved.ok && canonicalJson(saved.run)).toBe(canonicalJson(f.store.getState().run));
  });
  it('lists keys without mutation, preserves malformed runs and requires exact restoration', async () => {
    const f = session();
    expect(await f.ledger.listRunIds()).toEqual({ ok: true, runIds: [] });
    await f.store.getState().load();
    await f.store.getState().create();
    const before = canonicalJson(f.store.getState().run);
    expect(await f.ledger.listRunIds()).toEqual({ ok: true, runIds: ['fixture-run'] });
    expect(canonicalJson(await f.ledger.read('fixture-run'))).toContain(before);
    const restored = createCampaignSessionStore({
      definition: f.definition,
      catalog: f.composition.catalog,
      runId: 'fixture-run',
      ledger: f.ledger,
    });
    expect(await restored.getState().load()).toBe(true);
    expect(canonicalJson(restored.getState().run)).toBe(before);
    expect(
      await createCampaignLedger(
        { definitions: new Map(), scenarios: f.composition.catalog },
        () => f.factory,
      ).read('fixture-run'),
    ).toEqual({ ok: false, code: 'UNSUPPORTED_DEFINITION' });
    expect(canonicalJson(f.store.getState().run)).toBe(before);
    expect(
      await createCampaignLedger(
        { definitions: new Map(), scenarios: new Map() },
        () => undefined,
      ).listRunIds(),
    ).toEqual({ ok: false, code: 'INDEXEDDB_UNAVAILABLE' });
  });
  it('does not load/open/create campaigns on default MVP entry or missing production data', async () => {
    const user = userEvent.setup(),
      loader = vi.fn(async () => ({
        ok: false as const,
        diagnostics: ['FULL_CAMPAIGN_CONTENT_UNAVAILABLE'],
      }));
    render(<AppShell fullCampaignLoader={loader} />);
    expect(loader).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start INC-001' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Full campaign' }));
    const files = await screen.findByRole('button', { name: 'Open campaign files' });
    expect(loader).not.toHaveBeenCalled();
    await user.click(files);
    expect(await screen.findByText(/The full campaign is not available/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New campaign' })).not.toBeInTheDocument();
  });
  it('renders escaped typed tools, gated bodies, postmortem and read-only archives', async () => {
    const user = userEvent.setup(),
      f = session();
    await f.store.getState().load();
    await f.store.getState().create();
    await f.store.getState().start('stage-one', 1);
    render(<CampaignDesk store={f.store} composition={f.composition} seed={1} onBack={vi.fn()} />);
    expect(screen.queryByText('Hidden fixture document')).not.toBeInTheDocument();
    const initial = f.store.getState().run!.revision;
    await user.click(screen.getByRole('button', { name: /^Review record:/ }));
    expect(screen.queryByRole('button', { name: /Restart Payment API/ })).not.toBeInTheDocument();
    expect(f.store.getState().run!.revision).toBe(initial);
    await user.click(screen.getByRole('button', { name: 'Back to current incident' }));
    for (const name of [
      'Open Payment API logs',
      'Inspect PostgreSQL',
      'Inspect database sessions',
      'Terminate stale database sessions',
    ]) {
      const button = await screen.findByRole('button', { name: new RegExp('^' + name) });
      await waitFor(() => expect(button).toBeEnabled());
      await user.click(button);
      await waitFor(() => {
        expect(f.store.getState().busy).toBe(false);
        expect(f.store.getState().pendingOperationId).toBeNull();
      });
    }
    expect(await screen.findByText('Hidden fixture document')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Hidden fixture document' })).getByRole('cell', {
        name: 'Preserved evidence',
      }),
    ).toBeInTheDocument();
    expect(f.store.getState().run!.opportunities!.acknowledgements).toHaveLength(0);
  });
  it('retains create identity after transaction abort and prevents leaving pending store', async () => {
    const user = userEvent.setup(),
      f = compositionFixture(),
      factory = new IDBFactory();
    let n = 0;
    // Abort after put simulates a failed transaction, not an accepted input.
    const original = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args
    ) {
      const request = original.apply(this, args);
      this.transaction.abort();
      return request;
    });
    render(
      <FullCampaignEntry
        onBack={vi.fn()}
        loader={async () => ({ ok: true, registry: f.registry })}
        factory={() => factory}
        identity={() => 'id-' + n++}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open campaign files' }));
    await user.click(await screen.findByRole('button', { name: 'New campaign' }));
    expect(await screen.findByRole('button', { name: 'Retry save' })).toBeInTheDocument();
    const assigned = n;
    expect(screen.getByRole('button', { name: 'Back to incident desk' })).toBeDisabled();
    put.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Retry save' }));
    expect(n).toBe(assigned);
    expect(await screen.findByText('All progress saved.')).toBeInTheDocument();
  });
});

describe('Korean campaign entry', () => {
  it('describes campaign files and saved runs in Korean, following a language switch', async () => {
    window.localStorage.setItem(presentationStorageKey, JSON.stringify({ language: 'ko' }));
    const user = userEvent.setup(),
      f = session();
    await f.store.getState().load();
    await f.store.getState().create();
    render(
      <FullCampaignEntry
        onBack={vi.fn()}
        factory={() => f.factory}
        loader={async () => ({ ok: true, registry: f.registry })}
        identity={() => 'fixture-run'}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: '전체 캠페인' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '캠페인 파일 열기' }));
    expect(await screen.findByRole('button', { name: '새 캠페인' })).toBeInTheDocument();
    const resume = await screen.findByRole('button', { name: '계속하기' });
    expect(resume).toHaveAccessibleDescription(/6막 — 인간 시스템 · 인시던트 0건 종료/);
    // Saved-run summaries are data, so they re-render in the newly chosen language.
    await user.selectOptions(screen.getByRole('combobox', { name: '언어' }), 'en');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAccessibleDescription(
      /Act 6 — HUMAN SYSTEM · 0 incidents closed/,
    );
  });
});

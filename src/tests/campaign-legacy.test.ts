import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  type CampaignRun,
  type CampaignOperation,
} from '../engine/campaign/transitions.ts';
import { replayCommands } from '../engine/simulation.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../persistence/campaign-ledger.ts';
import {
  previewLegacyDiscoveries,
  prepareLegacyAdoption,
  previewLegacyCheckpoint,
  prepareLegacyCheckpoint,
  prepareLegacyAssociation,
  resumeLegacyAssociation,
} from '../persistence/campaign-legacy.ts';
import { encodeSave, decodeSave } from '../persistence/save.ts';
import { inc001Scenario } from '../scenario/inc-001.ts';
import { getLegacyScenarioForMigration } from '../scenario/legacy-catalog.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import { getScenario } from '../scenario/index.ts';
import type { Scenario } from '../scenario/schema.ts';
import { campaignCatalog, campaignFixture, operation } from './fixtures/campaign.ts';

const definition = campaignFixture();
const old = getLegacyScenarioForMigration('INC-001', '1.0.0', inc001Scenario.contentVersion)!;
const catalog = new Map([
  ...campaignCatalog,
  [scenarioVersionKey(old.id, old.contentVersion), old],
]);
const recovery = ['OPEN_LOGS', 'INSPECT_DB', 'INSPECT_SESSIONS', 'TERMINATE_STALE_SESSIONS'];
function source(scenario: Scenario, actions: string[], seed = 1002) {
  const replay = replayCommands(
    scenario,
    { seed },
    actions.map((actionId) => ({ type: 'perform_action' as const, actionId })),
  );
  if (!replay.ok) throw new Error('fixture replay failed');
  return encodeSave(scenario, seed, replay.state);
}
function readers(incident: string | null, progress: string | null = null) {
  return {
    incident: { read: vi.fn(() => incident), write: vi.fn() },
    progress: { read: vi.fn(() => progress), write: vi.fn() },
  };
}
function prepared(prior: CampaignRun | null, op: CampaignOperation) {
  const result = prepareCampaignOperation(definition, catalog, prior, op);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.run;
}
const empty = prepared(null, operation(null, { kind: 'create' }));
function adoptionIdentity(run = empty) {
  const { sourceBytes: _bytes, ...identity } = operation(run, {
    kind: 'adopt',
    sourceBytes: [],
    confirmed: true,
  }) as Extract<CampaignOperation, { kind: 'adopt' }>;
  void _bytes;
  return identity;
}
function checkpointIdentity(run = empty) {
  const { sourceBytes: _bytes, ...identity } = operation(run, {
    kind: 'checkpoint',
    attemptId: 'restored',
    incidentId: 'stage-one',
    sourceBytes: '',
    confirmed: true,
  }) as Extract<CampaignOperation, { kind: 'checkpoint' }>;
  void _bytes;
  return identity;
}
function command(run: CampaignRun, actionId: string) {
  const attempt = run.attempts.find((item) => item.id === run.activeAttemptId)!;
  return prepared(
    run,
    operation(run, {
      kind: 'command',
      attemptId: attempt.id,
      inputId: 'input-' + run.revision,
      commandSequence: attempt.incident.replayLog.length,
      priorHead: campaignAttemptHead(attempt),
      command: { type: 'perform_action', actionId },
    }),
  );
}

describe('explicit source-authority legacy adoption and continuation', () => {
  it('previews and commits only original discoveries, preserving both byte strings and not granting past effects/history', async () => {
    const bytes = source(inc001Scenario, recovery);
    const progress = JSON.stringify(
      { schemaVersion: 1, incidentSaves: { 'INC-001': [bytes, bytes] } },
      null,
      2,
    );
    const stores = readers(bytes, progress);
    const preview = previewLegacyDiscoveries(stores, catalog);
    if (!preview.ok) throw new Error(preview.code);
    expect(preview.sources).toEqual({ incident: bytes, progress });
    expect(preview.sourceBytes).toEqual([bytes, bytes, bytes]);
    const result = prepareLegacyAdoption(
      definition,
      catalog,
      empty,
      preview,
      stores,
      adoptionIdentity(),
    );
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.run.projection).toEqual({
      ...empty.projection,
      evidence: ['artifact'],
      narratives: ['hint'],
    });
    expect(result.run.attempts).toEqual([]);
    expect(result.run.effectReceipts).toEqual([]);
    const factory = new IDBFactory();
    const authorities = {
      definitions: new Map([
        [campaignDefinitionKey(definition.id, definition.version), definition],
      ]),
      scenarios: catalog,
    };
    const ledger = createCampaignLedger(authorities, () => factory);
    await ledger.commit({
      runId: empty.runId,
      expectedRevision: null,
      operation: empty.operations[0],
      candidate: empty,
    });
    const request = {
      runId: empty.runId,
      expectedRevision: 0,
      operation: result.run.operations.at(-1),
      candidate: result.run,
    };
    expect(await ledger.commit(request)).toMatchObject({ ok: true, disposition: 'committed' });
    expect(await ledger.commit(request)).toMatchObject({
      ok: true,
      disposition: 'duplicate',
      run: result.run,
    });
    expect(await createCampaignLedger(authorities, () => factory).read(empty.runId)).toMatchObject({
      ok: true,
      run: result.run,
    });
    const repeated = prepareLegacyAdoption(
      definition,
      catalog,
      result.run,
      preview,
      stores,
      adoptionIdentity(result.run),
    );
    expect(repeated).toMatchObject({
      ok: true,
      run: { projection: result.run.projection, effectReceipts: [] },
    });
    expect(stores.incident.read()).toBe(bytes);
    expect(stores.progress.read()).toBe(progress);
    expect(stores.incident.write).not.toHaveBeenCalled();
    expect(stores.progress.write).not.toHaveBeenCalled();
  });
  it('verifies frozen source semantics without granting newer catalogue discoveries or rewriting a migratable save', () => {
    const legacy = getLegacyScenarioForMigration('INC-002', '1.0.0', '1.2.0')!;
    const current = getScenario('INC-002')!;
    const versions = new Map(catalog)
      .set(scenarioVersionKey(legacy.id, legacy.contentVersion), legacy)
      .set(scenarioVersionKey(current.id, current.contentVersion), current);
    const rules = campaignFixture();
    rules.incidents.push({
      id: 'stage-three',
      scenarioId: current.id,
      contentVersion: current.contentVersion,
      act: 1,
      eligibility: rules.incidents[0]!.eligibility,
    });
    rules.evidence.push({
      id: 'later-artifact',
      scenarioId: current.id,
      evidenceId: 'UNATTRIBUTED_DEPLOYMENT_NOTE',
    });
    rules.narratives.push({
      id: 'later-hint',
      scenarioId: current.id,
      narrativeId: 'UNKNOWN_DEPLOYMENT_NOTE',
    });
    const created = prepareCampaignOperation(
      rules,
      versions,
      null,
      operation(null, { kind: 'create' }),
    );
    if (!created.ok) throw new Error(JSON.stringify(created));
    const bytes = source(legacy, ['COMPARE_DEPLOYMENT']);
    expect(decodeSave(bytes, current)).toMatchObject({
      ok: true,
      value: { migratedFromContentVersion: '1.0.0' },
    });
    const stores = readers(bytes);
    const preview = previewLegacyDiscoveries(stores, versions);
    if (!preview.ok) throw new Error(preview.code);
    expect(preview.discoveries[0]).toMatchObject({
      contentVersion: '1.0.0',
      narrativeIds: [],
    });
    expect(preview.discoveries[0]!.evidenceIds).not.toContain('UNATTRIBUTED_DEPLOYMENT_NOTE');
    const result = prepareLegacyAdoption(
      rules,
      versions,
      created.run,
      preview,
      stores,
      adoptionIdentity(),
    );
    expect(result).toMatchObject({
      ok: true,
      run: { projection: created.run.projection, attempts: [], effectReceipts: [] },
    });
    expect(stores.incident.read()).toBe(bytes);
  });
  it('rejects one invalid archive entry atomically, mismatched keys, unknown versions, malformed wrappers and forged discoveries', () => {
    const bytes = source(inc001Scenario, recovery);
    const forged = JSON.parse(bytes);
    forged.incident.revealedEvidenceIds.push('invented');
    for (const progress of [
      JSON.stringify({ schemaVersion: 1, incidentSaves: { 'INC-001': [bytes, 'invalid'] } }),
      JSON.stringify({ schemaVersion: 1, incidentSaves: { wrong: [bytes] } }),
      JSON.stringify({ schemaVersion: 99, incidentSaves: { 'INC-001': [bytes] } }),
      JSON.stringify({ schemaVersion: 1, incidentSaves: { 'INC-001': [] } }),
      JSON.stringify({ schemaVersion: 1, incidentSaves: { 'INC-001': [JSON.stringify(forged)] } }),
      JSON.stringify({ schemaVersion: 1, incidentSaves: { 'INC-001': [bytes] }, extra: true }),
    ])
      expect(previewLegacyDiscoveries(readers(bytes, progress), catalog)).toMatchObject({
        ok: false,
      });
    expect(
      previewLegacyDiscoveries(readers(bytes.replace('1.1.0', '99.0.0')), catalog),
    ).toMatchObject({ ok: false });
    expect(previewLegacyDiscoveries(readers(null), catalog)).toMatchObject({ ok: false });
    expect(
      previewLegacyDiscoveries(
        {
          incident: {
            read: () => {
              throw new Error('denied');
            },
          },
          progress: { read: () => null },
        },
        catalog,
      ),
    ).toMatchObject({ code: 'LEGACY_STORAGE_ERROR' });
  });
  it('rechecks both source bytes and preview membership before confirmed adoption', () => {
    const bytes = source(inc001Scenario, recovery);
    const stores = readers(bytes);
    const preview = previewLegacyDiscoveries(stores, catalog);
    if (!preview.ok) throw new Error(preview.code);
    stores.incident.read.mockReturnValue(bytes + ' ');
    expect(
      prepareLegacyAdoption(definition, catalog, empty, preview, stores, adoptionIdentity()),
    ).toMatchObject({ code: 'LEGACY_SOURCE_CHANGED' });
    stores.incident.read.mockReturnValue(bytes);
    preview.discoveries[0]!.evidenceIds = [];
    expect(
      prepareLegacyAdoption(definition, catalog, empty, preview, stores, adoptionIdentity()),
    ).toMatchObject({ code: 'LEGACY_SOURCE_CHANGED' });
    expect(empty.operations).toHaveLength(1);
  });
  it('restores and reloads a confirmed baseline with pending work and RNG, without inherited contributions', async () => {
    const bytes = source(inc001Scenario, ['RESTART_API']);
    const stores = readers(bytes);
    const preview = previewLegacyCheckpoint(stores.incident, catalog);
    if (!preview.ok) throw new Error(preview.code);
    const result = prepareLegacyCheckpoint(
      definition,
      catalog,
      empty,
      preview,
      stores.incident,
      checkpointIdentity(),
    );
    if (!result.ok) throw new Error(JSON.stringify(result));
    const attempt = result.run.attempts[0]!;
    expect(attempt.incident).toEqual(JSON.parse(bytes).incident);
    expect(attempt.incident.scheduledWork.length).toBeGreaterThan(0);
    expect(attempt.baselineCommandCount).toBe(1);
    expect(attempt.acceptedInputIds).toEqual([]);
    expect(result.run.projection).toEqual(empty.projection);
    expect(result.run.effectReceipts).toEqual([]);
    const factory = new IDBFactory();
    const authorities = {
      definitions: new Map([
        [campaignDefinitionKey(definition.id, definition.version), definition],
      ]),
      scenarios: catalog,
    };
    const ledger = createCampaignLedger(authorities, () => factory);
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: null,
        operation: empty.operations[0],
        candidate: empty,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: 0,
        operation: result.run.operations.at(-1),
        candidate: result.run,
      }),
    ).toMatchObject({ ok: true });
    expect(await createCampaignLedger(authorities, () => factory).read(empty.runId)).toMatchObject({
      ok: true,
      run: result.run,
    });
    const continued = command(result.run, 'OPEN_LOGS');
    expect(
      await ledger.commit({
        runId: empty.runId,
        expectedRevision: result.run.revision,
        operation: continued.operations.at(-1),
        candidate: continued,
      }),
    ).toMatchObject({ ok: true });
    expect(continued.attempts[0]!.acceptedInputIds).toHaveLength(1);
    expect(continued.attempts[0]!.incident.replayLog).toHaveLength(2);
    expect(stores.incident.write).not.toHaveBeenCalled();
  });
  it('does not convert completed, unsupported or changed checkpoints into a new active attempt', () => {
    for (const bytes of [source(inc001Scenario, recovery), source(old, ['OPEN_LOGS'])]) {
      const stores = readers(bytes);
      const preview = previewLegacyCheckpoint(stores.incident, catalog);
      if (!preview.ok) throw new Error(preview.code);
      expect(
        prepareLegacyCheckpoint(
          definition,
          catalog,
          empty,
          preview,
          stores.incident,
          checkpointIdentity(),
        ),
      ).toMatchObject({ ok: false });
    }
    const stores = readers(source(inc001Scenario, ['OPEN_LOGS']));
    const preview = previewLegacyCheckpoint(stores.incident, catalog);
    if (!preview.ok) throw new Error(preview.code);
    stores.incident.read.mockReturnValue(source(inc001Scenario, ['OPEN_LOGS', 'OPEN_METRICS']));
    expect(
      prepareLegacyCheckpoint(
        definition,
        catalog,
        empty,
        preview,
        stores.incident,
        checkpointIdentity(),
      ),
    ).toMatchObject({ code: 'LEGACY_SOURCE_CHANGED' });
  });
  it('requires an explicit verified association and exact live head for read-only resume', async () => {
    const started = prepared(
      empty,
      operation(empty, { kind: 'start', attemptId: 'live', incidentId: 'stage-one', seed: 1002 }),
    );
    const live = command(started, 'OPEN_LOGS');
    const bytes = source(inc001Scenario, ['OPEN_LOGS']);
    const stores = readers(bytes);
    expect(
      resumeLegacyAssociation(definition, catalog, live, stores.incident, 'absent'),
    ).toMatchObject({ ok: false });
    const identity = {
      ...operation(live, { kind: 'create' }),
      kind: 'associate' as const,
      attemptId: 'live',
      priorHead: campaignAttemptHead(live.attempts[0]!),
    };
    const result = prepareLegacyAssociation(definition, catalog, live, stores.incident, identity);
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.run.projection).toEqual(live.projection);
    expect(result.run.attempts).toEqual(live.attempts);
    const factory = new IDBFactory();
    const ledger = createCampaignLedger(
      {
        definitions: new Map([
          [campaignDefinitionKey(definition.id, definition.version), definition],
        ]),
        scenarios: catalog,
      },
      () => factory,
    );
    let prior: CampaignRun | null = null;
    for (const op of result.run.operations) {
      const next = prepared(prior, op);
      expect(
        await ledger.commit({
          runId: next.runId,
          expectedRevision: prior?.revision ?? null,
          operation: op,
          candidate: next,
        }),
      ).toMatchObject({ ok: true });
      prior = next;
    }
    const reload = await ledger.read(live.runId);
    if (!reload.ok || !reload.run) throw new Error('reload failed');
    expect(
      resumeLegacyAssociation(
        definition,
        catalog,
        reload.run,
        stores.incident,
        identity.operationId,
      ),
    ).toEqual({ ok: true, attempt: live.attempts[0] });
    stores.incident.read.mockReturnValue(bytes + ' ');
    expect(
      resumeLegacyAssociation(
        definition,
        catalog,
        result.run,
        stores.incident,
        identity.operationId,
      ),
    ).toMatchObject({ ok: false });
    stores.incident.read.mockReturnValue(bytes);
    const newer = command(result.run, 'OPEN_METRICS');
    expect(
      resumeLegacyAssociation(definition, catalog, newer, stores.incident, identity.operationId),
    ).toMatchObject({ ok: false });
    const retry = prepared(
      result.run,
      operation(result.run, {
        kind: 'start',
        attemptId: 'retry',
        incidentId: 'stage-one',
        seed: 1002,
      }),
    );
    expect(
      resumeLegacyAssociation(definition, catalog, retry, stores.incident, identity.operationId),
    ).toMatchObject({ ok: false });
    expect(retry.attempts[0]).toEqual(live.attempts[0]);
    expect(stores.incident.write).not.toHaveBeenCalled();
  });
});

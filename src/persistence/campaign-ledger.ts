import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignOperationSchema,
  prepareCampaignOperation,
  replayCampaign,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import type { Scenario } from '../scenario/schema.ts';

export const CAMPAIGN_DATABASE = 'orpheus.campaign';
export const CAMPAIGN_DATABASE_VERSION = 1;
export const CAMPAIGN_RUN_STORE = 'runs';
export interface CampaignAuthorities {
  definitions: ReadonlyMap<string, CampaignDefinition>;
  scenarios: ReadonlyMap<string, Scenario>;
}
export const campaignDefinitionKey = (id: string, version: string): string =>
  JSON.stringify([id, version]);
export type LedgerFailure = { ok: false; code: string };
export type LedgerRead =
  LedgerFailure | { ok: true; disposition: 'found' | 'not_found'; run: CampaignRun | null };
export type LedgerCommit =
  LedgerFailure | { ok: true; disposition: 'committed' | 'duplicate'; run: CampaignRun };
export interface LedgerCommitRequest {
  runId: string;
  expectedRevision: number | null;
  operation: unknown;
  candidate: unknown;
}
const fail = (code: string): LedgerFailure => ({ ok: false, code });

// Replay is the record schema authority: equality rejects missing/extra fields,
// forged caches/receipts, unsupported versions and contradictory provenance.
export function verifyCampaignRecord(
  value: unknown,
  runId: string,
  authorities: CampaignAuthorities,
): LedgerFailure | { ok: true; run: CampaignRun; definition: CampaignDefinition } {
  try {
    canonicalJson(value);
    if (
      !value ||
      typeof value !== 'object' ||
      !('operations' in value) ||
      !Array.isArray(value.operations)
    )
      return fail('INVALID_LEDGER_RECORD');
    const creation = campaignOperationSchema.safeParse(value.operations[0]);
    if (!creation.success || creation.data.kind !== 'create' || creation.data.runId !== runId)
      return fail('INVALID_LEDGER_RECORD');
    const definition = authorities.definitions.get(
      campaignDefinitionKey(creation.data.definitionId, creation.data.definitionVersion),
    );
    if (
      !definition ||
      definition.id !== creation.data.definitionId ||
      definition.version !== creation.data.definitionVersion
    )
      return fail('UNSUPPORTED_DEFINITION');
    const replay = replayCampaign(definition, authorities.scenarios, value.operations);
    if (!replay.ok || canonicalJson(replay.run) !== canonicalJson(value))
      return fail('INVALID_LEDGER_RECORD');
    return { ok: true, run: replay.run, definition };
  } catch {
    return fail('INVALID_LEDGER_RECORD');
  }
}

function openDatabase(factory: IDBFactory): Promise<LedgerFailure | { ok: true; db: IDBDatabase }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: LedgerFailure | { ok: true; db: IDBDatabase }) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    try {
      const request = factory.open(CAMPAIGN_DATABASE, CAMPAIGN_DATABASE_VERSION);
      request.onblocked = () => finish(fail('DATABASE_BLOCKED'));
      request.onerror = () =>
        finish(
          fail(
            request.error?.name === 'VersionError'
              ? 'UNSUPPORTED_DATABASE_VERSION'
              : 'DATABASE_OPEN_FAILED',
          ),
        );
      request.onupgradeneeded = (event) => {
        if (settled || event.oldVersion !== 0) {
          request.transaction?.abort();
          return;
        }
        request.result.createObjectStore(CAMPAIGN_RUN_STORE, { keyPath: 'runId' });
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        try {
          if (
            db.version !== 1 ||
            db.objectStoreNames.length !== 1 ||
            !db.objectStoreNames.contains(CAMPAIGN_RUN_STORE)
          )
            throw new Error('layout');
          const tx = db.transaction(CAMPAIGN_RUN_STORE, 'readonly');
          const store = tx.objectStore(CAMPAIGN_RUN_STORE);
          if (store.keyPath !== 'runId' || store.autoIncrement || store.indexNames.length)
            throw new Error('layout');
          db.onversionchange = () => db.close();
          finish({ ok: true, db });
        } catch {
          db.close();
          finish(fail('UNSUPPORTED_DATABASE_LAYOUT'));
        }
      };
    } catch {
      finish(fail('DATABASE_OPEN_FAILED'));
    }
  });
}

// The adapter is inert until called and has no legacy-store writes or fallback.
export function createCampaignLedger(
  authorities: CampaignAuthorities,
  getFactory: () => IDBFactory | undefined = () => globalThis.indexedDB,
) {
  async function open() {
    try {
      const factory = getFactory();
      return factory ? openDatabase(factory) : fail('INDEXEDDB_UNAVAILABLE');
    } catch {
      return fail('INDEXEDDB_UNAVAILABLE');
    }
  }
  return {
    // Only explicit opt-in callers discover keys. Selection still requires read()
    // and complete replay validation; enumeration does not create or repair runs.
    async listRunIds(): Promise<LedgerFailure | { ok: true; runIds: string[] }> {
      const opened = await open();
      if (!opened.ok) return opened;
      return new Promise((resolve) => {
        const db = opened.db;
        try {
          const tx = db.transaction(CAMPAIGN_RUN_STORE, 'readonly');
          let outcome: LedgerFailure | { ok: true; runIds: string[] } = fail('STORAGE_ERROR');
          tx.oncomplete = () => {
            db.close();
            resolve(outcome);
          };
          tx.onabort = () => {
            db.close();
            resolve(fail('TRANSACTION_ABORTED'));
          };
          const request = tx.objectStore(CAMPAIGN_RUN_STORE).getAllKeys();
          request.onsuccess = () => {
            const keys = request.result;
            outcome = keys.every((k) => typeof k === 'string' && k.length > 0)
              ? { ok: true, runIds: (keys as string[]).sort() }
              : fail('INVALID_RUN_ID');
          };
        } catch {
          db.close();
          resolve(fail('STORAGE_ERROR'));
        }
      });
    },
    async read(runId: string): Promise<LedgerRead> {
      if (typeof runId !== 'string' || !runId.length) return fail('INVALID_RUN_ID');
      const opened = await open();
      if (!opened.ok) return opened;
      return new Promise((resolve) => {
        const db = opened.db;
        try {
          const tx = db.transaction(CAMPAIGN_RUN_STORE, 'readonly');
          let outcome: LedgerRead = fail('STORAGE_ERROR');
          tx.oncomplete = () => {
            db.close();
            resolve(outcome);
          };
          tx.onabort = () => {
            db.close();
            resolve(fail('TRANSACTION_ABORTED'));
          };
          const request = tx.objectStore(CAMPAIGN_RUN_STORE).get(runId);
          request.onsuccess = () => {
            if (request.result === undefined)
              outcome = { ok: true, disposition: 'not_found', run: null };
            else {
              const verified = verifyCampaignRecord(request.result, runId, authorities);
              outcome = verified.ok
                ? { ok: true, disposition: 'found', run: verified.run }
                : verified;
            }
          };
        } catch {
          db.close();
          resolve(fail('STORAGE_ERROR'));
        }
      });
    },
    async commit(input: LedgerCommitRequest): Promise<LedgerCommit> {
      // Snapshot caller-owned data before awaiting a DB open, not after it.
      let snapshot: LedgerCommitRequest;
      try {
        snapshot = JSON.parse(canonicalJson(input)) as LedgerCommitRequest;
      } catch {
        return fail('INVALID_COMMIT_REQUEST');
      }
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
        return fail('INVALID_COMMIT_REQUEST');
      const { runId, expectedRevision, operation, candidate } = snapshot;
      if (Object.keys(snapshot).sort().join(',') !== 'candidate,expectedRevision,operation,runId')
        return fail('INVALID_COMMIT_REQUEST');
      if (
        typeof runId !== 'string' ||
        !runId.length ||
        (expectedRevision !== null &&
          (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0))
      )
        return fail('INVALID_COMMIT_REQUEST');
      const parsed = campaignOperationSchema.safeParse(operation);
      if (!parsed.success || parsed.data.runId !== runId) return fail('INVALID_OPERATION');
      const candidateRecord = verifyCampaignRecord(candidate, runId, authorities);
      if (!candidateRecord.ok) return candidateRecord;
      if (canonicalJson(candidateRecord.run.operations.at(-1)) !== canonicalJson(parsed.data))
        return fail('INVALID_CANDIDATE');
      const opened = await open();
      if (!opened.ok) return opened;
      return new Promise((resolve) => {
        const db = opened.db;
        let tx: IDBTransaction | undefined;
        let outcome: LedgerCommit = fail('STORAGE_ERROR');
        let rejection: LedgerFailure | undefined;
        try {
          tx = db.transaction(CAMPAIGN_RUN_STORE, 'readwrite');
          tx.oncomplete = () => {
            db.close();
            resolve(outcome);
          };
          tx.onabort = () => {
            db.close();
            resolve(rejection ?? fail('TRANSACTION_ABORTED'));
          };
          const store = tx.objectStore(CAMPAIGN_RUN_STORE);
          const request = store.get(runId);
          const reject = (result: LedgerFailure) => {
            rejection = result;
            tx!.abort();
          };
          request.onsuccess = () => {
            try {
              let prior: CampaignRun | null = null;
              if (request.result !== undefined) {
                const verified = verifyCampaignRecord(request.result, runId, authorities);
                if (!verified.ok) {
                  reject(verified);
                  return;
                }
                prior = verified.run;
              }
              // Reconcile stable delivery before revision checks (lost acknowledgement).
              const existing = prior?.operations.find(
                (op) => op.operationId === parsed.data.operationId,
              );
              if (existing) {
                if (canonicalJson(existing) !== canonicalJson(parsed.data)) {
                  reject(fail('CONFLICTING_OPERATION'));
                  return;
                }
                // Candidate must be the original committed prefix, not divergent history.
                const prefix = replayCampaign(
                  candidateRecord.definition,
                  authorities.scenarios,
                  prior!.operations.slice(0, existing.sequence + 1),
                );
                if (
                  !prefix.ok ||
                  canonicalJson(prefix.run) !== canonicalJson(candidateRecord.run)
                ) {
                  reject(fail('INVALID_CANDIDATE'));
                  return;
                }
                outcome = { ok: true, disposition: 'duplicate', run: prior! };
                return;
              }
              if ((prior?.revision ?? null) !== expectedRevision) {
                reject(fail('REVISION_CONFLICT'));
                return;
              }
              const prepared = prepareCampaignOperation(
                candidateRecord.definition,
                authorities.scenarios,
                prior,
                parsed.data,
              );
              if (
                !prepared.ok ||
                canonicalJson(prepared.run) !== canonicalJson(candidateRecord.run)
              ) {
                reject(fail('INVALID_CANDIDATE'));
                return;
              }
              // No await or unrelated I/O inside the live transaction.
              store.put(prepared.run);
              outcome = { ok: true, disposition: 'committed', run: prepared.run };
            } catch {
              reject(fail('STORAGE_ERROR'));
            }
          };
        } catch {
          if (tx) {
            rejection = fail('STORAGE_ERROR');
            try {
              tx.abort();
            } catch {
              db.close();
              resolve(rejection);
            }
          } else {
            db.close();
            resolve(fail('STORAGE_ERROR'));
          }
        }
      });
    },
  };
}

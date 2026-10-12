import { createStore, type StoreApi } from 'zustand/vanilla';
import { canonicalJson } from '../engine/campaign/canonical.ts';
import {
  campaignAttemptHead,
  prepareCampaignOperation,
  getCampaignProgression,
  getCampaignBranches,
  getCampaignActionAvailability,
  type CampaignOperation,
  type CampaignRun,
} from '../engine/campaign/transitions.ts';
import { resolveCampaignEnding, type EndingResult } from '../engine/campaign/endings.ts';
import { getCampaignPresentation } from '../engine/campaign/opportunities.ts';
import { scenarioVersionKey } from '../scenario/catalog.ts';
import type { CampaignDefinition } from '../scenario/campaign.ts';
import type { Scenario } from '../scenario/schema.ts';
import {
  verifyCampaignRecord,
  campaignDefinitionKey,
  type createCampaignLedger,
  type LedgerCommitRequest,
} from '../persistence/campaign-ledger.ts';

type Ledger = Pick<ReturnType<typeof createCampaignLedger>, 'read' | 'commit'>;
type Payload<T = CampaignOperation> = T extends CampaignOperation
  ? Omit<
      T,
      | 'operationId'
      | 'runId'
      | 'sequence'
      | 'definitionId'
      | 'definitionVersion'
      | 'replayVersion'
      | 'canonicalVersion'
    >
  : never;
export interface CampaignView {
  presentations: NonNullable<
    Extract<ReturnType<typeof getCampaignPresentation>, { ok: true }>['presentation']
  >[];
  presentationDiagnostics: string[];
  progress: ReturnType<typeof getCampaignProgression>;
  branches: ReturnType<typeof getCampaignBranches> | null;
  availableActions: { id: string; title: string; durationSeconds: number }[];
  actionDiagnostics: string[];
  availableOpportunityRuleIds: string[];
  evidence: { id: string; title: string; description: string }[];
}
export interface CampaignSessionState {
  readonly run: CampaignRun | null;
  readonly view: CampaignView | null;
  readonly readState: 'unread' | 'not_found' | 'found';
  readonly busy: boolean;
  readonly error: string | null;
  readonly pendingOperationId: string | null;
  readonly selectedPreparationId: string | null;
  readonly selectPresentation: (preparationId: string) => boolean;
  readonly load: () => Promise<boolean>;
  readonly create: () => Promise<boolean>;
  readonly start: (incidentId: string, seed: number) => Promise<boolean>;
  readonly checkpoint: (
    incidentId: string,
    sourceBytes: string,
    confirmed: true,
  ) => Promise<boolean>;
  readonly adopt: (sourceBytes: string[], confirmed: true) => Promise<boolean>;
  readonly performAction: (actionId: string) => Promise<boolean>;
  readonly preparePresentation: (ruleId: string) => Promise<boolean>;
  readonly acknowledgeVisiblePresentation: (
    preparationId: string,
    surfaceId: string,
  ) => Promise<boolean>;
  readonly retryPending: () => Promise<boolean>;
  readonly ending: (attemptId: string) => EndingResult | null;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// Opt-in authority/ledger injection only. No import opens IndexedDB, no old slot
// is used, and this adapter never chooses a production campaign definition.
export function createCampaignSessionStore(options: {
  definition: CampaignDefinition;
  catalog: ReadonlyMap<string, Scenario>;
  runId: string;
  ledger: Ledger;
  identity?: () => string;
}): StoreApi<CampaignSessionState> {
  const d = freeze(JSON.parse(canonicalJson(options.definition)) as CampaignDefinition);
  const catalog = new Map(
    [...options.catalog].map(([key, value]) => [key, freeze(structuredClone(value))]),
  );
  const authorities = {
    definitions: new Map([[campaignDefinitionKey(d.id, d.version), d]]),
    scenarios: catalog,
  };
  const identity = options.identity ?? (() => crypto.randomUUID());
  let pending: LedgerCommitRequest | null = null;
  let knownConflict = false;
  function operation(
    run: CampaignRun | null,
    payload: Payload,
    operationId = identity(),
  ): CampaignOperation {
    return {
      operationId,
      runId: options.runId,
      sequence: run ? run.revision + 1 : 0,
      definitionId: d.id,
      definitionVersion: d.version,
      replayVersion: d.replayVersion,
      canonicalVersion: 1,
      ...payload,
    } as CampaignOperation;
  }
  function view(run: CampaignRun): CampaignView {
    const a = run.attempts.find((t) => t.id === run.activeAttemptId);
    const scenario =
      a && catalog.get(scenarioVersionKey(a.incident.scenarioId, a.incident.contentVersion));
    const actionAvailability = getCampaignActionAvailability(d, catalog, run);
    const availableActions =
      a && scenario && !a.incident.completionReached
        ? (actionAvailability.ok ? actionAvailability.actionIds : []).map((id) => {
            const action = scenario.actions.find((t) => t.id === id)!;
            return { id, title: action.title, durationSeconds: action.durationSeconds };
          })
        : [];
    const availableOpportunityRuleIds =
      a && !a.incident.completionReached
        ? (d.opportunities?.rules ?? [])
            .filter((rule) => {
              // Pure preparation previews validate all authored/model gates; they are
              // discarded. A preview is never committed exposure or a behavior sample.
              const preview = prepareCampaignOperation(
                d,
                catalog,
                run,
                operation(
                  run,
                  {
                    kind: 'prepare_opportunity',
                    attemptId: a.id,
                    priorHead: campaignAttemptHead(a),
                    preparationId: 'preview-' + rule.id,
                    ruleId: rule.id,
                  },
                  'preview-' + rule.id,
                ),
              );
              return (
                preview.ok ||
                preview.diagnostics.some((d) => d.code === 'DUPLICATE_PRESENTATION_BOUNDARY')
              );
            })
            .map((rule) => rule.id)
        : [];
    const evidence = run.projection.evidence.flatMap((id) => {
      const entry = d.evidence.find((e) => e.id === id)!;
      const binding = d.incidents.find((i) => i.scenarioId === entry.scenarioId)!;
      const content = catalog
        .get(scenarioVersionKey(entry.scenarioId, binding.contentVersion))
        ?.evidence.find((e) => e.id === entry.evidenceId);
      return content ? [{ id, title: content.title, description: content.description }] : [];
    });
    const checkedPresentations = (run.opportunities?.preparations ?? [])
      .filter(
        (p) =>
          p.attemptId === run.activeAttemptId &&
          !run.opportunities!.responses.some((r) => r.preparationId === p.id),
      )
      .map((p) => getCampaignPresentation(d, catalog, run, p.id));
    return freeze({
      presentations: checkedPresentations.flatMap((p) =>
        p.ok && p.presentation ? [p.presentation] : [],
      ),
      presentationDiagnostics: checkedPresentations.flatMap((p) =>
        p.ok ? [] : p.diagnostics.map((d) => d.code),
      ),
      progress: getCampaignProgression(d, catalog, run),
      branches: d.branches ? getCampaignBranches(d, catalog, run) : null,
      availableActions,
      actionDiagnostics: actionAvailability.diagnostics.map((d) => d.code),
      availableOpportunityRuleIds,
      evidence,
    });
  }
  function publish(run: CampaignRun) {
    const verified = verifyCampaignRecord(run, options.runId, authorities);
    if (!verified.ok) throw new Error(verified.code);
    const owned = freeze(verified.run);
    store.setState({ run: owned, view: view(owned), readState: 'found' });
  }
  async function commitPending(): Promise<boolean> {
    if (!pending || store.getState().busy) return false;
    knownConflict = false;
    store.setState({ busy: true, error: null });
    try {
      // Retry the exact operation/candidate after a lost caller ACK. Never
      // create a new input or optimistically publish a successful request.put.
      const result = await options.ledger.commit(pending);
      if (!result.ok) {
        knownConflict =
          result.code === 'REVISION_CONFLICT' || result.code === 'CONFLICTING_OPERATION';
        store.setState({ error: result.code });
        return false;
      }
      const submitted = pending.operation as CampaignOperation;
      const recorded = result.run.operations.find((o) => o.operationId === submitted.operationId);
      if (!recorded || canonicalJson(recorded) !== canonicalJson(submitted))
        throw new Error('COMMIT_IDENTITY_MISMATCH');
      publish(result.run);
      if (submitted.kind === 'prepare_opportunity')
        store.setState({ selectedPreparationId: submitted.preparationId });
      pending = null;
      knownConflict = false;
      store.setState({ pendingOperationId: null });
      return true;
    } catch {
      store.setState({ error: 'COMMIT_ACK_UNKNOWN' });
      return false;
    } finally {
      store.setState({ busy: false });
    }
  }
  async function submit(payload: Payload): Promise<boolean> {
    if (store.getState().busy || pending) return false;
    const run = store.getState().run;
    if (store.getState().readState === 'unread') {
      store.setState({ error: 'READ_REQUIRED' });
      return false;
    }
    let op: CampaignOperation;
    try {
      op = operation(run, payload);
    } catch {
      store.setState({ error: 'IDENTITY_UNAVAILABLE' });
      return false;
    }
    const result = prepareCampaignOperation(d, catalog, run, op);
    if (!result.ok) {
      store.setState({ error: result.diagnostics.map((x) => x.code).join(', ') });
      return false;
    }
    pending = freeze({
      runId: options.runId,
      expectedRevision: run?.revision ?? null,
      operation: op,
      candidate: result.run,
    });
    store.setState({ pendingOperationId: op.operationId });
    return commitPending();
  }
  function active() {
    const r = store.getState().run;
    return r?.attempts.find((a) => a.id === r.activeAttemptId);
  }
  async function generated(payload: () => Payload): Promise<boolean> {
    if (store.getState().busy || pending) return false;
    try {
      return await submit(payload());
    } catch {
      store.setState({ error: 'IDENTITY_UNAVAILABLE' });
      return false;
    }
  }
  const store: StoreApi<CampaignSessionState> = createStore<CampaignSessionState>(() => ({
    run: null,
    view: null,
    readState: 'unread',
    busy: false,
    error: null,
    pendingOperationId: null,
    selectedPreparationId: null,
    selectPresentation(preparationId) {
      if (!store.getState().view?.presentations.some((p) => p.id === preparationId)) return false;
      store.setState({ selectedPreparationId: preparationId });
      return true;
    },
    async load() {
      if (store.getState().busy || (pending && !knownConflict)) return false;
      store.setState({ busy: true, error: null });
      try {
        const result = await options.ledger.read(options.runId);
        if (!result.ok) {
          store.setState({ error: result.code });
          return false;
        }
        if (result.run) {
          publish(result.run);
          if (knownConflict) {
            pending = null;
            knownConflict = false;
            store.setState({ pendingOperationId: null });
          }
        } else store.setState({ run: null, view: null, readState: 'not_found' });
        return true;
      } catch {
        store.setState({ error: 'READ_FAILED' });
        return false;
      } finally {
        store.setState({ busy: false });
      }
    },
    create: () =>
      store.getState().readState === 'not_found'
        ? submit({ kind: 'create' })
        : Promise.resolve(false),
    start: (incidentId, seed) =>
      generated(() => ({ kind: 'start', incidentId, seed, attemptId: identity() })),
    checkpoint: (incidentId, sourceBytes, confirmed) =>
      generated(() => ({
        kind: 'checkpoint',
        incidentId,
        sourceBytes,
        confirmed,
        attemptId: identity(),
      })),
    adopt: (sourceBytes, confirmed) => submit({ kind: 'adopt', sourceBytes, confirmed }),
    performAction(actionId) {
      const a = active();
      return a
        ? generated(() => ({
            kind: 'command',
            attemptId: a.id,
            inputId: identity(),
            commandSequence: a.incident.replayLog.length,
            priorHead: campaignAttemptHead(a),
            command: { type: 'perform_action', actionId },
          }))
        : Promise.resolve(false);
    },
    preparePresentation(ruleId) {
      const a = active();
      const r = store.getState().run;
      const existing =
        a &&
        r?.opportunities?.preparations.find(
          (p) =>
            p.ruleId === ruleId && p.attemptId === a.id && p.priorHead === campaignAttemptHead(a),
        );
      if (existing) return Promise.resolve(store.getState().selectPresentation(existing.id));
      return a
        ? generated(() => ({
            kind: 'prepare_opportunity',
            attemptId: a.id,
            priorHead: campaignAttemptHead(a),
            preparationId: identity(),
            ruleId,
          }))
        : Promise.resolve(false);
    },
    acknowledgeVisiblePresentation(preparationId, surfaceId) {
      const r = store.getState().run;
      if (r?.opportunities?.acknowledgements.some((a) => a.preparationId === preparationId))
        return Promise.resolve(true);
      const a = active();
      return a
        ? submit({
            kind: 'acknowledge_presentation',
            attemptId: a.id,
            priorHead: campaignAttemptHead(a),
            preparationId,
            surfaceId,
          })
        : Promise.resolve(false);
    },
    retryPending: commitPending,
    ending(attemptId) {
      const run = store.getState().run;
      const a = run?.attempts.find((t) => t.id === attemptId);
      return run && a && d.endings
        ? resolveCampaignEnding(d, catalog, run, { attemptId, priorHead: campaignAttemptHead(a) })
        : null;
    },
  }));
  return store;
}

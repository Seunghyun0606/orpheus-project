import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { inspectProductionCampaignSources } from '../src/scenario/production-catalog.ts';
import { canonicalJson } from '../src/engine/campaign/canonical.ts';
import {
  prepareCampaignOperation,
  campaignAttemptHead,
  replayCampaign,
} from '../src/engine/campaign/transitions.ts';
import { createCampaignLedger, campaignDefinitionKey } from '../src/persistence/campaign-ledger.ts';
import { createCampaignSessionStore } from '../src/store/campaign-session.ts';
import { IDBFactory } from 'fake-indexeddb';
import {
  sourceInventory,
  workspace,
  sha256,
  hashFile,
  qualify,
  percentile95,
} from './task034-support.mjs';
import { rootCauseResolutionReplay } from '../src/tests/fixtures/inc-001-replays.ts';
import { keysetUpdateReplay } from '../src/tests/fixtures/inc-002-replays.ts';
import { quarantineReplay } from '../src/tests/fixtures/inc-003-replays.ts';

// Node development measurements only. No browser/user DB, ACK fabrication,
// native launcher, disk output, network, unverified projection or clock override.
const read = (file) => parse(readFileSync(path.join(workspace, file), 'utf8'));
const report = {
  task: 'TASK-034',
  platform: 'node_fake_indexeddb_development_only',
  nativeCertified: false,
  status: 'incomplete',
  measurements: [],
  datasets: [],
  pending: [
    'package_admission_cold',
    'archive_native',
    'application_cold',
    'native_memory',
    'native_storage',
  ],
  provenance: {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(),
    worktree: execFileSync('git', ['status', '--short'], {
      cwd: workspace,
      encoding: 'utf8',
    }).trim(),
    node: process.version,
    npmLock: hashFile('package-lock.json'),
    cargoLock: hashFile('src-tauri/Cargo.lock'),
    host: {
      platform: os.platform(),
      architecture: os.arch(),
      release: os.release(),
      logicalCores: os.cpus().length,
      cpu: os.cpus()[0]?.model,
      physicalMemoryBytes: os.totalmem(),
    },
    harness: Object.fromEntries(
      [
        'scripts/benchmark-task034.mjs',
        'scripts/task034-support.mjs',
        'src/tests/fixtures/early-campaign-replays.yaml',
        'src/tests/fixtures/mid-campaign-replays.yaml',
        'src/tests/fixtures/board-campaign-replays.yaml',
        'src/tests/fixtures/observer-campaign-replays.yaml',
        'src/tests/fixtures/crisis-preparation-replays.yaml',
        'src/tests/fixtures/inc-001-replays.ts',
        'src/tests/fixtures/inc-002-replays.ts',
        'src/tests/fixtures/inc-003-replays.ts',
      ].map((file) => [file, hashFile(file)]),
    ),
  },
};
// Generated measurement artifacts, not editable authority/user-save files.
// Fresh directory and exclusive writes preserve every earlier result.
const evidence = path.join(workspace, '.qa/task034/evidence', randomUUID());
mkdirSync(evidence, { recursive: true });
function snapshot() {
  const file = path.join(
    evidence,
    `checkpoint-${report.measurements.length}-${report.datasets.length}-${report.status}.json`,
  );
  try {
    writeFileSync(file, JSON.stringify(report, null, 2), { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
const progress = (message) => console.log(JSON.stringify({ progress: message }));
function checked(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics ?? result.code));
  return result.run;
}
async function measure(id, limit, work) {
  const warmups = [],
    samples = [];
  for (let i = 0; i < 22; i++) {
    const t = performance.now();
    await work();
    const elapsed = performance.now() - t;
    (i < 2 ? warmups : samples).push(elapsed);
    if (i % 5 === 0) progress(`${id} trial ${i + 1}/22`);
  }
  const p95 = percentile95(samples);
  report.measurements.push({
    id,
    limitMs: limit,
    warmupsMs: warmups,
    samplesMs: samples,
    p95Ms: p95,
    developmentBudgetComparison: p95 <= limit ? 'within' : 'exceeded',
    nativeBudgetStatus: 'not_measured',
  });
  snapshot();
  progress(`${id} p95=${p95.toFixed(3)}ms development-only, native not measured`);
}
function createBuilder(p, id) {
  let run = null;
  const submit = (payload) => {
    const sequence = run ? run.revision + 1 : 0;
    run = checked(
      prepareCampaignOperation(p.definition, p.catalog, run, {
        operationId: `${id}-op-${sequence}`,
        runId: id,
        sequence,
        definitionId: p.definition.id,
        definitionVersion: p.definition.version,
        replayVersion: 2,
        canonicalVersion: 1,
        ...payload,
      }),
    );
    return run;
  };
  const start = (incidentId) =>
    submit({
      kind: 'start',
      incidentId,
      seed: 4172,
      attemptId: `${id}-attempt-${run.revision + 1}`,
    });
  const act = (actionId) => {
    const a = run.attempts.find((a) => a.id === run.activeAttemptId);
    return submit({
      kind: 'command',
      attemptId: a.id,
      inputId: `${id}-input-${run.revision + 1}`,
      commandSequence: a.incident.replayLog.length,
      priorHead: campaignAttemptHead(a),
      command: { type: 'perform_action', actionId },
    });
  };
  submit({ kind: 'create' });
  return { start, act, current: () => run };
}
function routes() {
  const result = new Map([
    ['INC-001', rootCauseResolutionReplay.commands.map((c) => c.actionId)],
    ['INC-002', keysetUpdateReplay.commands.map((c) => c.actionId)],
    ['INC-003', quarantineReplay.commands.map((c) => c.actionId)],
    [
      'INC-026',
      ['ASSESS_FINAL_SERVICE_STATE', 'ASSESS_FINAL_AUTHORITY_STATE', 'RESTORE_CORE_CONTINUITY'],
    ],
  ]);
  for (const file of [
    'early-campaign-replays.yaml',
    'mid-campaign-replays.yaml',
    'board-campaign-replays.yaml',
    'observer-campaign-replays.yaml',
  ])
    for (const item of read(`src/tests/fixtures/${file}`).cases)
      result.set(item.scenarioId, item.recovery ?? item.investigationRecovery);
  const crisis = read('src/tests/fixtures/crisis-preparation-replays.yaml');
  result.set(crisis.scenarioId, crisis.recovery);
  return result;
}
async function seedLedger(p, run) {
  const factory = new IDBFactory();
  const ledger = createCampaignLedger(
    {
      definitions: new Map([
        [campaignDefinitionKey(p.definition.id, p.definition.version), p.definition],
      ]),
      scenarios: p.catalog,
    },
    () => factory,
  );
  let prior = null;
  for (const operation of run.operations) {
    const candidate = checked(prepareCampaignOperation(p.definition, p.catalog, prior, operation));
    checked(
      await ledger.commit({
        runId: run.runId,
        expectedRevision: prior?.revision ?? null,
        operation,
        candidate,
      }),
    );
    prior = candidate;
    if (operation.sequence % 100 === 0)
      progress(`seed ${run.runId} ${operation.sequence}/${run.revision}`);
  }
  let identity = 0;
  const store = createCampaignSessionStore({
    definition: p.definition,
    catalog: p.catalog,
    ledger,
    runId: run.runId,
    identity: () => `${run.runId}-measured-${identity++}`,
  });
  if (!(await store.getState().load())) throw new Error(store.getState().error);
  return { ledger, store };
}
try {
  const sources = sourceInventory();
  report.provenance.sources = Object.fromEntries(
    Object.entries(sources).map(([file, bytes]) => [file, sha256(bytes)]),
  );
  const admission = inspectProductionCampaignSources(
    sources,
    read('src/scenario/data/full-campaign-manifest.yaml'),
  );
  if (!admission.ok) throw new Error(admission.diagnostics.join(','));
  const p = admission.registry.resolve('orpheus-full-campaign', '1.0.0');
  if (!p) throw new Error('EXACT_PACKAGE_UNAVAILABLE');
  const plan = routes(),
    builder = createBuilder(p, 'task034-development');
  for (const incident of p.definition.incidents) {
    builder.start(incident.id);
    const route = plan.get(incident.id);
    if (!route?.length) throw new Error(`MISSING_ROUTE:${incident.id}`);
    for (const action of route) builder.act(action);
    const attempt = builder.current().attempts.at(-1);
    if (!attempt.incident.completionReached) throw new Error(`INCOMPLETE_ROUTE:${incident.id}`);
    progress(`ordinary completed ${incident.id}`);
  }
  const ordinary = builder.current();
  report.datasets.push({
    id: 'ordinary',
    ...qualify(ordinary),
    sha256: sha256(canonicalJson(ordinary)),
    operations: ordinary.operations,
  });
  snapshot();
  await measure('replay_ordinary', 5000, () =>
    checked(replayCampaign(p.definition, p.catalog, ordinary.operations)),
  );
  // New in-progress retry for valid commit warmups/trials; ordinary final context
  // stays immutable. No baseline rollback, inherited completion or synthetic ACK.
  const ordinaryPort = await seedLedger(p, ordinary);
  if (!(await ordinaryPort.store.getState().start('INC-001', 4172)))
    throw new Error(ordinaryPort.store.getState().error);
  const ordinaryStart = ordinaryPort.store.getState().run.revision;
  await measure('commit_ordinary', 500, async () => {
    if (!(await ordinaryPort.store.getState().performAction('OPEN_METRICS')))
      throw new Error(ordinaryPort.store.getState().error);
  });
  report.measurements.at(-1).boundaries = {
    initialRevision: ordinaryStart,
    finalRevision: ordinaryPort.store.getState().run.revision,
  };
  for (let cycle = 0; cycle < 3; cycle++)
    for (const incident of p.definition.incidents) {
      builder.start(incident.id);
      const inspect = incident.id === 'INC-026' ? 'ASSESS_FINAL_SERVICE_STATE' : 'OPEN_METRICS';
      for (let repeat = 0; repeat < 9; repeat++) builder.act(inspect);
      for (const action of plan.get(incident.id)) builder.act(action);
      if (!builder.current().attempts.at(-1).incident.completionReached)
        throw new Error(`INCOMPLETE_RETRY:${incident.id}`);
      progress(`long completed cycle ${cycle + 1} ${incident.id}`);
    }
  const long = builder.current();
  report.datasets.push({
    id: 'long',
    ...qualify(long, true),
    sha256: sha256(canonicalJson(long)),
    operations: long.operations,
  });
  snapshot();
  await measure('replay_long', 15000, () =>
    checked(replayCampaign(p.definition, p.catalog, long.operations)),
  );
  const longPort = await seedLedger(p, long);
  await measure('load_long', 20000, async () => {
    if (!(await longPort.store.getState().load())) throw new Error(longPort.store.getState().error);
  });
  if (!(await longPort.store.getState().start('INC-001', 4172)))
    throw new Error(longPort.store.getState().error);
  const initialRevision = longPort.store.getState().run.revision;
  await measure('commit_long', 2500, async () => {
    if (!(await longPort.store.getState().performAction('OPEN_METRICS')))
      throw new Error(longPort.store.getState().error);
  });
  report.measurements.at(-1).boundaries = {
    initialRevision,
    finalRevision: longPort.store.getState().run.revision,
  };
  report.status = 'development_measurements_only_native_pending';
} catch (error) {
  report.status = 'blocked_or_failed_no_substitute_dataset';
  report.error = String(error);
  process.exitCode = 1;
} finally {
  snapshot();
  console.log('TASK034_REPORT_BEGIN');
  console.log(
    JSON.stringify({
      ...report,
      evidenceDirectory: path.relative(workspace, evidence),
      datasets: report.datasets.map(({ operations, ...metadata }) => ({
        ...metadata,
        operationsRetained: operations.length,
      })),
    }),
  );
  console.log('TASK034_REPORT_END');
}

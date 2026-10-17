import path from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  CLI_VERSION,
  CLI_BINARY,
  NSIS_SOURCE,
  NSIS_DOWNLOADS,
  REQUIRED_NSIS_FILES,
  TOOL_MANIFEST,
  PINNED_TOOL_MANIFEST_SHA256,
} from './nsis-inventory.mjs';
export const workspace = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const hashFile = (file) => sha256(readFileSync(path.join(workspace, file)));
export function percentile95(samples) {
  if (!samples.length || samples.some((n) => !Number.isFinite(n) || n < 0))
    throw new Error('INVALID_TIMING_SAMPLES');
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1];
}
export function qualify(run, long = false) {
  const completed = new Set(
    run.attempts
      .filter(
        (a) =>
          a.incident.completionReached &&
          a.incident.eventLog
            .slice(a.baselineEventCount)
            .some((e) => e.type === 'completion_reached'),
      )
      .map((a) => a.incident.scenarioId),
  );
  const commands = run.operations.filter(
    (o) => o.kind === 'command' && o.command.type === 'perform_action',
  ).length;
  if (completed.size !== 26 || (long && (run.attempts.length < 104 || commands < 1000)))
    throw new Error('NONQUALIFYING_DATASET');
  return {
    attempts: run.attempts.length,
    acceptedCommands: commands,
    completedIncidents: [...completed].sort(),
  };
}
export function sourceInventory() {
  const sources = {};
  for (const folder of [
    'incidents',
    'presentations',
    'definitions',
    'packages',
    'ending-presentations',
  ]) {
    const dir = `src/scenario/data/full-campaign/${folder}`;
    for (const name of readdirSync(path.join(workspace, dir)).sort()) {
      if (!/\.ya?ml$/.test(name)) throw new Error('UNKNOWN_CAMPAIGN_FILE');
      const file = `${dir}/${name}`;
      sources[file] = readFileSync(path.join(workspace, file), 'utf8');
    }
  }
  return sources;
}
// Never invoke the bundler if cached tools have not been explicitly resolved.
// This guard is intentionally stricter than "makensis is on PATH": Tauri also
// needs its bundler plugin set. No tool download or security prompt here.
export function reviewToolPreflight(
  environment = process.env,
  exists = existsSync,
  read = readFileSync,
) {
  const root = environment.LOCALAPPDATA;
  if (!root) return { ok: false, code: 'TOOL_CACHE_LOCATION_UNAVAILABLE' };
  const tools = path.join(root, 'tauri', 'NSIS');
  const required = [...REQUIRED_NSIS_FILES, TOOL_MANIFEST];
  const missing = required.filter((file) => !exists(path.join(tools, file)));
  if (missing.length) return { ok: false, code: 'PACKAGING_TOOLS_UNRESOLVED', tools, missing };
  try {
    const manifestBytes = read(path.join(tools, TOOL_MANIFEST));
    if (sha256(manifestBytes) !== PINNED_TOOL_MANIFEST_SHA256)
      throw new Error('UNTRUSTED_TOOL_MANIFEST');
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const installed = JSON.parse(
      read(path.join(workspace, 'node_modules/@tauri-apps/cli/package.json')).toString('utf8'),
    );
    if (
      installed.version !== CLI_VERSION ||
      manifest.schemaVersion !== 1 ||
      manifest.decision !== 'DEC-064' ||
      manifest.cliVersion !== CLI_VERSION ||
      manifest.source !== NSIS_SOURCE ||
      !manifest.files ||
      manifest.cliBinarySha256 !== sha256(read(path.join(workspace, CLI_BINARY)))
    )
      throw new Error('INVALID_TOOL_MANIFEST');
    for (const file of REQUIRED_NSIS_FILES)
      if (!Object.hasOwn(manifest.files, file)) throw new Error('MISSING_MANIFEST_ENTRY');
    for (const [file, hash] of Object.entries(manifest.files)) {
      if (
        !/^[a-f0-9]{64}$/.test(hash) ||
        file.includes('\\') ||
        file.split('/').some((p) => !p || p === '.' || p === '..') ||
        path.isAbsolute(file) ||
        file.includes(':')
      )
        throw new Error('UNSAFE_TOOL_MANIFEST_PATH');
      if (sha256(read(path.join(tools, file))) !== hash) throw new Error('TOOL_HASH_MISMATCH');
    }
    const plugin = read(path.join(tools, 'Plugins/x86-unicode/additional/nsis_tauri_utils.dll'));
    if (createHash('sha1').update(plugin).digest('hex').toUpperCase() !== NSIS_DOWNLOADS[1].sha1)
      throw new Error('UPSTREAM_PLUGIN_HASH_MISMATCH');
    return {
      ok: true,
      tools,
      cliVersion: CLI_VERSION,
      manifestSha256: sha256(read(path.join(tools, TOOL_MANIFEST))),
      verifiedFiles: Object.keys(manifest.files).length,
    };
  } catch {
    return { ok: false, code: 'UNVERIFIED_TOOL_CACHE', tools };
  }
}

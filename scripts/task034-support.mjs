import path from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
export function reviewToolPreflight(environment = process.env, exists = existsSync) {
  const root = environment.LOCALAPPDATA;
  if (!root) return { ok: false, code: 'TOOL_CACHE_LOCATION_UNAVAILABLE' };
  const tools = path.join(root, 'tauri', 'NSIS');
  const required = ['makensis.exe', 'Plugins/x86-unicode/nsis_tauri_utils.dll'];
  const missing = required.filter((file) => !exists(path.join(tools, file)));
  return missing.length
    ? { ok: false, code: 'PACKAGING_TOOLS_UNRESOLVED', tools, missing }
    : { ok: false, code: 'BUNDLER_TOOL_INVENTORY_REVIEW_REQUIRED', tools, missing: [] };
}

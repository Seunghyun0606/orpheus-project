import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  existsSync,
  lstatSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { workspace, sha256 } from './release-support.mjs';
import {
  CLI_VERSION,
  CLI_BINARY,
  NSIS_SOURCE,
  NSIS_DOWNLOADS,
  REQUIRED_NSIS_FILES,
  TOOL_MANIFEST,
  PINNED_TOOL_MANIFEST_SHA256,
} from './nsis-inventory.mjs';

const digest = (bytes, algorithm) => createHash(algorithm).update(bytes).digest('hex');
const cli = JSON.parse(
  readFileSync(path.join(workspace, 'node_modules/@tauri-apps/cli/package.json'), 'utf8'),
);
const binary = readFileSync(path.join(workspace, CLI_BINARY));
if (
  cli.version !== CLI_VERSION ||
  NSIS_DOWNLOADS.some(
    (d) => !binary.includes(Buffer.from(d.url)) || !binary.includes(Buffer.from(d.sha1)),
  )
)
  throw new Error('PINNED_CLI_TOOL_METADATA_MISMATCH');
if (!process.env.LOCALAPPDATA) throw new Error('NO_LOCAL_TOOL_CACHE');
const cache = path.resolve(process.env.LOCALAPPDATA, 'tauri');
const target = path.join(cache, 'NSIS');
if (existsSync(cache) && lstatSync(cache).isSymbolicLink()) throw new Error('CACHE_LINK_REJECTED');
if (existsSync(target)) throw new Error('EXISTING_CACHE_PRESERVED_REVIEW_REQUIRED');
const isolatedRoot = path.join(workspace, '.qa/review/tools');
mkdirSync(isolatedRoot, { recursive: true });
const staged = mkdtempSync(path.join(isolatedRoot, 'acquisition-'));
const downloads = [];
for (const item of NSIS_DOWNLOADS) {
  const response = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`OFFICIAL_DOWNLOAD_FAILED:${response.status}:${item.name}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes, 'sha1').toUpperCase() !== item.sha1)
    throw new Error(`UPSTREAM_HASH_MISMATCH:${item.name}`);
  writeFileSync(path.join(staged, item.name), bytes, { flag: 'wx' });
  downloads.push({
    ...item,
    sha256: sha256(bytes),
    bytes: bytes.length,
    redirectOrigin: new URL(response.url).origin,
  });
}
const extracted = path.join(staged, 'extracted');
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-File',
    path.join(workspace, 'scripts/extract-nsis.ps1'),
    '-Archive',
    path.join(staged, NSIS_DOWNLOADS[0].name),
    '-Destination',
    extracted,
  ],
  { stdio: 'inherit' },
);
const source = path.join(extracted, 'nsis-3.11');
const additional = path.join(source, 'Plugins/x86-unicode/additional');
mkdirSync(additional, { recursive: true });
writeFileSync(
  path.join(additional, NSIS_DOWNLOADS[1].name),
  readFileSync(path.join(staged, NSIS_DOWNLOADS[1].name)),
  { flag: 'wx' },
);
for (const file of REQUIRED_NSIS_FILES)
  if (!existsSync(path.join(source, file))) throw new Error(`INCOMPLETE_TOOL_ARCHIVE:${file}`);
const files = {};
function inventory(directory, relative = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name),
      name = relative + entry.name;
    if (entry.isSymbolicLink()) throw new Error('TOOL_LINK_REJECTED');
    if (entry.isDirectory()) inventory(file, name + '/');
    else if (entry.isFile()) files[name] = sha256(readFileSync(file));
    else throw new Error('UNEXPECTED_TOOL_ENTRY');
  }
}
inventory(source);
const manifest = {
  schemaVersion: 1,
  task: 'TASK-034',
  decision: 'DEC-064',
  source: NSIS_SOURCE,
  cliVersion: CLI_VERSION,
  cliBinarySha256: sha256(binary),
  downloads,
  files,
};
const manifestBytes = JSON.stringify(manifest, null, 2);
if (sha256(manifestBytes) !== PINNED_TOOL_MANIFEST_SHA256)
  throw new Error('ACQUISITION_INVENTORY_MISMATCH');
writeFileSync(path.join(source, TOOL_MANIFEST), manifestBytes, {
  encoding: 'utf8',
  flag: 'wx',
});
mkdirSync(cache, { recursive: true });
// Exact fresh source/target checked before moving; never overwrite/remove a cache.
if (
  !source.startsWith(isolatedRoot + path.sep) ||
  path.dirname(target) !== cache ||
  existsSync(target)
)
  throw new Error('UNSAFE_CACHE_TARGET');
renameSync(source, target);
console.log(
  JSON.stringify(
    {
      task: 'TASK-034',
      status: 'verified_tools_acquired_not_installed_app',
      cache: target,
      staged,
      cliVersion: CLI_VERSION,
      cliBinarySha256: manifest.cliBinarySha256,
      downloads,
      fileCount: Object.keys(files).length,
    },
    null,
    2,
  ),
);

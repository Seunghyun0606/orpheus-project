import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { workspace, hashFile, reviewToolPreflight } from './release-support.mjs';

// No app/installer launch, profile operation, signing or external-tool acquisition.
const preflight = reviewToolPreflight();
if (!preflight.ok) {
  console.error(
    JSON.stringify({ task: 'TASK-034', status: 'blocked_no_download_attempted', ...preflight }),
  );
  process.exitCode = 2;
} else {
  const invoke = (args) =>
    execFileSync(process.execPath, args, {
      cwd: workspace,
      stdio: 'inherit',
      env: {
        ...process.env,
        CARGO_NET_OFFLINE: 'true',
        CARGO_TARGET_DIR: path.join(workspace, '.qa/review/target'),
      },
    });
  invoke(['node_modules/typescript/bin/tsc', '--noEmit']);
  invoke(['scripts/validate-scenarios.mjs']);
  invoke([
    'node_modules/@tauri-apps/cli/tauri.js',
    'build',
    '--ci',
    '--no-sign',
    '--target',
    'x86_64-pc-windows-msvc',
    '--config',
    'src-tauri/tauri.review.conf.json',
    '--',
    '--locked',
    '--offline',
  ]);
  const folder = '.qa/review/target/x86_64-pc-windows-msvc/release/bundle/nsis';
  const artifacts = readdirSync(path.join(workspace, folder))
    .filter((f) => f.endsWith('.exe'))
    .map((file) => {
      const artifact = `${folder}/${file}`;
      return {
        file: artifact,
        bytes: statSync(path.join(workspace, artifact)).size,
        sha256: hashFile(artifact),
      };
    });
  if (!artifacts.length || artifacts.some((f) => f.bytes > 100 * 1024 * 1024))
    throw new Error('MISSING_OR_OVERSIZE_REVIEW_INSTALLER');
  console.log(
    JSON.stringify(
      {
        task: 'TASK-034',
        status: 'generated_not_installed_or_released',
        artifacts,
        locks: { npm: hashFile('package-lock.json'), cargo: hashFile('src-tauri/Cargo.lock') },
        configs: {
          production: hashFile('src-tauri/tauri.conf.json'),
          review: hashFile('src-tauri/tauri.review.conf.json'),
        },
      },
      null,
      2,
    ),
  );
}

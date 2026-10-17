import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workspace = fileURLToPath(new URL('../', import.meta.url));
execFileSync(
  process.execPath,
  [
    path.join(workspace, 'node_modules/@tauri-apps/cli/tauri.js'),
    'build',
    '--no-bundle',
    '--config',
    'src-tauri/tauri.qa.conf.json',
  ],
  {
    cwd: workspace,
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: path.join(workspace, '.qa/native/target') },
  },
);

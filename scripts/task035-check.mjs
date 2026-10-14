// Approved automated commands only. Retain complete immutable per-invocation logs;
// never run a native app, installer or acquisition command from this runner.
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const commands = {
  typecheck: 'npm run typecheck',
  lint: 'npm run lint',
  format: 'npm run format:check',
  tests: 'npm run test',
  replays: 'npm run test:replays',
  'replays-002-003':
    'npx --no-install vitest run src/tests/inc-002-replay.test.ts src/tests/inc-003-replay.test.ts',
  validate: 'npm run validate:scenarios',
  build: 'npm run build',
  desktop: 'npm run build:desktop',
  harness: 'npm run test:task034:harness',
  authoring:
    'npx --no-install vitest run scripts/authoring/full-campaign.test.mjs scripts/authoring/task032-balance.test.mjs scripts/authoring/task032-presentations.test.mjs',
  diff: 'git diff --check',
  'runtime-presentation':
    'npx --no-install vitest run src/tests/runtime-notice-queue.test.ts src/tests/runtime-presentation.test.ts src/tests/runtime-presentation-ui.test.tsx scripts/authoring/runtime-presentation-v2.test.mjs',
};
const key = process.argv[2];
if (!Object.hasOwn(commands, key)) throw new Error('Unknown approved check key');
const command = commands[key];
const stamp = randomUUID();
const directory = '.qa/task035/checks/' + stamp;
mkdirSync(directory, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const report = {
  task: 'TASK-035',
  actor: process.env.TASK035_ACTOR ?? '/root',
  key,
  command,
  startedAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  worktree: git('status', '--short'),
  node: process.version,
  locks: { npm: hash('package-lock.json'), cargo: hash('src-tauri/Cargo.lock') },
  stdout: '',
  stderr: '',
  status: 'running',
};
const start = performance.now();
const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', command], { windowsHide: true })
    : spawn('/bin/sh', ['-c', command]);
console.log(JSON.stringify({ key, command, report: directory + '/result.json', pid: child.pid }));
child.stdout.on('data', (chunk) => {
  report.stdout += chunk.toString('utf8');
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  report.stderr += chunk.toString('utf8');
  process.stderr.write(chunk);
});
child.on('error', (error) => {
  report.spawnError = String(error);
});
child.on('close', (code, signal) => {
  report.exitCode = code;
  report.signal = signal;
  report.elapsedMs = performance.now() - start;
  report.finishedAt = new Date().toISOString();
  report.status = code === 0 ? 'pass' : 'fail';
  const file = directory + '/result.json';
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(
    JSON.stringify({
      key,
      status: report.status,
      elapsedMs: report.elapsedMs,
      report: file,
      sha256: hash(file),
    }),
  );
  process.exitCode = code ?? 1;
});

// Godot helpers (DEC-072, TASK-038).
//
//   node scripts/story/godot.mjs play      export story data, then open the game window
//   node scripts/story/godot.mjs parity    GDScript runner vs reference runner on every path
//   node scripts/story/godot.mjs smoke     the whole campaign through the real UI, three ways
//   node scripts/story/godot.mjs saves     save recovery and old input compatibility
//   node scripts/story/godot.mjs build     export an unsigned Windows x86_64 build
//   node scripts/story/godot.mjs editor    open the project in the Godot editor
//
// The Godot binary comes from GODOT_BIN, then `godot` on PATH, then a Godot 4
// console build found under ../_basic_tool or %LOCALAPPDATA%\Programs.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const PROJECT = 'godot';

// Automated checks must never load or write the player's user:// files. Keep
// runtime imports and fixtures in a QA copy, with its own application name.
// One copy per mode, replaced on each run (the parity fixtures alone are
// ~120 MB, and only parity needs them).
function testProject(mode) {
  const dir = resolve('.qa/verification', `${mode}-run`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const project = join(dir, 'godot');
  cpSync(PROJECT, project, {
    recursive: true,
    filter: (path) => {
      const parts = path.replaceAll('\\', '/').split('/');
      const fixtures = parts.at(-2) === 'tests' && parts.at(-1) === 'fixtures';
      return !parts.includes('.godot') && (mode === 'parity' || !fixtures);
    },
  });
  const config = join(project, 'project.godot');
  const name = `Orpheus Verification ${dir.split(/[\\/]/).at(-1)}`;
  writeFileSync(
    config,
    readFileSync(config, 'utf8')
      .replace(/^config\/name=.*$/m, `config/name=${JSON.stringify(name)}`)
      .replace(/^config\/use_custom_user_dir=.*\r?\n?/m, '')
      .replace(/^config\/custom_user_dir=.*\r?\n?/m, ''),
  );
  console.log(`Isolated Godot checks: ${project} (${name})`);
  return project;
}

function findGodot() {
  if (process.env.GODOT_BIN) return process.env.GODOT_BIN;
  for (const name of ['godot', 'godot4']) {
    const probe = spawnSync(name, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return name;
  }
  const roots = [resolve('..', '_basic_tool'), join(process.env.LOCALAPPDATA ?? '', 'Programs')];
  const found = [];
  const walk = (dir, depth) => {
    if (depth < 0 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (
        entry.isFile() &&
        /^Godot_v4.*_console\.exe$/.test(entry.name) &&
        !/mono/i.test(entry.name)
      )
        found.push(path);
      else if (entry.isDirectory()) walk(path, depth - 1);
    }
  };
  roots.forEach((root) => walk(root, 2));
  if (found.length > 0) return found.sort().at(-1);
  console.error('Godot 4 not found. Set GODOT_BIN to the Godot console executable.');
  process.exit(1);
}

const godot = findGodot();
const run = (args) => {
  const result = spawnSync(godot, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const exportData = (...flags) =>
  execFileSync(process.execPath, ['scripts/story/export-godot.mjs', ...flags], {
    stdio: 'inherit',
  });

const mode = process.argv[2];
switch (mode) {
  case 'build': {
    const out = resolve('build', 'windows');
    exportData();
    run(['--headless', '--path', PROJECT, '--import']);
    mkdirSync(out, { recursive: true });
    run([
      '--headless',
      '--path',
      PROJECT,
      '--export-release',
      'Windows Desktop',
      join(out, 'OrpheusProject.exe'),
    ]);
    for (const file of readdirSync(join(PROJECT, 'fonts')))
      if (file.endsWith('-OFL.txt')) copyFileSync(join(PROJECT, 'fonts', file), join(out, file));
    console.log(`Windows build: ${join(out, 'OrpheusProject.exe')} (keep the whole folder).`);
    break;
  }
  case 'parity':
  case 'smoke':
  case 'saves': {
    exportData(...(mode === 'parity' ? ['--fixtures'] : []));
    const project = testProject(mode);
    const script = { parity: 'parity', smoke: 'ui_smoke', saves: 'save_recovery' }[mode];
    const flags = process.argv.slice(3);
    run(['--headless', '--path', project, '--import']);
    run(['--headless', ...flags, '--path', project, '--script', `res://tests/${script}.gd`]);
    break;
  }
  case 'play':
    exportData();
    run(['--headless', '--path', PROJECT, '--import']);
    spawn(godot, ['--path', PROJECT, ...process.argv.slice(3)], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    console.log('Opened the game window.');
    break;
  case 'editor':
    spawn(godot, ['--editor', '--path', PROJECT], { detached: true, stdio: 'ignore' }).unref();
    break;
  default:
    console.log(
      'Usage: node scripts/story/godot.mjs play|parity|smoke|saves|build|editor [--verbose]',
    );
}

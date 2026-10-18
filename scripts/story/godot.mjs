// Godot helpers (DEC-072, TASK-038).
//
//   node scripts/story/godot.mjs play      export story data, then open the game window
//   node scripts/story/godot.mjs parity    GDScript runner vs reference runner on every path
//   node scripts/story/godot.mjs smoke     the whole campaign through the real UI, three ways
//   node scripts/story/godot.mjs editor    open the project in the Godot editor
//
// The Godot binary comes from GODOT_BIN, then `godot` on PATH, then a Godot 4
// console build found under ../_basic_tool or %LOCALAPPDATA%\Programs.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PROJECT = 'godot';

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

switch (process.argv[2]) {
  case 'parity':
    exportData('--fixtures');
    run(['--headless', '--path', PROJECT, '--import']);
    run(['--headless', '--path', PROJECT, '--script', 'res://tests/parity.gd']);
    break;
  case 'smoke':
    exportData();
    run(['--headless', '--path', PROJECT, '--import']);
    run(['--headless', '--path', PROJECT, '--script', 'res://tests/ui_smoke.gd']);
    break;
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
    console.log('Usage: node scripts/story/godot.mjs play|parity|smoke|editor');
}

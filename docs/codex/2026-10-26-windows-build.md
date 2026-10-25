# Codex brief — Windows build for manual QA (2026-10-26)

Branch `codex/windows-build`. Read `AGENTS.md` (section "Claude and Codex") first.

## Goal

The user wants to play-test the Godot client as a normal Windows program, without Node or the
editor. Produce a repeatable, local, unsigned Windows build.

## Scope

1. Add `godot/export_presets.cfg` with one preset, "Windows Desktop", x86_64, that exports the
   whole project, including `data/`, `locale/`, `fonts/`, `audio/`, `assets/` and the shader.
   No code signing, no `rcedit` dependency (leave the icon/metadata step off if it needs
   external tools), no embedded PCK requirement either way. Choose whichever works offline.
2. Add `npm run godot:build` (in `scripts/story/godot.mjs`, next to `play`/`smoke`): export the
   story data, import, then run `--headless --export-release "Windows Desktop"` into
   `build/windows/OrpheusProject.exe`. Add `build/` to `.gitignore`.
3. Copy the font licence texts (`godot/fonts/*-OFL.txt`) next to the exe, as the asset inventory
   requires for distributed builds.
4. Verify: run the build, then launch the exported exe headless or with a short timeout (for
   example with `--quit-after` frames) to show it boots without script errors and finds its data
   (no "Episode … is missing"). If export templates for 4.7.2 are missing, stop and report it.
   They are expected under `%APPDATA%\Godot\export_templates\4.7.2.stable`.
5. Document the command and the output path in `README.md` (Quick start) in two lines.

## Out of scope

Installer, signing, upload, release notes, version bumps, and any change to game code.

## Report

`docs/qa/2026-10-26-windows-build.md`: the commands, the build size, the boot check output, and
anything a player-tester should know (for example where the save file lives:
`%APPDATA%\Godot\app_userdata\The Orpheus Project\campaign.json`).

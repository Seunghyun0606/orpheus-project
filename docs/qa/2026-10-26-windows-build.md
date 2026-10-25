# Windows build QA — 2026-10-26

## Scope and result

- Brief: `docs/codex/2026-10-26-windows-build.md`.
- Worktree: `orpheus-codex/windows-build`, branch `codex/windows-build`, base `608e996`.
- Result: **PASS for the build and boot acceptance criteria, with two P3 runtime observations below.**
- Added one unsigned Windows Desktop x86_64 preset, `npm run godot:build`, font licence copying,
  the ignored `build/` directory, and two Quick start lines in `README.md`.
- No game code, canonical Project OS state, version, installer, or signing changes. Changes are
  uncommitted; integration and independent review remain with Claude. Nothing was pushed or published.

## Environment and repeatable build

Godot `4.7.2.stable.official.ed1daf0bf`, Node `v24.18.0`, npm `11.16.0`, Windows x86_64.
The existing templates were present under
`%APPDATA%\Godot\export_templates\4.7.2.stable`, including
`windows_release_x86_64.exe` and `icudt_godot.dat`. No downloads were needed.

Commands from the worktree root, in PowerShell:

```powershell
$env:GODOT_BIN = (Resolve-Path '..\..\_basic_tool\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe').Path
& $env:GODOT_BIN --version
node --version
npm.cmd --version
npm.cmd run godot:build
```

Use the installed editor's path for `GODOT_BIN` on other machines. This worktree's existing
binary discovery does not reach the installation two directories above it. `npm.cmd` avoids
this host's PowerShell policy blocking `npm.ps1`; `npm run godot:build` works from cmd.exe.

Build exit code: **0**. The helper executes these steps in order:

```text
node scripts/story/export-godot.mjs
Godot --headless --path godot --import
Godot --headless --path godot --export-release "Windows Desktop" <absolute build/windows/OrpheusProject.exe>
copy godot/fonts/*-OFL.txt to build/windows/
```

Story export reported `Exported 26 episode(s) and 1 locale(s).` The export included ICU text
server data from the installed templates. The preset exports all resources, explicitly includes
JSON and text files, disables signing and executable resource modification, and uses a separate
PCK. It does not require rcedit. See Godot's
[resource export options](https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html#resource-options)
and [Windows export properties](https://docs.godotengine.org/en/stable/classes/class_editorexportplatformwindows.html).

Local build log: `.qa/windows-build/build.log` (ignored).

## Build size and contents

| File in `build/windows/`    |                        Bytes |
| --------------------------- | ---------------------------: |
| `OrpheusProject.exe`        |                  109,268,480 |
| `OrpheusProject.pck`        |                   10,859,808 |
| `IBMPlexMono-OFL.txt`       |                        5,299 |
| `NanumGothicCoding-OFL.txt` |                        4,534 |
| **Total**                   | **120,138,121 (114.57 MiB)** |

`Get-AuthenticodeSignature build/windows/OrpheusProject.exe` returned **NotSigned**.
`Get-FileHash ... -Algorithm SHA256` confirmed that each copied licence matches its source.

Artifact SHA-256 values:

```text
OrpheusProject.exe  D34D36F3BE1A6C49C56525AE86469B92E4F417DDF0B43CF00DD80C385C4B0562
OrpheusProject.pck  7621463F3EB92D5AE393BC7A3F0B25AE9DCB62834C8FAC45A355AF1CE744790F
```

## Isolated exported-game boot checks

AGENTS.md requires runtime checks on a copy under `.qa/` with a different application name.
Copied `godot/` to `.qa/windows-build/project/`, changed only its application name to
`The Orpheus Project Windows Build QA`, imported it, and exported its PCK with the same preset.
Copied the actual production executable into `.qa/windows-build/bin/`; its SHA-256 matches the
production executable above. No game was launched with the player's application name.

Preparation used `Copy-Item -Recurse` for the project, a UTF-8 replacement of
`config/name="The Orpheus Project"` in the copied `project.godot`, and:

```powershell
& $env:GODOT_BIN --headless --path .qa/windows-build/project --import
$qaPack = Join-Path (Get-Location) '.qa/windows-build/bin/OrpheusProject.pck'
& $env:GODOT_BIN --headless --path .qa/windows-build/project --export-pack 'Windows Desktop' $qaPack
Copy-Item build/windows/OrpheusProject.exe .qa/windows-build/bin/OrpheusProject.exe
```

QA import and pack export both exited **0**. The exported executable was launched with
`Start-Process -WindowStyle Hidden -Wait -PassThru`, working directory `.qa/windows-build/bin`,
and separate stdout/stderr log files, using these arguments:

```text
OrpheusProject.exe --headless --quit-after 120 -- --episode=INC-001 --lang=ko
OrpheusProject.exe --headless --verbose --quit-after 120 -- --episode=INC-026 --lang=en
```

Both exited **0**. Neither produced `SCRIPT ERROR`, parse errors, missing episode messages,
or missing data/resource errors. The English verbose log showed successful audio loads.
Korean stdout was:

```text
Godot Engine v4.7.2.stable.official.ed1daf0bf - https://godotengine.org
```

Korean stderr was:

```text
ERROR: Failed to read the root certificate store.
   at: get_system_ca_certificates (platform/windows/os_windows.cpp:2582)
WARNING: 4 ObjectDB instances were leaked at exit (run with `--verbose` for details).
   at: cleanup (core/object/object.cpp:2536)
ERROR: 2 resources still in use at exit (run with --verbose for details).
   at: clear (core/io/resource.cpp:822)
```

English stderr reported the same certificate error, two leaked ObjectDB instances and one
resource still in use. Its verbose stdout identified `res://audio/ambient.wav`,
`AudioStreamWAV`, and `AudioStreamPlaybackWAV` at shutdown. These are recorded below;
the boot checks do not have completely empty stderr.

Local logs: `.qa/windows-build/boot-ko.stdout.log`, `boot-ko.stderr.log`,
`boot-en.stdout.log`, and `boot-en.stderr.log`.

### Original PCK verification

An ignored QA-only script, `.qa/windows-build/package_probe.gd`, first checked that the
application name was the isolated QA name, then mounted the **original production PCK**.
It verified all 60 source files/resources under `data/`, `locale/`, `fonts/`, `audio/`,
`assets/`, and `shaders/`: file existence for JSON/text, successful resource loading for
the others, and parsing with matching IDs for all 26 episodes. It instantiated the original
packaged main scene and ran 120 frames with INC-001 in Korean.

The probe ran with the editor binary because `--script` is unavailable in exported release
executables; an initial attempt with that flag on the release executable was stopped and
excluded from the passing boot checks. The release executable checks above used supported flags.

```powershell
$probe = (Resolve-Path '.qa/windows-build/package_probe.gd').Path
$pack = (Resolve-Path 'build/windows/OrpheusProject.pck').Path
$manifest = (Resolve-Path '.qa/windows-build/package-files.json').Path
& $env:GODOT_BIN --headless --path .qa/windows-build/project --quit-after 120 --script $probe -- $pack $manifest --episode=INC-001 --lang=ko
```

Exit **0**; output included:

```text
PASS: original build PCK: 60 files/resources; 26 episodes parsed.
QA user data: C:/Users/limse/AppData/Roaming/Godot/app_userdata/The Orpheus Project Windows Build QA
PASS: original build main scene instantiated.
PASS: 120 boot frames completed.
```

The same certificate/shutdown diagnostics also occurred here. Probe source, manifest, copied
project, and full logs remain under ignored `.qa/windows-build/` for local inspection.

## Other verification

| Command/check                    | Result                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run check`              | Exit 0: formatting, lint, typecheck, 142 scenario files, locale/story validation, generated-data freshness, 67 test files / 849 tests, five release-harness tests, web build |
| `git diff --check`               | Exit 0                                                                                                                                                                       |
| Font licence SHA-256 comparisons | Both exact matches                                                                                                                                                           |
| Executable signature check       | `NotSigned`, as requested                                                                                                                                                    |

The web build emitted a chunk-size warning. Full gate output is in
`.qa/windows-build/check.log`. No full campaign playthrough or visual/audio review was
performed for this build-tooling brief. Claude's independent review is pending.

## Findings for Claude triage

### WB-001 — P3 — Certificate-store diagnostic on this host

- Location: `.qa/windows-build/boot-ko.stderr.log:1`; engine location reported as
  `platform/windows/os_windows.cpp:2582`.
- Steps: run either isolated exported-game boot command above, or the editor import/export.
- Expected: local offline startup without certificate-store errors.
- Actual: `ERROR: Failed to read the root certificate store.` Startup and export still exit 0;
  no offline gameplay impact was observed in these boot checks.
- Suggestion: reproduce outside the restricted execution environment before investigating
  the host certificate store or Godot. No game/build change is proposed on this evidence.
- Claude decision: **defer**. It comes from the restricted environment or this host; offline play is unaffected. Revisit only if it appears in a normal session.

### WB-002 — P3 — Audio resources retained during short headless shutdown

- Location: `.qa/windows-build/boot-en.stderr.log:3`; related playback code
  `godot/scripts/ui/sound.gd:65` (root cause not established).
- Steps: run the English isolated boot with `--verbose --quit-after 120` as above.
- Expected: shutdown releases audio playback and stream references without leak diagnostics.
- Actual: exit 0 with two leaked instances and one resource still in use; verbose output
  identifies the ambient WAV/playback. The Korean run reported four instances/two resources.
- Suggestion: investigate audio-loop cleanup and reproduce with normal window close during
  a later runtime QA task. Game-code changes are outside this brief.
- Claude decision: **defer** to the verification brief (`docs/codex/2026-10-26-verification.md`, item 2), which covers the same exit-time leaks.

## Player-tester notes

- Launch `build/windows/OrpheusProject.exe`; Node and the Godot editor are needed only to
  build, not to play. Keep the **entire `build/windows/` folder** together, including the PCK
  and both font licence texts. This is a local unsigned executable with the template icon
  and metadata, without an installer.
- The normal build uses `%APPDATA%\Godot\app_userdata\The Orpheus Project\campaign.json`.
  It shares saves/settings with editor play under that same application name. Back up that
  directory before manual testing if existing progress matters; `campaign.bak.json`,
  `endings.json`, and settings also live there.
- Automated runtime checks used only
  `%APPDATA%\Godot\app_userdata\The Orpheus Project Windows Build QA\`; the player's
  normal campaign was not exercised or modified.

## Structured task result

```yaml
task: windows-build
brief: docs/codex/2026-10-26-windows-build.md
branch: codex/windows-build
result: pass_with_observations
build_exit_code: 0
exported_boot_exit_codes: [0, 0]
original_pck_probe_exit_code: 0
repository_check_exit_code: 0
bundle_bytes: 120138121
findings: [WB-001, WB-002]
independent_review: accepted_by_claude_2026-10-26
changes_committed: false
canonical_project_state_changed: false
published: false
```

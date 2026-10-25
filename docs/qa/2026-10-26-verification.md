# Verification hardening — 2026-10-26

Brief: `docs/codex/2026-10-26-verification.md`. Worktree branch: `codex/verification`, starting HEAD `608e996`. Codex role: scoped tests, CI and tooling. Read `PROJECT.md`, Project OS manifest/current state, `AGENTS.md`, and the review's final disposition table before work. No game behaviour, story data, canonical Project OS state, commits or remote branches changed.

## Changes

- Added a separate Linux Godot job in `.github/workflows/ci.yml`. It caches the official 4.7.2 standard Linux x86_64 executable, invokes it headlessly through `GODOT_BIN`, checks its version, then runs the fixture-generator tests, parity, smoke and save recovery. The existing Windows `npm run check` job is unchanged. Download failures and nonzero test exits fail the job; there is a ten-minute timeout. The [official version archive](https://godotengine.org/download/archive/4.7.2-stable/) lists this release; Godot 4 uses the standard executable with `--headless`.
- Automated `godot.mjs` commands now copy the project under `.qa/verification/<mode>-<unique>/godot`, omit the original import cache and assign a fresh `Orpheus Verification <mode>-<unique>` application name before importing or running anything. No player's `user://campaign.json`, backup, settings or endings are loaded or written. Interactive `play`/`editor` commands retain their existing behaviour. `--verbose` is forwarded for automated runs.
- Fixed smoke shutdown in `godot/tests/ui_smoke.gd`: stop the test scene's audio players, allow 0.1 seconds for the audio mixer to retire playbacks, explicitly queue-free the scene, then wait for deferred deletion before quitting. No game-code cache clearing or product changes were needed.
- Added `scripts/story/parity-coverage.mjs`, integrated into fixture export, plus three native Node tests. `vitest.config.ts` delegates that native test file to the separate CI step, as it already does for the release harness.
- Added `godot/tests/save_recovery.gd`, `node scripts/story/godot.mjs saves`, and `npm run godot:saves`. The test refuses to write unless both the copied project path and isolated application-name prefix match the saves helper. No `Progress` seam was necessary. Test save files are removed at the end.

## Parity coverage

| Fixture group                    |      Paths |
| -------------------------------- | ---------: |
| Existing bounded campaign sample |     17,197 |
| Numeric boundary cases           |       +447 |
| Three-way flag cases             |     +1,539 |
| Total                            | **19,183** |

The numeric cases cover all **131** current `when` sites that read values/alignment, including option-result dialogue. Each bound is tested immediately below, exactly at, and immediately above its threshold, with other numeric dimensions held inside their bounds. Entry values compensate for effects applied earlier in the episode; option-result probes occur before option effects. Test-only marker beats in cloned episodes confirm the requested value and nonnumeric preconditions are reached. Exported parity fixtures use the original episode and compare its complete final state, including dialogue feed. Of 447 boundary observations, **372** exact site/value observations were absent from the old sample (248 true, 124 false).

No individual current `when.flags` dictionary contains three or more keys. The new fixtures instead cover **every assignment of every three-flag subset** among the flags each episode's conditions read. A deterministic greedy cover uses **162 entry carries** across 18 episodes; representative complete paths retain every distinct feed entry available for each carry, including conditional dialogue, chosen options and timeouts. This covers **2,592 episode/triple/assignment combinations**, **610** absent from the old entry sample. INC-026 accounts for 2,288 total combinations and 492 newly covered combinations, using 22 synthetic carries and 191 paths.

The additions reach **27 distinct dialogue/log/narration entries, counted per episode**, absent from the old fixture feeds. Examples:

- INC-009: the low-confidence recommendation at 0.72 (`src/story/data/inc-009.yaml:210`).
- INC-014: the earlier ownerless-manifest memory (`src/story/data/inc-014.yaml:161`).
- INC-026: low-predictability final-action dialogue, Maya's trust response, the shutdown epilogue's trust response, and the Liberation damage response. Boundary coverage also checks corporate alignment 28 and collateral damage 92/94 (`src/story/data/inc-026.yaml:219`, `:356`, `:394`, `:429`, `:507`).

`godot/tests/fixtures/coverage.json` is generated and ignored by git. It records per-episode path counts, each boundary observation and its prior coverage, flag-combination counts, and the actual newly reached feed entries. These are synthetic runner-entry cases, not proof that every carry is reachable by natural campaign play. Campaign merging/caps remain unchanged; this is not exhaustive coverage of four-way or larger flag combinations.

## Commands and results

Environment: Windows, Node `v24.18.0`, npm `11.16.0`, Godot `4.7.2.stable.official.ed1daf0bf`. PowerShell blocks `npm.ps1`, so local npm commands used `npm.cmd`. For runtime commands, `GODOT_BIN` was set to `../../_basic_tool/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe` resolved to an absolute path.

| Command / check                                                                                                                                              | Result                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow YAML parsed using the installed `yaml` package with duplicate-key rejection; compared `jobs.check` against `git show HEAD:.github/workflows/ci.yml` | PASS; original job structurally identical. Manually reviewed bash quoting, official download URL, cache condition/key, version check, step dependencies and exit handling. `actionlint` is unavailable.                                                          |
| `node --test scripts/story/parity-coverage.test.mjs`                                                                                                         | PASS, 3 tests: offsets/compound bounds/nonnumeric gates; deterministic complete three-way cover for 13 flags; representative-path feed coverage.                                                                                                                 |
| `node scripts/story/export-godot.mjs --fixtures`                                                                                                             | PASS, 17,197 + 447 + 1,539 paths.                                                                                                                                                                                                                                |
| `npm.cmd run godot:parity`                                                                                                                                   | PASS, **19,183/19,183**, exit 0. About **31.3 seconds**, including fixture export, fresh-copy import and execution; below the requested approximately two minutes locally.                                                                                       |
| Baseline `--headless --verbose --path .qa/verification/baseline/godot --script res://tests/ui_smoke.gd`                                                      | 1,045 inputs, 0 failures, exit 0; four leaked objects and two retained audio resources at shutdown.                                                                                                                                                              |
| Same baseline copy with explicit scene freeing/frame waits only                                                                                              | 1,045 inputs, 0 failures; reduced to two leaked objects and one resource. This established that frame yields alone were insufficient.                                                                                                                            |
| `npm.cmd run godot:smoke -- --verbose` with final teardown                                                                                                   | PASS, **1,045 inputs, 0 failures**, including all three real-time strategies, ten endings and existing UI regressions; exit 0, **no ObjectDB leaks, resources-in-use warnings or orphan StringNames**.                                                           |
| `npm.cmd run godot:saves`                                                                                                                                    | PASS, **11 checks, 0 failures**, exit 0. Four corrupt-primary variants recover backup; both broken gives empty; valid primary wins; old optional keys default; removed input stops at valid prefix; real save rotation and subsequent corruption recover backup. |
| `GODOT_BIN=<node.exe> node scripts/story/godot.mjs saves`                                                                                                    | Deliberate failure probe: Node rejects Godot flags with exit 9; helper propagates **exit 9**. No Godot runtime or player files involved.                                                                                                                         |
| Isolated stale-input continuation diagnostic, `--headless --path .qa/verification/baseline/godot --script res://tests/stale_suffix.gd`                       | Reproduced VR-01: `recovered=approach continued=why resumed=approach`.                                                                                                                                                                                           |
| `npm.cmd run check`                                                                                                                                          | PASS, exit 0: formatting, lint, types, 142 scenarios, locales/story/export freshness, 67 Vitest files / 849 tests, 5 release-harness tests, and web build. Existing 5.49 MB full-campaign chunk warning remains.                                                 |
| `git diff --check`                                                                                                                                           | PASS.                                                                                                                                                                                                                                                            |

The initial `npm.cmd run check` passed the existing 849 tests but failed because Vitest discovered the new Node-native test file (zero Vitest tests). After adding the explicit exclusion and running its three tests separately, the full check was rerun successfully. A negative safety test also ran `save_recovery.gd` in the baseline QA copy with a non-saves application name: it refused before file writes and returned exit 1.

GitHub Actions and the Linux executable were not run in this Windows session; the CI job itself remains unverified on a hosted runner. Runtime logs also contain `Failed to read the root certificate store` from this Windows environment. It occurs before the test scripts and does not change their exit status. The intentionally malformed-save cases emit JSON-parser errors; the removed-option case emits the expected `Saved input no longer applies` warning. Those expected diagnostics do not represent failed save assertions.

Verbose baseline details identified `AudioStreamWAV`/`AudioStreamPlaybackWAV` instances retaining `res://audio/choice.wav` and `res://audio/title.wav`. The remaining title playback after scene-free-only teardown disappeared after stopping playback and allowing mixer time. This is a test shutdown lifecycle issue; no evidence from these runs implicates static story caches. Local logs and diagnostic script remain under ignored `.qa/verification/` for review.

## Finding

### VR-01 — P2: an incompatible saved input continues to block later resumes

- **Location:** `godot/scripts/story/progress.gd:144` (especially the break at 150), `godot/scripts/story/progress.gd:111` (`log_input`); resume caller `godot/scripts/ui/main.gd:282`.
- **Steps:** In the isolated QA application, create an INC-001 current run with an empty carry and inputs `[{type: continue}, {type: choose, optionId: REMOVED_OPTION_VERIFICATION}]`. Load/replay it. At the recovered `approach` scene, choose `SESSIONS`, append that accepted input through `Progress.log_input`, save, then reload/replay. The diagnostic script uses the real `Progress` and `StoryRunner` functions and removes its test save files afterwards.
- **Expected:** The first replay stops safely at `approach`. After choosing `SESSIONS`, saving and resuming should preserve the new valid choice at `why`.
- **Actual:** Initial recovery correctly returns `approach` without crashing; continuation reaches `why`. The next replay returns to `approach` because the obsolete option remains before the new input. Observed history: `continue, choose REMOVED_OPTION_VERIFICATION, choose SESSIONS`.
- **Cause:** `Progress.replay` stops at the first invalid input but leaves `run.inputs` unchanged. Subsequent inputs append behind that invalid entry.
- **Suggestion:** Have replay expose the accepted prefix length and repair the current run to that prefix before accepting/saving further inputs; discard the invalid suffix and stale timer metadata. Preserve read-only record behaviour. Add a regression that continues, saves and resumes after compatibility recovery. This is game behaviour, so no product fix was made under this brief.
- **Triage:** **accepted** by Claude. `Progress.replay` now cuts a run back to the inputs that still apply (and drops its kept timer), so play continues from there; regression added to `save_recovery.gd`.

## Structured result

```yaml
task: codex-verification-2026-10-26
status: completed_with_findings
branch: codex/verification
scope: tests_ci_tooling_only
report: docs/qa/2026-10-26-verification.md
verification:
  workflow_yaml_and_manual_review: pass
  github_actions_execution: not_available
  fixture_generator_tests: 3_passed
  godot_parity: 19183_of_19183
  added_parity_paths: 1986
  parity_seconds_including_export_and_import: 31.3
  godot_smoke: 1045_inputs_0_failures
  smoke_exit_leaks: none_after_harness_teardown
  godot_saves: 11_checks_0_failures
  nonzero_exit_propagation: pass
  npm_check: pass_849_tests_5_release_harness_tests
findings:
  P1: []
  P2: [VR-01]
  P3: []
product_behaviour_changed: false
canonical_state_changed: false
player_saves_touched: false
commit: null
push: false
```

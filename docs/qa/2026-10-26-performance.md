# Performance and long-session QA — 2026-10-26

## Scope

Brief: `docs/codex/2026-10-26-performance.md`. Worktree branch: `codex/performance`, base `3da6616`.
This is a report-only task. The only deliverable outside ignored `.qa/` is this report. No game
code, story data, canonical Project OS state, commits, pushes, signing, or publication changes.
Claude's independent review and finding decisions remain pending.

## Method and limits

- Windows x86_64; Godot `4.7.2.stable.official.ed1daf0bf`, Node `v24.18.0`, npm `11.16.0`.
  Ryzen 5 7500F, RTX 4070 SUPER (driver 610.88), about 31.6 GiB physical RAM. This was an
  ordinary desktop session, without deliberately inducing low system memory. These are host
  observations, not a minimum-spec or multi-hour soak certification.
- Copied `godot/` to `.qa/performance/godot/` without `.godot` or parity fixtures. The copied
  application is **Orpheus Performance QA**; its `user://` directory is
  `%APPDATA%/Godot/app_userdata/Orpheus Performance QA/`. No player game was launched. Normal
  campaign/settings file hashes and modification times were checked again at completion.
- The ignored autoload `godot/performance_probe.gd` in that copy calls the real main UI's
  methods, adapting `godot/tests/ui_smoke.gd::_realtime`. It selects available choices,
  supplies deduction solutions, checks that each incident finishes, and yields a process frame
  after inputs. This is UI-runtime automation rather than simulated mouse/keyboard coverage.
- **Three accelerated campaigns:** first choices, last choices with selected explicit timeout
  inputs, and middle choices. Each reveal/typing update calls `_process(0.25)` and yields a
  real rendered frame; it does not skip reveals. Normal typing setting, Korean, animations
  enabled. Each incident is then reopened as a record; all four status tabs are opened/closed;
  a settled title baseline follows. These passes measure retention and are not wall-clock
  campaigns. Act cards animate on wall-clock time.
- **Exported wall-clock campaign:** all 26 incidents with the first-choice route, Korean,
  the game's **fast** typing option (110 CPS before Korean joiner compensation), animations
  and decision timers enabled. The main UI receives actual engine deltas, without manual
  `_process` calls or reveal skipping. The ending, late record and People tab are opened.
  A separate sample of up to 60 seconds uses normal typing (38 CPS before compensation).
  There is no complete default-speed playthrough or human reading dwell time in this sample.
- Runtime measurements use the OpenGL Compatibility renderer at 1280×720, capped at 120 FPS,
  with a real rendering device, not `--headless`. Engine monitors are sampled every **120
  frames**, after incidents, and at checkpoints. Per-frame CSV records wall interval,
  `TIME_PROCESS`, typing state and rendered feed character count. Tree censuses count rich
  labels, audio players, texture nodes, active tweens and cast cache sizes. The OS sampler
  records working set and private bytes about every 250 ms.
- `MEMORY_STATIC` is an engine allocation counter, not process working set. The release
  executable returns zero for static-memory and orphan-node monitors. Its OS counters are used
  for memory; orphan-node conclusions use the editor runs only.
  Texture/video monitors are engine estimates, not a complete driver allocation census.
  `TIME_PROCESS` can update on a different cadence, so frame percentiles below use the
  per-frame wall clock and include the 120 FPS cap, scheduling and instrumentation overhead.
  See the [Godot Performance documentation](https://docs.godotengine.org/en/4.6/classes/class_performance.html).
- The completed three-pass stdout retains 601 checkpoint samples, including all 78 incident
  completions. A supplementary harness run accidentally replaced that pass's raw CSV/JSONL;
  checkpoint data were recovered verbatim into `accelerated-recovered.jsonl`. Its lost frame
  CSV is not used for timing claims. Fresh wall-clock and rebuild passes supply timing data.
  An interrupted exported pilot is excluded. Supplementary harness errors are not product
  findings; the cache probe was corrected to disable its UI autoload before being rerun.

## Reproduction and local evidence

All paths below are from the worktree root. Scripts, copied projects, raw logs, CSV, JSONL,
plots and local executables remain under ignored `.qa/performance/` and are not integration
changes. The plot images are optional local aids; the tables in this report retain the results.

```powershell
$env:GODOT_BIN = (Resolve-Path '../../_basic_tool/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe').Path
npm.cmd run godot:build
node .qa/performance/prepare.mjs
# The prepared copy includes the QA-only autoload and application name described above.
& $env:GODOT_BIN --headless --path .qa/performance/godot --import
# For a fresh three-pass run, use the editor GUI exe (without _console) with:
# --path <absolute QA project> --max-fps 120 -- --out=<absolute output prefix>
$qa = (Resolve-Path .qa/performance).Path
& $env:GODOT_BIN --headless --path .qa/performance/godot --export-pack 'Windows Desktop' "$qa/bin/OrpheusProject.pck"
Copy-Item build/windows/OrpheusProject.exe .qa/performance/bin/OrpheusProject.exe
$qa = (Resolve-Path .qa/performance).Path
& .qa/performance/watch.ps1 -Exe "$qa/bin/OrpheusProject.exe" -OutputBase realtime
# Fresh isolated rebuild/texture churn run:
# <editor GUI exe> --path <absolute QA project> --max-fps 120 -- --cost-only --out=<absolute cost prefix>
& $env:GODOT_BIN --headless --path .qa/performance/godot --script (Resolve-Path .qa/performance/cache_probe.gd).Path -- --cache-probe
python .qa/performance/analyse.py accelerated-recovered realtime cost
& .qa/performance/plot.ps1
& .qa/performance/plot-exported.ps1
```

The production build runs the existing story export, import, and unsigned release export.
The runtime executable is byte-for-byte the production build executable; only the adjacent
PCK comes from the isolated project and adds the measurement autoload. Startup therefore
includes that instrumentation and an initial title reset. It is a warm local launch, not a
cold installation benchmark. `executable-hashes.json` records the SHA-256 comparison.

## Result

Completed 78 accelerated incident runs and a separate **26-incident exported wall-clock
campaign**, all without a probe-reported gameplay failure. The exported ending checkpoint
was reached at 799.1 seconds after the driver began; the full run including
late-record/People checkpoints and normal typing lasted 861.0 seconds.
The earlier low-memory termination was **not reproduced**. There are no observed P1/P2 findings.
PF-01 identifies retained cast-cache histories; PF-02 and PF-03 record settings/status UI
construction hitches. This is `pass_with_observations` for this bounded measurement, with independent review
pending; it is not proof that every multi-hour or low-memory session is safe.

## Per-incident memory curve

First-choice accelerated pass. MiB = 1,048,576 bytes. Incident-end samples follow 0.8 seconds
of settling; the title column is a separate settled baseline after record/status inspection.
The cast column excludes the current incident, so it reaches 25 at INC-026.

| Incident | Static MiB | Title MiB | Objects | Nodes | Orphans | Resources | Texture / video MiB | Cast cache |
| -------- | ---------: | --------: | ------: | ----: | ------: | --------: | ------------------: | ---------: |
| INC-001  |      60.49 |     59.67 |    1902 |   114 |       0 |        27 |       10.32 / 16.68 |          0 |
| INC-002  |      61.12 |     59.85 |    1914 |   116 |       0 |        27 |       10.65 / 17.01 |          1 |
| INC-003  |      61.04 |     59.88 |    1910 |   120 |       0 |        27 |       10.65 / 17.03 |          2 |
| INC-004  |      61.79 |     60.20 |    1922 |   112 |       0 |        27 |       10.94 / 17.30 |          3 |
| INC-005  |      62.49 |     60.50 |    1971 |   128 |       0 |        27 |       11.15 / 17.55 |          4 |
| INC-006  |      62.10 |     60.52 |    1917 |   108 |       0 |        27 |       11.15 / 17.50 |          5 |
| INC-007  |      62.48 |     60.55 |    1971 |   130 |       0 |        27 |       11.15 / 17.56 |          6 |
| INC-008  |      62.22 |     60.71 |    1923 |   113 |       0 |        27 |       11.28 / 17.63 |          7 |
| INC-009  |      63.03 |     60.87 |    1976 |   123 |       0 |        27 |       11.40 / 17.79 |          8 |
| INC-010  |      62.60 |     61.02 |    1933 |   113 |       0 |        27 |       11.40 / 17.76 |          9 |
| INC-011  |      62.89 |     61.04 |    1943 |   113 |       0 |        27 |       11.40 / 17.76 |         10 |
| INC-012  |      63.32 |     61.47 |    1970 |   122 |       0 |        27 |       11.69 / 18.08 |         11 |
| INC-013  |      63.50 |     61.49 |    1966 |   118 |       0 |        27 |       11.78 / 18.15 |         12 |
| INC-014  |      63.46 |     61.52 |    1962 |   119 |       0 |        27 |       11.78 / 18.15 |         13 |
| INC-015  |      63.43 |     61.67 |    1958 |   117 |       0 |        27 |       11.90 / 18.28 |         14 |
| INC-016  |      63.38 |     61.69 |    1950 |   113 |       0 |        27 |       11.90 / 18.26 |         15 |
| INC-017  |      63.33 |     61.71 |    1938 |   109 |       0 |        27 |       11.90 / 18.25 |         16 |
| INC-018  |      63.49 |     61.91 |    1941 |   113 |       0 |        27 |       12.03 / 18.39 |         17 |
| INC-019  |      64.03 |     62.00 |    1976 |   121 |       0 |        27 |       12.03 / 18.40 |         18 |
| INC-020  |      64.01 |     62.02 |    1971 |   120 |       0 |        27 |       12.03 / 18.40 |         19 |
| INC-021  |      64.09 |     62.04 |    1983 |   129 |       0 |        27 |       12.03 / 18.42 |         20 |
| INC-022  |      63.99 |     62.07 |    1981 |   130 |       0 |        27 |       12.03 / 18.43 |         21 |
| INC-023  |      64.49 |     62.10 |    1992 |   120 |       0 |        27 |       12.03 / 18.40 |         22 |
| INC-024  |      64.38 |     62.12 |    1979 |   119 |       0 |        27 |       12.03 / 18.40 |         23 |
| INC-025  |      64.43 |     62.28 |    1986 |   119 |       0 |        27 |       12.15 / 18.53 |         24 |
| INC-026  |      65.67 |     63.80 |    1992 |   120 |       0 |        27 |       14.15 / 20.52 |         25 |

Across repeated campaigns, the corresponding INC-026 title baseline was:

| Pass         | Static MiB | Objects | Nodes | Resources | Cast histories | Texture / video MiB |
| ------------ | ---------: | ------: | ----: | --------: | -------------: | ------------------: |
| first        |      63.80 |    1831 |    78 |        28 |             25 |       22.06 / 28.59 |
| last+timeout |      64.46 |    1835 |    78 |        28 |             50 |       22.69 / 29.22 |
| middle       |      64.64 |    1836 |    78 |        28 |             75 |       22.52 / 29.05 |

The engine's peak static-allocation counter reached **74.93 MiB** over the three
campaigns and churn checks. The first pass warms fonts/glyphs and accumulates campaign
records; the next two add far less memory. Additional glyph/theme warming is a suspected
contributor to the texture-memory steps, not a measured attribution of every byte.

Local graph: [campaign curve](../../.qa/performance/campaign-curve.png).

| Lifetime check    | Observation                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Screens           | Main has three children at settled baselines: current screen, CRT overlay and sound node; transient replacements/Act cards raise this to five. No growing stack of screens observed.                         |
| RichTextLabels    | First-pass incident ends have 9–12 labels; title baselines return to zero. Status pages temporarily raise the count, then disappear.                                                                         |
| Nodes and orphans | Title baselines are 78–79 nodes; final fully settled title is 78. Editor checkpoints report zero orphan nodes; the release orphan counter is unavailable.                                                    |
| Audio             | Exactly seven AudioStreamPlayers throughout: six reusable cue players and one loop player (`sound.gd:29`).                                                                                                   |
| Tweens            | Temporary peaks occur during closely spaced screen/metric animations. After a two-second settle at the final title, zero remain.                                                                             |
| Act cards         | Each Act's backdrop appears while its card is alive. The card closes and is released; later title/episode censuses do not keep old Act texture nodes.                                                        |
| Ending textures   | All ten endings displayed three times. At the end of each cycle: one current ending texture, 29 nodes, 28 resources, zero tweens, exactly 71,011,294 static bytes. No retained ending-image ladder observed. |
| Status/People     | All four tabs opened/closed after every accelerated incident, plus 50 late People open/close cycles. After settling, the layer is absent and the ordinary record node/resource counts return.                |
| Cast caches       | Characters stabilize at 13, episode positions at 26. Heard-speaker histories grow 25 → 50 → 75 across campaigns; see PF-01.                                                                                  |

The settled counters support bounded UI/resource lifetimes in this sample. They do not rule
out allocations outside Godot's monitors or future histories that were not exercised.

## Exported executable

The title-first-draw marker was observed **1.89 seconds after
launch**, with 250 ms polling. This is an observed upper bound from one warm instrumented
launch, including process/PCK startup, not an average or cold-start guarantee.

The memory table uses the median OS samples in the final settled half-second before each
checkpoint. Alignment uses that title marker; uncertainty is approximately one polling interval.
No zero-valued release static-memory counter is interpreted as zero process memory.

| Exported checkpoint  | Working set MiB | Private bytes MiB |
| -------------------- | --------------: | ----------------: |
| Title                |          208.20 |            208.46 |
| After INC-001        |          210.24 |            208.18 |
| Late record: INC-026 |          221.12 |            213.63 |
| Late record + People |          225.62 |            227.73 |

Maximum sampled working set over the complete exported run: **227.22 MiB**; maximum sampled private bytes: **229.38 MiB**. These are separate maxima and need not occur together.

Local graph: [exported process memory](../../.qa/performance/exported-memory.png).

## Typing, reveal and rebuild timing

Percentiles use the nearest-rank convention. Frame times include the 120 FPS limit (nominally 8.33 ms), rendering, audio, OS scheduling
and probe overhead. The typing flag is captured at the frame boundary, so a transition can
be attributed to the adjacent typing state. Character counts include UI timestamps, spacing
and Korean word joiners, not just authored text.

| Wall-clock exported sample                          | Frames | p50 ms | p95 ms | p99 ms | Max ms | >33.33 ms frames |
| --------------------------------------------------- | -----: | -----: | -----: | -----: | -----: | ---------------: |
| Fast campaign reveal/controls including transitions |  92748 |   8.33 |   8.37 |   8.50 |  31.10 |                0 |
| Normal-speed INC-026 reveal/controls                |   6708 |   8.33 |   8.37 |   8.55 |  32.89 |                0 |
| All steady typing (fast plus normal)                |  42854 |   8.33 |   8.37 |   8.46 |   9.28 |                0 |
| Fast typing in INC-001–003                          |   2443 |   8.33 |   8.36 |   8.40 |   8.77 |                0 |
| Fast typing in INC-019–026                          |  13423 |   8.33 |   8.37 |   8.42 |   8.90 |                0 |
| Typing with ≥3,000 rendered feed/log characters     |   6752 |   8.33 |   8.37 |   8.47 |   9.03 |                0 |
| Normal-speed INC-026 typing only                    |   4481 |   8.33 |   8.37 |   8.53 |   8.88 |                0 |

Early and late fast typing both stay near the cap (p95 about 8.36–8.37 ms), with no sustained
late-feed slowdown observed on this host. Occasional layout/control transitions take longer;
the status/settings construction costs below are separate from steady character reveal.

The largest rendered feed/log character count was **4,628**. The normal-speed
probe runs up to 60 seconds of INC-026 from its beginning and automatically chooses controls
when ready. INC-026 finished within the limit in 55.9 seconds, without human reading pauses.

Rebuilds were measured in a fresh rendered editor process after constructing a complete
first-choice campaign. Eight language switches (English/Korean alternating) and eight text-size
switches (large/medium alternating) rebuild the completed INC-026 record. Call times include
setting persistence, theme creation, feed reconstruction, and settings-dialog reconstruction;
frame times additionally include layout/draw work. There is no imposed project performance SLO.

| Rebuild   | Calls | Call p50 ms | Call p95 ms | Call max ms | Surrounding frame p95 / max ms |
| --------- | ----: | ----------: | ----------: | ----------: | -----------------------------: |
| language  |     8 |       27.65 |       31.78 |       31.78 |                  52.28 / 57.20 |
| text_size |     8 |       28.91 |       31.44 |       31.44 |                  56.21 / 63.41 |

## Findings for Claude triage

### PF-01 — P3 — Heard-speaker cache retains obsolete campaign histories

- Location: `godot/scripts/story/cast_book.gd:18`, `godot/scripts/story/cast_book.gd:49`
  and `godot/scripts/story/cast_book.gd:51`.
- Reproduce: in one process, complete different campaigns and open later status/People views.
  Observe `CastBook._heard.size()` across the three routes. For an isolated key-retention
  check, run `cache_probe.gd` against the QA save with `--cache-probe`. It clones a valid
  INC-001 record, changes only its retained resume-timer value 1,000 times, and requests its
  speakers. This last step is synthetic; it is not 1,000 completed campaigns.
- Expected: a cache bounded by current campaign records/episode IDs; discarded histories and
  changes to timer metadata should not retain equivalent speaker results indefinitely.
- Actual: 25 → 50 → 75 histories after ordinary different routes. The synthetic check
  retains **1001** entries for one incident, with about
  **0.91 MiB** additional engine allocation
  including probe overhead. Another 100 identical lookups add no entries.
- Suspected cause: `_heard` is static, keyed by incident plus the hash of the entire record,
  and never evicts old keys. Resume timer values affect the hash although replay ignores them.
- Proposed fix: keep at most one `{fingerprint, speakers}` entry per incident, fingerprinting
  replay-relevant carry/inputs; replace it on change and clear on campaign reset. Add a small
  cache-bound regression test when implementing the fix.
- Impact: slow session-lifetime cache growth across histories. Its measured size does **not**
  explain the earlier OS low-memory kill; no such causal claim is made.
- Claude decision: **accepted** as proposed. `CastBook._heard` now holds one `{key, speakers}` entry per incident ID, keyed by a hash of what replay reads (`content`, entry carry, inputs), and replaces it when the record changes; resume timers and notices no longer make entries. The cache is bounded by the number of incidents, so no reset hook is needed. Regression test: `_heard_cache()` in `godot/tests/save_recovery.gd` (200 timer changes leave one entry; a changed record replaces it).

### PF-02 — P3 — Late-record settings changes synchronously rebuild the whole UI

- Location: `godot/scripts/ui/main.gd:1172`, `godot/scripts/ui/main.gd:1668`,
  `godot/scripts/ui/main.gd:1675`; supporting theme construction at
  `godot/scripts/ui/theme_builder.gd:47`.
- Reproduce: open the completed INC-026 record, change language repeatedly between Korean and
  English, then change text size between medium and large. Use the fresh `--cost-only` run
  to reproduce the call/frame table above.
- Expected: a settings change avoids a noticeable main-thread hitch; 16.67 ms is an
  illustrative 60 FPS comparison, not an adopted project acceptance threshold.
- Actual: slowest measured setting call **31.78 ms**,
  with a surrounding frame as high as **63.41 ms**.
  This is a brief settings interaction cost, not sustained typing slowdown or a memory leak.
- Suspected cause: the setting handler writes preferences, builds a new theme, constructs a
  new episode screen, rerenders every visible feed entry, and reopens the settings dialog
  synchronously. These timings do not isolate which sub-operation dominates.
- Proposed fix: first profile theme creation, translated BBCode generation and layout
  separately. Reuse themes per text-size setting and cache rendered entry markup per language
  where evidence supports it; spread genuinely expensive rebuild work across frames if needed.
  Product changes remain for Claude to decide and implement.
- Claude decision: **accepted** (2026-10-29), first two steps. Profiled in a QA copy (headless, completed first-choice campaign, INC-026 record, 8 changes each): theme creation ran on _every_ setting change, sliders and toggles included, and re-themed the whole tree. Now only language and text size touch the screen, and the theme for each size is built once and reused (`godot/scripts/ui/main.gd:1395`, `:1967`). Median call: language 68 → 40 ms, text size 62 → 40 ms, music slider 6.1 → 0.7 ms, CRT toggle 6.1 → 0.4 ms. What remains of a language/size change is re-rendering the record's feed (about 26–42 ms on a late record); spreading that over frames is deferred as disproportionate for a one-off settings action.

### PF-03 — P3 — Late People/status opening has a repeatable frame hitch

- Location: `godot/scripts/ui/main.gd:1230`, especially `godot/scripts/ui/main.gd:1265`
  through the four eager status-page constructions; portrait loading at
  `godot/scripts/ui/main.gd:1464`; cast context lookup at
  `godot/scripts/story/cast_book.gd:49`.
- Reproduce: complete the campaign, open INC-026 as a record, and open People. Repeat
  open/close 50 times with a process frame between actions, as the fresh cost probe does.
- Expected: opening a status page avoids a noticeable frame hitch; there is no project SLO,
  so this is a polish finding using 16.67 ms as an illustrative 60 FPS budget.
- Actual: the exported late-record open frame was 38.22 ms and the first People open frame
  was 81.19 ms. In the separate 50-open cost-probe phase, all 50 opens yielded a frame over
  33.33 ms; the phase p95 was 86.39 ms and maximum 189.79 ms. Node/resource counts recover
  on close, so this is construction cost rather than retained status windows.
- Suspected cause: `_open_status` computes cast context and constructs all four tab pages,
  including the full People/portrait tree, synchronously even when another tab is selected.
  Records are serialized for cache fingerprints on context lookups. The measurements do not
  attribute a percentage to text layout, portrait loading, serialization, or file persistence.
- Proposed fix: profile those sections separately; construct inactive tab contents lazily and
  consider bounded portrait/context reuse if the profile supports it. Verify both initial and
  repeated opens after any change. No UI changes were made in this brief.
- Claude decision: **accepted** (2026-10-29). Profiled: loading the 14 portraits from disk was most of the People cost (about 3 ms each), and every open built all four pages. Pages are now built when their tab is first shown (`godot/scripts/ui/main.gd:1504`), and portrait textures are kept once loaded, one per cast member (`main.gd:1732`). Same QA probe, 20 opens each: Status tab 101 → 15 ms median; People 112 → 24 ms median (68 ms on the very first open, when the portraits load). Cast context lookup itself measured about 2 ms and was left alone.

## Verification and artifact inventory

| Command/check                                      | Result                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm.cmd run godot:build`                          | Exit 0; 26 episodes exported and unsigned Windows executable/PCK produced.                                                                                         |
| QA import and isolated PCK export                  | Exit 0; runtime PCK uses the QA application name and measurement autoload.                                                                                         |
| Three accelerated campaigns                        | 78/78 incident completions; `PF DONE failures=0`; no script errors in the retained successful runtime stderr.                                                      |
| Exported wall-clock campaign and typing sample     | Exit 0; `PF DONE failures=0`.                                                                                                                                      |
| Fresh rebuild/status/ending probe                  | Exit 0; `PF DONE failures=0`.                                                                                                                                      |
| Clean synthetic cache probe                        | Exit 0; 1,000 record variants; no script errors.                                                                                                                   |
| `npm.cmd run check`                                | Exit 0; format/lint/types, 142 scenarios, story/locale/freshness checks, 67 files / 850 tests, 5 release-harness tests and web build; existing chunk-size warning. |
| Player save/settings hashes and modification times | Match before/after; no normal player files changed during measurement.                                                                                             |
| `git diff --check` and report formatting           | Checked after the report was assembled.                                                                                                                            |

The known host certificate-store diagnostic appears in engine startup/import/export logs.
Successful runtime runs otherwise have no script errors or shutdown resource-leak diagnostics.
The probe explicitly stops audio and frees its scene before quitting; that does not replace a
normal-window-close audit of the production audio shutdown path.

Raw evidence: `build.log`, `export-import.log`, `export-pack.log`, `executable-hashes.json`,
`accelerated.stdout.log`, `accelerated-recovered.jsonl`, `accelerated-process.csv`,
`realtime.{jsonl,stdout.log,stderr.log}`, `realtime-frames.csv`, `realtime-process.csv`,
`realtime-startup.json`, `cost.{jsonl,stdout.log,stderr.log}`, `cost-frames.csv`,
`cache-clean.log`, `check.log`, and the player-file manifests. `analyse.py`, the two plot
scripts, `performance_probe.gd`, `cache_probe.gd`, `prepare.mjs`, and `watch.ps1` provide
the local measuring/reproduction code. Artifacts from aborted pilots and the failed
supplementary harness attempt are excluded from passing results.

## Structured task result

```yaml
task: performance
brief: docs/codex/2026-10-26-performance.md
branch: codex/performance
result: pass_with_observations
scope: report_only
accelerated_campaigns: 3
accelerated_incident_completions: 78
exported_wall_clock_campaigns: 1
exported_incident_completions: 26
exported_typing_setting: fast
normal_typing_sample_max_seconds: 60
normal_typing_incident_finished: true
build_exit_code: 0
exported_exit_code: 0
repository_check_exit_code: 0
monitor_period_frames: 120
low_memory_termination_reproduced: false
findings: [PF-01, PF-02, PF-03]
independent_review: pending
game_code_changed: false
canonical_project_state_changed: false
changes_committed: false
pushed: false
published: false
```

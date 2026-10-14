# TASK-034 — Measurement and local review packaging candidate

## Completed scope

DEC-063 records approval of the exact delivery proposal at `7b91e50`. Added:

- `scripts/benchmark-task034.mjs`: complete-source admission, accepted operational
  route generation, strict ordinary/long qualification, two warmups and 20 measured
  samples, nearest-rank p95, isolated fake-indexeddb ledger/session timing and explicit
  native-pending results. No synthetic display ACK, edited score, baseline completion
  grant, user-profile database or latest-authority fallback.
- Generated evidence checkpoint support under fresh `.qa/task034/evidence/` folders,
  exclusive writes and retained operations/hashes. This final checkpoint-writing
  revision was syntax-checked, not rerun; its runtime I/O remains unverified.
- `scripts/task034-support.mjs` and four dedicated Node harness tests for percentile,
  nonqualifying/inherited-completion rejection, fail-closed preflight and review overlay boundaries.
- Separate `vite.review.task034.config.ts` and
  `src-tauri/tauri.review.task034.conf.json`: real production frontend, isolated
  `.qa/task034/web` / `.qa/task034/target`, qa034 label/data directory, review-only
  identifier, unsigned current-user NSIS and preinstalled WebView2 only.
- Review build command with compiler/admission guards, offline/locked Cargo,
  no signing, installer-size/hash reporting and no installer/app launch. It is
  **blocked before bundler invocation** pending complete tool inventory/acquisition.
  Finding two files alone is intentionally not sufficient to allow auto-downloads.

Production Tauri/security configuration, lockfile bytes, old authorities/profiles
and all user stores are preserved. No installer, native binary or release has
been produced by this step; only the isolated web output exists.

## Build-readiness corrections

The initial typecheck failed because an audio cue test asserted an incomplete
operation as a full `CampaignCommittedUpdate`. Supplied complete typed fixture
operations instead; no production audio/engine behavior changed.

The initial whole-campaign validator failed. Detailed validation identified
`initial.alignment` and `initial.alignment.null`: the unquoted YAML key `null` in
TASK-028's authoring input parsed as a null key and serialized to an empty string
in the new unreleased definition. Quoted that key and corrected only the runtime
initial key from `""` to `"null"`; both approved numeric initial values remain zero.
Added a generator guard and adapted its deferred reproducibility assertion to
the corrected key. The historical frozen composition was not overwritten. No
previous valid recorded run or legacy authority was reinterpreted.

Corrected the authoring guide's earlier Node-test command: its authoring tests
import Vitest, so the documented command now uses `npm test -- ...`. Those
authoring tests were **not executed** as part of this bounded verification.

## Actual checks and artifacts

Raw command outputs, including failures, are retained in
[scoped-checks-raw.json](../.project-os/planning/TASK-034.scoped-checks-raw.json).
They identify a dirty worktree based on `7b91e50`, not a falsely clean final binary.
The [final scoped checks and interruption log](../.project-os/planning/TASK-034.final-scoped-checks.json)
retain the final four-test/compiler/validator results and observed partial progress.
The [web-only manifest](../.project-os/planning/TASK-034.web-artifact-manifest.json)
records actual file sizes, SHA-256 values and config/lockfile hashes, not an installer.

| Check                         | Observed outcome            | Scope/limitation                                                                                                               |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Initial typecheck             | Failed TS2352               | Audio test fixture; preserved failure                                                                                          |
| Initial scenario validation   | Failed incomplete package   | Detailed schema diagnosis identified alignment serialization                                                                   |
| Corrected typecheck           | Exit 0                      | Compiler check, not independent review or native gameplay                                                                      |
| Corrected scenario validation | Exit 0, 64 files            | Complete source admission; not 26-Incident/ten-ending acceptance                                                               |
| Dedicated harness tests       | Initially 3, final 4 passed | Isolated utility/config checks, not actual Windows timing/memory certification                                                 |
| Review web build              | Exit 0, 305 modules         | `.qa/task034/web`; no Tauri binary/installer                                                                                   |
| Vite size warning             | Retained                    | Main JS about 679 kB; full-campaign JS about 2196 kB; no warning limit adjustment                                              |
| NSIS preflight                | Blocked, terminal exit 1    | No bundler invocation, download, install or profile access                                                                     |
| First benchmark attempt       | Failed rejected command     | Typo `UPDATE_SIGNING_KEYSET`; fixed by using existing exact replay fixture `UPDATE_VERIFIER_KEYSET`                            |
| Corrected benchmark attempt   | Incomplete/interrupted      | Progress reached all 26 operational completions and ordinary replay trial 16/22; no complete raw sample series or p95 retained |

The corrected measurement process was explicitly stopped by its verified PID
before handing off the missing-tool gate; it is not left running in the background.
This interruption is **not a failed budget or a PASS**. Ordinary/long timing,
transactional recovery, 104-attempt/1000-command qualification, native storage,
archive paint, cold startup and memory budgets all remain unresolved. No smaller
fixture, estimated wall-clock speed or truncated run substitutes for those checks.
The checkpoint-output enhancement was added afterwards to retain complete datasets
and finished sample series even if a later phase cannot finish; rerun is required.

## Changed files

DEC-063 and task reference, review config/Vite config/npm scripts, measurement/build
utilities/tests, the quoted authoring input/runtime alignment key/generator guard
and test fixture corrections, documentation and raw candidate evidence. This report
does not submit self-approved task completion or modify immutable accepted results.

## Known risks and remaining work

Missing NSIS/compiler plugin inventory requires explicit acquisition approval;
automatic Tauri bundler downloads were prevented. Benchmark runtime can be lengthy
because the approved engine verifies complete history repeatedly; do not bypass
verification, trim history or claim measured budgets from generation progress.
Large web chunks remain a warning and native load/render cost is not established.
Review profile resolution, compiler/native/installer output, actual source/license
clearance, full regression/reveal/ending coverage and independent evaluation remain
pending. The capability/security configuration is preserved, not newly certified.

TASK-024/025, TASK-027–034 and M4/M5 final acceptance remain incomplete. Native
launch, Windows/Narrator/audio checks and install/upgrade/uninstall execution are
still separately gated. No push, publication, signing or release approval.

## Next step

Decide whether to acquire only the exact official NSIS/bundler tools required by
the installed pinned CLI, after verifying provenance/integrity, or keep installer
generation blocked. Preserve this evidence. Then rerun the staged measurement
candidate with its fresh evidence checkpoints and report complete samples/failures;
do not mark TASK-034 complete from web output or proposal approval.

# TASK-034 — Performance and local delivery proposal

**Proposed, not approved or implemented. No measurements or packages exist from
this step.** DEC-062 allows this document and authoring/support guidance only.
The exact scope and limits are in
[delivery-proposal.yaml](../.project-os/planning/TASK-034.delivery-proposal.yaml).
Approval must identify the committed proposal, not an unstated later revision.

## Proposed benchmark contract

Qualify Windows 11 x64 with at least four logical cores, 8 GiB RAM, a local SSD
and preinstalled Evergreen WebView2. Record exact OS build, hardware, available
memory, power mode, runtime/toolchain versions, commit and lockfile/config hashes.
This defines a candidate qualification target, not demonstrated minimum system
requirements or a claim for every machine meeting those numbers.

Use 20 measured warm trials after two separately reported warmups and five
independent cold starts. Nearest-rank p95 is the sorted sample at
`ceil(0.95 * count)`, indexed from 1. Preserve raw samples, failed trials, dataset
identity and full measured boundary. Real monotonic elapsed time measures the
implementation; it never enters simulation state or advances action-driven time.

Commit warmups/trials are new valid operations on an in-progress attempt; retain
their actual history and report starting/ending counts. Do not overwrite/rewind
the baseline to reuse a timing sample. Steady memory is nearest-rank p95 after
the first 60 seconds; peak is the maximum aggregate sample over all five minutes.

| Boundary                                 | Proposed limit                 | Required workload                                                                                                    |
| ---------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Complete package admission, cold         | maximum 5 s                    | Explicit Full route click to selectable complete package paint                                                       |
| Ordinary campaign replay                 | p95 5 s                        | Genuine sequential 26-Incident operations and observed investigations/ACKs                                           |
| Long campaign replay                     | p95 15 s                       | At least 104 attempts and 1000 accepted action commands                                                              |
| Long ledger restore and view publication | p95 20 s                       | Real record read/replay verification; native paint measured separately                                               |
| Ordinary action commit                   | p95 500 ms                     | Submission, transaction completion and verified view publication                                                     |
| Long-history action commit               | p95 2.5 s                      | Same boundary on qualifying long record, retaining all history                                                       |
| Long-history archive display             | p95 500 ms                     | Selection to native visible paint, including 150% text                                                               |
| Default desktop cold startup             | maximum 5 s                    | Actual process start to usable default MVP desk                                                                      |
| Memory                                   | steady 512 MiB / peak 1024 MiB | Five-minute long-record cycle; 1 Hz aggregate private working-set samples for app and identified WebView descendants |
| Local review installer                   | at most 100 MiB                | Unsigned NSIS, no bundled WebView runtime                                                                            |

These are initial human-review targets, **not data-derived results**. Whole-history
replay, repeated verification, large definitions and long React archives may fail
them. Do not narrow datasets, discard outliers, delete retained attempts, increase
limits or bypass source verification to make a report green. An invalid or
unreachable qualifying dataset blocks the benchmark; a smaller fixture is not a
replacement. Node/fake-indexeddb timings are not native storage/render evidence.

Dataset generation must use accepted engine operations. No fabricated completion,
unobserved recommendation responses, edited player models or copied projection
caches. Record all seeds, operations and hashes. Ordinary and long runs are not a
substitute for the separate ten-ending, reveal-pacing and negative-route audits.
Abort/conflict/lost-ACK correctness remains mandatory even when a timing is fast.
External WebView processes that cannot be attributed are an explicit memory
measurement limitation, not an unreported zero. A failed budget blocks readiness;
an optimization that changes architecture or saves needs its own gate.

## Proposed local package

Build a **review-only Windows x64 current-user NSIS installer**, unsigned, under a
separate identifier `com.vantage.orpheus.qa.task034` and product name
`Orpheus Review - TASK-034`. Keep production `com.vantage.orpheus` and
`src-tauri/tauri.conf.json` unchanged. Use a separate overlay, output roots
`.qa/task034/web` and `.qa/task034/target`, window label `qa034`, and relative
data directory `task034-release-v1`.

The expected isolated WebView profile is
`%LOCALAPPDATA%\qa034\task034-release-v1`, following the previously observed
installed Tauri label-relative resolution. **Verify the installed resolution
before any launch**; a different path requires another human decision. Do not
delete/reset the profile, reuse qa024 evidence, alter the main user profile or
invent native restore success from a fresh empty run.

The installed CLI schema describes NSIS `installMode: currentUser` and WebView
installation mode `{type: skip}`. Those are proposed overlay choices, not applied
configuration. Require preinstalled WebView2; do not download/install/update a
runtime. Reuse the real production entry, existing exact campaign data and default
MVP behavior; no fixture replacing the game to make package checks pass. Do not
add capabilities, change CSP or relax Windows security. Existing configuration
has `csp: null`; retaining it here is **not a new security certification**.

No signing certificate, credentials, publisher/contact invention, updater,
telemetry, upload or distribution. Missing packaging tools or blocked security
prompts require separate authority. Do not silently fetch a toolchain or disable
antivirus/SmartScreen. An unsigned local artifact is not a public release.
No blanket project license grant is proposed; see
[preliminary rights inventory](ASSET_AND_LICENSE_INVENTORY.md).

If approved, implement the harness and overlay/build scripts, perform only the
explicit bounded TASK-034 measurements/build checks and generate/hash local
artifacts. **Installer execution, installation/upgrade/uninstall and native app
launch remain separately gated**. At present there is no overlay or npm packaging
command to run. Existing `npm run build:desktop` uses `--no-bundle`; it is not the
proposed installer. Missing compiler/schema-valid content blocks generation rather
than producing a stale binary or fixture fallback.

## Required artifact and measurement manifest

Future evidence must include the approved budget/proposal identity, candidate
commit and worktree state, build command/exit/output, exact npm/Cargo lock hashes,
toolchain and target, merged Tauri config/hash, frontend/binary/installer hashes,
file sizes, app/profile identities, dataset hash and attempt/command counts, raw
timing/memory samples, diagnostics and limitations. Keep failed measurements and
builds; do not store invented values in a PASS record. Build reproducibility means
repeatable documented inputs/commands and verified behavior; byte-identical
installers are not claimed without addressing tooling/timestamps separately.

After later native/install QA authorization, independently verify fresh isolated
install, actual profile resolution, upgrade preservation, restart/restore, audio,
keyboard/Narrator, 960x640/150% text and uninstall data behavior. Reinstalling the
same candidate does not establish backward upgrade compatibility. Do not remove
user data to simplify an uninstall test. Changing package version or introducing
an upgrade predecessor requires reviewed identity/compatibility choices.

## Decision requested

Approve the exact proposed budgets, qualification target and local review package
scope with bounded TASK-034-only measurement/build permission, or revise them.
The other QA deferrals, unaccepted tasks, M4 closure, TASK-035 dependencies and
independent/native/final release obligations remain unchanged. Budget approval
cannot itself grant task completion, installer execution, push or publication.

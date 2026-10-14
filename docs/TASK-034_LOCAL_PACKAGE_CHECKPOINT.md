# TASK-034 — Verified tooling and local review installer

## Completed

DEC-064 records approval of the missing-tool gate at `8f52183`. The exact installed
CLI 2.11.5 binary contains the URLs and upstream hash constants from the
[pinned Tauri release source](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.11.5/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs).
Acquired only the official NSIS 3.11 archive and Tauri utility plugin 0.5.3.
TLS and the upstream SHA-1 checks were retained; measured SHA-256 values are
recorded separately, not claimed as an independent vendor signature.

The new acquisition utility extracts into fresh `.qa/task034/tools/acquisition-*`
staging, rejects unsafe archive paths, checks required contents, inventories files
and moves only into the previously absent exact NSIS cache. It refuses existing
unexpected caches; no deletion/replacement, profile reset, registry install or
security bypass. The corrected plugin location includes `additional/`, unlike
the earlier incomplete probe. Preflight now verifies the full manifest and 442
file hashes plus pinned CLI/plugin identity before allowing the bundler. The
verified manifest hash is pinned in the repository too, so the cache cannot
approve its own changed executable hashes by editing its manifest.

Added `npm run tools:task034:nsis` for explicitly authorized acquisition. Do not
rerun it to overwrite a cache: a verified existing cache is read by the build
preflight; the acquisition command deliberately rejects an existing target.

## Actual build result

`npm run build:review:task034` completed using offline/locked Cargo and the existing
isolated review configuration. The five dedicated harness tests passed; the
compiler/admission guards passed, with 64 Scenario/source files checked.
The release target compiled in 1m39s and NSIS generated one unsigned x64 bundle.
Vite's large-chunk warning and Rust's linker-message warning were retained, not
suppressed. No unrelated dependency/toolchain download, signing or WebView2 runtime
installation was performed.

| Local artifact                                  | Actual size     | SHA-256                                                            |
| ----------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `orpheus-desktop.exe`                           | 8,801,792 bytes | `170be8e11e64fb8dd936c993b23e746940ca7e745bb6e85e15ad10798c602120` |
| `Orpheus Review - TASK-034_0.1.0_x64-setup.exe` | 2,059,715 bytes | `34055e9baa3543938938043d298136608e0b1024fade0a8269dbe00291118f31` |

Files are in `.qa/task034/target/x86_64-pc-windows-msvc/release/`, with the installer
under `bundle/nsis/`. The installer is below the approved 100 MiB artifact limit.
Generation is not installation, functional native verification or release.

[Local package manifest](../.project-os/planning/TASK-034.local-package-manifest.json)
contains exact file/config/lock/tool hashes and profile derivation.
[Raw build output](../.project-os/planning/TASK-034.local-package-build-raw.json)
preserves the actual commands, warnings and successful exit. The base candidate
is `8f52183` plus the recorded dirty tool/preflight changes at build time; these
artifacts are not misrepresented as produced from a later clean commit.
Production config hash and npm/Cargo lock hashes remain unchanged.

Generated NSIS source selects `currentUser` and has no WebView2 installer payload.
The installed Tauri 2.11.6 source derives the profile from LocalAppData, window
label and relative data directory; Wry consumes that path. This read-only source
inspection matches `C:\Users\limse\AppData\Local\qa034\task034-release-v1`.
That profile did not exist when checked. No app/installer was launched, and no
actual WebView profile observation, installation or upgrade success is claimed.

## Bounded measurement result

The resumed Node run generated all 26 operational completions in order: 105
accepted action commands, 132 ledger operations and no fabricated ACK/sample.
Its exact retained ordinary record hash is
`d7d923b511b0611d502814e7b001cb171e95ccfd7ef7d15819b78b480ae785fe`.
Both warmups and all 20 ordinary replay timings completed and were retained.
Nearest-rank p95 was **3077.916 ms**, within the development comparison against
the approved 5000 ms target. This is **Node development-only**, not native Windows certification.

[Ordinary replay evidence](../.project-os/planning/TASK-034.ordinary-replay-measurement.json)
retains provenance, raw timings and exact source hashes. Full operations remain
in the identified local `.qa/task034/evidence/` checkpoint. Untimed memory-DB
seeding was interrupted at the next readiness gate; the verified own Node process
was stopped, no job was left running and no completed timing series was discarded.
No commit/load/long-run budget was measured by this result. Long 104-attempt/1000-
command qualification, transactional boundaries, native storage/paint/startup and
memory remain pending. No smaller dataset substitutes for the long requirements.

## Changed files

DEC-064/task reference, exact tool metadata and acquisition/extraction utilities,
manifest-based preflight, five-test harness, npm acquisition entry, budget-failure
handoff guard, raw package/measurement evidence and documentation. No Scenario,
engine, model, save schema, production security or user-profile changes this step.
The benchmark guard stops later phases only after retaining all required samples
if their development comparison is exceeded; it does not relax any threshold.

## Remaining work and next gate

TASK-034 is **not accepted or complete**. Native/install/upgrade/uninstall QA,
full long-run measurements and recovery boundaries, rights/notice clearance,
independent review/QA and distinct evaluation remain mandatory. The preliminary
license inventory is not publication clearance. M4 and earlier M5 tasks remain
incomplete. No push, upload, updater, production install or release approval.

TASK-035 still requires completed TASK-025 and TASK-028–034. Preparing an evidence
gap map before those acceptances needs an explicit readiness/scope exception.
The proposed exception covers preparatory documentation only, never final QA,
self-acceptance, milestone closure or release; otherwise retain existing readiness.

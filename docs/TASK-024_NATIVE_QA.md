# TASK-024 — isolated native QA candidate

Status: separate QA entry built, **not launched or native-certified**. DEC-034
approved a fixture-only application/profile, but local Tauri source inspection
found a concrete path discrepancy. Resolve the
[path gate](../.project-os/planning/TASK-024.native-path-resolution-gate.yaml)
before launch. Existing TASK-024 implementation/evidence is preserved.

## Completed / changed files

- `qa/task024/index.html`, `src/qa/task024-main.tsx` and `NativeQa.tsx` provide an
  explicitly invoked test-only entry. Normal `src/main.tsx` does not import it.
- `vite.qa.config.ts`, `scripts/build-task024-qa.mjs` and
  `src-tauri/tauri.qa.task024.conf.json` separate QA frontend and Cargo outputs
  under `.qa/task024/`. Default config, scripts, Rust runtime and normal binary
  are unchanged. No capabilities or security settings were changed.
- QA label `qa024`, identifier `com.vantage.orpheus.qa.task024`, title
  `Orpheus QA - TASK-024`, 960×640 initial/minimum size, relative dataDirectory
  `task024-fixtures-v1`. No bundle or installation.
- Explicit fresh fixture creation uses a new `qa024-<UUID>` run and commits
  replay-validated prefixes through the real ledger. A QA-only local pointer
  supports explicit restoration, without rewriting prior runs or legacy slots.
  No storage is opened by component mount. No automatic creation/restoration.
- Authored guidance is initially gated off and unlocks after an actual
  information action. QA-only diagnostics show verified revision, ACK/response
  counts and sample counts, not a production hidden-variable dashboard.
- Reload/create/restore/back paths cannot discard a busy or pending operation.
  No fake IndexedDB is imported by the entry. The test injects a fresh factory.
- `.qa/` is ignored by Git, formatter, linter and test discovery as generated
  artifacts. All real source tests remain included; worker/time limits unchanged.

## Build and test evidence

Build explicitly, without running the application:

```powershell
node scripts/build-task024-qa.mjs
```

The script sets `CARGO_TARGET_DIR` only in its subprocess and builds the override
with `--no-bundle`. Result: `.qa/task024/target/release/orpheus-desktop.exe`.
First separate release build passed in 1m 59s; web output passed with 220 modules.
The existing chunk warning and native linker warning are retained, not failures.
That first build preceded the final pending-operation UI guard and is not the
final binary verification checkpoint.

The new automated fixture test verifies inert mount, initial reveal gate, visible
confirmation, matching `0/1`, explicit restore preserving ACK/response identity,
and untouched legacy sentinel. Focused test passed in 4.09s; initial default full
suite passed **410 tests / 29 files**, 47.54s. These are DOM/fake-IDB checks, not
actual native durability observations. Final checks after generated-output
exclusions are recorded in the follow-up checkpoint below.

Final pre-launch checkpoint: the default full suite passed again, **410 tests /
29 files**, 34.02s, with generated artifacts excluded and original two workers /
timeouts unchanged. Typecheck, lint, formatting and eight scenario validation
files passed. The updated separate release binary built in 41.38s; QA frontend
passed with 220 modules, 524ms and 553.32 kB warning retained. No native UI or
durability PASS is inferred from these builds. Independent review/QA for the new
entry itself remains pending; earlier independent records name `6b1a8fce` only.

Failure history retained:

1. ESLint required component/entry separation; components were moved to
   `NativeQa.tsx`, preserving the rule.
2. Initial new test used an incorrect assumed log button title/duration;
   corrected to authored `Open Payment API logs (+30s)`. No content/action change.
3. After the native build, lint tried to parse a generated Cargo embedded asset.
   Added only `.qa/**` generated-output exclusions. No real source/test excluded.
4. An invalid combined move/add patch was rejected without changing files;
   corrected with two valid patches.

## Known risk and remaining work

Installed `tauri-2.11.6/src/webview/mod.rs` resolves the configured relative path
as `dirs::data_local_dir()/qa024/task024-fixtures-v1`. It does **not** use the
identifier-qualified `app_local_data_dir()` described in the prior gate. The
exact actual Windows path is `%LocalAppData%\qa024\task024-fixtures-v1`.
This was learned from local source, not from opening or inspecting user profiles.
Neither QA nor normal native application has been launched in this work.

Computer-use initialization and lightweight inventory succeeded; no matching
Orpheus window was returned. This is not a native-pipe failure. Screen capture,
native inputs and profile creation remain deferred.

Native gated display → durable ACK → valid action → WebView/process restart
preservation, 960×640, 150% text, keyboard/reduced-motion and archive inspection
remain required. Final independent review/QA/evaluation must name the final
candidate and separate automated from directly observed native evidence.
TASK-024 stays active, TASK-025 unclaimed and M4 active. No push/release or user
storage mutation, profile reset, production late-act reveal, ending grant or
actual REWRITE is performed.

## Next recommended step

Choose the actual isolated profile path at the human gate. Do not launch the
current binary before that decision. No native requirement is waived.

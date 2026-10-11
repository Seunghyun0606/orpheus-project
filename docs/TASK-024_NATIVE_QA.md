# TASK-024 — isolated native QA candidate

Status: **partial native verification; desktop locked before restoration**.
DEC-034 approved a fixture-only application/profile and DEC-035 subsequently
approved the installed label-relative path. The original unlaunched checkpoint
and path discrepancy remain below as historical evidence. Full native acceptance
is still pending; existing TASK-024 implementation/evidence is preserved.

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

That recommendation described the `376f166` pre-approval checkpoint. The human
subsequently approved DEC-035 and the bounded native run proceeded as follows.

## Direct native resume and current next step

Root selected only the uniquely returned QA window for the verified binary.
Fresh run `qa024-43941b8b-04bc-43d7-9df8-0407e2b9a704` at revision 5 showed an
actual 960×640 viewport and no ACK/response samples. The authored gate initially
hid guidance; inspecting logs advanced 30 seconds and opened the gate (revision
6). Preparation displayed RESTART_API / 100.0% without ACK or sample (revision
7), blocking actions. Actual visible confirmation committed revision 8, ACK 1 /
response 0, showing durable status and enabling actions. This demonstrates the
native pre-response path, **not** post-restart durability or a response sample.

Native inspection found poor active-button contrast on Windows defaults. Scoped
campaign/QA button colors, padding and dashed disabled borders corrected this in
`9719e06`. No gameplay, normal app initialization, profile contract or security
setting changed. Typecheck/lint and 7 focused component tests passed (5.38s);
the corrected QA binary built in 30.69s, web in 154ms / 220 modules. Its SHA256 is
`B3D18D065B323E67A29962C6CE4987240AC386FD7666A4B66646DF7CF1CD8E54`.

After no pending operation was visible, root closed only the QA window and
confirmed its absence in a subsequent inventory. The corrected binary restarted
with readable controls and no automatically loaded run. The restore click was
refused because user input had been detected; root re-observed before retrying.
The screenshot then showed the Windows lock screen despite stale QA accessibility
text. Per computer-use's locked-desktop rule, all native input stopped immediately.
No restoration success or native accessibility PASS is inferred from stale text.

The [direct observation checkpoint](../.project-os/planning/TASK-024.native-qa-checkpoint.yaml)
retains candidate/hash/run/window identities, successful steps, readability defect
and incomplete scope. Root observations are not an independent agent's execution.
Next: unlock Windows and re-observe the uniquely returned QA window, restore this
existing run (do not create another), then verify ACK/reload/response preservation,
150% text, keyboard, reduced-motion and read-only archive. Independent final
acceptance remains required; TASK-024/025 and M4 are not complete.

Independent recheck of `9719e06`:

- `codex-task024-domain-reviewer` passed the implementation candidate scope,
  directly checking installed path resolution and isolation; native outcomes
  are audited root observations, not independent input.
- `codex-task024-candidate-qa` directly passed the full 410 tests / 29 files
  (30.75s) and typecheck/lint/format/eight scenarios/normal web build/doctor/diff.
  Its first focused run had 29 passes and one pooled `2/12` timeout (5245ms
  against the unchanged 5000ms limit, 12.59s total). The same settings rerun passed
  all 30 / 4 files (9.22s). Preserve the failure; the cause was not established.
- These [review](../.project-os/planning/TASK-024.native-resume-review.yaml) and
  [QA](../.project-os/planning/TASK-024.native-resume-qa.yaml) records explicitly
  withhold full native acceptance. Actual restoration and accessibility checks
  cannot be replaced by the passing automated suite.
- Distinct `codex-task024-candidate-evaluator` audited the candidate and attributed
  evidence: bounded consistency PASS, full acceptance PENDING. Its
  [evaluation](../.project-os/planning/TASK-024.native-resume-evaluation.yaml)
  retains AC1/AC3/AC5 native gaps; it did not run tests or operate the native app.

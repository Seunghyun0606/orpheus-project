# Deferred M4/M5 verification execution plan

Planning under DEC-065 only, 2026-10-14. **None of the following commands or
checks is executed by TASK-035's preparatory step.** General/native QA remains
deferred. Read with [evidence gaps](TASK-035_PREPARATORY_AUDIT.md).

## 1. Candidate freeze and safe attribution

After explicit automated-verification resumption, select the actual clean source
candidate. Record full commit, tracked/dirt status, Node/npm/Rust/Tauri versions,
lock/config/tool/source hashes and command output/exit/timing. Rebuild only under
the approved bounded configuration. Do not relabel the 8f52183-plus-dirty installer
as a later clean build. Keep original failed/aborted evidence intact.

Make retained local operation checkpoints available to the distinct evaluator in
an approved local evidence location with hash/provenance and no personal save data.
No push/upload/profile reset is implicit. A source change found necessary gets a
new candidate; impacted evidence must be rerun or explicitly traced, not copied
as PASS. Unrelated user changes remain preserved.

## 2. Automated regression, once explicitly resumed

Run the unchanged commands with separate raw logs; report all failures before
repair/rerun. Do not increase test timeouts, shrink data or suppress checks to pass.

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:replays
npx vitest run src/tests/inc-002-replay.test.ts src/tests/inc-003-replay.test.ts
npm run validate:scenarios
npm run build
npm run build:desktop
npm run test:task034:harness
git diff --check
projectctl doctor
```

`test:replays` currently selects **INC-001 only**; the explicit INC-002/003 command
is needed alongside full-suite assertions. Validator's earlier 64-file count is
historical; record actual complete catalog/model/package checks, not just a count.
Native compilation is not native app execution or install QA. Missing tools or
security/profile conflicts stop the affected step, never trigger silent downloads.

## 3. Production histories and missing coverage

Existing deferred fixtures are inputs, not evidence. Inspect assertions and add
needed coverage within the approved contract before reporting readiness:

- Every Incident: genuine root-cause and contrasting temporary/delegated paths,
  temporary expiry, due events, dependency propagation, damage/cost/time and
  postmortem. Separate ordinary operational progress from optional clue collection.
- All 19 reveal rows in the audit: discovery plus negative predecessor cases;
  exact source/sidecar action gates, no locked-text/ID leak, later re-investigation,
  genuine prior-Act completed retry, absent/future/baseline-only rejection.
- Whole production run: all nine sequential Acts, preserved prior completions,
  effects once per run across approved alternatives, no old-model attachment,
  no fabricated initial completion or latest-version substitution.
- Ten **actual accumulated** ending routes using approved actions and real ACK/
  responses. Preserve operation logs, seeds and state hashes; compare deterministic
  replay/restore. Unit predicate score inputs are not route substitutes.
- Boundary/exclusion/tie/no-match/unavailable-reference/stale-head/wrong-final-
  authority checks, no automatic grant/prose; actual due-event final signals and
  resources separate from authored future reports; both epilogue gates and leaks.
- Actual ACK precedes valid response; manual recommended action also counts.
  Preparing/querying/reviewing archive/rejected actions supply no exposure/sample.
  Audit 0/1, 1/1 and pooled 2/12 prediction deviation plus abort/conflict/lost ACK.
- Legacy v1 records/frozen Scenario versions and localStorage keys remain exact;
  explicit verified-discovery adoption has no historical behavior/effect/completion.
  Confirmed checkpoint creates a new attempt, preserving original pooled history.

Production full-route tests must use the exact runtime package, not an isolated
renumbered Act fixture. If any legitimate ending/path cannot reach its approved
conditions, report a blocker with the failed history. A balance/schema/architecture
change needs human approval; do not tune thresholds silently.

## 4. Performance and persistence measurements

Use the unchanged DEC-063 proposal and recorded budgets in the audit. The existing
`benchmark:task034` harness supplies **development-only** measurements; preserve
unfinished checkpoint recovery rather than restart as if earlier work never ran.
Native measurement requires separate authorization and actual target capabilities.

Qualify ordinary 26-completion and long ≥104-attempt/≥1,000-accepted-action histories.
Archive exact operations and evidence; each measured command/warmup must be a new
valid accepted action on an in-progress attempt, preserving cumulative history.
Record 2 warmups and 20 warm samples, nearest-rank p95; five independent cold
samples and maximum. Keep every sample/failure; no gameplay-clock timings.

Measure pure replay, read+verify+publication, real durable commit and visible paint
as separate boundaries. Verify previous revision remains authoritative on abort/
conflict; same-identity retry after lost ACK never awards twice. Do not time a
memory adapter and claim native IndexedDB success. Retain start/end revisions,
operation identity and published-state checks with timings.

Native record: Windows 11 x64, CPU/power, RAM/load, local SSD/free space and installed
Evergreen WebView2 version. Sample process + attributed WebView descendants' private
working sets at 1 Hz for five minutes; preserve raw PIDs/data and explicitly account
for excluded shared runtimes. Steady p95 uses last four minutes, peak all samples.
All missing/invalid/exceeded budgets block acceptance without changing limits.

## 5. Separate native authorization and runtime feasibility

This plan does not permit native input or installer execution. Before authorized
work, read the applicable computer-use skill and inspect available native surfaces.
Do not promise control when native APIs/pipe are unavailable, the desktop is locked
or tool permissions prohibit native APIs; report the exact limitation and retain
pending checks. Browser/headless results cannot substitute for native evidence.

M4 restoration: preserve `%LOCALAPPDATA%\qa024\task024-fixtures-v1` and the existing
committed ACK. Verify corrected binary identity, actual restored revision/ACK,
eligible response, process/WebView reload and durable archive; a fresh run is not
restoration evidence. TASK-025 remains dependent on TASK-024 acceptance.

Full production review: use only the approved isolated TASK-034 review app/profile,
`%LOCALAPPDATA%\qa034\task034-release-v1`, unchanged main config/user stores. Static
Tauri path analysis matches it but must be confirmed in the actual authorized
runtime. Any path mismatch or unexpected existing state requires its own decision;
do not reset profiles or treat an identifier alone as isolation proof.

At 960×640 and 1280×800, text 100/125/150%, keyboard only, CRT off/reduced motion:
check Pager, commands/War Room, every investigation surface, archive/retry,
prediction ACK/error/recovery, postmortem and all ending sections. Check focus,
scroll/table readability, Narrator announcements, status/color alternatives and
absence of hidden values/progress percentages. Do not claim other OS/NVDA coverage.

Audio: default muted, fresh explicit activation even with remembered unmuted state;
six cue families plus visual equivalents, bounded voices/gain, mute and volume,
visibility/archive/exit silence, no replay of archived alerts. Verify live cues only
after verified durable commit; failed/retried writes must not produce false cues.
Record listening observations separately from mocked AudioContext tests.

Installer lifecycle requires a distinct isolated install/upgrade/uninstall approval
and recovery plan. Confirm current-user identity, preinstalled WebView2 (skip),
unsigned warnings, exact installation/profile targets and preserved stores; no
elevation/security bypass, silent main-profile install, signing or publication.

## 6. Independent handoffs and final transitions

Once resumed, DEC-039 permits distinct read-only reviewer, QA verifier and evaluator
for eligible M5 candidates; no implementation delegation is inferred. Attribute
each actor, candidate and direct vs audited observations. Retain original findings,
repairs, failed commands and limitations. The developer records handoffs faithfully;
no reviewer edits source or submits canonical transitions.

Content review must specifically assess four-Incident Board misdirection, NULL's
fallibility, retained executive responsibility, useful/harmful factions, investigated
reveals, title payoff and no privileged good/bad/true ending. Documentation review
must exercise authoring/support instructions and review actual shipped rights/notices;
preliminary inventory is not license clearance.

Acceptance sequence: complete attributed TASK-024 evidence/evaluation, eligible
TASK-025 and all four M4 criteria, configured M4 completion, then individual current
TASK-027–034 handoffs/evaluations and complete TASK-035 coverage. Audit all dependencies
again before final evaluation. The preparatory claim cannot satisfy missing evidence.
Use configured Project OS submission/evaluation transitions, not direct status edits.
Keep M5 closure and production release as separate human gates. No push or public
distribution follows automatically from passing QA, producing packages or closing M5.

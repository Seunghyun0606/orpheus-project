# TASK-035 runtime presentation implementation checkpoint

2026-10-15. DEC-068 approves the reviewed new-only contract. Source candidate
`100c79a`, repaired candidate `c64d7ba`. **Implementation exists; acceptance is
blocked.** No task/milestone state, old save, user profile or release was changed.

## Completed

Added explicit full-campaign package/definition/prose 1.1.0 and 26 schema-2 views.
All 60 protected existing files retain exact byte counts/hashes. Scenario, model,
effect and ending semantics remain unchanged; old 1.0.0 runs keep their original
views and limitations, without automatic upgrade or latest-version selection.

Verified history now projects actual triggered narrative bodies, initial/delivered
War Room messages, simulated delegation ETA and capacity. Only an exact new owning
command at the published head beyond the read boundary can deliver a notice.
INC-001's normal notice expires 800ms after visible paint; reduced motion holds it.
Recorded text remains readable after dismissal. Load/archive/hidden/context changes
clear notices without ACKs, actions, effects, behavior samples or extra audio cues.

## Changed files

Schema and additive YAML authorities; pure investigation/stream/delivery modules;
transient store read observer; campaign tools/entry/notice UI; queue, authoring,
isolated fixtures and regressions; DEC-068 reference, README and checkpoint records.
The [structured result](../.project-os/planning/TASK-035.runtime-presentation-implementation-checkpoint.yaml)
maps V1–V12 coverage and remaining gaps. React best-practices checks guided cleanup,
scoped snapshots before paint and accessible, nonmodal history recovery.

## Tests

Independent QA `/root/task035_runtime_qa` executed both clean candidates sequentially.
The [28-command index](../.project-os/planning/TASK-035.runtime-presentation-checks.json)
binds complete local raw reports by SHA-256, actor, commit and worktree status.
Raw files remain under ignored `.qa/task035/checks`; no failed report was overwritten.

| Check                                  | Initial 100c79a             | Repaired c64d7ba        |
| -------------------------------------- | --------------------------- | ----------------------- |
| Focused runtime tests                  | 24/24 PASS                  | 28/28 PASS              |
| Full default tests                     | 703/718 PASS, 15 FAIL       | 715/722 PASS, 7 FAIL    |
| Format                                 | 37 protected old files FAIL | Same 37 FAIL            |
| Typecheck/lint/validation              | PASS, 93 files              | PASS, 93 files          |
| Web/offline desktop compilation        | PASS, warnings retained     | PASS, warnings retained |
| INC-001 and INC-002/003 replays        | 2 + 10 PASS                 | 2 + 10 PASS             |
| Separate harness/authoring/doctor/diff | PASS                        | PASS                    |

Initial full-suite failures comprised one singleton-package assumption and 14
unchanged 5,000ms timeouts. The coexistence assertion now checks that removing only
the old package leaves the complete new package valid, but cannot restore it as
the old version. Its **complete test still times out**; it is not a test PASS.

Current seven timeouts: full-campaign-runtime lines 47/78; mid-campaign-opportunities
line 90's BYPASS case and lines 127/160/191/211. Their reported durations range from
5.24 to 43.35 seconds. These are failures, not accepted performance samples. No
timeout/worker/budget increase, history reduction, format ignore or validation bypass.
Pre-commit root exploratory failures remain retained separately and are not clean
candidate evidence. The [attributed QA record](../.project-os/planning/TASK-035.runtime-presentation-qa.yaml)
details exact reports and limitations.

## Independent review

`/root/task035_runtime_review` found two P2 defects in 100c79a: authored stream order
could reverse fresh event order, and a replaced context could briefly paint an old
notice before passive cleanup. c64d7ba sorts verified messages by event sequence and
uses an ephemeral binding-scoped snapshot before render. Legal two-stream-command
and layout-phase replacement regressions were added. Read-only re-review found both
repairs resolved and no new blocking repair finding. It does not accept TASK-035.
See [review attribution](../.project-os/planning/TASK-035.runtime-presentation-review.yaml).

## Known risks and remaining work

Genuine production INC-001 is exercised, including Good pre/post-trigger and Jin's
ACK T+0/report T+120. Queue/UI failure, read, adoption/checkpoint and retry checks
are clearly isolated fixtures. They do not prove completed new-production INC-026
history/archive, every full campaign route or complete V1–V12/native acceptance.

Repeated replay/validation at operation/publication/projection boundaries is a
source-observed cost risk, **not a complete measured root-cause diagnosis**. Current
main/full-campaign chunks are 686.36/3,278.19kB with build warnings. Desktop compilation
used cached tools offline; its binary was never launched or installed. Native
accessibility/installation, long-run budgets, rights and mandatory M4/TASK-025
acceptance remain pending. Existing protected data was not reformatted to hide FAIL.

## Next recommended step

Distinct checkpoint consistency audit, then a human decision on a bounded
performance-contract design/review step. Current approval does not authorize
validation/replay caches or skipped proofs. Preserve correctness checks, budgets,
failed logs, old authorities and separately gated native/final/release decisions.

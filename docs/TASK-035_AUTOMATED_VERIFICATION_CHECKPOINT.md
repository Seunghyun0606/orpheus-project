# TASK-035 — Automated verification resumed, acceptance blocked

2026-10-14. DEC-066 records the human's authorization to resume automated checks
and read-only independent review/QA. No native application, installer, user profile,
milestone completion, release or push was executed. This checkpoint supersedes
the earlier preparation-only execution state, not any acceptance obligation.

## Completed safe step

Clean source candidate `0268071` retained original failures. Narrow repair candidate
`a6e509b` fixes a lint-visible audio cleanup ref, adds pending-enable/unmount
regression, corrects isolated test Act placement and Board prerequisite setup,
asserts actual inline 150% text, separates Node/Vitest test ownership and corrects
the new runner's mistaken Node invocation of Vitest authoring tests.
No production YAML, Scenario/definition/model/package version, engine, hidden
score, threshold, timeout, save schema or user storage was changed.

| Check                            | Initial candidate                                     | Repair candidate / limitation                           |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Typecheck                        | PASS                                                  | PASS                                                    |
| Lint                             | FAIL: CampaignAudio ref cleanup                       | PASS                                                    |
| Source validation                | PASS: 64 files                                        | Runtime sources unchanged; not rerun on repair          |
| Node-owned TASK-034 harness      | PASS: 5 cases                                         | Mandatory separate check, not silently removed coverage |
| Authoring tests                  | Wrong runner failed; root tooling error retained      | Correct Vitest runner PASS: 5 tests/3 files             |
| Independent full default suite   | FAIL: 660/693, 8 failed files including harness suite | FAIL: 690/694, 4 timeouts, 2 failed files               |
| MVP replays                      | Not separately rerun at initial step                  | PASS: INC-001 2 cases; INC-002/003 10 cases             |
| Format check                     | FAIL: 37 full-campaign YAML files                     | Not rewritten or waived; still unresolved               |
| Diff check                       | —                                                     | PASS before evidence-document additions                 |
| Project OS doctor                | —                                                     | PASS: structure/backlog references consistent           |
| Web/desktop builds, long budgets | Earlier historical evidence only                      | Not rerun in this checkpoint; unresolved                |

Both full-suite runs retain default `maxWorkers: 2` and 5,000 ms timeout. Final
remaining cases took approximately 6.934s (`full-campaign-runtime:69`), 6.109s
(`mid-campaign-opportunities:127`), 35.307s (`:160`) and 10.134s (`:211`). These
are failing test durations, **not** 20-sample p95 performance-budget measurements.
The corrected fixtures now exercise real work instead of rejecting prematurely;
no completion or full regression PASS can be inferred. Investigate validation/
replay cost without skipping verification, reducing history or raising limits.

The format failure affects definition/package and new Incident/view sources.
The strict old-byte/immutable-authority commitments require care before rewriting
even apparently mechanical data. No format exclusions or assertions were relaxed.

## Independent findings

`/root/task035_review` directly reproduced two player-visible defects on production
INC-001: `UNKNOWN_GOOD` triggers but its body never reaches the full-campaign
investigation renderer (P1); actual `JIN_ACK`/`JIN_IMPACT_REPORT` and delegation ETA/
capacity are absent behind static War Room opening paragraphs (P2). The real
operation sequence and exact candidate are retained in the review checkpoint.
These are source/projection defects, not just missing native evidence.

The reviewer independently audited the narrow repair candidate and confirmed its
scope/guard preservation, but both runtime presentation findings remain unresolved.
Changing how pinned views display verified runtime messages and choosing their
transient/archive semantics must not be guessed. The current Scenario provides
the narrative body/trigger, not an authored transient TTL.

`/root/task035_qa` independently executed both default full-suite runs and reviewed
the corrections. It did not edit tests, source, canonical state or actual profiles;
both runs are FAIL. Root's command outcomes are separately attributed, not
independent QA claims. Distinct evaluation is a checkpoint consistency audit,
not permission to mark TASK-035 or its predecessors accepted.

`/root/task035_checkpoint_evaluator` directly checked all fourteen command-index
entries against their original hashes/streams/provenance, narrow source diffs and
canonical active states. Its verdict is **HUMAN_GATE**, evidence consistent but
acceptance blocked. It audited, rather than reran, reviewer/QA/root executions.
No substantive evidence contradiction was found; the uncommitted evidence docs
are distinguished from clean tested code. No final Project OS evaluate was invoked.

## Retained evidence

- [Initial independent QA raw](../.project-os/planning/TASK-035.initial-qa-raw.json)
  preserves the complete report and original SHA-256
  `930cb37f2560fe6f579677c4e42461cca1733d512995d722fd346628ca3de54e`.
- [Repair independent QA raw](../.project-os/planning/TASK-035.repair-qa-raw.json)
  preserves the complete report and original SHA-256
  `a3e25a72c7233e5feb98032147959c583086c4cc2c9ad7876113f4186d1b3aa1`.
- [Command evidence index](../.project-os/planning/TASK-035.command-evidence-index.json)
  includes exact provenance, exit/timing, full stderr and stdout tails with stream
  hashes and original local paths. It is explicitly not the full raw root logs;
  original `.qa/task035/checks/` files remain preserved.
- [Independent review](../.project-os/planning/TASK-035.independent-review-checkpoint.yaml)
  and [QA](../.project-os/planning/TASK-035.independent-qa-checkpoint.yaml)
  retain actor, direct versus audited evidence and limitations.
- [Distinct checkpoint evaluation](../.project-os/planning/TASK-035.distinct-checkpoint-evaluation.yaml)
  records the separate actor's consistency audit and unresolved HUMAN_GATE.

Read-only Project OS doctor was directly run by root using the installed Python313
`projectctl.exe`, exit 0, output: `PASS: Project OS structure and backlog references
are consistent`. This is structural administration, not runtime acceptance.

## Remaining work / next gate

Resolve the runtime-message presentation/version/lifecycle contract explicitly.
Preserve all original authorities and profiles while choosing a correction path.
Keep the format failure, four timeouts, genuine ten-ending/reveal-route proof,
long/native budgets, M4 restoration/TASK-025 and rights/install acceptance visible.
Native/install execution and M5 closure/production release remain separately gated.
No immutable accepted result was altered and no task/milestone was completed.

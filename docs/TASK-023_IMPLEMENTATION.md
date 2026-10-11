# TASK-023 — Ending resolution developer candidate

Status: implemented and developer-verified under DEC-032; independent review,
acceptance QA and distinct evaluation are pending. TASK-023 remains active.
TASK-024/025 are not claimed and M4 is not complete.

## Completed

- Strict optional `endings` data is pinned in new immutable campaign definition
  versions. Absence preserves older authority and replay shapes. No attachment,
  migration, backfill or latest-version fallback is introduced.
- Authored definitions contain ID/version, explicit final incident/content mappings,
  typed references, final eligibility and unique ending entries with `priorityRank`.
  Smaller nonnegative safe-integer ranks take precedence; equal ranks are allowed.
- `resolveCampaignEnding` verifies complete record replay, the exact requested
  attempt/head and a newly reached official completion. It derives final state and
  new final-attempt commands rather than accepting caller-provided scores/outcomes.
- Every ending condition is evaluated with strict availability, including lower
  ranks and conditions behind a false final gate. Invalid/unavailable context is
  diagnostic, not a false candidate or a successful no-match.
- A unique preferred match resolves; top ties remain ambiguous and valid no-match
  remains unresolved. Neither result selects a fallback or grants an ending flag.
  Ordinal ID ordering stabilizes reports only; it never breaks a priority tie.
- All ten specified endings have deterministic positive, choice-exclusion and
  inclusive numeric-boundary fixtures. Additional tests cover overlap, top/lower
  ties, YAML, references/models, missing/stale final context, imports, inherited
  checkpoint choices, observed zero versus unavailable metrics, and memory reload.

## Changed files

Runtime: `src/scenario/ending.ts`, `src/scenario/campaign.ts`,
`src/engine/campaign/endings.ts`.

Tests: `src/tests/fixtures/endings.ts`, `src/tests/ending-resolution.test.ts`.

Documentation/state context: DEC-032, TASK-023 binding/candidate planning records,
task decision references, definition/ending specs, this report and the M4 plan.
Canonical task activation came from `projectctl claim`, not manual state editing.

## Validation and provenance

Each final mapping names an allowed campaign incident/content version, registered
campaign reference or declared signal/resource/flag/evidence/action. Reference and
entry versions must match the ending model; campaign metrics additionally require
its exact `behaviorVersion`. An optional `predictionVersion` must match the pinned
predictor. Both complete models/classifications/formulas remain in the campaign
authority, not substituted by a latest model with the same label.

The request supplies only `attemptId` and its exact `priorHead`. Result provenance
retains run/revision, campaign/ending definition IDs and versions, scenario/version,
attempt/head and matched ranks. Final actions retain accepted operation/input and
command identities. Other attempts, imported snapshots and inherited replay
prefixes cannot create final-action presence. Verified imported campaign discovery
membership remains usable under DEC-011, without invented historic behavior or
completion. A completed old checkpoint cannot be promoted to an official attempt.

The pure query is internal tool/test access, not a player-facing reveal API. It
performs no I/O, ending-grant operation, exposure acknowledgement or response
recording. Returning a resolved result is not durable campaign acceptance.

## Tests

Developer checks on 2026-10-11:

- Final focused ending suite: 70 tests, one file, passed (6.26 s).
- Full final suite with `npm test -- --maxWorkers=1`: 380 tests, 25 files,
  passed (50.17 s), unchanged timeouts and no configuration edits.
- Earlier candidate full default-worker run passed 375 tests (12.60 s).
  After five additional cases, default-worker execution passed 379 and failed the
  existing vertical-slice UI test at its 5000 ms limit. The unchanged UI test passed
  in isolation (4.91 s including setup). Single-worker success is consistent with
  worker contention, but does not prove that default parallel timing is reliable.
- Typecheck, zero-warning lint, format check, build, Project OS doctor and diff
  checks passed. Scenario validation passed eight current/frozen files.
- Build retains the existing nonblocking 572.59 kB chunk warning; no chunk policy
  or dependency change was made.

Initial candidate checks failed due to an invalid test scenario version, missing
test behavior support classification and incorrect fake-ledger call signatures.
The fixture/call-site defects were corrected before the passing runs. These are
development iterations, not an independent QA PASS or a timeout waiver. The default
parallel timeout is retained as an unresolved reliability risk for independent QA.

## Known risks and remaining work

- All final choices, thresholds and ranks are isolated fixtures; they do not
  implement production BLACKOUT, balance, epilogues or actual REWRITE operations.
  REWRITE's test choice represents structural audit, not a replacement objective.
- Six opportunity-dependent behavior metrics remain unavailable; endings requiring
  them diagnose. This task does not fabricate positive exposure/response samples.
- IndexedDB verification uses an injected memory factory, not user databases,
  native storage capability or actual presentation. Old stores and MVP UI are untouched.
- Complete-history replay cost remains unbenchmarked for a full campaign.
- Default parallel test execution has an observed UI timeout; independent QA must
  assess it without concealing failed runs or relaxing the existing timeout.
- Obtain separately authorized independent review/QA and distinct evaluation before
  completion. TASK-024 then owns gated adapter/presentation integration and positive
  deviation fixtures; TASK-025 owns independent integration/native exit evidence.

Next recommended step: independent review and QA of the pinned candidate, followed
by distinct Project OS evidence evaluation. No push or release is authorized here.

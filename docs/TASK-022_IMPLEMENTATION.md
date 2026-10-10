# TASK-022 — Authored branches and empirical prediction

Status: developer candidate, not independently accepted. TASK-022 remains active.
DEC-030 approves new-definition-only binding; it does not authorize automatic
model attachment, old-run migration, agent delegation, release or push.

## Completed

Strict optional branch/prediction data is pinned in the existing whole campaign
definition authority. Older definitions without these fields retain their shape
and exact replay behavior. New versioned non-production fixtures demonstrate
comparable contexts, action/candidate equivalence, eligibility, support and late-act
reveal predicates. The three current MVP incidents and frozen versions are unchanged.

`getCampaignBranches` evaluates authored eligibility/reveal over verified campaign
observations without granting routes or effects. Investigation, safety, reporting
and dependency fixture branches retain neutral labels. Strict diagnostics do not
short-circuit unavailable observations behind known siblings or hidden gates.

`getCampaignPrediction` uses verified accepted command history only. Each sample
is classified using its own pre-command prefix, not subsequent action outcomes.
Genuine unfinished/abandoned retries count; rejected/duplicate inputs, inherited
checkpoint prefixes, imports and read-only queries do not. Explicit compatible-version
candidate mappings support renamed actions without guessing equivalence.

Currently unavailable candidates are excluded from both winning counts and the
denominator. Confidence is a unique top count divided by pooled eligible choices,
with no smoothing or score fallback. Empty candidates/history, insufficient support
and top ties yield UNKNOWN; invalid/unavailable required inputs diagnose. Subsequent
accepted choices can raise or lower the next confidence without mutating earlier output.
Support records actual source identities and pre-action context; its immutable header
holds shared model/formula/classification and campaign versions.

An isolated memory-ledger fixture verifies committed history, reload and duplicate
delivery without a persisted prediction cache. This query creates no actual exposure
or response sample. `predictionDeviation` remains unavailable until valid actual
presentation and response operations exist; this limitation is tested, not bypassed.

Malformed scenario objects previously caused a campaign reference traversal exception.
The validator now schema-checks catalog entries before traversing them, returning
diagnostics instead. Valid source content and replay rules are unchanged.

## Changed files

- Schema/validation: `src/scenario/prediction.ts`, `src/scenario/campaign.ts`.
- Pure queries: `src/engine/player-model/prediction.ts`, `src/engine/campaign/transitions.ts`.
- Non-production fixtures/tests: `src/tests/fixtures/prediction.ts`, `src/tests/player-prediction.test.ts`.
- Contracts/plan: `specs/architecture/player-prediction.md`, `specs/architecture/campaign-definition-contract.md`, `docs/M4_IMPLEMENTATION_PLAN.md`.
- Decision/task context/checkpoints: DEC-030, TASK-022 metadata and planning records.

## Tests

Developer verification on 2026-10-11, unchanged default timeouts, heavy checks run serially:

- `npm test`: 310 tests in 24 files passed.
- `npm test -- src/tests/player-prediction.test.ts src/tests/inc-001-replay.test.ts src/tests/inc-002-replay.test.ts src/tests/inc-003-replay.test.ts`: 58 tests in four files passed (46 new cases and 12 current MVP replay cases).
- `npm run validate:scenarios`: eight current/frozen YAML files passed. New non-production campaign YAML is exercised by the strict round-trip test, not added to production CLI content.
- `npm run lint`, `npm run build`: passed, including TypeScript check. Existing nonblocking web chunk-size warning remains.
- `projectctl doctor`: passed; formatting/diff checks are recorded in the candidate checkpoint.

During development, an expected branch-array assertion and a renamed-action fixture's
postmortem field were corrected after failing focused checks. The malformed-catalog
regression then reproduced the traversal exception and passed after the validator fix.
Final focused/full verification passed; these are developer checks, not independent QA.

## Known risks

- Historical classification replays per-command prefixes; cost and whole-history growth are unbenchmarked. No scalability claim is made.
- Calculation does not acknowledge visibility. Positive prediction-deviation/recommendation-response lifecycles and native integration are not implemented or certified here.
- Six opportunity-dependent behavior fields remain unavailable. Actual presentation, committed acknowledgement and response association need their approved typed operations and integration fixtures.
- No production thresholds/context mappings, moral ranking, live AI, platform security certification or late-act content are introduced.

## Remaining work

Obtain separately authorized read-only independent review and acceptance QA. Reviewers
must assess the bounded query scope against TASK-022 acceptance, especially the distinction
between confidence feedback and actual exposure/deviation. Fix safe findings; gate any
new policy or material scope choice. Submit attributed evidence only after that work and
obtain a distinct configured evaluator before Project OS completion. TASK-023 is not
started and M4 is not closed.

Next recommended step: authorize separate reviewer, QA and distinct final evaluator
for the pinned candidate; do not manufacture independent acceptance from these checks.
The [bounded delegation request](../.project-os/planning/TASK-022.review-qa-evaluation-request.yaml)
pins implementation commit `8ada150`. The human separately approved read-only
review/QA and a distinct final evaluator; reviewer `/root/task022_review` and QA
`/root/task022_qa` have now started. No acceptance is implied by this authorization.

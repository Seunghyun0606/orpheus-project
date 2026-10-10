# M4 — Campaign Intelligence Systems

Status: TASK-018, TASK-019 and TASK-020 accepted through independent evidence
evaluation and Project OS. DEC-028 approves TASK-020's physical layout; its
bounded adapter acceptance does not certify native integration. TASK-021 is now
claimed through Project OS. DEC-029 records the human-approved new-definition-only
model binding; older model-less records remain unchanged. The
[TASK-021 candidate](TASK-021_IMPLEMENTATION.md) implements four supported behavior
metrics and explicit unavailability for six opportunity-dependent fields.
Independent review/QA and configured acceptance remain pending. No storage migration
or native integration is performed.
The human approved M3 closure and M4 definition
on 2026-10-09; [DEC-008](../.project-os/decisions/DEC-008-m3-completion-m4-planning.yaml)
records that approval. M4 remains active; TASK-019 completion is not M4 closure.
M5 remains planned.

## Scope and continuity

Build the campaign, player behavior, branching/prediction, and ending framework
already specified in `specs/feature/campaign-and-player-model.md`. This phase is
infrastructure and verified integration, not the full 24–28 incident campaign.
The three bundled MVP incidents retain their identities and UNKNOWN-only reveal
boundary. Late-act demonstrations belong to explicitly non-production fixtures;
their UI availability must obey reviewed narrative gates.

Retain the headless TypeScript domain and data-authored content boundaries.
Do not replace `orpheus.incident.v1`, alter frozen replay authorities, or silently
reinterpret `orpheus.campaign-progress.v1`. The latter stores alternate discovery
snapshots, not an approved canonical behavior timeline. Existing discovery union
cannot automatically become player action counts or alignment history.

## Bounded work and dependencies

| Task     | Role      | Deliverable                                                 | Depends on                                       |
| -------- | --------- | ----------------------------------------------------------- | ------------------------------------------------ |
| TASK-018 | architect | Approved domain/data/replay and compatibility contract      | TASK-017                                         |
| TASK-019 | developer | Deterministic campaign transitions and authored Act unlocks | TASK-018                                         |
| TASK-020 | developer | Approved campaign persistence and legacy compatibility      | TASK-019                                         |
| TASK-021 | developer | Versioned, action-derived player behavior                   | TASK-019                                         |
| TASK-022 | developer | Authored branches and deterministic prediction feedback     | TASK-019, TASK-021                               |
| TASK-023 | developer | Data-driven ending conditions and priority resolution       | TASK-019, TASK-021, TASK-022                     |
| TASK-024 | developer | Shared desktop/store projections and gated integration      | TASK-020, TASK-022, TASK-023                     |
| TASK-025 | developer | Full M4 verification and independent acceptance evidence    | TASK-020, TASK-021, TASK-022, TASK-023, TASK-024 |

These are dependency relationships, not authorization to launch parallel agents.
Tasks follow Project OS claim, structured handoff, independent review/QA and
evaluation rules. A ready dependent task is not eligible until its dependencies
are done. TASK-018 is already active as architect; do not claim it again.

## Required decisions before implementation

TASK-018 must distinguish proposals from approved contracts and stop at a human
gate for material architecture/schema/migration decisions. In particular:

- DEC-010 now approves retaining official retries as distinct attempts in the
  same campaign. DEC-012 approves confirmed checkpoint-based new attempts without
  erasing history or recounting the inherited prefix. Exact run/input identity,
  duplicate import and archive-review contracts still require specification.
- DEC-011 now approves explicit adoption of verified legacy evidence/narrative
  membership only, with provenance limits and no historical effects, behavior or
  completion. Exact import mechanics and unavailable observations need specification.
- Storage authority is now separately approved by DEC-009: preserve existing
  stores and add a distinct versioned campaign ledger. DEC-013 chooses IndexedDB
  transactional revision-checked commits for it only. The detailed envelope and
  association/import mechanics are now a review draft; the M3 closure
  approval alone did not authorize them.
- DEC-014 approves pooled eligible numerators/denominators across official attempts,
  including unfinished and abandoned attempts; no eligible samples means unavailable.
  This does not choose authored effect award scope or non-rate formulas.
- DEC-015 separately approves once-per-run authored discovery/narrative/completion
  effects, while keeping genuine new retry behavior and action-driven costs.
  The effect receipt and membership are separate; imports grant no historical award.
- DEC-016 approves operational intervention denominators for restart/rollback rates.
  Information-only commands do not dilute these rates; authored classifications
  and other behavior metric contracts still require review.
- DEC-017 requires relevant investigation from earlier new inputs in the same
  attempt for evidence-before-action. Imported/prior-attempt/baseline support alone
  does not qualify this metric; approved discovery presence predicates remain usable.
- DEC-018 approves averaging distinct investigation observation keys per eligible
  official attempt. Eligible zero-investigation, unfinished and abandoned attempts
  remain included; empty/unsupported attempts provide no denominator sample.
- DEC-019 approves unresolved ending top ties and valid no-match diagnostics,
  without automatic fallback or ending flags. Invalid/unavailable final context
  is a diagnostic, not a no-match eligible for a default result.
- DEC-020 approves comparable-context historical choice frequencies and a unique
  top candidate's empirical share among currently available candidates. Empty or
  insufficient support and top ties return UNKNOWN; no score-model fallback.
- DEC-021 approves comparing actual eligible actions with a previously exposed
  recommendation, including manual execution. No response/expiry contributes no
  sample; counts pool over eligible responses, not all exposed recommendations.
- DEC-022 approves predictionDeviation as mismatching eligible responses divided
  by all eligible responses to valid recorded prediction exposures. Confidence
  does not weight mismatches; UNKNOWN/gated-off predictions supply no samples.
- DEC-023 approves independent positive/eligible-choice rates for safety preference
  and damage tolerance at authored pre-action tradeoffs. They are not complements,
  mean intensity scores or automatic conversions from customer damage/risk.
- DEC-024 approves eligible explicit reporting/cooperation responses, with separate
  per-metric opportunities and at most one response sample each. Unrelated
  investigation, no response and expiry do not dilute these rates.
- DEC-025 requires every referenced observation before condition composition;
  unavailable leaves diagnose even under a decisive known sibling. The
  [condition contract](../specs/architecture/condition-evaluation.md) specifies
  strict ALL/ANY/NOT truth tables and future fixtures; no implicit three-valued policy.
- Specify versioned action classifications and behavior denominators, prediction
  inputs/confidence, branch predicates, and ending overlap/tie/no-match policy.
  Test-only fixture thresholds are not approved production balance.

No dependent task may implement a pending decision by guesswork. Keep approved
DEC-001/003/005/006/007/009/010/011/012/013/014/015/016/017/018/019/020/021/022/023/024/025 boundaries unless a separate decision supersedes them.
Do not declare TASK-018 accepted with unresolved required contract choices.

## Exit-criterion verification map

| M4 exit criterion                                                                 | Implementation tasks                   | Required evidence                                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Campaign progression, hidden values, evidence and flags persist deterministically | TASK-019, TASK-020, TASK-024           | State/Act transition, duplicate input, replay, round-trip, approved migration, reload and archive isolation fixtures              |
| Action-derived player behavior drives prediction and branch conditions            | TASK-021, TASK-022, TASK-024           | Formula/version, missing sample, rejected action, prediction/deviation, branch eligibility and gated UI tests                     |
| Ending definitions and priority resolution are data-driven and deterministic      | TASK-023                               | All ten named endings, exclusion/boundary, overlap/tie/no-match and invalid-reference fixtures                                    |
| Authoring preserves twist order and moral ambiguity                               | TASK-018, TASK-022, TASK-023, TASK-024 | Authored reveal-gate/reference validation, unchanged MVP UNKNOWN-only checks, no good/bad/true labels, independent content review |

TASK-025 audits all four criteria and compatibility promises. It runs the full
quality command set, native inspection of affected screens, and separate test,
independent review, acceptance QA, and evaluator handoffs. Evidence must name
its candidate commit and distinguish direct observations from audited logs.
Use the supported native 960 x 640 minimum and enlarged text; do not infer
320px native support or a complete screen-reader/audio audit from these checks.

## Current phase result and next step

TASK-018 has now been claimed as architect. Its
[campaign intelligence contract](../specs/architecture/campaign-intelligence-contract.md)
is partially decided: DEC-009 approves separate ledger authority and DEC-010
approves appending official retries without replacing earlier actions. DEC-011
approves explicit discovery-only legacy adoption; DEC-012 approves confirmed
checkpoint-based attempts without rolling back campaign history. DEC-013 approves
IndexedDB for the new ledger only. Its
[persistence contract](../specs/architecture/campaign-ledger-persistence.md) is a
review draft. DEC-014 approves pooled eligible behavior rates; DEC-015 approves
once-per-run authored discovery/narrative/completion effects. The
[effect application contract](../specs/architecture/campaign-effect-application.md)
is a review draft. DEC-016 approves operational restart/rollback denominators,
specified in the [behavior rate draft](../specs/architecture/player-behavior-rates.md).
DEC-017 approves current-attempt new investigation for evidence-before-action.
DEC-018 approves distinct observation counts averaged across eligible attempts.
DEC-019 approves unresolved ending top ties/no-match, specified in the
[ending resolution draft](../specs/architecture/ending-resolution.md).
DEC-020 approves empirical context-choice prediction, specified in the
[prediction review draft](../specs/architecture/player-prediction.md).
DEC-021 approves action-based recommendation response, specified in the
[response review draft](../specs/architecture/recommendation-responses.md).
DEC-022 approves the pooled prediction mismatch rate, specified separately from
confidence in the [prediction draft](../specs/architecture/player-prediction.md).
DEC-023 approves independent preference rates, specified in the
[preference review draft](../specs/architecture/preference-rates.md).
DEC-024 approves explicit reporting/cooperation response units, specified in the
[affiliation review draft](../specs/architecture/affiliation-rates.md).
Basic formula families are approved; detailed logical contracts now have independent
review/QA evidence, with final human approval still pending. Read-only execution was human-authorized,
recorded in the [request](../.project-os/planning/TASK-018.review-qa-execution-request.yaml).
Existing-save checks do not constitute acceptance of the proposed new campaign
system; new runtime/storage/native verification remains required in later tasks.

Initial M4 planning closed the approved M3 milestone and registered eight bounded
tasks. Subsequent TASK-018 documentation and context corrections do not change
runtime code, save content, hidden scores, formula
versions or ending behavior. Immutable M3 records retain their original
pre-approval observations; this plan and DEC-008 record the later human decision.

The initial [independent review](../.project-os/planning/TASK-018.independent-review-checkpoint.yaml)
requests changes, and [independent QA](../.project-os/planning/TASK-018.independent-qa-checkpoint.yaml)
verifies proposal consistency and legacy safeguards, not final acceptance.
The human now approved strict
[predicate availability](../.project-os/decisions/DEC-025-strict-predicate-availability.yaml);
the detailed truth-table contract has also passed independent recheck.
The subsequent [logical review](../.project-os/planning/TASK-018.logical-contract-review-checkpoint.yaml)
and [QA](../.project-os/planning/TASK-018.logical-contract-qa-checkpoint.yaml)
both PASS candidate `7717c4d`, conditional on final human approval.
The human approved [DEC-026 baseline v1](../.project-os/decisions/DEC-026-reviewed-m4-contract-baseline.yaml).
Attributed final evidence and independent evaluation have now been submitted;
Project OS accepted TASK-018 and TASK-019 was then claimed. No M4 closure is implied.
The [definition](../specs/architecture/campaign-definition-contract.md) and
[record](../specs/architecture/campaign-record-contract.md) interface candidates
now specify the reviewed typed/association/priority/freshness representations.
These are logical contracts, not implemented runtime/storage or native test passes.

TASK-019 subsequently added a [pure implementation](TASK-019_IMPLEMENTATION.md).
Independent review/QA identified four safe defects, repaired in `d3e54f9`.
The human approved DEC-027 compatible-content/shared-effect representation;
implementation `7cb0a83` passed independent review and QA with 186 full-suite tests.
Attributed handoffs at `5e5883b` and independent configured evaluation accepted
TASK-019. TASK-020 was claimed through Project OS; its
[physical-layout gate](../.project-os/planning/TASK-020.physical-layout-gate.yaml)
preserved the distinction between approved IndexedDB use and the then-proposed
database/store names. The human subsequently approved DEC-028. The
[TASK-020 candidate](TASK-020_IMPLEMENTATION.md) now provides transactional storage
and explicit legacy ports with isolated in-memory tests. No actual user database
was opened or migrated, no UI integration occurred, and independent acceptance
was pending at that implementation checkpoint. Subsequent separately authorized
read-only review and QA passed candidate `fe2ba1c`, with 215 full-suite tests and
29 focused tests. Handoffs at `450006d` passed independent evidence evaluation;
Project OS accepted TASK-020. No actual user database was accessed or rewritten.
Older review checkpoints
retain their original findings and test counts.
No platform storage, UI integration or production campaign content was added.
Direct contract and
DEC-009–025 references are now declared in dependent task context metadata;
budget-truncated context output does not replace reading required source files.
Do not invent pending authoring rules or approve
material findings silently. Approved formula/storage decisions are not acceptance
of the entire contract or authorization to infer missing history.

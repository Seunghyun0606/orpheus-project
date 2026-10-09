# M4 — Campaign Intelligence Systems

Status: task definitions ready. The human approved M3 closure and M4 definition
on 2026-10-09; [DEC-008](../.project-os/decisions/DEC-008-m3-completion-m4-planning.yaml)
records that approval. M4 is active, but no M4 implementation task is complete or
claimed by this planning update. M5 remains planned.

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
- Specify versioned action classifications and behavior denominators, prediction
  inputs/confidence, branch predicates, and ending overlap/tie/no-match policy.
  Test-only fixture thresholds are not approved production balance.

No dependent task may implement a pending decision by guesswork. Keep approved
DEC-001/003/005/006/007/009/010/011/012/013/014/015 boundaries unless a separate decision supersedes them.
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
is a review draft. DEC-016 proposes the next gate: whether restart/rollback rates
use operational interventions or all accepted gameplay commands as denominators.
Existing-save checks do not constitute acceptance of the proposed new campaign
system; remaining policies and independent review/QA are still required.

This phase only closes the approved M3 milestone and registers eight bounded
tasks. It does not change runtime code, save content, hidden scores, formula
versions or ending behavior. Immutable M3 records retain their original
pre-approval observations; this plan and DEC-008 record the later human decision.

Next: continue active TASK-018 and obtain the restart/rollback denominator decision,
then resolve remaining domain policies and envelope review plus independent review/QA before
dependent implementation. No approved storage decision should be mistaken for
acceptance of the entire contract or authorization to infer missing history.

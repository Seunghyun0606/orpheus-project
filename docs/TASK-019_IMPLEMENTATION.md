# TASK-019 — Pure campaign implementation candidate

Status: accepted through independent review, QA and configured Project OS evaluation.
TASK-018 was accepted through Project OS after independent evidence evaluation
and human DEC-026 approval. This document does not accept TASK-019 or close M4.

## Completed in this candidate

- Strict YAML/Zod campaign definitions, registered typed condition references,
  explicit initial alignment/hidden values, Act/incident conditions and effect data.
- Strict DEC-025 ALL/ANY/NOT evaluation: validate the complete tree, diagnose any
  unavailable required observation, distinguish known zero/false, no coercion.
- Version-1 ordinal canonical JSON identity; retain array order and Unicode,
  reject unsupported values/accessors instead of executing or normalizing them.
- Pure create/start/command/checkpoint/adoption operation preparation and replay,
  explicit run/attempt/input identities and command/event boundaries.
- Reproduce simulation results directly from accepted commands rather than trust
  caller-supplied discoveries/completion. Retain unfinished and repeated attempts.
- Run-scoped effect receipts distinct from discovery/completion membership;
  normal new retries retain costs/history without repeating numeric effects.
- Confirmed same-version unfinished checkpoint baselines retain original bytes,
  RNG/resources/pending work and inherited boundaries. Only new commands/events
  qualify. Completed snapshots cannot create an official completion.
- Explicit source-replay-verified discovery adoption retains operation source bytes,
  grants membership only, and validates all sources before any candidate update.
- Authored effect Act targets and Act/incident prerequisite diagnostics; no
  production incident-ID branching, random identity generation or platform calls.

## Entry points and boundaries

| Module                               | API / responsibility                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/scenario/campaign.ts`           | `parseCampaignYaml`, `validateCampaignDefinition`, strict authoring schemas and reference validation |
| `src/engine/campaign/conditions.ts`  | Typed, read-only condition evaluation and ordered diagnostics                                        |
| `src/engine/campaign/canonical.ts`   | Exact supported JSON payload/projection equality                                                     |
| `src/engine/campaign/transitions.ts` | `prepareCampaignOperation`, `replayCampaign`, `getCampaignProgression`, `campaignAttemptHead`        |

The caller injects exact versioned scenario authorities; there is no latest-version
lookup. A run pins the whole campaign definition and each attempt's exact scenario
data. Prior projections are replay-verified before preparation. Reused operation
identity with matching complete payload returns the current head as duplicate;
changed payload conflicts. A new operation requires the next run sequence.
Input labels are attempt-local; provenance also includes operation/attempt identity
and local command/event sequence. Equal seed/command bytes do not merge attempts.

Effect conditions explicitly declare `pre_command` or `post_event` boundaries.
Only newly generated event batches are projected, in engine order and authored
effect order. Initial/baseline replay events and adoption do not apply effects.
Narrative discovery uses the existing engine event's `sourceId`; evidence uses
`targetId`. Ending-flag grants by these effects are rejected: verified ending
transitions belong to TASK-023. All numeric deltas are authored fixture values;
nonfinite resulting values diagnose without publishing a partial batch.

Preparation returns a **candidate**, not official durable success. No IndexedDB,
localStorage, DOM, React, Zustand or Tauri calls occur here. Existing persistence,
frozen content, bundled incident data and UI are untouched. TASK-020 supplies
revision-checked transaction completion, source re-reading and checkpoint
associations; TASK-024 supplies UI/publication integration.

## Automated verification actually performed

- New condition/canonical and transition fixture suites: **55 tests passed**.
- Full `npm test`: **171 tests in 18 files passed**.
- `npm run typecheck`, `lint`, `format:check`: passed.
- `npm run validate:scenarios`: eight existing current/frozen files passed.
- `npm run build`: passed (existing non-blocking chunk-size warning).
- `projectctl doctor` and `git diff --check`: passed.

The original implementation figures above apply to `30e2132`. Independent review
and QA subsequently found executable-property bypass, source-envelope authority
mismatch, query/execution Act inconsistency and uncaught YAML alias conversion.
Those defects were repaired in `d3e54f9`; independent corrective review confirmed
closure. Focused suites now pass **60 tests**, and independent QA reran the full
suite: **176 tests in 18 files passed**, with typecheck, lint, formatting and eight
scenario validations passing. Existing saves and platform/UI code were untouched.
Attributed [review](../.project-os/planning/TASK-019.independent-review-checkpoint.yaml)
and [QA](../.project-os/planning/TASK-019.independent-qa-checkpoint.yaml) preserve
the original findings and distinguish corrective verification from acceptance.

The new tests exercise YAML/schema/references, truth tables/nesting/availability,
canonical payload behavior, hidden effects/alignment/flags, Act unlocks,
deterministic state/event replay, duplicate/conflicting inputs, retained unfinished
retries, prefix isolation, pending work, source tampering/partial import rejection,
actual completion, diagnostic atomicity and numeric overflow.
Fixture data is outside production scenario data; its numbers are not balancing
decisions. Existing scenario CLI validation does not yet claim a production
campaign catalog.

## Historical corrective checkpoint (before DEC-027 approval)

- Independent review remains **REWORK** for compatible-content effect representation
  and no-reaward coverage. Corrective QA PASS covers the safe fixes, not task acceptance.
  Do not submit a final task PASS or advance TASK-020 yet.
- This is the bounded campaign subset, not the entire future ledger operation
  union. Opportunity acknowledgements, slot associations and resolved endings
  are not supported operations yet.
- Source verification is exact against injected original replay authorities.
  Checkpoint continuation currently requires its exact playable content version;
  target migration mappings and actual legacy-store import/association mechanics
  remain TASK-020 obligations. Unknown lineage is not inferred from bytes.
- Behavior metrics remain unavailable until supported TASK-021 projections exist;
  no historical samples or neutral zeros are manufactured.
- Cross-version authored effect compatibility needs explicit verification against
  the immutable recorded definition authority, not automatic version substitution.
  This is the demonstrated remaining review gap. A proposed explicit compatibility
  representation is recorded in the [human gate](../.project-os/planning/TASK-019.compatible-content-gate.yaml),
  not implemented or approved by the corrective checks.
- No native/new IndexedDB/concurrency/lost-ack tests occurred. Full-history replay
  before preparation favors correctness; performance/storage scaling is unmeasured.

These were the remaining risks at `d3e54f9`; the continuation below records the
later human decision and verification, without rewriting the earlier findings.

## DEC-027 continuation

The human selected option A. The fixed campaign definition can now explicitly
declare additional compatible content versions and shared effect triggers.
Starts retain the primary unless another allowed version is explicitly selected;
baselines and subsequent commands use their exact attempt version. Shared triggers
reuse the same effect body and once-per-run receipt; no version-specific delta
override or latest-version fallback exists. Old definitions, frozen content,
Incident slots and UI remain unchanged.

Ten new compatibility cases cover both version orders, two matching new events
in one command batch, inherited variant baselines, original single-version history,
unmapped effects, invalid mappings, conflicting authority/receipt data, alternate
runs and explicit pre/post-event predicates. Independent review passes with
**70 campaign tests**; independent QA passes **186 tests in 19 files**, typecheck,
lint, formatting and eight scenario validations. Root web build also passes with
the existing non-blocking chunk-size warning. Older checkpoint verdicts remain
historical. Attributed handoffs were committed at `5e5883b`; the independent
evaluator accepted implementation `7cb0a83`, and `projectctl evaluate` applied the
canonical PASS transition. See the [evaluation](../.project-os/tasks/results/TASK-019.evaluation.yaml).
Next: eligible TASK-020 storage work. It remains unclaimed; no native/IndexedDB
integration or M4 closure is certified here.

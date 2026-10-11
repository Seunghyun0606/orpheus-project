# Player prediction — TASK-018 review draft

## TASK-022 implementation checkpoint

DEC-026 accepted the logical baseline. DEC-030 separately approves immutable
branch/prediction binding only in new campaign definition versions. The developer
candidate implements strict optional `prediction` and `branches` authoring plus
read-only headless queries; it does not attach them to old runs. Existing model-less
authorities and replay records retain their exact shape. Independent TASK-022
review/QA and distinct evaluation passed the DEC-031 bounded scope; Project OS
completed TASK-022 on 2026-10-11. No positive exposure/deviation work is certified.

DEC-031 now explicitly assigns verification stages after independent review/QA
identified the original positive-deviation gap. TASK-022 is evaluated for pure
queries, empirical confidence feedback and no-exposure deviation guards only.
TASK-024 must implement actual presentation acknowledgement committed before eligible
responses, positive `0/1` versus `1/1` and pooled `2/12` deviation, provenance/one-response
boundaries, and abort/conflict/lost-ack recovery. TASK-025 must independently audit
these and actual gated adapter/native evidence before M4 completion. These tests
remain mandatory and unimplemented, not waived by query acceptance. DEC-022 semantics
are unchanged; concrete new recording/schema/lifecycle choices still require their
applicable review and Human Gates.

`src/scenario/prediction.ts` defines schema/formula version 1, explicit model and
classification versions, comparable context IDs, stable candidate IDs and positive
integer minimum support. Each allowed scenario/content version has explicit supported
or unsupported coverage. Supported mappings declare typed context references,
`when`, `reveal`, action-to-candidate choices and each choice's `eligible` condition.
Shared context IDs and candidate mappings, not action labels, establish equivalence.
Campaign references must permit branch evaluation; scenario references name declared
elapsed time, signals, resources, flags, evidence or signal visibility. All condition
trees use the existing strict typed reference evaluator; no arbitrary callbacks/paths.

`getCampaignPrediction` verifies whole-record replay and reconstructs every eligible
accepted command's own pre-command history prefix. It pools genuine official choices
across attempts, filters to currently available candidates, and uses a unique top's
count divided by the eligible total. UNKNOWN distinguishes empty candidates/history,
insufficient support and a top tie. Invalid or unavailable required current context
diagnoses instead of silently dropping it. An unmet valid reveal returns
only a gated result and its boundary, without support/counts/confidence. Diagnostics
for current predicates still take precedence over a decisive sibling or hidden gate
under DEC-025. Historical predicates are evaluated only when calculation proceeds
past reveal with available candidates; then unavailable required historical observations
diagnose rather than being discarded. A gated result does not scan historical samples.

Result support retains counts, current observations, candidate/action mappings and
individual source run/attempt/operation/input/command identities with pre-history,
event and context boundaries. The immutable result header retains campaign authority,
model/formula/classification versions and the current calculation boundary shared by
its samples. Later accepted commands may change a new result; prior results are not
mutated. Reload derives the same result from committed history without a cache field.

This calculation is not an exposure, recommendation or branch award. No prepared-result,
actual-presentation acknowledgement or response operation was added. `predictionDeviation`
and the other five opportunity-dependent behavior fields remain unavailable; tests prove
that querying a predicted/UNKNOWN/gated result adds no sample. Positive exposure/response
fixtures and browser/native acknowledgement must follow the reviewed integration
contract, not be simulated by this query. Fixture support thresholds and late-act
conditions are not production balance. See [implementation and verification limits](../../docs/TASK-022_IMPLEMENTATION.md).

## Original logical baseline and future exposure fixtures

The historical review language below is superseded by DEC-026 and the bounded
checkpoint above. Its exposure/response fixtures remain future work, not newly passing
runtime APIs or a claim of TASK-022 acceptance.

Status: [DEC-020](../../.project-os/decisions/DEC-020-empirical-context-action-prediction.yaml)
approves empirical context-choice frequencies, not a behavioral scoring model.
DEC-022 separately approves predictionDeviation as a pooled response mismatch rate.
This is a logical contract and fixture plan, not a runtime type/schema or a
completed TASK-022. Exact authoring fields, comparable contexts, support limits
and reveal gates remain under review; no production balance is chosen here.

## Inputs and causal boundary

The pure predictor consumes a validated definition version, the verified current
pre-action context and available candidate identities, and ordered official
history strictly before the prediction boundary. Authored deterministic context
rules determine which historical pre-action contexts are comparable. Do not use
future action outcomes, subsequent observations, wall-clock time, UI labels or
unrecorded state to classify those earlier contexts.

Historical samples in the selected campaign run must be eligible new accepted choices with traceable run,
attempt, input sequence, pre-action context and classification versions. Genuine
new choices in unfinished/abandoned attempts remain available. Equal replay bytes
in distinct official attempts do not merge their identities. Inherited checkpoint
prefixes, imported snapshots, rejected commands, duplicate delivery, timers and
read-only replay/archive inspection add no choices. Exact-head resume retains
existing samples; confirmed checkpoint attempts count only their new inputs.

Current candidate availability is evaluated against the verified pre-action
state using authored definitions. Cross-incident equivalence or context grouping
must be explicit and versioned, not guessed from a restart/rollback label. Do not
silently reinterpret incompatible historical definitions; report unavailable
coverage or a diagnostic as required by the model's validated support rules.

## Empirical selection and confidence

Filter compatible historical samples to the comparable context and currently
available eligible candidate identities. Each retained choice contributes one
unit to that candidate. Sum those units before calculating any share; do not
average percentages across attempts or add smoothing, guessed priors, coefficients
or a score-model fallback.

For candidate counts `count(action)` and total `N`, a unique top candidate becomes
the prediction only if authored minimum support requirements are satisfied.
Confidence is `count(top) / N`. An unavailable candidate contributes neither a
winning candidate nor a denominator unit. A validated empty available-candidate
set, empty eligible history, insufficient support or equal top counts returns
UNKNOWN with a reason and traceable support. Invalid references/definitions or
unavailable required context return a diagnostic, not a successful zero-filled
prediction. Do not confuse lack of observations with an invalid model definition.

Confidence describes the retained empirical sample, not a calibrated probability
of the next action, certainty about player intent or operational correctness.
Expose the approved confidence only through authored narrative gates; do not
reveal other hidden campaign values. Presentation rounding must not influence
candidate selection or branch thresholds. Exact numeric representation is an
implementation detail to verify with deterministic boundary fixtures.

## Results, exposure and replay

Logical results distinguish a valid predicted action plus confidence, UNKNOWN
plus support/reason, and invalid/unavailable-required-input diagnostics. Preserve
candidate counts, eligible total, context identity, history boundary and model/
classification versions so a reviewed calculation can be reproduced.

Computing a prediction does not prove it was shown and does not by itself create
a player response sample. Record a valid actual exposure/opportunity with the
pre-action availability and immutable result before a responding accepted input.
Reject reused exposure identity with changed payload; replay/redisplay does not
create another opportunity. Adapter visibility acknowledgements and exact
exposure fields require integration review before runtime implementation.

Once the next accepted choice is committed, it may contribute to a subsequent
calculation under the same eligibility rules. It must never enter its own prior
prediction or retrospectively alter that exposure. Confidence can rise, fall or
remain unchanged; do not script a decline after every unexpected action.
Prediction deviation requires an actual recorded valid prediction exposure and
an eligible response; exact response eligibility remains under review. The approved
mismatch-rate contract is below. A prediction is not automatically an AI
recommendation or evidence of its acceptance.

UNKNOWN and gated-off calculations add no invented deviation/acceptance samples.
Existing UNKNOWN messages are narrative artifacts, not prediction records. Keep
all three bundled incidents unchanged and use late-act contexts only in isolated
non-production fixtures. Durable exposures and responses follow the approved
ledger transaction boundary; failed/conflicting commits cannot acknowledge new
official observations or overwrite the last committed prediction.

## Approved prediction-deviation projection

[DEC-022](../../.project-os/decisions/DEC-022-pooled-prediction-mismatch-rate.yaml)
defines the behavior measure independently from prediction confidence:

`predictionDeviation = total mismatching eligible responses / total eligible responses`

An eligible new accepted response must refer to a valid actual prior prediction
exposure in the same campaign run and attempt. Validate the chosen candidate
identity, availability and compatible response/opportunity rules against the
verified pre-response context. Preserve the exposure's predicted identity,
confidence/support, versions and ordered history boundary. The responding input
and its outcomes must not enter that exposure's original calculation.

The predicted identity yields no mismatch; a different eligible authored identity
yields one. Confidence cannot weight that binary observation. In a fixture with
prior `restart=3`, `rollback=1`, an eligible restart response yields `0/1` deviation
and rollback yields `1/1`, not rarity values `1/4` or `3/4`. This distinction is
not a moral judgement or a calibrated chance of future behavior.

Pool compatible raw counts across official attempts, including unfinished and
abandoned attempts, under DEC-014. With no eligible response the rate is
unavailable; supported responses with no mismatches yield observed zero. A
prediction calculated but not exposed, UNKNOWN, gated-off content, no response
or expiry supplies no positive/negative sample. Invalid references or unavailable
required definitions/context are diagnostics, not fabricated zero observations.
Exact exposure acknowledgement, response eligibility, validity/replacement and
action-equivalence definitions still require review; do not guess which response
belongs to ambiguous opportunities or assume every command is eligible.

An identified prediction opportunity contributes at most one associated response
sample. Further actions do not revise that sample; redisplay, replay and duplicate
delivery add none. Exact-head resume retains the original same-attempt identity;
a confirmed new checkpoint baseline cannot promote inherited exposure or history
into a new response. Imports, archive review, rejected inputs, timers and delegated
outcomes alone provide no player responses. Distinct genuine new opportunities
may each contribute even if their accepted commands have identical bytes.

Associate source input/response identity and derived counts with committed history
under DEC-013's transaction boundary. A failed or conflicting commit cannot
acknowledge new official samples; reconcile lost acknowledgements by identity.
Recommendation acceptance under DEC-021 remains a separate metric. Sharing an
action identity does not establish the required exposure for either metric or
automatically grant a numeric campaign effect. Operational actions and costs
are retained once, not dispatched again for prediction comparison.
One accepted action can independently qualify for each metric only when both
distinct exposure/eligibility contracts are satisfied; a recommendation match
must not be copied into a prediction-deviation sample or vice versa.

## Required TASK-021/022 verification fixtures

Allocation checkpoint: under DEC-031, arithmetic, eligibility, history and no-exposure
guards belong to TASK-022; actual exposure/response and all positive deviation/recovery
fixtures below belong to TASK-024 implementation and TASK-025 verification. Historical
heading retained for provenance; it no longer implies positive projection is implemented
or required for bounded TASK-022 completion. All remain required for M4.

These are proposed tests of the future APIs, not tests already implemented:

- Compatible comparable choices `restart=3`, `rollback=1` yield restart with
  share `3/4` when fixture support is met. A later rollback changes the next share
  to `3/5`, without rewriting the original exposure or guaranteeing future drops.
- In the same fixture, restart becoming unavailable leaves rollback with support
  `1` and share `1/1` only if authored support is met; otherwise UNKNOWN. Include
  an empty available set and missing/invalid availability definitions separately.
- Equal top counts return UNKNOWN; a tie among lower-count candidates does not
  prevent a unique top result. Empty and insufficient history have explicit reasons.
- Unfinished/abandoned genuine choices count; duplicate delivery, inherited/imported
  choices and archive inspection do not. Distinct official attempts can each count.
- Context changes and authored cross-incident mappings control comparability;
  unsupported/incompatible definitions cannot silently reuse the latest model.
- A current action and its future effects are absent from their own prior
  prediction. Repeat calculation/reload preserves recorded historical boundaries.
- Gated-off or UNKNOWN results yield no response observation; an exposed valid
  result is distinct from a recommendation. Preserve current MVP reveal limits.
- Transaction abort, conflicting revision and lost acknowledgement cannot create
  duplicate committed exposures/samples. Verify actual browser/native integration
  separately from pure headless prediction arithmetic.

Additional deviation fixtures must cover the future projection APIs:

- An exposed valid prediction followed by a matching versus different eligible
  candidate: supported `0/1` versus `1/1`, regardless of confidence.
- One mismatch in two eligible responses and another in ten: pooled `2/12`,
  not the mean of per-attempt percentages; retain abandoned official attempts.
- Hidden/UNKNOWN/invalid predictions, absent exposure, no eligible response,
  imports and inherited checkpoint prefixes: no invented observed-zero samples.
- Rejected, duplicate or later unrelated inputs, repeated display and archive
  review: preserve the original one-response association without recounting.
- Missing/unsupported rules, unavailable candidate identity and ambiguous
  association: diagnostic, never guessed mismatch or rewritten exposure.
- Exact-head resume versus confirmed new baseline and distinct genuine new
  opportunities: preserve provenance, count only eligible new response identity.
- Later actions/outcomes, transaction abort/conflict and lost acknowledgement:
  no causal leakage, retroactive confidence editing or duplicated committed counts.

Minimum counts and numbers here are fixture inputs, not production calibration.
Recommendation response policy is separately approved by
[DEC-021](../../.project-os/decisions/DEC-021-action-based-recommendation-response.yaml),
specified in the [response draft](recommendation-responses.md). DEC-022 approves
the mismatch-rate meaning of predictionDeviation, not the remaining authored
response/reveal mappings or a rarity-based scoring fallback.
Independent architecture review, acceptance QA and Project OS evaluation remain
required before TASK-018 completion or dependent runtime implementation.

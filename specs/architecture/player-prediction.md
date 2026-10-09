# Player prediction — TASK-018 review draft

Status: [DEC-020](../../.project-os/decisions/DEC-020-empirical-context-action-prediction.yaml)
approves empirical context-choice frequencies, not a behavioral scoring model.
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
an eligible response; exact response eligibility remains under review. A predicted
action is not automatically an AI recommendation or evidence of its acceptance.

UNKNOWN and gated-off calculations add no invented deviation/acceptance samples.
Existing UNKNOWN messages are narrative artifacts, not prediction records. Keep
all three bundled incidents unchanged and use late-act contexts only in isolated
non-production fixtures. Durable exposures and responses follow the approved
ledger transaction boundary; failed/conflicting commits cannot acknowledge new
official observations or overwrite the last committed prediction.

## Required TASK-021/022 verification fixtures

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

Minimum counts and numbers here are fixture inputs, not production calibration.
Recommendation response policy is separately pending in
[DEC-021's proposal](../../.project-os/decisions/proposals/DEC-021-recommendation-response-policy.yaml).
Independent architecture review, acceptance QA and Project OS evaluation remain
required before TASK-018 completion or dependent runtime implementation.

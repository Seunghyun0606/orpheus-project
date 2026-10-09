# Player behavior rates — TASK-018 review draft

Status: DEC-014 approves pooled eligible counts and DEC-016 approves operational
intervention denominators for restartRate/rollbackRate. This document specifies
their review and fixture boundaries, not runtime schema or production tuning.
DEC-017 also approves current-attempt investigation for evidence-before-action.
DEC-018 approves distinct observation counts averaged across eligible attempts.
DEC-021 approves matching eligible actions to recorded recommendation exposures.
DEC-022 approves predictionDeviation as pooled eligible-response mismatches.
DEC-023 approves independent safety/damage preference choice rates.
Other metrics retain explicitly pending eligibility/formula decisions.

## Approved operational rates

For a compatible definition version, retain three raw counts per official attempt:
eligible operational interventions, classified service restarts and classified
rollbacks. The latter counts are subsets of eligible interventions. Across a
campaign, sum each count over official attempts before division:

`restartRate = total service restarts / total eligible operational interventions`

`rollbackRate = total rollbacks / total eligible operational interventions`

Unfinished and abandoned attempts contribute eligible new commands. No eligible
intervention means unavailable, not observed zero. With an eligible denominator
and no restarts, a restart rate of zero is an actual supported observation.
Information gathering cannot lower either rate by increasing its denominator.
Do not derive the rate from rounded per-attempt rates or discard unsuccessful
attempts. Do not clamp malformed counts into apparently valid observations.

## Authored classification and provenance

A versioned definition associates actions with operational intervention and
service-restart/rollback classifications. References must resolve to the actual
scenario/content version and accepted action. Labels, action-ID substrings and
UI clicks are not classifications. Scenario categories help authors review data
but do not automatically prove that a command modifies production.

Observation, diagnosis, communication and information-only delegation are not
operational intervention samples. A delegation that actually changes the system
needs an explicit reviewed authored classification; its future outcome events
cannot count the same player command a second time. No current bundled action
classification is changed by this draft.

Proposed observation provenance retains run/attempt identity, accepted input
identity/sequence, scenario/content version and classification/formula version.
The exact field names require review. A missing definition, invalid reference or
incompatible version yields a diagnostic, not a guessed class or silent zero.
Do not mix incompatible versions or reinterpret old observations with newest
definitions without explicit compatibility treatment.

## Input and persistence boundaries

Count a newly accepted identified command once, not every replay or UI dispatch.
The same command accepted in a genuinely distinct official attempt is a new
sample. A duplicate committed input is not. UI incident restart creates the
attempt boundary and is not a service-restart numerator or intervention.
Rejected commands, inherited replay prefixes, imported discoveries, navigation,
archive review and standalone outcome/timer events add no command samples.

DEC-013's committed ledger remains authoritative for these derived projections.
Prepare counts through the pure domain, commit identities/history/projection
together, and publish official state only after transaction completion. Aborted
writes cannot create acknowledged samples; lost acknowledgements are reconciled
against committed identities. Stored rates are verified projections, not proof
of absent historical inputs.

DEC-015's suppression of a repeated discovery effect does not suppress a genuine
new behavior sample. Imported membership under DEC-011 is not historic behavior;
it cannot alone qualify evidence-before-action under DEC-017. This does not
remove membership or its eligibility for approved discovery-presence predicates.

## Approved evidence-before-action qualification

Use a metric-specific authored definition of eligible interventions and relevant
supporting observations. DEC-016 defines the restart/rollback denominator; it
does not silently select eligibility for every other metric. For each new
accepted eligible intervention, inspect the verified pre-action context and
earlier new investigation inputs in the same official attempt. The numerator
counts interventions with qualifying relevant support; the denominator counts
eligible interventions. Pool these counts under DEC-014.

Relevant diagnostic signals or evidence must be linked by validated authored
references, not titles, arbitrary artifact count or generic action categories.
Retain supporting input/event identity, attempt identity, ordered observation
boundary and applicable rule version so the result is explainable and replayable.
Exact record fields and relevance/freshness definitions remain under review;
no expiry interval or automatic permanent validity is chosen here.

An observation must be available before the intervention. Its resulting evidence
cannot qualify that same intervention. A pending delegated investigation alone
is not a received observation; any actual returned support needs its verified
source, availability order and authored relevance. Outcome events are not extra
player-command samples.

An inherited checkpoint prefix, prior attempt or adopted legacy membership alone
cannot be positive support. A later new investigation can qualify only through
its verified new observation, not by recounting inherited events. Exact-head
resume preserves the same attempt's already recorded new inputs; it neither
erases their provenance nor produces another sample on load. A confirmed new
checkpoint-based attempt retains the prefix as baseline, not fresh investigation.

Where eligibility and relevance rules are valid and an eligible intervention has
no qualifying prior support, record a negative observation. If required rules or
versions are missing/invalid, return a diagnostic instead of fabricating a
negative. No eligible intervention means unavailable. Do not retroactively
change an earlier intervention when evidence is obtained later, or infer missing
historical investigation from a current revealed-state snapshot.

## Approved investigation depth

Retain the set of authored investigation observation keys attributable to new
accepted investigation inputs in each eligible official attempt. A key counts
once in that attempt. Different command bytes, event IDs, display labels or a
compatible content version bump do not themselves create distinct keys. Authored
target/context dimensions must validate and define their identities explicitly;
do not infer them from every changed metric value or evidence title.

`averageInvestigationDepth = sum of per-attempt distinct key counts / eligible attempt count`

An eligible attempt has supported versioned investigation definitions and at least
one new accepted player command. If it has no qualifying investigation, its count
is zero. Empty attempts and unsupported definitions provide no denominator sample;
retain diagnostics/unsupported coverage rather than presenting partial coverage
as universally observed behavior. No eligible attempt means unavailable.
Eligible unfinished/abandoned attempts remain included and receive equal weight.
This measure is observations per attempt, not the action-frequency ratios of
DEC-014. Rates still pool their own eligible command samples.

Repeated queries remain accepted actions and retain their time, cost and outcomes;
only duplicate observation keys within the same attempt are excluded from depth.
A new distinct official attempt can investigate a key again. This is different
from DEC-015's campaign-wide effect receipt: suppressing an already-applied numeric
discovery effect cannot suppress a qualifying new investigation observation.

Preserve each key's verified new source input/event and definition version. A
delegated result must become available and trace to a new accepted qualifying
investigation input in this attempt. An inherited delegation does not become new
investigation merely because its result arrives during a later command. Merely
requesting work or importing a revealed-state snapshot does not prove an observation.
Inherited prefixes and baseline discoveries add no depth.
Exact-head resume retains the existing same-attempt key set without recounting;
a confirmed checkpoint-based new attempt starts its new-observation set empty.
Reject invalid references/conflicting semantics; no silent version mixing or
fabricated legacy keys. No production observation mapping is added here.

## Required verification (new APIs not implemented here)

| Case                                                                           | Expected result / owner                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| One restart, one rollback, one other intervention, six information commands    | Each rate is 1/3; information commands excluded; TASK-021             |
| One attempt with one restart in two interventions, another with one in ten     | Pooled restartRate is 2/12, not the mean of 1/2 and 1/10; TASK-021    |
| Only accepted information commands                                             | Both rates unavailable, not zero; TASK-021                            |
| Eligible interventions but no service restart                                  | Supported restartRate is zero; TASK-021                               |
| New identical command in another official attempt vs duplicate input delivery  | First adds an eligible sample, second does not; TASK-019/021          |
| UI restart, rejected action, inherited prefix, timer, import or archive review | No extra command samples; TASK-019/020/021                            |
| Missing classification, invalid numerator subset or incompatible version       | Diagnostic, no guessed or clamped projection; TASK-021                |
| Ledger conflict, abort or commit-before-ack reload                             | Counts and identities remain coherent, no double sample; TASK-020/021 |

Additional evidence-before-action fixtures for TASK-019/020/021 must cover:

- Relevant new investigation before an eligible intervention: positive sample.
- Unrelated investigation, imported membership or inherited prefix alone:
  negative for a valid eligible intervention, not fabricated past behavior.
- Evidence obtained during or after the intervention: no retroactive positive.
- Exact-head resume versus confirmed new checkpoint-based attempt: preserve
  original same-attempt support, do not promote inherited support to fresh input.
- Pending delegation versus verified returned support before the intervention:
  no positive observation from merely scheduling work.
- Missing/invalid rules, no eligible intervention, duplicates, replay and commit
  failures: diagnostic/unavailable/idempotent behavior as applicable.

Additional investigation-depth fixtures for TASK-019/020/021 must cover:

- Three investigation commands yielding two distinct keys in one eligible
  attempt, and another eligible attempt with no investigation: depth `(2+0)/2=1`.
- Repeated commands for one key: preserve all accepted inputs/outcomes, one depth
  unit; different valid authored keys contribute separately.
- Same key in a distinct official attempt: count anew there, not as a repeated
  campaign numeric award; abandoned attempts remain included.
- No new accepted commands or only inherited/imported observations: no eligible
  attempt sample; supported new action with no investigation: eligible zero.
- Unsupported definitions, changed/conflicting key semantics, resume, duplicate
  delivery and transaction failures: coverage/diagnostic/idempotency boundaries.

Fractions are arithmetic-only fixtures, not prediction confidence or ending
thresholds. Authored tradeoff and remaining response eligibility definitions still
require reviewed contracts. DEC-020 approves empirical context-choice prediction;
its [review draft](player-prediction.md) now specifies DEC-022's approved mismatch
rate separately from confidence and recommendation acceptance.
DEC-021 approves action-based recommendation response counting, specified in the
[response draft](recommendation-responses.md). DEC-023 approves independent safety
preference and collateral damage tolerance rates, specified in the
[preference draft](preference-rates.md). DEC-024 separately proposes reporting/
cooperation sample units and remains unselected.
Existing UNKNOWN messages cannot stand in for recommendation or NULL cooperation
observations. Independent review and acceptance QA remain pending.

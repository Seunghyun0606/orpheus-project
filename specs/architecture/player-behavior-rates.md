# Player behavior rates — TASK-018 review draft

Status: DEC-014 approves pooled eligible counts and DEC-016 approves operational
intervention denominators for restartRate/rollbackRate. This document specifies
their review and fixture boundaries, not runtime schema or production tuning.
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
whether it qualifies a future action's evidence-before-action observation is the
separate pending DEC-017 question.

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

Fractions are arithmetic-only fixtures, not prediction confidence or ending
thresholds. Investigation depth, ethical intent, recommendation/response
opportunities and prediction formulas still require their reviewed contracts.
Existing UNKNOWN messages cannot stand in for recommendation or NULL cooperation
observations. Independent review and acceptance QA remain pending.

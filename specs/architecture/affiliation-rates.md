# Reporting and cooperation rates — TASK-018 review draft

Status: [DEC-024](../../.project-os/decisions/DEC-024-explicit-affiliation-response-rates.yaml)
approves eligible responses to explicit opportunities, not all activity while
an opportunity is available. This logical contract does not implement runtime
schema, UI exposures, persisted fields or TASK-021. Exact opportunity/predicate
definitions and integration remain under review; no production tuning is chosen.

## Independent opportunities and formulas

Use separate versioned authored reporting and cooperation opportunities. Each
requires known availability and verified pre-action context in the selected
official run and attempt. An eligible new accepted decision response contributes
one denominator unit for its applicable metric. A reporting/cooperation response
meeting that metric's positive predicate adds one positive; another eligible
explicit response adds none. Unrelated information gathering is not a response.

`companyReportingRate = total classified reporting responses / total eligible reporting responses`

`nullCooperationRate = total classified cooperation responses / total eligible cooperation responses`

Pool compatible raw counts across official attempts under DEC-014, including
unfinished/abandoned attempts. Do not average per-attempt percentages or divide
by every command, all displayed opportunities, discovered artifacts or elapsed
time. An opportunity without an eligible response or an expiry alone provides no
positive/negative observation. Supported responses without positives give
observed zero; no eligible responses give unavailable, not neutral allegiance.

The rates are independent, not complements. One metric can be available without
the other. An action may qualify for both only if both distinct authored
opportunity/eligibility contracts are genuinely satisfied; one response record
cannot substitute the other's missing provenance. Numeric corporate/NULL
alignment is a separate authored campaign effect, not these raw behavior rates.

## Known context and provenance

Retain opportunity identity, run/attempt, source accepted input/sequence, verified
pre-response context and scenario/classification versions. Validate opportunity,
action and positive/negative response references against the recorded definitions,
not action names, labels or generic communication categories. Support status is
not automatically corporate allegiance. UNKNOWN hints do not establish NULL
identity, cooperation opportunities or a reason to classify unrelated actions.

Authored known availability and response rules must distinguish genuinely
available decisions from inaccessible content. No discovered or imported artifact
alone establishes a historic response. DEC-011 membership can satisfy approved
presence predicates, but a later response still needs its own valid opportunity
and genuine new input provenance. Do not invent behavior from old alternate
snapshots or interpret missing legacy records as refusing to cooperate/report.

Exact availability/acknowledgement, expiry/replacement and opportunity consumption
definitions still require review. Do not select an arbitrary overlapping
opportunity, assume a default deadline/permanent validity, or classify every
communication as an eligible response. Missing/invalid required definitions,
unknown context or incompatible versions yield diagnostics, not fabricated
negatives. A later result cannot retroactively make earlier inaccessible content
known or rewrite the recorded classification of an accepted response.

## Identity and transaction boundaries

An identified opportunity contributes at most one associated response sample
per metric. Subsequent unrelated actions or redisplay do not extend its denominator
or replace that sample. Duplicate committed source delivery is idempotent;
reusing identity with a different payload or ambiguous association is a conflict.
Genuinely distinct valid opportunities can contribute genuine new responses,
including identical command bytes in separate official attempts.

Exact-head resume retains existing same-attempt identities without recounting.
Confirmed checkpoint attempts treat inherited exposures/responses/history as
baseline, not new behavior. Imports, archive review, rejected/duplicate inputs,
UI navigation, timers and delegated outcomes alone add no response samples.
DEC-015 once-per-run effect suppression must not erase genuine new retry behavior;
response matching itself neither grants automatic alignment nor dispatches an
extra operational action or cost.

Prepare association, counts and history through the pure domain and commit them
under DEC-013's revision-checked IndexedDB transaction. Publish new official
observations only after transaction completion. Abort/conflict preserves the last
committed counts; lost acknowledgements reconcile by committed identity. Do not
rewrite incompatible history with the latest definitions or mutate legacy stores.

## Required TASK-019/020/021/024 fixtures

These cover future APIs, not newly implemented tests in the current legacy suite:

- Known reporting opportunity, unrelated observation then eligible report:
  `1/1`, not activity share `1/2`. Additional unrelated commands do not dilute it.
- Eligible explicit non-reporting/non-cooperation response: supported `0/1`;
  no eligible response, expiry or inaccessible opportunity: unavailable, not zero.
- One classified positive in two responses and another in ten: pooled `2/12`,
  not per-attempt averages; retain eligible abandoned/unfinished histories.
- Independent metric availability and valid dual eligibility: separate provenance
  and counts, never complements or copied samples; one accepted action/cost.
- Generic Support communication and UNKNOWN hints without explicit definitions:
  no invented corporate allegiance, NULL opportunity or automatic numeric alignment.
- Duplicate delivery, redisplay, replay and subsequent actions for one opportunity:
  one response sample; conflicting identities/associations produce diagnostics.
- Imports, inherited prefixes, exact-head resume, new checkpoints and archive
  review: retain existing identity, count only new qualified responses.
- Invalid predicates/references, required context and incompatible versions:
  diagnostic, no guessed negative or silent historical reinterpretation.
- Later outcomes, revision conflict, abort and lost acknowledgement: no causal
  leakage or duplicated committed counts. Actual exposure/native storage checks
  remain separate from pure calculation fixtures.

Current MVP content, both legacy stores and production thresholds remain unchanged.
Independent architecture review, acceptance QA and Project OS evaluation are
required before TASK-018 completion. See the
review/QA execution request.

_Links to process artifacts removed under DEC-070 were dropped; the originals remain at git tag `archive/pre-process-consolidation`._

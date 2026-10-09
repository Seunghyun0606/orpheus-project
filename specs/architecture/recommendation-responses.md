# Recommendation responses — TASK-018 review draft

Status: [DEC-021](../../.project-os/decisions/DEC-021-action-based-recommendation-response.yaml)
approves measuring following behavior through actual eligible accepted actions,
including manual execution. This logical contract does not implement a response
schema, exposure UI, campaign adapter or TASK-021/022. Detailed authoring and
integration still require review; no production tuning or new MVP content is added.

## Exposure and opportunity

A recommendation opportunity requires a verified actual gated exposure in the
selected official campaign run and attempt. Preserve its identity, recommended
action identity, candidate availability, definition version and ordered pre-response
boundary. Mere calculation, hidden/gated-off content, reopening an archive or
UNKNOWN narrative text does not establish an opportunity. Predictions are not
automatically recommendations, even if the action identities happen to match.

Validate references and eligibility against the applicable content version and
verified state, not UI wording, category labels or action-ID substrings. Exact
adapter visibility acknowledgement fields, validity/expiry predicates, opportunity
replacement and action-equivalence mappings are reviewed authored contracts.
Do not silently assume permanent validity, invent a timeout, select the latest of
ambiguous overlapping opportunities, or create opportunities from old snapshots.
Unresolved associations or invalid/unsupported required definitions are diagnostics,
not negative response samples. These policy gaps block affected implementation.

## Matching an accepted response

While an opportunity remains valid, its next new accepted action classified as
an eligible response consumes its single response sample. The authored recommended
identity matches positively; another eligible identity matches negatively. Manual
execution can match; a separate accept/reject button is not required. A UI click,
rejected action or unrelated information command does not automatically count.
Information/communication commands only respond if their reviewed authored rules
actually classify them as eligible for that opportunity.

Use the verified pre-action opportunity and command identity, not the command's
later outcomes. A valid opportunity without an eligible response contributes
neither positive nor negative counts. Expiry is not rejection. A recommendation
that becomes unavailable cannot turn into an automatic refusal. Do not relabel
an earlier response after a later observation, recommendation or outcome arrives.

Recommendation matching describes observable following behavior, not causation:
a player may independently choose the same action. It is not a moral judgement
or automatic change to AI_DEPENDENCY/alignment. Numeric campaign effects remain
separate authored transitions with their own provenance/application rules.
DEC-016 operational rates retain their existing intervention classification;
response matching does not dispatch a second operational action or charge again.

## Projection, identities and persistence

`aiRecommendationAcceptanceRate = total matching eligible responses / total eligible responses`

Pool compatible counts across official attempts under DEC-014, including new
eligible responses in unfinished/abandoned attempts. An eligible negative
response yields supported zero when it is the only response; no eligible response
yields unavailable, not zero. Do not divide by all displayed recommendations or
all commands, or average percentages per attempt. Preserve counts/coverage and
versions rather than reconstructing absent observations from current artifacts.

Each opportunity can contribute at most one response sample, with associated
source input and sequence. Repeated delivery of the same identity is idempotent;
changed payload under the same identity is a conflict. Additional actions after
that response do not revise its sample or generate another one from redisplay.
A genuine distinct official opportunity requires valid new exposure provenance,
not a timestamp or byte-different copy of a historical display.

Exact-head resume retains the same attempt's existing opportunity/response
identities; loading alone produces neither. A confirmed new checkpoint-based
attempt cannot promote inherited exposures/responses into new samples. Imported
discovery membership and legacy archive snapshots supply no such behavior.
Timers and delegated outcomes alone cannot supply player responses.

Prepare association and derived counts in the pure domain and commit them with
accepted input identity/history under DEC-013's revision-checked IndexedDB
transaction. Publish official observations only on transaction completion.
Abort, conflict and lost-acknowledgement recovery must preserve the last committed
state and prevent duplicate samples. Do not infer cross-store atomicity or write
either legacy slot through this new metric. Physical exposure/commit ordering
needs actual integration verification, not just a headless match calculation.

## Required TASK-019/020/021/022/024 fixtures

These are future tests, not new APIs already covered by the current legacy suite:

- Valid rollback exposure followed by a manual eligible rollback: `1/1` positive.
- Valid rollback exposure followed by another eligible intervention: `0/1`, not
  unavailable. The same action without exposure: no sample.
- An unrelated information command before the qualifying action does not consume
  the opportunity when fixture eligibility rules exclude it.
- No response, expiry, unavailable recommendation, hidden content, prediction-only
  result and UNKNOWN hint: no fabricated refusal or opportunity.
- One attempt with one match in two responses and another with one in ten:
  pooled `2/12`, not the mean of `1/2` and `1/10`; abandoned history is retained.
- One opportunity and repeated/replayed inputs or redisplay: at most one sample;
  conflicting identity is diagnosed. Distinct valid exposures remain distinguishable.
- Same-attempt exact-head resume versus a new checkpoint baseline, imported legacy
  records and archive review: retain existing identity, never manufacture samples.
- Missing eligibility/version/reference and ambiguous opportunity association:
  diagnostic, not an invented match or rejection.
- A response's later outcomes cannot create its earlier exposure or rewrite its
  match. Operational history/costs are retained once, irrespective of sample status.
- Revision conflict, abort and lost acknowledgement preserve coherent committed
  identity/counts. Verify gated exposure and native persistence separately.

Production eligibility, expiry/replacement and response mappings are not fixture
arithmetic. Prediction-deviation meaning is separately pending in
[DEC-022's proposal](../../.project-os/decisions/proposals/DEC-022-prediction-deviation-policy.yaml).
Independent architecture review, acceptance QA and Project OS evaluation remain
required before declaring TASK-018 complete or starting dependent implementation.

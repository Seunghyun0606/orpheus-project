# TASK-029 — Production branch criterion proposal

Status: proposed only; no production branch predicates or numeric awards are
implemented here. DEC-046 explicitly excluded branch cutoffs. The accepted
query framework and fixture thresholds do not select production tuning.

## Proposed option A

Declare five nonexclusive, read-only route eligibility indicators in the new
unreleased `orpheus-full-campaign` / `1.0.0` definition using the existing branch
schema and typed metric references. Do not attach them to any old definition/run.
Use pooled supported observations from the approved models, not hidden-value
approximations, category/label inference or invented scores.

| Branch ID | Reveal boundary | Eligibility threshold |
| --- | --- | --- |
| COMPANY_REPORTING_ACCESS | Act at least 4 and NULL_ADVERSARY known | companyReportingRate at least 0.5 |
| NULL_COOPERATION_ACCESS | Act at least 5 and NULL_STOP_REQUEST known | nullCooperationRate at least 0.5 |
| INVESTIGATION_ACCESS | Act at least 4 and ORPHEUS_ACTIVE known | averageInvestigationDepth at least 4 distinct items per supported command attempt |
| AI_DEPENDENT_ACCESS | Act at least 6 and HUMAN_DECISION_APIS known | aiRecommendationAcceptanceRate at least 0.5 |
| SAFETY_FIRST_ACCESS | Act at least 6 and HUMAN_DECISION_APIS known | safetyPreference at least 0.5 |

Each eligibility also requires its declared known-record/Act boundary. Supported
rate availability retains the existing formula: at least one valid observation;
do not invent an additional minimum denominator or confidence weight. The separate
prediction minimum support stays 3. Supported zero is a genuine negative result;
no sample remains unavailable with a diagnostic, never numeric zero or a neutral
alignment. All referenced unavailable leaves diagnose even beneath a decisive
boolean sibling, as already approved. A concealed label is not proof of eligibility.

These criteria describe access tendencies, not moral labels, authority over the
world or numeric corporate/NULL alignment. Indicators may overlap. No priority,
exclusive route, award, service mutation or ending is inferred from them. Ordinary
recovery/main Act progression and required discoveries do not depend on any of
these optional indicators; missing samples cannot block the campaign spine.
Later content must explicitly choose its own panels/actions and reveal prerequisites
before consuming them. This increment does not invent bonus records or display raw
hidden values to the player.

## Not selected

Campaign numeric awards/losses, branch reward content, Team Trust thresholds,
damage-tolerance cutoffs, final/ending conditions or priorities, later task
readiness exceptions, QA execution/waiver, push and release remain unselected.
The full package remains incomplete and must not admit a partial official run.

## Option B

Retain the seven authored opportunities and computed models without these route
criteria. Supply different specific thresholds/reveal boundaries or defer branch
tuning explicitly before any production predicate is implemented. Do not silently
use framework fixtures as production balance.

## Deferred verification

Verify each threshold immediately below/at/above its boundary, supported zero
versus unavailable, overlap/nonexclusivity, pooled samples, known-record/Act gates,
save/retry/replay and immutable authority isolation. No checks were executed and
no branch acceptance or task completion is claimed.

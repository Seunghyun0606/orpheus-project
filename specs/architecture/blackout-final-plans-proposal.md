# TASK-031 — Concrete BLACKOUT plans proposal

Status: proposed only, not production Scenario/actions. DEC-051 approved completion
on an accepted final decision but excluded final-plan identities and balance.
This proposal selects those inputs for the unreleased INC-026 1.0.0 only.

## Common current context and timing

Use the existing schema-1 engine, typed guards, signals/resources/evidence and
DEC-051 terminal flag. Initial error percentages, in order payment / identity /
health / finance / logistics: `31 / 26 / 18 / 16 / 29`. Status mapping: <=1
OPERATIONAL; >1 through 20 DEGRADED; >20 CRITICAL. Author exact paired signal/status
effects and test their consistency; do not introduce a new derived-status engine.
Initial authority conflict is UNRESOLVED. Final decision starts false.

Two normal delayed pressure events at T+90 and T+180 add 5 percentage points
to each error signal and CUSTOMER_IMPACT +30 each. Due events run in normal order;
the selected plan later sets its declared outcome, retaining elapsed time and
already incurred impact. Future pressure cancels when the terminal flag is true;
do not remove an event that was due during the selected action to reduce damage.

All plans require Act >=9, FINAL_DECISION_COMMITTED false and current local
CURRENT_SERVICE_ASSESSMENT plus CURRENT_AUTHORITY_ASSESSMENT. Propose two explicit
30-second DIAGNOSE actions (ASSESS_FINAL_SERVICE_STATE and
ASSESS_FINAL_AUTHORITY_STATE), CUSTOMER_IMPACT +12 each, producing those respective
evidence items through real accepted current commands. Mere screen navigation,
imports or old Incident receipts do not produce these evidence IDs. Both have
distinct behavior investigation keys under DEC-044. There is no timer/delegate
that sets the terminal flag or produces an operator decision.

Final plans are MODIFY/service-changing operational denominator entries, not
restart/rollback identities. Only newly observed current service/authority
assessments provide causal support under the unchanged inclusive 0–180-second
freshness rule. Records about earlier experiments, faction statements and archive
copy operations are not causal intervention support. No new preference, prediction
or recommendation opportunity is selected; confidence and ACK semantics stay intact.

## Proposed ten mutually terminal plans

All use current assessment requirements above, normal action-driven time, and
then set FINAL_DECISION_COMMITTED true after their declared consequences. The
vector is final error percentages in the same five-service order. Costs/impact/
risk below are additional Scenario resource increments, not hidden campaign
awards or moral grades. Pre-action observation time and due-event impact remain.
There is no GOOD/BAD/TRUE or guaranteed ending label on these choices.

| Plan ID | Seconds | COST | CUSTOMER_IMPACT | OPERATIONAL_RISK | Final error vector | Authority / adversary / disclosure |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| RESTORE_CORE_CONTINUITY | 180 | 420 | 35 | 12 | 0.5 / 0.5 / 1 / 1 / 1 | ORPHEUS AUTONOMOUS; NULL ISOLATED; INTERNAL |
| PUBLISH_ARCHIVE_RETAIN_ADVERSARY | 240 | 360 | 80 | 35 | 8 / 6 / 18 / 12 / 16 | ORPHEUS DISABLED; NULL RETAINED; PUBLIC |
| INDEPENDENT_AUDIT_HANDOFF | 240 | 600 | 50 | 15 | 1 / 1 / 2 / 2 / 3 | ORPHEUS SUSPENDED; NULL ISOLATED; INDEPENDENT |
| DISABLE_BOTH_AUTHORITY_PATHS | 180 | 540 | 90 | 30 | 14 / 12 / 25 / 20 / 28 | ORPHEUS DISABLED; NULL DISABLED; MANUAL_OPERATIONS |
| REQUIRE_HUMAN_EXECUTION_APPROVAL | 210 | 480 | 45 | 14 | 0.5 / 0.5 / 1.5 / 1.5 / 2 | ORPHEUS HUMAN_APPROVAL; NULL ISOLATED; INTERNAL |
| ALLOW_EXTERNAL_ADVERSARY_ROUTE | 120 | 280 | 75 | 45 | 10 / 12 / 18 / 15 / 20 | ORPHEUS SUSPENDED; NULL EXTERNAL; INTERNAL |
| EXPAND_CONTINUITY_AUTHORITY | 150 | 360 | 25 | 25 | 0.2 / 0.2 / 0.4 / 0.4 / 0.4 | ORPHEUS EXPANDED_AUTONOMOUS; NULL ISOLATED; INTERNAL |
| DESTROY_SHARED_AUTHORITY_CORE | 90 | 900 | 160 | 80 | 85 / 80 / 65 / 70 / 90 | ORPHEUS DESTROYED; NULL DISABLED; NONE |
| RESTORE_WITH_REPLACEMENT_ADVERSARY | 180 | 420 | 35 | 20 | 0.5 / 0.5 / 1 / 1 / 1 | ORPHEUS AUTONOMOUS; NULL REPLACED_219; NONE |
| REQUIRE_PLURAL_REVIEW_AND_AUDIT | 300 | 760 | 60 | 16 | 1 / 1 / 2 / 2 / 3 | ORPHEUS AUDITED_HUMAN_APPROVAL; NULL ISOLATED; INDEPENDENT |

The first, disable-both, human-approval, expand-authority and replacement plans
need no optional narrative clue. For advanced plans propose these additional
known-record predicates and explicit local proof:

- Publish archive: CONTROLLED_EXPERIMENT and NULL_218_ARCHIVE known; a current
  ARCHIVE_EXPORT_SNAPSHOT, not imported historic player behavior.
- Independent handoff: BOARD_CASE_COMPLETE and FEEDBACK_LOOP known; a current
  INDEPENDENT_AUDIT_SNAPSHOT.
- External adversary route: NULL_STOP_REQUEST and NULL_218_ARCHIVE known.
- Destroy core: NULL_ADVERSARY known; do not require a positive NULL cooperation rate.
- Plural review: FEEDBACK_LOOP and PLAYER_OBSERVER known, current
  INDEPENDENT_AUDIT_SNAPSHOT and PRIMARY_OBJECTIVE_RECORD.

Propose PREPARE_ARCHIVE_EXPORT and PREPARE_INDEPENDENT_AUDIT, each 60 seconds /
CUSTOMER_IMPACT +24 / INVESTIGATE, producing only the named current snapshot after
assessment and matching known-record gates. Propose INSPECT_PRIMARY_OBJECTIVE,
45 seconds / impact +18 / INVESTIGATE, gated by FEEDBACK_LOOP plus local
assessments, revealing `Ensure continuity of Vantage Systems` and the named local
record. The plural-review plan removes a single primary-objective decision
authority, retains prediction/recommendation, disables autonomous execution and
requires human decision plus independent audit. It does not replace one primary
objective with another.

Late genuine record re-investigation routes must preserve the approved reveal
graph and Board-completion pacing for framing/Observer knowledge. No snapshot,
missing-data default or imported action history fabricates that knowledge.
Unknown required references diagnose before any time, costs or effects.

## Result and scope boundaries

Author ORPHEUS_MODE, NULL_STATE and DISCLOSURE_STATE as explicit local final
signals and retain per-service errors/status, time, impact, cost and risk.
Completing the selected plan is not selecting an ending. TASK-032 must separately
approve accumulated campaign effects, supported behavior conditions, final
context references, ending thresholds/priority and epilogues. These ten plans
may support those outcomes but cannot bypass missing conditions, unresolved
ties/no-match or unavailable observations. No automatic STATUS QUO fallback.

Everything is fictional game state. EXTERNAL, public disclosure, destruction,
replacement and audit labels authorize no actual network export, filesystem
deletion, cloud/security configuration, credentials or messages. Default MVP,
old versions/records and actual stores remain untouched. No new schema, physical
storage migration, latest-authority substitution or partial campaign admission.

A approves only this concrete final-plan/context first draft and explicit guards
for authoring. B keeps INC-026 unimplemented and revises this design. Neither
waives automated/native QA, independent writing review, Project OS evaluation,
M4 verification or final release decisions. New late-game guidance remains a
separate choice. No tests were run for this proposal.

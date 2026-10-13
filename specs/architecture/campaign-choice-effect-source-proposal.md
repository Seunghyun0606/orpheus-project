# Proposed source contract for campaign choice effects — TASK-032

Status: pending human approval. DEC-054 fixes required ending inputs, not effect
sources or numeric balance. This proposal adds no runtime code, record migration,
numerical awards, ending conditions or completed-task claim.

## Why the current contract is insufficient

`src/scenario/campaign.ts` permits only `evidence_revealed`, `narrative_triggered`
and `completion_reached` effect triggers. `projectEvents` in
`src/engine/campaign/transitions.ts` applies their numeric effects once per run
and records the real simulation event sequence. Many important choices produce
neither discovery nor completion: INC-011's explicit report/withhold actions only
post messages. Inventing a discovery award for them would change the story.

The actual recommendation response exists separately in
`OpportunityResponse` (`src/engine/campaign/opportunities.ts`): rule/model,
preparation, committed acknowledgement, attempt, input, operation, prior head,
selected action and calculated positive/negative outcome. It is associated only
after a valid accepted command and genuine eligible exposure. These records are
not simulation narrative events. Reading a recommendation or performing a
matching action without an ACK must not be mistaken for observed acceptance.

Therefore, evidence/complete-only effects cannot faithfully award an AI-dependency
choice score from an actual response. Conversely, adding an optional unsampled
rate to an ordinary effect condition can diagnose and reject the command itself.
DEC-054 does not authorize either unavailable-as-zero or this accidental new gate.

## A — Extend the explicit trigger, preserving existing receipt provenance

Add `action_completed` to the campaign effect trigger enum. Its `targetId` is
mandatory and must identify an allowed Scenario action. It matches only a real
`action_completed` simulation event from the newly accepted command in this
official attempt. The operation's action, event action and target must agree.
Neither an action-history membership test nor a baseline prefix can substitute.

Optionally qualify this trigger with exactly:

```yaml
response:
  ruleId: CARE_CAPACITY_RECOMMENDATION
  positive: true
```

The qualifier must match a **newly associated** `OpportunityResponse` in the same
candidate command, not a response previously stored in this or another attempt.
Require exact rule/model authority, operation/input/attempt/command sequence,
prior head and action agreement, with the validated preparation and committed ACK
already enforced by the existing association contract. Require the requested
positive/negative outcome as calculated by that contract; do not recalculate it
from a displayed rate or caller-provided boolean.

An absent, expired, unrelated, unacknowledged or already consumed response does
not trigger a response-qualified effect. It is not a negative response and must
not reject an otherwise valid unqualified command. A malformed qualifier,
incompatible rule/model or internally inconsistent record is a diagnostic, not a
non-match. The existing response association diagnostics remain intact.

Examples below are source shapes only; they approve no point amounts or effect
IDs and must not be registered as runtime authority before approval:

```yaml
# Explicit company reporting, independently of whether a report opportunity was exposed.
trigger:
  incidentId: INC-011
  type: action_completed
  targetId: SEND_GENERATOR_OWNERSHIP_REPORT

# An actual acknowledged recommendation acceptance, not merely a matching command.
trigger:
  incidentId: INC-015
  type: action_completed
  targetId: ADD_CARE_ROUTING_CAPACITY
  response:
    ruleId: CARE_CAPACITY_RECOMMENDATION
    positive: true
```

Static validation must reject a response qualifier on any other trigger type.
It must verify the rule's incident/content/model binding and a matching declared
response action; a recommendation positive trigger must target its recommended
action. Compatible-content `additionalTriggers` use the same explicit checks and
cannot infer a current model or arbitrary other-version action.

Apply the score at that real action-completed event after normal action time and
consequences. Preserve the effect's declared pre-command/post-event condition
boundary. At this point the validated candidate response already exists; do not
publish it or its award before transactional storage completes. A failed command,
diagnostic, abort or optimistic conflict publishes no new official receipt/score.
Duplicate operation delivery is idempotent. Retrying a genuinely new command may
add behavior samples, but the same logical effect identity is paid only once.

Use the existing `effectReceipts` shape and that actual event's sequence; no fake
event, sentinel event index, ACK event masquerading as a simulation event or new
save format is needed. Exact replay derives the award from the accepted operation,
simulation event and verified response under its recorded definition. Lost-ACK
recovery uses committed records, not a second award. Existing discovery and
completion effects are unchanged.

Scope is only the new, unreleased `orpheus-full-campaign` definition. Keep frozen
old definitions/records/model rules and the default MVP unchanged. No new
opportunities, actual exposure, future guidance, imported behavior or ending grant
is introduced. The pending complete-package authority must not be made startable
with partial content merely to exercise this proposal.

## B — Keep the existing source contract

Author only existing evidence/narrative/completion-triggered numeric effects.
Do not infer recommendation acceptance from a matching action or metric default.
Defer reporting/AI-response choice scores and the dependent balanced ending rules
until a separately approved alternative representation exists. Evidence-only
initial progress is possible, but it cannot claim all ten production endings are
implemented or preserve their behavior-derived requirements by itself.

## What is still unselected

Numerical weights, ten exact eligibility conditions/ranks and conditional
title/PROMETHEUS gates remain separate balance/content approvals. Current approved
opportunities contain only one recommendation rule, so one positive response is
not evidence of sustained or near-universal dependence. Do not label that alone
as the very-high dependency required for THE BOARD; its complete production
reachability/balance proposal must address the actual evidence coverage explicitly.

## Required verification after QA resumes

- Raw accepted report choice with/without opportunity ACK; no story discovery added.
- Positive/negative recommendation responses and direct matching action with no ACK.
- Expiry, unrelated commands, stale/consumed/cross-attempt response and rejected action.
- Real event sequence and ordering; baseline/import never awards a new choice effect.
- Multiple rules on one command use their exact identities; no duplicate-effect farming.
- Retry, duplicate operation, replay, abort/conflict and durable lost-ACK recovery.
- Strict validation of targets/qualifiers/compatible versions; old exact authority regressions.
- Full campaign and genuine accumulated-run ending reachability, not arbitrary projection edits.

These are proposed cases, not executed tests or independent acceptance evidence.

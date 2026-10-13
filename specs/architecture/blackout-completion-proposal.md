# TASK-031 — BLACKOUT completion contract proposal

Status: proposal only, not final Scenario/action data. DEC-050 authorizes early
TASK-031 readiness, not final gameplay behavior or ending balance.

## Evidence and required decision

The current `resolveCampaignEnding` query requires the requested exact final
attempt to have `completionReached` and a newly recorded `completion_reached`
event outside its inherited baseline. It does not require healthy services.
Earlier authored operations finish after causal containment and healthy signals.
Copying that completion contract to INC-026 would make destructive or manual
shutdown outcomes depend on restoring the same services first. The approved
campaign includes both continuity and costly interruption outcomes, without
declaring one correct. The final gameplay completion contract therefore needs
an explicit human decision before INC-025/026 final-action authoring.

## Proposed A — complete on an explicit accepted final decision

Use existing schema-1 Scenario flags/conditions, not a resolver/record/schema
extension. INC-026 starts with `FINAL_DECISION_COMMITTED: false`. Only a later
explicitly approved, available final-plan action may set it true after its
normal action-driven time and authored consequences. All final-plan actions
require that flag false; they are mutually terminal within that attempt.
Scenario completion requires the true decision flag, not health or a moral score.

Final actions must have explicit local current-service/authority investigation
requirements. Do not require every optional narrative clue for ordinary crisis
access. Specific advanced plans may have separately approved clue predicates;
missing or unavailable observations cannot be guessed. Mere timer/delegation,
navigation, a recommendation ACK, archive import or inherited prefix never
creates a new final decision/completion. Existing accepted-command identity,
pre-command guards, deterministic action/event ordering and transactional
commit-before-publish remain unchanged. Do not discard due events to pretend
the final decision avoided their impact.

Record actual service health, authority state, impact, cost, risk and newly
accepted final actions from the selected verified attempt. A final decision
can leave some services critical; that measured outcome is not hidden or
rewritten as success. Completing the Incident is not an ending grant.
The existing query still validates all conditions and returns unresolved
tie/no-match/diagnostics without fallback. Scenario data/seed/action replay
must derive the same final boundary and remain valid after save/reload.

No new ending ranking, final-plan IDs/list, service-effect balance, numeric
campaign award or late prediction opportunity is approved by this proposal.
Those concrete action/ending choices require their own reviewed data before
implementation. REWRITE remains fictional game state, never real security
configuration, credential or system modification. No user store migration.

## B — defer completion selection and design a different contract

Keep INC-025/026 unimplemented while a different explicit completion contract
is designed. Do not silently reuse healthy-service completion, weaken the
resolver's inherited-baseline requirement or force all endings into recovery.
The authored Observer checkpoint remains preserved and TASK-031 incomplete.

## Deferred verification

After QA resumes: terminal-plan exclusivity; unavailable/precondition failures
leave clock/state unchanged; accepted identity/retry and save/reload; actual
critical-service final outcomes versus recovery; timer/delegation/import and
inherited completion cannot create a new final decision; ending query remains
read-only, strict and unresolved without complete supported conditions.
No checks were executed for this proposal. Mandatory M4/M5 acceptance remains.

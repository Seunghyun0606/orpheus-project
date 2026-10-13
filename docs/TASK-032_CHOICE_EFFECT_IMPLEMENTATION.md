# TASK-032 — Genuine choice-effect source implementation checkpoint

## Completed

DEC-055 approves option A of the source proposal at `a9f42f7`. The implementation
candidate adds the approved explicit source contract, not production score balance
or task acceptance. DEC-054's optional-rate exclusions remain unchanged.

`src/scenario/campaign.ts` accepts `action_completed` effect triggers with a
mandatory valid Scenario action target. An optional strict
`response: { ruleId, positive }` qualifier is allowed only on that trigger.
Validation checks the exact incident/content/rule/model binding, declared response
action and positive recommendation target. Explicit compatible-content triggers
retain and validate their own qualifier, rather than dropping it or selecting
another version's rule.

`src/engine/campaign/transitions.ts` matches the completed event's **sourceId**,
which is the action identity; the event's targetId is merely the optional command
target payload. It requires the current accepted operation and a new event outside
the attempt baseline. For qualified effects, it uses only newly associated
responses with exact model, preparation, ACK, operation, input, command sequence,
head and attempt provenance. The existing association contract still computes
polarity and validates actual exposure/continuing eligibility.

Missing, expired, consumed or unrelated responses do not award a qualified effect
and do not reject an otherwise valid command. Inconsistent provenance diagnoses.
The declared pre-command/post-event condition boundary is retained. Existing
once-per-run effect identities, real event sequences and transactional publication
are reused. No artificial simulation event, record/save format or migration is added.

No production definition currently registers numeric choice awards. Existing
frozen authority files, seven approved opportunity rules, default MVP and actual
user stores/profiles are unchanged. The complete-package admission check remains
strict; this candidate does not start a partial official campaign.

## Changed files

- `src/scenario/campaign.ts`: source schema, exact target/rule/version validation.
- `src/engine/campaign/transitions.ts`: current-command/source/response matching.
- `src/tests/campaign-choice-effects.test.ts`: synthetic regression and transactional cases.
- DEC-055, TASK-032 active decision references and pending authoring evidence.
- The following recommendation-coverage proposal is planning only, not implemented content.

## Tests

The new test file authors raw communication, real completion timing/source identity,
positive/negative response, no preparation/ACK, unrelated action, expiry, rejection,
wrong polarity, consumed/cross-attempt response, duplicate/retry, inherited checkpoint
and import cases. It also covers declared condition boundaries, different rules on
one command, invalid references/qualifiers/models, compatible-version qualifiers,
forged receipts/responses, durable reload/lost-ACK, distinct competing operations
and abort after individual put success.

All amounts and authorities in this file are explicitly synthetic; they are not
production tuning. **Tests, typecheck, validator, lint, build, native QA and independent
review were not run.** Mechanical formatting and source inspection are not PASS
evidence. Existing verification must be rerun after QA resumes.

## Known risks

Implementation and compatibility remain unverified. Static/runtime source guards,
event ordering, exact replay and transactional recovery need independent checking.
Full production definition/package/progression, numeric effects, ending conditions,
priorities and conditional epilogue/presentation gates are still incomplete.
TASK-031/032 and mandatory M4/M5 acceptance remain outstanding.

The currently approved opportunity data has only one recommendation rule. It cannot
substantiate sustained very-high dependency by one acceptance or repeated farming
of the same once-per-run score. The
[coverage proposal](../.project-os/planning/TASK-032.recommendation-coverage-proposal.yaml)
offers three separately gated optional recommendations in existing INC-018/022/025,
using already authored actions and consequences. It selects no numeric awards or
ending thresholds and has not changed any Scenario/model/sidecar authority.

## Remaining work / next recommended step

Obtain the human's recommendation-coverage choice before expanding guidance.
Then propose actual numerical weights and all ten ending conditions/ranks against
the selected observable scope, rather than inferring unsampled rates. Approve
conditional epilogue representation/gates separately, integrate only a complete
new authority and resume mandatory verification before completion/release.

No task completion, push or release is claimed or authorized by this checkpoint.

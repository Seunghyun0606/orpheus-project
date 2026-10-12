# TASK-028 — Action guard implementation checkpoint

## Completed implementation candidate

DEC-043 records the human's Option A. Added strict optional new-only campaign
`actionGates`, an explicit condition context, exact binding validation and protected
reveal-path analysis. Accepted commands now evaluate their pre-command prerequisite
before simulation/time/history/effects/response/behavior mutation. Queries, the
session action list, predictions, recommendations and choice presentation handling
use the same guarded eligibility. Missing observations diagnose, not observed zero.

Protected source checkpoint/adoption requires exact bytes of a verified existing
same-run association, not a seed/command match or present-day clue. Entire batches
are rejected before any import if protected provenance is missing. Legacy default
inspection/ungated preparation order and existing operation/save/database layouts
remain unchanged. No user profile/store access, native launch or migration occurred.

INC-006 now authors a condition-driven Security codename notice and its gated
sidecar, plus an explicit archive reinvestigation action. Ordinary certificate
repair/rollback remains independent of optional clues. Neither AI identity nor
ADVERSARY/experiment origin is disclosed. Existing MVP/legacy files are unchanged.

The [logical binding fragment](../.project-os/planning/TASK-028.action-bindings.yaml)
is outside runtime data, not a complete campaign definition with guessed model
initial values. The complete production package remains unavailable. These files
cannot alone constitute a startable or accepted campaign.

## Changed files

- `src/scenario/action-gates.ts`, `campaign.ts`: strict schema and closed reveal-path validation.
- `src/engine/campaign/action-gates.ts`, `conditions.ts`, `transitions.ts`: guard
  predicates, verified availability/source queries, pre-command enforcement and source admission.
- `src/engine/campaign/opportunities.ts`, `src/engine/player-model/prediction.ts`:
  candidate/recommendation/choice guard lifecycle integration.
- `src/store/campaign-session.ts`, `src/app/CampaignDesk.tsx`: filtered ephemeral
  availability and generic diagnostic display; no React-owned rule or silent ACK.
- `src/persistence/campaign-legacy.ts`: optional scoped preview admission and
  guarded prepare ports over the existing record/provenance contract.
- `src/scenario/data/full-campaign/{incidents,presentations}/inc-006.yaml`:
  guarded Security investigation and genuine new archive investigation.
- `src/tests/campaign-action-gates.test.ts`: eight authored deferred cases.
- DEC-043, logical bindings, [contract](../specs/architecture/campaign-action-gates.md)
  and attributed planning checkpoint.

## Tests

Not run at the user's explicit QA-deferral request. Typecheck, lint, validator,
unit/replay suites, independent review/QA/evaluation and native checks were not
executed. Mechanical formatting is not verification evidence. Test assertions are
prepared, not passed: rejection without mutation, strict unavailable leaf handling,
positive command/replay/query identity, duplicate/version/reference/reused binding
validation, initial/timer/explicit-trigger leak rejection, atomic mixed-source
import rejection, associated protected source acceptance and old canonical shape.

## Known risks and remaining work

- All new code, deferred tests and early gameplay data are unverified.
- Further prediction/recommendation/choice UI/provenance regression cases must be
  run and expanded when QA resumes; eight authored cases are not complete acceptance.
- No full definition includes production behavior/prediction/opportunity/ending
  versions or hidden initial values yet. The fragment must be explicitly composed
  into that authority; omitting it is not acceptable full-campaign authoring.
- Protected timers/explicit narrative-trigger shortcuts are conservatively rejected;
  condition-driven narrative evaluation is required. Later unsupported authoring
  mechanisms retain material architecture gates.
- Source proof supports retained same-run associations only, not foreign-campaign
  migration/import. Standalone local replay remains campaign-agnostic.
- Later clue-reinvestigation coverage, main Act progression, effect/balance design,
  save/retry and full reveal negatives remain unfinished.
- The strict complete-package validator still rejects partial assets. Existing
  empty-package test expectations need legitimate authoring-phase reconciliation;
  no validator or assertion was relaxed for a PASS.

TASK-024/027/028 remain active/incomplete. No immutable acceptance result was filed
as PASS, no later dependency bypass, push or release. Next implementation decision:
production model/initial-value/classification baseline before composing a real
new campaign definition; numerical effects/ending balance remain separate choices.

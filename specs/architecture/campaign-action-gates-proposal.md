# TASK-028 — Cross-Incident action gate proposal

Status: proposed only; requires a material schema/replay behavior decision.
No guard schema, condition context, command transition or import policy is changed
by this document. DEC-042 approves versions, not cross-Incident narrative semantics.

## Concrete missing boundary

The approved reveal graph requires GHOST_ARTIFACT before NULL_NAME, without forcing
every optional clue for ordinary recovery or Act access. Existing Scenario conditions
resolve only local signals/resources/flags/evidence/actions/mechanisms. Campaign
conditions can inspect previous discoveries, but currently govern progression,
effects, branch views and endings—not each accepted Scenario action.

`campaign/transitions.ts` dispatches a valid command with `executeCommand` before
projecting events. Its `projectEvents` adds declared evidence/narrative membership
without a membership predicate, then separately evaluates numeric effects. Guarding
one effect would not prevent the evidence or incident narrative text from appearing.
The session adapter currently lists Scenario-available actions. Sidecar panel reveal
conditions hide UI only; they are not replay/command authority.

Thus a Security-name panel hidden by GHOST_ARTIFACT is insufficient if the same
local action can be accepted through another command/replay path. Importing an
independent local snapshot also cannot prove a prior campaign prerequisite.

## Proposed option A: explicit campaign action guards

Add an optional strict `actionGates` family to **new campaign definitions only**.
Every entry pins `id`, `incidentId`, `contentVersion`, `actionId` and an explicit
campaign `eligibility` predicate. Use the existing typed condition family, adding
an explicit `action` context for declared references rather than treating a command
as a branch query. Reject duplicate bindings, unknown versions/actions and invalid
references/comparisons. No missing-predicate or unavailable-value default.

- Before an action reaches the simulation, evaluate its exact declared guard against
  the verified pre-command campaign. False yields an ineligible-action diagnostic;
  unavailable observations yield their diagnostic. Neither path advances time,
  records inputs, generates effects/discovery or creates behavior/response samples.
- The session action-availability projection uses the same pure guard query. It must
  not advertise a protected action whose prerequisite is false; unavailable conditions
  remain explicit diagnostics, not zero or silent success.
- Narrative-producing actions are explicit investigations. Local narrative conditions
  require their accepted guarded action, so startup/automatic timer/ordinary recovery
  cannot trigger a protected reveal. Sidecar predicates additionally hide protected
  text/labels. Authoring checks must reject any unguarded action/event/narrative path
  that can generate a protected reveal.
- Initial implementation target: the Security attribution investigation in INC-006
  requires verified GHOST_ARTIFACT, but certificate rollback/trust repair and later
  Incident access do not. Earlier-clue re-investigation stays available as a genuine
  new attempt; completion or archive review never fabricates discovery.
- Existing command envelopes and physical storage stay unchanged. Exact new
  definition authority pins guard semantics; retained v1/v2 definitions without
  `actionGates` keep their old behavior. Existing user histories are not upgraded,
  attached to new definitions or reinterpreted.
- Source adoption/checkpoint of protected disclosures must prove their original
  campaign prerequisites, not just local replay. Without such provenance, report
  incompatibility and preserve all source data; do not silently import part of a
  batch, fabricate membership or accept an inherited protected action. Legacy MVP
  adoption remains unchanged. The detailed validation/diagnostic contract must be
  explicit before code is implemented.

This proposal adds no production hidden initial values, numeric discovery effects,
player model classifications or ending thresholds. It is not permission for new
record variants, schema migration, storage changes, QA execution or release.

## Option B: alternate representation before implementation

Keep the current engines and stop the protected Security reveal. Request another
reviewable domain representation for cross-Incident prerequisites. Do not settle
for a UI-only hide, force optional clues into main recovery, or silently waive the
approved GHOST_ARTIFACT → NULL_NAME ordering.

## Deferred verification obligations

When QA resumes, cover absent/available/unavailable prerequisites, exact-version
guard validation, rejected-command no mutation/time/response, deterministic replay,
save/retry, genuine re-investigation, protected source import, unchanged old
definitions and both GUI/programmatic command paths. No such checks were executed
in this user-requested implementation-only step.

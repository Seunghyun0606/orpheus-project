# TASK-027 — Explicit replay access and complete runtime-source connection

2026-10-14: DEC-060 approves option A against the proposal at `7330922`.
The shared engine and new runtime sources are now connected. **No runtime
validation, automated/native QA or acceptance was executed**, so this checkpoint
does not certify that the full package loads or that all endings are reachable.

## Completed

- Added optional `replayAccess: completed_prior_acts` to CampaignDefinition schema
  1, restricted to record/replay v2. It has no default; old parsed authorities remain
  without the field and keep exact current-Act-only access.
- Eligibility still evaluates every authored Act/Incident condition first. With the
  explicit policy, an earlier-Act Incident additionally needs verified completed
  membership **and** an actual attempt with a completion event outside its inherited
  baseline. Seed-only membership/checkpoint baseline/edited projection cannot provide
  that proof. Future Acts or false/invalid authored conditions remain blocked.
- A retry uses existing start/attempt operations; it does not rewind Act, reset
  earlier observations or re-award shared effects. No product-ID special case,
  physical storage/operation/run-shape change, old-run attachment or migration.
- Copied the prior exact complete candidate into the lazy production data route,
  adding only the approved access policy to its definition. The archived planning
  candidate remains unchanged. The package pins all 26 Scenario and investigation
  versions and the exact ending prose authority.
- Updated offline authoring and wrote deferred data-reproducibility, old/new access,
  genuine retry/history/shared-effect and real-source first-Incident package tests.
  These were authored, not run; they do not establish a complete playable campaign.

## Changed files

`src/scenario/campaign.ts`, `src/engine/campaign/transitions.ts`,
`src/scenario/data/full-campaign/definitions/campaign.yaml`,
`src/scenario/data/full-campaign/packages/campaign.yaml`, offline authoring/tests,
DEC-060, task decision references and this structured checkpoint. Existing Incident,
model-draft, save and old runtime-authority bytes were not rewritten.

## Runtime boundary

The default three-Incident MVP is unchanged. Only an explicit Full campaign visit
loads these sources; its existing complete catalog/schema/reference/model/ending/
presentation validators must all succeed before a package is selectable. Invalid
or missing authority stays unavailable with diagnostics, not a fixture/latest/partial
fallback. No campaign database is opened, run created, profile cleared or save
overwritten by authoring these files. User creation/restoration remains explicit.

The frozen candidate's definition/package still document the earlier blocker.
They are historical planning evidence, not alternative registered authorities.
The runtime definition adds the DEC-060 field; canonical authority verification
prevents reinterpreting old runs with changed definitions.

## Tests

**Not executed at the user's request.** No validator, test, typecheck, lint, build,
independent review/QA, evaluator or native QA ran. Only source inspection, deterministic
authoring/copy and mechanical formatting ran. Full-authority validity, startup/restore,
26-Incident sequential/retry runs, all ten endings, unavailable/tie/no-match behavior,
source/ACK/concurrency, performance, accessibility and native evidence remain required.

## Known risks / remaining work

Large version-pinned definitions and whole-history replay may have measurable cost;
do not assume performance readiness. Authoring/ref/source errors may still cause
runtime admission failure. Tests include isolated access fixtures and a genuine
first-Incident flow, not full production ending reachability. TASK-027–032 remain
incomplete pending all independent/automated/native obligations, as does mandatory M4
verification before final M5 acceptance/release. No push or release is authorized.

## Next recommended step

The next implementation area is TASK-033 accessibility/audio. Its readiness depends
on still-unaccepted TASK-027/032, and its target/audio/settings choices are unselected.
Approve a narrowly scoped early-implementation exception and concrete Windows-only,
local synthesized-audio scope before claiming it; preserve all later acceptance and
native/review obligations. Do not self-complete preceding work to make it eligible.

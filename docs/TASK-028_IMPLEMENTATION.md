# TASK-028 — Early content implementation checkpoint

Later checkpoint: DEC-043 approves cross-Incident action guards. The
[action guard candidate](TASK-028_ACTION_GATES_IMPLEMENTATION.md) now includes
condition-driven Security-name data and explicit archive investigation. The
original operational checkpoint below is retained as history. Complete production
definition, model decisions and all deferred verification remain outstanding.

## Completed authoring, not verified task completion

DEC-042 records human-approved version bindings. Under DEC-041 and the latest
instruction, implementation proceeds while QA is deferred. TASK-024, TASK-027 and
TASK-028 remain active/incomplete; no canonical overall PASS or later task claim.

Added eight Incident authorities to the isolated full-campaign data tree:
INC-001/002/003 reuse current 1.1.0/1.2.0/1.2.0 source content; originals/legacy
files are untouched. New INC-004–008 use schema 1/content 1.0.0 and implement the
approved operational causes: retained allocations, unsigned synthetic workload,
certificate rollover mismatch, synthetic session saturation and route divergence.

Each new Incident authors observations, diagnostic prerequisites, temporary mitigation
and expiry, pressure escalation, causal recovery, customer/cost/risk consequences,
capacity-backed timed delegation, War Room reports and operational postmortem inputs.
INC-006 has both trust repair and verified issuer rollback. Other new Incidents
contrast temporary relief with scoped causal repair. No action is graded correct
or incorrect. Operational tuning is a first authored draft, not tested balance.

Eight schema-1 sidecars bind exact Scenario versions as approved
`INC-00N-INVESTIGATION` / 1.0.0. They use data-defined logs/metrics/diagnostic/trace/
deployment/War Room panels, revealed signals and local evidence gates. Their shared
`CURRENT_ACT` predicate requires a corresponding explicitly declared campaign
reference when the still-incomplete production definition is authored. No definition
with guessed hidden/model initial values has been inserted.

Deleted/UNKNOWN fragments remain unexplained. INC-005 contains the local
GHOST_ARTIFACT discovery. The NULL-name Security reveal is deliberately **not authored
into runtime data yet**: its campaign prerequisite needs a domain-level gate decision.
No AI identity, ADVERSARY origin or controlled-experiment content is exposed here.

## Changed files

- `.project-os/decisions/DEC-042-full-campaign-content-version-baseline.yaml`
- `.project-os/tasks/ready/TASK-028.yaml` (approval reference only)
- `src/scenario/data/full-campaign/incidents/inc-001.yaml` through `inc-008.yaml`
- `src/scenario/data/full-campaign/presentations/inc-001.yaml` through `inc-008.yaml`
- `src/tests/fixtures/early-campaign-replays.yaml`
- `src/tests/early-campaign-replay.test.ts`
- `specs/architecture/campaign-action-gates-proposal.md`
- Planning/status documentation and scoped implementation checkpoint.

The replay inputs cover investigation recovery, mitigation then recovery, expired
mitigation then recovery, delegated investigation, and INC-006 alternate rollback.
The authored test harness checks operational catalog/source identity, deterministic
outcomes, prerequisites, expiry and returned team capacity when later executed.
It is not a campaign sequence/save/behavior/reveal acceptance fixture yet.

## Tests

Not run at the user's explicit request. No scenario validator, test suite, typecheck,
lint, independent review/QA, native input or app launch was performed. Source reading
and formatting are implementation activity, not verification evidence. Test inputs
and assertions exist but have no PASS result.

The complete production package remains absent. The loader cannot create it from
partial assets. The default full-package CLI is intentionally strict: with a partial
production tree it will report incompleteness until definition/package/all26 content
are supplied. Existing tests expecting an empty production tree will need their
authoring-phase expectations reconciled when verification resumes; no assertion or
validator was weakened to produce success. Standalone MVP loading remains separate.

## Known risks and remaining work

- New operational data, tuning and authored tests are unverified.
- Main campaign definition, model/initial values, effects and exact memberships are
  not selected/authored; sidecars cannot form a startable package by themselves.
- Cross-Incident GHOST_ARTIFACT → NULL_NAME must be enforced before accepted action,
  not just by UI visibility or numeric effect conditions. A material architecture
  decision is required; the [proposal](../specs/architecture/campaign-action-gates-proposal.md)
  is not implemented authority.
- Genuine re-investigation and protected source import need explicit constraints
  so early clue omission does not block ordinary recovery or fabricate later reveals.
- Save/retry/model/campaign-sequence, negative reveal and native checks remain pending.
- Final M4/M5 acceptance and release still require deferred QA; old user saves,
  physical store/security layout and frozen authority bytes remain unchanged.

Next: obtain the cross-Incident guard decision, implement only its approved contract,
then continue data authoring. Do not mark TASK-028 complete or bypass TASK-029's
dependency because files now exist.

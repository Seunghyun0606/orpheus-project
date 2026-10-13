# TASK-030 — Board investigation authoring checkpoint

Latest addendum: DEC-049 approves the five optional Board investigations. The
[connection checkpoint](TASK-030_BRANCH_IMPLEMENTATION.md) records their authoring,
bounded model draft repair and still-deferred verification. The pending consumer
decision below is historical and has now been resolved; TASK-030 remains incomplete.

## Completed authoring, not task completion

DEC-048 approves implementation readiness before TASK-029 acceptance only.
The ready contract and backlog now require accepted TASK-026. TASK-030 was
claimed through `projectctl claim TASK-030 --role developer`. TASK-029 remains
incomplete; TASK-031 and later dependencies are unchanged. QA is deferred, not waived.

Four unreleased schema-1/content-1.0.0 Scenarios and exact-version investigation
sidecars implement the approved Board interval:

| Incident                       | Contrasting operational paths                                | Investigable responsibility                                                                       |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| INC-019 Hospital Expansion     | Pause admissions versus fence shared dependency concurrency  | Hospital expansion approval, acknowledged capacity warning, CEO directive and executive dashboard |
| INC-020 Workforce Reduction    | Emergency coverage versus reconcile staffed queue ownership  | 12,410 reduction approval, staffing forecast, coverage warning and CEO communication              |
| INC-021 Disclosure Delay       | Isolate affected path versus fence known-risk routing        | Disclosure delay approval, deferred mitigation and acknowledged risk; NULL's Board conclusion     |
| INC-022 Public Sector Forecast | Temporary regional capacity versus protected regional minima | Public-sector approval, delivered deck, recommendation history and executive authority ledger     |

Each contains action-driven diagnosis, an expiring temporary operating window,
delayed pressure, causal containment, timed capacity-backed delegation, impact,
cost/risk and measured postmortem inputs. First-draft operational tuning is not
accepted balance. Recovery does not require optional records or supported metrics.

Authored 54 record actions/panels with explicit Act/prior-discovery guards and
local diagnosis requirements. Missed earlier clues have fresh archive investigation
paths; these consume current action time, not manufactured historic actions,
responses or completion. Protected records remain hidden initially and are not
delivered by operational timers/delegation. Existing protected-source provenance
rules are retained, not relaxed.

Three new known flags bind BOARD_RESPONSIBILITY → NULL_BLAMES_BOARD →
BOARD_CASE_COMPLETE to verified discovery events. Logical effects set only
boolean discoveries, with no numeric alignment/value awards or ending flags.
The disclosure conclusion requires the local security receipt; final case
correlation requires local forecast and executive-ledger records. NULL's statement
is attributed to NULL_218 and expressly distinguished from complete causal proof.
The Board's signed development, experiment, expansion and risk responsibilities
remain attributable; useful outcomes do not erase the harm.

No SOFT CONTROL research, candidate FRAME A/B/C probabilities, presentation-selection
mechanism, NULL admission of error or observer experiment is authored in Act 7.
These remain behind the approved later INC-023/024 investigation boundaries.

## Changed files

- DEC-048, TASK-030 readiness metadata and CLI-generated claim state.
- `src/scenario/data/full-campaign/incidents/inc-019.yaml` through `inc-022.yaml`.
- Four matching files under `full-campaign/presentations/`.
- `.project-os/planning/TASK-030.action-bindings.yaml`.
- `src/tests/fixtures/board-campaign-replays.yaml` and `src/tests/board-campaign-content.test.ts`.
- Candidate, optional branch-consumer proposal and current planning documentation.

## Tests

Authored 16 deferred cases: blueprint/guard/presentation identity; three per
Incident for deterministic contrasting recovery/delegation, expiry/prerequisites
and protected record delivery; three Board interval/attribution/local-record cases.
The isolated guard fixture is intentionally not a complete v2 campaign authority.
Standalone replay does not prove official campaign source admission or progression.

No test, validator, typecheck, lint, build, independent review/QA or native check
was run. Mechanical YAML/TypeScript formatting and administrative claim only.
No PASS or task acceptance is claimed.

## Known risks and remaining work

- All authored assets, narrative pacing, timing and test cases remain unverified.
- Only 22 of 26 Scenario/sidecar pairs exist. No complete production package,
  definition, ending authority or full Act-progression composition exists; strict
  admission must continue rejecting partial authoring, with no fixture fallback.
- Current behavior/prediction mappings cover 18 Incidents. Extending those tables,
  connecting all fragments and exercising the full campaign remain pending.
- Read-only branch declarations exist but new Board branch-specific records/actions
  are not approved or implemented. The linked proposal is a human choice, not live data.
- Final integration must prove all four Board Incidents occur before Act 8 framing
  resolution through the actual progression authority. A synthetic Act-7 unit context
  or fresh investigation of prior records does not prove that pacing requirement.
- Whole-run save/retry/ACK, imports, premature access and missed-evidence routes
  need automated and native verification plus independently authorized writing review.
- M4/TASK-024/025 and TASK-027/028/029/030 acceptance remain outstanding.
- Default MVP, frozen legacy/model authorities and actual user stores/profiles
  are unchanged. No push, release, QA waiver or canonical completion.

## Next recommended step

Decide the [optional Board branch records](../specs/architecture/board-branch-consumers-proposal.md)
before implementing that new consumer meaning. Preserve existing nonexclusive
criteria and strict unavailable diagnostics. Keep TASK-030 incomplete; do not
claim TASK-031 without acceptance or a separate readiness decision.

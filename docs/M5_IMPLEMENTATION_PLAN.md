# M5 — Full Campaign and Release Readiness

## Status and authorization

Planning-only draft, 2026-10-12, based on repository candidate `b548573`.
The human approved [DEC-036](../.project-os/decisions/DEC-036-m5-planning-before-m4-acceptance.yaml):
retain incomplete M4 and prepare M5 plans/task definitions before resuming QA.
This does not approve M5 implementation, registration, activation or release.

Canonical state remains M4 active, TASK-024 active, TASK-025 ready but ineligible,
and M5 planned with no registered tasks. TASK-018–023 are done. The draft tasks
below live in `.project-os/planning/M5/tasks/`, not the executable ready queue.
Their IDs must be checked for collisions again before future registration.
Do not edit backlog/current/milestone completion by hand or claim these drafts.

The existing M5 implementation entry criterion remains **M4 complete and tested**.
QA is deferred, not waived. No new automated/native QA or independent acceptance
is claimed by this document. Earlier PASS evidence retains its original scope.

## M4 debt that must remain visible

The [partial native evaluation](../.project-os/planning/TASK-024.native-resume-evaluation.yaml)
distinguishes automated candidate acceptance from actual desktop acceptance:

- TASK-024: verify the corrected QA binary restoring the already committed ACK,
  an eligible response, actual WebView/process reload and durable archive results.
- TASK-024: finish affected screens at native 960×640 and 150% text, keyboard and
  reduced-motion checks. Initial readability and pre-response ACK observations
  do not certify those missing checks.
- TASK-025: audit all four M4 exit criteria, positive `0/1`, `1/1`, pooled `2/12`
  deviation and abort/conflict/lost-ACK boundaries, then obtain independent
  review, QA and distinct evaluation through Project OS.
- M4 closure: obtain the configured milestone human approval after acceptable
  evidence. Planning approval cannot replace it.

Native work resumes only when requested and feasible. Use the already approved
isolated QA profile under DEC-034/035; do not reset it, substitute a fresh run for
restoration evidence, touch the main user profile or relax acceptance checks.

## Product and compatibility constraints

The [product direction](../specs/product/01-game-and-narrative-direction.md) and
[full design](../specs/product/00-initial-plan.md) remain the content authorities.
M5 targets nine Acts and **24–28 total incidents**, not 24–28 additional incidents.
The exact count, allocation, new Incident IDs and pacing are not chosen here.

- Preserve INC-001 Connection Saturation, INC-002 Bad Deployment and INC-003 Queue
  Backlog. Memory Leak stays a future candidate with no assigned ID. The existing
  MVP route remains UNKNOWN-only; full-campaign reveals need separately gated data.
- Incident, narrative, evidence, opportunity, branch and ending rules remain data
  executed by pure deterministic TypeScript engines. React projects results;
  it does not own simulation or narrative rules.
- Preserve exact legacy replay authorities and existing Incident/discovery stores.
  Do not attach new models to old campaigns, reinterpret old history, migrate
  automatically or use a latest-definition fallback.
- Official retries retain prior history. Authored effects award once per run;
  genuine new actions/costs and pooled eligible behavior samples remain counted.
- Prediction confidence is empirical, not a scripted descending percentage.
  Computation is not exposure; a recorded actual ACK precedes an eligible response.
  Missing samples remain unavailable; unresolved ending ties/no-match do not grant
  an automatic ending.
- No realtime LLM scenario generation, real cloud/monitoring integration, actual
  hacking commands, multiplayer or implicit expansion of platform/security scope.

## Content work packages

These are drafting boundaries, not approved Incident lists or numeric balance.
TASK-026 must propose an explicit per-Incident manifest and obtain approval before
content is implemented. Any new domain representation needs a separate architecture
gate; a content task is not permission to extend schemas by guesswork.

| Package                                       | Required investigation and reveal boundary                                                                                                                                                                                                                 | Draft owner |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Acts 1–3: NORMAL / GHOST / NULL               | Existing operations lessons and UNKNOWN; unexplained artifacts before Security names NULL. Distinguish discovering the name from discovering AI identity.                                                                                                  | TASK-028    |
| Acts 4–6: ORPHEUS / EXPERIMENT / HUMAN SYSTEM | Active legacy cluster; NULL as AI and company-created ADVERSARY; controlled production experiments; request to stop despite its objective; NULL archive and NULL_218; decision APIs and unpredictable recruitment. Preserve authored reveal prerequisites. | TASK-029    |
| Act 7: THE BOARD                              | Investigate CEO/Board approvals, dashboards, forecasts and recommendation history across multiple Incidents. Preserve responsibility and the apparent-main-villain interval before resolving SOFT CONTROL.                                                 | TASK-030    |
| Acts 8–9: OBSERVER / BLACKOUT                 | Information framing and NULL admitting error after sufficient Board investigation; experiment #99172 and employee #4172; expected investigation but unknown final action; multi-service final conflict.                                                    | TASK-031    |
| Endings and epilogues                         | All ten named endings, accumulated behavior and distinct costs; title payoff and conditional PROMETHEUS lineage discovery. No good/bad/true labels or privileged correct route.                                                                            | TASK-032    |

The finer placement of reveals within Acts is a TASK-026 proposal, not a new canon.
The sequence must keep NULL non-omniscient, ORPHEUS useful as well as harmful, and
the Board responsible without falsely making it fully in control. Do not absolve
executives when information framing is discovered. Investigations through logs,
DB, traces, deployments, documents, War Room and evidence must carry key discoveries;
cutscenes alone and story-completion percentages cannot substitute for them.

## Proposed tasks and dependencies

Every draft has TASK-025 as a direct or transitive dependency **and** requires
human-approved M4 closure/M5 activation before claim. Dependencies do not authorize
parallel agents. Read-only review/QA/evaluator delegation needs applicable authority.

| Draft                                                      | Role      | Deliverable                                                               | Dependencies           |
| ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------- | ---------------------- |
| [TASK-026](../.project-os/planning/M5/tasks/TASK-026.yaml) | architect | Reviewed campaign manifest, reveal graph, coverage and approval checklist | TASK-025               |
| [TASK-027](../.project-os/planning/M5/tasks/TASK-027.yaml) | developer | Explicitly approved production campaign composition and version binding   | TASK-025, TASK-026     |
| [TASK-028](../.project-os/planning/M5/tasks/TASK-028.yaml) | developer | Approved Acts 1–3 data and replay fixtures                                | TASK-026, TASK-027     |
| [TASK-029](../.project-os/planning/M5/tasks/TASK-029.yaml) | developer | Approved Acts 4–6 data and reveal/branch fixtures                         | TASK-028               |
| [TASK-030](../.project-os/planning/M5/tasks/TASK-030.yaml) | developer | Extended Board investigation and deferred framing reveal                  | TASK-029               |
| [TASK-031](../.project-os/planning/M5/tasks/TASK-031.yaml) | developer | Observer and Blackout data, final-context fixtures                        | TASK-030               |
| [TASK-032](../.project-os/planning/M5/tasks/TASK-032.yaml) | developer | Approved production ending rules and epilogue data                        | TASK-031               |
| [TASK-033](../.project-os/planning/M5/tasks/TASK-033.yaml) | developer | Campaign-wide accessibility and scoped audio presentation                 | TASK-027, TASK-032     |
| [TASK-034](../.project-os/planning/M5/tasks/TASK-034.yaml) | developer | Measured performance, approved packaging and release/authoring docs       | TASK-032, TASK-033     |
| [TASK-035](../.project-os/planning/M5/tasks/TASK-035.yaml) | developer | Full M5 evidence audit and separate release decision                      | TASK-025, TASK-028–034 |

Prior work is reused, not recreated. Missing document/trace/decision views or
simulation mechanisms must first be listed against real authoring needs in
TASK-026. TASK-027 may implement only an approved gap list within existing contracts;
material extensions require separate decisions. New engine folders are not a goal.

## Approval checkpoints before future execution

1. **M4 exit / M5 activation:** finish mandatory deferred evidence and Project OS
   evaluation; human approves closure and registration. Keep M5 planned until then.
2. **Campaign blueprint:** approve Incident count/IDs, reveal gates, branch access,
   gameplay variety, Board pacing and needed UI/domain gaps. Do not freeze a
   26-Incident layout or new Memory Leak ID in this planning pass.
3. **Production binding and balance:** approve full-campaign entry/default behavior,
   new immutable definition versions, opportunity rules, ending thresholds and
   priorities. Test fixture thresholds do not become production balance.
4. **Delivery scope:** approve target platforms, measurable performance/quality
   budgets, audio assets/licensing and packaging/signing/distribution choices.
   Existing Windows checks do not certify other desktops or a screen-reader audit.
5. **Release:** distinct evaluation and configured subjective milestone/release
   human gates. Producing an installer does not authorize publication, credentials,
   uploads, store listing or pushing the branch.

## Verification map for future acceptance

| M5 exit criterion                                                         | Tasks                  | Required evidence, not yet executed                                                                                                                                                            |
| ------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nine Acts, 24–28 total Incidents and required reveals                     | TASK-026, TASK-028–031 | Approved manifest/count; schema/reference checks; per-Incident recovery and alternative response replays; reveal prerequisite/negative checks; Board pacing and faction writing review         |
| Behavior-derived supported endings without a true ending                  | TASK-027, TASK-032     | Real accumulated run inputs to all ten endings, threshold boundaries, overlap/tie/no-match/unavailable diagnostics, gated final context and conditional epilogue checks                        |
| Performance, persistence, accessibility, audio, packaging and regressions | TASK-027, TASK-033–035 | Version-pinned long-run replay/save/reload; retry and shared-effect isolation; approved benchmark budgets; supported native display/keyboard/motion checks; explicit audio and packaging scope |
| Release and authoring documentation                                       | TASK-034–035           | Working authoring instructions, compatibility/error recovery, build/package provenance, content/license inventory, known limitations and rollback/support guidance                             |

Future automation includes the existing build, lint, format, typecheck, test, replay,
scenario-validation and desktop-build commands. Extend scenario/campaign validation
to all new authored production data rather than silently retaining only the MVP
file inventory. Preserve failing command results; do not increase timeouts or narrow
assertions to obtain a PASS. Native evidence must identify commit, binary, profile,
viewport, actual observed actions and limitations independently from headless tests.

Each implemented task requires a structured result, automated evidence, independent
review and QA plus distinct configured evaluation. TASK-035 reconciles coverage,
candidate provenance and known risks; it must not equate framework fixtures with
playable full-campaign acceptance.

## Safe next step

With QA still deferred, retain these drafts and resolve blueprint proposals only
within planning scope. The next executable canonical work remains TASK-024 native
verification when the human requests its resumption, then TASK-025. No M5 runtime,
content, user storage or canonical state was changed by this planning pass.

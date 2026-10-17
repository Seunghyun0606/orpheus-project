# TASK-026 — Full-campaign blueprint proposal

Status: **accepted through independent review, document QA and distinct Project OS evaluation**.
DEC-039 authorized separate read-only actors. Review/QA and distinct evaluation
passed source candidate `66a019f` with evidence commit `10ccb59`; Project OS completed
TASK-026 on 2026-10-12 and then claimed TASK-027. This accepts the content blueprint
and inventory, not implemented full campaign, runtime reveal enforcement or native QA.

The [machine-readable proposal](../authoring/campaign-1.0/TASK-026.campaign-blueprint.yaml)
is planning data, not an implemented Scenario/CampaignDefinition schema. It is
outside the runtime catalog and must never be loaded as production content.
Its exact `cbdeba0` content is approved through
[DEC-038](../.project-os/decisions/DEC-038-approved-full-campaign-blueprint.yaml);
the original candidate-time status strings and checkpoints remain unchanged.
The [current content specification](../specs/product/02-full-campaign-blueprint.md)
records this subsequent approval and its limits.

## Proposed bounded campaign

Approved **26 total Incidents**: the three existing MVP Incidents plus 23 new ones.
The allocation stays within the specified 24–28 range and reserves four Incidents
for the Board investigation before the framing resolution. DEC-038 approves the
new IDs/titles, including `INC-004 Memory Leak` in Act 2. Runtime versions and
production balance remain unselected.

| Act            | Proposed Incident IDs | Count | Required pacing function                                                        |
| -------------- | --------------------- | ----- | ------------------------------------------------------------------------------- |
| 1 NORMAL       | INC-001–003           | 3     | Preserve current operations lessons and UNKNOWN-only content                    |
| 2 GHOST        | INC-004–005           | 2     | Memory pressure, unexplained deployment/traffic/deleted logs                    |
| 3 NULL         | INC-006–008           | 3     | Security names the actor; clues invite investigation, not AI identity           |
| 4 ORPHEUS      | INC-009–011           | 3     | Active legacy system; AI identity; company ADVERSARY provenance                 |
| 5 EXPERIMENT   | INC-012–014           | 3     | Controlled experiments; objective-bound shutdown request; NULL_218 archive      |
| 6 HUMAN SYSTEM | INC-015–018           | 4     | Separate healthcare, finance, recruitment and logistics consequences            |
| 7 THE BOARD    | INC-019–022           | 4     | Trace approvals, staffing/disclosure/public-sector risks and CEO responsibility |
| 8 OBSERVER     | INC-023–024           | 2     | Resolve framing/feedback loop, NULL's error and player experiment/title payoff  |
| 9 BLACKOUT     | INC-025–026           | 2     | Contain regional crisis before verified multi-service final decision            |

Each proposal entry supplies causal pressure, contrasting response paths, an
investigation surface and a reveal boundary. Exact signals, timers, resource
costs, thresholds, content versions and final action variants are not assigned
by these descriptions. Content authors must develop real causal variation;
renaming one scenario 23 times is not an accepted implementation.

## Reveal and route constraints

The YAML proposal contains an acyclic prerequisite graph, with AI identity and
ADVERSARY provenance distinct discoveries. Controlled experiments, the request
to stop, instance archive and recruitment follow; Board responsibility precedes
SOFT CONTROL, NULL admitting its mistake and the feedback-loop conclusion.
The observer experiment and distributed-project payoff follow those discoveries.

Act 7 covers four different operational failures/decision records. Its approved
responsibilities remain visible after INC-023; framing is not an excuse for
ignored evidence or expanded production experiments. The player must be able
to investigate alternative presentation frames rather than receive a lecture
that declares the Board innocent. NULL's mistaken conclusion is discoverable
before its later acknowledgement of error.

Every reveal has both a positive route and an absent-prerequisite negative case.
The full graph describes an investigation-heavy route, not mandatory exposition
for every player. A STATUS QUO route can ignore clues. Operational recovery/Act
access must not depend on an unavailable behavior metric or every optional clue.
If a later investigation needs missing evidence, offer an accessible authored
re-investigation path; do not fabricate historical behavior, AI exposure or effects.

Branch profiles remain company-aligned, NULL-aligned, investigation-heavy,
AI-dependent and safety-first. Branches vary information/access/costs without
labeling player choices correct/incorrect or punishing inaccessible content.
No production thresholds are inferred from fixture scores or prose such as high.

## Repository inventory and implementation gaps

Inventory baseline: `2684200`; no runtime change in this candidate.

| Concern                            | Existing source / capability                                                                                                                       | Required next work, not yet implemented                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenario causality and action time | `src/scenario/schema.ts`, `src/engine/simulation.ts`: signals, resources, requirements, temporary effects, timer/conditional events and resolution | Author distinct causal models and cost tradeoffs; assess any unsupported mechanism before changing schema                                             |
| Team information and delegation    | Existing War Room role/message definitions and capacity-delayed work                                                                               | Author Maya, Alex, Sam, Jin and Marcus messages appropriate to each Incident; keep reports fallible                                                   |
| Investigation UI                   | `src/app/App.tsx`: Logs, Metrics, Diagnostics, Status, Evidence, War Room; action-to-tool routing has keyword/category heuristics                  | A data-authored view plan for documents, traces, deployments, HR/Board records and executive dashboards; do not hardcode new story in React           |
| Production campaign entry          | `src/main.tsx` renders `AppShell` without a campaign authority; `AppShell` accepts an injected opt-in store                                        | Obtain entry/default/version selection approval; no QA fixture import or old-run attachment                                                           |
| Campaign desktop                   | `src/app/CampaignDesk.tsx`: framework actions, evidence, attempt review, explicit guidance ACK and read-only ending query                          | Build actual incident tool/postmortem projections and authored ending presentation; framework text is not shipping campaign UX                        |
| Run authority                      | `src/persistence/campaign-ledger.ts`, `src/store/campaign-session.ts`: transactional versioned campaign adapter                                    | Reuse exact pinned definitions, commit/retry identity and archive isolation; do not route campaign commands through the standalone save authority     |
| Campaign/model queries             | `src/scenario/campaign.ts`, `behavior.ts`, `prediction.ts`, `opportunity.ts` and pure engine modules                                               | Author explicit production eligibility/classifications/comparable contexts; preserve UNKNOWN and unavailable samples                                  |
| Ending rules                       | `src/scenario/ending.ts`: conditions/priorities/final references, not ending prose                                                                 | Obtain production balance and epilogue/presentation representation decisions; use all ten fixture families only as tests                              |
| Catalog boundary                   | `src/scenario/bundled-catalog.ts` eagerly imports every YAML under `data/incidents/`; default desk enumerates catalog entries                      | Approve separate full-campaign catalog/entry composition before adding late-act files there; do not accidentally expose all Incidents in the MVP menu |
| Reveal validation                  | `src/scenario/validator.ts` rejects later-Act terms in Act 1 but does not establish cross-Incident reveal order                                    | Preserve existing protection; add approved campaign graph/reference/negative-path validation later                                                    |
| Release quality                    | Existing build:desktop uses --no-bundle; actual M4 native restore/response/accessibility is incomplete                                             | Keep M4 debt; select delivery targets, budgets, audio/license and packaging/signing scope separately                                                  |

The inventory does not assume the legacy `App` store interface can simply be reused
for the campaign authority. Shared rendering can be extracted within existing
boundaries, but new persisted state, surface metadata or resolver responsibilities
require an explicit design/gate. Existing scalar signals/evidence can hold some
observations; they are not evidence that full structured documents, graphs or
trace views already exist. Retain rich investigable content requirements rather
than reducing all scenes to identical buttons and evidence text.

## Verification plan and preserved evidence boundaries

- Per Incident: validate schema/references; replay contrasting recovery/temporary
  paths, delayed work, customer impact, investigation and communication outcomes.
- Campaign: exact version binding, once-per-run effects, legitimate retry costs,
  pooled eligible behavior and archive/read-only isolation across long runs.
- Narrative: graph/reference validation, negative early reveals, UNKNOWN-only
  unchanged MVP and independently reviewed Board pacing/faction ambiguity.
- Prediction: actual displayed ACK before eligible response; historical frequency,
  insufficient support/ties and no scripted confidence; preserve positive M4 samples.
- Endings: valid accumulated run inputs for all ten outcomes, boundaries and
  unresolved ties/no-match/unavailable diagnostics; epilogue gating and no true label.
- Desktop: actual supported-size/enlarged-text/keyboard/motion/audio and restore
  evidence after QA resumption. Headless arithmetic cannot certify native behavior.

This pass performs document/metadata consistency checks only. It does not run the
application suite/native QA or independently review its own blueprint. All prior
immutable reports and the original planning drafts remain unchanged.

## Decisions before dependent implementation

The 26-Incident allocation, new IDs (including Memory Leak), Board interval and
reveal graph are now approved under DEC-038. This establishes the content blueprint,
not TASK-026 completion or all later architecture/balance choices.

Required independent acceptance and distinct evaluation have now passed. Original
candidate checkpoints and initial probe failures remain intact. TASK-027 needs
concrete production entry/catalog/view binding decisions;
TASK-032 needs numeric ending balance/priorities and epilogue rules. Platform,
performance budgets, assets/licenses, packaging/security and release remain later
gates. M4/TASK-024/025 remain mandatory before TASK-035 acceptance and release.

_Links to process artifacts removed under DEC-070 were dropped; the originals remain at git tag `archive/pre-process-consolidation`._

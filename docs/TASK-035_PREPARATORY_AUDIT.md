# TASK-035 — Preparatory readiness audit

## Outcome and authority

2026-10-14, developer `/root`. **Preparation only; acceptance and release withheld.**
[DEC-065](../.project-os/decisions/DEC-065-preparatory-readiness-audit.yaml) approves
starting this audit before preceding acceptance. Project OS claimed TASK-035;
TASK-024 and TASK-027–035 remain active, TASK-025 ready/ineligible, M4/M5 active.
TASK-026 is the accepted document blueprint, not accepted playable content.

Inspected clean source base `e33d431` (main ahead 116 before this work), canonical
state, contracts, source inventories and existing reports. This step changes
documentation/readiness metadata only. No tests, validator, build, benchmark,
independent review/evaluation, native app, installer or user store was executed.
Parsing source YAML and hashing selected files below are inventory, not runtime
admission, scenario validation or functional QA. Earlier evidence is audited,
not a result reproduced by this author.

The [remaining verification plan](M5_VERIFICATION_PLAN.md) and
[structured gap map](../.project-os/planning/TASK-035.evidence-gap-map.yaml) specify
what must be established before acceptance. Earlier status strings in historical
checkpoints remain intact; later decisions do not retroactively rewrite them.

## Candidate and artifact provenance

| Evidence                                                     | Exact scope                                                                                                                                 | What it cannot establish                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| TASK-026 evaluation, source `66a019f`, evidence `10ccb59`    | Independent approved 26-Incident/19-node blueprint and document checks                                                                      | Executable reveal order, playable pacing, ending reachability                                              |
| TASK-024 partial evaluation, `9719e06`                       | Automated candidate evidence; original native ACK and corrected initial controls distinguished                                              | Corrected existing-ACK restore, response, reload, archive and complete accessibility                       |
| TASK-027 evaluation, source `2e6bea0`, evidence `e02ae8e`    | Foundation automated checks; overall decision HUMAN_GATE                                                                                    | Later complete campaign/package, native integration or overall acceptance                                  |
| TASK-034 final scoped checks at `8f52183` checkpoint         | Compiler, 64-file source admission, four harness cases after retained failures, isolated web build                                          | Full regression, gameplay routes, native behavior                                                          |
| TASK-034 package/measurement evidence committed in `e33d431` | Source base `8f52183` plus explicitly recorded dirty tool/preflight changes; five harness checks, unsigned native build and NSIS generation | A binary built from clean `e33d431`, installation, functional QA or release                                |
| TASK-034 ordinary replay measurement                         | 26 attempts, 105 accepted commands, 132 retained operations; two warmups and 20 measured Node replay samples                                | Full-disclosure route, ten endings, actual browser IndexedDB, completed commit/load or long/native budgets |

Evidence anchors: `.project-os/planning/TASK-024.native-resume-evaluation.yaml`,
`TASK-027.distinct-evaluation.yaml`, `TASK-034.final-scoped-checks.json`,
`TASK-034.local-package-manifest.json`, `TASK-034.local-package-build-raw.json`,
`TASK-034.ordinary-replay-measurement.json`, and
`.project-os/tasks/results/TASK-026.evaluation.yaml`.

The retained ordinary operation record is local, not tracked:
`.qa/task034/evidence/01876581-9680-482a-ac7a-131c35d588c0/checkpoint-1-1-incomplete.json`.
It exists at inspection (756,327 bytes); its report records ordinary run hash
`d7d923b511b0611d502814e7b001cb171e95ccfd7ef7d15819b78b480ae785fe`.
An evaluator needs an accessible, attributed copy of full inputs and source hashes;
the committed summary alone is insufficient to reconstruct the run. Preserve the
original local checkpoint, including its incomplete status and raw measurements.

Reported installer: 2,059,715 bytes, SHA-256
`34055e9baa3543938938043d298136608e0b1024fade0a8269dbe00291118f31`.
Reported native executable: 8,801,792 bytes, SHA-256
`170be8e11e64fb8dd936c993b23e746940ca7e745bb6e85e15ad10798c602120`.
Both paths from the package manifest exist at inspection; this audit did not rerun
their build, hash validation or launch. Their candidate must not be relabeled as
this documentation commit. Static profile derivation is not native observation.

Selected source SHA-256 inventory at `e33d431`:

| Source                                                              | SHA-256                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/scenario/full-campaign.ts`                                     | `66c3ed5dc0ef78381c7557671e0d2827912f506fe54c78af2b66eec3a25c554a` |
| `src/scenario/data/full-campaign/definitions/campaign.yaml`         | `8fc1af717865da689f0ee71bbacff783617c11ce1bb63f27300556b9219eed89` |
| `src/scenario/data/full-campaign/packages/campaign.yaml`            | `56a825aa02dfe8b6fdeaf40308443fc7da99f85195bc0847ba9916a7448fe1e7` |
| `src/scenario/data/full-campaign/ending-presentations/endings.yaml` | `f2de06bd1344e0550056c125eccb6e616a9e28ca1e07a77b8a1f0372674a5d82` |
| `package-lock.json`                                                 | `0727a65c3047116877da761a7bf7904664b09942302177bde8ab9737141aa7ff` |
| `src-tauri/Cargo.lock`                                              | `2ef53dc7f4f8a0e3f5d7b621565edbadf51d41102ec48436e8561ee3dcefc6dc` |
| `src-tauri/tauri.conf.json`                                         | `89f0b1e4b43d9a378b36497ec7305b2257521db4296c9c9186f1e85560d92029` |

Hashes above are a selected inventory, not a complete candidate manifest. Future
verification must name the actual clean commit and complete source/config/lock/tool
identity, preserving any explicitly scoped dirty differences.

## Milestone evidence gaps

| Criterion                                                        | Existing evidence/source                                                                                  | Missing acceptance evidence                                                                                                                                             | Owners      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| M4: deterministic persisted progression, values, evidence, flags | Accepted bounded TASK-019/020; v1/v2 ledger and TASK-024 candidate fixtures                               | Existing ACK restore/response/process reload/archive, transaction failure recovery on actual supported runtime; current regression and distinct acceptance              | 024/025     |
| M4: action-derived behavior, prediction and branches             | Accepted bounded TASK-021/022; actual-response candidate fixtures in 024                                  | Positive deviation 0/1, 1/1, pooled 2/12, real acknowledged response provenance, abort/conflict/lost-ACK audit; no fake exposure                                        | 024/025     |
| M4: deterministic authored ending framework                      | Accepted TASK-023 isolated ten-ending families                                                            | Current integration/compatibility regression; do not substitute production ending reachability for framework audit                                                      | 025         |
| M4: reveal order and moral ambiguity                             | Accepted logical/document scope, MVP boundary candidate checks                                            | Current independent narrative/UI audit, UNKNOWN-only regression, all four exit criteria and configured evaluation                                                       | 025         |
| M5: mandatory deferred M4 completion                             | DEC-037/065 retain requirement                                                                            | TASK-024/025 acceptance and configured M4 completion; no readiness exception grants this                                                                                | 024/025/035 |
| M5: nine Acts, 24–28 Incidents and reveals                       | 26 Scenario + 26 sidecar files, nine-Act definition, accepted blueprint; ordinary Node route completes 26 | Alternative per-Incident recovery, all 19 actual discoveries and negative prerequisites, optional routes/re-investigation, Board pacing and independent content review  | 027–031/035 |
| M5: supported accumulated endings, no true ending                | Ten equal-rank rules and ten prose entries, authored unit tests                                           | Ten genuine accumulated full-run histories, thresholds/boundaries, final due-event consequences, unresolved diagnostics and conditional epilogues                       | 027/032/035 |
| M5: desktop quality and regressions                              | Build, scoped compiler/admission/harness and ordinary Node timing only                                    | Full suite/replays, long durability/retry/shared effects, native budgets, keyboard/Narrator/audio/layout, installer lifecycle, independently attributed checks          | 027/033–035 |
| M5: release and authoring docs                                   | Authoring/support/rights docs and local artifact manifest                                                 | Instructions exercised on actual candidate, complete shipped notices/rights, real recovery/rollback limits, exact package/runtime provenance and independent evaluation | 034/035     |

No row is marked complete by this preparation. Absence of evidence is not proof
of a runtime defect, and an interrupted measurement is not a budget failure.

## Production content and reveal coverage

Runtime sources are `src/scenario/data/full-campaign/`: `incidents/inc-NNN.yaml`,
`presentations/inc-NNN.yaml`, exact definition/package and ending prose. Loader
`src/scenario/full-campaign.ts` admits sources through `production-catalog.ts` only
after explicit opt-in. The default three-Incident MVP remains separate.
Package/definition `orpheus-full-campaign@1.0.0` uses record/replay v2 and
`completed_prior_acts`; existing v1 authorities must remain unchanged.
INC-001 is 1.1.0, INC-002/003 1.2.0, INC-004–026 1.0.0.

| Act            | Incidents / source pairs | Primary authored test anchors (not new execution results)                    |
| -------------- | ------------------------ | ---------------------------------------------------------------------------- |
| 1 NORMAL       | 001–003 (3)              | `inc-001-replay`, `inc-002-replay`, `inc-003-replay`, `m3-narrative`         |
| 2 GHOST        | 004–005 (2)              | `early-campaign-replay`, `campaign-action-gates`                             |
| 3 NULL         | 006–008 (3)              | `early-campaign-replay`, `production-player-baseline`                        |
| 4 ORPHEUS      | 009–011 (3)              | `mid-campaign-content`, `mid-campaign-opportunities`                         |
| 5 EXPERIMENT   | 012–014 (3)              | `mid-campaign-content`, `mid-campaign-branches`                              |
| 6 HUMAN SYSTEM | 015–018 (4)              | Above plus `additional-recommendations`                                      |
| 7 THE BOARD    | 019–022 (4)              | `board-campaign-content`, `board-campaign-models`                            |
| 8 OBSERVER     | 023–024 (2)              | `observer-campaign-content`, `observer-campaign-models`                      |
| 9 BLACKOUT     | 025–026 (2)              | `crisis-preparation`, `blackout-completion-contract`, `blackout-final-plans` |

Test anchors refer to `.test.ts` under `src/tests/`, unless JSX is explicitly
named. Source inventory cannot establish test success. The current
`full-campaign-runtime.test.ts` asserts exact admission and first-Incident
progression; it is not an authored all-ten-ending full-run proof.

All following nodes appear in the frozen approved blueprint and initial runtime
flag registry. The Incident column is the first authored discovery allocation,
not a claim that that node was reached by the retained ordinary run. Later
re-investigation is intentionally possible under approved guards. For **each** row
still require: supported action/evidence path, actual new discovery, absent-
prerequisite rejection with no leak/mutation, reload persistence, retry no duplicate
award, archive no new sample, and independent narrative surface review.

| Node                  | First Incident | Required predecessor                                             |
| --------------------- | -------------- | ---------------------------------------------------------------- |
| GHOST_ARTIFACT        | 005            | None                                                             |
| NULL_NAME             | 006            | GHOST_ARTIFACT                                                   |
| ORPHEUS_ACTIVE        | 009            | NULL_NAME                                                        |
| NULL_AI               | 010            | ORPHEUS_ACTIVE                                                   |
| NULL_ADVERSARY        | 011            | NULL_AI                                                          |
| CONTROLLED_EXPERIMENT | 012            | NULL_ADVERSARY                                                   |
| NULL_STOP_REQUEST     | 013            | CONTROLLED_EXPERIMENT                                            |
| NULL_218_ARCHIVE      | 014            | NULL_STOP_REQUEST                                                |
| HUMAN_DECISION_APIS   | 015            | NULL_218_ARCHIVE                                                 |
| RECRUITMENT_SELECTION | 017            | HUMAN_DECISION_APIS                                              |
| BOARD_RESPONSIBILITY  | 019            | RECRUITMENT_SELECTION                                            |
| NULL_BLAMES_BOARD     | 021            | BOARD_RESPONSIBILITY                                             |
| BOARD_CASE_COMPLETE   | 022            | NULL_BLAMES_BOARD                                                |
| SOFT_CONTROL          | 023            | BOARD_CASE_COMPLETE                                              |
| NULL_ADMITS_ERROR     | 023            | SOFT_CONTROL                                                     |
| FEEDBACK_LOOP         | 023            | NULL_ADMITS_ERROR                                                |
| PLAYER_OBSERVER       | 024            | FEEDBACK_LOOP                                                    |
| PROJECT_DISTRIBUTED   | 024            | PLAYER_OBSERVER                                                  |
| BLACKOUT_FINAL        | 026            | Verified final authority/service context, not all optional clues |

Board investigation must remain meaningful across 019–022 before 023 framing.
Independent review must distinguish responsible executives from full control,
NULL's mistaken conclusion from omniscience, and AI benefits from moral judgment.
Main operational progression must also succeed without collecting every node.

## Ending coverage gap

Rules are embedded in the exact runtime definition; prose in
`ending-presentations/endings.yaml`. `full-campaign-balance.test.ts` explicitly
labels predicate contexts/isolated fixtures **not** genuine reachability proof.
`ending-presentation.test.ts` and `CampaignEnding.test.tsx` are additional authored
projection anchors, not evidence of native presentation. All ten rows below remain
unverified as genuine accumulated production runs.

| Ending        | Authored terminal action to exercise in INC-026 |
| ------------- | ----------------------------------------------- |
| CONTINUITY    | RESTORE_CORE_CONTINUITY                         |
| LIBERATION    | PUBLISH_ARCHIVE_RETAIN_ADVERSARY                |
| WHISTLEBLOWER | INDEPENDENT_AUDIT_HANDOFF                       |
| SHUTDOWN      | DISABLE_BOTH_AUTHORITY_PATHS                    |
| CUSTODIAN     | REQUIRE_HUMAN_EXECUTION_APPROVAL                |
| NULL          | ALLOW_EXTERNAL_ADVERSARY_ROUTE                  |
| THE BOARD     | EXPAND_CONTINUITY_AUTHORITY                     |
| THE FIRE      | DESTROY_SHARED_AUTHORITY_CORE                   |
| STATUS QUO    | RESTORE_WITH_REPLACEMENT_ADVERSARY              |
| REWRITE       | REQUIRE_PLURAL_REVIEW_AND_AUDIT                 |

A final action alone is insufficient: reconstruct each route from legal new-run
operations, accepted actions, genuine investigation and acknowledged responses;
retain pooled observations, accumulated values, once-only receipts and actual
five-service final metrics/cost/time/customer impact. Do not edit projection or
inject final membership to make an ending eligible. Every rank is 100; tie,
no-match and missing-reference diagnostics must grant no fallback/prose/flags.
Optional opportunity rates are not mandatory ending inputs, but operational
evidence-before-action/depth conditions must still have real eligible samples.

PROMETHEUS requires PROJECT_DISTRIBUTED and an eligible ending (LIBERATION,
WHISTLEBLOWER, SHUTDOWN, CUSTODIAN, NULL, REWRITE); test both missing discovery
and ineligible ending, including body/section-ID leakage. Title payoff is separately
gated by that discovery. Future-authored prose must not replace actual final state.

## Performance and delivery gaps

Approved DEC-063 budgets remain unchanged:

| Budget                                    | Limit                              | Evidence state                                     |
| ----------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| Cold complete-package admission           | max 5,000 ms                       | Missing native samples                             |
| Ordinary pure replay                      | p95 5,000 ms                       | Node-only 3,077.916 ms, 20 samples; native pending |
| Long pure replay                          | p95 15,000 ms                      | Missing qualifying record/samples                  |
| Long read + verification + published view | p95 20,000 ms                      | Missing                                            |
| Ordinary durable action publication       | p95 500 ms                         | Missing; untimed memory-DB seeding interrupted     |
| Long durable action publication           | p95 2,500 ms                       | Missing                                            |
| Long native archive paint at 150%         | p95 500 ms                         | Missing                                            |
| Cold usable default desk                  | max 5,000 ms                       | Missing                                            |
| Aggregate native private working set      | steady p95 512 MiB; peak 1,024 MiB | Missing five-minute 1 Hz trace                     |
| Local review installer                    | ≤100 MiB                           | Reported 2,059,715 bytes; generation only          |

Long qualification needs ≥104 actual attempts and ≥1,000 accepted action commands,
preserved history, no rejected padding or inherited completion substitution.
Two warmups + 20 warm trials, nearest-rank p95; five independent cold starts,
report maximum. Node/fake IndexedDB timings never certify native WebView storage.

Risk indicators, not measured failures: definition source is 1,058,364 bytes;
build reported large chunks; replay/verification and untimed prefix seeding can be
expensive. Optimization, model/schema/authority rewrites or relaxed budgets are
outside this preparation and require their applicable gate.

Accessibility/audio source and unexecuted test anchors:
`src/tests/campaign-audio-accessibility.test.tsx`, `src/audio/audio.test.ts`,
`src/app/CampaignAudio.tsx`, `CampaignDesk.tsx`, `CampaignTools.tsx` and `base.css`.
Native keyboard/Narrator, 960×640/1280×800, 100/125/150%, CRT-off/reduced-motion,
six audible cues/visual equivalents, gesture-only activation/default mute,
hidden/archive/exit silence and bounded voices remain unproven.

Authoring/support docs exist, but exercise their commands/recovery instructions
before accepting them. Asset/license inventory is preliminary; locked dependency
notices, contributor/icon/content rights and shipped-file obligations remain
unresolved. Installer generation does not establish upgrade/uninstall safety,
profile isolation, publisher authenticity, signing, distribution or rollback support.

## Remaining work and next recommended step

Obtain explicit resumption of deferred automated verification/independent review
using the staged plan. Native/app/install execution remains separately authorized;
preserve qa024's committed ACK and all actual user stores. Complete preceding
acceptance through distinct handoffs and Project OS before evaluating TASK-035.
M5 completion and production release are separate human decisions, neither made
by this document or the claim. No push/publication is authorized here.

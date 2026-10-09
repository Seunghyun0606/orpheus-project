# Campaign intelligence contract — TASK-018 proposal

Status: **proposal, not approved architecture**. First gate: M4 campaign storage
authority. No runtime type, schema, storage key, migration, content or player
behavior was changed while preparing this document. TASK-018 remains active;
dependent implementation must not start until the contract is approved and the
task has independent review, acceptance QA and Project OS evaluation.

## Approved constraints

DEC-001/003 require pure, deterministic TypeScript engines and validated authored
content. DEC-005 preserves frozen incident replay authorities and verifies old
saves before replaying approved target content. DEC-006 keeps discovery progress
separate from the incident slot; future state fields need explicit evolution.
DEC-007 preserves cross-incident save confirmation. DEC-008 approves M4 task
definition only, not campaign history, migrations, model formulas or thresholds.

The three production MVP incidents remain UNKNOWN-only. Framework fixtures may
describe later-act systems without making those systems visible in MVP UI.
Hidden campaign values and story completion percentages remain unexposed.

## Source inventory (observed, not proposed)

| Authority             | Source                                                | Current behavior / limitation                                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incident slot         | `src/persistence/storage.ts`                          | `orpheus.incident.v1`, localStorage through an injected read/write adapter; no transaction or compare-and-swap API.                                                                                                 |
| Incident envelope     | `src/persistence/save.ts`                             | Strict schema 1, scenario ID, content version, seed and full incident state; ordered replay commands must reproduce saved state.                                                                                    |
| Legacy authority      | `src/scenario/legacy-catalog.ts`                      | Frozen 1.0.0 / 1.1.0 definitions and explicit allowed target versions. Unsupported content is rejected. Verified old content replays into current content in memory.                                                |
| Discovery envelope    | `src/persistence/campaign-progress.ts`                | `orpheus.campaign-progress.v1`, strict schema 1; incident ID maps to arrays of encoded incident saves. Every save passes the existing decoder.                                                                      |
| Discovery writes      | `src/store/incident-session.ts`, `archive`            | Appends on new evidence/narrative or completion; ordinary accepted actions without a novel discovery/completion need not create a snapshot. Loading may archive discoveries but does not rewrite the incident slot. |
| Evidence/history view | `selectCampaignEvidence` / `selectCampaignNarratives` | Union of snapshot and current-incident events, deduplicated by scenario ID + evidence/narrative ID. This is not a canonical campaign action log.                                                                    |
| Restart               | `restart`, `src/app/AppShell.tsx`                     | Resets incident state, normally retaining the same seed. Action/event sequences start over. Live stores are per scenario and stay in memory; completed archive review has a separate store.                         |
| Accepted inputs       | `src/engine/types.ts`, `simulation.ts`                | Only successful commands enter incident replay. Rejected commands emit no accepted replay entry. Engine events include action, timer, evidence and narrative events, each ordered locally.                          |

There is no campaign run/attempt identifier, cross-incident global sequence,
recorded recommendation exposure, or independent player-model version in the
current persisted envelopes. Array order within an incident is not proof of
global player chronology. A migrated decoder result can contain target-content
discoveries absent from the original content; original provenance must survive
any future campaign import rather than treating those as historical observations.

### Why existing snapshots cannot be summed

A snapshot with commands `[OPEN_LOGS, TRACE_AUTH_REQUEST]` and another with
`[COMPARE_DEPLOYMENT]` can come from divergent restarts. The existing test
`src/tests/m3-narrative.test.ts` proves their discoveries are retained together.
It does not establish one action stream linking those snapshots.

Snapshots can also overlap prefixes. Scenario ID, seed and command sequence are
insufficient to distinguish two genuinely repeated attempts from one attempt
viewed twice. Hashing replay bytes can identify the same imported payload but
cannot establish distinct play identity. Combining prefixes or counting each
snapshot's actions invents or duplicates behavior.

## Gate 1 — storage authority options

Both options preserve the original incident slot and old discovery bytes. Neither
allows silent rewriting on load, deriving invented historical behavior, or
automatic fallback from corrupt new campaign state to a different valid state.
Key names below are candidates, not constants introduced by this document.

| Option          | Proposed authority                                                                                                                                                                                 | Benefit                                                                                                   | Cost / compatibility work                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — recommended | A distinct versioned campaign ledger (candidate `orpheus.campaign.v1`), while the two existing keys retain their current roles                                                                     | Lowest coupling to established M3 save readers; old desktop can still read old records without conversion | More than one local envelope; no cross-key atomicity. Define explicit evidence import/projection and separate authorities; legacy discoveries cannot automatically become canonical actions. |
| B               | A new discovery/campaign envelope v2 (candidate `orpheus.campaign-progress.v2`) unifies the new campaign ledger and discovery provenance; retain v1 as the original read-only compatibility source | One new authority for campaign and discovery projections after validated import                           | More extensive envelope migration and projection changes; multiple legacy snapshots still need explicit treatment. v1 is not an automatic live mirror of later v2 gameplay.                  |

Recommendation A is a proposal, **not a selected decision**. DEC-009's proposal
records this gate. Choosing A or B does not by itself approve the remaining
run/restart/import policy, behavior formulas, confidence policy or ending balance.
After the choice, specify the exact schema/version matrix and remaining gates
before implementing TASK-019/020.

## Proposed domain contracts (pending review and decisions)

### Input and replay identity

An adapter would supply explicit campaign run identity, incident attempt identity
and ordered accepted-command inputs. A pure transition function would consume
the validated campaign definition/version, prior campaign state and one validated
input batch, returning next state, emitted campaign events or a diagnostic.
Engine code must not generate identity from wall-clock or call `Math.random`.

Each command batch must identify its scenario version, seed, attempt-local command
sequence and verified resulting engine events/state. Campaign order must be an
explicit monotonic sequence, not elapsed incident time or object enumeration.
Reject missing predecessors, reused identity with different payloads, unsupported
versions, or a branch inconsistent with its approved continuation policy.
Projection, archive review, timers, reload and rejected actions are not additional
accepted player commands. Idempotency identity and hashing/canonicalization rules
need versioned test fixtures; a checksum is not authentication or a save-security
guarantee.

Pending human policy: whether restart continues one scored campaign as a new
attempt, replaces a prior canonical attempt, or starts a separate practice/run.
Also pending: how loading an older incident slot relates to an existing campaign
head. A legacy save cannot supply an absent campaign association by guessing.

### Campaign state and effects

Logical state contains current Act, completed incidents, evidence, narrative and
ending flags, corporate/NULL alignment, and public interest, operational safety,
curiosity, evidence, team trust, AI dependency and collateral damage. It also
tracks input provenance and approved behavior-model/definition versions.

Authored data would define transition effects, unlock prerequisites and allowed
references. Completion is a verified transition, not an arbitrary incident ID.
Effects must have explicit application identity so duplicate replay/import does
not apply them twice. Numeric ranges, initial values, aggregation and restart
contribution rules are pending contract decisions; no tuning values are chosen
here. A new-run baseline is not an observation about missing legacy behavior.

### Behavior observations and denominator proposals

Use the pre-action verified state and accepted command, not UI clicks or wording.
Metrics retain a value/availability indication, sample counts and classification
version. Absent eligible samples must not silently become observed zero rates.
The following are formula proposals; exact eligible classifications and weights
must be reviewed and approved before use:

| Metric                                       | Proposed numerator / denominator or observation                                        | Missing source concern                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| restartRate / rollbackRate                   | Classified accepted restart/rollback actions divided by approved eligible action count | Incident restart UI vs restart service action are distinct; campaign restart policy pending.                |
| evidenceBeforeActionRate                     | Eligible interventions with relevant evidence already found / eligible interventions   | Relevant evidence and intervention classes must be authored.                                                |
| averageInvestigationDepth                    | Approved distinct investigation observations per canonical attempt, then aggregate     | Alternate attempts and repeated observations require an explicit policy.                                    |
| aiRecommendationAcceptanceRate               | Accepted exposed recommendation / eligible recorded recommendation opportunities       | MVP has no recorded recommendation opportunity.                                                             |
| safetyPreference / collateralDamageTolerance | Approved authored observations from action intent/context and resulting effects        | Operational risk is not automatically a moral score; formula and normalization pending.                     |
| companyReportingRate / nullCooperationRate   | Classified accepted responses / eligible authored response opportunities               | Support status is not automatically corporate allegiance; MVP has no explicit NULL cooperation opportunity. |
| predictionDeviation                          | Accepted eligible actions compared with the prior recorded valid prediction            | Prediction shown, action availability, model version and confidence must be recorded first.                 |

No data should manufacture recommendation acceptance, NULL cooperation or
prediction deviation from existing UNKNOWN hints. Imported artifacts may affect
evidence eligibility under a separately approved import policy, but do not prove
historical alignment, model rates or recommendation observations.

### Prediction, branching and endings

Prediction input would be approved behavior observations, authored candidate
actions and explicit model/version context. Output would be a valid predicted
action or UNKNOWN, confidence/availability and traceable supporting observations.
Confidence thresholds, minimum samples and update formula remain pending; fixed
story percentages are not the policy. Branch evaluation consumes approved state
and validated predicates and returns eligible content plus diagnostic explanations,
not grading or raw hidden numeric UI.

Ending resolution would consume approved campaign state, final incident state,
final actions and versioned authored ending definitions/priority. It must have
deterministic fixtures for all ten named endings. Proposed safeguards: report
no match as unresolved rather than silently selecting STATUS QUO; reject ambiguous
priority ties unless a separately approved data-driven tie policy exists. Ending
thresholds, exact overlap policy and eligibility of unavailable observations
remain pending. Fixture thresholds are test-only, not production balance.

## Legacy import, failures and rollback proposals

Read/validate originals before any import. Preserve original bytes and content
provenance; do not use only migrated target-state output to invent old discoveries
or side effects. A candidate import should report verified artifacts, retained
archives, unsupported observations and ambiguities before adoption. Do not choose
the first/last completed snapshot as canonical behavior without human policy.

The chosen new envelope should validate its schema, content/model versions,
references, history and any projection checkpoint before replacing a valid
campaign. Write failure must leave the prior valid campaign usable and surface
an error, not pretend that an action was durably saved. Reload checks need defined
revision/conflict behavior; a read-compare-write over localStorage is not atomic.
Rollback preserves the two original keys, but an old client cannot understand
new campaign history. No automatic dual-write, truncation, erase or destructive
reset is approved. Atomicity, concurrent-writer policy and explicit import commit
behavior must be specified after the storage choice.

## Verification and acceptance map

| Evidence required                               | Owner / fixture coverage                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current guarantees                              | Existing `save.test.ts`, `m3-narrative.test.ts`, `war-room.test.tsx`, `AppShell.test.tsx`; frozen YAML validation                                                |
| Input identity and idempotency                  | TASK-019: duplicate input vs distinct identical attempt, missing/reordered input, rejected command, reload/archive review                                        |
| Campaign progression and hidden effects         | TASK-019: completion/unlock/evidence/flag tests, effect replay without duplication; TASK-020/024 round-trip projections                                          |
| Legacy compatibility                            | TASK-020: overlapping/divergent snapshots, original vs migrated provenance, unsupported schema/content, corrupt/tampered data, interrupted import, repeat import |
| Action-derived model and branches               | TASK-021/022: eligible denominators, zero/missing observations, changed model versions, predictions before actions, unavailable actions and reveal gates         |
| Ending framework                                | TASK-023: ten endings, positive/exclusion/boundary fixtures, overlap/ties/no match, unsupported final context and references                                     |
| Desktop/native integration and final acceptance | TASK-024/025: persistence and read-only archive isolation, all three UNKNOWN-only paths, supported native minimum/enlarged text, independent review and QA       |

TASK-018 acceptance remains pending: storage choice and other required policies
need decisions; independent architecture review and final acceptance QA have not
approved this draft. Existing tests verify current safeguards, not these proposed
new APIs. No result should mark TASK-018 complete merely because this text exists.

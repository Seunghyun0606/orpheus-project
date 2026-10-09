# Campaign intelligence contract — TASK-018 proposal

Status: **partially decided contract proposal**. Gate 1 storage authority is
approved by DEC-009; Gate 2 retry contribution is approved by DEC-010; Gate 3
discovery-only adoption is approved by DEC-011; Gate 4 confirmed checkpoint
attempts are approved by DEC-012; Gate 5 IndexedDB commits are approved by DEC-013.
Gate 6 pooled player rates are approved by DEC-014; Gate 7 once-per-run authored
campaign effects are approved by DEC-015; Gate 8 operational restart/rollback
denominators are approved by DEC-016; Gate 9 current-attempt evidence-before-action
qualification is approved by DEC-017; Gate 10 distinct investigation depth is
approved by DEC-018; Gate 11 unresolved ending ties/no-match is approved by DEC-019.
Gate 12 empirical prediction/confidence is approved by DEC-020. Gate 13
recommendation response measurement remains pending.
No runtime type, schema, storage key, migration, content or player
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
DEC-009 separately approves retaining both existing stores and adding a distinct
versioned campaign ledger. It does not approve the remaining policies below.
DEC-010 approves new official attempts in the same campaign, preserving earlier
accepted history. It does not authorize reconstruction of missing legacy history.
DEC-011 approves explicit source-verified discovery adoption only. It does not
import historical effects, behavior, completion or official checkpoint association.
DEC-012 separately approves eligible unfinished checkpoint baselines as confirmed
new attempts, preserving prior history and counting only subsequently accepted inputs.
DEC-013 chooses IndexedDB transactions for the new ledger only, with revision
checks and acknowledgement after commit; both legacy localStorage stores remain.
DEC-014 pools metric-specific eligible observations across official attempts
before computing rates. It does not choose effect awards or non-rate formulas.
DEC-015 approves each stable authored discovery/narrative/completion effect at
most once per campaign run, without dropping new retry behavior or simulation costs.
DEC-016 fixes restart/rollback denominators as eligible operational interventions,
not information or communication commands; classifications remain versioned data.
DEC-017 requires relevant supporting observations from earlier new investigation
inputs in the same attempt for evidence-before-action, not inherited membership alone.
DEC-018 averages per-attempt distinct investigation observation counts over eligible
official attempts, preserving repeated query history without repeating depth units.
DEC-019 keeps ending top ties and valid no-match unresolved with diagnostics,
without a default ending or new ending flag. Invalid context is not valid no-match.

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

## Gate 1 — storage authority (option A approved)

Both options preserve the original incident slot and old discovery bytes. Neither
allows silent rewriting on load, deriving invented historical behavior, or
automatic fallback from corrupt new campaign state to a different valid state.
Key names below are candidates, not constants introduced by this document.

| Option          | Proposed authority                                                                                                                                                                                 | Benefit                                                                                                   | Cost / compatibility work                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — recommended | A distinct versioned campaign ledger (candidate `orpheus.campaign.v1`), while the two existing keys retain their current roles                                                                     | Lowest coupling to established M3 save readers; old desktop can still read old records without conversion | More than one local envelope; no cross-key atomicity. Define explicit evidence import/projection and separate authorities; legacy discoveries cannot automatically become canonical actions. |
| B               | A new discovery/campaign envelope v2 (candidate `orpheus.campaign-progress.v2`) unifies the new campaign ledger and discovery provenance; retain v1 as the original read-only compatibility source | One new authority for campaign and discovery projections after validated import                           | More extensive envelope migration and projection changes; multiple legacy snapshots still need explicit treatment. v1 is not an automatic live mirror of later v2 gameplay.                  |

The human selected A, recorded in
[DEC-009](../../.project-os/decisions/DEC-009-separate-m4-campaign-ledger.yaml).
The alternatives above retain the original comparison; B is not selected.
This is storage authority approval, not approval of the remaining run/restart/import
policy, behavior formulas, confidence policy or ending balance. Specify the exact
schema/version matrix and remaining gates before implementing TASK-019/020.

The three authorities have distinct responsibilities: the existing single slot
holds an incident checkpoint under its confirmation rules; the M3 store retains
verified alternate discovery snapshots; the new ledger would hold explicitly
associated, ordered campaign inputs and their derived state. Neither reading nor
updating the M3 union automatically creates official ledger observations. Any
adoption of legacy artifacts follows DEC-011's explicit discovery-only scope. A
corrupt ledger must not silently fall back to that union as a new official history.

## Gate 2 — restart and replay contribution (option A approved)

[DEC-010](../../.project-os/decisions/DEC-010-append-official-campaign-attempts.yaml)
records human selection of A. The original alternatives are retained below for
comparison; B is not selected:

- **A — recommended:** append every official restart/replay as a distinct attempt
  in the same run. Keep accepted actions from abandoned attempts; do not replace
  past history. DEC-014/015 separately approve pooled rates and once-per-run
  discovery/narrative/completion effects; classifications and balance remain pending.
- **B:** isolate restart/replay as practice. Preserve the official attempt for
  resume; practice does not affect official hidden values, evidence, unlocks,
  model or endings. Starting a new official campaign is explicit and preserves
  the old one. Existing M3 discovery behavior does not authorize importing
  practice artifacts into the official ledger.

For example, an attempt accepts `OPEN_LOGS`, then a service restart action. A UI
incident restart is a boundary: approved A creates a second official attempt;
the unselected B would create isolated practice. Identical seed and commands
in a genuinely new attempt are not duplicate delivery. Conversely, redisplaying
or replay-verifying the original saved attempt is not additional player action.
The UI restart boundary is not itself a restart-service observation.

Both options preserve history. Neither authorizes retroactive run identity for
old saves, erasing old attempts, double completion/evidence awards, numeric
weighting or ending thresholds. Loading an older incident checkpoint against an
existing ledger head and adopting ambiguous legacy snapshots remain separate
pending policies. DEC-010 alone does not resolve them. No automatic old-save
association or inherited-prefix accounting follows from approving future retries.

### Retry acceptance cases for the later implementation

- Two identified official attempts with the same seed and command list retain
  two accepted histories; failed/abandoned attempts are not replaced by a later
  successful one. Numeric contribution still follows the pending authored rules.
- Repeated delivery of the same identified input is idempotent; the same identity
  with a different payload is a conflict, not a second attempt. Replay byte
  equality is not sufficient identity for these two cases.
- Archive review, checkpoint validation and redisplay produce no new accepted
  actions. A playable retry and a headless verification replay are distinct.
- UI incident restart creates a boundary but is not a service restart command.
  Restart/rollback behavior uses accepted command classifications, not clicks.
- Evidence and completion effects follow DEC-015's once-per-run scope; verify
  receipt identity separately from membership and retained new behavior.

## Gate 3 — legacy discovery adoption (option A approved)

[DEC-011](../../.project-os/decisions/DEC-011-explicit-legacy-discovery-adoption.yaml)
records human selection of A. The original alternatives are retained for
comparison; B is not selected. Runtime import is not implemented.

- **A — recommended:** preview and explicitly adopt source-verified evidence and
  narrative records into a selected run, tagged as imported discoveries. Their
  membership can satisfy authored discovery-presence predicates; do not execute
  historical discovery effects, infer behavior or alignment, or transfer incident
  completion, Act progression or ending flags. Keep source versions, bytes and
  known provenance limits. Repeat import must not count a discovery again.
- **B:** retain all existing archive/load behavior without an import into the
  new ledger. Only identified new play supplies its official discoveries; old
  archive entries alone do not satisfy official evidence/ending predicates.

The current decoder verifies source content and then may replay target content.
Import must not mistake additional target discoveries for those present in the
source. Furthermore, M3 `encodeCampaignProgress` re-encodes decoded snapshots at
their catalog version and does not store independent migration lineage. If an
older original is unavailable, retain that limitation; do not claim that a
current-version snapshot proves when the player originally found an artifact.
Verification proves the available snapshot, not missing historical chronology.

Both options preserve existing bytes and M3 behavior. Neither chooses which
divergent path was the official campaign. Neither permits silent partial import
of malformed records or fallback from a corrupt new ledger. Older-checkpoint
continuation remains a separate policy: loading does not by itself roll back
accepted campaign history or assign absent attempt identity.

### Discovery import acceptance cases for the later implementation

- Validate available source bytes against their source replay authority before
  proposing adoption. A source with no discovery cannot gain an imported artifact
  solely because replay against newer content reveals one.
- Divergent or overlapping snapshots can contribute verified discovery membership
  with provenance, never a fabricated official action stream or historic alignment.
- Adoption is explicit and scoped to a selected run after preview; reading or
  loading the old slot is not consent to mutate that run. Re-import and subsequent
  rediscovery must not duplicate membership or retroactive discovery awards.
- Preserve unknown original lineage, source versions and available bytes. A
  re-encoded current-version M3 record is not proof of its original migration path.
- Imported narrative history is not a blanket copy of incident/narrative/ending
  flags. No completion or Act unlock follows solely from a completed source save.
- Report invalid/unsupported records without silent partial adoption. The exact
  envelope, source-change checks and durable import mechanics remain pending.

## Gate 4 — older checkpoint continuation (option A approved)

[DEC-012](../../.project-os/decisions/DEC-012-confirmed-checkpoint-attempts.yaml)
records human selection of A. The original alternatives are retained below;
B is not selected. Runtime continuation is not implemented:

- **A — recommended:** an exactly matched, explicitly associated live attempt
  head resumes without another attempt. Otherwise preview and confirm an eligible,
  verified unfinished checkpoint as the baseline for a new official attempt in
  the selected campaign. Preserve earlier history; only newly accepted commands
  and their incremental consequences contribute new observations. Do not recount
  the inherited replay prefix or import historic numeric effects.
- **B:** official resume requires the associated live attempt head. Old or
  unassociated saves remain loadable outside official contribution through the
  existing legacy flow. Official retries start from the authored initial state;
  discovery-only import remains independently available under DEC-011.

Both options prohibit rolling back campaign history or guessing association from
seed, replay bytes or time. A completed checkpoint is review, not a completion
award; a playable retry begins from the authored initial state. Validate scenario
eligibility before any official continuation, so a checkpoint cannot bypass Act
gates. Original content replay and approved target migration still apply.

Under approved A, the baseline records the verified restored incident state,
seed/RNG, pending work and inherited replay boundary with source provenance;
those are simulation inputs, not new official behavior. Future command batches
must distinguish inherited state from newly accepted actions and effect deltas.
Restoring a baseline must not silently adopt its artifacts into campaign membership:
DEC-011 requires a separate explicit adoption. Exact association fields, envelope
and conflict/commit mechanics still require the final reviewed contract.

### Checkpoint acceptance cases for the later implementation

- Resume a matched and explicitly associated live head without appending another
  attempt or counting its saved commands again. Bytes without an explicit
  association do not prove identity, even if they match a known attempt.
- Preview/confirm an eligible unfinished older checkpoint as a distinct attempt.
  Keep later accepted history; record inherited replay/event boundaries and
  baseline resources so new input effects do not recount prior totals.
- Preserve pending work and RNG state in deterministic continuation. Timers due
  during a new command are outcomes of that command, not extra player commands.
- A completed or currently ineligible checkpoint cannot create completion or Act
  unlocks. Invalid or changed source data must not silently replace confirmed data.
- Repeated validation, archive review or loading alone creates no new accepted
  action. A separately confirmed new attempt is distinct from duplicate delivery.
- Checkpoint-derived artifacts do not silently enter campaign membership or run
  historical discovery effects; DEC-011 adoption remains explicit.

## Gate 5 — ledger commit mechanism (option A approved)

[DEC-013](../../.project-os/decisions/DEC-013-transactional-indexeddb-campaign-ledger.yaml)
records human selection of A. The original alternatives remain below for
comparison; B is not selected. Both preserve the legacy localStorage stores:

- **A — recommended:** a new versioned IndexedDB authority, using a readwrite
  transaction for the revision check and complete ledger update. A new asynchronous
  adapter acknowledges only transaction completion, not one successful request.
- **B:** a distinct localStorage envelope with required exclusive Web Locks for
  every participating M4 writer. Re-read and check revision inside that lock;
  refuse official writes when locking is unavailable. No unlocked fallback.

A is recommended for a ledger whose history and projections need coherent
concurrent updates; B limits storage-format changes but needs cooperative locking
and rewrites the whole envelope. These are architecture proposals, not measured
platform capabilities. The normative reference is the
[IndexedDB transaction specification](https://w3c.github.io/IndexedDB/#transaction-concept),
and the alternative uses the
[Web Locks exclusive mode](https://w3c.github.io/web-locks/#modes-and-scheduling).
Actual browser and Tauri WebView support must be verified in TASK-020/024/025.

The approved commit boundary for A is: prepare a validated
candidate, compare the expected committed revision under the selected protection,
persist input identities plus derived state and associations, then publish official
success. A stale revision or storage failure preserves the last committed state
and surfaces a diagnostic. A repeated committed input acknowledges the existing
result, not a new observation. A different payload under reused identity conflicts.
An interrupted/ambiguous acknowledgement is reconciled against committed identity
on reload, not treated as permission to apply the action again.

This boundary covers the new ledger only. An explicit old-slot save remains a
separate operation; its association cannot be trusted without checking actual
verified bytes. No cross-key atomicity, unbounded storage, automatic dual-write,
backend fallback, deletion or physical-disk durability promise is proposed.
The [ledger persistence review draft](campaign-ledger-persistence.md) now specifies
version axes, record/provenance boundaries, association, replay validation and
failure fixtures for the chosen mechanism. Its detailed schema still needs review;
model formula and production balance decisions remain separate. No runtime
database, migration or adapter has been implemented by this documentation step.

## Gate 6 — behavior rate aggregation (approved)

[DEC-014's proposal](../../.project-os/decisions/proposals/DEC-014-player-rate-aggregation.yaml)
records the comparison of metric-specific weighting options. The human selected
**A**, recorded in [DEC-014](../../.project-os/decisions/DEC-014-pooled-player-behavior-rates.yaml):

- **A — approved:** pool eligible numerators and denominators across attempts,
  then divide. Every eligible sample has equal influence; longer attempts with
  more samples contribute more to the resulting rate.
- **B — not selected:** compute each eligible attempt's rate, then average those rates with equal
  attempt weight. A short eligible attempt has the same influence as a long one.

An arithmetic-only fixture has one positive observation in two eligible samples
on the first attempt and one in ten on the second. A gives `2/12 = 1/6`; B gives
`(1/2 + 1/10)/2 = 3/10`. The different rates can affect later authored branches
and prediction inputs. These numbers are not ending thresholds or production tuning.

Both options retain eligible new observations from unfinished/abandoned attempts;
no-sample attempts add no weight and an entirely unsupported metric is unavailable,
not zero. Imported artifacts and inherited prefixes create no historical samples.
Retain raw metric-specific counts and definition versions. Recompute compatible
rates from those counts, not rounded per-attempt rates. Genuine new accepted
commands in different official attempts contribute even if their bytes match;
duplicate delivery of the same committed input does not. Do not silently mix
incompatible classification versions. DEC-015 separately approves authored effect
scope. Exact metric classifications, non-rate investigation depth/intent formulas,
confidence and ending policy remain separate contract work.

## Gate 7 — authored campaign effect scope (approved)

[DEC-015's proposal](../../.project-os/decisions/proposals/DEC-015-campaign-effect-award-scope.yaml)
compares effects from qualifying native discovery, narrative and incident-completion
events across official retries. The human selected **A**, recorded in
[DEC-015](../../.project-os/decisions/DEC-015-once-per-run-campaign-effects.yaml):

- **A — approved:** apply each stable authored effect identity once per
  campaign run. A later qualifying retry retains its observations and events but
  cannot multiply the same numeric campaign award.
- **B — not selected:** apply each stable authored effect identity once per distinct official
  attempt. Membership stays deduplicated, but repeating discoveries/completions
  can again affect hidden values and later branch/ending eligibility.

This does not discard accepted retry behavior or action-driven resource/impact
deltas, and it does not change incident simulation effects. Application receipts
are distinct from evidence/narrative/completed-incident membership. A content
version bump must not automatically reset a stable effect identity. Conflicting
payloads under reused identity fail closed; changing authored semantics requires
explicit compatibility treatment, not retroactive recalculation.

DEC-011 imports membership only: no numeric award or fabricated effect receipt.
Import, load, inherited replay, projection, archive review and duplicate delivery
cannot themselves award effects. Membership alone does not trigger a later award;
only a genuinely new qualifying native event can do so under authored predicates
and the chosen scope. No balance values, thresholds or production effects are
chosen in this proposal.
The [effect application review draft](campaign-effect-application.md) specifies
the approved receipt boundary, new-event eligibility, import/baseline separation
and required fixtures. A normal retry with an already-applied compatible effect
is retained, not rejected; only the repeated numeric award is suppressed.

## Gate 8 — restart and rollback denominators (approved)

[DEC-016's proposal](../../.project-os/decisions/proposals/DEC-016-operational-rate-denominators.yaml)
asks whether these two operational action rates describe the share of operational
interventions or the share of all accepted gameplay commands. The human selected
**A**, recorded in [DEC-016](../../.project-os/decisions/DEC-016-operational-intervention-rate-denominators.yaml):

- **A — approved:** count explicitly classified operational interventions
  as the denominator. Information gathering and communication do not dilute
  restart/rollback choices; validated authored classification decides eligibility.
- **B — not selected:** count all newly accepted gameplay commands, including observation,
  investigation, communication and delegation, as the denominator.

An arithmetic-only fixture contains one service restart, one rollback, one other
operational intervention and six information/communication commands. A yields
`1/3` for each rate; B yields `1/9`. Both pool eligible counts under DEC-014,
exclude inherited/rejected/duplicate inputs and report no eligible denominator
as unavailable. This is not an ending threshold or production balance decision.
UI incident restart remains an attempt boundary, not a service-restart numerator.
This gate does not select evidence-before-action, investigation depth, intent or
prediction formulas, or alter once-per-run campaign effects under DEC-015.
The [behavior rate review draft](player-behavior-rates.md) specifies count,
classification/provenance and verification boundaries for the approved rates.

## Gate 9 — evidence-before-action qualification (approved)

[DEC-017's proposal](../../.project-os/decisions/proposals/DEC-017-evidence-before-action-qualification.yaml)
distinguishes fresh investigation behavior from acting with existing verified
knowledge. The human selected **A**, recorded in
[DEC-017](../../.project-os/decisions/DEC-017-current-attempt-evidence-before-action.yaml):

- **A — approved:** qualify relevant supporting investigation from earlier
  newly accepted inputs in the same official attempt. Imported membership,
  earlier attempts and inherited checkpoint observations alone do not qualify.
- **B — not selected:** qualify relevant knowledge already available in the verified pre-action
  context, including approved imported membership, earlier official discoveries
  or inherited baseline observations. No fresh investigation is required.

For one new eligible intervention with relevant imported evidence but no new
investigation, A yields `0/1`, B `1/1`. Both measure only the new intervention;
neither imports historic behavior. Relevance and eligibility need versioned
authored predicates. Evidence produced during the intervention cannot satisfy
its own pre-action check. Missing/invalid required predicates are a diagnostic,
not an invented negative sample. This gate changes neither general discovery
presence eligibility under DEC-011 nor DEC-015 effect awards or DEC-016 rates.
The [behavior rate draft](player-behavior-rates.md) specifies provenance, pre-action
ordering, exact-head/baseline distinctions and evidence-before-action fixtures.

## Gate 10 — investigation depth counting (approved)

[DEC-018's proposal](../../.project-os/decisions/proposals/DEC-018-investigation-depth-counting.yaml)
compares two meanings of averageInvestigationDepth. The human selected **A**,
recorded in [DEC-018](../../.project-os/decisions/DEC-018-distinct-investigation-depth.yaml):

- **A — approved:** distinct authored investigation observation keys per
  eligible official attempt; repeating the same key does not deepen that attempt.
- **B — not selected:** all accepted commands explicitly classified as qualifying investigation
  per eligible attempt; repeated queries count, one command is one unit.

Both proposals divide total depth units by eligible official attempt count, with
each attempt weighted equally. An eligible attempt has supported investigation
definitions and at least one new accepted player command. An eligible attempt
without investigation contributes zero; an empty or unsupported attempt does not
provide a denominator. With no eligible attempt the result is unavailable, not zero.
Include eligible unfinished/abandoned attempts and report unsupported coverage.

In an arithmetic fixture, one attempt has three investigation commands covering
two distinct keys, another has a new action but no investigation. A gives `1`
observation per eligible attempt; B gives `1.5` commands per eligible attempt.
Imported/inherited observations and replay/duplicates add no units. Under A a
new distinct official attempt can investigate the same key again; deduplication
is within each attempt, unlike DEC-015 numeric effect receipts. This is neither
a causal-graph longest path nor an action-frequency rate, and does not change
DEC-014's already approved pooled rates. No production thresholds are proposed.
The [behavior review draft](player-behavior-rates.md) now specifies the approved
key/count boundaries, eligible attempt coverage and depth verification fixtures.

## Gate 11 — ending ambiguity and no-match (approved)

[DEC-019's proposal](../../.project-os/decisions/proposals/DEC-019-ending-ambiguity-policy.yaml)
asks how to resolve equally preferred eligible endings and valid no-match final
contexts. The human selected **A**, recorded in
[DEC-019](../../.project-os/decisions/DEC-019-unresolved-ending-ambiguity.yaml):

- **A — approved:** uniquely preferred eligible matches resolve through authored
  priority; top ties return an ambiguity diagnostic, no matching condition returns
  unresolved. No automatic ending or new ending flag in those cases.
- **B — not selected:** add validated authored tie order and an explicit fallback ending reference.
  Top ties use that order; valid fully evaluated no-match can select the designated
  fallback despite its ordinary conditions not matching. No implicit file order.

Both require explicit versioned campaign/final context and condition/priority
definitions. A unique preferred eligible match is distinct from a top tie;
lower-precedence matches do not create ambiguity. Missing context, unavailable
required observations, unsupported versions, invalid references and malformed
definitions are diagnostics, not no-match cases eligible for fallback. Do not
coerce unknown behavior to zero or secretly choose STATUS QUO.

TASK-023 must cover all ten named endings and positive/exclusion/boundary cases,
overlap, ties, no-match and invalid/unavailable context. No production thresholds,
priority values, tie order, fallback identity or late-act content is chosen here.
This framework remains invisible in the current UNKNOWN-only MVP.
The [ending review draft](ending-resolution.md) specifies explicit final context,
result variants, resolution/flag boundaries and the required fixture matrix.

## Gate 12 — prediction and confidence model (approved)

[DEC-020's proposal](../../.project-os/decisions/proposals/DEC-020-prediction-model-policy.yaml)
compares two deterministic action-derived models. The human selected **A**, recorded
in [DEC-020](../../.project-os/decisions/DEC-020-empirical-context-action-prediction.yaml):

- **A — approved:** comparable recorded action frequencies among currently
  available authored candidates; a unique top candidate's confidence is its
  share of eligible samples. Empty/insufficient samples or a top tie give UNKNOWN.
- **B — not selected:** an authored versioned score over available approved behavior/context
  inputs; a unique top candidate's confidence is its share of eligible score
  total. This can generalize to contexts without direct prior choices, but needs
  reviewed coefficients/support rules. Missing support, zero total or tie give UNKNOWN.

Neither empirical share nor normalized score is a calibrated probability. Neither
uses fixed narrative percentages, a live AI service or fabricated legacy choices.
Context/candidate definitions, minimum support and production reveal rules remain
under review; score coefficients are not part of the selected model. Record
model/context/support and actual prediction exposure before a
responding command; later actions cannot rewrite the earlier prediction. Existing
UNKNOWN hints are not recommendation/deviation opportunities. Keep late-act
fixtures non-production and the three bundled incidents UNKNOWN-only.
The [prediction review draft](player-prediction.md) specifies empirical selection,
compatible sample provenance, causal boundaries, exposure and future fixture coverage.

## Gate 13 — recommendation response measurement (pending)

[DEC-021's proposal](../../.project-os/decisions/proposals/DEC-021-recommendation-response-policy.yaml)
separates actual following behavior from explicit recommendation acceptance:

- **A — recommended:** compare the next eligible new accepted action while a
  recorded recommendation opportunity remains valid. The recommended action is
  positive, another eligible response negative; manual execution can count.
- **B:** count only explicit accepted accept/reject responses associated with
  that opportunity. A matching manual action without such a response adds no
  recommendation acceptance sample; a UI click alone is not an accepted input.

For a fixture exposing a valid rollback recommendation followed by a matching
manual rollback, A produces `1/1`; B produces no eligible response and an unavailable
rate, not `0/1`. Neither option claims causal motivation. No response/expiry is not
rejection, unrelated observation commands need not consume an opportunity, and
response eligibility/validity must be versioned authored data. Both pool eligible
counts under DEC-014, associate at most one sample with an opportunity, and
preserve genuine operational actions/costs without double counting.

Only actual gated exposure can supply an opportunity. A prediction is not
automatically a recommendation; UNKNOWN hints do not count. This gate chooses
neither numeric AI_DEPENDENCY effects nor prediction-deviation eligibility,
production thresholds or reveal conditions. Current bundled incidents stay
UNKNOWN-only, with no invented past acceptance observations.

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

DEC-010 requires new official retries to append distinct attempts; DEC-012
defines confirmed checkpoint-based attempts without recounting inherited inputs.
No replacement of accepted history is authorized. DEC-013 fixes the commit
mechanism; the detailed association/envelope draft still requires review. A legacy
save cannot supply absent identity by guessing.

### Campaign state and effects

Logical state contains current Act, completed incidents, evidence, narrative and
ending flags, corporate/NULL alignment, and public interest, operational safety,
curiosity, evidence, team trust, AI dependency and collateral damage. It also
tracks input provenance and approved behavior-model/definition versions.

Authored data would define transition effects, unlock prerequisites and allowed
references. Completion is a verified transition, not an arbitrary incident ID.
Effects use explicit run-scoped application identity under DEC-015 so replay,
imports and later qualifying retries do not apply the same authored discovery,
narrative or completion effect twice. New accepted retry history remains under
DEC-010. Numeric ranges, initial values and non-rate formulas remain pending;
no tuning values are chosen here. A new-run baseline is not an observation about
missing legacy behavior.

### Behavior observations and denominator proposals

Use the pre-action verified state and accepted command, not UI clicks or wording.
Metrics retain a value/availability indication, sample counts and classification
version. Absent eligible samples must not silently become observed zero rates.
DEC-014 fixes rate weighting as pooled eligible counts; DEC-016 separately fixes
restart/rollback denominators as operational interventions. Other qualifications,
exact authored classifications and non-rate formulas still require their reviewed
contracts before use:

| Metric                                       | Proposed numerator / denominator or observation                                                                  | Missing source concern                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| restartRate / rollbackRate                   | Classified accepted restart/rollback actions divided by eligible operational interventions under DEC-016         | Official retry histories are retained under DEC-010; UI restart is not a service restart observation.       |
| evidenceBeforeActionRate                     | Eligible interventions with prior relevant new same-attempt investigation / eligible interventions under DEC-017 | Relevant evidence and intervention classes must be authored.                                                |
| averageInvestigationDepth                    | Per-attempt distinct investigation observation counts averaged over eligible attempts under DEC-018              | Supported zero-investigation attempts count; empty/unsupported attempts do not.                             |
| aiRecommendationAcceptanceRate               | Accepted exposed recommendation / eligible recorded recommendation opportunities                                 | MVP has no recorded recommendation opportunity.                                                             |
| safetyPreference / collateralDamageTolerance | Approved authored observations from action intent/context and resulting effects                                  | Operational risk is not automatically a moral score; formula and normalization pending.                     |
| companyReportingRate / nullCooperationRate   | Classified accepted responses / eligible authored response opportunities                                         | Support status is not automatically corporate allegiance; MVP has no explicit NULL cooperation opportunity. |
| predictionDeviation                          | Accepted eligible actions compared with the prior recorded valid prediction                                      | Prediction shown, action availability, model version and confidence must be recorded first.                 |

No data should manufacture recommendation acceptance, NULL cooperation or
prediction deviation from existing UNKNOWN hints. DEC-011 permits imported
discovery membership to satisfy authored presence predicates, but it does not prove
historical alignment, model rates or recommendation observations.

### Prediction, branching and endings

Prediction input would be approved behavior observations, authored candidate
actions and explicit model/version context. Output would be a valid predicted
action or UNKNOWN, confidence/availability and traceable supporting observations.
DEC-020 approves empirical comparable-context action frequencies with the unique
top count's eligible sample share. Empty/insufficient support and top ties give
UNKNOWN; invalid required context produces diagnostics. Thresholds, minimum
support and exact definition contracts remain under review; fixed story
percentages and a score-model fallback are not the policy. See the
[prediction draft](player-prediction.md). DEC-021 separately proposes how recorded
recommendation responses contribute acceptance samples; neither option is selected.
Branch evaluation consumes approved state and validated predicates and returns
eligible content plus diagnostic explanations,
not grading or raw hidden numeric UI.

Ending resolution would consume approved campaign state, final incident state,
final actions and versioned authored ending definitions/priority. It must have
deterministic fixtures for all ten named endings. DEC-019 approves unresolved
top-tie/no-match diagnostics, with no default ending. Invalid or unavailable
required context cannot supply a result or masquerade as valid no-match.
Ending thresholds and predicate/priority contracts still require
review and approval. Fixture thresholds are test-only, not production balance.

## Legacy import, failures and rollback proposals

DEC-011 approves adoption scope and DEC-013 the IndexedDB commit boundary. The
detailed envelope and source-change checks remain under contract review.
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
reset is approved. DEC-013 provides new-ledger transactional revision checks,
not atomicity across old stores. The persistence draft defines the remaining
review and fixture requirements; no physical implementation is present.

## Verification and acceptance map

| Evidence required                               | Owner / fixture coverage                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current guarantees                              | Existing `save.test.ts`, `m3-narrative.test.ts`, `war-room.test.tsx`, `AppShell.test.tsx`; frozen YAML validation                                                              |
| Input identity and idempotency                  | TASK-019: duplicate input vs distinct identical attempt, missing/reordered input, rejected command, reload/archive review                                                      |
| Campaign progression and hidden effects         | TASK-019: completion/unlock/evidence/flag tests, effect replay without duplication; TASK-020/024 round-trip projections                                                        |
| Legacy compatibility                            | TASK-020: overlapping/divergent snapshots, original vs migrated provenance, explicit discovery-only adoption, older checkpoint policy, invalid data, interrupted/repeat import |
| Action-derived model and branches               | TASK-021/022: eligible denominators, zero/missing observations, changed model versions, predictions before actions, unavailable actions and reveal gates                       |
| Ending framework                                | TASK-023: ten endings, positive/exclusion/boundary fixtures, overlap/ties/no match, unsupported final context and references                                                   |
| Desktop/native integration and final acceptance | TASK-024/025: persistence and read-only archive isolation, all three UNKNOWN-only paths, supported native minimum/enlarged text, independent review and QA                     |

TASK-018 acceptance remains pending: storage authority, official retry history,
discovery-only adoption, checkpoint continuation, IndexedDB commits, pooled
behavior rates, once-per-run authored effects and operational restart/rollback
denominators, current-attempt evidence qualification and distinct investigation
depth, unresolved ending ambiguity and empirical prediction/confidence are approved.
Recommendation response measurement and other required policies still need
decisions; detailed persistence/effect/behavior/prediction/ending drafts still need review.
Independent architecture review and final acceptance QA have not approved this
draft. Existing tests verify current safeguards, not these proposed
new APIs. No result should mark TASK-018 complete merely because this text exists.

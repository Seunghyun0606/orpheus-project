# Campaign ledger persistence — TASK-018 review draft

Status: storage mechanism is approved by DEC-013; the detailed layout below is
an implementation-contract draft for review, not a runtime schema or a completed
TASK-018 handoff. No IndexedDB database has been opened by this documentation step.
Pending behavior/ending policies cannot be selected by storage code.

The [logical record interface draft](campaign-record-contract.md) now specifies
operation/canonical-equality/association and read/prepare/commit representations.
It preserves the approved authority boundaries and still requires independent
review; it is not a physical schema or permission to open/migrate a database.

## Authority and version boundaries

The new IndexedDB authority stores official campaign runs. Both existing
localStorage keys keep their current envelopes and readers. The earlier candidate
label `orpheus.campaign.v1` does not create a third localStorage key after DEC-013.
Proposed physical names are database `orpheus.campaign`, database version 1,
object store `runs`, keyed by explicit run ID. Names and field layout remain
subject to final contract review; they do not authorize rewriting an existing DB.

Separate these version axes:

| Axis                                               | Purpose / rejection boundary                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| IndexedDB database version                         | Physical object-store layout; no destructive upgrade or deletion on version/open errors.         |
| Ledger envelope schema                             | Strict fields and record variants; unknown schema fails, not conversion to an empty run.         |
| Campaign definition version                        | Act/unlock/effect rules and initial state used for this run.                                     |
| Scenario ID and content version                    | Verify each attempt/baseline against its actual replay authority and approved migration mapping. |
| Replay rules version                               | Identify simulation semantics; unsupported rules cannot silently reinterpret stored commands.    |
| Behavior / prediction / ending definition versions | Replay projections under recorded definitions, not whichever tuning is newest.                   |

The initial envelope schema is proposed as 1, independently of DB version 1 and
legacy incident/discovery schema 1. No later-ledger migration is currently
approved. Failure to load a supported definition is an incompatibility diagnostic,
not permission to drop history or choose a different model. Existing display
settings remain in their existing authority, not duplicated into this ledger.

## Logical run record

A record contains run ID, envelope/definition versions, committed revision,
ordered ledger operations and their stable input identities, attempt metadata,
source baselines/import provenance, and derived campaign/model projections.
Keep an operation sequence separate from incident command/event sequences.
Run IDs and attempt IDs are explicit caller-supplied opaque identifiers; the pure
domain neither invents them from a seed nor calls platform randomness or time.

Operation variants cover explicit run creation, attempt start, accepted incident
command, confirmed checkpoint start and confirmed discovery adoption. Later
authored recommendation/prediction opportunities require recorded context before
a responding command; existing hints cannot manufacture that context. UI
navigation, archive review and validation are not accepted action operations.

Each attempt records scenario/version, seed, source/baseline provenance and the
inherited command/event boundary, followed by only new accepted command inputs.
Store full available source bytes for imports/baselines and distinguish original
source verification from target migration output. Unknown lineage stays unknown.
A baseline is a simulation prerequisite, not a hidden-value or behavior award.

The replay validator checks operations in recorded order and reproduces attempt
state, emitted events, accepted observation boundaries and projections using
recorded definitions. Stored projections are verified caches, not an independent
source for inventing history. DEC-015 scopes authored discovery/narrative/completion
effects to once per run. Store their application receipts with the same committed
record as derived state; membership alone cannot prove a numeric award. The
[effect application review draft](campaign-effect-application.md) defines related
provenance, compatibility and failure fixtures.

## Commit port and acknowledgement

The asynchronous adapter exposes validated read and revision-checked commit.
A commit request identifies its run, stable operation identity/payload, expected
revision and candidate envelope. The pure domain prepares the candidate without
I/O. The adapter re-reads the run and checks revision within the same readwrite
transaction used to write the whole record, including its projections and any
checkpoint association. Do not await unrelated I/O or prompts inside that transaction.

For an already committed matching operation, return a duplicate receipt and the
current committed head without reapplying it. Reuse with a different payload is
a conflict. A new operation from a stale revision conflicts; do not silently
rebase its effects onto a different pre-action state. Publish state and acknowledge
success only on transaction completion, never on one request's success. Abort or
quota/open errors leave the prior committed run authoritative.

If the process stops around acknowledgement, reload the committed run and inspect
the stable input identity before any retry. A commit can have completed before
the UI saw success; this is not an additional action. No fallback to volatile
memory, localStorage, another run or an empty ledger is allowed for official writes.

These constraints implement DEC-013's chosen logical commit boundary. Platform
semantics are specified by the [IndexedDB transaction model](https://w3c.github.io/IndexedDB/#transaction-concept);
actual browser/Tauri behavior, unavailable APIs, blocked opens and abort paths
still need direct adapter and native tests. Completion is not a promise of survival
against disk failure, user clearing storage or unlimited quota.

## Old-slot association and legacy adoption

Associate a checkpoint using explicit run/attempt metadata plus verified payload
identity, not a seed or matching command list alone. The old incident slot can
change independently, so always verify actual bytes before using an association.
No transaction covers that slot, the M3 archive and the new ledger together.
Saving the old slot is a separate operation under DEC-007; a missing or stale
association must not be disguised as an exact-head resume.

DEC-012 permits a previewed and confirmed eligible unfinished checkpoint to seed
a new attempt. Its replay prefix and accumulated resources form the baseline;
new commands contribute only their new observations and incremental consequences.
Completed checkpoints are review, not completion grants. Exact-head resume does
not create another attempt. Neither flow rolls back campaign history.

DEC-011 adoption independently previews source-verified discovery membership for
a selected run. Verify all candidate source records before adoption and preserve
provenance; no silent partial import. A load or checkpoint start is not consent
to import artifacts. Stable operation identity and membership deduplication stop
repeat adoption from creating repeated awards. Do not run historic discovery
effects or import completion, Act state, ending flags or behavior counters.

## Verification handoff

TASK-019 verifies run/attempt ordering, duplicate versus conflicting input,
inherited-prefix isolation and deterministic projection. TASK-020 verifies strict
version rejection, round trips, revision races, abort after a successful request,
commit-before-ack reload, source changes, explicit import and preservation of old
bytes. TASK-024/025 verify actual browser/native capability and UI state published
only after commit; injected tests alone do not prove WebView support.

The detailed schema must be reviewed alongside the effect draft and pending model/ending
contracts before dependent implementation. Do not evaluate TASK-018 as complete
from this draft or from tests of the unchanged legacy adapters.

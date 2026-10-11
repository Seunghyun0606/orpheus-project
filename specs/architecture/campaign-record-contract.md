# Campaign record interfaces — TASK-018 review draft

This logical record/port contract implements no storage or migration. It refines
the [ledger draft](campaign-ledger-persistence.md) under DEC-009–015/025; field
spellings may be mapped to strict TypeScript/Zod interfaces without changing
identity, replay or commit semantics. Neither legacy envelope gains a field.

## Record and operation shapes

The new run record contains `schemaVersion`, opaque `runId`, committed `revision`,
explicit immutable definition references, ordered `operations`, attempt metadata,
source/import/checkpoint provenance and replay-verified derived projections/effect
receipts. Definition references separate campaign, scenario/content, replay rules,
behavior, prediction, condition and ending versions. No latest-version substitution
or new-ledger migration is implied. All metadata fields/variants validate strictly.

Operation records contain opaque `operationId`, `runId`, `sequence`, `kind`, recorded
definition references and the kind's complete payload. Sequence is a safe integer
beginning at zero for run creation, then increasing exactly one per committed
operation. It is not incident elapsed time, command/event sequence or import order.
Run creation expects no existing record and creates revision zero. Each subsequent
new operation requires the current revision and increments it once; duplicate
delivery does not increment revision. An accepted command and all its emitted
events/observations/effect receipts are one atomic operation, not extra player inputs.

| Kind                                           | Required provenance and payload                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create run                                     | Explicit run/operation IDs, definitions and validated authored initial state                                                                           |
| Start attempt                                  | New attempt ID, currently eligible scenario/version, seed and authored initial state                                                                   |
| Confirm checkpoint attempt                     | New attempt ID, selected run, verified source bytes/versions, confirmation and inherited command/event boundaries, restored RNG/resources/pending work |
| Accept command                                 | Explicit attempt/input ID, next local command boundary, command/target, prior verified head, and reproducible resulting state/events                   |
| Adopt discoveries                              | Explicit selected run/confirmation, all source-verified original records/bytes/versions, approved membership and provenance limits only                |
| Record opportunity preparation/acknowledgement | Explicit opportunity/result identity, actual presentation acknowledgement where applicable, definitions and causal pre-response context/boundary       |
| Associate old checkpoint                       | Explicit run/attempt/head association and verified actual slot bytes, independent of the slot write                                                    |
| Grant resolved ending                          | Explicit verified final run/attempt context, ending definition/result and transition identity; never a read-only evaluation                            |

Preparation, acknowledgement, association and adoption operations are not player
commands. Pending/failed operations are not committed observations. Each attempt
records its baseline, inherited boundaries, new accepted commands and verified head.
Do not flatten different attempts or invent identity from equal seed/command bytes.
Accepted input/event identities locate the source operation plus local sequence.
All attempts and baseline prefixes remain available for validation; counts/effects
only use the approved new-source boundaries.

## Canonical payload equality

A versioned canonical JSON representation compares validated operation payloads
and replay projections. It preserves array order, sorts object keys by ordinal
UTF-16 code-unit comparison (not locale-sensitive sorting), and uses standard
JSON string/finite-number encoding. Only JSON-compatible supported typed data is
accepted: no undefined, NaN/infinity, arbitrary class instances, executable values
or ambiguous coercion. IDs/strings are not trimmed or Unicode-normalized silently.
Canonicalization versions are explicit replay/identity references, not authentication.

Keep source bytes as their exact verified UTF-8 text rather than reserializing or
canonicalizing originals. Equality of old bytes does not establish campaign identity.
For an existing operation ID, compare the complete canonical payload and provenance;
matching delivery returns the committed receipt, different payload conflicts. A
checksum alone cannot authorize equality, a source import or checkpoint association.
Reject malformed/unsupported/conflicting records without publishing partial state.

## Checkpoint association and source confirmation

An association records run ID, attempt ID, exact attempt command/event head,
scenario/version/seed, original slot bytes and their verified decoded payload.
After an explicit DEC-007 slot save, read and validate the actual slot bytes before
recording association in the ledger. Association itself neither saves nor overwrites
the slot; no transaction spans them. A slot write followed by failed association
remains an unassociated save, not an acknowledged exact-head resume.

On resume, verify actual bytes, recorded association and the current associated
attempt head; equality of seed or replay bytes alone is insufficient. Other ledger
operations cannot roll back that attempt's accepted history. Changed/missing/stale
associations are diagnostics, not automatic new attempts or fallback. A separate
eligible older/unassociated unfinished checkpoint can still be previewed/confirmed
under DEC-012 as a new baseline, without counting its prefix or silently adopting
discoveries. Completed checkpoints remain read-only review.

Adoption/checkpoint confirmation retains the complete previewed source records and
observed bytes. Immediately before preparing the official operation, re-read and
validate the selected sources and reject changed or malformed candidates rather
than importing a silent subset. The ledger commits the confirmed verified snapshot,
not a claim that independently writable old keys remained unchanged afterward.
Preserve unknown lineage and source-vs-target migration provenance under DEC-011.

## Read/prepare/commit result interfaces

Read returns a verified committed record, not-found, or an explicit storage/schema/
content/replay diagnostic. Not-found is not corrupt; corrupt data is never replaced
with an empty run. Pure preparation accepts the verified prior run and one explicit
operation, returning a candidate or diagnostic without I/O or publication.

Commit takes run ID, expected revision (or explicit absent expectation for creation),
stable operation identity/full payload and validated candidate. In one IndexedDB
readwrite transaction, re-read authority, reconcile matching committed identity
before treating a lost acknowledgement as a stale new command, check revision,
then write complete history/projections/receipts/associations. Results distinguish
committed, duplicate, conflict and storage/validation diagnostic; committed/duplicate
include the verified current head and receipt. Acknowledge only transaction completion.

Abort/conflict retains prior committed state. There is no silent rebasing, volatile
success, old-store fallback or automatic deletion. Do not await unrelated I/O inside
the transaction. Physical names/layout remain the reviewed ledger draft's proposals;
no physical database is opened here. Actual capability and failure checks remain
TASK-020/024/025 obligations, not this documentation's pass evidence.

Required fixtures cover ordered variants, exact identity vs equal bytes, canonical
key-order/Unicode/array behavior, revision races/lost acknowledgements, source changes,
association-after-slot-write failure, stale heads, inherited-prefix isolation and
strict incompatible-version rejection. Production content/balance remains separate.

## TASK-024 new-only extension

DEC-033 approves the [v2 presentation candidate](campaign-presentation-v2.md) in
new campaign authorities only. The historical v1 contract above remains supported
without appended fields or replay reinterpretation. Native/adapter acceptance is
not implied by the new runtime candidate.

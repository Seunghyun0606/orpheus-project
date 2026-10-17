# Local storage, compatibility and support

TASK-034 source-based support draft. No user storage was read, repaired, copied,
deleted or migrated while writing this document. Native support and delivery
claims remain pending verification; no automated export/backup feature is promised.

## Independent authorities

| Authority                    | Current name                                                                | Preservation rule                                                                              |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Single MVP Incident slot     | localStorage `orpheus.incident.v1`                                          | Other-Incident overwrite requires the explicit UI confirmation; loading is not saving          |
| M3 discovery/archive records | localStorage `orpheus.campaign-progress.v1`                                 | Source-verified prior Incident records; not a formal campaign score ledger                     |
| Display preferences          | localStorage `orpheus.presentation.v1`                                      | Existing presentation settings; no TASK-033 migration/reset                                    |
| Audio preferences            | localStorage `orpheus.audio.v1`                                             | Strict schema 1, muted/volume; unsupported bytes preserved and memory-only error reporting     |
| Formal campaign runs         | IndexedDB `orpheus.campaign`, physical version 1, store `runs`, key `runId` | Whole replay-verified records and revision-checked transactional commits; no volatile fallback |

Physical database version 1 is not the logical record version. The new full
campaign pins record/replay v2 under exact definition `orpheus-full-campaign`
1.0.0; supported old v1 records are not automatically attached to it. No transaction
covers the old slot, M3 discoveries, preferences and campaign ledger together.
Browser origins, app/WebView profiles and isolated QA profiles are independent;
missing data in a different profile does not prove that the original was erased.

The current Full campaign UI explicitly inspects packages/runs, then creates an
empty identity or restores the recorded exact authority. A fixture definition,
seed match or latest version cannot substitute for a saved authority. Discovery
adoption/checkpoint ports require source verification and explicit confirmation;
their existence does not imply that every support/import flow is exposed by the
current UI. Historic completion, Act/behavior scores and ACKs are not imported as
new observations.

## Error handling

| Observed diagnostic                                             | Safe response                                                                                                                                | Do not do                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_BLOCKED`                                              | Close known duplicate instances using the same isolated app/profile; preserve data and retry when the block is resolved                      | Delete the database/profile or change DB version to bypass it                   |
| `INDEXEDDB_UNAVAILABLE`, `STORAGE_ERROR`, `TRANSACTION_ABORTED` | Preserve the last published committed state and exact pending identity; inspect capability/storage availability in an authorized environment | Display candidate success or switch the official run to memory/localStorage     |
| `UNSUPPORTED_DATABASE_LAYOUT` / `UNSUPPORTED_DATABASE_VERSION`  | Stop access and report app/config version and profile identity; obtain a reviewed compatibility plan                                         | Delete/recreate object stores or silently upgrade an unexpected layout          |
| `UNSUPPORTED_DEFINITION` or invalid replay/projection           | Preserve bytes and restore a compatible exact-authority application through an approved support plan                                         | Attach a new definition/model or edit scores/flags to make replay pass          |
| `COMMIT_ACK_UNKNOWN`                                            | In the same session use **Retry pending operation**, retaining the exact submitted identity; the transaction may already have committed      | Start another operation/run or treat absence of caller ACK as absence of commit |
| `REVISION_CONFLICT`, `CONFLICTING_OPERATION`                    | Explicitly reload the committed head using the available UI; choose a fresh action only after reconciliation                                 | Automatically rebase/reapply the failed action on another pre-action state      |
| Missing run/slot in an empty profile                            | Confirm selected app/profile/origin before explicitly creating anything                                                                      | Call a blank run a recovered save or overwrite the original profile             |
| Audio preference/output failure                                 | Keep silent visual gameplay, report unavailable/unsaved audio controls                                                                       | Claim a campaign save failed/succeeded because audio preferences changed        |

After a process restart, in-memory pending identities may no longer exist. Restore
and verify the committed run first and inspect recorded operations with authorized
support tooling; do not reconstruct an operation identity from the scenario seed
or repeat an uncertain action by guesswork. The ledger deduplicates exact matching
operations, not arbitrary repeats with newly generated IDs.

## Evidence before a repair or rollback

Record the exact app/binary hash, commit, configuration, OS/WebView version,
selected app/profile/origin, run/attempt identity, diagnostic, last known committed
revision, pending identity if still available, and what the user actually did.
Avoid copying full source baselines or player history into public issues; collect
only consented diagnostic data. No credentials, real company data or external
telemetry are required for this local fictional game.

Do not recommend clearing application data, deleting `%LOCALAPPDATA%`, removing
the repository, disabling Windows security, or resetting the old Incident slot.
Backup/export and destructive recovery need exact paths and separate authority.
The current app has no general backup/restore UI that this document can guarantee.
Local-first storage is not protection against user deletion, quota failure or disk
loss, and transaction completion is not a disk-survival guarantee.

A code rollback is not a save migration. An earlier binary may not know a newer
definition/record version. Keep a compatible current binary and preserve the
affected profile before any separately approved rollback. An installer upgrade
must be verified in an isolated profile before any production recommendation.

## Current operating limits

M1–M3 acceptance remains scoped to its original evidence. M4 TASK-024 native
restoration/response/archive/display checks and TASK-025 audit remain incomplete.
The 26-Incident full package and TASK-033 accessibility/audio are implementation
candidates, not verified release support. Current audio is muted by default and
requires explicit activation after entry/suspension; window hiding, archive entry
and exit stop output. Full gameplay does not require sound.

No Windows installer, cross-platform certification, signed release, automatic
updater, cloud synchronization or public support service is established here.
The delivery proposal is unapproved and must not be
used as an installation instruction. Final M4/M5 evidence and release gates remain.

_Links to process artifacts removed under DEC-070 were dropped; the originals remain at git tag `archive/pre-process-consolidation`._

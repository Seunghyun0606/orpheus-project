# TASK-027 — Production campaign composition proposal

Status: **Option A approved through DEC-040; implementation candidate under review**.
The proposal at `4760bfc` is the immutable approval checkpoint. The following
opening describes its pre-approval state, not a current prohibition on the approved
implementation. Native verification and production balance/content decisions remain
outstanding. See implementation.

Historical proposal context:
TASK-026 passed distinct independent evaluation and is complete through Project OS.
TASK-027 is active, but no runtime, authoring schema or user-store change has been
made by this proposal. DEC-038 approves content identities/reveal order, not the
concrete package/catalog/view representation described here.

## Existing boundary and why a decision is needed

`src/scenario/bundled-catalog.ts` eagerly loads every YAML under `data/incidents/`.
`AppShell` enumerates that catalog as the standalone MVP desk. Adding 23 later-Act
files there would expose them in that desk instead of following campaign gates.
`CampaignDesk` has opt-in actions/evidence/ACK/archive/query support, but not the
complete authored document, trace, deployment, infrastructure or Board views.
The standalone `App` also owns a different store interface and legacy save controls.

Propose a separate **immutable campaign package and presentation sidecars** that
compose existing engine definitions and projections. Do not extend existing save
or Scenario envelopes merely to hold desktop presentation. New Zod/YAML authoring
contracts and a normal-app opt-in route are material decisions, not implicit
consequences of blueprint/delegation approval.

## Proposed option A

### Entry and catalog separation

- Keep the current three-Incident MVP as the default entry and preserve its
  existing catalog/source bytes, save-slot confirmation, discovery record and
  UNKNOWN-only presentation.
- Add an explicit **Full campaign** route. Loading a production campaign package
  or opening its ledger happens only after that route is selected; startup/import
  or visiting the MVP must not create or open a new campaign database.
- Keep full-campaign-only content outside `src/scenario/data/incidents/`, proposed
  under `src/scenario/data/full-campaign/`. Package loading/validation has no
  storage I/O, automatic run creation, import or migration.
- The real 26-Incident package becomes startable only when all approved Incident,
  model, opportunity and required presentation authorities validate. While later
  tasks author missing content, show an explicit unavailable/in-development state;
  do not expose a placeholder campaign, hidden fallback, QA data or fabricated run.
- TASK-027 can build and independently exercise the composition boundary using
  isolated injected fixtures. That demonstrates the foundation, not implemented
  23 new production Incidents or final full-campaign/native acceptance.

### Exact package binding without a ledger migration

Propose `CampaignPackage` authoring schema version 1 with these explicit fields:

| Field                               | Meaning / validation boundary                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `schemaVersion`, `id`, `version`    | Strict authored package identity; reject unsupported schemas/duplicate identities         |
| `definitionId`, `definitionVersion` | Exact existing CampaignDefinition authority; one immutable package per definition/version |
| `scenarios`                         | Exact Scenario ID/content-version references; no latest selection                         |
| `presentations`                     | Exact presentation ID/version and associated Scenario ID/content version                  |

All referenced definitions/scenarios/models/presentations must validate before
run creation. Each actual production version and initial/model value must be
explicit authored data; this proposal selects no model defaults, thresholds,
ending priorities or new Incident content versions.

The package registry is immutable and keyed by exact definition identity/version.
It binds presentation versions to that same authority. A presentation change
requires a new package **and new campaign definition version**, never replacing
the renderer/content for an already pinned run. Reject duplicate package bindings,
unknown/absent authorities and conflicting content. Preserve older shipped bindings
as supported; unsupported old definitions diagnose without reattachment or rewriting.

No package field is inserted into existing run/save shapes. Retain Scenario schema
1, existing CampaignDefinition schema 1 semantics, v1 authorities and new-only
record/replay v2 rules under DEC-033. Physical IndexedDB stays `orpheus.campaign`
version 1, `runs`, `runId`; existing localStorage authorities/settings stay intact.

### Authored investigation presentation, not UI-owned story

Propose a separate presentation schema version 1 that pins `id`, `version`,
`scenarioId` and `contentVersion`, with nonempty validated `panels`:

- Each panel declares stable `id`, authored `title`, a typed kind (logs, metrics,
  diagnostics, status, documents, deployment, trace, infrastructure or War Room),
  explicit reveal conditions and referenced action IDs. No inferred visibility
  based on title keywords or a permissive missing-condition default.
- Content blocks are typed paragraphs, tables or revealed-signal references.
  Paragraph/table content is authored text, not HTML, scripts, React callbacks,
  executable SQL or external resource access. Signal blocks validate IDs and
  project only legitimately revealed incident values.
- Scenario visibility uses the existing validated ScenarioCondition family and
  pure `evaluateCondition`. Campaign visibility uses exact authored campaign
  references and existing strict condition evaluation; unavailable references
  diagnose even beneath otherwise decisive Boolean siblings.
- Optional evidence relationships reference declared campaign Evidence IDs and
  render only when both endpoints have been verified/collected. They grant no
  evidence, narrative flags or effects and show no story-completion percentage.
- Validate every ID/reference/type/row shape and package/version association.
  Render no hidden panel/body/action label before its gate. Keep raw hidden
  alignment/value/player-model statistics out of the player-facing desktop.

Panels are read-only projections of verified engine/campaign state. Clicking a
tab, opening a document, reviewing an archive or mounting a component is not an
accepted action, observation sample, presentation ACK or discovery grant. Actual
investigation actions use the same campaign command/transaction path and their
authored time/effects. No second standalone-store dispatch or legacy save write.

### Store, archive and guidance integration

- Separate shared presentation components from legacy command/storage ownership.
  The campaign caller supplies verified attempt/scenario projections and command
  callbacks; simulation/narrative resolution remains in pure TypeScript.
- Live commands go through `CampaignSessionState.performAction` and the existing
  revision-checked transaction. Retain commit-before-publish, pending identities,
  conflict diagnostics and explicit reload/retry; do not optimistically mutate UI.
- Retain actual visible guidance confirmation before eligible responses.
  Document/panel navigation or read-only archives never silently acknowledge a
  prediction/recommendation or manufacture deviation samples.
- Archive tools/postmortems use the selected verified attempt without changing
  the active attempt, selected live preparation, saved run, effects or behavior.
  Read-only ending queries remain queries; production ending grant/prose is TASK-032.
- Preserve `orpheus.presentation.v1` settings rather than creating a new settings
  authority or inserting preferences into campaign records.

### Explicit creation and restoration

Propose a read-only run-discovery port over the existing `runs` store and an
explicit new/restore selector, rather than a new localStorage pointer or automatic
last-run selection. No physical DB/index upgrade is proposed.

Read-only discovery may enumerate run IDs; selecting one must use the full existing
replay/version validator before a store is bound. Unsupported/malformed records
remain preserved and reported, never converted to an empty campaign. A new run
uses a platform-generated opaque ID, verifies absence first and commits only after
explicit creation. Handle storage unavailability with diagnostics, not volatile
fallback or replacement of previous records. No old discovery adoption is automatic.

## Verification and unchanged obligations

Required automated fixtures include strict package/sidecar validation, exact old/new
authority rejection, default-MVP isolation, unavailable/incomplete production data,
gated panel/body/action visibility, read-only archive isolation, pending/conflict/
abort/lost-ACK recovery, visible ACK before eligible response and duplicate identity
protection. Test-only models/data never become production balance.

TASK-027's required native restoration/display checks remain pending until separately
authorized execution. This proposal does not relocate, waive or PASS them. M4 native
debt, TASK-025 and TASK-035 final acceptance/release constraints also remain intact.
Build/code/injected fixtures do not certify actual user-store behavior or native UX.

## Decision boundary

Option A authorizes the separate opt-in catalog/package/presentation authoring and
integration boundaries above, including read-only run discovery over the unchanged
store. It does not approve actual production initial values/classifications, version
numbers, ending balance, narrative text or release. Subsequent material findings
still stop at their own gates. Option B retains the current code and requests a
revised representation/entry proposal before implementation.

_Links to process artifacts removed under DEC-070 were dropped; the originals remain at git tag `archive/pre-process-consolidation`._

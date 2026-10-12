# TASK-027 — Pinned campaign composition candidate

## Completed implementation, not task acceptance

DEC-040 approves Option A of the proposal frozen at `4760bfc`. The candidate
implements that boundary. TASK-027 remains active; required native restore/reload
and affected display checks have not run. M4/TASK-024/025 debt and final M5/release
gates remain mandatory. Complete production content belongs to TASK-028–032 and
is absent here; the normal full-campaign route is explicitly unavailable.

Default MVP data and legacy save/discovery/replay shapes remain unchanged. No
user database/profile, automatic import, destructive reset, push or release was
performed. Automated storage verification uses isolated fake IndexedDB only.

## Changed files and authoring

- `src/scenario/campaign-package.ts`: strict package schema 1, duplicate/reference/
  exact-version coverage validation and registry-owned immutable snapshots.
- `src/scenario/presentation.ts`: strict investigation sidecars, explicit Scenario
  and campaign reveal predicates, reference/type/table/duplicate validation.
- `src/scenario/full-campaign.ts`, `production-catalog.ts`, `cli.ts`: lazy production
  import, shared pure category validation and no fallback to QA fixtures. The
  `data/full-campaign-manifest.yaml` contains approved ID/title/Act metadata only,
  not implemented Incident content or selected production model/balance values.
- `src/engine/campaign/investigation.ts`: replay-equality-verified read-only
  panels, revealed signals, collected evidence edges and operational postmortem.
- `src/app/AppShell.tsx`, `FullCampaignEntry.tsx`, `CampaignDesk.tsx`,
  `CampaignTools.tsx`, `src/ui/base.css`: opt-in entry, explicit create/restore,
  escaped typed tools, archive isolation and existing presentation preferences.
- `src/persistence/campaign-ledger.ts`: read-only run-ID discovery over the
  unchanged `orpheus.campaign` / DB 1 / `runs` / `runId` layout.
- `src/tests/campaign-composition.test.tsx`, `fixtures/composition.ts`: injected
  non-production composition, parser, storage and ACK/response fixtures.

Package schema 1 declares `id`, `version`, `definitionId`, `definitionVersion`,
nonempty `scenarios` (`scenarioId`, `contentVersion`) and `presentations` (`id`,
`version`, `scenarioId`, `contentVersion`). Coverage must match every allowed
Scenario version of the exact campaign definition, including compatible history.
No latest-definition or latest-view lookup is supported. A presentation change
requires a new package **and campaign definition version**, not replacement of a
shipped binding. Restore requires the exact retained package or reports unsupported
authority without rewriting the run.

Presentation schema 1 declares identity/version/Scenario binding, nonempty `panels`
and explicit `evidenceRelations` (an empty list is allowed). Every panel declares
`id`, `title`, `kind`, nonempty `reveal`, `campaignReveal`, `actionIds` and nonempty
`blocks`. Kinds cover logs, metrics, diagnostics, status, documents, deployment,
trace, infrastructure and War Room. Blocks are paragraphs (`text`), tables
(`columns`, equal-width `rows`) or signals (`signalIds`). Strings are literal text,
not HTML or executable commands. Undiscovered signal values and gated panels/body/
action labels are not rendered. Relations display only verified collected endpoints.

Production sources live separately under `src/scenario/data/full-campaign/` in
`incidents`, `definitions`, `packages`, `presentations` directories. The complete
loader additionally requires all approved 26 identities/titles/Acts, nine Acts,
v2 replay and explicit behavior/prediction/opportunity/ending definitions. It
selects no production defaults. Missing/partial data cannot create an official
campaign. Default `validate:scenarios` dispatches categories rather than treating
the manifest or sidecars as Incident YAML; unknown categories fail. Explicit CLI
paths retain the existing Scenario-only validation semantics.

## Persistence and screen semantics

Mounting the default desk neither loads full content nor opens the ledger. Package
inspection is explicit and loader validation itself has no storage I/O. Discovery
enumerates keys in a read-only transaction; restore replay-validates the selected
record. Malformed/unsupported data remain preserved and diagnostic, never zero or
an empty new campaign. New creation checks absence before and after store loading;
the revision-checked transaction protects later concurrent collisions.

All commands, actual visible guidance ACK and eligible responses retain the existing
atomic campaign path. No optimistic domain mutation or second Incident dispatch is
added. Failed creation keeps its pending store/operation identity; back navigation
is disabled while that identity is pending. Retrying reconciles the same operation.
Known conflicts still require explicit reload rather than silent rebasing.

Archive/projection navigation generates no input, discovery, effect, response or
ACK. React best-practices review guided conditional module loading and derived,
memoized read-only views rather than effect-driven state/ACK mutation. Headless
tests are not evidence of actual native visibility or accessibility.

## Tests and retained failures

- Root initial full regression: 30 files, 420 tests passed; typecheck/lint passed.
- Initial focused composition test: 9/10 passed. One test activated investigation
  before the preceding asynchronous commit completed. The test now waits for durable
  completion/button availability; no product timeout or acceptance was relaxed.
- Corrected initial focus: 10/10 passed; expanded focus: 14/14 then 16/16 passed.
- Independent initial QA: 96 tests across eight files passed; typecheck/lint/
  formatting/replays/web build passed, but `validate:scenarios` failed because
  the manifest was misclassified as Scenario. Pure category dispatch repaired
  this failure; root rerun passed nine files with explicit production-unavailable
  notice. Independent post-repair outcomes are recorded separately.
- Independent initial review: two P2 findings (duplicate signal IDs and creation
  collision between reads). Both repaired with focused regressions. Original
  failure verdict is retained; final re-review is separate evidence.
- Coverage added: strict schemas/keys/references, missing/incomplete/unknown-source
  production rejection, manifest uniqueness, immutable ownership, strict missing
  observation diagnostics, escaped markup, malformed-run preservation, read-only
  archive and storage discovery, explicit ACK→atomic response, creation collision,
  abort retry identity. Existing ledger/session suites cover conflict and actual
  lost caller ACK; the composition abort case is not mislabeled as lost ACK.

## Known risks, remaining work and next step

Native restore/reload/display, keyboard and text-scale observations are pending.
The full 26-Incident authority and shipping ending presentation are not implemented.
Web build currently reports a large initial chunk; no unapproved performance budget
or packaging target was chosen. The exact-version registry returns defensive copies;
full-campaign performance will need measured TASK-034 evidence.

Preserve independent handoffs and obtain a distinct evaluation of this bounded
candidate. TASK-027 cannot be marked overall PASS or silently release TASK-028's
dependency on the basis of automated fixtures. A human must choose separately
authorized native verification or an explicit verification-scheduling/dependency
exception; neither option waives final M4/M5 verification or release gates.

# TASK-032 — Read-only ending presentation checkpoint

DEC-058 records option A approval of the exact proposal at `3429882`. This
2026-10-14 checkpoint implements the presentation contract, not full-campaign
acceptance or a playable complete package.

## Completed

- Added a strict separate EndingPresentation schema with exact campaign, ending
  and prose identities; ten entry coverage, unique IDs, typed blocks and explicit
  reveal references. Spaces in the existing THE BOARD/THE FIRE/STATUS QUO ending
  identities remain valid; block/package IDs keep their existing stricter grammar.
- Added an optional exact package `endingPresentation` binding and input registry.
  Old generic package objects retain their original shape without the field.
  New production admission requires it, a valid prose authority and all ten ending
  IDs from the data manifest. No Scenario, save or ledger shape/migration changes.
- Authored ten source-based prose entries, policy/dialogue blocks, the shared final
  question and guarded title payoff/PROMETHEUS under `ending-presentations/`.
  PROMETHEUS requires a genuinely known PROJECT_DISTRIBUTED flag and exactly
  LIBERATION, WHISTLEBLOWER, SHUTDOWN, CUSTODIAN, NULL or REWRITE.
- Added the pure `projectCampaignEnding` query. It resolves the exact final
  attempt/head from verified whole-record replay; no caller-supplied winner or
  edited score/flag projection is accepted. Ties/no-match/diagnostics select no prose.
  Conditional bodies are omitted before rendering, not merely hidden with CSS.
- Added explicit desk query and rendering. Actual final service signals/resources,
  elapsed time and separate completion/recovery outcomes remain beside prose.
  Future institutional reports, including 98.4% and 1,841,299/3, are labeled authored
  fiction rather than player metrics. APPROVE ALL is text, never an action button.
- A reload, durable operation or archive switch invalidates displayed query state;
  stale winners do not persist. Mounting, querying and remounting generate no command,
  ACK, discovery, effect, ending flag or ledger write.

## Changed files

The contract lives in `src/scenario/ending-presentation.ts`; exact package/production
admission is in `campaign-package.ts`, `production-catalog.ts` and the full manifest.
The engine query is `src/engine/campaign/ending-presentation.ts`; rendering is
`src/app/CampaignEnding.tsx` and `CampaignDesk.tsx`, with a small text-wrapping style.
The exact new-only sidecar is
`src/scenario/data/full-campaign/ending-presentations/endings.yaml`. Planning bindings
add its known-discovery parent reference and package identity only to the future
complete new definition/package. No partial runtime authority was registered.

The offline authoring function preserves the historical approved draft/proposal
bytes. Those drafts used YAML's reserved unquoted NULL token for the named ending
and character. The authoring conversion emits the intended **string** NULL identity
and dialogue speaker; runtime schemas never coerce null/malformed identities.

React skill guidance influenced implementation: queries remain explicit interactions,
visibility is derived from current immutable run/request state without synchronization
effects, expensive replay projection is memoized, and tables/headings/status/alert
semantics remain keyboard-accessible. This is implementation guidance, not a review
or accessibility/native QA PASS.

## Tests

Tests were **authored but not run** at the user's request. They cover reproducible
source conversion, strict block/identity/coverage validation, old package isolation,
six eligible/four ineligible epilogues, known/unknown and forged discoveries, genuine
fixture replay, stale heads, incomplete finals, no-match/ties, preserved final
consequences, read-only rendering and keyboard query/reload invalidation.
Fixtures deliberately use isolated ending rules; they do not prove production
thresholds or 26-Incident reachability. No validator, test, typecheck, lint, build,
independent review/QA, evaluator or native QA ran. Only mechanical formatting ran.

## Known risks / remaining work

The complete production definition, progression and package still need composition.
All 26 Incident/sidecar pairs and ending data existing in files does not make them a
playable campaign. Source binding, long-run restoration, all ten reachable endings,
performance/accessibility/native checks and independent acceptance remain unverified.
TASK-027–032 and mandatory M4/M5 final acceptance obligations are unchanged; do not
mark a task complete or release content from this checkpoint.

## Next recommended step

Confirm exact main progression: sequential operational completion gates, monotonic
Act advancement and retained replay access, without mandatory optional discoveries
or unavailable behavior metrics. Then compose only the exact approved new authorities
into the complete package; preserve the default MVP and old stores/authorities.
This progression/runtime-enable decision is a separate Human Gate, not an implicit
consequence of approving ending prose. QA remains deferred, not waived.

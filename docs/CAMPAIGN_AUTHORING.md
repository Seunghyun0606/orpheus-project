# Full-campaign authoring guide

Status: source-based TASK-034 documentation candidate, 2026-10-14. Commands and
examples below have **not been executed for this candidate**. Read the current
Project OS state and decisions before editing; earlier document checkpoints may
describe a historical, unregistered candidate.

## Authorities and source locations

| Source                            | Location                                                                                          | Responsibility                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Approved content/reveal inventory | `src/scenario/data/full-campaign-manifest.yaml` and `specs/product/02-full-campaign-blueprint.md` | 26 Incident identities, nine Acts, pacing and reveal boundaries                                                    |
| Scenario                          | `src/scenario/data/full-campaign/incidents/inc-NNN.yaml`                                          | Services, signals, resources, accepted actions, time, effects, narrative, evidence and completion                  |
| Investigation presentation        | `src/scenario/data/full-campaign/presentations/inc-NNN.yaml`                                      | Authored tool blocks, reveal gates and available action references                                                 |
| Campaign definition               | `src/scenario/data/full-campaign/definitions/campaign.yaml`                                       | Exact Scenario bindings, progression, models, opportunities, action gates, effects, branches and ending conditions |
| Package                           | `src/scenario/data/full-campaign/packages/campaign.yaml`                                          | Exact definition, Scenario, investigation and ending-prose version binding                                         |
| Ending presentation               | `src/scenario/data/full-campaign/ending-presentations/endings.yaml`                               | Typed prose and conditional title/epilogue sections, not ending selection                                          |
| Historical fragments              | `.project-os/planning/`                                                                           | Approved authoring inputs and frozen proposals, not automatically registered runtime authorities                   |

The explicit Full campaign route lazy-loads all registered sources through
`src/scenario/full-campaign.ts`; `production-catalog.ts` admits only the complete
approved inventory. Missing, conflicting, unknown or invalid sources produce
diagnostics, not a fixture, partial package or latest-version fallback. The default
three-Incident MVP remains a separate catalog and UNKNOWN-only experience.

## Safe editing sequence

1. Read the assigned task, acceptance criteria and active decisions. New schema,
   reveal order, numerical balance, shared effects or compatibility policy require
   the applicable human gate before implementation.
2. Identify every affected version: Scenario content, investigation presentation,
   campaign definition, behavior/prediction/opportunity/ending model, ending prose
   and package. Record both the old authority and proposed new binding.
3. Preserve issued exact-version authorities. Do not edit an old definition and
   attach new models to its saved runs. The current unreleased 1.0.0 package has
   approved pre-release authoring changes; that is not a universal permission to
   overwrite versions once runs/distribution rely on them. A new version must also
   be registered in a reviewed exact-version catalog; merely duplicating a file in
   the strict production folder can fail its approved inventory checks.
4. Author operational causality first. Use stable IDs and explicit duration,
   requirements, costs, delayed/temporary effects and observable consequences.
   Mitigation need not resolve the root cause; no correct/incorrect badge.
5. Author revelations as effects and declared conditions. Preserve signal/evidence
   availability and separate local Scenario conditions from campaign references.
   A previous-Incident clue needs the approved campaign action gate, not a React
   special case or a pre-populated discovery flag.
6. Update exact presentation bindings. Tables require rows of the same width as
   columns; signals/actions must exist in the bound Scenario. React renders blocks
   and projected availability; it must not own story or simulation logic.
7. Bind genuine accepted-event/ACK-response effects. Once-per-run effect identity
   must remain shared across explicitly approved compatible versions. Retry
   history is retained; repeat discovery is not another numeric award.
8. Add deterministic positive and negative replay fixtures and declared version
   reproducibility coverage. Full-campaign routes must use actual operations and
   observations, not caller-edited scores, completion flags or fabricated ACKs.
9. When QA is authorized, run the full validation/regression commands below and
   preserve their actual output. Obtain independent review/QA and distinct Project
   OS evaluation. Authored files or unexecuted tests do not complete a task.

## Concrete reference example

This is an excerpt of INC-025's existing investigation presentation, not a new
complete file and not permission to change its rules:

```yaml
schemaVersion: 1
id: INC-025-INVESTIGATION
version: 1.0.0
scenarioId: INC-025
contentVersion: 1.0.0
# Within an authored panel:
campaignReveal:
  type: compare
  reference: CURRENT_ACT
  operator: gte
  expected: 9
```

Read the whole source and `src/scenario/presentation.ts` before copying it. Each
panel also needs local `reveal`, `kind`, `actionIds` and typed `blocks`. A campaign
comparison uses `reference`/`expected`; local Scenario conditions use their own
resource/signal/evidence fields and `value`. Do not mix the two grammars.

`scripts/authoring/full-campaign.mjs` exports `authorFullCampaign(readPlanning,
readContent, manifest)`. It accepts caller-provided parsed data and performs no
file I/O or validation. It is **not** a runnable generator CLI. Its associated
tests document approved composition reproducibility; do not invent an npm command
or regenerate the giant definition to repair unrelated formatting. Preserve the
earlier `.project-os/planning/M5/composition/` checkpoint as historical evidence.

## Progression, behavior and ending constraints

- Main access is sequential operational completion; optional clues are not required
  for every Act. `replayAccess: completed_prior_acts` is explicit and new-only.
  Earlier-Act retries require genuine prior completion outside inherited baselines,
  retain the current Act and do not reset earlier costs, observations or receipts.
- Prediction is an empirical frequency model. Preparation, display ACK and the
  next eligible response are distinct. Archive/reload/navigation is not exposure;
  unavailable samples remain unavailable, never zero or invented confidence.
- The approved restart/rollback denominator contains operational actions; direct
  investigation in the current attempt supports evidence-before-action. Repeated
  inspection of the same item does not inflate investigation depth.
- Current ending inputs exclude optional opportunity ratios as required inputs;
  the authoritative conditions use accumulated values/discoveries and supported
  operational observations plus a genuine final context. Equal priority, tie,
  no-match and invalid/unavailable diagnostics never imply an automatic ending.
- BLACKOUT decision completion is not necessarily service recovery. Render actual
  final signals/resources separately from authored future institutional prose.
  Endings have no good/bad/true labels. PROMETHEUS is a conditional discovery, not
  a mandatory post-credit reveal.
- Preserve the Board interval and responsibility, NULL's fallibility and all
  required reveal prerequisites. The player investigates the story; a content
  count or cutscene cannot establish that the investigation route is reachable.

## Verification commands (deferred, not run here)

From the repository root, after installing the lockfile-pinned toolchain:

```powershell
npm run validate:scenarios
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:replays
npm test -- scripts/authoring/full-campaign.test.mjs scripts/authoring/task032-balance.test.mjs scripts/authoring/task032-presentations.test.mjs
npm run build
npm run build:desktop
```

The default validator checks the current MVP, frozen legacy catalogs, full manifest
and complete production package categories. Passing explicit paths narrows it to
a Scenario catalog; that is not complete-campaign validation. `test:replays`
covers INC-001 only; retain the full suite and full-campaign runtime/balance/reveal
coverage. `build:desktop` produces a no-bundle binary, not an installer. Successful
commands alone do not certify native accessibility/audio, all ending routes or
release readiness. See [support](LOCAL_STORAGE_AND_SUPPORT.md) and the
[delivery proposal](TASK-034_DELIVERY_PROPOSAL.md).

# Save compatibility across content changes — 2026-10-26

Brief: `docs/codex/2026-10-26-save-compat.md`. Branch: `codex/save-compat`. Base commit: `3da66169639e91cb90643776d7e502af595e1e4e`. Role: Codex, scoped tests and proposal. Product policy remains Claude's decision.

## Scope and result

Added `godot/tests/save_compat.gd` and two lines in `scripts/story/godot.mjs` so `npm run godot:saves` runs it after the existing recovery suite. No `godot/scripts/`, source story, committed exported data, or canonical Project OS state changed. Changes are uncommitted; nothing was pushed or published.

The new suite characterizes **18 cases with 718 assertions**. These assertions intentionally describe today's behavior, including defects; passing them does **not** mean the proposed compatibility policy is implemented. The existing recovery suite also passes **13 assertions**.

There was no process crash or GDScript error in the final run. Rejected inputs generally recover a playable current prefix, but the same operation truncates finished records. Accepted inputs can silently change the player's history, deduction outcome, values, or flags. `after` retains the old outcome, so a record can contradict the carry actually used by the next incident. An unresolved scene link is especially hazardous: the real UI marks that incident finished. Inserting an incident can lock an existing current run or an already finished record.

## Method and isolation

`_fixture()` constructs a small episode in memory: `intro → route → infer → decide → close → END`, with three evidence items, a two-attempt deduction, a 30-second decision, numeric effects, and an `OLD` flag. The original full input log is:

```json
[
  { "type": "continue" },
  { "type": "choose", "optionId": "KEEP" },
  { "type": "deduce", "picks": ["A", "B"] },
  { "type": "choose", "optionId": "ACT" },
  { "type": "continue" }
]
```

`_probe()` independently constructs and saves an unfinished run (normally the first four inputs, at `close`) and a genuinely finished run via `Progress.begin`, `log_input`, and `finish`. It loads both with `save_progress`/`load_progress`, replays the mutated fixture with the real `Progress` and `StoryRunner`, checks a second current resume, and round-trips any record truncation. It also starts real `INC-002` data using `carry_for` and checks that its entry values, alignment, and flags equal the original finished outcome. Where a current checkpoint differs, the case states it explicitly. Counts include repeated setup and invariant assertions; they are not 718 distinct update combinations.

All runtime execution uses `.qa/verification/saves-run/godot` with application name `Orpheus Verification saves-run`. The helper removes custom-user-directory settings from the copy. The test refuses execution unless both its project path and application-name prefix match the saves helper. The only data-file mutation is the campaign-order fixture's index inside that QA copy; it restores the exact original contents and asserts restoration. No source `godot/data` mutation is used to construct episode cases. Test campaign files, backups, and temporary save are deleted at completion. Main-scene UI checks use `reviewing = true`; any initial UI loads still use the isolated QA user directory.

SC-04's deliberately stale choice reference and SC-07's dangling link are defensive runtime probes of invalid content. `src/story/validate.ts:96` and `src/story/validate.ts:109` already diagnose these reference errors. They are not evidence that the normal story-validation gate accepts those edits. The remaining scenarios exercise replay compatibility separately from authoring validation; no real campaign save was used.

## Cases and findings

Reproduce every case with `npm.cmd run godot:saves -- --verbose` on Windows, or `npm run godot:saves -- --verbose` elsewhere, with a Godot binary available to the helper. Each `SC-xx` label is printed by the test. Test anchors below are in `godot/tests/save_compat.gd` and name the function plus the case's mutation; the corresponding SC label locates the exact assertions.

For SC-01–SC-16 and SC-18, the common `after` result is: the old finished carry remains byte-for-value equivalent after load/normalization, the finished marker survives, and the next incident starts with the old values/alignment/flags. Record replay never reconciles that carry. “Expected” below is the proposed player-safe behavior, not a previously approved product requirement. Claude's decision is recorded under each case. Compatible controls are explicitly marked as such.

### SC-01 — Remove an option

- **Severity:** P2. **Location:** `godot/scripts/story/progress.gd:146`, `godot/scripts/ui/main.gd:298`.
- **Test/steps:** `_options()`, remove `route.KEEP`, then `_probe()`; `_ui_consequences()` opens the resulting finished record with `_show_record`.
- **Expected:** Resume current at a disclosed recovery point; retain the historical finished record.
- **Actual:** Both runs stop at `route` with one retained input. Current can select `OTHER`, and that replacement survives another replay. Finished record also loses its suffix; saving persists the truncation. The real record screen shows a summary and next/back actions, with no way to make the missing historical choice.
- **Suggestion:** Permit current-prefix recovery with a notice; replay records without mutation and use historical snapshots.
- **Claude decision:** **accepted**, with restart instead of prefix recovery. The run keeps its episode's `contentVersion`; on a changed episode with no declared migration the current run starts the incident again from its entry carry and `Progress.take_notice` returns `restarted`. Replaying old inputs into changed content is what misplaces choices (SC-06) and rescores outcomes (SC-11), so the incident's entry is the only safe checkpoint. Records are replayed read-only and never truncated; `Progress.check` reports `changed`. Test: `_options()`.

### SC-02 — Rename an option

- **Severity:** P2. **Location:** `godot/scripts/story/progress.gd:150`, `godot/scripts/story/story_runner.gd:142`.
- **Test/steps:** `_options()`, rename `KEEP` to `RENAMED`, keeping its meaning/effects, then `_probe()`.
- **Expected:** An explicit rename map preserves the choice and record.
- **Actual:** Identical to removal: both logs truncate to one input, despite a semantically equivalent replacement. Choosing `RENAMED` resumes current safely.
- **Suggestion:** Versioned, scene-scoped option maps for true renames; otherwise use SC-01 recovery.
- **Claude decision:** **accepted**. `Progress.MIGRATIONS` maps option IDs per (current) scene from one content version to the next; the run is carried over only if every input then replays, and the record replays through the same map. Without a declared migration, the SC-01 rule applies. Test: `_options()`.

### SC-03 — Remove a scene and repair incoming links

- **Severity:** P2. **Location:** `godot/scripts/story/progress.gd:150`, `godot/scripts/story/story_runner.gd:147`.
- **Test/steps:** `_scenes()`, remove `route`, relink `intro.next` to `infer`, then `_probe()`.
- **Expected:** An explicit migration or recovery decision, with historical record preserved.
- **Actual:** The saved choice meets a deduction, so both runs stop at `infer` with one input. Current has a real scene to continue; finished history is truncated and shown as a summary.
- **Suggestion:** Remove the obsolete input only through a reviewed migration; disclose any lost effects or require restart from an approved checkpoint.
- **Claude decision:** **accepted**: restart (SC-01 rule). A migration that drops an input is **deferred** until a released change needs one.

### SC-04 — Rename a scene

- **Severity:** No finding for a fully repaired rename; **P2** for the deliberately stale reference subcase. **Location:** `godot/scripts/story/story_runner.gd:81`, `godot/scripts/story/progress.gd:146`.
- **Test/steps:** `_scenes()`, rename `route` to `route-v2`, repair the incoming link and `chose` reference, then `_probe()`; repeat with the old `route.KEEP` condition left behind.
- **Expected:** A pure rename preserves outcomes and text; invalid references fail authoring validation.
- **Actual:** Fully repaired rename is compatible: current reaches `close`, record reaches END, and values are unchanged. History now uses `route-v2`. With the stale condition, replay accepts every input but silently omits “Route recognized.” Current logs do not contain scene IDs, so they do not require a scene rename map today.
- **Suggestion:** Keep the existing reference-validation gate. Future scene-aware input logs need a scene map for pure renames. Treat the stale-reference observation as defense in depth, not a validation-gate failure.
- **Claude decision:** **accepted**. Inputs name no scene, so a pure rename needs only a declared-compatible migration (an entry with no maps); without one it restarts. The stale-reference subcase stays with the validator (`src/story/validate.ts`); no runtime change. Test: `_scenes()`.

### SC-05 — Insert a briefing scene

- **Severity:** P2. **Location:** `godot/scripts/story/progress.gd:150`, `godot/scripts/story/story_runner.gd:132`.
- **Test/steps:** `_scenes()`, insert a briefing between `intro` and `route`, then `_probe()`.
- **Expected:** Explicit checkpoint migration/recovery; preserve the completed transcript.
- **Actual:** The old choice cannot continue the new briefing. Both logs truncate to one input at the insertion; current can continue normally, but the finished record is reduced to the opening.
- **Suggestion:** Stop at the insertion and ask the current player to continue; never truncate finished history. Auto-inserting a `continue` needs a reviewed migration because briefing effects may have changed.
- **Claude decision:** **accepted**: restart (SC-01 rule); no automatic `continue` is inserted.

### SC-06 — Insert a choice that accepts the old option ID

- **Severity:** P2. **Location:** `godot/scripts/story/progress.gd:111`, `godot/scripts/story/story_runner.gd:142`.
- **Test/steps:** `_scenes()`, insert a choice before `route`, reuse option ID `KEEP`, give it evidence +50, and then `_probe()`.
- **Expected:** Detect that the input belongs to a different scene before applying it.
- **Actual:** Both replays silently apply the player's old `route.KEEP` input to the inserted scene. The subsequent deduction then fails at the original route. Both logs retain two inputs, current contains `choices = {inserted: KEEP}`, and evidence is 50 instead of the original 2. Stopping on the later error does not undo the misapplied choice.
- **Suggestion:** Store/verify the originating scene on every input, plus a content version for legacy logs. Refuse cross-scene replay until explicitly migrated.
- **Claude decision:** **accepted** through the content version: changed content never takes old inputs best-effort, so an input cannot reach another scene. Per-input `sceneId` is **rejected** as unnecessary: same-version inputs cannot move between scenes, and migrations are reviewed. Test: `_scenes()`.

### SC-07 — Remove a scene without repairing its incoming link

- **Severity:** P1, defensive invalid-content case. **Location:** `godot/scripts/story/story_runner.gd:216`, `godot/scripts/ui/main.gd:715`, `godot/scripts/ui/main.gd:874`.
- **Test/steps:** `_scenes()`, remove `route` but keep `intro.next = route`; `_ui_consequences()` mounts the recovered current state in the actual UI.
- **Expected:** Report an incompatible/missing scene and retain current progress for recovery; only explicit END completes an incident.
- **Actual:** Replay stops with non-null `sceneId = route`, one input, and an empty `current_scene`. The UI treats that empty scene as completion, calls `Progress.finish`, clears current, archives the truncated log, and shows a summary. Finished record replay also returns the missing scene; old `after` remains intact until the current path is falsely completed.
- **Suggestion:** Distinguish END from unresolved scene IDs before summary/finish. Keep the existing authoring reference gate; add a runtime invalid-content result rather than relying on an empty dictionary.
- **Claude decision:** **accepted**, data side. Replay stops before an input that leads to a scene the episode lacks (notice `stopped` for the current run), and `Progress.finish` refuses a state that has not reached END, so the run stays in progress. UI part (main.gd, not in this change): show a content error instead of the summary when `sceneId` is set but the scene is missing. The validator remains the gate. Tests: `_scenes()`, `_ui_consequences()`.

### SC-08 — Timed choice becomes plain; saved input was a timeout

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:137`, `godot/scripts/story/progress.gd:150`.
- **Test/steps:** `_timers()`, replace the original decision input with `timeout`, remove the updated scene's timer, then `_probe()`.
- **Expected:** Preserve the historical default outcome through an explicit migration or offer current recovery.
- **Actual:** Both replays stop at `decide`, retain three inputs, and discard the timeout and suffix. Current can make a plain choice. Finished record no longer contains its original timed outcome.
- **Suggestion:** Migrate a historical timeout to its **old** default option only when equivalent; store resolved timeout option and timeout status for future saves. Otherwise ask about current recovery and keep the finished snapshot.
- **Claude decision:** **accepted**: restart (SC-01 rule). A migration that cannot replay the timeout also restarts (tested). Storing the resolved timeout option is **deferred** until a migration needs it.

### SC-09 — Timed choice becomes plain; input was explicit or decision was pending

- **Severity:** No player-visible failure in this case; compatible control. **Location:** `godot/scripts/story/progress.gd:146`, `godot/scripts/ui/main.gd:724`.
- **Test/steps:** `_timers()`, remove the timer, replay the ordinary log, then repeat with a three-input current checkpoint and saved seven seconds; `_ui_consequences()` renders that pending decision.
- **Expected:** Keep the explicit choice; pending choice is untimed.
- **Actual:** Explicit choices replay to the original endpoints. Pending current remains at `decide`. `Progress.replay` leaves stale timer metadata on the run, but the actual UI has no timer bar and a negative `timer_left`. No observed gameplay penalty.
- **Suggestion:** Drop obsolete timer metadata during version migration; no restart needed for this exact change if option meanings/effects are unchanged.
- **Claude decision:** **accepted**, conservatively: without a migration the run restarts; a declared-compatible migration keeps explicit choices. Time left is dropped whenever the resumed scene has no timer. Test: `_timers()`.

### SC-10 — Plain choice becomes timed

- **Severity:** P2 for an undisclosed deadline on an existing pending run; completed explicit choices are compatible. **Location:** `godot/scripts/ui/main.gd:724`, `godot/scripts/story/progress.gd:146`.
- **Test/steps:** `_timers()` plays a timer-free original fixture to `decide`, serializes that current without timer metadata, then replays the timed version. The ordinary completed log is also replayed; `_ui_consequences()` renders a pending run without timer metadata.
- **Expected:** Preserve completed decisions; obtain a current-run policy decision before adding a deadline the player did not leave with.
- **Actual:** Replay detects no mismatch, and completed explicit choices still end normally. A pending decision displays a new full 30-second clock in the actual UI.
- **Suggestion:** Grandfather that pending scene as untimed, or offer a disclosed fresh timer/restart. Bind timer metadata to scene ID and content version, not only input count.
- **Claude decision:** **accepted**: restart, so no deadline appears mid-decision. Under a declared-compatible migration a pending decision gets a fresh full clock, which is acceptable as a disclosed fresh timer.

### SC-11 — Same-size deduction solution changes, with retries remaining

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:196`, `godot/scripts/story/progress.gd:150`.
- **Test/steps:** `_deductions()`, change solution `[A, B]` to `[A, C]`, retain two attempts, then `_probe()` with four and three current inputs.
- **Expected:** Preserve the old result, or disclose that the deduction requires a new attempt without rewriting finished history.
- **Actual:** The formerly correct picks become an accepted failed first attempt. The later choice is rejected, so both ordinary logs retain three inputs and stop at `infer` with one attempt used and no curiosity reward. If current ends at the deduction input, no input error occurs at all; its old pending-decision timer metadata even remains. The feed now reports `correct: false`.
- **Suggestion:** Treat solution/attempt changes as semantic incompatibilities. Never infer compatibility merely from successful `apply_input`; ask current players to redo from a safe checkpoint or use an explicitly reviewed migration.
- **Claude decision:** **accepted**: semantic change, restart (SC-01 rule). Rescored picks are never committed; the record is flagged `changed` and `after` keeps the played outcome. Test: `_deductions()`.

### SC-12 — Same-size solution changes and only one attempt remains

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:210`, `godot/scripts/story/progress.gd:146`.
- **Test/steps:** `_deductions()`, use `[A, C]` and one attempt in the updated episode, then `_probe()`.
- **Expected:** No silent change to a previously successful deduction or finished outcome.
- **Actual:** Every record input is accepted, record reaches END with `solved.infer = false`, and collateral damage becomes 5. No truncation or recovery warning identifies the changed outcome; `after` still reflects the old success.
- **Suggestion:** Version deduction semantics; snapshots preserve completed outcomes. Restart/retry current only with the player's explicit choice.
- **Claude decision:** **accepted**, as SC-11. The best-effort record would say "missed"; it is flagged `changed`, and the UI is to show `after` numbers for such a record (UI change, not in this change).

### SC-13 — Deduction solution changes cardinality

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:194`, `godot/scripts/story/progress.gd:150`.
- **Test/steps:** `_deductions()`, change solution to `[A]`, then `_probe()`.
- **Expected:** Disclosed current recovery; completed outcome retained.
- **Actual:** Old two-item picks are rejected; both logs retain two inputs at `infer`. This is a playable current checkpoint but an incomplete finished record.
- **Suggestion:** Use the same semantic-version policy as SC-11/12, even though this variant happens to produce an input error.
- **Claude decision:** **accepted**, as SC-11.

### SC-14 — Rename an evidence ID

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:189`, `godot/scripts/story/progress.gd:150`.
- **Test/steps:** `_deductions()`, rename `A` to `A_V2` in evidence, collection beats, and solution, then `_probe()`.
- **Expected:** A pure evidence rename preserves the player's deduction using a reviewed map.
- **Actual:** Board collects `[A_V2, B, C]`; saved picks still cite uncollected `A`. Both logs truncate to two inputs at `infer`. Current can submit `[A_V2, B]` successfully. Evidence is episode-local, so the historical `after` carry is unaffected.
- **Suggestion:** Migrate IDs inside saved deduction picks; future snapshots must retain evidence text, not just IDs. Require an explicit map if semantics changed along with the name.
- **Claude decision:** **accepted**. `MIGRATIONS` maps evidence IDs inside saved picks (tested). Evidence text snapshots are **deferred** with record snapshots.

### SC-15 — Rename a flag

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:64`, `godot/scripts/story/story_runner.gd:105`, `godot/scripts/story/progress.gd:97`.
- **Test/steps:** `_flags()`, change produced `OLD` to `NEW`, update a condition to read `NEW`, and `_probe()`. Also replay current/record runs whose entry carry already contains only `OLD`, and start a new scene gated on `NEW` from old `after`.
- **Expected:** Apply one consistent rename across current/record entry carries and campaign carries, or declare incompatibility.
- **Actual:** Current/record recomputation produces `NEW`; old `after` retains `OLD`. Entry carries containing `OLD` are copied unchanged, so the renamed gate does not open in either replay or the next incident. Unknown flags are retained without migration.
- **Suggestion:** Map flags in every carry location, including all `after` entries and saved run entry carries, with an explicit conflict rule. Do not replay all completed episodes to derive replacement carries.
- **Claude decision:** **accepted in part**. Flags are part of the save contract: avoid renaming them after release. A needed rename is a save-version step using `Progress.rename_flags`, which rewrites every `after` and entry carry with one rule (a carry that already has the new name keeps its value). It is not automatic. Test: `_flags()`.

### SC-16 — Remove a flag

- **Severity:** P2 when downstream content requires a replacement gate. **Location:** `godot/scripts/story/story_runner.gd:105`, `godot/scripts/story/story_runner.gd:258`.
- **Test/steps:** `_flags()`, remove the flag-producing effect and require `NEW` in the updated condition, then repeat the entry-carry/next-incident checks from SC-15.
- **Expected:** Explicitly retire the old flag or assign a documented replacement/default so historical progress has defined semantics.
- **Actual:** Recomputed current/record no longer produces `OLD`, while old entry carries and `after` retain it. `NEW` is absent everywhere, so its new conditional text is omitted. This fixture demonstrates a missed conditional beat, not a proven production deadlock.
- **Suggestion:** Allow obsolete flags to remain inert if nothing reads them; otherwise migrate each carry consistently and define the replacement value. Never silently erase unrelated flags.
- **Claude decision:** **accepted**: a retired flag stays in carries, inert, and is never erased. A downstream gate that needs a replacement value goes through a rename step (SC-15).

### SC-17 — Insert an incident in the middle of the campaign

- **Severity:** P1 for blocking access and losing an existing current run. **Location:** `godot/scripts/story/progress.gd:65`, `godot/scripts/story/progress.gd:83`, `godot/scripts/story/progress.gd:97`, `godot/scripts/story/progress.gd:105`, `godot/scripts/ui/main.gd:260`.
- **Test/steps:** `_campaign_order()` saves finished INC-001/current INC-002 with one partial input, plus a second campaign with finished INC-002/current INC-003. Insert `INC-027` between INC-001 and INC-002 in the QA index. Exercise both the UI's normal begin/finish sequence and a caller preserving the old current while recording the inserted outcome, then restore the index.
- **Expected:** A declared campaign-order migration preserves access and carry continuity, or asks the player how to include the new incident.
- **Actual:** The insertion is unlocked, but INC-002 becomes locked because its new predecessor lacks `after`. This applies even when INC-002 is already finished; the incident-list button uses that unlock predicate. A saved INC-002 current still exists but is inaccessible through the normal list. Starting the insertion through `begin` replaces that single current slot; after completing it, INC-002 starts with the new carry and **an empty input log**, losing its saved partial progress. Save/load preserves that loss. Separately, `carry_for(INC-002)` before insertion completion returns empty, while calling `begin` directly for its existing current retains the old entry carry. A caller that preserves that current while writing the new predecessor's finished outcome instead skips the inserted effects: `begin` still returns the old carry. In the more advanced campaign, INC-003 stays unlocked and receives unchanged `after[INC-002]`, leaving the insertion gap. Both old finished records themselves remain replayable.
- **Suggestion:** Store campaign order/version, grandfather completed/current access, and offer the insertion as an optional branch or explicit campaign restart. Never splice new effects into an already started incident without a declared reconciliation rule.
- **Claude decision:** **accepted** (P1, fixed). An incident the player has started or finished stays open. An incident inserted before a point already reached is _passed_ (`Progress.is_passed`: closed, not played in that campaign), and `carry_for` takes the last finished incident, so carries skip the gap and no current run is replaced. Inserted at the frontier, it is played next and carries on. A stored campaign order and a campaign content version are **rejected**; the rule is to add incidents at the end. UI note: a passed incident shows as locked; a "new campaign" label would read better. Test: `_campaign_order()`.

### SC-18 — Change values/alignment effects

- **Severity:** P2. **Location:** `godot/scripts/story/story_runner.gd:249`, `godot/scripts/story/progress.gd:116`, `godot/scripts/ui/main.gd:303`.
- **Test/steps:** `_effects()`, change `route.KEEP` from evidence +2/corporate +1 to evidence +20/corporate −4, then `_probe()`; `_ui_consequences()` opens a record with changed evidence effects.
- **Expected:** Preserve finished numerical history; explicitly choose whether current is rebalanced or restarted.
- **Actual:** Current and record silently recompute evidence 20/corporate −4. Record still accepts all five inputs. Historical `after` and next entry retain evidence 2/corporate 1. The actual record UI also shows recomputed evidence 20 while the campaign carry is 2.
- **Suggestion:** A semantic content version must cover effects. Preserve finished result/carry snapshots; apply current rebalance only through a reviewed migration or explicit player choice.
- **Claude decision:** **accepted**: restart (SC-01 rule). `after` keeps the played numbers and the next incident starts from it. The record is flagged `changed`; UI change: show `after` numbers, not the replayed state, for such a record.

## Claude decision: save version policy

Adopted, implemented and tested on `story-pivot` (`godot/scripts/story/progress.gd`, `scripts/story/export-godot.mjs`; spec: `specs/architecture/story-episode-format.md`, "Save versions"). `godot/tests/save_compat.gd` now asserts the policy instead of the behaviour characterized below.

- **Accepted:** a per-run content version from a deterministic export hash (`contentVersion`) that leaves out wording, so text and translation edits keep saves as they are; a save-file `version` with a step-by-step upgrade and an unchanged copy of an older or newer file (`user://campaign.v<N>.json`); unversioned saves read as unknown content, not current content; a migration registry (`Progress.MIGRATIONS`: option and evidence maps, or declared compatible), accepted only when every input replays; record replay that never changes the record; a structured replay result (`Progress.check`: `state`, `inputs`, `complete`, `status`); only END finishes an incident; `after` never recomputed; started and finished incidents always open.
- **Changed:** a current run on changed content with no migration **restarts from its entry carry**, with a notice, instead of a best-effort prefix recovery. Prefix recovery on changed content cannot detect misplaced inputs or rescored outcomes without per-input context.
- **Rejected:** a separate campaign content version and stored campaign order (replaced by kept access, passed insertions and "add incidents at the end"); per-input scene origin and resolved context (not needed once changed content never replays best-effort).
- **Deferred:** finished-record text and result snapshots. A record re-renders with today's text; when its content changed it is flagged, and its numbers come from `after`. Also deferred: migrations that drop inputs, and stored resolved timeout options.
- **UI work left** (main.gd and ui_text.gd belong to the UI owner): tell the player `Progress.take_notice` after `begin` (`restarted`, `stopped`); mark a record whose `Progress.check` is not `same` and complete, and show its `after` numbers; show a content error rather than the summary on a missing scene; label passed incidents.

## Proposed policy for Claude

### Version the save, campaign, and individual runs

Use separate `saveSchemaVersion` (serialization shape), `campaignContentVersion` (ordering/compatibility contract), and per-run `episodeContentVersion`. An episode's existing `schemaVersion: 1` describes its data format and cannot identify changed content. Generate a deterministic episode-content hash in the export for detection, with an explicit migration registry from one semantic version/hash to another. A hash mismatch detects change; it does not decide whether that change is safe. Pure text/translation edits may be declared compatible by policy, while solution/effect changes require semantic review.

New input entries should record originating `sceneId`, input payload, and enough resolved context to detect reinterpretation: resolved option ID for timeout, and deduction result/solution version for validation. Bind a pending timer to episode version and scene ID in addition to its input step. A scene ID alone cannot detect a changed solution or effect.

Treat unversioned saves as `legacy-unknown`, not as the current content version. Back up their exact bytes before any migration. If the old content cannot be identified, do not auto-replay and overwrite their history. Preserve historical `after`; offer a current-incident restart from its stored entry carry, or an explicitly disclosed best-effort prefix recovery. Do not present newly generated record text as an exact old transcript.

### Decide by change type

| Change                            | Current policy proposal                                                                                                                            | Finished records / `after`                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pure option/scene rename          | Explicit scene/option map; validate resulting replay before replacing the run. Fully relinked legacy scene-only rename may need no payload change. | Keep snapshot; migrate carry identifiers only where needed.                                                   |
| Option removal                    | Replay only under known compatibility rules; stop before missing action and disclose discarded suffix. Ask for a new choice.                       | Preserve completed transcript and original carry.                                                             |
| Scene removal/insertion           | Verify scene origin before consuming any input. Use a reviewed checkpoint map; otherwise ask to restart the incident from its entry carry.         | Preserve snapshot; do not require newly inserted content to view history.                                     |
| Timer → plain                     | Explicit choices can remain. Drop pending timer. Map old timeout to its old resolved default only if equivalent.                                   | Snapshot retains original timeout and result.                                                                 |
| Plain → timer                     | Keep old completed choices. Grandfather pending scene as untimed or ask about a fresh deadline/restart.                                            | Keep snapshot and carry.                                                                                      |
| Deduction solution/attempt change | Semantic incompatibility: ask to redo/restart from a declared checkpoint; do not silently rescore picks.                                           | Keep original correctness, feed, and carry.                                                                   |
| Evidence rename                   | Explicit ID map for picks and any saved evidence references; validate before committing migration.                                                 | Snapshot includes evidence title/body; carry has no episode-local evidence IDs today.                         |
| Flag rename/removal               | Map all carry locations with documented defaults/conflict handling; retired unused flags may remain inert.                                         | Keep historical text; migrate all carry identifiers consistently, without recalculating old numeric outcomes. |
| Campaign insertion                | Preserve old access/order; offer optional new content or explicit restart/reconciliation.                                                          | Keep completed access and `after`; no retroactive overwrite of downstream carries.                            |
| Values/alignment effect change    | Treat as semantic change; reviewed migration or ask whether to rebalance/restart current.                                                          | Keep completed numeric snapshots and original carry.                                                          |

After an approved migration, replay into a duplicate, validate its terminal/current scene and result, and write atomically once. Return a structured replay result such as `{state, appliedInputs, recoveryReason, incompatibleAt}`. A recoverable input mismatch must not be conflated with END or invalid content. Never mutate the source record during read-only viewing. Console warnings are not a player-facing recovery notice.

Finished records should be text/result snapshots created at `finish`: ordered feed, resolved scene/choice/evidence text, deduction correctness, timeout status, entry and final values/alignment/flags, episode title/version, and language information. Feed IDs alone are insufficient because the UI looks up today's scenes/options/evidence. For localized replay, retain resolved display strings in the played language, or a versioned text catalog with all required locale strings; do not claim old English strings reproduce the old Korean view. Snapshots preserve original outcomes while `after` remains the authoritative continuation carry. Existing records without snapshots need a clearly labeled legacy view; exact old text cannot be recovered without old content.

### Smallest implementation surface (proposal only)

1. `scripts/story/export-godot.mjs:68` and `godot/scripts/story/episode_library.gd:35`: emit/read episode-content versions and a campaign-order version. Keep these distinct from story schema version.
2. `godot/scripts/story/progress.gd:24`, `:28`, `:43`: initialize version metadata, validate supported versions, route legacy loads to a compatibility decision, and preserve a pre-migration copy. The ordinary rolling backup alone is insufficient after repeated saves replace both copies with migrated data.
3. `godot/scripts/story/progress.gd:105`, `:111`: version new runs and include scene origin/resolved context when logging inputs. Corresponding caller: `godot/scripts/ui/main.gd:826`.
4. `godot/scripts/story/progress.gd:146`: replay into a duplicate and return structured recovery information; apply ID maps before replay, reject mismatched scene origins, and never truncate a finished record as a side effect of viewing it. Current-run truncation should be committed only after the chosen recovery path.
5. `godot/scripts/story/story_runner.gd:122`, `:216`, `godot/scripts/ui/main.gd:715`, `:874`: propagate a missing-scene/invalid-content result and require explicit END before `finish`. Preserve a playable recovery route instead of making a missing scene a summary.
6. `godot/scripts/story/progress.gd:116`, `godot/scripts/ui/main.gd:298`: store/render finished text/result snapshots. Resolve display text while finishing, because `Progress` currently has only state/IDs and no locale renderer.
7. `godot/scripts/story/progress.gd:65`, `:83`, `:97`, `:105`, `godot/scripts/ui/main.gd:260`: use the selected campaign version/order and grandfather current/completed access. Make carry reconciliation explicit for newly inserted incidents.
8. `godot/scripts/ui/main.gd:283`, `:325`, `:724`: display recovery choices and bind restored timers to scene/version. Add localized recovery text in `godot/scripts/ui/ui_text.gd:1` when Claude implements the UI.

The first protective patch can stay small: non-mutating finished replay, explicit END checking, and version-mismatch detection before current replay. That still needs an honest legacy-record message; full historical snapshots require more work and cannot reconstruct missing old text. No product implementation is included in this worktree.

## Commands and verification

Environment: Windows, Node `v24.18.0`, npm `11.16.0`, Godot `4.7.2.stable.official.ed1daf0bf`. `GODOT_BIN` was set to the absolute path of `../../_basic_tool/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe`. Local commands use `npm.cmd` because of PowerShell's npm script policy.

| Command/check                                                                                                                                               | Result                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm.cmd run godot:saves -- --verbose`                                                                                                                      | PASS, exit 0: existing recovery 13 checks; compatibility 18 cases / 718 checks / 0 failures. Fresh QA-copy import and both test scripts ran. Final output scanned for assertion failures, GDScript errors, leaked objects/resources, and orphan StringNames: none. |
| Isolated QA config renamed to `Orpheus Safety Refusal`, then Godot `--headless --path .qa/verification/saves-run/godot --script res://tests/save_compat.gd` | PASS negative test: refusal before test writes, exit 1. Exact QA config bytes restored in `finally`.                                                                                                                                                               |
| `node --check scripts/story/godot.mjs`                                                                                                                      | PASS.                                                                                                                                                                                                                                                              |
| `node_modules/.bin/prettier.cmd --check scripts/story/godot.mjs docs/qa/2026-10-26-save-compat.md`                                                          | PASS after formatting the report. GDScript is excluded by repository formatting configuration.                                                                                                                                                                     |
| `git diff --check`                                                                                                                                          | PASS.                                                                                                                                                                                                                                                              |

`npm.cmd run check` also passed with exit 0: formatting, lint, types, 142 scenario files, locale/story validation, export freshness, 67 Vitest files / 850 tests, five release-harness tests, and the web build. The existing 5.49 MB campaign-chunk warning remains.

Expected runtime diagnostics: intentionally broken JSON in the existing recovery suite, and `Saved input no longer applies` for incompatible-prefix cases. This Windows environment also emits `Failed to read the root certificate store` before script execution. None changes the assertion result. Initial test-development runs exposed a float-versus-normalized-int fixture comparison and an incorrect audio teardown field; both were corrected. Rapid headless loop changes also required allowing mixer time before switching/stopping playback. The final verbose run has no shutdown resource diagnostics.

Local ignored logs: `.qa-save-compat-run.log` (final runtime verification), `.qa-save-compat-safety.log` (guard refusal), `.qa-save-compat-check.log` (full repository check). Runtime assertions exercise Windows headless Godot and selected actual UI methods; they do not verify a hosted Linux job, every production campaign path, or a migration implementation. The existing CI already runs `npm run godot:saves`, so it will pick up the new suite without workflow edits.

## Structured task result

```yaml
task: docs/codex/2026-10-26-save-compat.md
status: completed_with_findings
role: Codex_scoped_tests_and_proposal
branch: codex/save-compat
base_commit: 3da66169639e91cb90643776d7e502af595e1e4e
report: docs/qa/2026-10-26-save-compat.md
changed_files:
  - godot/tests/save_compat.gd
  - scripts/story/godot.mjs
  - docs/qa/2026-10-26-save-compat.md
product_files_changed: false
canonical_project_state_changed: false
committed: false
pushed: false
published: false
verification:
  recovery_assertions: 13
  compatibility_cases: 18
  compatibility_assertions: 718
  assertion_failures: 0
  script_errors: 0
  shutdown_leaks: 0
  isolation_refusal: pass
  repository_check: pass
  vitest_tests: 850
  release_harness_tests: 5
findings:
  P1: [SC-07, SC-17]
  P2:
    [
      SC-01,
      SC-02,
      SC-03,
      SC-04,
      SC-05,
      SC-06,
      SC-08,
      SC-10,
      SC-11,
      SC-12,
      SC-13,
      SC-14,
      SC-15,
      SC-16,
      SC-18,
    ]
  P3: []
compatible_controls: [SC-04_pure_rename, SC-09, SC-10_completed_explicit_choice]
invalid_content_defensive_probes: [SC-04_stale_reference, SC-07]
policy_implemented: false
triage_owner: Claude
triage_status: decided
product_acceptance: not_granted_by_this_report
```

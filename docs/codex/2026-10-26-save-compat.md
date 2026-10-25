# Codex brief C5 — save compatibility across content changes (2026-10-26)

Branch `codex/save-compat`. Read `AGENTS.md` ("Claude and Codex") first. **Tests and a
proposal only**: do not change `godot/scripts/` or story data; Claude implements the policy.

Saves (`godot/scripts/story/progress.gd`) store, per incident, an entry carry and the player's
inputs, and replay them through the current episode data. After a content update the episode
may differ. Find out what happens, with tests:

- For a run in progress (`current`), a finished record (`records`) and the carry handed to the
  next incident (`after`), when an update: removes or renames an option; removes, renames or
  inserts a scene; changes a timer into a plain choice or back; changes a deduction's solution;
  renames an evidence ID; renames or removes a flag; adds a new incident in the middle of the
  campaign; changes values/alignment effects.
- Build mutated episode fixtures in the test (do not edit `godot/data`), run them through the
  real `Progress` and `StoryRunner`, and assert what the player would see: crash, silent wrong
  state, stuck scene, or safe recovery. `godot/tests/save_recovery.gd` and
  `npm run godot:saves` show the isolation pattern (copied project, own application name);
  extend that or add `godot/tests/save_compat.gd` run by the same command.

Then propose a policy in the report: a content version in the save, what to do per change type
(replay and stop, migrate with a map, keep finished records as text snapshots, or ask the player),
and the smallest code changes needed (`path:line`). Report `docs/qa/2026-10-26-save-compat.md`,
cases as SC-01…, each with the test that shows it.

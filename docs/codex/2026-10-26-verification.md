# Codex brief — verification hardening (2026-10-26)

Branch `codex/verification`. Read `AGENTS.md` (section "Claude and Codex") and the "검토 결과와
조치" table at the end of `docs/QA_REVIEW_2026-10-25.md` first. These are the items deferred
there. Change tests, CI and tooling only, not game behaviour. If a test exposes a real bug,
report it with a reproduction rather than fixing game code.

## 1. Godot checks in CI

Add a job to `.github/workflows/ci.yml` that downloads the official Godot 4.7.2 Linux headless
binary (cache it), then runs `npm run godot:parity` and `npm run godot:smoke` (the scripts honour
`GODOT_BIN`). It must fail on a non-zero exit. Keep the existing `npm run check` job unchanged.
You cannot run GitHub Actions here; validate the workflow syntax locally (for example with
`actionlint` if available, otherwise by careful review) and say so in the report.

## 2. Exit-time leak warnings

`npm run godot:smoke` ends with "N ObjectDB instances were leaked at exit" and/or "resources
still in use at exit". Find the cause with `--verbose` and fix it in the test harness
(`godot/tests/*.gd`) if it is the harness. If it is game code (for example static caches in
`godot/scripts/story/*.gd`), report the cause and a proposed fix instead.

## 3. Parity coverage

`campaignCarries` merges states and caps at 48 carries (`src/story/validate.ts`), and the parity
fixtures use the first 12 carries per episode (`scripts/story/export-godot.mjs`). Add fixtures
that cover what that misses: value and alignment thresholds that change dialogue (`when:`
conditions on values/alignment) and combinations of three or more flags that some `when:` reads.
Keep the parity run under about two minutes. Report how many paths were added and what they
reach that was not reached before.

## 4. Save compatibility tests

Add a headless Godot test (`godot/tests/save_recovery.gd`, run from a new
`node scripts/story/godot.mjs saves` and `npm run godot:saves`) that works only on a temporary
`user://` path or an isolated application name, never on `user://campaign.json` of the real
game. Cases: a truncated or invalid `campaign.json` falls back to `campaign.bak.json`; both
broken gives an empty campaign; a save whose `current.inputs` no longer applies (an option ID
that no longer exists) resumes at the last valid point without crashing; a save without
`cast_seen`/`records` keys loads. If `Progress` needs a seam to point at a temporary path, report
the smallest change instead of making it.

## Report

`docs/qa/2026-10-26-verification.md`: what was added, how each was run and its result, and any
bug found (IDs VR-01…).

# Codex brief — content and visual QA, report only (2026-10-26)

Branch `codex/content-qa`. Read `AGENTS.md` (section "Claude and Codex") first. **Report only:
change no product file.** The only new file is the report.

## 1. Korean read-through, act by act

Read every Korean line of the story in play order: `src/i18n/content/ko/story-inc-001.yaml` …
`story-inc-026.yaml` against `src/story/data/inc-NNN.yaml` (which line belongs to which scene and
speaker) and `src/i18n/content/ko/story-cast.yaml`. Report:

- awkward or translated-sounding Korean (quote it, propose a rewrite);
- a speaker's register drifting (Maya/Jin/Sam/… speak 해요체 on the bridge, NULL short 반말,
  ORPHEUS 합쇼체; narration and evidence cards 해라체, cards' bullet style ~함/~됨);
- the same term translated differently across incidents (make a small glossary table of what
  you found: English term, translations seen, where, recommended one);
- a translation that says something the English does not, or omits something it says.

## 2. Cast spoiler and timing audit

For every line in `src/story/cast.yaml` (and its Korean), check against the episodes that it does
not say more than the story has revealed when it unlocks (`after`/`flag`, rules in
`specs/architecture/story-episode-format.md`, section "People"). Known open points to settle with
evidence: the advisor is renamed ORPHEUS at flag `ORPHEUS_ACTIVE` (INC-009) while the episodes
make the link explicit later (around INC-015?); BOARD is "Office of the Chair" in INC-025 but
"Board" in INC-026; "authorised" vs "authorized" spelling across the story.

## 3. Visual capture QA

Use an isolated copy under `.qa/2026-10-26-content-qa/godot` with `config/name` changed. The game
has a capture mode: `godot --path <copy> -- --shot=<png> [--lang=ko|en] [--episode=INC-NNN]
[--until=timer|deduction|<scene id>] [--play=c,<optionId>,…] [--flags=A+B] [--status=values|decisions|reveals|people]
[--settings] [--fold] [--credits]` (see `_review` in `godot/scripts/ui/main.gd`). Text size is
a saved setting (`godot/scripts/ui/settings.gd`); set it in the copy's user settings. Capture at
1280×720 and 1920×1080, text sizes small/medium/large, Korean and English, for: the title, an
incident mid-dialogue, a timed decision, a deduction, the summary of a finished incident (folded
and unfolded), each status tab, the settings and the credits. Look at every image; report
overlaps, clipped or cut-off text, unreadable contrast, layout breaking at large text. Put the
captures under `.qa/` (ignored) and reference them by path.

## 4. Repeated runtime checks

In the same copy, run the parity and UI smoke tests three times (`godot --headless --path <copy>
--script res://tests/parity.gd`, `…/ui_smoke.gd`, after `npm run godot:export -- --fixtures` and
an `--import`). Report counts, durations, failures and any intermittent result.

## Report

`docs/qa/2026-10-26-content-qa.md`, findings as `AGENTS.md` describes (IDs CQ-01…), grouped by
section, most severe first, plus the glossary table and the structured result.

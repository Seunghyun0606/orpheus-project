# Codex brief C1 — English read-through, report only (2026-10-26)

Branch `codex/english-qa`. Read `AGENTS.md` ("Claude and Codex") first. **Report only.**

The Korean pass is done (`docs/qa/2026-10-26-content-qa.md`); now the English source. Read every
English line in play order: `src/story/data/inc-001.yaml` … `inc-026.yaml` (dialogue, narration,
logs, evidence cards, choices and consequence captions, deduction prompts and hints, endings),
`src/story/cast.yaml` and the English UI strings in `godot/scripts/ui/ui_text.gd`.
`.qa/tools/content-qa/audit.mjs` shows how to map lines to scenes (adjust its paths).

Report:

- typos, grammar, unclear or ambiguous sentences (quote, propose a rewrite);
- voice drift: Maya decisive and spare, Jin customer-first with counts and quotes, Sam quick and
  practical, Marcus guarded and precise, ORPHEUS formal with numbers, NULL short lowercase-like
  fragments, narration present tense;
- consistency: names, numbers, IDs, times and facts that recur across incidents (for example
  resolution numbers, employee number, instance numbers); American spelling throughout;
- terms used differently for the same thing (glossary table: term, variants, where, recommended);
- jargon a non-specialist cannot follow at its first appearance (the Korean pass added short
  glosses; suggest the English equivalent only where it reads naturally);
- UI strings that are too long for their place (check against captures if needed: the game has
  `--shot`, `--lang=en` and `--text-size=0|1|2`, see `_review` in `godot/scripts/ui/main.gd`).

Note that every English story string is a key in `src/i18n/content/ko/story-*.yaml`; a suggested
English change therefore also needs its catalog key updated (Claude does that).

Report `docs/qa/2026-10-26-english-qa.md`, findings EQ-01…, most severe first.

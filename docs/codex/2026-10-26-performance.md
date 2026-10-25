# Codex brief C3 — memory and performance over a long session, report only (2026-10-26)

Branch `codex/performance`. Read `AGENTS.md` ("Claude and Codex") first. **Report only**: game
code stays unchanged; measuring scripts live under `.qa/` (ignored).

An earlier full UI run was killed by the OS for low memory, and players will keep the game open
for a whole campaign. Measure, in an isolated copy (`.qa/performance/godot`, own application
name):

1. Full campaign in real time: adapt the `_realtime` part of `godot/tests/ui_smoke.gd` into a
   probe that, after each incident and every N frames, records `Performance` monitors (static
   memory, object count, node count, orphan node count, resource count, texture/video memory) and
   frame time. Add `await process_frame` between steps as the smoke test does. Report the curve
   per incident and whether anything grows without bound (screens, RichTextLabels, tweens, audio
   players, act-card and ending textures, the status window, cast caches in
   `godot/scripts/story/cast_book.gd`).
2. Typing and reveal cost: frame time while long feeds type (late incidents have long feeds);
   the cost of rebuilding the screen on language or text-size change.
3. The exported build (`npm run godot:build`, then run the exe from a copy whose `.pck` was
   exported from the isolated project, as `docs/qa/2026-10-26-windows-build.md` did): startup
   time to the title, working set after the title, after INC-001, and after opening a late
   record and the People tab.

Report `docs/qa/2026-10-26-performance.md`: method, tables, graphs as images under `.qa/` if
useful, findings PF-01… with the suspected cause (`path:line`) and a proposed fix.

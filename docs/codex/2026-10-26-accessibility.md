# Codex brief C4 — accessibility check, report only (2026-10-26)

Branch `codex/accessibility`. Read `AGENTS.md` ("Claude and Codex") first. **Report only.** Use
an isolated copy under `.qa/accessibility/` with its own application name. WCAG 2.2 AA is the
reference where it applies to a desktop game.

1. **Contrast, measured.** Compute contrast ratios for every text/background pair defined in
   `godot/scripts/ui/theme_builder.gd` (normal, dim, header, prompt, choice, disabled, NEW and
   status markers, tooltips, the timer). Then measure on real captures with the CRT effect on and
   off (`--shot`, see `_review` in `godot/scripts/ui/main.gd`; CRT is a saved setting), sampling
   text and background pixels, including text over the new backdrops (title, act cards,
   credits: `_with_backdrop`). Flag pairs under 4.5:1 (3:1 for large text and UI marks).
2. **Keyboard only.** Can a player do everything without a mouse: title menu, settings (every
   control), choices, the deduction (picking evidence cards and connecting), timers, the summary
   fold (H), status window and every tab including choosing a person, records, credits? Is focus
   always visible and does it land somewhere sensible after each screen change? Use Godot input
   events in a probe script; list every place that needs a mouse.
3. **Settings.** Text sizes (layout at large size across screens), reduced motion (no fades,
   tweens or flashes left), timers off (no time pressure anywhere), text speed instant, CRT off.
4. **Other.** Information carried by color alone (pressure, alignment, NEW markers), flashing
   (the pager flash), minimum hit-target sizes.

Report `docs/qa/2026-10-26-accessibility.md`: findings AX-01… with location, measurement, and a
concrete fix (for colors, a replacement value that passes).

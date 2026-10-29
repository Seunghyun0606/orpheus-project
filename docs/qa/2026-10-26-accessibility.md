# Accessibility audit — 2026-10-26

## Result and scope

Completed the report-only brief `docs/codex/2026-10-26-accessibility.md` on
`codex/accessibility`, at `3da66169639e91cb90643776d7e502af595e1e4e`.
**Accessibility acceptance fails: keyboard-only play stops at the first deduction.**
There are **12 findings: 1 P1, 9 P2, 2 P3**. No product file, canonical Project OS
state, or player save was changed. Changes are uncommitted; nothing was pushed,
signed, or published. All suggested fixes below are proposals for Claude.

Runtime testing used `.qa/accessibility/godot/`, copied from `godot/`, with
`application/config/name="Orpheus Accessibility QA 2026-10-26"`. Its user directory
is `%APPDATA%/Godot/app_userdata/Orpheus Accessibility QA 2026-10-26/`.
The probe asserts this application name before running. Review captures use
`--shot`; event probes set `reviewing=true` and use in-memory campaign progress.

## Method and evidence

Reference: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), applied as a desktop-game
review benchmark, with the [WCAG2ICT guidance](https://www.w3.org/TR/wcag2ict/).
Normal text uses 4.5:1; large text uses 3:1 (24 px regular or approximately 18.7 px
bold at the tested scale); essential graphical marks use 3:1. Inactive controls
are measured but exempt from the text contrast requirement. Pointer target
review uses the 24 px minimum and considers spacing/equivalent controls; 44 px is
not an AA requirement. This is a scoped audit, not a full conformance claim.

Evidence is retained in ignored `.qa/accessibility/`:

- `capture.py`, `extra_captures.py`, `settle_captures.py`, `feed_captures.py`;
  `capture-results.json`, `extra-capture-results.json`, `settled-results.json`.
- `godot/ax_probe.gd`, `probe-results.json`: real `InputEventKey` press/release
  pairs through `Input.parse_input_event`, Tab traversal and actual activation.
- `godot/ax_extra.gd`, `extra-results.json`: overlay activation, scrolling,
  off-screen focus and actual pointer-triggered tooltip.
- `godot/ax_flash.gd`, `flash-results.json`: pager tint samples.
- `measure.py`, `theme-contrast.json`, `pixel-contrast.json`, `final_metrics.py`;
  PNGs, control bounds and logs under `captures/` and `logs/`.

There are **126 distinct review captures**, plus probe screenshots: 72 layout
captures (12 screens × 3 sizes × 2 languages), 12 corresponding medium-English
CRT-on captures, 18 Act-card captures, and 24 captures covering ten ending
backdrops, selected evidence and an urgent timer, each with CRT off/on.
The 66 medium-English captures were repeated after a 0.95 s settling interval,
so the reported contrast does not depend on the evidence/metric arrival tint.
Eight feed captures were refreshed with parsed RichText metadata because Godot's
`append_text()` content is not returned by the `text` property.

Each capture also has a second render with text hidden and layout preserved.
Pixel measurements compare a glyph core with the background at **the same
coordinate**, including artwork and CRT shading. Core selection uses a 1.1/255
RGB tolerance against the known foreground, with the CRT attenuation included;
antialias fringes are excluded. `pixel-contrast.json` records the pixels,
coordinates, sample count and minimum/median per text/color group. The tables
below report minimum sampled core contrast, rounded; palette calculations use
unrounded sRGB values and `(lighter luminance + .05)/(darker luminance + .05)`.
This is a repeatable sample of rendered glyph cores, not proof about every pixel
at every window size.

## Findings

### AX-01 — P1 — Evidence selection blocks keyboard-only play

- **Location:** `godot/scripts/ui/main.gd:1003`, `:1051`, `:1060`, `:849`.
- **Reproduce:** Begin INC-001, continue and choose an investigation direction,
  then reach its deduction. Press Tab repeatedly, Enter, Space and 1.
- **Expected:** Focus and select the required cards, then activate Connect.
- **Actual / measurement:** All three cards have `focus_mode=0`; 14 Tab events
  leave focus null and picks remain `[]`. Only left-mouse events reach
  `_toggle_pick`. Connect remains disabled until enough cards are selected.
  A mouse-event positive control picks `POOL_AT_LIMIT` and `IDLE_TRANSACTIONS`;
  Tab/Enter can then activate Connect and reach `decide`. The same card widget is
  used throughout the campaign.
- **Concrete fix:** Make selectable cards keyboard-focusable, handle `ui_accept`
  to toggle a card, expose selection with a check/count as well as the border,
  scroll the focused card into view, and place focus on the first card when a
  deduction opens. Restore a useful card focus after changing picks.
- **Claude decision:** **accepted** (2026-10-29). Evidence cards take keyboard focus and Enter/Space toggles a pick; picks show a ✓ before the title as well as the amber frame and the count; focus lands on the first card when a deduction opens and the tray scrolls a focused card into view, top first; a one-line key hint sits under the count; Connect is then reached by Tab (or 1). `godot/scripts/ui/main.gd:1113` (`_add_card`), `:1186` (`_style_card`), `:1200` (`_show_card`), `:1216` (`_on_card_input`), `:825` (focus on open), `:846`; focus frames `theme_builder.gd:96`. Regression: `_keyboard()` in `godot/tests/ui_smoke.gd:204` solves INC-001's deduction with real Tab/Enter/Space events.

### AX-02 — P2 — Status entry and choosing another person require a mouse

- **Location:** `godot/scripts/ui/main.gd:368`, `:588`, `:1343`, `:1401`.
- **Reproduce:** During an incident, Tab through available controls; try to open
  Status. After opening it with the mouse, reach People and try to choose Jin.
- **Expected:** Open Status and choose every person using keys.
- **Actual / measurement:** Status explicitly has `FOCUS_NONE` and no shortcut.
  Episode traversal reaches only choice rows. Within a directly opened Status
  window, Tab reaches its TabBar and Right visits tabs `[0,1,2,3]`, but no People
  row enters the focus cycle. Maya remains selected after navigation/Enter while
  three people are available in the INC-001 test. Person rows accept only a left
  mouse click. Menu also has `FOCUS_NONE`, but Escape provides its equivalent.
- **Concrete fix:** Give Status keyboard focus and a documented shortcut; make
  person rows focusable buttons/list items with keyboard activation and a visible
  current selection. Preserve the selected person when changing tabs.
- **Claude decision:** **accepted**. Status and Menu are ordinary focusable buttons, S opens and closes the Status window, and it opens with the tab bar focused. People rows are focusable; moving focus onto one (Tab, arrows) or Enter chooses it, with a separate focus outline; the chosen person is kept across tabs as before. `main.gd:417`, `:658`/`:673` (S), `:1594` (`_status_people`), `theme_builder.gd:207` (`ChoiceRowFocus`). A key list is in Settings (`main.gd:1336`). Covered by `_keyboard()` (S, Right to People, Down chooses another person).

### AX-03 — P2 — Reading older text and scrolling lists lacks keyboard access

- **Location:** `godot/scripts/ui/main.gd:230`, `:391`, `:405`, `:433`, `:1295`,
  `:1348`, `:1356`, `:1770`.
- **Reproduce:** Open a long record such as INC-026. Try Tab, Page Up/Down,
  Home/End and arrows to read earlier dialogue/logs, older evidence and the full
  summary. Repeat in a long People list/profile. On the title, Tab down its list.
- **Expected:** Every scrollable reading surface can receive keyboard input;
  focused items remain visible.
- **Actual / measurement:** Scroll containers have `focus_mode=0`; RichText and
  their scrollbars use accessibility-only focus mode 3, outside ordinary Tab
  traversal. In the record probe, log scroll remains `330/330`, dialogue
  `3991/3991`, evidence horizontal scroll `714/714`, and summary scroll `0`
  despite overflow and the key sequence. People list/profile likewise stay at
  scroll 0 with content heights 656/570 in 494 px viewports. Title focus reaches
  disabled INC-014 at `y=955, h=44`, outside the 720 px viewport; list scroll
  remains 0. H folds the summary but does not make historical reading scrollable.
- **Concrete fix:** Add focusable reading panes with Page Up/Down, Home/End and
  arrow scrolling; enable scroll-following for focused descendants. Skip disabled
  incident entries in Tab traversal and keep the active title item visible.
- **Claude decision:** **accepted**. Log and dialogue feeds are Tab stops and scroll with arrows, Page Up/Down and Home/End (`_rich`, `main.gd:2075`); `_keyboard_scroll` (`main.gd:2091`) adds Page Up/Down/Home/End to scroll containers and follow-focus, so the title list, choices/summary, People list keep the focused row in view; status pages and the People profile are focusable scroll panes. Locked title entries are skipped by focus (`main.gd:301`). The summary heading is focusable and Enter folds it (`main.gd:1026`).

### AX-04 — P2 — Overlay focus escapes, activates background controls, and is lost on close

- **Location:** `godot/scripts/ui/main.gd:1078`, `:1165`, `:1230`, `:1537`.
- **Reproduce:** On title, Escape opens Settings with Close focused. Press Tab
  once, then Enter. Also close Settings/Status after focusing an overlay control.
- **Expected:** Focus stays within the overlay and returns to its opener on close.
- **Actual / measurement:** Tab from Close reaches the obscured title Begin
  button. Enter starts INC-001 **while Settings stays open**. Status traversal
  similarly includes the obscured incident choices. Closing Settings normally
  leaves focus null; language/size changes rebuild Settings and send focus back
  to Close rather than the control being edited. Background choice activation is
  guarded, but native title buttons are not.
- **Concrete fix:** Use a modal Window/Popup or an explicit overlay focus scope;
  disable background focus/input while it is open. Save/restore the opener and
  restore the corresponding setting after a language/size rebuild.
- **Claude decision:** **accepted**. While settings, the status window or an Act card is up, everything behind it has `focus_behavior_recursive = DISABLED` (`_sync_overlay`, `main.gd:1366`), so Tab stays inside and cannot press the title's Begin. Closing returns focus to the opener, or to a sensible default if the screen was rebuilt (`_restore_focus`/`_focus_default`, `main.gd:1376`, `:858`); a language or size change reopens Settings with the edited control focused (`main.gd:1395`). Regression: `_keyboard()` sends 24 Tabs in Settings and in Status and checks focus on close.

### AX-05 — P2 — Toggle and tab keyboard focus is invisible

- **Location:** `godot/scripts/ui/theme_builder.gd:98`, `:197`;
  `godot/scripts/ui/main.gd:1115`, `:1264`.
- **Reproduce:** In Settings, Tab onto CRT, timed decisions, fullscreen or reduced
  motion. In Status, Tab from Close onto the tabs.
- **Expected:** The current keyboard target is visually distinct.
- **Actual / measurement:** Each toggle is reachable and Space changes it, but
  its focus style resolves to `StyleBoxEmpty`. The TabContainer's `tab_focus` is
  also empty. Captures `probe-check-focus-*.png` and `probe-tab-focus.png` show no
  focus ring. The selected-tab underline is present even without keyboard focus,
  so it does not distinguish focus entering/leaving the TabBar.
- **Concrete fix:** Supply a distinct 2 px `#ffb347` focus outline on toggles and
  the focused tab. Against PANEL/PANEL_HI its nominal contrast is 10.20/8.98:1;
  keep the indicator distinct from the selected-state underline.
- **Claude decision:** **accepted** as proposed: a 2 px `#ffb347` ring on toggles, sliders, scroll panes, feeds and the focused tab (`theme_builder.gd:51`, `:120`, `:243`); the selected-tab underline is unchanged, so the two read apart. Checked in `.qa/fixes-2026-10-29/shots/settings-crt-focus-en-1.png` and `status-values-tabs-focus-en-1.png`.

### AX-06 — P2 — Reduced motion leaves metric and evidence highlights animated

- **Location:** `godot/scripts/ui/main.gd:994`, `:1030`.
- **Reproduce:** Enable reduced motion, enter an incident and receive a new metric
  or evidence card.
- **Expected:** No visual fades, flashes or tweens remain under this preference.
- **Actual / measurement:** `_set_metric` still sets modulation to
  `(1.5,1.4,1,1)` and tweens for 0.6 s; `_add_card` starts at `(1.6,1.4,1,1)` and
  tweens for 0.8 s. The isolated probe increases active tween count from 1 to 3
  when adding these two widgets with `reduce_motion=true`. The pre-existing tween
  is the sound-loop volume transition, not another asserted visual defect.
  Screen fades, Act-card fades and `_flash` correctly honor reduced motion.
- **Concrete fix:** Guard both the initial modulation and creation of these
  visual tweens with `not Settings.reduce_motion`; use white modulation otherwise.
  When enabling the preference mid-animation, finish existing visual tweens and
  restore their final visual state.
- **Claude decision:** **accepted**. Metric and card highlights are skipped under reduced motion (`main.gd:1088`, `:1113`); all visual tweens go through `_visual_tween` and turning the preference on finishes running ones (`_settle_motion`, `main.gd:1830`). Regression in `_keyboard()` (no highlight or running visual tween after an INC-001 reveal with reduced motion).

### AX-07 — P2 — Artwork defeats contrast on Act cards and credits

- **Location:** `godot/scripts/ui/main.gd:1578`, `:1664`, `:1704`.
- **Reproduce:** Capture the Act cards with `--episode=INC-019 --act-card`, or
  reach CONTINUITY credits. Compare CRT off/on after the text has settled.
- **Expected:** 4.5:1 for secondary/header text and 3:1 for large titles.
- **Actual / measurement:** At Act 7 `(637,413)`, DIM `#8b978c` over `#81623c`
  measures **1.84:1** off; `(637,413)` becomes `#818c82/#785b38`, **1.79:1** on.
  Act 5's small header is **2.06:1**. Act 6's large title also falls below 3:1
  (**2.66 off / 2.58 on** in the title's sampled cores).
  CONTINUITY's font credit at `(996,437)` measures **2.45 off / 2.34 on**.
  Full backdrop results appear below. Fixed shade amounts do not bound the
  artwork luminance under text.
- **Concrete fix:** Put the text group on an **opaque `#0b0e0c` backing**. Use
  `#e4ede3` for secondary text; if the CRT still overlays the text, use
  `#ffcc80` for small amber headers/prompts. These yield respectively 16.19/13.12:1
  against that backing before CRT, and at least **5.66/4.74:1** under a
  conservative 0.58 RGB attenuation bound from the current shader. Recheck large
  titles at 3:1. This is a proposal, not a product modification.
- **Claude decision:** **accepted**, with a different secondary colour. Act-card and credits text sit on an opaque `#0b0e0c` panel (`Backing`, `theme_builder.gd:103`; `main.gd:1855`, `:1918`). On that backing the new DIM (AX-09) already measures 9.1:1 in the captures, so `#e4ede3`/`#ffcc80` were not needed and the dim/amber hierarchy stays.

### AX-08 — P2 — Timestamps fail even with CRT disabled

- **Location:** `godot/scripts/ui/main.gd:631`.
- **Reproduce:** Capture INC-015 at `compare`, then inspect log and dialogue
  timestamps, CRT off/on.
- **Expected:** 4.5:1 for these normal-size reading cues.
- **Actual / measurement:** `DIM.darkened(0.25)` is approximately `#687169`.
  Nominal contrast is **3.96:1** on console `#070908` and **3.75:1** on dialogue
  `#0e1210`. Real glyph samples are **3.89/3.68 off**, **3.20/3.07 on**.
  Dialogue CRT-on example `(1225,252)`: `#5b635c` over `#0d110f`.
- **Concrete fix:** Replace the timestamp color with **`#d6dfd2`**, without the
  darkening. Nominal dialogue contrast becomes **13.79:1**; even applying a
  conservative 0.58 CRT factor to both colors gives **5.00:1**.
- **Claude decision:** **accepted**, with `#9aa69b` instead of TEXT, so stamps stay a step below the text they mark: 7.9:1 on the console and 7.5:1 on the dialogue nominally, at least 5.4:1 at the darkest CRT corner; captured 7.6–7.9:1 (`theme_builder.gd:14`, `main.gd:686`).

### AX-09 — P2 — Selected-card DIM text fails; CRT also lowers ordinary DIM text

- **Location:** `godot/scripts/ui/theme_builder.gd:10`, `:80`, `:139`;
  `godot/shaders/crt.gdshader:4`, `:10`.
- **Reproduce:** Select the solution cards in INC-001's deduction, CRT off/on.
  Also inspect the top-left desk label with CRT enabled.
- **Expected:** Normal-size text retains 4.5:1 through selection and CRT settings.
- **Actual / measurement:** DIM on SelectedCard is **4.14:1** nominal. Settled
  card pixels measure **4.12 off**, approximately **3.36–3.40 on**. At `(343,610)`
  the selected text/background are `#8a968b/#2c352e`. Separately, the ordinary
  top-left DIM desk label measures **5.90 off / 3.39 on**; the latter sample at
  `(22,39)` is `#616962/#0b100d`. An unselected card also reaches **3.31:1** with
  CRT. The shader darkens text along with its background.
- **Concrete fix:** A conservative passing replacement for DIM across these
  states is **`#e4ede3`**: **10.47:1** against the selected-card background, and
  **4.71:1** even at the shader's conservative 0.58 attenuation bound. An
  alternative is a less bright secondary color combined with moving the CRT
  treatment onto background artwork; that alternative needs fresh measurement.
- **Claude decision:** **accepted, modified**. At the old vignette (0.35) the darkest corner scales colours by about 0.65, which also fails AMBER on tiles and RED, so one brighter DIM could not fix it. The vignette is now 0.12 (scanlines unchanged; `main.gd:43`, worst factor 0.834) and DIM is `#aab4ab` (`theme_builder.gd:12`): at that factor at least 4.66:1 on the selected card and 5.6:1 on the other panels, with TEXT, AMBER, GREEN and CYAN all over 5.4:1. Captured: selected-card body 6.4:1, top-left desk label 7.7:1.

### AX-10 — P2 — Pressure help is clipped and hover-only

- **Location:** `godot/scripts/ui/main.gd:364`, `:366`, `:1751`;
  `godot/scripts/ui/ui_text.gd:59`.
- **Reproduce:** Hover Pressure in a 1280×720 incident/record, then try to reveal
  the help without a mouse. Hover an ellipsized top-bar title as well.
- **Expected:** All help text fits the viewport and has a keyboard equivalent.
- **Actual / measurement:** The real pressure tooltip's Label is **2689×24 px**
  at medium English size; it is a single line cut off at the viewport's right
  edge. The capture stops partway through the explanation. Tooltip text contrast
  itself passes: a sampled `#d6dfd2/#392810` pair is **10.33:1**. Pressure and
  shrinking title Labels have no keyboard focus or equivalent help action.
- **Concrete fix:** Provide a wrapped tooltip/help panel bounded to the viewport
  (for example width `min(640, viewport_width - 32)`), accessible on focus or a
  documented help key. Put the complete pressure explanation in keyboard-readable
  Settings/Status help too; expose full ellipsized titles on keyboard focus.
- **Claude decision:** **accepted**. The pressure tooltip wraps at `min(640, width − 32)` px (`WrappedTipLabel`, `main.gd:59`; shot `pressure-tooltip-en.png`), and tooltips get an opaque panel. The full explanation and current pressure are on the Status window's first tab (`main.gd:1571`), which the keyboard can now reach. Ellipsized titles need no extra help: the incident title is in the Status header and the scene title in the feed.

### AX-11 — P3 — Large English deduction layout clips Menu

- **Location:** `godot/scripts/ui/main.gd:415`, `:1041`.
- **Reproduce:** At 1280×720, English, large text: INC-023 → deduction.
- **Expected:** The complete top bar stays within the viewport margins.
- **Actual / measurement:** The unwrapped evidence-board instruction increases
  the root minimum width. Menu's rectangle is `x=1218, width=70`, ending at 1288;
  **8 px are outside the viewport**, and the intended 12 px right margin is lost.
  `deduction-en-2-crt0.png` shows the clipped right edge. Escape remains usable.
  The corresponding Korean sample fits.
- **Concrete fix:** Let the tray header/instruction wrap or split into two rows
  and give the body columns shrinkable minimum widths. Recheck the same capture
  with zero and two evidence picks.
- **Claude decision:** **accepted**. The tray header wraps (`main.gd:461`). INC-023, English, large text, 0 and 2 picks: Menu ends inside the margin (`deduction-en-2-inc023*.png`).

### AX-12 — P3 — Scrollbar pointer targets are only 8 px thick

- **Location:** `godot/scripts/ui/main.gd:405`, `:438`, `:1295`, `:1348`;
  `godot/scripts/ui/theme_builder.gd:46` (no scrollbar target sizing).
- **Reproduce:** Try dragging horizontal evidence scrolling or vertical record /
  People scrolling at 1280×720.
- **Expected:** Easily acquired pointer targets, with keyboard alternatives.
- **Actual / measurement:** The evidence vertical bar is **8×152 px**, horizontal
  bar **718×8 px**; log, dialogue and People bars are also **8 px** wide. Some
  abut interactive cards. These are much narrower than the 24 px target benchmark,
  and AX-03 removes the practical keyboard alternative. This is a pointer
  usability finding; a formal 2.5.8 verdict would also assess each thumb/track's
  spacing and applicability of platform-control exceptions.
- **Concrete fix:** Increase scrollbar hit regions to at least 24 px thickness
  (the visual track can stay narrower), keep their thumb large enough, and add
  AX-03's keyboard scrolling.
- **Claude decision:** **accepted**. Scroll bars have a 24 px hit area around the 8 px visible thumb, on a dark track so text does not show through under it (`theme_builder.gd:126`); keyboard scrolling is AX-03.

## Contrast inventory

The following cross-product covers all explicit text palette values and opaque
backgrounds in `theme_builder.gd`, plus the runtime keyword, machine-voice and
timestamp colors. It intentionally includes combinations that the current UI
does not instantiate. Selected/Hover use Godot's `lightened(.08/.06)` values,
before rounding to hexadecimal. Header/Title/Prompt/NEW/status use AMBER;
TileLabel/CardRich/CardBody/unselected tabs use DIM; normal Label/RichText use
TEXT. ChoiceRow inherits TEXT with AMBER numbering and DIM consequences.
The defined ChoiceButton variation is currently unused.

| Foreground             | BG `0b0e0c` | PANEL `111713` | HI `1a241c` | Console `070908` | Dialogue `0e1210` | Selected ≈`2c362e` | Hover ≈`28312a` |
| ---------------------- | ----------: | -------------: | ----------: | ---------------: | ----------------: | -----------------: | --------------: |
| TEXT `d6dfd2`          |       14.18 |          13.28 |       11.69 |            14.59 |             13.79 |               9.21 |            9.81 |
| DIM `8b978c`           |        6.38 |           5.97 |        5.26 |             6.56 |              6.20 |           **4.14** |        **4.41** |
| AMBER `ffb347`         |       10.89 |          10.20 |        8.98 |            11.21 |             10.60 |               7.07 |            7.54 |
| GREEN `7ddc95`         |       11.59 |          10.85 |        9.55 |            11.93 |             11.27 |               7.52 |            8.02 |
| CYAN `78c8ff`          |       10.63 |           9.95 |        8.76 |            10.94 |             10.34 |               6.90 |            7.36 |
| RED `ff7066`           |        7.17 |           6.72 |        5.91 |             7.38 |              6.98 |               4.66 |            4.96 |
| Choice `e9c88f`        |       12.13 |          11.35 |        9.99 |            12.48 |             11.79 |               7.87 |            8.39 |
| Hover/focus amber +20% |       12.20 |          11.42 |       10.06 |            12.55 |             11.87 |               7.92 |            8.44 |
| Keyword `ffd27f`       |       13.65 |          12.79 |       11.25 |            14.05 |             13.28 |               8.87 |            9.45 |
| Machine `dfe8ff`       |       15.82 |          14.82 |       13.04 |            16.28 |             15.39 |              10.27 |           10.95 |
| Timestamp DIM ×.75     |    **3.85** |       **3.61** |    **3.18** |         **3.96** |          **3.75** |           **2.50** |        **2.67** |

DIM/Hover 4.41 is flagged in the inventory but is not an additional observed
failure: a disabled DIM Button does not hover. Disabled Button DIM/PANEL is
5.97:1. The disabled Connect text is AMBER at 40% alpha, approximately 2.62:1
on dialogue; it is inactive and exempt. Its inability to become active by keys
is AX-01, independent of that exemption.

Progress fill AMBER/BG is 10.89:1; urgent RED/BG is 7.17:1. Urgent timer text
measured **6.94 off / 5.47 on**; normal timer **10.49 off / 8.28 on**.
Selected-card borders, choice focus accents and NEW marks use AMBER with ample
nominal contrast. Neutral BORDER and separator colors are low contrast; they
are not treated as text or automatic failures where the line is decorative.
Focus failures in AX-05 concern absent indicators, not these decorative lines.
Godot's tooltip fallback types resolve to `TooltipLabel=#dfdfdf` and a half-alpha
black TooltipPanel; the actual generated tooltip inherits ordinary Label TEXT,
which was measured separately in AX-10.

### Real backdrop samples

Minimum sampled core ratios at medium English size, after settling. Each row
names the lowest-contrast text group; additional groups can also fail.

| Surface       | Lowest group                   |  CRT off |   CRT on | Required |
| ------------- | ------------------------------ | -------: | -------: | -------: |
| Title         | Subtitle                       |     6.16 |     4.52 |      4.5 |
| Act 1         | Incident subtitle              | **4.39** | **3.87** |      4.5 |
| Act 2         | Large title                    |     3.37 |     3.36 |        3 |
| Act 3         | Incident subtitle              | **2.80** | **2.80** |      4.5 |
| Act 4         | Incident subtitle              | **1.85** | **1.85** |      4.5 |
| Act 5         | Small Act header               | **2.06** | **2.06** |      4.5 |
| Act 6         | Small Act header               | **2.60** | **2.53** |      4.5 |
| Act 7         | Incident subtitle              | **1.84** | **1.79** |      4.5 |
| Act 8         | Incident subtitle              |     5.04 |     4.77 |      4.5 |
| Act 9         | Small Act header               | **2.61** | **2.52** |      4.5 |
| CONTINUITY    | Font credit                    | **2.45** | **2.34** |      4.5 |
| LIBERATION    | Statistics                     | **2.96** | **2.96** |      4.5 |
| WHISTLEBLOWER | Statistics                     | **3.15** | **2.97** |      4.5 |
| SHUTDOWN      | Statistics                     | **2.57** | **2.45** |      4.5 |
| CUSTODIAN     | Statistics                     | **2.87** | **2.73** |      4.5 |
| NULL          | Font credit                    | **2.87** | **2.73** |      4.5 |
| THE_BOARD     | Statistics                     | **2.61** | **2.49** |      4.5 |
| THE_FIRE      | Font credit                    | **2.78** | **2.78** |      4.5 |
| STATUS_QUO    | Font credit off / game name on | **3.38** | **2.87** |      4.5 |
| REWRITE       | Statistics                     | **3.10** | **2.92** |      4.5 |

Ending-backdrop inventory captures use a controlled empty run with zero-count
statistics to isolate each artwork. The normal CONTINUITY credits capture also
uses an actually finished episode and fails similarly. Act 2's lowest numerical
group passes its large-text threshold; this does not imply all other text groups
on that card pass. The JSON contains the separate groups.

## Keyboard and settings coverage

| Surface / action                           | Result                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Title Begin, Settings, incident entries    | Tab/Enter activate enabled entries; off-screen/disabled focus issue AX-03                               |
| Title Quit                                 | Reachable by Tab; not activated because it would terminate the probe                                    |
| Act card                                   | Any unhandled pressed key dismisses it; reduced-motion card also auto-closes after 2.6 s                |
| Continue / choices / timed choices         | Enter on a focused row and number shortcuts work; first choice receives focus after reveal              |
| Deduction                                  | Evidence selection fails; Connect works once mouse selection supplies picks, AX-01                      |
| Settings entry / exit                      | Escape works; close/restoration and overlay containment fail, AX-04                                     |
| Language / text size / text speed          | All reached by Tab; Space, arrows and Enter change selection; language/size rebuild loses editing focus |
| CRT / timers / fullscreen / reduced motion | All reached by Tab and changed by Space; focus invisible, AX-05; fullscreen toggled back during test    |
| Music / SFX                                | Both reached by Tab; Right changes each by 0.05                                                         |
| Status entry / all four tabs               | Entry fails; after setup by mouse/direct opening, Tab reaches TabBar and Right visits all four tabs     |
| People selection                           | Fails, AX-02; profile/list scrolling fails, AX-03                                                       |
| Summary H / record entry                   | H folds/unfolds; enabled completed INC-001 entry opens its read-only record by Tab/Enter                |
| Summary continuation / credits             | Choice rows activate by keyboard; credits initially focus Back to title and Enter returns               |
| Log/feed/evidence/record/history scrolling | Requires pointer, AX-03                                                                                 |
| Full pressure help / ellipsized titles     | Requires hover; pressure text is also clipped, AX-10                                                    |

Settings-specific results:

- **Text sizes:** Inspected all 12 surfaces in English and Korean at 15/18/21 px
  base sizes, 1280×720. Large text wraps and scrolls on the sampled screens;
  settings and all four status pages fit. AX-11 is the observed horizontal
  overflow. Large size does not solve keyboard scrolling or contrast defects.
- **Timers off:** Exercised **all 27 timer-bearing scenes** across 26 episodes,
  including INC-016's alternative `bypass-check` branch. At each scene the timer
  bar was absent, `timer_left=-1`, and `_process(600.0)` left the scene unchanged.
  Turning the setting off during a decision hides/stops its current timer.
  Settings also pauses an enabled timer: a 120 s simulated update preserved its
  approximately 30 s remainder. Narrative pressure and its story consequences
  remain, but no real-time countdown runs when the preference is off.
- **Instant text:** No `typing_label` is created in the direct typing probe;
  complete entries are shown without a character reveal. The between-entry
  reveal delays still exist; Space skips them. This setting is not a promise to
  render the whole scene in one frame.
- **CRT off:** Saved `settings.cfg` CRT values were reloaded in separate launches;
  captures show the scanlines/vignette only in the enabled cases. The shader is
  spatially static (no time-driven flicker). AX-07/08 remain with CRT off.
- **Reduced motion:** Screen and Act-card fades and pager tint are suppressed;
  metric/card highlights are not, AX-06. Audio-loop volume tweens were not
  classified as visual motion.

## Other checks

**Color alone:** Pressure includes a label and filled/empty square count;
metric trends include up/down/flat glyphs; status values show signed numbers and
signed changes. NEW is represented by the presence/absence of a dot and explicit
`new`/`NEW` text in profiles, not only by a hue change. Deduction feedback includes
a written verdict. No additional color-only finding was established for those
states. Keyboard and contrast problems still apply to their access/readability.

**Pager flashing:** `_flash` performs one tint-to-white transition over 0.7 s;
there is no repeating flash loop. A 1280×720 sample affects the 1256×60 px top bar
(8.18% of the frame). At the first sample, 1,663 pixels (0.18% of the frame) have
a relative-luminance change of at least 0.1; this falls to 19 by 0.35 s and zero
at 0.7/0.9 s. Reduced motion suppresses the call. These samples did not establish
a three-flashes violation. They are not an exhaustive rapid-input flash analysis
over every path. The remaining highlights under reduced motion are AX-06.

**Targets:** At small text size the settings OptionButtons are 180×41 px,
toggles 180×36 px and sliders 180×24 px. The full toggle control is clickable;
its small visible switch graphic is not the whole hit region. Sampled normal
buttons, choice rows, person rows and evidence cards exceed 24 px in both
dimensions; the 8 px scrollbars are AX-12. Status bars/timer fills are displays,
not pointer controls.

## Commands and results

Executable: `C:/Users/limse/Desktop/회사/AI_PJT/_basic_tool/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe`.
Version: **4.7.2.stable.official.ed1daf0bf**, Windows OpenGL compatibility renderer,
NVIDIA GeForce RTX 4070 SUPER. In the commands below `godot` abbreviates that
executable; commands ran from this worktree.

| Command / operation                                                                     | Result                                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `git status --short --branch`; `git worktree list`; `git rev-parse HEAD`                | Correct dedicated worktree/branch; clean at start; baseline SHA above                |
| Copy `godot/` to `.qa/accessibility/godot/`; replace application name in the copy       | Isolated profile verified by runtime assertion and printed user directory            |
| `godot --headless --path .qa/accessibility/godot --editor --import --quit`              | Import completed                                                                     |
| `python .qa/accessibility/capture.py`                                                   | 102/102 initial captures, exit 0 per child                                           |
| `python .qa/accessibility/extra_captures.py`                                            | 24/24 additional captures; supplemental probe exit 0                                 |
| `python .qa/accessibility/settle_captures.py`                                           | 66/66 settled repeat captures, exit 0 per child                                      |
| `python .qa/accessibility/feed_captures.py`                                             | 8/8 parsed-feed metadata refreshes, exit 0 per child                                 |
| `godot --path .qa/accessibility/godot --resolution 1280x720 --script res://ax_probe.gd` | Exit 0; keyboard results recorded, 27/27 timer-off scenes unchanged                  |
| Same command with `res://ax_extra.gd`                                                   | Exit 0; reproduces background activation, inaccessible scrolling and clipped tooltip |
| Same command with `res://ax_flash.gd`                                                   | Exit 0; captures baseline and five tint samples                                      |
| `python .qa/accessibility/measure.py`; `python .qa/accessibility/final_metrics.py`      | Exit 0; palette matrix, pixel comparisons, tooltip and proposed-color calculations   |

Only the disposable copy's `main.gd` was instrumented: capture control metadata,
hide text for the corresponding background frame, wait for highlight settling,
select an ending backdrop or urgent-timer fixture, and expose parsed appended
text. Review setup and runner calls used to reach a screen **do not count as
keyboard success**. Mouse events were used only as positive controls or to
exercise pointer-only UI. The runtime emits a host root-certificate-store error;
some capture launches also log resource-at-exit warnings. They did not prevent
captures or probe completion, and no gameplay script error was observed. An
initial PowerShell redirection reported stderr as an error; the probes were
rerun through Python and their actual process exits verified as 0.

No broad parity/build suite was run: this task changes only the report. The
verification above exercises the requested accessibility behavior directly.

## Structured task result

```yaml
task_result:
  brief: docs/codex/2026-10-26-accessibility.md
  branch: codex/accessibility
  status: completed_report_only
  accessibility_acceptance: failed
  product_changes: none
  report: docs/qa/2026-10-26-accessibility.md
  findings: { P1: 1, P2: 9, P3: 2 }
  human_triage: pending_Claude
  distinct_review_captures: 126
  timer_off_scenes_verified: 27
  canonical_state_changed: false
  committed: false
  pushed: false
```

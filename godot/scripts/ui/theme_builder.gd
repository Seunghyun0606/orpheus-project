extends RefCounted
## Retro enterprise terminal look, built in code so sizes follow the text-size
## setting. Fonts are bundled (see font()).

const BG := Color("0b0e0c")
const PANEL := Color("111713")
const PANEL_HI := Color("1a241c")
const BORDER := Color("2b3b2e")
const TEXT := Color("d6dfd2")
const DIM := Color("8b978c")
const AMBER := Color("ffb347")
const GREEN := Color("7ddc95")
const CYAN := Color("78c8ff")
const RED := Color("ff7066")
const SIZES := [15, 18, 21]


## IBM Plex Mono for Latin text (as in the web client) over Nanum Gothic
## Coding for Hangul; both are bundled under the SIL Open Font License
## (godot/fonts/*-OFL.txt). Anything else falls back to system fonts.
static func font(weight := 400, italic := false) -> Font:
	var korean: FontFile = load("res://fonts/NanumGothicCoding-Bold.ttf" if weight >= 700 else "res://fonts/NanumGothicCoding-Regular.ttf")
	var path := "res://fonts/ibm-plex-mono-latin-700-normal.woff2" if weight >= 700 else (
		"res://fonts/ibm-plex-mono-latin-400-italic.woff2" if italic else "res://fonts/ibm-plex-mono-latin-400-normal.woff2"
	)
	var latin := FontVariation.new()
	latin.base_font = load(path)
	latin.fallbacks = [korean]
	return latin


static func box(bg: Color, border: Color = BORDER, width := 1, margin := 10) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(width)
	style.set_corner_radius_all(2)
	style.set_content_margin_all(margin)
	return style


static func size(index: int) -> int:
	return SIZES[clampi(index, 0, SIZES.size() - 1)]


static func build(size_index: int) -> Theme:
	var theme := Theme.new()
	var base := size(size_index)
	theme.default_font = font()
	theme.default_font_size = base

	theme.set_color("font_color", "Label", TEXT)
	theme.set_type_variation("HeaderLabel", "Label")
	theme.set_color("font_color", "HeaderLabel", AMBER)
	theme.set_font("font", "HeaderLabel", font(700))
	theme.set_font_size("font_size", "HeaderLabel", base - 2)
	theme.set_type_variation("DimLabel", "Label")
	theme.set_color("font_color", "DimLabel", DIM)
	theme.set_type_variation("TitleLabel", "Label")
	theme.set_color("font_color", "TitleLabel", AMBER)
	theme.set_font("font", "TitleLabel", font(700))
	theme.set_font_size("font_size", "TitleLabel", base * 2 + 6)
	theme.set_type_variation("PromptLabel", "Label")
	theme.set_color("font_color", "PromptLabel", AMBER)
	theme.set_font("font", "PromptLabel", font(700))

	theme.set_color("default_color", "RichTextLabel", TEXT)
	theme.set_font("normal_font", "RichTextLabel", font())
	theme.set_font("bold_font", "RichTextLabel", font(700))
	theme.set_font("italics_font", "RichTextLabel", font(400, true))
	theme.set_font("mono_font", "RichTextLabel", font())
	for item in ["normal_font_size", "bold_font_size", "italics_font_size", "mono_font_size"]:
		theme.set_font_size(item, "RichTextLabel", base)
	theme.set_constant("line_separation", "RichTextLabel", 4)

	theme.set_stylebox("panel", "PanelContainer", box(PANEL))
	theme.set_type_variation("CardPanel", "PanelContainer")
	theme.set_stylebox("panel", "CardPanel", box(PANEL_HI, BORDER, 1, 8))
	theme.set_type_variation("SelectedCard", "PanelContainer")
	theme.set_stylebox("panel", "SelectedCard", box(PANEL_HI.lightened(0.08), AMBER, 2, 8))
	theme.set_type_variation("SelectableCard", "PanelContainer")
	theme.set_stylebox("panel", "SelectableCard", box(PANEL_HI, DIM, 1, 8))

	theme.set_stylebox("normal", "Button", box(PANEL_HI, BORDER, 1, 10))
	theme.set_stylebox("hover", "Button", box(PANEL_HI.lightened(0.06), AMBER, 1, 10))
	theme.set_stylebox("pressed", "Button", box(BG, AMBER, 2, 10))
	theme.set_stylebox("disabled", "Button", box(PANEL, BORDER, 1, 10))
	var focus := box(Color(0, 0, 0, 0), AMBER, 2, 10)
	focus.draw_center = false
	theme.set_stylebox("focus", "Button", focus)
	theme.set_color("font_color", "Button", TEXT)
	theme.set_color("font_hover_color", "Button", AMBER)
	theme.set_color("font_focus_color", "Button", AMBER)
	theme.set_color("font_pressed_color", "Button", AMBER)
	theme.set_color("font_disabled_color", "Button", DIM)

	for item in ["normal", "hover", "pressed", "focus", "hover_pressed"]:
		theme.set_stylebox(item, "CheckButton", StyleBoxEmpty.new())

	theme.set_stylebox("panel", "PopupMenu", box(PANEL, AMBER, 1, 6))
	theme.set_color("font_color", "PopupMenu", TEXT)
	theme.set_color("font_hover_color", "PopupMenu", AMBER)
	theme.set_stylebox("hover", "PopupMenu", box(PANEL_HI, AMBER, 0, 4))

	# Episode layout (Disco Elysium dialogue column, Orwell evidence tray,
	# Hacknet-style ops tiles, Telltale timer bar).
	theme.set_type_variation("TopBar", "PanelContainer")
	var top := box(PANEL, BORDER, 0, 8)
	top.border_width_bottom = 2
	top.border_color = AMBER.darkened(0.55)
	theme.set_stylebox("panel", "TopBar", top)
	theme.set_type_variation("Tile", "PanelContainer")
	theme.set_stylebox("panel", "Tile", box(PANEL_HI, BORDER, 1, 10))
	theme.set_type_variation("ConsolePanel", "PanelContainer")
	theme.set_stylebox("panel", "ConsolePanel", box(Color("070908"), BORDER, 1, 10))
	theme.set_type_variation("DialoguePanel", "PanelContainer")
	var dialogue := box(Color("0e1210"), BORDER, 1, 18)
	dialogue.border_width_left = 3
	dialogue.border_color = AMBER.darkened(0.6)
	theme.set_stylebox("panel", "DialoguePanel", dialogue)
	theme.set_type_variation("TileLabel", "Label")
	theme.set_color("font_color", "TileLabel", DIM)
	theme.set_font_size("font_size", "TileLabel", base - 3)
	theme.set_type_variation("TileValue", "Label")
	theme.set_font("font", "TileValue", font(700))
	theme.set_font_size("font_size", "TileValue", int(base * 1.6))
	theme.set_type_variation("CardBody", "Label")
	theme.set_color("font_color", "CardBody", DIM)
	theme.set_font_size("font_size", "CardBody", base - 3)

	theme.set_type_variation("ChoiceRow", "PanelContainer")
	theme.set_stylebox("panel", "ChoiceRow", box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, 6))
	theme.set_type_variation("ChoiceRowActive", "PanelContainer")
	var row_active := box(PANEL_HI, PANEL_HI, 0, 6)
	row_active.border_width_left = 3
	row_active.border_color = AMBER
	theme.set_stylebox("panel", "ChoiceRowActive", row_active)
	theme.set_type_variation("TrayActive", "PanelContainer")
	theme.set_stylebox("panel", "TrayActive", box(PANEL_HI, AMBER, 2, 10))

	theme.set_type_variation("ChoiceButton", "Button")
	theme.set_stylebox("normal", "ChoiceButton", box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, 6))
	var choice_hover := box(PANEL_HI, PANEL_HI, 0, 6)
	choice_hover.border_width_left = 3
	choice_hover.border_color = AMBER
	theme.set_stylebox("hover", "ChoiceButton", choice_hover)
	theme.set_stylebox("focus", "ChoiceButton", choice_hover)
	theme.set_stylebox("pressed", "ChoiceButton", choice_hover)
	theme.set_color("font_color", "ChoiceButton", Color("e9c88f"))
	theme.set_color("font_hover_color", "ChoiceButton", AMBER.lightened(0.2))
	theme.set_color("font_focus_color", "ChoiceButton", AMBER.lightened(0.2))

	theme.set_stylebox("background", "ProgressBar", box(BG, BORDER, 1, 0))
	theme.set_stylebox("fill", "ProgressBar", box(AMBER, AMBER, 0, 0))

	theme.set_stylebox("separator", "HSeparator", box(BORDER, BORDER, 0, 0))
	return theme

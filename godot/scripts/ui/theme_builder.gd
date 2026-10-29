extends RefCounted
## Retro enterprise terminal look, built in code so sizes follow the text-size
## setting. Fonts are bundled (see font()).

const BG := Color("0b0e0c")
const PANEL := Color("111713")
const PANEL_HI := Color("1a241c")
const BORDER := Color("2b3b2e")
const TEXT := Color("d6dfd2")
## Secondary text. Bright enough for 4.5:1 on every panel, the selected card
## included, under the CRT overlay at its darkest corner (AX-09).
const DIM := Color("aab4ab")
## Clock stamps in the feed and logs: a step below DIM, still 4.5:1 there (AX-08).
const STAMP := Color("9aa69b")
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


## The keyboard focus ring: a 2 px amber outline drawn over the control.
static func ring(margin := 10) -> StyleBoxFlat:
	var style := box(Color(0, 0, 0, 0), AMBER, 2, margin)
	style.draw_center = false
	return style


static func build(size_index: int) -> Theme:
	var base := size(size_index)
	var theme := Theme.new()
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
	# Keyboard focus on a card: a light 3 px frame, apart from the amber of a
	# selected card (AX-01).
	theme.set_type_variation("CardPanelFocus", "PanelContainer")
	theme.set_stylebox("panel", "CardPanelFocus", box(PANEL_HI, TEXT, 3, 8))
	theme.set_type_variation("SelectableCardFocus", "PanelContainer")
	theme.set_stylebox("panel", "SelectableCardFocus", box(PANEL_HI, TEXT, 3, 8))
	theme.set_type_variation("SelectedCardFocus", "PanelContainer")
	theme.set_stylebox("panel", "SelectedCardFocus", box(PANEL_HI.lightened(0.08), TEXT, 3, 8))
	# Opaque backing for text over artwork (Act cards, credits; AX-07).
	theme.set_type_variation("Backing", "PanelContainer")
	theme.set_stylebox("panel", "Backing", box(BG, BORDER, 1, 28))

	theme.set_stylebox("normal", "Button", box(PANEL_HI, BORDER, 1, 10))
	theme.set_stylebox("hover", "Button", box(PANEL_HI.lightened(0.06), AMBER, 1, 10))
	theme.set_stylebox("pressed", "Button", box(BG, AMBER, 2, 10))
	theme.set_stylebox("disabled", "Button", box(PANEL, BORDER, 1, 10))
	theme.set_stylebox("focus", "Button", ring())
	theme.set_color("font_color", "Button", TEXT)
	theme.set_color("font_hover_color", "Button", AMBER)
	theme.set_color("font_focus_color", "Button", AMBER)
	theme.set_color("font_pressed_color", "Button", AMBER)
	theme.set_color("font_disabled_color", "Button", DIM)

	for item in ["normal", "hover", "pressed", "hover_pressed"]:
		theme.set_stylebox(item, "CheckButton", StyleBoxEmpty.new())
	# Focus rings on every keyboard target (AX-05, AX-03).
	theme.set_stylebox("focus", "CheckButton", ring(4))
	theme.set_stylebox("focus", "HSlider", ring(0))
	theme.set_stylebox("focus", "RichTextLabel", ring(0))
	theme.set_stylebox("focus", "ScrollContainer", ring(0))

	# Scroll bars: a 24 px pointer target around an 8 px visible bar (AX-12).
	for pair in [["VScrollBar", true], ["HScrollBar", false]]:
		# Dark, so text scrolled under the bar's strip does not show through it.
		var track := StyleBoxFlat.new()
		track.bg_color = Color(PANEL, 0.9)
		if pair[1]:
			track.content_margin_left = 12
			track.content_margin_right = 12
		else:
			track.content_margin_top = 12
			track.content_margin_bottom = 12
		theme.set_stylebox("scroll", pair[0], track)
		theme.set_stylebox("scroll_focus", pair[0], track)
		for state in [["grabber", BORDER.lightened(0.15)], ["grabber_highlight", DIM], ["grabber_pressed", AMBER]]:
			var thumb := StyleBoxFlat.new()
			thumb.bg_color = state[1]
			thumb.border_color = Color(0, 0, 0, 0)
			thumb.set_corner_radius_all(2)
			if pair[1]:
				thumb.border_width_left = 8
				thumb.border_width_right = 8
				thumb.content_margin_left = 12
				thumb.content_margin_right = 12
				thumb.content_margin_top = 12
				thumb.content_margin_bottom = 12
			else:
				thumb.border_width_top = 8
				thumb.border_width_bottom = 8
				thumb.content_margin_left = 12
				thumb.content_margin_right = 12
				thumb.content_margin_top = 12
				thumb.content_margin_bottom = 12
			theme.set_stylebox(state[0], pair[0], thumb)

	theme.set_stylebox("panel", "PopupMenu", box(PANEL, AMBER, 1, 6))
	# Tooltips on an opaque panel, not Godot's half-transparent default.
	theme.set_stylebox("panel", "TooltipPanel", box(PANEL, BORDER, 1, 8))
	theme.set_color("font_color", "TooltipLabel", TEXT)
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
	theme.set_type_variation("PortraitFrame", "PanelContainer")
	theme.set_stylebox("panel", "PortraitFrame", box(Color("070908"), BORDER, 1, 2))
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
	theme.set_type_variation("CardRich", "RichTextLabel")
	theme.set_color("default_color", "CardRich", DIM)
	for item in ["normal_font_size", "bold_font_size", "italics_font_size", "mono_font_size"]:
		theme.set_font_size(item, "CardRich", base - 3)
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
	# A person row with keyboard focus: the selected bar plus a full outline.
	theme.set_type_variation("ChoiceRowFocus", "PanelContainer")
	var row_focus := box(PANEL_HI, AMBER, 2, 6)
	row_focus.border_width_left = 3
	theme.set_stylebox("panel", "ChoiceRowFocus", row_focus)
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

	# Status window tabs.
	var tab_on := box(PANEL_HI, AMBER, 0, 10)
	tab_on.border_width_bottom = 2
	var tab_off := box(PANEL, BORDER, 0, 10)
	tab_off.border_width_bottom = 1
	var tab_hover := box(PANEL_HI, AMBER.darkened(0.4), 0, 10)
	tab_hover.border_width_bottom = 2
	theme.set_stylebox("tab_selected", "TabContainer", tab_on)
	theme.set_stylebox("tab_unselected", "TabContainer", tab_off)
	theme.set_stylebox("tab_hovered", "TabContainer", tab_hover)
	# Focus on the tab bar: an outline around the current tab, apart from the
	# selected-tab underline (AX-05).
	theme.set_stylebox("tab_focus", "TabContainer", ring(10))
	theme.set_stylebox("panel", "TabContainer", box(Color("0e1210"), BORDER, 1, 0))
	theme.set_stylebox("tabbar_background", "TabContainer", StyleBoxEmpty.new())
	theme.set_color("font_selected_color", "TabContainer", AMBER)
	theme.set_color("font_unselected_color", "TabContainer", DIM)
	theme.set_color("font_hovered_color", "TabContainer", TEXT)
	theme.set_font("font", "TabContainer", font(700))
	return theme

extends RefCounted
## Retro enterprise terminal look, built in code so sizes follow the text-size
## setting. Korean falls back to installed system fonts (no bundled CJK font yet).

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


static func font(weight := 400, italic := false) -> SystemFont:
	var korean := SystemFont.new()
	korean.font_names = PackedStringArray(["Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", "NanumGothic"])
	korean.font_weight = weight
	var latin := SystemFont.new()
	latin.font_names = PackedStringArray(["D2Coding", "Cascadia Mono", "Consolas", "DejaVu Sans Mono"])
	latin.font_weight = weight
	latin.font_italic = italic
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

	theme.set_stylebox("background", "ProgressBar", box(BG, BORDER, 1, 0))
	theme.set_stylebox("fill", "ProgressBar", box(AMBER, AMBER, 0, 0))

	theme.set_stylebox("separator", "HSeparator", box(BORDER, BORDER, 0, 0))
	return theme

extends Control
## Title screen, episode screen and settings (DEC-072, TASK-038).
##
## The episode screen only renders the runner's feed: entries are revealed one
## at a time, then the controls for the current scene appear. All story logic
## lives in story_runner.gd.
##
## Review automation (user args after `--`):
##   --episode=INC-001  --play=c,SESSIONS,d:POOL_AT_LIMIT+IDLE_TRANSACTIONS
##   --lang=ko|en  --select=ID+ID  --settings  --wait=<seconds>  --shot=<png path>
## `c` continues, `t` lets the timer run out, `d:A+B` deduces, anything else
## chooses that option. --wait lets the reveal run in real time before the
## capture. With --shot the screen is captured and the game quits.

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const Settings := preload("res://scripts/ui/settings.gd")
const UiText := preload("res://scripts/ui/ui_text.gd")
const ThemeBuilder := preload("res://scripts/ui/theme_builder.gd")
const CRT_SHADER := preload("res://shaders/crt.gdshader")

const REVEAL_DELAY := {
	"scene": 0.5, "narrate": 0.9, "line": 0.8, "log": 0.35, "metric": 0.3,
	"evidence": 0.6, "choice": 0.4, "deduction": 0.6,
}

var screen: Control
var crt: ColorRect
var settings_layer: Control

var episode := {}
var state := {}
var pending: Array = []
var reveal_wait := 0.0
var timer_left := -1.0
var timer_total := 0.0
var picks: Array = []
var shown_entries := 0

# Episode screen widgets.
var feed: RichTextLabel
var logs: RichTextLabel
var metrics_box: VBoxContainer
var metric_rows := {}
var cards_box: VBoxContainer
var cards := {}
var controls: VBoxContainer
var pressure_label: Label
var timer_bar: ProgressBar
var timer_label: Label
var deduce_label: Label
var connect_button: Button
var option_buttons: Array = []


func _ready() -> void:
	Settings.load_settings()
	var args := _user_args()
	if args.has("lang"):
		Settings.language = args["lang"]
	_apply_settings()
	crt = ColorRect.new()
	crt.set_anchors_preset(Control.PRESET_FULL_RECT)
	crt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = CRT_SHADER
	crt.material = material
	crt.z_index = 100
	add_child(crt)
	crt.visible = Settings.crt
	if args.has("episode") or args.has("play"):
		_start_episode(args.get("episode", "INC-001"))
	else:
		_show_title()
	if args.has("shot"):
		_review(args)


# ---------------------------------------------------------------- screens --

func _replace_screen(next: Control) -> void:
	if screen != null:
		screen.queue_free()
	screen = next
	add_child(screen)
	move_child(screen, 0)


func _show_title() -> void:
	episode = {}
	state = {}
	pending.clear()
	timer_left = -1.0
	var root := _margin(64)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	root.add_child(column)
	column.add_child(_label(UiText.t("title"), "TitleLabel"))
	column.add_child(_label(UiText.t("subtitle"), "DimLabel"))
	column.add_child(_spacer(24))
	column.add_child(_label(UiText.t("incidents"), "HeaderLabel"))
	var first: Button
	for entry in Library.episode_index():
		var button := _button("%s   %s   ·   %s" % [entry["id"], tr(entry["title"]), UiText.t("act") % entry["act"]])
		button.custom_minimum_size.x = 560
		button.pressed.connect(_start_episode.bind(entry["id"]))
		column.add_child(button)
		if first == null:
			first = button
	column.add_child(_spacer(24))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var settings_button := _button(UiText.t("settings"))
	settings_button.pressed.connect(_open_settings)
	row.add_child(settings_button)
	var quit_button := _button(UiText.t("quit"))
	quit_button.pressed.connect(get_tree().quit)
	row.add_child(quit_button)
	column.add_child(row)
	_replace_screen(root)
	if first != null:
		first.grab_focus.call_deferred()


func _start_episode(id: String) -> void:
	episode = Library.load_episode(id)
	if episode.is_empty():
		push_error("Episode %s is missing; run npm run godot:export." % id)
		_show_title()
		return
	state = StoryRunner.start_episode(episode)
	_build_episode_screen()
	_queue_new_entries()


func _build_episode_screen() -> void:
	metric_rows.clear()
	cards.clear()
	picks.clear()
	shown_entries = 0
	var root := _margin(14)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	root.add_child(column)

	var top := HBoxContainer.new()
	top.add_child(_label("%s · %s" % [episode["id"], tr(episode["title"])], "HeaderLabel", false))
	var gap := Control.new()
	gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(gap)
	pressure_label = _label("", "DimLabel", false)
	pressure_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(pressure_label)
	var menu := _button(UiText.t("menu"))
	menu.focus_mode = Control.FOCUS_NONE
	menu.pressed.connect(_open_settings)
	top.add_child(menu)
	column.add_child(top)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	column.add_child(body)

	var left := _panel(UiText.t("telemetry"))
	left.custom_minimum_size.x = 300
	metrics_box = VBoxContainer.new()
	metrics_box.add_theme_constant_override("separation", 4)
	left.get_child(0).add_child(metrics_box)
	left.get_child(0).add_child(HSeparator.new())
	logs = _rich()
	left.get_child(0).add_child(logs)
	body.add_child(left)

	var center := _panel(UiText.t("war_room"))
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center.size_flags_stretch_ratio = 2.0
	feed = _rich()
	feed.gui_input.connect(_on_feed_input)
	center.get_child(0).add_child(feed)
	body.add_child(center)

	var right := _panel(UiText.t("board"))
	right.custom_minimum_size.x = 320
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	cards_box = VBoxContainer.new()
	cards_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cards_box.add_theme_constant_override("separation", 8)
	cards_box.add_child(_label(UiText.t("board_empty"), "DimLabel"))
	scroll.add_child(cards_box)
	right.get_child(0).add_child(scroll)
	body.add_child(right)

	var bottom := PanelContainer.new()
	bottom.custom_minimum_size.y = 170
	controls = VBoxContainer.new()
	controls.add_theme_constant_override("separation", 8)
	bottom.add_child(controls)
	column.add_child(bottom)
	_replace_screen(root)
	_update_pressure()


# ----------------------------------------------------------------- reveal --

func _queue_new_entries() -> void:
	var entries: Array = state["feed"]
	pending.append_array(entries.slice(shown_entries))
	shown_entries = entries.size()
	reveal_wait = 0.15
	_clear_controls()
	if not pending.is_empty():
		controls.add_child(_label(UiText.t("skip"), "DimLabel"))


func _process(delta: float) -> void:
	if settings_layer != null:
		return
	if not pending.is_empty():
		reveal_wait -= delta
		while reveal_wait <= 0.0 and not pending.is_empty():
			var entry: Dictionary = pending.pop_front()
			_render_entry(entry)
			reveal_wait += REVEAL_DELAY.get(entry["kind"], 0.5)
		if pending.is_empty():
			_show_controls()
	elif timer_left > 0.0:
		timer_left -= delta
		_update_timer()
		if timer_left <= 0.0:
			timer_left = -1.0
			_submit({"type": "timeout"})


func _skip_reveal() -> void:
	if pending.is_empty():
		return
	for entry in pending:
		_render_entry(entry)
	pending.clear()
	_show_controls()


func _on_feed_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_skip_reveal()


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	var key: Key = event.keycode
	if key == KEY_ESCAPE:
		if settings_layer != null:
			_close_settings()
		else:
			_open_settings()
	elif settings_layer != null or episode.is_empty():
		return
	elif key == KEY_SPACE and not pending.is_empty():
		_skip_reveal()
	elif key >= KEY_1 and key <= KEY_9 and pending.is_empty():
		var index := key - KEY_1
		if index < option_buttons.size():
			option_buttons[index].emit_signal("pressed")
	else:
		return
	get_viewport().set_input_as_handled()


func _render_entry(entry: Dictionary) -> void:
	var dim := ThemeBuilder.DIM.to_html(false)
	var amber := ThemeBuilder.AMBER.to_html(false)
	var green := ThemeBuilder.GREEN.to_html(false)
	var cyan := ThemeBuilder.CYAN.to_html(false)
	match entry["kind"]:
		"scene":
			var scene := StoryRunner.find_scene(episode, entry["sceneId"])
			if scene.has("title"):
				feed.append_text("\n[color=#%s][b]— %s —[/b][/color]\n" % [amber, _esc(tr(scene["title"]))])
		"narrate":
			feed.append_text("[color=#%s][i]%s[/i][/color]\n" % [dim, _esc(tr(entry["text"]))])
		"line":
			feed.append_text("[color=#%s][b]%s[/b][/color]  %s\n" % [cyan, _esc(_speaker(entry["speaker"])), _esc(tr(entry["text"]))])
		"log":
			var line := "[color=#%s]$ %s[/color]\n" % [green, _esc(tr(entry["text"]))]
			logs.append_text(line)
			feed.append_text("[code]%s[/code]" % line)
		"metric":
			_set_metric(entry)
			feed.append_text("  [color=#%s]%s[/color] %s  [b]%s[/b]\n" % [amber, _arrow(entry), _esc(tr(entry["label"])), _esc(tr(entry["value"]))])
		"evidence":
			var item := _evidence(entry["id"])
			feed.append_text("  [color=#%s]■ %s · %s[/color]\n" % [amber, UiText.t("evidence_added"), _esc(tr(item["title"]))])
			_add_card(item)
		"choice":
			var scene := StoryRunner.find_scene(episode, entry["sceneId"])
			var option := StoryRunner._option(scene, entry["optionId"])
			var late: String = "  [color=#%s](%s)[/color]" % [dim, UiText.t("timed_out")] if entry["timedOut"] else ""
			feed.append_text("[color=#%s][b]▸ %s:[/b] %s[/color]%s\n" % [green, UiText.t("you"), _esc(tr(option["text"])), late])
		"deduction":
			var titles := []
			for id in entry["picks"]:
				titles.append(tr(_evidence(id)["title"]))
			var verdict: String = UiText.t("deduce_right") if entry["correct"] else UiText.t("deduce_wrong")
			var color := green if entry["correct"] else ThemeBuilder.RED.to_html(false)
			feed.append_text("[color=#%s]▸ %s → %s[/color]\n" % [color, _esc(" + ".join(titles)), verdict])
	_update_pressure()


# --------------------------------------------------------------- controls --

func _clear_controls() -> void:
	timer_left = -1.0
	option_buttons.clear()
	timer_bar = null
	deduce_label = null
	connect_button = null
	if controls == null:
		return
	for child in controls.get_children():
		child.queue_free()


func _show_controls() -> void:
	_clear_controls()
	var scene := StoryRunner.current_scene(episode, state)
	_set_cards_selectable(not scene.is_empty() and scene["type"] == "deduction")
	if scene.is_empty():
		_show_summary()
		return
	match scene["type"]:
		"briefing":
			var next := _button(UiText.t("continue"))
			next.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			next.pressed.connect(_submit.bind({"type": "continue"}))
			controls.add_child(next)
			next.grab_focus.call_deferred()
		"choice":
			controls.add_child(_label(tr(scene["prompt"]), "PromptLabel"))
			var options := StoryRunner.available_options(scene, state)
			var grid := GridContainer.new()
			grid.columns = 2 if options.size() > 2 else 1
			grid.add_theme_constant_override("h_separation", 8)
			grid.add_theme_constant_override("v_separation", 8)
			controls.add_child(grid)
			for i in options.size():
				var option: Dictionary = options[i]
				var text := "%d   %s" % [i + 1, tr(option["text"])]
				if option.has("consequence"):
					text += "\n     — %s" % tr(option["consequence"])
				var button := _button(text)
				button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				button.pressed.connect(_submit.bind({"type": "choose", "optionId": option["id"]}))
				grid.add_child(button)
				option_buttons.append(button)
			if scene.has("timer") and Settings.timer:
				timer_total = float(scene["timer"]["seconds"])
				timer_left = timer_total
				var row := HBoxContainer.new()
				timer_bar = ProgressBar.new()
				timer_bar.show_percentage = false
				timer_bar.custom_minimum_size = Vector2(0, 8)
				timer_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				timer_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
				timer_bar.max_value = timer_total
				row.add_child(timer_bar)
				timer_label = _label("", "PromptLabel", false)
				timer_label.custom_minimum_size.x = 70
				timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
				row.add_child(timer_label)
				controls.add_child(row)
				controls.move_child(row, 1)
				_update_timer()
			if not option_buttons.is_empty():
				option_buttons[0].grab_focus.call_deferred()
		"deduction":
			picks.clear()
			controls.add_child(_label(tr(scene["prompt"]), "PromptLabel"))
			deduce_label = _label("", "DimLabel")
			controls.add_child(deduce_label)
			connect_button = _button(UiText.t("connect"))
			connect_button.pressed.connect(func() -> void: _submit({"type": "deduce", "picks": picks.duplicate()}))
			controls.add_child(connect_button)
			_update_deduction()


func _submit(input: Dictionary) -> void:
	timer_left = -1.0
	var result := StoryRunner.apply_input(episode, state, input)
	if result["error"] != "":
		push_warning(result["error"])
		return
	state = result["state"]
	_queue_new_entries()


func _update_timer() -> void:
	if timer_bar == null:
		return
	timer_bar.value = maxf(timer_left, 0.0)
	timer_label.text = UiText.t("seconds") % ceili(maxf(timer_left, 0.0))
	var urgent := timer_left <= 10.0
	timer_label.add_theme_color_override("font_color", ThemeBuilder.RED if urgent else ThemeBuilder.AMBER)


func _update_deduction() -> void:
	if deduce_label == null:
		return
	var scene := StoryRunner.current_scene(episode, state)
	var needed: int = scene["solution"].size()
	deduce_label.text = UiText.t("deduce") % [needed, picks.size(), needed]
	connect_button.disabled = picks.size() != needed
	for id in cards:
		cards[id].theme_type_variation = "SelectedCard" if picks.has(id) else "SelectableCard"


func _update_pressure() -> void:
	if pressure_label == null or state.is_empty():
		return
	var level: int = state["pressure"]
	pressure_label.text = "%s  %s%s   " % [UiText.t("pressure"), "■".repeat(level), "□".repeat(maxi(0, 4 - level))]
	pressure_label.add_theme_color_override("font_color", ThemeBuilder.RED if level >= 2 else ThemeBuilder.DIM)


func _show_summary() -> void:
	controls.add_child(_label(UiText.t("end_title"), "PromptLabel"))
	var lines := []
	for entry in state["feed"]:
		if entry["kind"] != "choice":
			continue
		var scene := StoryRunner.find_scene(episode, entry["sceneId"])
		var option := StoryRunner._option(scene, entry["optionId"])
		var late: String = " (%s)" % UiText.t("timed_out") if entry["timedOut"] else ""
		lines.append("· %s → %s%s" % [tr(scene["prompt"]), tr(option["text"]), late])
	controls.add_child(_label("%s\n%s" % [UiText.t("end_choices"), "\n".join(lines)]))
	var changes := []
	for group in ["values", "alignment"]:
		for key in state[group]:
			var amount: int = state[group][key]
			if amount != 0:
				changes.append("%s %s%d" % [UiText.value_name(key), "+" if amount > 0 else "", amount])
	var changed: String = "   ".join(changes) if not changes.is_empty() else UiText.t("no_change")
	controls.add_child(_label("%s: %s" % [UiText.t("end_changes"), changed], "DimLabel"))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var again := _button(UiText.t("replay"))
	again.pressed.connect(_start_episode.bind(episode["id"]))
	row.add_child(again)
	var back := _button(UiText.t("back"))
	back.pressed.connect(_show_title)
	row.add_child(back)
	controls.add_child(row)
	again.grab_focus.call_deferred()


# ----------------------------------------------------------------- panels --

func _set_metric(entry: Dictionary) -> void:
	var label: String = entry["label"]
	if not metric_rows.has(label):
		var row := _label("")
		metrics_box.add_child(row)
		metric_rows[label] = row
	var row: Label = metric_rows[label]
	row.text = "%s %s   %s" % [_arrow(entry), tr(label), tr(entry["value"])]
	var trend: String = entry.get("trend", "")
	var color := ThemeBuilder.RED if trend == "up" else (ThemeBuilder.GREEN if trend == "down" else ThemeBuilder.TEXT)
	row.add_theme_color_override("font_color", color)


func _add_card(item: Dictionary) -> void:
	if cards.is_empty():
		for child in cards_box.get_children():
			child.queue_free()
	var card := PanelContainer.new()
	card.theme_type_variation = "CardPanel"
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var title := _label(tr(item["title"]), "PromptLabel")
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var body := _label(tr(item["body"]), "DimLabel")
	body.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(title)
	column.add_child(body)
	card.add_child(column)
	card.gui_input.connect(_on_card_input.bind(item["id"]))
	cards_box.add_child(card)
	cards[item["id"]] = card
	card.modulate = Color(1.6, 1.4, 1.0)
	create_tween().tween_property(card, "modulate", Color.WHITE, 0.8)


func _set_cards_selectable(selectable: bool) -> void:
	for id in cards:
		var card: PanelContainer = cards[id]
		card.theme_type_variation = "SelectableCard" if selectable else "CardPanel"
		card.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND if selectable else Control.CURSOR_ARROW


func _on_card_input(event: InputEvent, id: String) -> void:
	if deduce_label == null or not pending.is_empty():
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_toggle_pick(id)


func _toggle_pick(id: String) -> void:
	var needed: int = StoryRunner.current_scene(episode, state)["solution"].size()
	if picks.has(id):
		picks.erase(id)
	elif picks.size() < needed:
		picks.append(id)
	_update_deduction()


# --------------------------------------------------------------- settings --

func _open_settings() -> void:
	if settings_layer != null:
		return
	settings_layer = Control.new()
	settings_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.65)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	settings_layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	settings_layer.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = 460
	center.add_child(panel)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 12)
	panel.add_child(grid)

	grid.add_child(_label(UiText.t("settings"), "HeaderLabel", false))
	grid.add_child(Control.new())
	grid.add_child(_label(UiText.t("language"), "", false))
	var language := OptionButton.new()
	language.add_item("한국어")
	language.add_item("English")
	language.selected = Settings.LANGUAGES.find(Settings.language)
	language.item_selected.connect(func(index: int) -> void: _change_setting("language", Settings.LANGUAGES[index]))
	grid.add_child(language)
	grid.add_child(_label(UiText.t("text_size"), "", false))
	var sizes := OptionButton.new()
	for name in UiText.t("sizes"):
		sizes.add_item(name)
	sizes.selected = Settings.text_size
	sizes.item_selected.connect(func(index: int) -> void: _change_setting("text_size", index))
	grid.add_child(sizes)
	grid.add_child(_label(UiText.t("crt"), "", false))
	var crt_toggle := CheckButton.new()
	crt_toggle.button_pressed = Settings.crt
	crt_toggle.toggled.connect(func(on: bool) -> void: _change_setting("crt", on))
	grid.add_child(crt_toggle)
	grid.add_child(_label(UiText.t("timer"), "", false))
	var timer_toggle := CheckButton.new()
	timer_toggle.button_pressed = Settings.timer
	timer_toggle.toggled.connect(func(on: bool) -> void: _change_setting("timer", on))
	grid.add_child(timer_toggle)
	grid.add_child(Control.new())
	var close := _button(UiText.t("close"))
	close.pressed.connect(_close_settings)
	grid.add_child(close)
	if not episode.is_empty():
		grid.add_child(Control.new())
		var back := _button(UiText.t("back"))
		back.pressed.connect(func() -> void:
			_close_settings()
			_show_title()
		)
		grid.add_child(back)
	add_child(settings_layer)
	move_child(settings_layer, crt.get_index())
	close.grab_focus.call_deferred()


func _close_settings() -> void:
	if settings_layer == null:
		return
	settings_layer.queue_free()
	settings_layer = null


func _change_setting(key: String, value: Variant) -> void:
	match key:
		"language":
			Settings.language = value
		"text_size":
			Settings.text_size = value
		"crt":
			Settings.crt = value
		"timer":
			Settings.timer = value
	Settings.save_settings()
	_apply_settings()
	crt.visible = Settings.crt
	if key == "timer" and not Settings.timer:
		timer_left = -1.0
	if key == "language" or key == "text_size":
		_close_settings()
		_rebuild()
		_open_settings()


func _apply_settings() -> void:
	TranslationServer.set_locale(Settings.language)
	theme = ThemeBuilder.build(Settings.text_size)


## Re-creates the current screen in the new language or size, without replaying
## the reveal; a running decision timer keeps its remaining time.
func _rebuild() -> void:
	if episode.is_empty():
		_show_title()
		return
	var remaining := timer_left
	var selected := picks.duplicate()
	var rest := pending.duplicate()
	_build_episode_screen()
	var entries: Array = state["feed"]
	var visible_count := entries.size() - rest.size()
	for i in visible_count:
		_render_entry(entries[i])
	shown_entries = entries.size()
	pending = rest
	if pending.is_empty():
		_show_controls()
		picks = selected
		_update_deduction()
		if remaining > 0.0 and timer_bar != null:
			timer_left = remaining
			_update_timer()


# ---------------------------------------------------------------- helpers --

func _margin(amount: int) -> MarginContainer:
	var root := MarginContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		root.add_theme_constant_override("margin_" + side, amount)
	return root


func _panel(header: String) -> PanelContainer:
	var panel := PanelContainer.new()
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	column.add_child(_label(header.to_upper() if Settings.language == "en" else header, "HeaderLabel"))
	panel.add_child(column)
	return panel


func _label(text: String, variation := "", wrap := true) -> Label:
	var label := Label.new()
	label.text = text
	if wrap:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	if variation != "":
		label.theme_type_variation = variation
	return label


func _button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	button.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	return button


func _rich() -> RichTextLabel:
	var rich := RichTextLabel.new()
	rich.bbcode_enabled = true
	rich.scroll_following = true
	rich.selection_enabled = false
	rich.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rich.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	return rich


func _spacer(height: int) -> Control:
	var spacer := Control.new()
	spacer.custom_minimum_size.y = height
	return spacer


func _speaker(id: String) -> String:
	for member in episode["cast"]:
		if member["id"] == id:
			return tr(member["name"])
	return id


func _evidence(id: String) -> Dictionary:
	for item in episode["evidence"]:
		if item["id"] == id:
			return item
	return {"title": id, "body": ""}


func _arrow(entry: Dictionary) -> String:
	return {"up": "▲", "down": "▼", "flat": "─"}.get(entry.get("trend", ""), "·")


func _esc(text: String) -> String:
	return text.replace("[", "[lb]")


# ----------------------------------------------------------------- review --

func _user_args() -> Dictionary:
	var args := {}
	for arg in OS.get_cmdline_user_args():
		var parts := arg.trim_prefix("--").split("=", true, 1)
		args[parts[0]] = parts[1] if parts.size() > 1 else "true"
	return args


func _review(args: Dictionary) -> void:
	if args.has("wait"):
		await get_tree().create_timer(float(args["wait"])).timeout
	for step in args.get("play", "").split(",", false):
		_skip_reveal()
		var input := {}
		if step == "c":
			input = {"type": "continue"}
		elif step == "t":
			input = {"type": "timeout"}
		elif step.begins_with("d:"):
			input = {"type": "deduce", "picks": Array(step.substr(2).split("+"))}
		else:
			input = {"type": "choose", "optionId": step}
		_submit(input)
	if not args.has("wait"):
		_skip_reveal()
	for id in args.get("select", "").split("+", false):
		_toggle_pick(id)
	if args.has("settings"):
		_open_settings()
	for i in 4:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	image.save_png(args["shot"])
	print("saved %s" % args["shot"])
	get_tree().quit()

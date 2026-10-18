extends Control
## Title screen, episode screen and settings (DEC-072, TASK-038).
##
## The episode screen only renders the runner's feed: entries are typed out one
## at a time with an in-world clock, then the controls for the current scene
## appear. All story logic lives in story_runner.gd. A finished incident is
## never played again: choosing it opens its record, read-only.
##
## Layout references: the dialogue column with numbered choices inline at its
## foot (Disco Elysium), the evidence tray of cards picked for a deduction
## (Orwell), big ops tiles over a log console (Hacknet) and a thin timer bar
## right above the choices (Telltale).
##
## Review automation (user args after `--`):
##   --episode=INC-001  --play=c,SESSIONS,d:POOL_AT_LIMIT+IDLE_TRANSACTIONS
##   --lang=ko|en  --flags=FLAG+FLAG  --select=ID+ID  --settings  --wait=<seconds>
##   --until=timer|deduction|<scene id>  --status  --reenter  --act-card  --credits  --shot=<png path>
## `c` continues, `t` lets the timer run out, `d:A+B` deduces, anything else
## chooses that option. --flags enters the episode with those campaign flags set
## (saved progress is never touched while capturing). --wait lets the reveal run in real time before the
## capture. --reenter leaves and picks the incident again (record or resume).
## With --shot the screen is captured and the game quits.

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const Settings := preload("res://scripts/ui/settings.gd")
const UiText := preload("res://scripts/ui/ui_text.gd")
const ThemeBuilder := preload("res://scripts/ui/theme_builder.gd")
const Progress := preload("res://scripts/story/progress.gd")
const Sound := preload("res://scripts/ui/sound.gd")
const CRT_SHADER := preload("res://shaders/crt.gdshader")
const WORD_JOINER := "⁠"
## Private-use markers around keywords until the text is turned into BBCode.
const MARK_OPEN := "\ue000"
const MARK_CLOSE := "\ue001"
const KEYWORD_COLOR := "ffd27f"
const PRESSURE_SECONDS := 5

## Pause after each entry has finished typing.
const REVEAL_DELAY := {
	"scene": 0.35, "narrate": 0.45, "line": 0.4, "log": 0.15, "metric": 0.25,
	"evidence": 0.35, "choice": 0.3, "deduction": 0.4,
}
## In-world seconds each kind of entry takes; scene titles that read as a time
## of day (e.g. "02:14") set the clock.
const CLOCK_ADVANCE := {
	"scene": 0, "narrate": 14, "line": 19, "log": 3, "metric": 2,
	"evidence": 5, "choice": 24, "deduction": 31,
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
## Clock stamp ("02:14:09") of each feed entry.
var entry_times := PackedStringArray()
## The label being typed into, and how far.
var typing_label: RichTextLabel
var typing_pos := 0.0
var typing_end := 0
## Showing a finished incident's record: nothing can be chosen.
var viewing_record := false
var restart_armed := false
var sound: Node
var top_bar: PanelContainer
## Full-screen Act title shown when an Act begins; the reveal waits for it.
var act_card: Control
var last_tick_char := 0
## The carry this incident started from (for "what this incident changed").
var entry_carry := {}
var status_layer: Control
## The current episode's keywords in the current language, longest first.
var keyword_cache := PackedStringArray()
var keyword_key := ""
var last_timer_second := -1

# Episode screen widgets.
var feed: RichTextLabel
var logs: RichTextLabel
var metrics_grid: GridContainer
var metric_tiles := {}
var tray: PanelContainer
var tray_header: Label
var tray_scroll: ScrollContainer
var cards_box: HBoxContainer
var cards := {}
var controls: VBoxContainer
var controls_scroll: ScrollContainer
var dialogue_panel: PanelContainer
var scene_label: Label
var pressure_label: Label
var timer_bar: ProgressBar
var timer_label: Label
var deduce_label: Label
var connect_slot: VBoxContainer
var option_actions: Array = []
var progress := {}
var review_flags := {}
## True while capturing review screenshots: saved progress is neither read nor written.
var reviewing := false


func _ready() -> void:
	Settings.load_settings()
	progress = Progress.load_progress()
	var args := _user_args()
	for flag in args.get("flags", "").split("+", false):
		review_flags[flag] = true
	reviewing = args.has("shot")
	if reviewing:
		progress = Progress.empty()
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
	sound = Sound.new()
	add_child(sound)
	_apply_window_mode()
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
	if not Settings.reduce_motion:
		screen.modulate.a = 0.0
		create_tween().tween_property(screen, "modulate:a", 1.0, 0.3)


## Left: the title and the next incident to play. Right: every incident,
## grouped by Act; an Act's name stays hidden until one of its incidents opens.
func _show_title() -> void:
	episode = {}
	state = {}
	pending.clear()
	timer_left = -1.0
	restart_armed = false
	viewing_record = false
	var root := _margin(56)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 48)
	root.add_child(columns)

	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_theme_constant_override("separation", 14)
	columns.add_child(left)
	left.add_child(_label(UiText.t("title"), "TitleLabel"))
	left.add_child(_label(UiText.t("subtitle"), "DimLabel"))
	var seen := Progress.endings_seen()
	if not seen.is_empty():
		left.add_child(_label(UiText.t("endings_seen") % [seen.size(), UiText.t("endings").size()], "PromptLabel", false))
	sound.loop("title")
	left.add_child(_spacer(32))
	var next_id := ""
	for entry in Library.episode_index():
		if Progress.is_unlocked(progress, entry["id"]) and not Progress.is_finished(progress, entry["id"]):
			next_id = entry["id"]
			break
	var first: Button
	if next_id != "":
		var label: String = UiText.t("begin") if progress["after"].is_empty() else UiText.t("resume")
		var play := _button("▸  %s   %s · %s" % [label, next_id, _t(Library.load_episode(next_id)["title"])])
		play.pressed.connect(_start_episode.bind(next_id))
		left.add_child(play)
		first = play
	if not progress["after"].is_empty():
		var restart := _button(UiText.t("restart"))
		restart.pressed.connect(func() -> void:
			if not restart_armed:
				restart_armed = true
				restart.text = UiText.t("confirm_restart")
				return
			restart_armed = false
			progress = Progress.empty()
			_save_progress()
			_show_title()
		)
		left.add_child(restart)
	var settings_button := _button(UiText.t("settings"))
	settings_button.pressed.connect(_open_settings)
	left.add_child(settings_button)
	var quit_button := _button(UiText.t("quit"))
	quit_button.pressed.connect(get_tree().quit)
	left.add_child(quit_button)
	for button in left.get_children():
		if button is Button:
			button.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN

	var list_panel := PanelContainer.new()
	list_panel.theme_type_variation = "ConsolePanel"
	list_panel.custom_minimum_size.x = 520
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	scroll.add_child(list)
	list_panel.add_child(scroll)
	columns.add_child(list_panel)
	list.add_child(_label(_header(UiText.t("incidents")), "HeaderLabel"))
	var act := 0
	for entry in Library.episode_index():
		var id: String = entry["id"]
		var unlocked := Progress.is_unlocked(progress, id)
		if entry["act"] != act:
			act = entry["act"]
			var act_name: String = UiText.t("act_names")[act - 1] if unlocked else "· · ·"
			list.add_child(_spacer(6))
			list.add_child(_label("%s  %s" % [UiText.t("act") % act, act_name], "DimLabel", false))
		var mark: String = "✓" if Progress.is_finished(progress, id) else ("▸" if unlocked else "·")
		var title: String = _t(entry["title"]) if unlocked else UiText.t("locked")
		if Progress.is_finished(progress, id):
			title += "   · " + UiText.t("record")
		elif Progress.in_progress(progress, id):
			title += "   · " + UiText.t("in_progress")
		var button := _button("%s  %s   %s" % [mark, id, title])
		button.disabled = not unlocked
		button.pressed.connect(_start_episode.bind(id))
		list.add_child(button)
	_replace_screen(root)
	if first != null:
		first.grab_focus.call_deferred()


func _start_episode(id: String) -> void:
	episode = Library.load_episode(id)
	if episode.is_empty():
		push_error("Episode %s is missing; run npm run godot:export." % id)
		_show_title()
		return
	if Progress.is_finished(progress, id):
		_show_record(id)
		return
	viewing_record = false
	var carry: Dictionary = Progress.carry_for(progress, id).duplicate(true)
	carry["flags"].merge(review_flags, true)
	var run := Progress.begin(progress, id, carry)
	entry_carry = run["carry"]
	_save_progress()
	state = Progress.replay(episode, run)
	_build_episode_screen()
	sound.loop("ambient")
	if run["inputs"].is_empty():
		_queue_new_entries()
		if _opens_act(id) and (not reviewing or OS.get_cmdline_user_args().has("--act-card")):
			_show_act_card()
	else:
		# Resumed mid-incident: what already happened is shown at once.
		_show_all_entries()
		_show_controls()


## A finished incident, replayed from its record: every message and choice,
## nothing to choose.
func _show_record(id: String) -> void:
	viewing_record = true
	sound.loop("ambient")
	var record: Variant = progress["records"].get(id)
	if record is Dictionary:
		state = Progress.replay(episode, record)
		entry_carry = record["carry"]
	else:
		entry_carry = Progress.carry_for(progress, id)
		state = StoryRunner.start_episode(episode, Progress.carry_for(progress, id))
		state["sceneId"] = null
		state["feed"] = []
	_build_episode_screen()
	_show_all_entries()
	_show_controls()
	if not record is Dictionary:
		controls.add_child(_label(UiText.t("no_record"), "DimLabel"))
		controls.move_child(controls.get_child(controls.get_child_count() - 1), 1)


func _save_progress() -> void:
	if not reviewing:
		Progress.save_progress(progress)


## Top bar over two columns: the ops desk (metric tiles, log console and the
## evidence tray) on the left, the dialogue column on the right.
func _build_episode_screen() -> void:
	metric_tiles.clear()
	cards.clear()
	picks.clear()
	shown_entries = 0
	var root := _margin(12)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	root.add_child(column)

	var top_panel := PanelContainer.new()
	top_panel.theme_type_variation = "TopBar"
	top_bar = top_panel
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 18)
	top_panel.add_child(top)
	top.add_child(_label("VANTAGE // INCIDENT DESK", "DimLabel", false))
	top.add_child(_label("%s · %s" % [episode["id"], _t(episode["title"])], "HeaderLabel", false))
	var gap := Control.new()
	gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(gap)
	scene_label = _label("", "PromptLabel", false)
	top.add_child(scene_label)
	pressure_label = _label("", "DimLabel", false)
	pressure_label.mouse_filter = Control.MOUSE_FILTER_PASS
	pressure_label.tooltip_text = UiText.t("pressure_help")
	top.add_child(pressure_label)
	var status := _button(UiText.t("status"))
	status.focus_mode = Control.FOCUS_NONE
	status.pressed.connect(_open_status)
	top.add_child(status)
	var menu := _button(UiText.t("menu"))
	menu.focus_mode = Control.FOCUS_NONE
	menu.pressed.connect(_open_settings)
	top.add_child(menu)
	column.add_child(top_panel)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	column.add_child(body)

	var desk := VBoxContainer.new()
	desk.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	desk.size_flags_stretch_ratio = 1.5
	desk.add_theme_constant_override("separation", 10)
	body.add_child(desk)

	metrics_grid = GridContainer.new()
	metrics_grid.columns = 3
	metrics_grid.add_theme_constant_override("h_separation", 8)
	metrics_grid.add_theme_constant_override("v_separation", 8)
	desk.add_child(metrics_grid)

	var console := PanelContainer.new()
	console.theme_type_variation = "ConsolePanel"
	console.size_flags_vertical = Control.SIZE_EXPAND_FILL
	console.custom_minimum_size.y = 110
	var console_column := VBoxContainer.new()
	console_column.add_child(_label(_header(UiText.t("logs")), "HeaderLabel"))
	logs = _rich()
	console_column.add_child(logs)
	console.add_child(console_column)
	desk.add_child(console)

	tray = PanelContainer.new()
	tray.theme_type_variation = "Tile"
	tray.custom_minimum_size.y = 210
	var tray_column := VBoxContainer.new()
	tray_column.add_theme_constant_override("separation", 8)
	tray_header = _label("", "HeaderLabel", false)
	tray_column.add_child(tray_header)
	tray_scroll = ScrollContainer.new()
	tray_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	# The tray keeps its height; a long card scrolls inside it rather than
	# pushing the log console up.
	tray_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	cards_box = HBoxContainer.new()
	cards_box.add_theme_constant_override("separation", 8)
	cards_box.add_child(_label(UiText.t("board_empty"), "DimLabel", false))
	tray_scroll.add_child(cards_box)
	tray_column.add_child(tray_scroll)
	tray.add_child(tray_column)
	desk.add_child(tray)
	_update_tray_header()

	var dialogue := PanelContainer.new()
	dialogue.theme_type_variation = "DialoguePanel"
	dialogue.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dialogue.custom_minimum_size.x = 460
	var talk := VBoxContainer.new()
	talk.add_theme_constant_override("separation", 10)
	talk.add_child(_label(_header(UiText.t("war_room")), "HeaderLabel"))
	feed = _rich()
	feed.gui_input.connect(_on_feed_input)
	talk.add_child(feed)
	# Choices sit under the feed and grow with their content, up to most of the
	# column (the finale offers ten); beyond that they scroll.
	controls_scroll = ScrollContainer.new()
	controls_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	controls = VBoxContainer.new()
	controls.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	controls.add_theme_constant_override("separation", 4)
	controls.resized.connect(_fit_controls)
	controls_scroll.add_child(controls)
	talk.add_child(controls_scroll)
	dialogue.add_child(talk)
	dialogue_panel = dialogue
	body.add_child(dialogue)

	_replace_screen(root)
	_update_pressure()


# ----------------------------------------------------------------- reveal --

func _queue_new_entries() -> void:
	var entries: Array = state["feed"]
	entry_times = _clock_times(entries)
	for i in range(shown_entries, entries.size()):
		pending.append(i)
	shown_entries = entries.size()
	reveal_wait = 0.15
	_clear_controls()
	if not pending.is_empty():
		controls.add_child(_label(UiText.t("skip"), "DimLabel"))
	elif typing_label == null:
		# Nothing new to reveal (e.g. continuing past a final scene with no
		# beats): go straight to the next controls or the summary.
		_show_controls()


func _process(delta: float) -> void:
	if settings_layer != null or act_card != null or status_layer != null:
		return
	if typing_label != null:
		# Korean text carries a word joiner between letters (see _t), so it types
		# about twice as many characters for the same words.
		var rate: float = Settings.TYPING_CPS[Settings.text_speed] * (1.9 if Settings.language == "ko" else 1.0)
		typing_pos += delta * rate
		if typing_pos >= typing_end:
			_finish_typing()
			# The last entry finished typing on its own: show what comes next.
			if pending.is_empty():
				_show_controls()
		else:
			typing_label.visible_characters = int(typing_pos)
			# A soft key tick every few letters; the log console ticks brighter.
			if int(typing_pos) - last_tick_char >= 4:
				last_tick_char = int(typing_pos)
				sound.play("log" if typing_label == logs else "type", -10.0, randf_range(0.85, 1.15))
		return
	if not pending.is_empty():
		reveal_wait -= delta
		while reveal_wait <= 0.0 and not pending.is_empty() and typing_label == null:
			var index: int = pending.pop_front()
			_render_entry(index, true)
			reveal_wait = REVEAL_DELAY.get(state["feed"][index]["kind"], 0.4)
		if pending.is_empty() and typing_label == null:
			_show_controls()
	elif timer_left > 0.0:
		timer_left -= delta
		_update_timer()
		if timer_left <= 0.0:
			timer_left = -1.0
			_submit({"type": "timeout"})


func _skip_reveal() -> void:
	if pending.is_empty() and typing_label == null:
		return
	_finish_typing()
	for index in pending:
		_render_entry(index, false)
	pending.clear()
	_show_controls()


func _finish_typing() -> void:
	if typing_label != null:
		typing_label.visible_characters = -1
	typing_label = null


## Renders the whole feed at once (resume, record, language change).
func _show_all_entries() -> void:
	var entries: Array = state["feed"]
	entry_times = _clock_times(entries)
	for i in entries.size():
		_render_entry(i, false)
	shown_entries = entries.size()
	pending.clear()


## Starts typing what was just appended to `label` from character `start`.
func _type(label: RichTextLabel, start: int, animate: bool) -> void:
	if not animate or Settings.TYPING_CPS[Settings.text_speed] <= 0.0:
		return
	typing_label = label
	typing_pos = start
	last_tick_char = start
	typing_end = label.get_total_character_count()
	label.visible_characters = start


## The in-world time of every feed entry: starts at the episode's first
## time-of-day scene title and moves on by what each entry takes.
func _clock_times(entries: Array) -> PackedStringArray:
	var clock := -1
	for scene in episode["scenes"]:
		clock = _time_of_day(scene.get("title", ""))
		if clock >= 0:
			break
	if clock < 0:
		clock = 2 * 3600
	var times := PackedStringArray()
	for entry in entries:
		if entry["kind"] == "scene":
			var at := _time_of_day(StoryRunner.find_scene(episode, entry["sceneId"]).get("title", ""))
			if at >= 0:
				if at < clock and clock - at > 6 * 3600:
					at += 24 * 3600
				clock = maxi(clock, at)
		var seconds := clock % (24 * 3600)
		times.append("%02d:%02d:%02d" % [seconds / 3600, (seconds / 60) % 60, seconds % 60])
		clock += CLOCK_ADVANCE.get(entry["kind"], 5)
	return times


func _time_of_day(text: String) -> int:
	var parts := text.split(":")
	if parts.size() != 2 or not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return -1
	return int(parts[0]) * 3600 + int(parts[1]) * 60


func _on_feed_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_skip_reveal()


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	var key: Key = event.keycode
	if key == KEY_F11:
		Settings.fullscreen = not Settings.fullscreen
		Settings.save_settings()
		_apply_window_mode()
		get_viewport().set_input_as_handled()
		return
	if act_card != null:
		_close_act_card()
		get_viewport().set_input_as_handled()
		return
	if key == KEY_ESCAPE and status_layer != null:
		_close_status()
		get_viewport().set_input_as_handled()
		return
	if key == KEY_ESCAPE:
		if settings_layer != null:
			_close_settings()
		else:
			_open_settings()
	elif settings_layer != null or episode.is_empty():
		return
	elif key == KEY_SPACE and (not pending.is_empty() or typing_label != null):
		_skip_reveal()
	elif key >= KEY_1 and key <= KEY_9 and pending.is_empty():
		var index := key - KEY_1
		if index < option_actions.size():
			option_actions[index].call()
	else:
		return
	get_viewport().set_input_as_handled()


func _render_entry(index: int, animate: bool) -> void:
	var entry: Dictionary = state["feed"][index]
	var dim := ThemeBuilder.DIM.to_html(false)
	var stamp := "[color=#%s]%s[/color]  " % [ThemeBuilder.DIM.darkened(0.25).to_html(false), entry_times[index]]
	var start := 0
	var amber := ThemeBuilder.AMBER.to_html(false)
	var green := ThemeBuilder.GREEN.to_html(false)
	var cyan := ThemeBuilder.CYAN.to_html(false)
	match entry["kind"]:
		"scene":
			var scene := StoryRunner.find_scene(episode, entry["sceneId"])
			if scene.has("title"):
				scene_label.text = _t(scene["title"])
				feed.append_text("\n[center][color=#%s]—  %s  —[/color][/center]\n" % [dim, _esc(_t(scene["title"]))])
		"narrate":
			feed.append_text(stamp)
			start = feed.get_total_character_count()
			feed.append_text("[color=#%s][i]%s[/i][/color]\n\n" % [dim, _rt(entry["text"])])
			_type(feed, start, animate)
		"line":
			var voice := _voice_color(entry["speaker"], cyan)
			if animate and entry["speaker"] == "PAGER":
				sound.play("pager", -4.0)
				_flash(top_bar, Color(1.8, 0.7, 0.6))
			feed.append_text(stamp + "[color=#%s][b]%s[/b][/color] — " % [voice, _esc(_speaker(entry["speaker"]).to_upper())])
			start = feed.get_total_character_count()
			feed.append_text("%s\n\n" % _rt(entry["text"]))
			_type(feed, start, animate)
		"log":
			logs.append_text(stamp)
			start = logs.get_total_character_count()
			logs.append_text("[color=#%s]$ %s[/color]\n" % [green, _rt(entry["text"])])
			_type(logs, start, animate)
		"metric":
			_set_metric(entry)
		"evidence":
			var item := _evidence(entry["id"])
			feed.append_text(stamp)
			start = feed.get_total_character_count()
			feed.append_text("[color=#%s]■ %s — %s[/color]\n\n" % [amber, UiText.t("evidence_added"), _rt(item["title"])])
			_type(feed, start, animate)
			_add_card(item)
			if animate:
				sound.play("evidence", -6.0)
		"choice":
			var scene := StoryRunner.find_scene(episode, entry["sceneId"])
			var option := StoryRunner._option(scene, entry["optionId"])
			var late: String = "  [color=#%s](%s)[/color]" % [dim, UiText.t("timed_out")] if entry["timedOut"] else ""
			feed.append_text(stamp)
			feed.append_text("[color=#%s]▸ %s[/color]%s\n\n" % [amber, _rt(option["text"]), late])
		"deduction":
			var titles := []
			for id in entry["picks"]:
				titles.append(_t(_evidence(id)["title"]))
			var verdict: String = UiText.t("deduce_right") if entry["correct"] else UiText.t("deduce_wrong")
			if animate:
				sound.play("solved" if entry["correct"] else "missed", -6.0)
			var color := green if entry["correct"] else ThemeBuilder.RED.to_html(false)
			feed.append_text(stamp)
			start = feed.get_total_character_count()
			feed.append_text("[color=#%s]▸ %s\n   %s[/color]\n\n" % [color, _esc(" + ".join(titles)), verdict])
			_type(feed, start, animate)
	_update_pressure()


# --------------------------------------------------------------- controls --

func _clear_controls() -> void:
	timer_left = -1.0
	option_actions.clear()
	timer_bar = null
	deduce_label = null
	connect_slot = null
	if controls == null:
		return
	for child in controls.get_children():
		child.queue_free()


func _show_controls() -> void:
	_clear_controls()
	var scene := StoryRunner.current_scene(episode, state)
	_set_tray_selectable(not scene.is_empty() and scene["type"] == "deduction")
	if scene.is_empty() or viewing_record:
		_show_summary()
		return
	var amber := ThemeBuilder.AMBER.to_html(false)
	var dim := ThemeBuilder.DIM.to_html(false)
	match scene["type"]:
		"briefing":
			_add_choice("[color=#%s]▸ %s[/color]" % [amber, UiText.t("continue")], _submit.bind({"type": "continue"}))
		"choice":
			if scene.has("timer") and Settings.timer:
				timer_total = float(_decision_seconds(scene))
				timer_left = timer_total
				var row := HBoxContainer.new()
				row.add_theme_constant_override("separation", 10)
				timer_bar = ProgressBar.new()
				timer_bar.show_percentage = false
				timer_bar.custom_minimum_size = Vector2(0, 6)
				timer_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				timer_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
				timer_bar.max_value = timer_total
				row.add_child(timer_bar)
				timer_label = _label("", "PromptLabel", false)
				row.add_child(timer_label)
				var cut: int = scene["timer"]["seconds"] - _decision_seconds(scene)
				if cut > 0:
					row.add_child(_label(UiText.t("pressure_cut") % cut, "DimLabel", false))
				controls.add_child(row)
				_update_timer()
			controls.add_child(_label(_t(scene["prompt"]), "PromptLabel"))
			var options := StoryRunner.available_options(scene, state)
			for i in options.size():
				var option: Dictionary = options[i]
				var text := "[color=#%s]%d.[/color] %s" % [amber, i + 1, _rt(option["text"])]
				if option.has("consequence"):
					text += "\n    [color=#%s]%s[/color]" % [dim, _esc(_t(option["consequence"]))]
				_add_choice(text, _submit.bind({"type": "choose", "optionId": option["id"]}))
		"deduction":
			picks.clear()
			controls.add_child(_label(_t(scene["prompt"]), "PromptLabel"))
			deduce_label = _label("", "DimLabel")
			controls.add_child(deduce_label)
			connect_slot = VBoxContainer.new()
			controls.add_child(connect_slot)
			_update_deduction()
	if not option_actions.is_empty():
		_focus_first_choice.call_deferred()


func _fit_controls() -> void:
	if controls_scroll == null or dialogue_panel == null:
		return
	var limit := dialogue_panel.size.y * 0.62
	controls_scroll.custom_minimum_size.y = minf(controls.get_combined_minimum_size().y, limit)


func _focus_first_choice() -> void:
	for child in controls.get_children():
		if child is PanelContainer and child.focus_mode == Control.FOCUS_ALL:
			child.grab_focus()
			return


## A numbered dialogue choice: a text row that highlights on hover or focus and
## runs `action` on click, Enter or its number key.
func _add_choice(bbcode: String, action: Callable, enabled := true, parent: Control = null) -> void:
	var row := PanelContainer.new()
	row.theme_type_variation = "ChoiceRow"
	row.focus_mode = Control.FOCUS_ALL if enabled else Control.FOCUS_NONE
	row.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND if enabled else Control.CURSOR_ARROW
	var text := RichTextLabel.new()
	text.bbcode_enabled = true
	text.fit_content = true
	text.scroll_active = false
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	text.text = bbcode
	if not enabled:
		text.modulate = Color(1, 1, 1, 0.4)
	row.add_child(text)
	if enabled:
		row.mouse_entered.connect(row.grab_focus)
		row.focus_entered.connect(func() -> void:
			row.theme_type_variation = "ChoiceRowActive"
		)
		row.focus_exited.connect(func() -> void:
			row.theme_type_variation = "ChoiceRow"
		)
		row.gui_input.connect(func(event: InputEvent) -> void:
			var click: bool = event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT
			if click or event.is_action_pressed("ui_accept"):
				row.accept_event()
				action.call()
		)
		option_actions.append(action)
	(parent if parent != null else controls).add_child(row)


func _submit(input: Dictionary) -> void:
	if viewing_record:
		return
	timer_left = -1.0
	var result := StoryRunner.apply_input(episode, state, input)
	if result["error"] != "":
		push_warning(result["error"])
		return
	Progress.log_input(progress, input)
	_save_progress()
	sound.play("choice", -8.0)
	state = result["state"]
	_queue_new_entries()


func _update_timer() -> void:
	if timer_bar == null:
		return
	timer_bar.value = maxf(timer_left, 0.0)
	timer_label.text = UiText.t("seconds") % ceili(maxf(timer_left, 0.0))
	var urgent := timer_left <= 10.0
	var second := ceili(maxf(timer_left, 0.0))
	if urgent and second != last_timer_second and timer_left > 0.0:
		sound.play("tick", -6.0, 1.0 + (10 - second) * 0.03)
	last_timer_second = second
	timer_label.add_theme_color_override("font_color", ThemeBuilder.RED if urgent else ThemeBuilder.AMBER)
	var fill: StyleBoxFlat = timer_bar.get_theme_stylebox("fill").duplicate()
	fill.bg_color = ThemeBuilder.RED if urgent else ThemeBuilder.AMBER
	timer_bar.add_theme_stylebox_override("fill", fill)


func _update_deduction() -> void:
	if deduce_label == null:
		return
	var scene := StoryRunner.current_scene(episode, state)
	var needed: int = scene["solution"].size()
	deduce_label.text = UiText.t("deduce") % [needed, picks.size(), needed]
	for id in cards:
		cards[id].theme_type_variation = "SelectedCard" if picks.has(id) else "SelectableCard"
	for child in connect_slot.get_children():
		child.queue_free()
	option_actions.clear()
	var ready := picks.size() == needed
	var label := "[color=#%s]▸ %s[/color]" % [ThemeBuilder.AMBER.to_html(false), UiText.t("connect")]
	_add_choice(label, func() -> void: _submit({"type": "deduce", "picks": picks.duplicate()}), ready, connect_slot)
	_update_tray_header()


func _update_pressure() -> void:
	if pressure_label == null or state.is_empty():
		return
	var level: int = state["pressure"]
	pressure_label.text = "%s  %s%s" % [UiText.t("pressure"), "■".repeat(level), "□".repeat(maxi(0, 4 - level))]
	pressure_label.add_theme_color_override("font_color", ThemeBuilder.RED if level >= 2 else ThemeBuilder.DIM)


func _show_summary() -> void:
	if not viewing_record and not Progress.is_finished(progress, episode["id"]):
		Progress.finish(progress, episode["id"], state)
		_save_progress()
	scene_label.text = UiText.t("record_title") if viewing_record else ""
	var ending := _ending()
	if ending != "" and not reviewing:
		Progress.add_ending(ending)
	if ending != "":
		controls.add_child(_label("%s — %s" % [UiText.t("ending"), UiText.t("endings").get(ending, ending)], "TitleLabel", false))
	else:
		controls.add_child(_label(UiText.t("end_title"), "PromptLabel"))
	var lines := []
	for entry in state["feed"]:
		if entry["kind"] != "choice":
			continue
		var scene := StoryRunner.find_scene(episode, entry["sceneId"])
		var option := StoryRunner._option(scene, entry["optionId"])
		var late: String = " (%s)" % UiText.t("timed_out") if entry["timedOut"] else ""
		lines.append("· %s%s" % [_t(option["text"]), late])
	controls.add_child(_label("%s\n%s" % [UiText.t("end_choices"), "\n".join(lines)]))
	var changes := []
	for group in ["values", "alignment"]:
		for key in state[group]:
			var amount := _delta(group, key)
			if amount != 0:
				changes.append("%s %s%d" % [UiText.value_name(key), "+" if amount > 0 else "", amount])
	var changed: String = "   ".join(changes) if not changes.is_empty() else UiText.t("no_change")
	controls.add_child(_label("%s: %s" % [UiText.t("end_changes_now"), changed], "DimLabel"))
	if int(state["pressure"]) > 0:
		controls.add_child(_label(UiText.t("pressure_damage") % [int(state["pressure"]), int(state["pressure"])], "DimLabel"))
	controls.add_child(_label(UiText.t("see_status"), "DimLabel"))
	var amber := ThemeBuilder.AMBER.to_html(false)
	var number := 1
	var next := Progress.next_episode(episode["id"])
	if next != "" and Progress.is_unlocked(progress, next) and not Progress.is_finished(progress, next):
		var next_title: String = _t(Library.load_episode(next)["title"])
		_add_choice("[color=#%s]%d.[/color] %s — %s %s" % [amber, number, UiText.t("next"), next, next_title], _start_episode.bind(next))
		number += 1
	if ending != "":
		_add_choice("[color=#%s]%d.[/color] %s" % [amber, number, UiText.t("credits")], _show_credits.bind(ending))
		number += 1
	_add_choice("[color=#%s]%d.[/color] %s" % [amber, number, UiText.t("back")], _show_title)
	_focus_first_choice.call_deferred()


# ------------------------------------------------------------- ops desk --

func _set_metric(entry: Dictionary) -> void:
	var label: String = entry["label"]
	if not metric_tiles.has(label):
		var tile := PanelContainer.new()
		tile.theme_type_variation = "Tile"
		tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var column := VBoxContainer.new()
		column.add_child(_label(_t(label), "TileLabel"))
		# Long values ("Kestrel Falls · 3h 12m") wrap inside the tile instead of
		# widening the desk and squeezing the dialogue column.
		var value := _label("", "TileValue")
		column.add_child(value)
		tile.add_child(column)
		metrics_grid.add_child(tile)
		metric_tiles[label] = value
		tile.modulate = Color(1.5, 1.4, 1.0)
		create_tween().tween_property(tile, "modulate", Color.WHITE, 0.6)
	var value_label: Label = metric_tiles[label]
	value_label.text = "%s %s" % [_t(entry["value"]), _arrow(entry)]
	var trend: String = entry.get("trend", "")
	var color := ThemeBuilder.RED if trend == "up" else (ThemeBuilder.GREEN if trend == "down" else ThemeBuilder.TEXT)
	value_label.add_theme_color_override("font_color", color)


func _add_card(item: Dictionary) -> void:
	if cards.is_empty():
		for child in cards_box.get_children():
			child.queue_free()
	var card := PanelContainer.new()
	card.theme_type_variation = "CardPanel"
	card.custom_minimum_size.x = 232
	card.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var title := _label(_t(item["title"]), "PromptLabel")
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var body := RichTextLabel.new()
	body.theme_type_variation = "CardRich"
	body.bbcode_enabled = true
	body.fit_content = true
	body.scroll_active = false
	body.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	body.text = _rt(item["body"])
	body.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(title)
	column.add_child(body)
	card.add_child(column)
	card.gui_input.connect(_on_card_input.bind(item["id"]))
	cards_box.add_child(card)
	cards[item["id"]] = card
	card.modulate = Color(1.6, 1.4, 1.0)
	create_tween().tween_property(card, "modulate", Color.WHITE, 0.8)
	_update_tray_header()
	_scroll_tray_to_end.call_deferred()


func _scroll_tray_to_end() -> void:
	if tray_scroll != null:
		tray_scroll.scroll_horizontal = int(tray_scroll.get_h_scroll_bar().max_value)


func _update_tray_header() -> void:
	if tray_header == null:
		return
	var text := "%s · %d" % [_header(UiText.t("board")), cards.size()]
	if deduce_label != null:
		var needed: int = StoryRunner.current_scene(episode, state)["solution"].size()
		text += "    ▸ " + UiText.t("deduce") % [needed, picks.size(), needed]
	tray_header.text = text


func _set_tray_selectable(selectable: bool) -> void:
	tray.theme_type_variation = "TrayActive" if selectable else "Tile"
	_update_tray_header()
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
	grid.add_child(_label(UiText.t("text_speed"), "", false))
	var speeds := OptionButton.new()
	for name in UiText.t("speeds"):
		speeds.add_item(name)
	speeds.selected = Settings.text_speed
	speeds.item_selected.connect(func(index: int) -> void: _change_setting("text_speed", index))
	grid.add_child(speeds)
	for row in [["music", Settings.music_volume], ["sfx", Settings.sfx_volume]]:
		grid.add_child(_label(UiText.t(row[0]), "", false))
		var slider := HSlider.new()
		slider.min_value = 0.0
		slider.max_value = 1.0
		slider.step = 0.05
		slider.value = row[1]
		slider.custom_minimum_size = Vector2(180, 24)
		slider.value_changed.connect(func(v: float) -> void: _change_setting(row[0], v))
		grid.add_child(slider)
	for row in [["fullscreen", Settings.fullscreen], ["reduce_motion", Settings.reduce_motion]]:
		grid.add_child(_label(UiText.t(row[0]), "", false))
		var toggle := CheckButton.new()
		toggle.button_pressed = row[1]
		toggle.toggled.connect(func(on: bool) -> void: _change_setting(row[0], on))
		grid.add_child(toggle)
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
		"text_speed":
			Settings.text_speed = value
		"music":
			Settings.music_volume = value
		"sfx":
			Settings.sfx_volume = value
		"fullscreen":
			Settings.fullscreen = value
		"reduce_motion":
			Settings.reduce_motion = value
	Settings.save_settings()
	sound.apply_volumes()
	if key == "fullscreen":
		_apply_window_mode()
	_apply_settings()
	crt.visible = Settings.crt
	if key == "timer" and not Settings.timer:
		timer_left = -1.0
		if timer_bar != null:
			timer_bar.get_parent().visible = false
	if key == "language" or key == "text_size":
		_close_settings()
		_rebuild()
		_open_settings()


## Pressure costs decision time: five seconds a level, never below fifteen.
func _decision_seconds(scene: Dictionary) -> int:
	var seconds: int = scene["timer"]["seconds"]
	return maxi(mini(15, seconds), seconds - PRESSURE_SECONDS * int(state["pressure"]))


## How much `key` moved since this incident began.
func _delta(group: String, key: String) -> int:
	var before: int = entry_carry.get(group, {}).get(key, 0)
	return int(state[group][key]) - before


## Tendencies (with this incident's change), the company/NULL leaning, the
## decisions that open final actions and the reveals reached so far.
func _open_status() -> void:
	if status_layer != null or state.is_empty():
		return
	status_layer = Control.new()
	status_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.7)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed:
			_close_status()
	)
	status_layer.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	status_layer.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(980, 0)
	center.add_child(panel)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 36)
	panel.add_child(columns)

	var left := VBoxContainer.new()
	left.custom_minimum_size.x = 420
	left.add_theme_constant_override("separation", 8)
	columns.add_child(left)
	left.add_child(_label("%s — %s · %s" % [UiText.t("status"), episode["id"], _t(episode["title"])], "HeaderLabel", false))
	left.add_child(_label(_header(UiText.t("status_values")), "PromptLabel", false))
	var top_value := 10
	for key in state["values"]:
		top_value = maxi(top_value, absi(int(state["values"][key])))
	for key in state["values"]:
		left.add_child(_status_row(UiText.value_name(key), int(state["values"][key]), _delta("values", key), top_value))
	left.add_child(_spacer(6))
	left.add_child(_label(_header(UiText.t("status_alignment")), "PromptLabel", false))
	for key in state["alignment"]:
		left.add_child(_status_row(UiText.value_name(key), int(state["alignment"][key]), _delta("alignment", key), maxi(top_value, 10)))
	left.add_child(_spacer(6))
	left.add_child(_label(UiText.t("status_hint"), "DimLabel"))

	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 6)
	columns.add_child(right)
	for section in [["status_decisions", "decision_flags"], ["status_reveals", "reveal_flags"]]:
		right.add_child(_label(_header(UiText.t(section[0])), "PromptLabel", false))
		var names: Dictionary = UiText.t(section[1])
		var any := false
		for flag in names:
			if state["flags"].get(flag, false):
				right.add_child(_label("·  " + names[flag]))
				any = true
		if not any:
			right.add_child(_label(UiText.t("none_yet"), "DimLabel"))
		right.add_child(_spacer(8))
	var close := _button(UiText.t("close"))
	close.size_flags_horizontal = Control.SIZE_SHRINK_END
	close.pressed.connect(_close_status)
	right.add_child(close)
	add_child(status_layer)
	move_child(status_layer, crt.get_index())
	close.grab_focus.call_deferred()


func _status_row(name: String, value: int, change: int, scale: int) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var label := _label(name, "", false)
	label.custom_minimum_size.x = 120
	row.add_child(label)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(160, 10)
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.max_value = scale
	bar.value = absi(value)
	if value < 0:
		var fill: StyleBoxFlat = bar.get_theme_stylebox("fill").duplicate()
		fill.bg_color = ThemeBuilder.RED
		bar.add_theme_stylebox_override("fill", fill)
	row.add_child(bar)
	row.add_child(_label(str(value), "", false))
	if change != 0:
		row.add_child(_label("(%s %s%d)" % [UiText.t("this_incident"), "+" if change > 0 else "", change], "DimLabel", false))
	return row


func _close_status() -> void:
	if status_layer == null:
		return
	status_layer.queue_free()
	status_layer = null


func _apply_window_mode() -> void:
	var mode := DisplayServer.WINDOW_MODE_FULLSCREEN if Settings.fullscreen else DisplayServer.WINDOW_MODE_WINDOWED
	if DisplayServer.window_get_mode() != mode:
		DisplayServer.window_set_mode(mode)


func _flash(node: CanvasItem, color: Color) -> void:
	if node == null or Settings.reduce_motion:
		return
	node.modulate = color
	create_tween().tween_property(node, "modulate", Color.WHITE, 0.7)


## True when `id` is the first incident of its Act.
func _opens_act(id: String) -> bool:
	var previous_act := 0
	for entry in Library.episode_index():
		if entry["id"] == id:
			return entry["act"] != previous_act
		previous_act = entry["act"]
	return false


func _show_act_card() -> void:
	var act: int = episode["act"]
	act_card = Control.new()
	act_card.set_anchors_preset(Control.PRESET_FULL_RECT)
	act_card.mouse_filter = Control.MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = ThemeBuilder.BG
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	act_card.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	act_card.add_child(center)
	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 12)
	center.add_child(column)
	for line in [
		[UiText.t("act") % act, "HeaderLabel"],
		[UiText.t("act_names")[act - 1], "TitleLabel"],
		["%s · %s" % [episode["id"], _t(episode["title"])], "DimLabel"],
	]:
		var label := _label(line[0], line[1], false)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(label)
	act_card.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed:
			_close_act_card()
	)
	add_child(act_card)
	move_child(act_card, crt.get_index())
	sound.play("pager", -14.0, 0.5)
	if Settings.reduce_motion:
		get_tree().create_timer(2.6).timeout.connect(_close_act_card)
		return
	act_card.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(act_card, "modulate:a", 1.0, 0.6)
	tween.tween_interval(2.0)
	tween.tween_callback(_close_act_card)


func _close_act_card() -> void:
	if act_card == null:
		return
	var card := act_card
	act_card = null
	if Settings.reduce_motion:
		card.queue_free()
		return
	var tween := create_tween()
	tween.tween_property(card, "modulate:a", 0.0, 0.5)
	tween.tween_callback(card.queue_free)


## After an ending: its name, the closing question, the run in numbers, the
## endings seen so far and the credits.
func _show_credits(ending: String) -> void:
	episode = {}
	sound.loop("title")
	var decisions := 0
	var timeouts := 0
	for id in progress["records"]:
		for input in progress["records"][id]["inputs"]:
			if input["type"] == "choose" or input["type"] == "timeout":
				decisions += 1
			if input["type"] == "timeout":
				timeouts += 1
	var root := _margin(64)
	var center := CenterContainer.new()
	root.add_child(center)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 16)
	column.custom_minimum_size.x = 760
	center.add_child(column)
	var lines := [
		[UiText.t("title"), "DimLabel"],
		["%s — %s" % [UiText.t("ending"), UiText.t("endings").get(ending, ending)], "TitleLabel"],
		[UiText.t("closing"), "PromptLabel"],
		[UiText.t("stats") % [progress["records"].size(), decisions, timeouts], "DimLabel"],
	]
	var seen := Progress.endings_seen()
	var names := []
	for key in UiText.t("endings"):
		names.append(UiText.t("endings")[key] if seen.has(key) else "· · ·")
	lines.append([UiText.t("endings_seen") % [seen.size(), names.size()], "HeaderLabel"])
	lines.append(["   ".join(names), "DimLabel"])
	for credit in UiText.t("credit_lines"):
		lines.append([credit, "DimLabel"])
	for line in lines:
		var label := _label(line[0], line[1])
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(label)
	column.add_child(_spacer(12))
	var back := _button(UiText.t("to_title"))
	back.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	back.pressed.connect(_show_title)
	column.add_child(back)
	_replace_screen(root)
	back.grab_focus.call_deferred()


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
	_finish_typing()
	_build_episode_screen()
	var entries: Array = state["feed"]
	entry_times = _clock_times(entries)
	var visible_count := entries.size() - rest.size()
	for i in visible_count:
		_render_entry(i, false)
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


func _header(text: String) -> String:
	return text.to_upper() if Settings.language == "en" else text


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
	# Lay the whole line out first so typed words don't jump between lines.
	rich.visible_characters_behavior = TextServer.VC_CHARS_AFTER_SHAPING
	return rich


func _spacer(height: int) -> Control:
	var spacer := Control.new()
	spacer.custom_minimum_size.y = height
	return spacer


func _speaker(id: String) -> String:
	for member in episode["cast"]:
		if member["id"] == id:
			return _t(member["name"])
	return id


func _evidence(id: String) -> Dictionary:
	for item in episode["evidence"]:
		if item["id"] == id:
			return item
	return {"title": id, "body": ""}


## The machine voices read apart from the people: NULL warm red, ORPHEUS a
## cold white, the platform's automation grey.
func _voice_color(speaker: String, person: String) -> String:
	match speaker:
		"NULL", "UNKNOWN":
			return ThemeBuilder.RED.to_html(false)
		"ORPHEUS", "ADVISOR":
			return "dfe8ff"
		"PLATFORM", "PAGER":
			return ThemeBuilder.DIM.to_html(false)
	return person


func _ending() -> String:
	for flag in state.get("flags", {}):
		if flag.begins_with("ENDING_") and state["flags"][flag]:
			return flag.trim_prefix("ENDING_")
	return ""


func _arrow(entry: Dictionary) -> String:
	return {"up": "▲", "down": "▼", "flat": "─"}.get(entry.get("trend", ""), "")


## Story text in the current language. Korean gets word joiners between the
## letters of each word, so lines only break at spaces (CSS keep-all); ICU
## would otherwise break between any two Hangul syllables.
func _t(text: String) -> String:
	var translated := tr(text)
	return _keep_all(translated) if Settings.language == "ko" else translated


static func _keep_all(text: String) -> String:
	var out := PackedStringArray()
	for i in text.length():
		out.append(text[i])
		if i + 1 < text.length() and _joins(text.unicode_at(i), text.unicode_at(i + 1)):
			out.append(WORD_JOINER)
	return "".join(out)


static func _joins(a: int, b: int) -> bool:
	if a <= 32 or b <= 32 or a == 0x2014 or b == 0x2014:
		return false
	return _hangul(a) or _hangul(b)


static func _hangul(c: int) -> bool:
	return (c >= 0xAC00 and c <= 0xD7A3) or (c >= 0x3131 and c <= 0x318E)


## Story text as BBCode: translated, the episode's keywords in bold, Korean
## kept whole per word, brackets escaped.
func _rt(text: String) -> String:
	var marked := _mark_keywords(tr(text))
	if Settings.language == "ko":
		marked = _keep_all(marked)
	return _esc(marked).replace(MARK_OPEN, "[b][color=#%s]" % KEYWORD_COLOR).replace(MARK_CLOSE, "[/color][/b]")


func _mark_keywords(text: String) -> String:
	var key := "%s/%s" % [episode.get("id", ""), Settings.language]
	if key != keyword_key:
		keyword_key = key
		var words := []
		for keyword in episode.get("keywords", []):
			words.append(tr(keyword).to_lower())
		words.sort_custom(func(a: String, b: String) -> bool: return a.length() > b.length())
		keyword_cache = PackedStringArray(words)
	if keyword_cache.is_empty():
		return text
	# Case-insensitive ("frame B" also bolds "FRAME B"); the text keeps its case.
	var lower := text.to_lower()
	var out := PackedStringArray()
	var i := 0
	while i < text.length():
		var length := 0
		for word in keyword_cache:
			if lower.substr(i, word.length()) == word:
				length = word.length()
				break
		if length > 0:
			out.append(MARK_OPEN + text.substr(i, length) + MARK_CLOSE)
			i += length
		else:
			out.append(text[i])
			i += 1
	return "".join(out)


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
	if args.has("until"):
		# Plays first options / deduction answers until the named kind of scene:
		# "timer" (a timed decision), "deduction", or a scene id.
		for i in 60:
			_skip_reveal()
			var scene := StoryRunner.current_scene(episode, state)
			if scene.is_empty() or scene["id"] == args["until"] or scene["type"] == args["until"] or (args["until"] == "timer" and scene.has("timer")):
				break
			if scene["type"] == "briefing":
				_submit({"type": "continue"})
			elif scene["type"] == "deduction":
				_submit({"type": "deduce", "picks": scene["solution"]})
			else:
				_submit({"type": "choose", "optionId": StoryRunner.available_options(scene, state)[0]["id"]})
	if args.has("reenter"):
		# Leave and choose the incident again: a finished one opens its record,
		# an unfinished one resumes where it was left.
		var id: String = episode["id"]
		_show_title()
		_start_episode(id)
		_skip_reveal()
	for id in args.get("select", "").split("+", false):
		_toggle_pick(id)
	if args.has("settings"):
		_open_settings()
	if args.has("status"):
		_open_status()
	if args.has("credits") and _ending() != "":
		_show_credits(_ending())
	for i in 4:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	image.save_png(args["shot"])
	print("saved %s" % args["shot"])
	get_tree().quit()

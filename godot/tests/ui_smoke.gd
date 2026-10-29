extends SceneTree
## Plays the whole campaign through the real UI (main.gd) three times with
## different choosing strategies, opens each finished incident as a record,
## switches language mid-incident and ends on the credits. Any script error
## shows up in the output; the run fails if an episode does not end.
##
##   npm run godot:smoke  (uses an isolated QA copy and application name)

const Library := preload("res://scripts/story/episode_library.gd")
const Progress := preload("res://scripts/story/progress.gd")
const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Settings := preload("res://scripts/ui/settings.gd")
const CastBook := preload("res://scripts/story/cast_book.gd")
const UiText := preload("res://scripts/ui/ui_text.gd")


func _initialize() -> void:
	var main: Control = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	# Never touch the player's saves.
	main.reviewing = true
	var failures := _regressions(main)
	failures += await _keyboard(main)
	failures += await _save_versions(main)
	var steps := 0
	for strategy in ["first", "last+timeout", "middle"]:
		main.progress = Progress.empty()
		var ending := ""
		for entry in Library.episode_index():
			var id: String = entry["id"]
			main._start_episode(id)
			main._close_act_card()
			var guard := 0
			while guard < 200:
				guard += 1
				main._skip_reveal()
				var scene: Dictionary = StoryRunner.current_scene(main.episode, main.state)
				if scene.is_empty():
					break
				main._submit(_input(scene, main.state, strategy, guard))
				steps += 1
				if guard == 3 and id == "INC-010":
					# Language switch mid-incident rebuilds the screen.
					main._change_setting("language", "en" if Settings.language == "ko" else "ko")
					main._change_setting("language", "ko")
					main._close_settings()
			main._skip_reveal()
			if not StoryRunner.current_scene(main.episode, main.state).is_empty():
				failures += 1
				printerr("%s (%s) did not end" % [id, strategy])
			if not Progress.is_finished(main.progress, id):
				failures += 1
				printerr("%s (%s) was not recorded as finished" % [id, strategy])
			ending = main._ending()
			# Choosing a finished incident opens its record, read-only.
			main._start_episode(id)
			if not main.viewing_record:
				failures += 1
				printerr("%s (%s) did not open as a record" % [id, strategy])
			# Fold the summary away and back; look through every status tab.
			main._toggle_summary()
			if main.summary_body == null or main.summary_body.visible:
				failures += 1
				printerr("%s (%s) summary did not fold" % [id, strategy])
			main._toggle_summary()
			for tab in 4:
				main._open_status(tab)
				main._close_status()
			# Let freed screens go, as between real frames.
			await process_frame
		# By the final record the whole recurring cast has been met.
		var met: int = main._people().size()
		if met < CastBook.characters().size() - 1:
			failures += 1
			printerr("%s run met only %d of %d people" % [strategy, met, CastBook.characters().size()])
		if ending == "":
			failures += 1
			printerr("%s run reached no ending" % strategy)
		else:
			main._show_credits(ending)
			print("%s: ending %s" % [strategy, ending])
	# Every ending, with all gate flags set: each final action ends its episode
	# and names its ending.
	var gates := ["MANUAL_READY", "CORE_LOCATED", "HUMAN_JUDGMENT", "BOARD_ALLIED", "BOARD_CASE_FILED",
		"NULL_TRUSTED", "ARCHIVE_SAVED", "ARCHIVE_KEEPER", "PLURAL_REVIEW_DRAFTED"]
	var final_options: Array = StoryRunner.find_scene(Library.load_episode("INC-026"), "final")["options"]
	for option in final_options:
		main.progress = Progress.empty()
		for flag in gates:
			main.review_flags[flag] = true
		main._start_episode("INC-026")
		for i in 40:
			main._skip_reveal()
			var scene: Dictionary = StoryRunner.current_scene(main.episode, main.state)
			if scene.is_empty():
				break
			var input := {"type": "continue"}
			if scene["id"] == "final":
				input = {"type": "choose", "optionId": option["id"]}
			elif scene["type"] == "choice":
				input = {"type": "choose", "optionId": StoryRunner.available_options(scene, main.state)[0]["id"]}
			main._submit(input)
		main._skip_reveal()
		var ending: String = main._ending()
		if ending == "" or not Progress.is_finished(main.progress, "INC-026"):
			failures += 1
			printerr("final action %s did not reach an ending" % option["id"])
		else:
			print("final %s -> %s" % [option["id"], ending])
		steps += 1
	main.review_flags.clear()
	# Real time: no skipping, the reveal, typing and timers run frame by frame
	# (as when a player just waits), with the interruptions a player causes:
	# leaving and resuming, opening settings and switching language while text
	# types. Every scene must offer its controls on its own.
	for strategy in ["first", "last+timeout", "middle"]:
		var result: Array = await _realtime(main, strategy)
		steps += result[0]
		failures += result[1]
	main._show_title()
	await process_frame
	print("ui smoke: %d inputs, %d failures" % [steps, failures])
	# Release the test-owned scene (including active audio players) before the
	# SceneTree quits. The mixer needs wall-clock time to retire playbacks;
	# headless process_frame yields alone can finish before its next mix.
	main.sound.loop_player.stop()
	for player in main.sound.players:
		player.stop()
	await create_timer(0.1).timeout
	main.queue_free()
	await process_frame
	await process_frame
	quit(1 if failures > 0 else 0)


## Fixed bugs from the 2026-10-25 QA review, at INC-001's first timed decision:
## keys behind the status window, the timer setting turned back on, the time
## left surviving a trip to the title, and UNKNOWN before its log line.
func _regressions(main: Control) -> int:
	var failures := 0
	var had_timer: bool = Settings.timer
	if not had_timer:
		main._change_setting("timer", true)
		main._close_settings()
	main.progress = Progress.empty()
	main._start_episode("INC-001")
	main._close_act_card()
	if _met(main, "NULL"):
		failures += 1
		printerr("UNKNOWN is listed before its log line")
	var scene: Dictionary = {}
	for step in 40:
		main._skip_reveal()
		scene = StoryRunner.current_scene(main.episode, main.state)
		if scene.is_empty() or scene.has("timer"):
			break
		main._submit(_input(scene, main.state, "first", step))
	if scene.is_empty():
		printerr("INC-001 has no timed decision")
		return failures + 1
	main._process(5.0)
	var left: float = main.timer_left
	main._show_title()
	main._start_episode("INC-001")
	if absf(main.timer_left - left) > 0.01:
		failures += 1
		printerr("resuming reset the timer: %.1f -> %.1f" % [left, main.timer_left])
	main._change_setting("timer", false)
	main._change_setting("timer", true)
	main._close_settings()
	if main.timer_left <= 0.0:
		failures += 1
		printerr("turning the timer back on did not restart it")
	main._open_status(main.PEOPLE_TAB)
	var key := InputEventKey.new()
	key.keycode = KEY_1
	key.pressed = true
	main._unhandled_input(key)
	main._close_status()
	if main.state["sceneId"] != scene["id"]:
		failures += 1
		printerr("a number key chose behind the status window")
	if not had_timer:
		main._change_setting("timer", false)
		main._close_settings()
	for step in 40:
		main._skip_reveal()
		scene = StoryRunner.current_scene(main.episode, main.state)
		if scene.is_empty():
			break
		main._submit(_input(scene, main.state, "first", step))
	main._skip_reveal()
	if not _met(main, "NULL"):
		failures += 1
		printerr("UNKNOWN is not listed after INC-001")
	print("regressions: %d failures" % failures)
	return failures


## Keyboard-only play from the 2026-10-26 accessibility review, with real key
## events sent through Input as a player's keyboard would: overlays keep focus
## to themselves and give it back (AX-04), the first deduction is solved with
## the keys alone (AX-01), the status window opens, changes tab and chooses a
## person (AX-02), and reduced motion leaves no highlight running (AX-06).
func _keyboard(main: Control) -> int:
	var failures := 0
	main.progress = Progress.empty()
	main._show_title()
	await _frames(2)
	var opener: Control = root.gui_get_focus_owner()
	if opener == null:
		failures += 1
		printerr("keyboard: the title has no focused control")
	# Settings over the title: Tab stays inside, Escape gives focus back.
	await _press(KEY_ESCAPE)
	if main.settings_layer == null:
		printerr("keyboard: Escape did not open settings")
		return failures + 1
	for i in 24:
		await _press(KEY_TAB)
		var owner: Control = root.gui_get_focus_owner()
		if owner == null or not main.settings_layer.is_ancestor_of(owner):
			failures += 1
			printerr("keyboard: Tab left the settings dialog for %s" % owner)
			break
	await _press(KEY_ESCAPE)
	if main.settings_layer != null or root.gui_get_focus_owner() != opener:
		failures += 1
		printerr("keyboard: closing settings did not give focus back to %s" % opener)
	# A language change rebuilds the dialog with the language control focused.
	await _press(KEY_ESCAPE)
	main.settings_controls["language"].grab_focus()
	var language: String = Settings.language
	main._change_setting("language", "en" if language == "ko" else "ko")
	await _frames(2)
	if root.gui_get_focus_owner() != main.settings_controls["language"]:
		failures += 1
		printerr("keyboard: a language change lost the language control's focus")
	main._change_setting("language", language)
	await _frames(2)
	await _press(KEY_ESCAPE)
	var back: Control = root.gui_get_focus_owner()
	if back == null or not main.screen.is_ancestor_of(back):
		failures += 1
		printerr("keyboard: after a rebuild, closing settings left no focus on the title")

	# INC-001 by keys: Space shows the text, Enter takes the focused choice.
	main._start_episode("INC-001")
	main._close_act_card()
	var scene: Dictionary = {}
	for step in 80:
		await _frames(2)
		scene = StoryRunner.current_scene(main.episode, main.state)
		if scene.is_empty() or scene["type"] == "deduction" and main.deduce_label != null:
			break
		if not main.pending.is_empty() or main.typing_label != null:
			await _press(KEY_SPACE)
			continue
		var focused: Control = root.gui_get_focus_owner()
		if focused == null or not focused.has_meta("choice"):
			failures += 1
			printerr("keyboard: no choice has focus at %s" % scene["id"])
			return failures
		await _press(KEY_ENTER)
	if scene.is_empty() or scene["type"] != "deduction":
		printerr("keyboard: INC-001 reached no deduction")
		return failures + 1
	# The deduction: focus starts on a card; Enter and Space pick, Tab reaches Connect.
	var deduction: String = scene["id"]
	if not main.cards.values().has(root.gui_get_focus_owner()):
		failures += 1
		printerr("keyboard: the deduction did not focus a card")
	var keys := [KEY_ENTER, KEY_SPACE]
	for i in scene["solution"].size():
		var id: String = scene["solution"][i]
		for tab in 30:
			if root.gui_get_focus_owner() == main.cards[id]:
				break
			await _press(KEY_TAB)
		await _press(keys[i % 2])
		if not main.picks.has(id) or not main.card_titles[id].text.begins_with("✓"):
			failures += 1
			printerr("keyboard: %s was not picked from the keyboard" % id)
	for tab in 30:
		var owner: Control = root.gui_get_focus_owner()
		if owner != null and main.connect_slot != null and main.connect_slot.is_ancestor_of(owner):
			break
		await _press(KEY_TAB)
	await _press(KEY_ENTER)
	await _frames(2)
	if main.state["sceneId"] == deduction or main.state["attempts"] > 0:
		failures += 1
		printerr("keyboard: Connect did not solve the deduction (%s)" % main.picks)
	# Status: S opens it on the tab bar, Right changes tab, Tab and Down choose a person.
	main._skip_reveal()
	await _frames(2)
	var before: Control = root.gui_get_focus_owner()
	main.status_tab = 0
	await _press(KEY_S)
	if main.status_layer == null:
		printerr("keyboard: S did not open the status window")
		return failures + 1
	for i in 3:
		await _press(KEY_RIGHT)
	if main.status_tab != main.PEOPLE_TAB:
		failures += 1
		printerr("keyboard: Right did not reach the People tab (%d)" % main.status_tab)
	await _press(KEY_TAB)
	var first_person: String = main.status_person
	await _press(KEY_DOWN)
	if main._people().size() > 1 and main.status_person == first_person:
		failures += 1
		printerr("keyboard: Down did not choose another person")
	for i in 24:
		await _press(KEY_TAB)
		var owner: Control = root.gui_get_focus_owner()
		if owner == null or not main.status_layer.is_ancestor_of(owner):
			failures += 1
			printerr("keyboard: Tab left the status window for %s" % owner)
			break
	await _press(KEY_ESCAPE)
	if main.status_layer != null or (before != null and root.gui_get_focus_owner() != before):
		failures += 1
		printerr("keyboard: closing the status window did not give focus back")
	main.status_tab = 0
	main.status_person = ""
	# Reduced motion: new metric tiles and evidence cards arrive without a
	# highlight tween (AX-06).
	var motion: bool = Settings.reduce_motion
	Settings.reduce_motion = true
	main.progress = Progress.empty()
	main._start_episode("INC-001")
	main._close_act_card()
	main._skip_reveal()
	# Earlier screens (and their fades) are freed at the end of the frame.
	await _frames(2)
	for node in main.metrics_grid.get_children() + main.cards.values():
		if node.modulate != Color.WHITE:
			failures += 1
			printerr("keyboard: %s is highlighted under reduced motion" % node)
			break
	if main.visual_tweens.any(func(t: Tween) -> bool: return t.is_valid() and t.is_running()):
		failures += 1
		printerr("keyboard: a visual tween runs under reduced motion")
	Settings.reduce_motion = motion
	print("keyboard: %d failures" % failures)
	return failures


## Saves of a changed episode (specs/architecture/story-episode-format.md,
## "Save versions"): a run in progress restarts and says so once; a record
## says it changed and takes its numbers from the saved outcome; a run on a
## scene the episode lost shows an error instead of closing.
func _save_versions(main: Control) -> int:
	var failures := 0
	main.progress = Progress.empty()
	main._start_episode("INC-001")
	main._close_act_card()
	main._skip_reveal()
	main._submit(_input(StoryRunner.current_scene(main.episode, main.state), main.state, "first", 0))
	main.progress["current"]["content"] = "an older version"
	main._show_title()
	main._start_episode("INC-001")
	main._close_act_card()
	if main.run_notice != Progress.RESTARTED or not main.progress["current"]["inputs"].is_empty():
		failures += 1
		printerr("save versions: a changed episode did not restart its run (%s)" % main.run_notice)
	main._skip_reveal()
	var told := false
	for child in main.controls.get_children():
		if child is Label and child.text == UiText.t("notice_restarted"):
			told = true
	if not told:
		failures += 1
		printerr("save versions: the restart was not shown")
	main._show_title()
	main._start_episode("INC-001")
	main._close_act_card()
	if main.run_notice != "":
		failures += 1
		printerr("save versions: the restart notice came back")
	# A scene the episode no longer has: an error line, and the run stays open.
	main._skip_reveal()
	main.state["sceneId"] = "a-scene-that-was-removed"
	main._show_controls()
	await process_frame
	var shown := false
	for child in main.controls.get_children():
		if child is Label and child.text.contains("a-scene-that-was-removed"):
			shown = true
	if not shown or Progress.is_finished(main.progress, "INC-001"):
		failures += 1
		printerr("save versions: a missing scene did not show the content error")
	# A record of a changed episode.
	main.progress = Progress.empty()
	main._start_episode("INC-001")
	main._close_act_card()
	for step in 60:
		main._skip_reveal()
		var scene: Dictionary = StoryRunner.current_scene(main.episode, main.state)
		if scene.is_empty():
			break
		main._submit(_input(scene, main.state, "first", step))
	main._skip_reveal()
	main.progress["records"]["INC-001"]["content"] = "an older version"
	main._start_episode("INC-001")
	if not main.viewing_record or main.record_numbers != main.progress["after"]["INC-001"]:
		failures += 1
		printerr("save versions: a changed record does not read its saved outcome")
	var noted := false
	for child in main.controls.get_children():
		if child is Label and child.text == UiText.t("record_changed"):
			noted = true
	if not noted:
		failures += 1
		printerr("save versions: a changed record carries no note")
	main._show_title()
	print("save versions: %d failures" % failures)
	return failures


## A key pressed and released, as from a keyboard, then the frames it takes.
func _press(key: Key) -> void:
	for pressed in [true, false]:
		var event := InputEventKey.new()
		event.keycode = key
		event.physical_keycode = key
		event.pressed = pressed
		Input.parse_input_event(event)
	await _frames(2)


func _frames(count: int) -> void:
	for i in count:
		await process_frame


func _met(main: Control, id: String) -> bool:
	for person in main._people():
		if person["id"] == id:
			return true
	return false


## Advances frames until the scene offers its controls (or ends).
func _wait_ready(main: Control) -> bool:
	for frame in 4000:
		main._process(0.25)
		if StoryRunner.current_scene(main.episode, main.state).is_empty():
			return true
		if main.pending.is_empty() and main.typing_label == null and (not main.option_actions.is_empty() or main.deduce_label != null):
			return true
	return false


## Advances frames until something is being typed (or the reveal is over).
func _until_typing(main: Control) -> void:
	for frame in 400:
		if main.typing_label != null or main.pending.is_empty():
			return
		main._process(0.05)


func _realtime(main: Control, strategy: String) -> Array:
	var steps := 0
	var failures := 0
	main.progress = Progress.empty()
	for entry in Library.episode_index():
		var id: String = entry["id"]
		main._start_episode(id)
		if main.act_card != null:
			# Shown for a new Act; the reveal waits until the player clicks it away.
			main._process(1.0)
			main._close_act_card()
		var missed_once := false
		for step in 200:
			# Interruptions while text is still coming in.
			if step % 6 == 4:
				_until_typing(main)
				main._open_settings()
				main._process(5.0)
				main._close_settings()
			if step % 7 == 3:
				_until_typing(main)
				main._change_setting("language", "en")
				main._change_setting("language", "ko")
				main._close_settings()
			if step % 5 == 2:
				main._show_title()
				main._start_episode(id)
			if not _wait_ready(main):
				failures += 1
				printerr("%s (%s) stuck in real time at %s" % [id, strategy, main.state["sceneId"]])
				break
			var scene: Dictionary = StoryRunner.current_scene(main.episode, main.state)
			if scene.is_empty():
				break
			if strategy == "last+timeout" and scene.has("timer") and step % 2 == 0:
				# Let the decision timer run out on its own.
				var before: String = scene["id"]
				for frame in 800:
					main._process(0.25)
					if main.state["sceneId"] != before:
						break
				if main.state["sceneId"] == before:
					failures += 1
					printerr("%s (%s) timer did not expire at %s" % [id, strategy, before])
					break
				steps += 1
				continue
			var input := _input(scene, main.state, "first" if strategy == "last+timeout" and scene["type"] == "deduction" else strategy, step)
			if scene["type"] == "deduction" and not missed_once:
				# Miss once so the hint plays and the retry must come back.
				var wrong := []
				for evidence in main.state["collected"]:
					if not scene["solution"].has(evidence) and wrong.size() < scene["solution"].size():
						wrong.append(evidence)
				if wrong.size() == scene["solution"].size():
					input = {"type": "deduce", "picks": wrong}
					missed_once = true
			main._submit(input)
			steps += 1
		for frame in 4000:
			main._process(0.25)
			if Progress.is_finished(main.progress, id):
				break
		if not Progress.is_finished(main.progress, id):
			failures += 1
			printerr("%s (%s) did not finish in real time" % [id, strategy])
		await process_frame
	print("real time %s: %d inputs, %d failures" % [strategy, steps, failures])
	return [steps, failures]


func _input(scene: Dictionary, state: Dictionary, strategy: String, step: int) -> Dictionary:
	match scene["type"]:
		"briefing":
			return {"type": "continue"}
		"deduction":
			if strategy == "last+timeout" and state["attempts"] == 0:
				var wrong := []
				for id in state["collected"]:
					if not scene["solution"].has(id) and wrong.size() < scene["solution"].size():
						wrong.append(id)
				if wrong.size() == scene["solution"].size():
					return {"type": "deduce", "picks": wrong}
			return {"type": "deduce", "picks": scene["solution"]}
	var options := StoryRunner.available_options(scene, state)
	if strategy == "last+timeout":
		if scene.has("timer") and step % 2 == 0:
			return {"type": "timeout"}
		return {"type": "choose", "optionId": options[-1]["id"]}
	if strategy == "middle":
		return {"type": "choose", "optionId": options[options.size() / 2]["id"]}
	return {"type": "choose", "optionId": options[0]["id"]}

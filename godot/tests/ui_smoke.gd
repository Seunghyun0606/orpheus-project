extends SceneTree
## Plays the whole campaign through the real UI (main.gd) three times with
## different choosing strategies, opens each finished incident as a record,
## switches language mid-incident and ends on the credits. Any script error
## shows up in the output; the run fails if an episode does not end.
##
##   godot --headless --path godot --script res://tests/ui_smoke.gd

const Library := preload("res://scripts/story/episode_library.gd")
const Progress := preload("res://scripts/story/progress.gd")
const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Settings := preload("res://scripts/ui/settings.gd")
const CastBook := preload("res://scripts/story/cast_book.gd")


func _initialize() -> void:
	var main: Control = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	# Never touch the player's saves.
	main.reviewing = true
	var failures := _regressions(main)
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

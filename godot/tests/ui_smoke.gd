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


func _initialize() -> void:
	var main: Control = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	# Never touch the player's saves.
	main.reviewing = true
	var failures := 0
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
	# Real time: no skipping, the reveal and typing run frame by frame (as when
	# a player just waits); every scene must offer its controls on its own.
	main.progress = Progress.empty()
	for entry in Library.episode_index():
		var id: String = entry["id"]
		main._start_episode(id)
		main._close_act_card()
		var missed_once := false
		for step in 200:
			var ready := false
			for frame in 4000:
				main._process(0.25)
				if main.pending.is_empty() and main.typing_label == null and (not main.option_actions.is_empty() or main.deduce_label != null):
					ready = true
					break
			var scene: Dictionary = StoryRunner.current_scene(main.episode, main.state)
			if scene.is_empty():
				break
			if not ready:
				failures += 1
				printerr("%s stuck in real time at %s" % [id, scene["id"]])
				break
			var input := _input(scene, main.state, "first", step)
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
			printerr("%s did not finish in real time" % id)
	main._show_title()
	await process_frame
	print("ui smoke: %d inputs, %d failures" % [steps, failures])
	quit(1 if failures > 0 else 0)


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

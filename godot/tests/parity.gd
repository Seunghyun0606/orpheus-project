extends SceneTree
## Plays every enumerated path (tests/fixtures/*.paths.json, written by
## `node scripts/story/export-godot.mjs --fixtures`) through the GDScript runner
## and compares each final state with the TypeScript reference runner's.
##
##   godot --headless --path godot --script res://tests/parity.gd

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const FIXTURES := "res://tests/fixtures/"


func _initialize() -> void:
	var total := 0
	var failures := 0
	var files := DirAccess.get_files_at(FIXTURES)
	for file in files:
		if not file.ends_with(".paths.json"):
			continue
		var fixture: Dictionary = Library.read_json(FIXTURES + file)
		var episode := Library.load_episode(fixture["episode"])
		for run in fixture["runs"]:
			for path in run["paths"]:
				total += 1
				var problem := _play(episode, run["carry"], path)
				if problem != "":
					failures += 1
					if failures <= 5:
						printerr("%s path %d: %s" % [fixture["episode"], total, problem])
	print("parity: %d/%d paths match the reference runner" % [total - failures, total])
	quit(1 if failures > 0 or total == 0 else 0)


func _play(episode: Dictionary, carry: Dictionary, path: Dictionary) -> String:
	var state := StoryRunner.start_episode(episode, carry)
	for input in path["inputs"]:
		var result := StoryRunner.apply_input(episode, state, input)
		if result["error"] != "":
			return "input %s rejected: %s" % [JSON.stringify(input), result["error"]]
		state = result["state"]
	var actual := JSON.stringify(Library.normalize(state), "", true)
	var expected := JSON.stringify(path["state"], "", true)
	if actual == expected:
		return ""
	var at := 0
	while at < mini(actual.length(), expected.length()) and actual[at] == expected[at]:
		at += 1
	return "state differs near ...%s... (expected ...%s...)" % [
		actual.substr(maxi(0, at - 60), 120), expected.substr(maxi(0, at - 60), 120),
	]

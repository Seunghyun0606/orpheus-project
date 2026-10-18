extends RefCounted
## Campaign progress (DEC-072).
##
## - `after[id]`: the carry an episode ended with; the next episode starts from it.
## - `records[id]`: how a finished episode was played (entry carry + inputs). A
##   finished episode is never played again; its record replays read-only.
## - `current`: the episode in progress (entry carry + inputs so far), so leaving
##   mid-incident resumes at the same point instead of starting over.
## The runner is deterministic, so carries and inputs reproduce every state.
## These functions only change the dictionary; the caller decides when to save.

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const PATH := "user://campaign.json"
## Endings seen survive "start over".
const ENDINGS_PATH := "user://endings.json"


static func empty() -> Dictionary:
	return {"after": {}, "records": {}, "current": null}


static func load_progress() -> Dictionary:
	var progress: Variant = null
	if FileAccess.file_exists(PATH):
		progress = Library.normalize(JSON.parse_string(FileAccess.get_file_as_string(PATH)))
	if not (progress is Dictionary and progress.get("after") is Dictionary):
		return empty()
	if not progress.get("records") is Dictionary:
		progress["records"] = {}
	if not progress.has("current"):
		progress["current"] = null
	return progress


static func save_progress(progress: Dictionary) -> void:
	var file := FileAccess.open(PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(progress, "  ", true))


static func _previous(id: String) -> String:
	var previous := ""
	for entry in Library.episode_index():
		if entry["id"] == id:
			return previous
		previous = entry["id"]
	return previous


static func next_episode(id: String) -> String:
	var found := false
	for entry in Library.episode_index():
		if found:
			return entry["id"]
		found = entry["id"] == id
	return ""


static func is_unlocked(progress: Dictionary, id: String) -> bool:
	var previous := _previous(id)
	return previous == "" or progress["after"].has(previous)


static func is_finished(progress: Dictionary, id: String) -> bool:
	return progress["after"].has(id)


static func in_progress(progress: Dictionary, id: String) -> bool:
	var current: Variant = progress.get("current")
	return current is Dictionary and current["id"] == id


static func carry_for(progress: Dictionary, id: String) -> Dictionary:
	var previous := _previous(id)
	if previous != "" and progress["after"].has(previous):
		return progress["after"][previous]
	return StoryRunner.empty_carry()


## Starts `id`, or returns the saved run when it was left mid-incident.
static func begin(progress: Dictionary, id: String, carry: Dictionary) -> Dictionary:
	if not in_progress(progress, id):
		progress["current"] = {"id": id, "carry": carry, "inputs": []}
	return progress["current"]


static func log_input(progress: Dictionary, input: Dictionary) -> void:
	if progress.get("current") is Dictionary:
		progress["current"]["inputs"].append(input)


static func finish(progress: Dictionary, id: String, state: Dictionary) -> void:
	progress["after"][id] = {
		"values": state["values"].duplicate(),
		"alignment": state["alignment"].duplicate(),
		"flags": state["flags"].duplicate(),
	}
	if in_progress(progress, id):
		progress["records"][id] = progress["current"]
		progress["current"] = null


static func endings_seen() -> Array:
	if not FileAccess.file_exists(ENDINGS_PATH):
		return []
	var seen: Variant = JSON.parse_string(FileAccess.get_file_as_string(ENDINGS_PATH))
	return seen if seen is Array else []


static func add_ending(ending: String) -> void:
	var seen := endings_seen()
	if not seen.has(ending):
		seen.append(ending)
		var file := FileAccess.open(ENDINGS_PATH, FileAccess.WRITE)
		if file != null:
			file.store_string(JSON.stringify(seen))


## Replays a run (entry carry + inputs) to its current state.
static func replay(episode: Dictionary, run: Dictionary) -> Dictionary:
	var state := StoryRunner.start_episode(episode, run["carry"])
	for input in run["inputs"]:
		var result := StoryRunner.apply_input(episode, state, input)
		if result["error"] != "":
			push_warning("Saved input no longer applies: %s" % result["error"])
			break
		state = result["state"]
	return state

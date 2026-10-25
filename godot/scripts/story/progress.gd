extends RefCounted
## Campaign progress (DEC-072).
##
## - `after[id]`: the carry an episode ended with; the next episode starts from it.
## - `records[id]`: how a finished episode was played (entry carry + inputs). A
##   finished episode is never played again; its record replays read-only.
## - `current`: the episode in progress (entry carry + inputs so far), so leaving
##   mid-incident resumes at the same point instead of starting over. Left
##   during a timed decision, it also keeps the time left (`timer`).
## - `cast_seen`: profile lines the player has looked at in the status window,
##   so new people and new lines can be marked.
## The runner is deterministic, so carries and inputs reproduce every state.
## These functions only change the dictionary; the caller decides when to save.

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const PATH := "user://campaign.json"
## The save before the last one, used when the campaign file is unreadable.
const BACKUP_PATH := "user://campaign.bak.json"
## Endings seen survive "start over".
const ENDINGS_PATH := "user://endings.json"


static func empty() -> Dictionary:
	return {"after": {}, "records": {}, "current": null, "cast_seen": []}


static func load_progress() -> Dictionary:
	var progress := _read(PATH)
	if progress.is_empty():
		progress = _read(BACKUP_PATH)
	if progress.is_empty():
		return empty()
	if not progress.get("records") is Dictionary:
		progress["records"] = {}
	if not progress.has("current"):
		progress["current"] = null
	if not progress.get("cast_seen") is Array:
		progress["cast_seen"] = []
	return progress


static func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var progress: Variant = Library.normalize(JSON.parse_string(FileAccess.get_file_as_string(path)))
	return progress if progress is Dictionary and progress.get("after") is Dictionary else {}


## Written beside the save and then swapped in, so a crash mid-write never
## leaves a half-written campaign; the previous save stays as the backup.
static func save_progress(progress: Dictionary) -> void:
	var temp := PATH + ".tmp"
	var file := FileAccess.open(temp, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(progress, "  ", true))
	file.close()
	if FileAccess.file_exists(PATH):
		DirAccess.remove_absolute(BACKUP_PATH)
		DirAccess.rename_absolute(PATH, BACKUP_PATH)
	DirAccess.rename_absolute(temp, PATH)


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


## Replays a run (entry carry + inputs) to its current state. An input that no
## longer applies (the content changed) cuts the run back to the inputs before
## it, so play goes on from there instead of returning to it on every resume.
static func replay(episode: Dictionary, run: Dictionary) -> Dictionary:
	var state := StoryRunner.start_episode(episode, run["carry"])
	var inputs: Array = run["inputs"]
	for i in inputs.size():
		var result := StoryRunner.apply_input(episode, state, inputs[i])
		if result["error"] != "":
			push_warning("Saved input no longer applies: %s" % result["error"])
			run["inputs"] = inputs.slice(0, i)
			run.erase("timer")
			break
		state = result["state"]
	return state

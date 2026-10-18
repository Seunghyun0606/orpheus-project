extends RefCounted
## Campaign progress: what each finished episode hands to the next one.
##
## An episode starts with the carry its predecessor (in index order) ended
## with, so replaying INC-001 changes how INC-002 opens. The save is just those
## carries; episodes themselves are replayed from their data.

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const PATH := "user://campaign.json"


static func load_progress() -> Dictionary:
	var progress: Variant = null
	if FileAccess.file_exists(PATH):
		progress = Library.normalize(JSON.parse_string(FileAccess.get_file_as_string(PATH)))
	if not (progress is Dictionary and progress.get("after") is Dictionary):
		progress = {"after": {}}
	return progress


static func save_progress(progress: Dictionary) -> void:
	var file := FileAccess.open(PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(progress, "  ", true))


static func reset() -> Dictionary:
	var progress := {"after": {}}
	save_progress(progress)
	return progress


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


static func carry_for(progress: Dictionary, id: String) -> Dictionary:
	var previous := _previous(id)
	if previous != "" and progress["after"].has(previous):
		return progress["after"][previous]
	return StoryRunner.empty_carry()


static func finish(progress: Dictionary, id: String, state: Dictionary) -> void:
	progress["after"][id] = {
		"values": state["values"].duplicate(),
		"alignment": state["alignment"].duplicate(),
		"flags": state["flags"].duplicate(),
	}
	save_progress(progress)

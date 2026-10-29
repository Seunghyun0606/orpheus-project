extends RefCounted
## Campaign progress (DEC-072).
##
## - `after[id]`: the carry an episode ended with; the next episode starts from it.
##   It is written once, at the episode's END, and never recomputed.
## - `records[id]`: how a finished episode was played (entry carry + inputs). A
##   finished episode is never played again; its record replays read-only.
## - `current`: the episode in progress (entry carry + inputs so far), so leaving
##   mid-incident resumes at the same point instead of starting over. Left
##   during a timed decision, it also keeps the time left (`timer`).
## - `cast_seen`: profile lines the player has looked at in the status window,
##   so new people and new lines can be marked.
## The runner is deterministic, so carries and inputs reproduce every state.
## These functions only change the dictionary; the caller decides when to save.
##
## Save versions (specs/architecture/story-episode-format.md, "Save versions"):
## - `version` is the shape of this file (SAVE_VERSION). An older file is copied
##   aside unchanged, then upgraded step by step in `_upgrade`; a newer one is
##   copied aside and not read.
## - Each run keeps the `content` version of the episode it was played on (the
##   exporter's `contentVersion`). Wording edits keep it; any other edit changes it.
##   A current run whose episode changed is carried over by MIGRATIONS when one is
##   declared, otherwise it starts the incident again from its entry carry. A
##   record is never changed: it replays as far as it still applies, and `check`
##   tells the screen that it no longer matches what was played.

const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const PATH := "user://campaign.json"
## The save before the last one, used when the campaign file is unreadable.
const BACKUP_PATH := "user://campaign.bak.json"
## Endings seen survive "start over".
const ENDINGS_PATH := "user://endings.json"
## A save from another version is copied here, unchanged, before it is upgraded
## (or set aside, when it is newer than this build).
const VERSION_COPY := "user://campaign.v%d.json"
const SAVE_VERSION := 1

## Saved runs of a changed episode, carried over to the episode as it is now.
## By episode ID, then by the content version the run was played on:
##   {"to": "<content version>",
##    "options": {"<scene id>": {"OLD_OPTION": "NEW_OPTION"}},
##    "evidence": {"OLD_EVIDENCE": "NEW_EVIDENCE"}}
## Scene IDs are as they are now. An entry without maps declares the change
## compatible (old inputs mean the same). Entries chain (`to` may have its own
## entry). A carried-over run must replay every input, or it starts again.
## Empty while the game is unreleased: a changed episode restarts its run.
const MIGRATIONS := {}

## `check` statuses.
const SAME := "same"
const MIGRATED := "migrated"
const CHANGED := "changed"
## Notices for the screen after `begin` (see take_notice).
const RESTARTED := "restarted"
const STOPPED := "stopped"


static func empty() -> Dictionary:
	return {"version": SAVE_VERSION, "after": {}, "records": {}, "current": null, "cast_seen": []}


static func load_progress() -> Dictionary:
	for path in [PATH, BACKUP_PATH]:
		var progress := _read(path)
		if not progress.is_empty():
			return _upgrade(progress, path)
	return empty()


static func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var progress: Variant = Library.normalize(JSON.parse_string(FileAccess.get_file_as_string(path)))
	return progress if progress is Dictionary and progress.get("after") is Dictionary else {}


static func _upgrade(progress: Dictionary, path: String) -> Dictionary:
	var saved: Variant = progress.get("version", 0)
	var version: int = saved if saved is int else 0
	if version != SAVE_VERSION:
		var copy := VERSION_COPY % version
		if not FileAccess.file_exists(copy):
			DirAccess.copy_absolute(path, copy)
	if version > SAVE_VERSION:
		push_warning("%s was saved by a newer version (%d); kept as %s." % [path, version, VERSION_COPY % version])
		return empty()
	for from in range(version, SAVE_VERSION):
		match from:
			0:
				# Before save versions (0.1.0 development): runs have no `content`,
				# so they read as played on changed content. Nothing to rewrite.
				pass
	progress["version"] = SAVE_VERSION
	if not progress.get("records") is Dictionary:
		progress["records"] = {}
	if not progress.has("current"):
		progress["current"] = null
	if not progress.get("cast_seen") is Array:
		progress["cast_seen"] = []
	return progress


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


## An incident opens when the one before it has closed. One the player has
## started or finished stays open whatever the campaign order became, and one
## added before a point the player already reached stays closed (`is_passed`).
static func is_unlocked(progress: Dictionary, id: String) -> bool:
	if is_finished(progress, id) or in_progress(progress, id):
		return true
	var previous := _previous(id)
	return (previous == "" or is_finished(progress, previous)) and not is_passed(progress, id)


## True for an incident the campaign gained before a later incident the player
## has started or finished: it is not played in this campaign (a new one has it).
static func is_passed(progress: Dictionary, id: String) -> bool:
	var found := false
	for entry in Library.episode_index():
		if found and (is_finished(progress, entry["id"]) or in_progress(progress, entry["id"])):
			return not is_finished(progress, id) and not in_progress(progress, id)
		found = found or entry["id"] == id
	return false


static func is_finished(progress: Dictionary, id: String) -> bool:
	return progress["after"].has(id)


static func in_progress(progress: Dictionary, id: String) -> bool:
	var current: Variant = progress.get("current")
	return current is Dictionary and current["id"] == id


## The carry of the last finished incident before `id` (an incident passed by
## is skipped, so its gap carries nothing).
static func carry_for(progress: Dictionary, id: String) -> Dictionary:
	var carry: Variant = null
	for entry in Library.episode_index():
		if entry["id"] == id:
			break
		if progress["after"].has(entry["id"]):
			carry = progress["after"][entry["id"]]
	return carry if carry != null else StoryRunner.empty_carry()


## Starts `id`, or returns the saved run when it was left mid-incident, brought
## in line with the episode as it is now (`_repair`). `episode` defaults to the
## exported one.
static func begin(progress: Dictionary, id: String, carry: Dictionary, episode := {}, migrations := MIGRATIONS) -> Dictionary:
	if in_progress(progress, id):
		if episode.is_empty():
			episode = Library.load_episode(id)
		if not episode.is_empty():
			_repair(progress["current"], episode, migrations)
	else:
		var content: String = episode.get("contentVersion", "") if not episode.is_empty() else Library.content_version(id)
		progress["current"] = {"id": id, "content": content, "carry": carry, "inputs": []}
	return progress["current"]


## Same content: kept, or cut back to the inputs that still apply (only an
## invalid export gets there). Changed content: carried over by a migration, or
## started again from its entry carry. Either change leaves a `notice`.
static func _repair(run: Dictionary, episode: Dictionary, migrations: Dictionary) -> void:
	var result := check(episode, run, migrations)
	var state: Dictionary = result["state"]
	if result["status"] == SAME and not result["complete"]:
		push_warning("Saved input no longer applies; resuming at the last point that does.")
		run["inputs"] = result["inputs"]
		run.erase("timer")
		run["notice"] = STOPPED
	elif result["status"] == MIGRATED and result["complete"]:
		run["inputs"] = result["inputs"]
		run["content"] = episode.get("contentVersion", "")
	elif result["status"] != SAME:
		if not run["inputs"].is_empty():
			run["inputs"] = []
			run.erase("timer")
			run["notice"] = RESTARTED
			state = StoryRunner.start_episode(episode, run["carry"])
		run["content"] = episode.get("contentVersion", "")
	# Time left belongs to a timed decision; a scene that lost its timer drops it.
	if run.has("timer") and not StoryRunner.current_scene(episode, state).has("timer"):
		run.erase("timer")


## Why `begin` changed the saved run (RESTARTED or STOPPED), once; "" otherwise.
static func take_notice(progress: Dictionary) -> String:
	var current: Variant = progress.get("current")
	if not current is Dictionary or not current.has("notice"):
		return ""
	var notice: String = current["notice"]
	current.erase("notice")
	return notice


static func log_input(progress: Dictionary, input: Dictionary) -> void:
	if progress.get("current") is Dictionary:
		progress["current"]["inputs"].append(input)


## Only a run that reached END finishes: a state left on a scene the episode
## no longer has (invalid content) keeps the run in progress.
static func finish(progress: Dictionary, id: String, state: Dictionary) -> void:
	if state.get("sceneId") != null:
		push_warning("%s has not reached END (scene \"%s\"); it stays in progress." % [id, state.get("sceneId")])
		return
	progress["after"][id] = {
		"values": state["values"].duplicate(),
		"alignment": state["alignment"].duplicate(),
		"flags": state["flags"].duplicate(),
	}
	if in_progress(progress, id):
		var record: Dictionary = progress["current"]
		record.erase("timer")
		record.erase("notice")
		progress["records"][id] = record
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


## The state a run (entry carry + inputs) has reached. Read-only: the run is
## never changed (a current run is repaired once, by `begin`).
static func replay(episode: Dictionary, run: Dictionary) -> Dictionary:
	return check(episode, run)["state"]


## Replays a run against the episode as it is now, without changing it:
## {state, inputs (as applied, after any migration), complete (every input
## applied), status (SAME, MIGRATED or CHANGED)}. Replay stops before the first
## input that does not apply or that leads to a scene the episode does not have.
## CHANGED means the state is a best effort and need not match what was played.
static func check(episode: Dictionary, run: Dictionary, migrations := MIGRATIONS) -> Dictionary:
	var content: String = run.get("content", "")
	var status := SAME
	var steps: Array = []
	if content != episode.get("contentVersion", ""):
		var chain: Variant = _chain(episode, content, migrations)
		status = MIGRATED if chain != null else CHANGED
		if chain != null:
			steps = chain
	var state := StoryRunner.start_episode(episode, run["carry"])
	var inputs := []
	var complete := true
	for input in run["inputs"]:
		var applied := _migrate(input, state["sceneId"], steps)
		var result := StoryRunner.apply_input(episode, state, applied)
		var next: Dictionary = result["state"]
		if result["error"] != "" or (next["sceneId"] != null and StoryRunner.current_scene(episode, next).is_empty()):
			complete = false
			break
		inputs.append(applied)
		state = next
	return {"state": state, "inputs": inputs, "complete": complete, "status": status}


static func _chain(episode: Dictionary, from: String, migrations: Dictionary) -> Variant:
	var table: Dictionary = migrations.get(episode["id"], {})
	var steps := []
	var version := from
	while version != episode.get("contentVersion", ""):
		if not table.has(version) or steps.size() >= table.size():
			return null
		steps.append(table[version])
		version = table[version]["to"]
	return steps


static func _migrate(input: Dictionary, scene_id: Variant, steps: Array) -> Dictionary:
	if steps.is_empty():
		return input
	var out := input.duplicate(true)
	for step in steps:
		if out.has("optionId") and scene_id != null:
			out["optionId"] = step.get("options", {}).get(scene_id, {}).get(out["optionId"], out["optionId"])
		if out.has("picks"):
			var picks := []
			for id in out["picks"]:
				picks.append(step.get("evidence", {}).get(id, id))
			out["picks"] = picks
	return out


## Renames campaign flags in every saved carry: each `after`, and the entry
## carry of the current run and of every record. For a save-version step in
## `_upgrade`; a flag nothing reads any more can simply stay. A carry that
## already has the new name keeps its own value.
static func rename_flags(progress: Dictionary, names: Dictionary) -> void:
	var carries: Array = progress["after"].values()
	for record in progress["records"].values():
		carries.append(record["carry"])
	if progress.get("current") is Dictionary:
		carries.append(progress["current"]["carry"])
	for carry in carries:
		var flags: Dictionary = carry["flags"]
		for old in names:
			if flags.has(old):
				if not flags.has(names[old]):
					flags[names[old]] = flags[old]
				flags.erase(old)

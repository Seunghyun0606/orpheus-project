extends SceneTree
## Run with `npm run godot:saves`. Fixed Progress paths are safe only in the
## helper's QA project with a fresh application name. Refuse a direct run.

const Progress := preload("res://scripts/story/progress.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const StoryRunner := preload("res://scripts/story/story_runner.gd")
const CastBook := preload("res://scripts/story/cast_book.gd")

var failures := 0
var checks := 0


func _initialize() -> void:
	var project := ProjectSettings.globalize_path("res://").replace("\\", "/")
	if not project.contains("/.qa/verification/") or not str(ProjectSettings.get_setting("application/config/name")).begins_with("Orpheus Verification saves-"):
		printerr("save recovery: refusing to write outside the isolated godot.mjs saves project")
		quit(1)
		return
	print("save recovery user directory: %s" % OS.get_user_data_dir())
	var backup := Progress.empty()
	backup["cast_seen"] = ["BACKUP_SENTINEL"]
	for broken in ['{"after":', 'not json', '[]', '{"after": []}']:
		_write(Progress.PATH, broken)
		_write(Progress.BACKUP_PATH, JSON.stringify(backup))
		_expect(Progress.load_progress() == backup, "broken primary falls back: %s" % broken)
	_write(Progress.PATH, '{"after":')
	_write(Progress.BACKUP_PATH, 'not json')
	_expect(Progress.load_progress() == Progress.empty(), "both broken gives an empty campaign")
	var primary := Progress.empty()
	primary["cast_seen"] = ["PRIMARY_SENTINEL"]
	_write(Progress.PATH, JSON.stringify(primary))
	_write(Progress.BACKUP_PATH, JSON.stringify(backup))
	_expect(Progress.load_progress() == primary, "valid primary takes precedence over valid backup")
	_write(Progress.PATH, JSON.stringify({"after": {}}))
	_expect(Progress.load_progress() == Progress.empty(), "legacy save without cast_seen/records/current loads")
	# Save versions: an older file is copied aside unchanged, then upgraded; a
	# newer one is copied aside and not read (the next save would replace it).
	_expect(Progress.load_progress()["version"] == Progress.SAVE_VERSION, "legacy save is upgraded to the current version")
	_expect(FileAccess.get_file_as_string(Progress.VERSION_COPY % 0) == JSON.stringify({"after": {}}), "legacy bytes kept before the upgrade")
	var newer := JSON.stringify({"version": Progress.SAVE_VERSION + 1, "after": {"INC-001": StoryRunner.empty_carry()}, "future": true})
	_write(Progress.PATH, newer)
	_expect(Progress.load_progress() == Progress.empty(), "a save from a newer version is not read")
	_expect(FileAccess.get_file_as_string(Progress.VERSION_COPY % (Progress.SAVE_VERSION + 1)) == newer, "newer save kept unchanged beside it")
	# Use real episode data and real replay: a valid prefix, a removed option,
	# and a suffix that would otherwise be accepted. Stop at the prefix state.
	var episode := Library.load_episode("INC-001")
	var carry := StoryRunner.empty_carry()
	var first := {"type": "continue"}
	var expected: Dictionary = StoryRunner.apply_input(episode, StoryRunner.start_episode(episode, carry), first)["state"]
	var scene := StoryRunner.current_scene(episode, expected)
	var removed := {"type": "choose", "optionId": "REMOVED_OPTION_VERIFICATION"}
	var suffix := {"type": "choose", "optionId": StoryRunner.available_options(scene, expected)[0]["id"]}
	var saved := Progress.empty()
	saved["current"] = {"id": "INC-001", "content": Library.content_version("INC-001"), "carry": carry, "inputs": [first, removed, suffix]}
	Progress.save_progress(saved)
	var loaded := Progress.load_progress()
	_expect(Progress.in_progress(loaded, "INC-001"), "incompatible current run loads")
	var read_only: Dictionary = loaded["current"].duplicate(true)
	_expect(Progress.replay(episode, loaded["current"]) == expected, "removed option stops replay at last valid point")
	_expect(loaded["current"] == read_only, "replay alone never changes the run")
	# Playing on after that recovery must stick: resuming cuts the stale input
	# away, so the next choice is kept on the following resume (VR-01).
	Progress.begin(loaded, "INC-001", carry)
	_expect(loaded["current"]["inputs"] == [first], "resume cuts the run back to the inputs that apply")
	_expect(Progress.take_notice(loaded) == Progress.STOPPED and Progress.take_notice(loaded) == "", "the cut is told once")
	Progress.log_input(loaded, suffix)
	var continued: Dictionary = StoryRunner.apply_input(episode, expected, suffix)["state"]
	_expect(Progress.replay(episode, loaded["current"]) == continued, "a choice made after recovery survives the next resume")
	# Exercise actual save rotation, rather than constructing every backup.
	Progress.save_progress(primary)
	_expect(Progress._read(Progress.BACKUP_PATH) == saved, "save rotation retains the previous campaign")
	_write(Progress.PATH, '{"after":')
	_expect(Progress.load_progress() == saved, "rotated backup recovers a subsequently truncated primary")
	_heard_cache(episode)
	for path in [Progress.PATH, Progress.BACKUP_PATH, Progress.PATH + ".tmp", Progress.VERSION_COPY % 0, Progress.VERSION_COPY % (Progress.SAVE_VERSION + 1)]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(path)
	print("save recovery: %d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)


## PF-01: the heard-speaker cache keeps one entry per incident, whatever the
## resume timer or the number of campaigns played in one session.
func _heard_cache(episode: Dictionary) -> void:
	var progress := Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry())
	var state := StoryRunner.start_episode(episode, StoryRunner.empty_carry())
	while state["sceneId"] != null:
		var scene := StoryRunner.current_scene(episode, state)
		var input := {"type": "continue"}
		if scene["type"] == "choice":
			input = {"type": "choose", "optionId": StoryRunner.available_options(scene, state)[0]["id"]}
		elif scene["type"] == "deduction":
			input = {"type": "deduce", "picks": scene["solution"]}
		Progress.log_input(progress, input)
		state = StoryRunner.apply_input(episode, state, input)["state"]
	Progress.finish(progress, "INC-001", state)
	var record: Dictionary = progress["records"]["INC-001"]
	var heard := CastBook._heard_in(progress, "INC-001")
	_expect(not heard.is_empty(), "a finished record has speakers")
	for i in 200:
		record["timer"] = {"step": i, "left": i}
		CastBook._heard_in(progress, "INC-001")
	_expect(CastBook._heard.size() == 1, "resume metadata adds no cache entries")
	# A different history of the same incident replaces its entry.
	var key: int = CastBook._heard["INC-001"]["key"]
	record["inputs"] = record["inputs"].slice(0, 1)
	CastBook._heard_in(progress, "INC-001")
	_expect(CastBook._heard["INC-001"]["key"] != key and CastBook._heard.size() == 1, "a changed record replaces its entry")


func _write(path: String, text: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		failures += 1
		printerr("Cannot create test save %s: %s" % [path, FileAccess.get_open_error()])
		return
	file.store_string(text)
	file.close()


func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: %s" % label)

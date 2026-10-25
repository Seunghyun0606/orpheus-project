extends SceneTree
## Run with `npm run godot:saves`. Fixed Progress paths are safe only in the
## helper's QA project with a fresh application name. Refuse a direct run.

const Progress := preload("res://scripts/story/progress.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const StoryRunner := preload("res://scripts/story/story_runner.gd")

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
	saved["current"] = {"id": "INC-001", "carry": carry, "inputs": [first, removed, suffix]}
	Progress.save_progress(saved)
	var loaded := Progress.load_progress()
	_expect(Progress.in_progress(loaded, "INC-001"), "incompatible current run loads")
	_expect(Progress.replay(episode, loaded["current"]) == expected, "removed option stops replay at last valid point")
	# Exercise actual save rotation, rather than constructing every backup.
	Progress.save_progress(primary)
	_expect(Progress._read(Progress.BACKUP_PATH) == saved, "save rotation retains the previous campaign")
	_write(Progress.PATH, '{"after":')
	_expect(Progress.load_progress() == saved, "rotated backup recovers a subsequently truncated primary")
	for path in [Progress.PATH, Progress.BACKUP_PATH, Progress.PATH + ".tmp"]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(path)
	print("save recovery: %d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)


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

extends SceneTree
## Regression tests for the save version policy (specs/architecture/
## story-episode-format.md, "Save versions"; cases from
## docs/qa/2026-10-26-save-compat.md). Each SC case saves a run on the fixture
## (content version V1), changes the episode in memory (V2 unless the case says
## otherwise) and resumes the current run and views the finished record through
## real Progress disk round trips. Only the campaign-order case writes data,
## inside the guarded QA copy, and restores the original index before returning.
## Never run in the player project.

const Progress := preload("res://scripts/story/progress.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Settings := preload("res://scripts/ui/settings.gd")
const V1 := "v1"
const V2 := "v2"

var checks := 0
var failures := 0
var cases := 0
var case_id := ""


func _initialize() -> void:
	var project := ProjectSettings.globalize_path("res://").replace("\\", "/")
	if not project.contains("/.qa/verification/") or not str(ProjectSettings.get_setting("application/config/name")).begins_with("Orpheus Verification saves-"):
		printerr("save compatibility: refusing to write outside the isolated godot.mjs saves project")
		quit(1)
		return
	print("save compatibility user directory: %s" % OS.get_user_data_dir())
	_options()
	_scenes()
	_timers()
	_deductions()
	_flags()
	_campaign_order()
	_effects()
	await _ui_consequences()
	for path in [Progress.PATH, Progress.BACKUP_PATH, Progress.PATH + ".tmp"]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(path)
	print("save compatibility: %d cases, %d checks, %d failures" % [cases, checks, failures])
	quit(1 if failures > 0 else 0)


func _fixture() -> Dictionary:
	return {
		"contentVersion": V1,
		"schemaVersion": 1, "id": "INC-001", "act": 1, "title": "Compatibility fixture",
		"cast": [{"id": "PAGER", "name": "Pager"}], "keywords": [], "start": "intro",
		"evidence": [
			{"id": "A", "title": "A", "body": "First clue", "kind": "operational"},
			{"id": "B", "title": "B", "body": "Second clue", "kind": "operational"},
			{"id": "C", "title": "C", "body": "Other clue", "kind": "operational"},
		],
		"scenes": [
			{"id": "intro", "title": "Intro", "type": "briefing", "next": "route",
				"beats": [{"collect": "A"}, {"collect": "B"}, {"collect": "C"}]},
			{"id": "route", "title": "Route", "type": "choice", "prompt": "Route?", "next": "infer", "options": [
				{"id": "KEEP", "text": "Keep", "effects": {"values": {"evidence": 2}, "alignment": {"corporate": 1}, "flags": {"OLD": true}}},
				{"id": "OTHER", "text": "Other"},
				{"id": "THIRD", "text": "Third"},
			]},
			{"id": "infer", "title": "Infer", "type": "deduction", "prompt": "Connect two clues",
				"solution": ["A", "B"], "attempts": 2, "next": "decide",
				"solved": {"effects": {"values": {"curiosity": 3}}},
				"missed": {"effects": {"values": {"collateralDamage": 5}}}},
			{"id": "decide", "title": "Decide", "type": "choice", "prompt": "Act?", "next": "close",
				"timer": {"seconds": 30, "default": "WAIT"}, "options": [
					{"id": "ACT", "text": "Act", "effects": {"values": {"publicInterest": 2}, "alignment": {"null": 1}}},
					{"id": "WAIT", "text": "Wait"},
				]},
			{"id": "close", "title": "Close", "type": "briefing", "next": "END",
				"effects": {"values": {"operationalSafety": 1}}, "beats": [
					{"narrate": "Old flag recognized", "when": {"flags": {"OLD": true}}},
					{"narrate": "Route recognized", "when": {"chose": ["route.KEEP"]}},
				]},
		],
	}


## The fixture after an edit that is not wording only: a new content version.
func _changed() -> Dictionary:
	var episode := _fixture()
	episode["contentVersion"] = V2
	return episode


## A migration from V1 to V2 for INC-001, with optional maps.
func _migration(maps: Dictionary = {}) -> Dictionary:
	var step := {"to": V2}
	step.merge(maps)
	return {"INC-001": {V1: step}}


func _inputs() -> Array:
	return [{"type": "continue"}, {"type": "choose", "optionId": "KEEP"},
		{"type": "deduce", "picks": ["A", "B"]}, {"type": "choose", "optionId": "ACT"}, {"type": "continue"}]


func _scene(episode: Dictionary, id: String) -> Dictionary:
	return StoryRunner.find_scene(episode, id)


func _play(episode: Dictionary, inputs: Array, carry: Variant = null) -> Dictionary:
	var state := StoryRunner.start_episode(episode, carry)
	for input in inputs:
		var result := StoryRunner.apply_input(episode, state, input)
		_expect(result["error"] == "", "original fixture input is valid")
		state = result["state"]
	return state


func _round_trip(progress: Dictionary) -> Dictionary:
	Progress.save_progress(progress)
	var loaded := Progress.load_progress()
	_expect(loaded == progress, "save/load preserves fixture")
	return loaded


## Saves an unfinished run (the first `prefix_count` inputs) and a finished run
## on `original`, then resumes the first and views the second on `updated`.
## Checks what holds in every case: the resume keeps its entry carry and is
## stable, viewing a record never changes it, and `after` stays the carry the
## player finished with, which the next incident starts from.
func _probe(updated: Dictionary, migrations: Dictionary = {}, old_inputs: Array = [], prefix_count: int = 4, original: Dictionary = {}) -> Dictionary:
	if old_inputs.is_empty():
		old_inputs = _inputs()
	if original.is_empty():
		original = _fixture()
	var progress := Progress.empty()
	var run := Progress.begin(progress, "INC-001", StoryRunner.empty_carry(), original)
	_expect(run["content"] == original["contentVersion"], "a new run keeps its content version")
	for input in old_inputs.slice(0, prefix_count):
		Progress.log_input(progress, input.duplicate(true))
	if prefix_count == 3:
		run["timer"] = {"step": prefix_count, "left": 7}
	progress = _round_trip(progress)
	var saved_carry: Dictionary = progress["current"]["carry"].duplicate(true)
	var resumed := Progress.begin(progress, "INC-001", StoryRunner.empty_carry(), updated, migrations)
	_expect(resumed["carry"] == saved_carry, "resume keeps the entry carry")
	var notice := Progress.take_notice(progress)
	var current := Progress.replay(updated, resumed)
	var current_run: Dictionary = resumed.duplicate(true)
	var persisted := _round_trip(progress)
	var again := Progress.begin(persisted, "INC-001", StoryRunner.empty_carry(), updated, migrations)
	_expect(Progress.take_notice(persisted) == "", "second resume changes nothing")
	_expect(Progress.replay(updated, again) == current and again == current_run, "second resume is stable")

	progress = Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry(), original)
	for input in old_inputs:
		Progress.log_input(progress, input.duplicate(true))
	var baseline := _play(original, old_inputs)
	_expect(baseline["sceneId"] == null, "old record finished")
	Progress.finish(progress, "INC-001", baseline)
	progress = _round_trip(progress)
	var after: Dictionary = progress["after"].duplicate(true)
	var record_run: Dictionary = progress["records"]["INC-001"].duplicate(true)
	var record := Progress.check(updated, progress["records"]["INC-001"], migrations)
	_expect(progress["records"]["INC-001"] == record_run, "viewing a record never changes it")
	_expect(progress["after"] == after, "record replay does not recompute after")
	_expect(Progress.is_finished(progress, "INC-001"), "finished marker survives")
	_expect(Progress.is_unlocked(progress, "INC-002"), "next incident remains unlocked")
	var next_carry := Progress.carry_for(progress, "INC-002")
	_expect(next_carry == after["INC-001"], "next incident takes the after carry")
	var next := StoryRunner.start_episode(Library.load_episode("INC-002"), next_carry)
	for group in ["values", "alignment", "flags"]:
		_expect(next[group] == baseline[group], "next entry preserves the played %s" % group)
	return {"current": current, "notice": notice, "current_run": current_run, "record": record,
		"progress": progress, "baseline": baseline, "updated": updated}


## Changed content and no migration: the current run starts the incident again
## from its entry carry and says so; the record is shown as changed.
func _restarted(result: Dictionary) -> void:
	var updated: Dictionary = result["updated"]
	_expect(result["notice"] == Progress.RESTARTED, "current run is told it restarted")
	_expect(result["current_run"]["inputs"].is_empty() and not result["current_run"].has("timer"), "current run starts again")
	_expect(result["current_run"]["content"] == V2, "restarted run takes the new content version")
	_expect(result["current"] == StoryRunner.start_episode(updated, StoryRunner.empty_carry()), "restart is the incident's opening")
	_expect(result["record"]["status"] == Progress.CHANGED, "record is shown as changed")


## A migration carried the run over: nothing restarts, nothing is told.
func _carried(result: Dictionary, scene_id: Variant, kept: int) -> void:
	_expect(result["notice"] == "", "a carried-over run is not interrupted")
	_expect(result["current_run"]["inputs"].size() == kept and result["current_run"]["content"] == V2, "carried-over run keeps its inputs")
	_expect(result["current"]["sceneId"] == scene_id, "carried-over run resumes at %s" % scene_id)
	_expect(result["record"]["status"] == Progress.MIGRATED and result["record"]["complete"], "record replays through the migration")
	_expect(result["record"]["state"]["sceneId"] == null and result["record"]["state"]["values"] == result["baseline"]["values"], "migrated record reaches the played end")


func _case(id: String, label: String) -> void:
	case_id = id
	cases += 1
	print("%s: %s" % [id, label])


func _options() -> void:
	_case("SC-01", "remove an option")
	var episode := _changed()
	_scene(episode, "route")["options"].remove_at(0)
	var result := _probe(episode)
	_restarted(result)
	_expect(result["record"]["state"]["sceneId"] == "route" and not result["record"]["complete"], "record shows what still applies")

	_case("SC-02", "rename an option")
	episode = _changed()
	_scene(episode, "route")["options"][0]["id"] = "RENAMED"
	_restarted(_probe(episode))
	result = _probe(episode, _migration({"options": {"route": {"KEEP": "RENAMED"}}}))
	_carried(result, "close", 4)
	_expect(result["current_run"]["inputs"][1] == {"type": "choose", "optionId": "RENAMED"}, "saved input is rewritten once")
	_expect(result["record"]["state"]["choices"]["route"] == "RENAMED", "record history uses the new option ID")


func _scenes() -> void:
	_case("SC-03", "remove a scene and repair incoming links")
	var episode := _changed()
	episode["scenes"].remove_at(1)
	_scene(episode, "intro")["next"] = "infer"
	_restarted(_probe(episode))

	_case("SC-04", "rename a scene; links and chose references repaired")
	episode = _changed()
	_scene(episode, "route")["id"] = "route-v2"
	_scene(episode, "intro")["next"] = "route-v2"
	_scene(episode, "close")["beats"][1]["when"]["chose"] = ["route-v2.KEEP"]
	_restarted(_probe(episode))
	# Inputs name no scene, so a declared-compatible migration is enough.
	var result := _probe(episode, _migration())
	_carried(result, "close", 4)
	_expect(result["record"]["state"]["feed"].has({"kind": "narrate", "text": "Route recognized"}), "repaired reference keeps its line")

	_case("SC-05", "insert a briefing before the saved choice")
	episode = _changed()
	_scene(episode, "intro")["next"] = "inserted"
	episode["scenes"].insert(1, {"id": "inserted", "title": "New", "type": "briefing", "next": "route"})
	_restarted(_probe(episode))

	_case("SC-06", "insert a choice that accepts the old option ID")
	episode = _changed()
	_scene(episode, "intro")["next"] = "inserted"
	episode["scenes"].insert(1, {"id": "inserted", "title": "New", "type": "choice", "prompt": "New?", "next": "route",
		"options": [{"id": "KEEP", "text": "Different keep", "effects": {"values": {"evidence": 50}}}, {"id": "OTHER", "text": "Other"}]})
	result = _probe(episode)
	_restarted(result)
	_expect(result["current"]["choices"].is_empty() and result["current"]["values"]["evidence"] == 0, "old input is never applied to the new scene")

	_case("SC-07", "remove a scene without repairing its incoming link")
	episode = _changed()
	episode["scenes"].remove_at(1)
	_restarted(_probe(episode))
	# Defence in depth, for an export that kept its version (invalid content):
	# replay stops before an input that leads nowhere, and only END finishes.
	var broken := _fixture()
	broken["scenes"].remove_at(1)
	result = _probe(broken)
	_expect(result["notice"] == Progress.STOPPED and result["current_run"]["inputs"].is_empty(), "same version: cut back before the missing scene")
	_expect(result["current"]["sceneId"] == "intro", "resumes on a scene that exists")
	_expect(result["record"]["status"] == Progress.SAME and not result["record"]["complete"], "record reports it stops early")
	var dangling: Dictionary = StoryRunner.apply_input(broken, result["current"], {"type": "continue"})["state"]
	_expect(dangling["sceneId"] == "route" and StoryRunner.current_scene(broken, dangling).is_empty(), "the missing scene is reached")
	var progress: Dictionary = result["progress"].duplicate(true)
	progress["after"].clear()
	progress["records"].clear()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry(), broken)
	Progress.finish(progress, "INC-001", dangling)
	_expect(not Progress.is_finished(progress, "INC-001") and Progress.in_progress(progress, "INC-001"), "a state short of END does not finish")


func _timers() -> void:
	_case("SC-08", "timer becomes a plain choice; the saved input was a timeout")
	var episode := _changed()
	_scene(episode, "decide").erase("timer")
	var inputs := _inputs()
	inputs[3] = {"type": "timeout"}
	_restarted(_probe(episode, {}, inputs))
	# A migration only holds when every input replays; this one does not.
	var result := _probe(episode, _migration(), inputs)
	_expect(result["notice"] == Progress.RESTARTED and result["current_run"]["inputs"].is_empty(), "a migration that fails to replay restarts")
	_expect(result["record"]["status"] == Progress.MIGRATED and not result["record"]["complete"], "record reports the migration fell short")

	_case("SC-09", "timer becomes a plain choice; explicit or pending decision")
	_restarted(_probe(episode))
	_carried(_probe(episode, _migration()), "close", 4)
	result = _probe(episode, _migration(), [], 3)
	_expect(result["current"]["sceneId"] == "decide" and not result["current_run"].has("timer"), "pending decision drops time left for a timer it no longer has")

	_case("SC-10", "plain choice becomes timed")
	var plain := _fixture()
	_scene(plain, "decide").erase("timer")
	result = _probe(_changed(), {}, [], 3, plain)
	_restarted(result)
	_expect(not result["current_run"].has("timer"), "restart drops any saved time left")


func _deductions() -> void:
	_case("SC-11", "same-size deduction solution changes, retries remaining")
	var episode := _changed()
	_scene(episode, "infer")["solution"] = ["A", "C"]
	var result := _probe(episode)
	_restarted(result)
	_expect(not result["current"]["feed"].has({"kind": "deduction", "sceneId": "infer", "picks": ["A", "B"], "correct": false}), "old picks are never rescored")
	_restarted(_probe(episode, {}, [], 3))

	_case("SC-12", "same-size solution changes, one attempt")
	_scene(episode, "infer")["attempts"] = 1
	result = _probe(episode)
	_restarted(result)
	_expect(result["record"]["state"]["solved"] == {"infer": false}, "best-effort record would say missed")
	_expect(result["progress"]["after"]["INC-001"]["values"]["collateralDamage"] == 0, "after keeps the played success")

	_case("SC-13", "deduction solution changes size")
	episode = _changed()
	_scene(episode, "infer")["solution"] = ["A"]
	_restarted(_probe(episode))

	_case("SC-14", "rename an evidence ID")
	episode = _changed()
	episode["evidence"][0]["id"] = "A_V2"
	_scene(episode, "intro")["beats"][0]["collect"] = "A_V2"
	_scene(episode, "infer")["solution"] = ["A_V2", "B"]
	_restarted(_probe(episode))
	result = _probe(episode, _migration({"evidence": {"A": "A_V2"}}))
	_carried(result, "close", 4)
	_expect(result["current_run"]["inputs"][2]["picks"] == ["A_V2", "B"], "saved picks use the new evidence ID")


func _flags() -> void:
	for remove in [false, true]:
		_case("SC-16" if remove else "SC-15", "remove a flag" if remove else "rename a flag")
		var episode := _changed()
		var effects: Dictionary = _scene(episode, "route")["options"][0]["effects"]
		effects["flags"] = {} if remove else {"NEW": true}
		_scene(episode, "close")["beats"][0]["when"]["flags"] = {"NEW": true}
		var result := _probe(episode)
		_restarted(result)
		_expect(result["progress"]["after"]["INC-001"]["flags"] == {"OLD": true}, "after keeps the flag as played")
		if remove:
			# A flag nothing reads any more stays, inert.
			var carried := StoryRunner.start_episode(Library.load_episode("INC-002"), Progress.carry_for(result["progress"], "INC-002"))
			_expect(carried["flags"].has("OLD"), "a retired flag is kept, not erased")
			continue
		# A rename is a save-version step: every carry, one rule.
		var saved: Dictionary = result["progress"].duplicate(true)
		Progress.begin(saved, "INC-002", Progress.carry_for(saved, "INC-002"))
		saved["records"]["INC-001"]["carry"]["flags"] = {"OLD": false, "NEW": true}
		Progress.rename_flags(saved, {"OLD": "NEW"})
		_expect(saved["after"]["INC-001"]["flags"] == {"NEW": true}, "after is renamed")
		_expect(saved["current"]["carry"]["flags"] == {"NEW": true}, "current entry carry is renamed")
		_expect(saved["records"]["INC-001"]["carry"]["flags"] == {"NEW": true}, "a carry that has the new name keeps its value")
		var next := _fixture()
		next["start"] = "close"
		_scene(next, "close")["beats"] = [{"narrate": "New gate", "when": {"flags": {"NEW": true}}}]
		var carried := StoryRunner.start_episode(next, Progress.carry_for(saved, "INC-002"))
		_expect(carried["feed"].has({"kind": "narrate", "text": "New gate"}), "renamed carry opens the renamed gate")


func _campaign_order() -> void:
	_case("SC-17", "insert an incident in the middle of the campaign")
	var index_path := Library.EPISODES + "index.json"
	var original := FileAccess.get_file_as_string(index_path)
	var index := Library.episode_index()
	var progress := Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry())
	for input in _inputs():
		Progress.log_input(progress, input)
	Progress.finish(progress, "INC-001", _play(_fixture(), _inputs()))
	var between: Dictionary = progress.duplicate(true)
	var old_carry := Progress.carry_for(progress, "INC-002").duplicate(true)
	Progress.begin(progress, "INC-002", old_carry)
	Progress.log_input(progress, {"type": "continue"})
	progress = _round_trip(progress)
	var advanced: Dictionary = progress.duplicate(true)
	advanced["current"]["inputs"] = []
	var second := _fixture()
	second["id"] = "INC-002"
	for input in _inputs():
		Progress.log_input(advanced, input)
	Progress.finish(advanced, "INC-002", _play(second, _inputs(), old_carry))
	var second_after: Dictionary = advanced["after"]["INC-002"].duplicate(true)
	Progress.begin(advanced, "INC-003", Progress.carry_for(advanced, "INC-003"))
	advanced = _round_trip(advanced)
	index.insert(1, {"id": "INC-027", "act": 1, "title": "Inserted"})
	_write(index_path, JSON.stringify(index))
	_expect(Progress.next_episode("INC-001") == "INC-027", "new index changes next incident")
	# Started campaign: the insertion is passed, the started incident stays open.
	_expect(Progress.is_passed(progress, "INC-027") and not Progress.is_unlocked(progress, "INC-027"), "insertion before a started incident is passed")
	_expect(Progress.is_unlocked(progress, "INC-002") and _next_to_play(progress) == "INC-002", "started incident stays open and next")
	_expect(Progress.carry_for(progress, "INC-002") == old_carry, "carry skips the passed incident")
	var resumed := Progress.begin(progress, "INC-002", Progress.carry_for(progress, "INC-002"))
	_expect(resumed["inputs"] == [{"type": "continue"}] and resumed["carry"] == old_carry, "started incident keeps its progress and carry")
	# Further on: finished incidents stay open, the next one is unchanged.
	_expect(Progress.is_finished(advanced, "INC-002") and Progress.is_unlocked(advanced, "INC-002"), "a finished later incident stays open")
	_expect(not Progress.is_unlocked(advanced, "INC-027"), "insertion stays closed further on")
	_expect(Progress.in_progress(advanced, "INC-003") and Progress.is_unlocked(advanced, "INC-003") and _next_to_play(advanced) == "INC-003", "current later incident stays next")
	_expect(Progress.carry_for(advanced, "INC-003") == second_after, "carry after the later finished incident is unchanged")
	_expect(Progress.replay(second, advanced["records"]["INC-002"])["sceneId"] == null, "later finished record still replays")
	# Not yet started past it: the insertion is played next, and carries on.
	_expect(not Progress.is_passed(between, "INC-027") and _next_to_play(between) == "INC-027", "insertion at the frontier is played next")
	_expect(not Progress.is_unlocked(between, "INC-002"), "the incident after it waits for it")
	var inserted := _fixture()
	inserted["id"] = "INC-027"
	_scene(inserted, "route")["options"][0]["effects"]["flags"]["INSERTED"] = true
	Progress.begin(between, "INC-027", Progress.carry_for(between, "INC-027"))
	Progress.finish(between, "INC-027", _play(inserted, _inputs(), Progress.carry_for(between, "INC-027")))
	_expect(Progress.is_unlocked(between, "INC-002") and Progress.carry_for(between, "INC-002")["flags"].has("INSERTED"), "the next incident starts from the insertion")
	_expect(Progress.replay(_fixture(), progress["records"]["INC-001"])["sceneId"] == null, "earlier record still replays")
	_write(index_path, original)
	_expect(FileAccess.get_file_as_string(index_path) == original, "QA index restored exactly")


## What the title screen offers to play: the first open, unfinished incident.
func _next_to_play(progress: Dictionary) -> String:
	for entry in Library.episode_index():
		if Progress.is_unlocked(progress, entry["id"]) and not Progress.is_finished(progress, entry["id"]):
			return entry["id"]
	return ""


func _effects() -> void:
	_case("SC-18", "change values and alignment effects")
	var episode := _changed()
	var effects: Dictionary = _scene(episode, "route")["options"][0]["effects"]
	effects["values"]["evidence"] = 20
	effects["alignment"]["corporate"] = -4
	var result := _probe(episode)
	_restarted(result)
	_expect(result["record"]["state"]["values"]["evidence"] == 20, "best-effort record would recompute")
	_expect(result["progress"]["after"]["INC-001"]["values"]["evidence"] == 2 and result["progress"]["after"]["INC-001"]["alignment"]["corporate"] == 1, "after keeps the played numbers")


func _ui_consequences() -> void:
	# The real screen, where the data side must hold. reviewing suppresses
	# persistence; all loads still use the QA user://.
	var main: Control = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	# Let the title playback reach the mixer before the first loop switch.
	await create_timer(0.1).timeout
	main.reviewing = true
	Settings.timer = true
	Settings.language = "en"

	case_id = "SC-07"
	var broken := _fixture()
	broken["scenes"].remove_at(1)
	var progress := Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry(), broken)
	main.episode = broken
	main.progress = progress
	main.viewing_record = false
	main.entry_carry = StoryRunner.empty_carry()
	main.state = StoryRunner.apply_input(broken, StoryRunner.start_episode(broken), {"type": "continue"})["state"]
	main._build_episode_screen()
	main._show_all_entries()
	main._show_controls()
	_expect(not Progress.is_finished(main.progress, "INC-001") and Progress.in_progress(main.progress, "INC-001"), "screen on a missing scene does not finish the incident")

	case_id = "SC-01"
	var episode := _changed()
	_scene(episode, "route")["options"].remove_at(0)
	var result := _probe(episode)
	main.episode = episode
	main.progress = result["progress"].duplicate(true)
	main.viewing_record = true
	main._show_record("INC-001")
	_expect(main.progress["records"]["INC-001"] == result["progress"]["records"]["INC-001"], "record screen leaves the record as played")
	_expect(main.viewing_record and main.summary_body != null, "changed record still opens")
	await create_timer(0.1).timeout
	main.sound.loop_player.stop()
	for player in main.sound.players:
		player.stop()
	await create_timer(0.1).timeout
	main.queue_free()
	await process_frame
	await process_frame


func _write(path: String, content: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		_expect(false, "cannot write QA fixture: %s" % path)
		return
	file.store_string(content)
	file.close()


func _expect(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL %s: %s" % [case_id, label])

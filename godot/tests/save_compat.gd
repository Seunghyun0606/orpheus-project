extends SceneTree
## Characterization tests, not the proposed compatibility policy. Each SC case
## uses real Progress disk round trips and StoryRunner with in-memory mutations.
## Only the campaign-order case writes data, inside the guarded QA copy, and
## restores the original index before returning. Never run in the player project.

const Progress := preload("res://scripts/story/progress.gd")
const Library := preload("res://scripts/story/episode_library.gd")
const StoryRunner := preload("res://scripts/story/story_runner.gd")
const Settings := preload("res://scripts/ui/settings.gd")

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


## Exercise an unfinished prefix and a finished record independently. The
## latter also verifies the immutable historical after carry and next entry.
func _probe(updated: Dictionary, old_inputs: Array = [], prefix_count: int = 4) -> Dictionary:
	if old_inputs.is_empty():
		old_inputs = _inputs()
	var original := _fixture()
	var progress := Progress.empty()
	var run := Progress.begin(progress, "INC-001", StoryRunner.empty_carry())
	for input in old_inputs.slice(0, prefix_count):
		Progress.log_input(progress, input.duplicate(true))
	if prefix_count == 3:
		run["timer"] = {"step": prefix_count, "left": 7}
	progress = _round_trip(progress)
	var old_current := _play(original, old_inputs.slice(0, prefix_count))
	var current := Progress.replay(updated, progress["current"])
	var current_run: Dictionary = progress["current"].duplicate(true)
	var persisted := _round_trip(progress)
	_expect(Progress.replay(updated, persisted["current"]) == current, "second resume is stable")

	progress = Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry())
	for input in old_inputs:
		Progress.log_input(progress, input.duplicate(true))
	var baseline := _play(original, old_inputs)
	_expect(baseline["sceneId"] == null, "old record finished")
	Progress.finish(progress, "INC-001", baseline)
	progress = _round_trip(progress)
	var after: Dictionary = progress["after"].duplicate(true)
	var record := Progress.replay(updated, progress["records"]["INC-001"])
	_expect(progress["after"] == after, "record replay does not recompute after")
	_expect(Progress.is_finished(progress, "INC-001"), "finished marker survives incompatible record")
	_expect(Progress.is_unlocked(progress, "INC-002"), "next incident remains unlocked")
	var next_carry := Progress.carry_for(progress, "INC-002")
	_expect(next_carry == after["INC-001"], "next incident takes old after carry")
	var next := StoryRunner.start_episode(Library.load_episode("INC-002"), next_carry)
	for group in ["values", "alignment", "flags"]:
		_expect(next[group] == baseline[group], "next entry preserves old %s" % group)
	var record_inputs: Array = progress["records"]["INC-001"]["inputs"].duplicate(true)
	persisted = _round_trip(progress)
	_expect(persisted["records"]["INC-001"]["inputs"] == record_inputs, "viewed record truncation persists on save")
	return {"current": current, "record": record, "current_run": current_run,
		"record_run": progress["records"]["INC-001"], "progress": progress,
		"old_current": old_current, "baseline": baseline}


func _case(id: String, label: String) -> void:
	case_id = id
	cases += 1
	print("%s: %s" % [id, label])


func _stopped(result: Dictionary, scene_id: String, kept: int) -> void:
	for key in ["current", "record"]:
		_expect(result[key]["sceneId"] == scene_id, "%s stops at %s" % [key, scene_id])
		_expect(result[key + "_run"]["inputs"].size() == kept, "%s retains %d inputs" % [key, kept])
	_expect(not result["current_run"].has("timer"), "rejected input clears timer")


func _options() -> void:
	for rename in [false, true]:
		_case("SC-02" if rename else "SC-01", "rename option" if rename else "remove option")
		var episode := _fixture()
		if rename:
			_scene(episode, "route")["options"][0]["id"] = "RENAMED"
		else:
			_scene(episode, "route")["options"].remove_at(0)
		var result := _probe(episode)
		_stopped(result, "route", 1)
		var input := {"type": "choose", "optionId": "RENAMED" if rename else "OTHER"}
		var continued := StoryRunner.apply_input(episode, result["current"], input)
		_expect(continued["error"] == "", "current can choose a remaining option")
		Progress.log_input({"current": result["current_run"]}, input)
		_expect(Progress.replay(episode, result["current_run"]) == continued["state"], "replacement choice survives resume")


func _scenes() -> void:
	_case("SC-03", "remove scene with repaired links")
	var episode := _fixture()
	episode["scenes"].remove_at(1)
	_scene(episode, "intro")["next"] = "infer"
	_stopped(_probe(episode), "infer", 1)

	_case("SC-04", "rename scene; links and chose references repaired")
	episode = _fixture()
	_scene(episode, "route")["id"] = "route-v2"
	_scene(episode, "intro")["next"] = "route-v2"
	_scene(episode, "close")["beats"][1]["when"]["chose"] = ["route-v2.KEEP"]
	var result := _probe(episode)
	_expect(result["current"]["sceneId"] == "close" and result["record"]["sceneId"] == null, "fully relinked rename replays to same points")
	_expect(result["record"]["choices"].has("route-v2") and not result["record"]["choices"].has("route"), "history uses new scene ID")
	_expect(result["record"]["values"] == result["baseline"]["values"], "pure relinked rename preserves values")
	# A forgotten condition reference is accepted by the runner, but changes text.
	_scene(episode, "close")["beats"][1]["when"]["chose"] = ["route.KEEP"]
	result = _probe(episode)
	_expect(not result["record"]["feed"].has({"kind": "narrate", "text": "Route recognized"}), "stale chose reference silently loses dialogue")

	_case("SC-05", "insert briefing before saved choice")
	episode = _fixture()
	_scene(episode, "intro")["next"] = "inserted"
	episode["scenes"].insert(1, {"id": "inserted", "title": "New", "type": "briefing", "next": "route"})
	_stopped(_probe(episode), "inserted", 1)

	_case("SC-06", "insert compatible-looking choice; saved input goes to wrong scene")
	episode = _fixture()
	_scene(episode, "intro")["next"] = "inserted"
	episode["scenes"].insert(1, {"id": "inserted", "title": "New", "type": "choice", "prompt": "New?", "next": "route",
		"options": [{"id": "KEEP", "text": "Different keep", "effects": {"values": {"evidence": 50}}}, {"id": "OTHER", "text": "Other"}]})
	result = _probe(episode)
	_stopped(result, "route", 2)
	_expect(result["current"]["choices"] == {"inserted": "KEEP"}, "old route input silently consumed by new scene")
	_expect(result["current"]["values"]["evidence"] == 50, "unseen choice effects applied")

	_case("SC-07", "remove scene without repairing incoming link")
	episode = _fixture()
	episode["scenes"].remove_at(1)
	result = _probe(episode)
	_stopped(result, "route", 1)
	_expect(StoryRunner.current_scene(episode, result["current"]).is_empty(), "dangling scene is empty despite non-null sceneId")


func _timers() -> void:
	_case("SC-08", "timer becomes plain choice: saved timeout rejected")
	var episode := _fixture()
	_scene(episode, "decide").erase("timer")
	var inputs := _inputs()
	inputs[3] = {"type": "timeout"}
	_stopped(_probe(episode, inputs), "decide", 3)

	_case("SC-09", "timer becomes plain choice: explicit choice still accepted")
	var result := _probe(episode)
	_expect(result["current"]["sceneId"] == "close" and result["record"]["sceneId"] == null, "explicit choice survives timer removal")
	result = _probe(episode, [], 3)
	_expect(result["current"]["sceneId"] == "decide" and result["current_run"].has("timer"), "pending timer survives replay on now-plain scene")

	_case("SC-10", "plain choice becomes timed")
	# The old fixture is timed, but explicit inputs and the saved run contain no
	# scene type metadata. A timer-free old run has the identical serialization.
	var progress := Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry())
	var plain := _fixture()
	_scene(plain, "decide").erase("timer")
	var state := _play(plain, _inputs().slice(0, 3))
	for input in _inputs().slice(0, 3):
		Progress.log_input(progress, input)
	progress = _round_trip(progress)
	_expect(not progress["current"].has("timer"), "plain pending run has no remaining time")
	_expect(Progress.replay(_fixture(), progress["current"]) == state, "new timer is undetected by replay")
	result = _probe(_fixture())
	_expect(result["record"]["timedOut"].is_empty() and result["record"]["sceneId"] == null, "old explicit choice remains an explicit choice")


func _deductions() -> void:
	_case("SC-11", "same-size deduction solution changes: old success becomes retry")
	var episode := _fixture()
	_scene(episode, "infer")["solution"] = ["A", "C"]
	var result := _probe(episode)
	_stopped(result, "infer", 3)
	_expect(result["current"]["attempts"] == 1 and result["current"]["solved"].is_empty(), "old success is now a failed first attempt")
	_expect(result["current"]["feed"].has({"kind": "deduction", "sceneId": "infer", "picks": ["A", "B"], "correct": false}), "player sees failure instead of original success")
	_expect(result["current"]["values"]["curiosity"] == 0, "old success reward lost")
	# If the saved run ends at that input, no error reveals semantic drift.
	result = _probe(episode, [], 3)
	_expect(result["current_run"].has("timer"), "changed result alone triggers no recovery")

	_case("SC-12", "same-size solution changes with one attempt: old success becomes missed")
	episode = _fixture()
	_scene(episode, "infer")["solution"] = ["A", "C"]
	_scene(episode, "infer")["attempts"] = 1
	result = _probe(episode)
	_expect(result["record"]["sceneId"] == null and result["record_run"]["inputs"].size() == 5, "all inputs accepted despite wrong outcome")
	_expect(result["record"]["solved"] == {"infer": false} and result["record"]["values"]["collateralDamage"] == 5, "finished record now says missed with damage")

	_case("SC-13", "deduction solution changes size")
	episode = _fixture()
	_scene(episode, "infer")["solution"] = ["A"]
	_stopped(_probe(episode), "infer", 2)

	_case("SC-14", "rename evidence and repair collection/solution references")
	episode = _fixture()
	episode["evidence"][0]["id"] = "A_V2"
	_scene(episode, "intro")["beats"][0]["collect"] = "A_V2"
	_scene(episode, "infer")["solution"] = ["A_V2", "B"]
	result = _probe(episode)
	_stopped(result, "infer", 2)
	_expect(result["current"]["collected"] == ["A_V2", "B", "C"], "board shows renamed clue")
	_expect(StoryRunner.apply_input(episode, result["current"], {"type": "deduce", "picks": ["A_V2", "B"]})["error"] == "", "current can resubmit renamed evidence")


func _flags() -> void:
	for remove in [false, true]:
		_case("SC-16" if remove else "SC-15", "remove flag" if remove else "rename flag")
		var episode := _fixture()
		var effects: Dictionary = _scene(episode, "route")["options"][0]["effects"]
		effects["flags"] = {} if remove else {"NEW": true}
		_scene(episode, "close")["beats"][0]["when"]["flags"] = {"NEW": true}
		var result := _probe(episode)
		_expect(result["current"]["sceneId"] == "close" and result["record"]["sceneId"] == null, "flag change accepts all inputs")
		_expect(not result["record"]["flags"].has("OLD"), "replay drops old produced flag")
		_expect(result["progress"]["after"]["INC-001"]["flags"] == {"OLD": true}, "after retains removed/renamed flag")
		# New incident conditions interpret the historical carry using new names.
		var next := _fixture()
		next["start"] = "close"
		_scene(next, "close")["beats"] = [{"narrate": "New gate", "when": {"flags": {"NEW": true}}}]
		var carried := StoryRunner.start_episode(next, Progress.carry_for(result["progress"], "INC-002"))
		_expect(not carried["feed"].has({"kind": "narrate", "text": "New gate"}), "historical carry misses new gate")
		_expect(carried["flags"].has("OLD"), "unknown flag is not removed from carry")
		# The same unmapped legacy flag can already be in a current/record entry
		# carry, even when its producer is no longer part of this episode.
		var saved := Progress.empty()
		Progress.begin(saved, "INC-001", Progress.carry_for(result["progress"], "INC-002"))
		saved["records"]["INC-001"] = saved["current"].duplicate(true)
		saved = _round_trip(saved)
		for run in [saved["current"], saved["records"]["INC-001"]]:
			var replayed := Progress.replay(next, run)
			_expect(replayed["flags"] == {"OLD": true}, "current/record entry carry retains legacy flag")
			_expect(not replayed["feed"].has({"kind": "narrate", "text": "New gate"}), "current/record legacy carry misses renamed gate")


func _campaign_order() -> void:
	_case("SC-17", "insert campaign incident between completed and current episodes")
	var index_path := Library.EPISODES + "index.json"
	var original := FileAccess.get_file_as_string(index_path)
	var index := Library.episode_index()
	var progress := Progress.empty()
	Progress.begin(progress, "INC-001", StoryRunner.empty_carry())
	for input in _inputs():
		Progress.log_input(progress, input)
	Progress.finish(progress, "INC-001", _play(_fixture(), _inputs()))
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
	_expect(Progress.is_unlocked(progress, "INC-027"), "inserted incident unlocked")
	_expect(not Progress.is_unlocked(progress, "INC-002"), "previously playable current incident becomes locked")
	_expect(Progress.in_progress(progress, "INC-002"), "current still exists behind lock")
	_expect(Progress.carry_for(progress, "INC-002") == StoryRunner.empty_carry(), "new predecessor missing: carry_for returns empty")
	_expect(Progress.begin(progress, "INC-002", StoryRunner.empty_carry())["carry"] == old_carry, "begin of existing current keeps historical carry")
	_expect(Progress.is_finished(advanced, "INC-002") and not Progress.is_unlocked(advanced, "INC-002"), "already finished later incident also becomes locked")
	_expect(Progress.replay(second, advanced["records"]["INC-002"])["sceneId"] == null, "later finished record itself remains replayable")
	_expect(Progress.carry_for(advanced, "INC-003") == second_after, "carry after later finished incident is unchanged")
	_expect(Progress.in_progress(advanced, "INC-003") and Progress.is_unlocked(advanced, "INC-003"), "still later current remains playable, leaving an insertion gap")
	# Finishing the new predecessor does not update an already saved current.
	var inserted := _fixture()
	inserted["id"] = "INC-027"
	_scene(inserted, "route")["options"][0]["effects"]["flags"]["INSERTED"] = true
	var new_state := _play(inserted, _inputs(), old_carry)
	# Normal UI flow uses begin before finish: starting the inserted incident
	# replaces the only current slot and loses the old incident's partial log.
	var via_ui_route: Dictionary = progress.duplicate(true)
	Progress.begin(via_ui_route, "INC-027", Progress.carry_for(via_ui_route, "INC-027"))
	_expect(not Progress.in_progress(via_ui_route, "INC-002"), "starting insertion replaces old current slot")
	_expect(via_ui_route["current"]["inputs"].is_empty(), "old partial inputs are absent from new current")
	Progress.finish(via_ui_route, "INC-027", new_state)
	var restarted := Progress.begin(via_ui_route, "INC-002", Progress.carry_for(via_ui_route, "INC-002"))
	_expect(restarted["inputs"].is_empty() and restarted["carry"]["flags"].has("INSERTED"), "normal route restarts old current with new carry and loses its input")
	via_ui_route = _round_trip(via_ui_route)
	_expect(via_ui_route["current"]["inputs"].is_empty(), "lost old current log remains lost after save/load")
	# API callers that preserve current instead encounter the opposite problem:
	# begin does not reconcile its old carry with the new predecessor outcome.
	Progress.finish(progress, "INC-027", new_state)
	_expect(Progress.is_unlocked(progress, "INC-002"), "finishing insertion unlocks current again")
	_expect(Progress.carry_for(progress, "INC-002")["flags"].has("INSERTED"), "new start would get inserted effects")
	_expect(not Progress.begin(progress, "INC-002", Progress.carry_for(progress, "INC-002"))["carry"]["flags"].has("INSERTED"), "existing current skips inserted effects")
	_expect(Progress.replay(_fixture(), progress["records"]["INC-001"])["sceneId"] == null, "earlier record still replays")
	_write(index_path, original)
	_expect(FileAccess.get_file_as_string(index_path) == original, "QA index restored exactly")


func _effects() -> void:
	_case("SC-18", "change values and alignment effects")
	var episode := _fixture()
	var effects: Dictionary = _scene(episode, "route")["options"][0]["effects"]
	effects["values"]["evidence"] = 20
	effects["alignment"]["corporate"] = -4
	var result := _probe(episode)
	for key in ["current", "record"]:
		_expect(result[key]["values"]["evidence"] == 20 and result[key]["alignment"]["corporate"] == -4, "%s silently recomputes changed effects" % key)
	_expect(result["progress"]["after"]["INC-001"]["values"]["evidence"] == 2, "campaign keeps original evidence value")
	_expect(result["progress"]["after"]["INC-001"]["alignment"]["corporate"] == 1, "campaign keeps original alignment")
	_expect(result["record_run"]["inputs"].size() == 5, "no replay error detects numeric drift")


func _ui_consequences() -> void:
	# Use the actual screen to distinguish an unrecoverable scene from what the
	# player sees. reviewing suppresses persistence; all loads still use QA user://.
	var main: Control = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	# Let the title playback reach the mixer before the first loop switch.
	await create_timer(0.1).timeout
	main.reviewing = true
	Settings.timer = true
	Settings.language = "en"

	case_id = "SC-07"
	var episode := _fixture()
	episode["scenes"].remove_at(1)
	var result := _probe(episode)
	_mount(main, episode, result, false)
	_expect(Progress.is_finished(main.progress, "INC-001"), "UI treats missing non-END scene as completed")
	_expect(main.progress["current"] == null and main.summary_body != null, "UI displays summary and archives truncated run")

	case_id = "SC-01"
	episode = _fixture()
	_scene(episode, "route")["options"].remove_at(0)
	result = _probe(episode)
	_mount(main, episode, result, true)
	_expect(main.viewing_record and main.summary_body != null, "truncated finished record shown as summary")
	_expect(main.option_actions.size() == 2, "record offers next/back, no replacement choice")

	case_id = "SC-09"
	episode = _fixture()
	_scene(episode, "decide").erase("timer")
	result = _probe(episode, [], 3)
	_mount(main, episode, result, false)
	_expect(main.timer_bar == null and main.timer_left < 0.0, "removed timer is absent on screen")

	case_id = "SC-10"
	result = _probe(_fixture(), [], 3)
	result["current_run"].erase("timer")
	_mount(main, _fixture(), result, false)
	_expect(main.timer_bar != null and main.timer_left == 30.0, "newly timed pending decision starts full clock")

	case_id = "SC-18"
	episode = _fixture()
	_scene(episode, "route")["options"][0]["effects"]["values"]["evidence"] = 20
	result = _probe(episode)
	_mount(main, episode, result, true)
	_expect(main.state["values"]["evidence"] == 20 and main.progress["after"]["INC-001"]["values"]["evidence"] == 2, "record UI shows recomputed values while carry stays historical")
	await create_timer(0.1).timeout
	main.sound.loop_player.stop()
	for player in main.sound.players:
		player.stop()
	await create_timer(0.1).timeout
	main.queue_free()
	await process_frame
	await process_frame


func _mount(main: Control, episode: Dictionary, result: Dictionary, record: bool) -> void:
	main.episode = episode
	main.progress = result["progress"].duplicate(true) if record else Progress.empty()
	main.viewing_record = record
	main.entry_carry = StoryRunner.empty_carry()
	if record:
		main._show_record("INC-001")
	else:
		main.progress["current"] = result["current_run"].duplicate(true)
		main.state = Progress.replay(episode, main.progress["current"])
		main._build_episode_screen()
		main._show_all_entries()
		main._show_controls()


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

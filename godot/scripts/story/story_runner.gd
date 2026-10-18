extends RefCounted
## Story episode runner, a port of src/story/runner.ts (DEC-072).
##
## Keep the two in step: tests/parity.gd plays every path the reference
## validator enumerates through this runner and compares the final states.
## States are plain Dictionaries shaped like the TypeScript EpisodeState so
## they serialise identically.

const END := "END"
const VALUES := [
	"publicInterest", "operationalSafety", "curiosity", "evidence",
	"teamTrust", "aiDependency", "collateralDamage",
]
const ALIGNMENTS := ["corporate", "null"]


static func empty_carry() -> Dictionary:
	var values := {}
	for key in VALUES:
		values[key] = 0
	var alignment := {}
	for key in ALIGNMENTS:
		alignment[key] = 0
	return {"values": values, "alignment": alignment, "flags": {}}


static func find_scene(episode: Dictionary, scene_id: String) -> Dictionary:
	for scene in episode["scenes"]:
		if scene["id"] == scene_id:
			return scene
	return {}


static func current_scene(episode: Dictionary, state: Dictionary) -> Dictionary:
	if state["sceneId"] == null:
		return {}
	return find_scene(episode, state["sceneId"])


static func condition_holds(condition: Variant, state: Dictionary) -> bool:
	if condition == null:
		return true
	var c: Dictionary = condition
	for ref in c.get("chose", []):
		if not _chose(state, ref):
			return false
	for ref in c.get("notChose", []):
		if _chose(state, ref):
			return false
	for id in c.get("has", []):
		if not state["collected"].has(id):
			return false
	for id in c.get("lacks", []):
		if state["collected"].has(id):
			return false
	var flags: Dictionary = c.get("flags", {})
	for flag in flags:
		if bool(state["flags"].get(flag, false)) != bool(flags[flag]):
			return false
	if c.has("solved"):
		if not state["solved"].values().has(c["solved"]):
			return false
	if c.has("timedOut"):
		if (state["timedOut"].size() > 0) != bool(c["timedOut"]):
			return false
	return true


static func _chose(state: Dictionary, ref: String) -> bool:
	var parts := ref.split(".")
	return state["choices"].get(parts[0], null) == parts[1]


static func start_episode(episode: Dictionary, carry: Variant = null) -> Dictionary:
	var base := empty_carry()
	var given: Dictionary = carry if carry != null else base
	var values: Dictionary = base["values"].duplicate()
	values.merge(given.get("values", {}), true)
	var alignment: Dictionary = base["alignment"].duplicate()
	alignment.merge(given.get("alignment", {}), true)
	var state := {
		"episodeId": episode["id"],
		"sceneId": null,
		"attempts": 0,
		"collected": [],
		"choices": {},
		"solved": {},
		"timedOut": [],
		"pressure": 0,
		"feed": [],
		"values": values,
		"alignment": alignment,
		"flags": given.get("flags", {}).duplicate(),
	}
	_enter(episode, state, episode["start"])
	return state


## Options the player can pick now.
static func available_options(scene: Dictionary, state: Dictionary) -> Array:
	var options := []
	for option in scene["options"]:
		if condition_holds(option.get("when"), state):
			options.append(option)
	return options


## Applies one input. Returns {"state": Dictionary, "error": String}; on an
## error the state is the unchanged input state.
static func apply_input(episode: Dictionary, state: Dictionary, input: Dictionary) -> Dictionary:
	var scene := current_scene(episode, state)
	if scene.is_empty():
		return _fail(state, "%s has already ended." % episode["id"])
	var draft: Dictionary = state.duplicate(true)
	var kind: String = input["type"]
	match scene["type"]:
		"briefing":
			if kind != "continue":
				return _fail(state, "\"%s\" only continues." % scene["id"])
			_apply_effects(draft, scene.get("effects"))
			_enter(episode, draft, scene["next"])
		"choice":
			if kind == "timeout":
				if not scene.has("timer"):
					return _fail(state, "\"%s\" has no timer." % scene["id"])
				var fallback := _option(scene, scene["timer"]["default"])
				return _choose(episode, scene, state, draft, fallback, true)
			if kind != "choose":
				return _fail(state, "\"%s\" needs a choice." % scene["id"])
			for option in available_options(scene, state):
				if option["id"] == input["optionId"]:
					return _choose(episode, scene, state, draft, option, false)
			return _fail(state, "\"%s\" is not available in \"%s\"." % [input["optionId"], scene["id"]])
		"deduction":
			if kind != "deduce":
				return _fail(state, "\"%s\" needs a deduction." % scene["id"])
			return _deduce(episode, scene, state, draft, input["picks"])
	return {"state": draft, "error": ""}


static func _fail(state: Dictionary, message: String) -> Dictionary:
	return {"state": state, "error": message}


static func _option(scene: Dictionary, option_id: String) -> Dictionary:
	for option in scene["options"]:
		if option["id"] == option_id:
			return option
	return {}


static func _choose(
	episode: Dictionary, scene: Dictionary, state: Dictionary, draft: Dictionary,
	option: Dictionary, timed_out: bool
) -> Dictionary:
	draft["choices"][scene["id"]] = option["id"]
	if timed_out:
		draft["timedOut"].append(scene["id"])
		_play_beats(draft, scene["timer"].get("beats"))
	draft["feed"].append({
		"kind": "choice", "sceneId": scene["id"], "optionId": option["id"], "timedOut": timed_out,
	})
	_play_beats(draft, option.get("beats"))
	_apply_effects(draft, option.get("effects"))
	var target: Variant = option.get("next", scene.get("next"))
	if target == null:
		return _fail(state, "%s/%s.%s has nowhere to go." % [episode["id"], scene["id"], option["id"]])
	_enter(episode, draft, target)
	return {"state": draft, "error": ""}


static func _deduce(
	episode: Dictionary, scene: Dictionary, state: Dictionary, draft: Dictionary, picks: Array
) -> Dictionary:
	var unique := {}
	for id in picks:
		if unique.has(id) or not draft["collected"].has(id):
			return _fail(state, "A deduction cites each collected evidence item at most once.")
		unique[id] = true
	var solution: Array = scene["solution"]
	if picks.size() != solution.size():
		return _fail(state, "Pick exactly %d pieces of evidence." % solution.size())
	var correct := true
	for id in solution:
		if not unique.has(id):
			correct = false
	var sorted := picks.duplicate()
	sorted.sort()
	draft["feed"].append({
		"kind": "deduction", "sceneId": scene["id"], "picks": sorted, "correct": correct,
	})
	draft["attempts"] += 1
	if not correct and draft["attempts"] < scene["attempts"]:
		_play_beats(draft, scene.get("hint"))
		return {"state": draft, "error": ""}
	draft["solved"][scene["id"]] = correct
	var outcome: Dictionary = scene["solved"] if correct else scene["missed"]
	_play_beats(draft, outcome.get("beats"))
	_apply_effects(draft, outcome.get("effects"))
	_enter(episode, draft, scene["next"])
	return {"state": draft, "error": ""}


static func _enter(episode: Dictionary, state: Dictionary, scene_id: String) -> void:
	state["attempts"] = 0
	if scene_id == END:
		state["sceneId"] = null
		return
	state["sceneId"] = scene_id
	state["feed"].append({"kind": "scene", "sceneId": scene_id})
	_play_beats(state, find_scene(episode, scene_id).get("beats"))


static func _play_beats(state: Dictionary, beats: Variant) -> void:
	if beats == null:
		return
	for beat in beats:
		if not condition_holds(beat.get("when"), state):
			continue
		if beat.has("narrate"):
			state["feed"].append({"kind": "narrate", "text": beat["narrate"]})
		elif beat.has("speaker"):
			state["feed"].append({"kind": "line", "speaker": beat["speaker"], "text": beat["text"]})
		elif beat.has("log"):
			state["feed"].append({"kind": "log", "text": beat["log"]})
		elif beat.has("metric"):
			var entry := {"kind": "metric"}
			entry.merge(beat["metric"])
			state["feed"].append(entry)
		elif not state["collected"].has(beat["collect"]):
			state["collected"].append(beat["collect"])
			state["feed"].append({"kind": "evidence", "id": beat["collect"]})


static func _apply_effects(state: Dictionary, effects: Variant) -> void:
	if effects == null:
		return
	var values: Dictionary = effects.get("values", {})
	for key in values:
		state["values"][key] += values[key]
	var alignment: Dictionary = effects.get("alignment", {})
	for key in alignment:
		state["alignment"][key] += alignment[key]
	state["flags"].merge(effects.get("flags", {}), true)
	state["pressure"] = maxi(0, state["pressure"] + effects.get("pressure", 0))

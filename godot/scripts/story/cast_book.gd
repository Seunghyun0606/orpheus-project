extends RefCounted
## Who the player has met and what they know about them (src/story/cast.ts).
##
## A person is known once one of their speakers has talked in an incident the
## player has reached (or once the episode in `from` begins; with `evidence`,
## once that evidence is collected there). A profile line,
## name or role unlocks once its `after` incident has closed and/or its `flag`
## is set. Everything is read "as of" one incident: the one being played or the
## record being viewed.

const Library := preload("res://scripts/story/episode_library.gd")
const Progress := preload("res://scripts/story/progress.gd")
const CAST := "res://data/cast.json"

static var _characters: Array = []
static var _positions := {}
## Speakers heard in a finished incident, keyed by its record.
static var _heard := {}


static func characters() -> Array:
	if _characters.is_empty() and FileAccess.file_exists(CAST):
		var cast: Variant = Library.read_json(CAST)
		if cast is Dictionary:
			_characters = cast["characters"]
	return _characters


static func _position(id: String) -> int:
	if _positions.is_empty():
		var index := Library.episode_index()
		for i in index.size():
			_positions[index[i]["id"]] = i
	return _positions.get(id, -1)


static func _speakers_in(feed: Array) -> Dictionary:
	var heard := {}
	for entry in feed:
		if entry["kind"] == "line":
			heard[entry["speaker"]] = true
	return heard


static func _heard_in(progress: Dictionary, id: String) -> Dictionary:
	var record: Variant = progress["records"].get(id)
	if not record is Dictionary:
		return {}
	var key := "%s:%d" % [id, JSON.stringify(record).hash()]
	if not _heard.has(key):
		_heard[key] = _speakers_in(Progress.replay(Library.load_episode(id), record)["feed"])
	return _heard[key]


## What the player knows at `episode_id` in `state` (live or a record).
static func context(progress: Dictionary, episode_id: String, state: Dictionary) -> Dictionary:
	var at := _position(episode_id)
	var heard := _speakers_in(state.get("feed", []))
	for entry in Library.episode_index():
		if _position(entry["id"]) >= at:
			break
		heard.merge(_heard_in(progress, entry["id"]))
	return {"at": at, "ended": state.get("sceneId") == null, "flags": state.get("flags", {}), "heard": heard, "collected": state.get("collected", [])}


static func unlocked(item: Dictionary, context: Dictionary) -> bool:
	if item.has("flag") and not context["flags"].get(item["flag"], false):
		return false
	if item.has("after"):
		var at := _position(item["after"])
		if at > context["at"] or (at == context["at"] and not context["ended"]):
			return false
	return true


static func _known(character: Dictionary, context: Dictionary) -> bool:
	for speaker in character["speakers"]:
		if context["heard"].has(speaker):
			return true
	if not character.has("from"):
		return false
	var from := _position(character["from"])
	if from == context["at"] and character.has("evidence"):
		return context["collected"].has(character["evidence"])
	return from <= context["at"]


## The people known so far, in cast order:
## {id, name, role, portrait, traits: [{text, open, key}], background: [...], key}.
## `key` names what is visible (a changed name or role makes a new key), so
## the caller can mark what the player has not looked at yet.
static func people(context: Dictionary) -> Array:
	var out := []
	for character in characters():
		if not _known(character, context):
			continue
		var person := {"id": character["id"], "name": character["name"], "role": character["role"], "portrait": character["id"].to_lower()}
		for update in character["updates"]:
			if unlocked(update, context):
				person["name"] = update.get("name", person["name"])
				person["role"] = update.get("role", person["role"])
				person["portrait"] = update.get("portrait", person["portrait"])
		person["key"] = "%s:%s/%s" % [character["id"], person["name"], person["role"]]
		for section in ["traits", "background"]:
			var lines := []
			for i in character[section].size():
				var item: Dictionary = character[section][i]
				lines.append({"text": item["text"], "open": unlocked(item, context), "key": "%s/%s/%d" % [character["id"], section, i]})
			person[section] = lines
		out.append(person)
	return out


## Every key the player can see in `people`.
static func visible_keys(people: Array) -> Array:
	var keys := []
	for person in people:
		keys.append(person["key"])
		for section in ["traits", "background"]:
			for line in person[section]:
				if line["open"]:
					keys.append(line["key"])
	return keys

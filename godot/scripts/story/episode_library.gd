extends RefCounted
## Reads the episode JSON exported by scripts/story/export-godot.mjs.

const EPISODES := "res://data/episodes/"


## JSON numbers arrive as floats; whole numbers become ints so states compare
## and print like the TypeScript runner's.
static func normalize(value: Variant) -> Variant:
	match typeof(value):
		TYPE_FLOAT:
			return int(value) if value == floorf(value) else value
		TYPE_ARRAY:
			var items := []
			for item in value:
				items.append(normalize(item))
			return items
		TYPE_DICTIONARY:
			var map := {}
			for key in value:
				map[key] = normalize(value[key])
			return map
	return value


static func read_json(path: String) -> Variant:
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		push_error("Cannot read %s" % path)
		return null
	return normalize(JSON.parse_string(text))


## [{id, act, title}] in campaign order.
static func episode_index() -> Array:
	var index: Variant = read_json(EPISODES + "index.json")
	return index if index is Array else []


static func load_episode(id: String) -> Dictionary:
	var episode: Variant = read_json(EPISODES + id.to_lower() + ".json")
	return episode if episode is Dictionary else {}

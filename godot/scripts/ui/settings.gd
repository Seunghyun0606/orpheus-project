extends RefCounted
## Viewer preferences, stored apart from story state in user://settings.cfg.

const PATH := "user://settings.cfg"
const LANGUAGES := ["ko", "en"]

static var language := ""
## 0 small, 1 medium, 2 large.
static var text_size := 1
static var crt := true
## Decision timers are on by default (DEC-072) and can be turned off here.
static var timer := true
## Typing speed of the dialogue and log text: 0 normal, 1 fast, 2 instant.
static var text_speed := 0
const TYPING_CPS := [38.0, 110.0, 0.0]
## 0…1 linear.
static var music_volume := 0.6
static var sfx_volume := 0.8
static var fullscreen := false
## No fades, flashes or sliding cards.
static var reduce_motion := false


static func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) == OK:
		language = cfg.get_value("display", "language", "")
		text_size = clampi(cfg.get_value("display", "text_size", 1), 0, 2)
		crt = cfg.get_value("display", "crt", true)
		timer = cfg.get_value("play", "timer", true)
		text_speed = clampi(cfg.get_value("display", "text_speed", 0), 0, 2)
		music_volume = clampf(cfg.get_value("sound", "music", 0.6), 0.0, 1.0)
		sfx_volume = clampf(cfg.get_value("sound", "sfx", 0.8), 0.0, 1.0)
		fullscreen = cfg.get_value("display", "fullscreen", false)
		reduce_motion = cfg.get_value("display", "reduce_motion", false)
	if not LANGUAGES.has(language):
		language = "ko" if OS.get_locale_language() == "ko" else "en"


static func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("display", "language", language)
	cfg.set_value("display", "text_size", text_size)
	cfg.set_value("display", "crt", crt)
	cfg.set_value("play", "timer", timer)
	cfg.set_value("display", "text_speed", text_speed)
	cfg.set_value("sound", "music", music_volume)
	cfg.set_value("sound", "sfx", sfx_volume)
	cfg.set_value("display", "fullscreen", fullscreen)
	cfg.set_value("display", "reduce_motion", reduce_motion)
	cfg.save(PATH)

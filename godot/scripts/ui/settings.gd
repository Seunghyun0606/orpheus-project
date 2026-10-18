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


static func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) == OK:
		language = cfg.get_value("display", "language", "")
		text_size = clampi(cfg.get_value("display", "text_size", 1), 0, 2)
		crt = cfg.get_value("display", "crt", true)
		timer = cfg.get_value("play", "timer", true)
		text_speed = clampi(cfg.get_value("display", "text_speed", 0), 0, 2)
	if not LANGUAGES.has(language):
		language = "ko" if OS.get_locale_language() == "ko" else "en"


static func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("display", "language", language)
	cfg.set_value("display", "text_size", text_size)
	cfg.set_value("display", "crt", crt)
	cfg.set_value("play", "timer", timer)
	cfg.set_value("display", "text_speed", text_speed)
	cfg.save(PATH)

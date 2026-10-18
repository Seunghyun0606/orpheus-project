extends Node
## Plays the synthesised cues from scripts/story/synth-audio.mjs on two buses,
## Music (loops) and SFX, whose volumes follow Settings.

const Settings := preload("res://scripts/ui/settings.gd")
const CUES := ["pager", "type", "log", "evidence", "choice", "tick", "solved", "missed", "ambient", "title"]
const LOOPS := ["ambient", "title"]

var streams := {}
var players: Array[AudioStreamPlayer] = []
var next_player := 0
var loop_player: AudioStreamPlayer
var loop_name := ""


func _ready() -> void:
	for bus in ["Music", "SFX"]:
		if AudioServer.get_bus_index(bus) < 0:
			AudioServer.add_bus()
			var index := AudioServer.bus_count - 1
			AudioServer.set_bus_name(index, bus)
			AudioServer.set_bus_send(index, "Master")
	for name in CUES:
		var stream: AudioStreamWAV = load("res://audio/%s.wav" % name)
		if LOOPS.has(name):
			stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
			stream.loop_begin = 0
			stream.loop_end = int(stream.get_length() * stream.mix_rate)
		streams[name] = stream
	for i in 6:
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		players.append(player)
	loop_player = AudioStreamPlayer.new()
	loop_player.bus = "Music"
	add_child(loop_player)
	apply_volumes()


func apply_volumes() -> void:
	for pair in [["Music", Settings.music_volume], ["SFX", Settings.sfx_volume]]:
		var index := AudioServer.get_bus_index(pair[0])
		AudioServer.set_bus_mute(index, pair[1] <= 0.0)
		AudioServer.set_bus_volume_db(index, linear_to_db(maxf(pair[1], 0.0001)))


## Fire-and-forget cue; the oldest player is reused when all are busy.
func play(name: String, volume_db := 0.0, pitch := 1.0) -> void:
	var player := players[next_player]
	next_player = (next_player + 1) % players.size()
	player.stream = streams[name]
	player.volume_db = volume_db
	player.pitch_scale = pitch
	player.play()


## Cross-fades to another loop; the same loop keeps playing.
func loop(name: String) -> void:
	if loop_name == name:
		return
	loop_name = name
	loop_player.stream = streams[name]
	loop_player.volume_db = -30.0
	loop_player.play()
	create_tween().tween_property(loop_player, "volume_db", 0.0, 1.5)

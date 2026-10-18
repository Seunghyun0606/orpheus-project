shader_type canvas_item;
// Light scanlines and vignette over the whole screen; turned off in Settings.

uniform float scanline_strength = 0.07;
uniform float vignette_strength = 0.35;

void fragment() {
	float line = step(0.5, fract(FRAGCOORD.y * 0.5));
	float vignette = 1.0 - smoothstep(0.35, 0.85, distance(UV, vec2(0.5)));
	COLOR = vec4(0.0, 0.0, 0.0, line * scanline_strength + (1.0 - vignette) * vignette_strength);
}

#version 300 es
precision highp float;

in vec2 fs_UV;
out vec4 out_Col;

uniform sampler2D u_frame;
uniform float u_Time;

// Interpolate between regular color and channel-swizzled color
// on right half of screen. Also scale color to range [0, 5].
void main() {
	vec3 color = texture(u_frame, fs_UV).xyz;
	color += 10.0 * max(color - 0.5, vec3(0.0)); // color is not clamped to 1.0 in 32 bit color

	vec3 color2 = color.brg;
	float t = 0.5 + 0.5 * cos(1.5 * 3.14 * (u_Time + 0.25));
	t *= step(0.5, fs_UV.x);
	color = mix(color, color2, smoothstep(0.0, 1.0, t));
	out_Col = vec4(color, 1.0);
}

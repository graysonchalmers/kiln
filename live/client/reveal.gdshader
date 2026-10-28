shader_type spatial;
render_mode cull_disabled;

uniform vec4 albedo_color : source_color = vec4(1.0);
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform bool use_tex = false;
uniform float roughness_v : hint_range(0.0, 1.0) = 0.7;
uniform float metallic_v : hint_range(0.0, 1.0) = 0.0;
uniform float clip_y = 0.0;
uniform float band = 0.08;
uniform bool invert = false;   // false: show below the line (the arriving level); true: show above it (the departing one)
uniform vec4 edge_color : source_color = vec4(0.3, 0.9, 1.0, 1.0);

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float d = invert ? (world_pos.y - clip_y) : (clip_y - world_pos.y);
	if (d < 0.0) {
		discard;
	}
	vec4 c = albedo_color;
	if (use_tex) {
		c *= texture(albedo_tex, UV);
	}
	ALBEDO = c.rgb;
	ROUGHNESS = roughness_v;
	METALLIC = metallic_v;
	float e = 1.0 - smoothstep(0.0, band, d);
	EMISSION = edge_color.rgb * e * 4.0;
}

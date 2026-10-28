shader_type spatial;
render_mode cull_disabled;

uniform vec4 albedo_color : source_color = vec4(1.0);
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform bool use_tex = false;
uniform float roughness_v : hint_range(0.0, 1.0) = 0.7;
uniform float metallic_v : hint_range(0.0, 1.0) = 0.0;
uniform float clip_y = 0.0;
uniform float band = 0.08;
uniform vec4 edge_color : source_color = vec4(0.3, 0.9, 1.0, 1.0);

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	if (world_pos.y > clip_y) {
		discard;
	}
	vec4 c = albedo_color;
	if (use_tex) {
		c *= texture(albedo_tex, UV);
	}
	ALBEDO = c.rgb;
	ROUGHNESS = roughness_v;
	METALLIC = metallic_v;
	float e = smoothstep(clip_y - band, clip_y, world_pos.y);
	EMISSION = edge_color.rgb * e * 3.0;
}

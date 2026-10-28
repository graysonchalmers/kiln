shader_type spatial;

// A band of rows climbs the box. A brick changes over when the band passes its centre height: bricks above the band are
// the old level, bricks below are the new one. Every brick moves about its OWN centre (the instance origin).
// style: 0 flip, 1 plane (same look, the plane is drawn by the scene), 2 sparks (particles are drawn by the scene),
//        3 scatter, 4 implode (the reverse particle effect), 5 dissolve. See transition_styles.gd.
uniform float line_y = 0.0;
uniform float band = 0.1;      // height of the changing zone
uniform float mode = 1.0;      // 0 = departing level, 1 = arriving level
uniform int style = 0;
uniform vec4 edge_color : source_color = vec4(0.3, 0.9, 1.0, 1.0);

uniform sampler2DArray tex_albedo : source_color, filter_linear_mipmap, repeat_enable;  // loom: stone, wood, metal, cloth
uniform sampler2DArray tex_normal : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float tile_m = 0.45;       // metres of brick face per texture tile

// Per material tag (0 default, 1 stone, 2 wood, 3 metal, 4 cloth, 5 glass, 6 emissive); see voxel_view.gd TAGS.
const float T_ROUGH[7]  = float[7](0.80, 0.90, 0.68, 0.34, 0.95, 0.10, 0.55);
const float T_METAL[7]  = float[7](0.00, 0.00, 0.00, 0.85, 0.00, 0.00, 0.00);
const float T_GRAIN[7]  = float[7](0.00, 0.50, 0.45, 0.30, 0.45, 0.00, 0.00);  // strength of the loom albedo/normal detail
const float T_RIM[7]    = float[7](0.10, 0.08, 0.12, 0.45, 0.20, 0.70, 0.10);   // fresnel / rim light
const float T_AO[7]     = float[7](0.32, 0.38, 0.30, 0.28, 0.30, 0.18, 0.15);   // darkening in the seams between bricks

varying vec4 vcol;
varying float glow;
varying vec3 lp;
varying vec3 ln;
varying vec3 bs;
varying flat float tag;
varying flat float jit;

float hash(vec3 p) {
	return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void vertex() {
	vec3 c = MODEL_MATRIX[3].xyz;
	float d = line_y - c.y;                                  // > 0 once the band has passed this brick
	float r = hash(c);
	vec3 dir = normalize(vec3(hash(c + 1.3) - 0.5, hash(c + 2.7) - 0.15, hash(c + 4.1) - 0.5) + vec3(0.0001));
	float p = smoothstep(-band * 0.5, band * 0.5, d);
	float near = 1.0 - clamp(abs(d) / (band * 0.5), 0.0, 1.0);
	if (style == 3 || style == 4) {
		p = smoothstep(-band, band * 0.25, d);               // start early so bricks have time to travel
	} else if (style == 5) {
		float dj = d + (r - 0.5) * band * 1.6;               // every brick flips at its own random moment
		p = smoothstep(-0.12 * band, 0.12 * band, dj);
		near = 1.0 - clamp(abs(dj) / (band * 0.3), 0.0, 1.0);
	}
	float a = mix(1.0 - p, p, mode);                         // 1 = in place, 0 = gone
	float t = 1.0 - a;
	float s = a;
	vec3 off = vec3(0.0);
	if (style == 3) {                                        // bricks drift apart / drift in
		off = dir * t * 3.0;
	} else if (style == 4) {                                 // new bricks assemble from far away, old ones burst outward
		if (mode > 0.5) {
			off = dir * t * t * 10.0;
			s = clamp(a * 2.0, 0.0, 1.0);
		} else {
			off = dir * t * 7.0;
		}
	}
	float g = (style == 3 || style == 4) ? clamp(t * 1.6, 0.0, 1.0) : near;
	lp = VERTEX;
	ln = NORMAL;
	bs = vec3(length(MODEL_MATRIX[0].xyz), length(MODEL_MATRIX[1].xyz), length(MODEL_MATRIX[2].xyz));
	tag = floor(INSTANCE_CUSTOM.x * 8.0 + 0.5);
	jit = hash(vec3(float(INSTANCE_ID), 3.1, 7.7));
	VERTEX = VERTEX * s * (g > 0.001 ? 0.94 : 1.0) + off;   // resting bricks are seamless; a moving brick opens a small gap
	vcol = COLOR;
	glow = g;
}

void fragment() {
	int t = int(tag);
	vec3 a = abs(ln);
	vec3 axis = vec3(a.x > 0.5 ? 1.0 : 0.0, a.y > 0.5 ? 1.0 : 0.0, a.z > 0.5 ? 1.0 : 0.0);
	vec3 q = abs(lp) * 2.0;                                  // 0..1 across the cube; near 1 on two axes at once = a cube edge
	vec3 base = pow(vcol.rgb, vec3(2.2));                    // palette colours are sRGB; the instance colour arrives unconverted
	base *= 1.0 + (jit - 0.5) * 0.16;                        // each brick is a touch lighter or darker than its neighbours

	// Box faces are axis aligned, so triplanar projection reduces to the dominant axis; the offset is per brick.
	vec2 uv = axis.x > 0.5 ? lp.zy * bs.zy : (axis.y > 0.5 ? lp.xz * bs.xz : lp.xy * bs.xy);
	uv = uv / tile_m + vec2(jit * 7.0, fract(jit * 13.0) * 5.0);
	float grain = T_GRAIN[t];
	vec3 nl = ln;
	if (grain > 0.0) {
		float layer = float(t - 1);                          // stone, wood, metal, cloth are layers 0..3
		vec3 tex = texture(tex_albedo, vec3(uv, layer)).rgb;
		vec3 nm = texture(tex_normal, vec3(uv, layer)).xyz * 2.0 - 1.0;
		base *= mix(vec3(1.0), tex * 1.7, grain);
		vec3 tu = axis.x > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
		vec3 tv = axis.y > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
		nl = normalize(ln + (tu * nm.x + tv * nm.y) * grain * 1.4);
	}

	// Seams: near a face edge the brick darkens (contact AO) and its normal tips outward (a bevel that catches the light).
	vec3 tq = q * (1.0 - axis);                              // the two tangent axes only
	float m = max(tq.x, max(tq.y, tq.z));
	float seam = smoothstep(0.72, 1.0, m);
	vec3 outward = sign(lp) * step(vec3(m - 0.0001), tq) * (1.0 - axis);
	nl = normalize(nl + outward * seam * 0.55);
	base *= 1.0 - T_AO[t] * seam;

	ALBEDO = base;
	ROUGHNESS = T_ROUGH[t];
	METALLIC = T_METAL[t];
	SPECULAR = t == 5 ? 1.0 : 0.5;
	NORMAL = normalize((VIEW_MATRIX * vec4(nl, 0.0)).xyz);
	RIM = T_RIM[t];
	RIM_TINT = 0.5;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	vec3 glass_glint = t == 5 ? vec3(0.55, 0.75, 1.0) * fres * 0.7 : vec3(0.0);
	vec3 self_lit = t == 6 ? base * 0.9 : vec3(0.0);        // emissive tag: reads lit even in shadow (kept under the bloom threshold)

	float qq = q.x + q.y + q.z - max(q.x, max(q.y, q.z)) - min(q.x, min(q.y, q.z));
	float rim = smoothstep(0.78, 1.0, qq);
	EMISSION = glass_glint + self_lit + edge_color.rgb * glow * (0.7 + 3.3 * rim);
}

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

varying vec4 vcol;
varying float glow;
varying vec3 lp;

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
	VERTEX = VERTEX * s * (g > 0.001 ? 0.94 : 1.0) + off;   // resting bricks are seamless; a moving brick opens a small gap
	vcol = COLOR;
	glow = g;
}

void fragment() {
	ALBEDO = pow(vcol.rgb, vec3(2.2));                       // palette colours are sRGB; the instance colour arrives unconverted
	ROUGHNESS = 0.8;
	vec3 q = abs(lp) * 2.0;                                  // 0..1 across the cube; near 1 on two axes at once = a cube edge
	float mid = q.x + q.y + q.z - max(q.x, max(q.y, q.z)) - min(q.x, min(q.y, q.z));
	float rim = smoothstep(0.78, 1.0, mid);
	EMISSION = edge_color.rgb * glow * (0.7 + 3.3 * rim);
}

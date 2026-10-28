shader_type spatial;

// One glowing line climbs the box. A brick flips when the line passes its centre height: bricks above the line are the
// old level, bricks below are the new one, and the few rows around the line are mid-flip. Each brick shrinks or grows
// about its OWN centre (the instance origin), not the centre of the whole shape.
uniform float line_y = 0.0;
uniform float band = 0.1;      // height of the flipping zone (about three rows of the finer level)
uniform float mode = 1.0;      // 0 = departing level (shrinks away), 1 = arriving level (grows in)
uniform vec4 edge_color : source_color = vec4(0.3, 0.9, 1.0, 1.0);

varying vec4 vcol;
varying float glow;

void vertex() {
	float cy = MODEL_MATRIX[3].y;
	float p = smoothstep(-band * 0.5, band * 0.5, line_y - cy);  // 1 once the line has passed this brick
	VERTEX *= mix(1.0 - p, p, mode);
	vcol = COLOR;
	glow = 1.0 - clamp(abs(line_y - cy) / (band * 0.5), 0.0, 1.0);
}

void fragment() {
	ALBEDO = pow(vcol.rgb, vec3(2.2));  // palette colours are sRGB; the instance colour arrives unconverted
	ROUGHNESS = 0.8;
	EMISSION = edge_color.rgb * glow * 2.5;
}

extends RefCounted
## The transition styles the shader knows (the index is the shader's `style` uniform).
## flip: bricks flip row by row, glowing edges. plane: the same plus one faint translucent plane. sparks: flip plus
## sparks along the band. scatter: bricks drift apart and drift in. implode: the reverse-particle one, new bricks fly in
## from far away and assemble while the old ones burst outward. dissolve: bricks flip at random moments in a wide zone.

const NAMES := ["flip", "plane", "sparks", "scatter", "implode", "dissolve"]


## Index of a style given by name (any case) or by number; 0 (flip) for anything unknown.
static func index_of(s: String) -> int:
	var low := s.strip_edges().to_lower()
	if NAMES.has(low):
		return NAMES.find(low)
	if low.is_valid_int() and low.to_int() >= 0 and low.to_int() < NAMES.size():
		return low.to_int()
	return 0


static func next_index(i: int) -> int:
	return (i + 1) % NAMES.size()

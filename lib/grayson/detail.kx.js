// Detail (resolution) control shared by Grayson recipes. _D = 1 is the reviewed default.
// _D 0.5 = low-poly/LOD, 2 = high. Scenes: detail(2) before building, or lods() for every level at once.
var _D = typeof DETAIL === "number" ? DETAIL : typeof _D === "number" ? _D : 1
function detail(d) { _D = d }
// Smooth-noise feature size (m) for jitter: extra detail rounds shapes instead of adding static. 0 = classic per-vertex.
var _W = typeof _W === "number" ? _W : 0.3
function wobble(m) { _W = m }
function WB(scale = 1) { return _W ? _W * scale : undefined }
// sides / segments / ring counts
function S(n, min = 3) { return Math.max(min, Math.round(n * _D)) }
// sphere/rock subdivision level (each level ~4x tris)
function SD(d) { return Math.max(0, Math.min(3, Math.round(d + Math.log2(_D)))) }
// instance counts (blades, leaves, puffs): grow slower than sides
function N(n, min = 1) { return Math.max(min, Math.round(n * Math.sqrt(_D))) }
// Build one asset at several detail levels: name_lo, name_mid, name_hi.
function lods(name, build, levels = { lo: 0.5, mid: 1, hi: 2 }) {
  const keep = _D
  for (const [k, d] of Object.entries(levels)) { _D = d; model(`${name}_${k}`, build()) }
  _D = keep
}

// Deterministic random stream for recipes.
var _r = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

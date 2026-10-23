// Grayson hard-surface recipes for kiln. include() next to nature.kx.js.
// Built pieces: frames proud of panels (1-2 cm) so construction reads and nothing z-fights.

// Plank crate: dark inset panels, light frame edges on all 12 edges.
function crate(w, h, d, { mat = "wood", frame = "woodL", at = [0, 0, 0], rot = [0, 0, 0], f = 0.05 } = {}) {
  const e = (sx, sy, sz, x, y, z) => box(sx, sy, sz, { mat: frame, pos: [x, y, z] })
  return tf({ pos: at, rot },
    box(w - 0.02, h - 0.02, d - 0.02, { mat, pos: [0, 0.01, 0] }),
    sym("x", sym("z", e(f, h, f, w / 2 - f / 2, 0, d / 2 - f / 2))),
    [0, h - f].map(y => [sym("z", e(w, f, f, 0, y, d / 2 - f / 2)), sym("x", e(f, f, d, w / 2 - f / 2, y, 0))]),
    sym("z", box(w - 2 * f, f * 0.8, 0.012, { mat: frame, pos: [0, h / 2 - f * 0.4, d / 2], rot: [0, 0, Math.atan2(h, w) * 57.3] })))
}

// Lumpy tied sack.
function sack(h, { mat = "sack", tie = "woodD", at = [0, 0, 0], seed = 1 } = {}) {
  const [x, y, z] = at
  return [sphere(h * 0.42, { mat, pos: [x, y + h * 0.38, z], scale: [1, 0.95, 0.85], detail: 1, jitter: 0.03, seed }),
    cone(h * 0.22, h * 0.3, { mat, sides: 8, pos: [x, y + h * 0.66, z], jitter: 0.01, seed: seed + 1 }),
    cyl(h * 0.09, h * 0.05, { mat: tie, sides: 6, pos: [x, y + h * 0.8, z] }),
    cone(h * 0.12, h * 0.12, { mat, sides: 5, pos: [x, y + h * 0.84, z] })]
}

// Spoked wheel facing +/-z: rim, hub, spokes. Center at y = r.
function wheel(r, { w = 0.07, mat = "woodD", rim = "iron", hub = "iron", spokes = 6, at = [0, 0, 0] } = {}) {
  const [x, y, z] = at
  return tf({ pos: [x, y + r, z] },
    torus(r * 0.9, r * 0.1, { mat: rim, rot: [90, 0, 0], rings: 12, sides: 4 }),
    cyl(r * 0.18, w * 1.6, { mat: hub, sides: 8, rot: [90, 0, 0], pos: [0, 0, -w * 0.8] }),
    [...Array(spokes)].map((_, i) => tf({ rot: [0, 0, i * (180 / spokes)] }, box(0.035, r * 1.7, 0.03, { mat, pos: [0, -r * 0.85, 0] }))))
}

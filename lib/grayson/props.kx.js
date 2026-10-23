// Grayson hard-surface recipes for kiln. include() next to nature.kx.js.
// Built pieces: frames proud of panels (1-2 cm) so construction reads and nothing z-fights.
include("./detail.kx.js")

// Plank crate: dark inset panels, light frame edges on all 12 edges.
function crate(w, h, d, { mat = "wood", frame = "woodL", at = [0, 0, 0], rot = [0, 0, 0], f = 0.05 } = {}) {
  const e = (sx, sy, sz, x, y, z) => box(sx, sy, sz, { mat: frame, pos: [x, y, z] })
  return tf({ pos: at, rot },
    box(w - 0.02, h - 0.02, d - 0.02, { mat, pos: [0, 0.01, 0] }),
    sym("x", sym("z", e(f, h, f, w / 2 - f / 2, 0, d / 2 - f / 2))),
    [0, h - f].map(y => [sym("z", e(w, f, f, 0, y, d / 2 - f / 2)), sym("x", e(f, f, d, w / 2 - f / 2, y, 0))]),
    sym("z", box(w - 2 * f, f * 0.8, 0.012, { mat: frame, pos: [0, h / 2 - f * 0.4, d / 2], rot: [0, 0, Math.atan2(h, w) * 57.3] })))
}

// Slumped tied sack: wide flat base, cloth body, cinched neck, tie band, floppy top.
function sack(h, { mat = "sack", tie = "woodD", at = [0, 0, 0], seed = 1 } = {}) {
  const [x, y, z] = at
  return [lathe([h * 0.36, 0, h * 0.44, h * 0.12, h * 0.42, h * 0.38, h * 0.3, h * 0.58, h * 0.12, h * 0.72], { mat, sides: S(9), pos: [x, y, z], wobble: WB(), jitter: 0.012, seed }),
    cyl(h * 0.11, h * 0.05, { mat: tie, sides: S(7), pos: [x, y + h * 0.7, z] }),
    cone(h * 0.16, h * 0.16, { mat, sides: S(6), pos: [x, y + h * 0.74, z], rot: [12, 0, 8], wobble: WB(), jitter: 0.02, seed: seed + 2 })]
}

// Spoked wheel facing +/-z: rim, hub, spokes. Center at y = r.
function wheel(r, { w = 0.07, mat = "woodD", rim = "iron", hub = "iron", spokes = 6, at = [0, 0, 0] } = {}) {
  const [x, y, z] = at
  return tf({ pos: [x, y + r, z] },
    torus(r * 0.9, r * 0.1, { mat: rim, rot: [90, 0, 0], rings: S(12), sides: S(4) }),
    cyl(r * 0.18, w * 1.6, { mat: hub, sides: S(8), rot: [90, 0, 0], pos: [0, 0, -w * 0.8] }),
    [...Array(N(spokes, 3))].map((_, i) => tf({ rot: [0, 0, i * (180 / N(spokes, 3))] }, box(0.035, r * 1.7, 0.03, { mat, pos: [0, -r * 0.85, 0] }))))
}

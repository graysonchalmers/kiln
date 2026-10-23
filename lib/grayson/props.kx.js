// Grayson hard-surface recipes for kiln. include() next to nature.kx.js.
// Built pieces: frames proud of panels (1-2 cm) so construction reads and nothing z-fights.
include("./detail.kx.js")

// Plank crate: dark core (shows in the gaps), board panels on every side, light frame on all 12 edges, brace.
function crate(w, h, d, { mat = "wood", frame = "woodL", core = "woodD", at = [0, 0, 0], rot = [0, 0, 0], f = 0.05, seed = 1 } = {}) {
  const e = (sx, sy, sz, x, y, z) => box(sx, sy, sz, { mat: frame, pos: [x, y, z] }), t = 0.02, tones = [mat, frame]
  return tf({ pos: at, rot },
    box(w - 0.04, h - 0.04, d - 0.04, { mat: core, pos: [0, 0.02, 0] }),
    sym("z", planks(w - 2 * f, h - 2 * f, t, { along: "x", across: "y", tones, seed, at: [0, f, d / 2 - t / 2 - 0.005] })),
    sym("x", planks(t, h - 2 * f, d - 2 * f, { along: "z", across: "y", tones, seed: seed + 1, at: [w / 2 - t / 2 - 0.005, f, 0] })),
    planks(w - 2 * f, t, d - 2 * f, { along: "x", across: "z", tones, seed: seed + 2, at: [0, h - t - 0.005, 0] }),
    sym("x", sym("z", e(f, h, f, w / 2 - f / 2, 0, d / 2 - f / 2))),
    [0, h - f].map(y => [sym("z", e(w, f, f, 0, y, d / 2 - f / 2)), sym("x", e(f, f, d, w / 2 - f / 2, y, 0))]),
    sym("z", box(Math.hypot(w - 2 * f, h - 2 * f) * 0.95, f * 0.8, 0.02, { mat: frame, pos: [0, h / 2 - f * 0.4, d / 2 + 0.005], rot: [0, 0, Math.atan2(h, w) * 57.3] })))
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

// A panel of boards instead of one slab. Boards run along `along` ("x" | "y" | "z"), stacked across `across`;
// each board is inset by `gap` and gets a slight random length/height wobble so the panel reads hand-built.
// w, h, d = overall panel size (x, y, z); base at y = 0 like box().
function planks(w, h, d, { along = "x", across = "y", n, gap = 0.008, tones = ["wood", "woodL"], at = [0, 0, 0], seed = 1 } = {}) {
  const size = { x: w, y: h, z: d }, rnd = _r(seed * 13 + 1), count = n ?? Math.max(2, Math.round(size[across] / 0.11))
  const step = size[across] / count
  return tf({ pos: at }, [...Array(count)].map((_, i) => {
    const dims = { ...size }
    dims[across] = step - gap
    dims[along] = size[along] * (0.97 + rnd() * 0.03)
    const pos = [0, 0, 0], ai = { x: 0, y: 1, z: 2 }
    pos[ai[across]] = across === "y" ? i * step + gap / 2 : -size[across] / 2 + step * (i + 0.5)
    pos[ai[along]] += (rnd() - 0.5) * 0.01
    return box(dims.x, dims.y, dims.z, { mat: tones[(i + (rnd() < 0.3 ? 1 : 0)) % tones.length], pos })
  }))
}

// Kit mode test: "make me a swamp kit". Plan -> build from recipes -> blind grade -> fix. 2026-10-22.
// Plan (14): bald cypress, cypress knees, dead snag, mangrove roots, lily pads, cattail clump, hanging-moss branch,
// rotting stump with fungus, mossy boulders, fallen log bridge, boardwalk segment, stilt hut, lantern post, glowing toadstools.
include("../lib/grayson/nature.kx.js")
include("../lib/grayson/props.kx.js")
include("../lib/grayson/styles.kx.js")
style("swamp")
settings({ mood: "day" })  // review the lit pieces (hut, lantern, toadstools) under the same daylight as the rest
pal({ reed: "#9aac58", cattail: "#9a5030", lily: "#5a8a3a", lilyL: "#7aa850", petal: "#f0e6f0", rope: "#9a8a68",
  thatch: "#b09c58", thatchD: "#857238", capG: { color: "#4a8064", emit: "#4a9a74", glow: 1.25 }, stem: "#d8d2b8",
  shelf: "#c89a58", glass: { color: "#ffe2a0", emit: "#ffc860", glow: 3 }, iron: { color: "#4a4e52", metal: 0.7, rough: 0.5 },
  hangMoss: "#6f7345", barkG: "#a19378", ring: "#b89a6a", fung: "#e0a050", fungL: "#f2dcb0", gill: "#2e4a3e" })

// ---------- trees
feature(0)
model("bald_cypress",
  [0, 60, 125, 185, 240, 300].map((a, i) => { const c = Math.cos(a * Math.PI / 180), n = Math.sin(a * Math.PI / 180), e = 1 + (i % 3) * 0.15
    return tube([c * 0.25, 1.1 - (i % 2) * 0.2, n * 0.25, c * 0.55 * e, 0.45, n * 0.55 * e, c * 0.95 * e, 0.02, n * 0.95 * e], 0.16, { mat: i % 2 ? "bark" : "barkD", sides: S(6), top: 0.06 }) }),
  trunk(5.2, { r: 0.5, flare: 2.2, taper: 0.4, lean: [0.9, -0.3], branches: [[1.3, 4.4, 0.3], [-0.5, 4.7, -0.5], [0.8, 5.0, 0.7], [-1.0, 3.6, 0.35]] }),
  [[1.35, 4.5, 0.3, 0.75], [-0.45, 4.8, -0.45, 0.7], [0.75, 5.1, 0.7, 0.65], [0.45, 5.3, -0.1, 0.85], [-1.0, 3.7, 0.35, 0.7]].map(([x, y, z, r], i) =>
    tf({ pos: [x, y, z], scale: [1.3, 0.75, 1.2] }, canopy(r, { seed: 5 + i * 7, wild: 1, puffs: 4 }))),
  [[1.0, 4.35, 0.5], [1.7, 4.4, 0.1], [-0.6, 4.65, -0.2], [0.3, 5.05, 0.9]].map(([x, y, z], i) =>
    tf({ pos: [x, y, z], rot: [0, i * 40, 0], scale: [1, 1, 0.3] }, tube([0, 0, 0, 0.03, -0.35, 0, -0.02, -0.7 - i * 0.1, 0.02], 0.11, { mat: "hangMoss", top: 0.04, sides: 4 }))))
model("cypress_knees",
  [[0, 0, 0.5], [0.3, 0.15, 0.3], [-0.25, 0.2, 0.26], [0.12, -0.3, 0.38], [-0.12, -0.12, 0.16], [0.38, -0.2, 0.14]].map(([x, z, h], i) =>
    tf({ pos: [x, 0, z], rot: [(i - 2) * 6, i * 50, (i % 3 - 1) * 12] }, (w => [
      lathe([w * 1.25, 0, w * 1.3, h * 0.3, w * 1.12, h * 0.58, w * 0.85, h * 0.8, w * 0.5, h * 0.95, 0, h], { mat: i % 2 ? "bark" : "barkD", sides: S(7), wobble: WB(0.3), jitter: 0.015, seed: i }),
      sphere(w * 0.55, { mat: "barkG", pos: [0, h * 0.92, 0], scale: [1, 0.6, 1], detail: SD(0) })])(0.08 + h * 0.2))),
  sphere(0.45, { mat: "grassD", scale: [1.15, 0.12, 1], pos: [0.05, 0, -0.03], detail: SD(1), wobble: WB(0.3), jitter: 0.02 }))
model("dead_snag",
  trunk(2.4, { r: 0.29, flare: 1.9, mat: "barkG", lean: [-0.25, 0.1], branches: [[0.6, 1.9, 0.1], [-0.7, 2.2, -0.2], [-0.5, 1.45, 0.4]] }),
  [[-0.06, 0.25, 15], [0.05, 0.18, -20], [0, 0.32, 5]].map(([x, h, a]) => cone(0.07, h, { mat: "ring", sides: 4, pos: [-0.24 + x, 2.35, 0.1], rot: [0, a * 3, a] })),
  [0.4, 1.1, 1.7].map(y => box(0.03, 0.3, 0.02, { mat: "barkD", pos: [-0.03 * y, y, 0.16], rot: [0, 0, 4], minor: true })))
model("mangrove_roots",
  [...Array(8)].map((_, i) => { const a = i * 0.79 + (i % 3) * 0.25, r = 0.45 + ((i * 37) % 5) * 0.08, hh = 0.75 + (i % 3) * 0.12
    const c = Math.cos(a), n = Math.sin(a), ts = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1]
    return tube(ts.flatMap(t => [c * r * 1.15 * t, hh * (1 - t * t), n * r * 1.15 * t]), ts.map(t => 0.1 - 0.05 * t), { mat: "bark", sides: S(6) }) }),
  trunk(1.1, { r: 0.2, flare: 1.4, taper: 0.5 }).map(it => tf({ pos: [0, 0.7, 0] }, it)),
  canopy(0.55, { at: [0, 2.15, 0], seed: 31, puffs: 7, wild: 0.7 }), canopy(0.35, { at: [0.45, 1.95, 0.2], seed: 33, puffs: 3 }))

// ---------- water plants
model("lily_pads",
  [[0, 0, 0.32, 0], [0.55, 0.2, 0.24, 1], [-0.42, 0.38, 0.2, 2], [0.22, -0.5, 0.28, 3], [-0.33, -0.33, 0.16, 4]].map(([x, z, r, i]) =>
    extrude([...Array(S(9))].flatMap((_, k, arr) => { const a = 0.35 + (k / (arr.length - 1)) * 5.6; return [Math.cos(a) * r, Math.sin(a) * r] }).concat([0, 0]),
      0.025, { mat: i % 2 ? "lily" : "lilyL", rot: [90, i * 47, 0], pos: [x, 0.025 + i * 0.006, z] })),
  [0, 72, 144, 216, 288].map((a, i) => tf({ rot: [0, a, 0] }, sphere(0.08, { mat: i % 2 ? "petal" : "stem", pos: [0.07, 0.1, 0], scale: [1.3, 0.6, 0.7], rot: [0, 0, 25], detail: SD(0) }))),
  sphere(0.045, { mat: "shelf", pos: [0, 0.14, 0], detail: SD(0) }))
model("cattails",
  sphere(0.2, { mat: "grassD", scale: [1, 0.35, 1], detail: SD(1), wobble: WB(0.3), jitter: 0.02 }),
  blades(8, { h: 1.1, w: 0.06, sides: 4, spread: 0.28, tones: ["reed", "grass"], seed: 3, bend: 0.35 }),
  [[0.04, 0.03, 1.05], [-0.07, 0.05, 0.95], [0.09, -0.06, 1.2], [-0.02, -0.09, 0.85]].map(([x, z, h]) =>
    [cyl(0.025, h, { mat: "reed", sides: S(4), pos: [x, 0, z] }), lathe([0, 0, 0.04, 0.015, 0.05, 0.07, 0.045, 0.14, 0, 0.17], { mat: "cattail", sides: 10, pos: [x, h - 0.15, z], smooth: 60 })]))
// Fallen mossy branch (round 2): rests on the ground; the preview grounds every model at its lowest point, so a
// "hanging" branch always stood on its strands. One tapered tube (radius per point), moss cushions on top, drapes to the ground.
model("moss_branch",
  cyl(0.12, 0.012, { mat: "ring", sides: 10, rot: [0, 0, 90], pos: [-0.9, 0.13, 0] }),
  [[0.06, 0.1, 10], [-0.05, 0.07, -25]].map(([z, h, a]) => cone(0.05, h, { mat: "bark", sides: 4, pos: [-0.9, 0.17, z], rot: [0, a, 90] })),
  tube([-0.9, 0.13, 0, -0.5, 0.14, 0.08, -0.1, 0.13, -0.04, 0.35, 0.12, 0.03, 0.9, 0.08, -0.05], [0.13, 0.125, 0.11, 0.095, 0.06], { mat: "bark", sides: 10 }),
  tube([0.35, 0.14, 0.03, 0.55, 0.32, 0.2, 0.65, 0.5, 0.3], 0.055, { mat: "bark", top: 0.02 }),
  [[-0.62, 0.16, 1], [-0.32, 0.09, -1], [-0.05, 0.15, 1], [0.38, 0.08, -1], [0.66, 0.12, 1]].map(([x, r, side], i) => [
    sphere(r, { mat: i % 2 ? "moss" : "hangMoss", pos: [x, 0.24, side * 0.02], scale: [1.5, 0.6, 1.4], detail: SD(1), jitter: 0.012, seed: i })]))

// ---------- ground clutter
model("fungus_stump",
  [0, 72, 144, 216, 288].map((a, i) => tf({ rot: [0, a + 20, 0] }, cone(0.15, 0.27, { mat: "barkD", sides: S(5), pos: [0.2, -0.05, 0], rot: [0, 0, 30], jitter: 0.02 }))),
  cyl(0.3, 0.61, { mat: "bark", sides: S(9), top: 0.25, pos: [0, -0.06, 0], wobble: WB(), jitter: 0.035 }),
  [[10, 0.22, 8], [48, 0.12, -6], [95, 0.17, 12], [150, 0.07, 0]].map(([a, h, t], i) => tf({ rot: [0, a, 0] }, cone(0.09 - i * 0.008, h, { mat: "barkD", sides: 4, pos: [0.2, 0.54, 0], rot: [t, 0, -8] }))),
  cyl(0.19, 0.012, { mat: "ring", sides: S(9), pos: [0, 0.55, 0] }),
  [[0.12, 0.26], [0.28, 0.2], [0.42, 0.15], [0.2, 0.17]].map(([y, r], i) => tf({ rot: [0, -30 + i * 22, 0] },
    cyl(r, 0.045, { mat: "fung", cap: "fungL", capAngle: 30, sides: S(8), scale: [1, 1, 0.6], pos: [0.27, y, 0], smooth: 40 }))))
model("mossy_boulders", mossRock(0.5, { seed: 21, squash: 0.95 }), tf({ pos: [0.6, -0.5 * 0.95 * 0.7 + 0.28 * 0.9 * 0.7, 0.3] }, mossRock(0.28, { seed: 22, squash: 0.9 })), tf({ pos: [-0.45, -0.5 * 0.95 * 0.7 + 0.2 * 0.9 * 0.7, 0.35] }, mossRock(0.2, { seed: 23, squash: 0.9 })))
model("glow_toadstools",
  sphere(0.15, { mat: "ground", scale: [1.2, 0.16, 1], detail: SD(1), wobble: WB(0.2), jitter: 0.01 }),
  [[0, 0, 1.4], [0.12, 0.08, 0.7], [-0.1, 0.1, 0.6], [0.05, -0.12, 0.8], [-0.14, -0.05, 0.5]].map(([x, z, s]) =>
    tf({ pos: [x, 0, z], scale: [s, s, s], rot: [(x * 90) | 0, 0, (z * 90) | 0] }, lathe([0.04, 0, 0.032, 0.03, 0.022, 0.07, 0.02, 0.14], { mat: "stem", sides: S(6) }),
      lathe([0.08 + x * 0.1, 0, 0.07, 0.025 + z * 0.08, 0.03, 0.06, 0, 0.065], { mat: "capG", sides: S(8), pos: [0, 0.13, 0], smooth: 50 }))),
  light({ type: "point", color: "#9fe8c8", power: 3, pos: [0, 0.35, 0.15] }))

// ---------- built
feature(3)
model("log_bridge",
  tube([-1.5, 0.24, 0, -1.38, 0.23, 0, -0.6, 0.22, 0.03, 0.4, 0.22, -0.02, 1.5, 0.2, 0.04], [0.33, 0.26, 0.24, 0.21, 0.18], { mat: "bark", sides: S(8), jitter: 0.015 }),
  cyl(0.15, 0.012, { mat: "woodL", sides: S(8), rot: [0, 0, 90], pos: [1.506, 0.2, 0.04] }),
  [...Array(10)].map((_, i) => { const x = -1.08 + i * 0.24, X = [-1.5, -1.38, -0.6, 0.4, 1.5], T = [0.57, 0.49, 0.46, 0.43, 0.38], j = Math.max(0, X.findIndex((v, q) => x <= X[q + 1]))
    const top = T[j] + (T[j + 1] - T[j]) * (x - X[j]) / (X[j + 1] - X[j]) + 0.005  // log centre + radius along its taper
    return box(0.21, 0.04, 0.3 + (i % 3) * 0.02, { mat: i % 2 ? "woodL" : "wood", pos: [x, top, (i % 2) * 0.01], rot: [0, (i % 3 - 1) * 2, -2.5] }) }),
  sym("x", [box(0.14, 0.62, 0.14, { mat: "woodD", pos: [1.1, 0.3, 0.19] }), box(0.14, 0.62, 0.14, { mat: "woodD", pos: [0.3, 0.3, 0.19] })]),
  tube([-1.1, 0.9, 0.17, -0.7, 0.8, 0.17, -0.3, 0.9, 0.17, 0, 0.82, 0.17, 0.3, 0.9, 0.17, 0.7, 0.8, 0.17, 1.1, 0.9, 0.17].map((v, i) => i % 3 === 2 ? 0.19 : v), 0.06, { mat: "rope", sides: 6 }))
model("boardwalk",
  [...Array(10)].map((_, i) => box(1.0 + (i % 3) * 0.06, 0.05, 0.22, { mat: i % 2 ? "wood" : "woodL", pos: [(i % 2) * 0.04 - 0.02, 0.5, -1.1 + i * 0.245], rot: [0, (i % 3 - 1) * 2, 0] })),
  sym("x", box(0.08, 0.1, 2.5, { mat: "woodD", pos: [0.42, 0.4, 0] })),
  sym("x", [-1.1, 0, 1.1].map(z => cyl(0.1, z ? 0.75 : 0.5, { mat: "barkD", sides: S(7), pos: [0.42, 0, z], top: 0.085, rot: [z * 3, 0, z ? -3 : 2], jitter: 0.01 }))))
feature(3.25)
model("stilt_hut",
  sym("x", sym("z", cyl(0.16, 1.4, { mat: "bark", sides: S(6), pos: [0.88, 0, 0.72], top: 0.12, rot: [3, 0, -3], jitter: 0.01 }))),
  planks(2.0, 0.08, 1.7, { along: "z", across: "x", tones: ["woodL", "wood"], at: [0, 1.2, 0], seed: 7 }),
  box(1.56, 1.1, 1.26, { mat: "woodD", pos: [0, 1.28, -0.05] }),
  [0.6, -0.7].map((z, k) => planks(1.6, 1.1, 0.04, { along: "y", across: "x", n: 9, tones: ["wood", "woodL"], at: [0, 1.28, z], seed: 2 + k })),
  sym("x", planks(0.04, 1.1, 1.3, { along: "y", across: "z", n: 7, tones: ["wood", "woodL"], at: [0.8, 1.28, -0.05], seed: 4 })),
  [0.25, 0.55, 0.85].map(y => sym("z", box(1.62, 0.03, 0.02, { mat: "woodD", pos: [0, 1.28 + y, 0.6] }))),
  box(0.4, 0.75, 0.02, { mat: "woodD", pos: [-0.35, 1.28, 0.605] }),
  box(0.3, 0.3, 0.02, { mat: "glass", pos: [0.4, 1.68, 0.605] }),
  prism(2.1, 1.0, 1.8, { mat: "thatch", pos: [0, 2.38, -0.05], jitter: 0.03 }),
  box(F(0.04) * 2.2, F(0.04) * 2.2, 1.9, { mat: "woodL", pos: [0, 3.33, -0.05] }),
  [-0.6, -0.1].map(x => tf({ pos: [x, 0, 1.9], rot: [-41, 0, 0] }, box(0.07, 1.6, 0.07, { mat: "woodD" }))),
  [0.2, 0.4, 0.6, 0.8].map(t => box(0.5, 0.04, 0.12, { mat: "wood", pos: [-0.35, 1.2 * t, 1.9 - 1.05 * t] })),
  light({ type: "point", color: "#ffc070", power: 30, pos: [0.4, 1.8, 0.9] }))
feature(1.7)
model("lantern_post",
  box(0.28, 0.12, 0.28, { mat: "woodD" }), box(0.2, 1.7, 0.2, { mat: "barkD" }), box(0.45, 0.09, 0.09, { mat: "woodD", pos: [0.2, 1.61, 0] }), tf({ pos: [0.13, 1.42, 0], rot: [0, 0, -45] }, box(0.08, 0.32, 0.08, { mat: "woodD" })),
  [0, 1].map(k => torus(F(0.02) * 1.3, F(0.02) * 0.45, { mat: "iron", rings: 8, sides: 4, rot: [90 * (k % 2), 0, 0], pos: [0.38, 1.6 - k * 0.06, 0], minor: true })),
  cyl(0.08, 0.2, { mat: "glass", sides: S(6), pos: [0.38, 1.22, 0] }), cone(0.11, 0.1, { mat: "iron", sides: S(6), pos: [0.38, 1.42, 0] }),
  cyl(0.09, 0.025, { mat: "iron", sides: S(6), pos: [0.38, 1.2, 0] }),
  light({ type: "point", color: "#ffd8b0", power: 8, pos: [0.38, 1.1, 0.25] }))

pack("swamp_kit", ["bald_cypress", "cypress_knees", "dead_snag", "mangrove_roots", "lily_pads", "cattails", "moss_branch",
  "fungus_stump", "mossy_boulders", "glow_toadstools", "log_bridge", "boardwalk", "stilt_hut", "lantern_post"])

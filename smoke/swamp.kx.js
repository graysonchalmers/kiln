// Kit mode test: "make me a swamp kit". Plan -> build from recipes -> blind grade -> fix. 2026-10-22.
// Plan (14): bald cypress, cypress knees, dead snag, mangrove roots, lily pads, cattail clump, hanging-moss branch,
// rotting stump with fungus, mossy boulders, fallen log bridge, boardwalk segment, stilt hut, lantern post, glowing toadstools.
include("../lib/grayson/nature.kx.js")
include("../lib/grayson/props.kx.js")
include("../lib/grayson/styles.kx.js")
style("swamp")
pal({ reed: "#7a8a48", cattail: "#4a3020", lily: "#5a8a3a", lilyL: "#7aa850", petal: "#f0e6f0", rope: "#9a8a68",
  thatch: "#8a7a4a", thatchD: "#64582f", capG: { color: "#7ac8a0", emit: "#6ad8a8", glow: 2 }, stem: "#d8d2b8",
  shelf: "#c89a58", glass: { color: "#ffe2a0", emit: "#ffc860", glow: 3 }, iron: { color: "#4a4e52", metal: 0.7, rough: 0.5 },
  hangMoss: "#8a9a6a", barkG: "#7a7468", ring: "#b89a6a", fung: "#e0a050", fungL: "#f2dcb0", gill: "#2e4a3e" })

// ---------- trees
feature(0)
model("bald_cypress",
  [0, 51, 103, 154, 206, 257, 309].map((a, i) => tf({ rot: [0, a, 0] }, cone(0.24, 1.3 - (i % 3) * 0.25, { mat: i % 2 ? "bark" : "barkD", sides: S(5), pos: [0.42, 0, 0], rot: [0, 0, 18], wobble: WB(), jitter: 0.03 }))),
  cone(0.75, 1.6, { mat: "bark", sides: S(12), wobble: WB(), jitter: 0.04 }),
  trunk(5.2, { r: 0.26, lean: [0.45, -0.15], branches: [[1.3, 4.4, 0.3], [-0.5, 4.7, -0.5], [0.8, 5.0, 0.7]] }),
  [[1.35, 4.5, 0.3, 0.75], [-0.45, 4.8, -0.45, 0.7], [0.75, 5.1, 0.7, 0.65], [0.45, 5.3, -0.1, 0.85]].map(([x, y, z, r], i) =>
    tf({ pos: [x, y, z], scale: [1.4, 0.38, 1.3] }, canopy(r, { seed: 5 + i * 7, wild: 1, puffs: 4 }))),
  [[1.0, 4.35, 0.5], [1.7, 4.4, 0.1], [-0.6, 4.65, -0.2], [0.3, 5.05, 0.9]].map(([x, y, z], i) =>
    tube([x, y, z, x + 0.03, y - 0.35, z, x - 0.02, y - 0.7 - i * 0.1, z + 0.02], 0.025, { mat: "hangMoss" })))
model("cypress_knees",
  [[0, 0, 0.38], [0.3, 0.15, 0.24], [-0.25, 0.2, 0.2], [0.12, -0.3, 0.3], [-0.12, -0.12, 0.14], [0.38, -0.2, 0.12]].map(([x, z, h], i) =>
    tf({ pos: [x, 0, z], rot: [(i - 2) * 7, i * 50, (i % 3 - 1) * 10] },
      cone(0.08 + h * 0.18, h, { mat: i % 2 ? "bark" : "barkD", sides: S(7), wobble: WB(0.3), jitter: 0.02, seed: i }),
      sphere(0.035 + h * 0.06, { mat: "barkG", pos: [0, h * 0.85, 0], scale: [1, 0.8, 1], detail: SD(1), jitter: 0.008 }))))
model("dead_snag",
  trunk(2.4, { r: 0.17, mat: "barkG", lean: [-0.25, 0.1], branches: [[0.6, 1.9, 0.1], [-0.7, 2.2, -0.2]] }),
  [[-0.06, 0.25, 15], [0.05, 0.18, -20], [0, 0.32, 5]].map(([x, h, a]) => cone(0.07, h, { mat: "ring", sides: 4, pos: [-0.24 + x, 2.35, 0.1], rot: [0, a * 3, a] })),
  [0.4, 1.1, 1.7].map(y => box(0.03, 0.3, 0.02, { mat: "barkD", pos: [-0.03 * y, y, 0.16], rot: [0, 0, 4] })))
model("mangrove_roots",
  [...Array(8)].map((_, i) => { const a = i * 0.79 + (i % 3) * 0.25, r = 0.45 + ((i * 37) % 5) * 0.08, hh = 0.75 + (i % 3) * 0.12
    return tube([0, hh, 0, Math.cos(a) * r * 0.45, hh - 0.08 + (i % 2) * 0.1, Math.sin(a) * r * 0.45, Math.cos(a) * r, 0.25 + (i % 2) * 0.1, Math.sin(a) * r, Math.cos(a) * r * 1.12, 0, Math.sin(a) * r * 1.12], 0.035 + (i % 3) * 0.01, { mat: i % 2 ? "bark" : "barkD" }) }),
  trunk(1.1, { r: 0.13 }).map(it => tf({ pos: [0, 0.82, 0] }, it)),
  canopy(0.55, { at: [0, 2.15, 0], seed: 31, puffs: 7, wild: 0.7 }), canopy(0.35, { at: [0.45, 1.95, 0.2], seed: 33, puffs: 3 }))

// ---------- water plants
model("lily_pads",
  [[0, 0, 0.32, 0], [0.55, 0.2, 0.24, 1], [-0.42, 0.38, 0.2, 2], [0.22, -0.5, 0.28, 3], [-0.33, -0.33, 0.16, 4]].map(([x, z, r, i]) =>
    extrude([...Array(S(9))].flatMap((_, k, arr) => { const a = 0.35 + (k / (arr.length - 1)) * 5.6; return [Math.cos(a) * r, Math.sin(a) * r] }).concat([0, 0]),
      0.015, { mat: i % 2 ? "lily" : "lilyL", rot: [90, i * 47, 0], pos: [x, 0.015 + i * 0.006, z] })),
  [0, 72, 144, 216, 288].map((a, i) => tf({ rot: [0, a, 0] }, sphere(0.04, { mat: i % 2 ? "petal" : "stem", pos: [0.035, 0.07, 0], scale: [1.3, 0.6, 0.7], detail: SD(0) }))),
  sphere(0.025, { mat: "shelf", pos: [0, 0.1, 0], detail: SD(0) }))
model("cattails",
  blades(12, { h: 1.1, w: 0.02, sides: 4, spread: 0.15, tones: ["reed", "grassD"], seed: 3 }),
  [[0.04, 0.03, 1.05], [-0.06, 0.05, 0.95], [0.08, -0.06, 1.2], [-0.02, -0.08, 0.85]].map(([x, z, h]) =>
    [cyl(0.008, h, { mat: "reed", sides: S(4), pos: [x, 0, z] }), cyl(0.028, 0.16, { mat: "cattail", sides: S(8), pos: [x, h - 0.2, z], smooth: 60 })]))
model("moss_branch",
  tube([-0.9, 1.6, 0, -0.5, 1.72, 0.08, -0.1, 1.68, -0.04, 0.35, 1.78, 0.03, 0.9, 1.9, -0.05], 0.065, { mat: "barkD" }),
  tube([0.35, 1.78, 0.03, 0.6, 1.95, 0.25], 0.035, { mat: "barkD" }),
  [-0.7, -0.4, -0.12, 0.15, 0.45, 0.72].flatMap((x, i) => [0, 2].map(k => {
    const BX = [-0.9, -0.5, -0.1, 0.35, 0.9], BY = [1.6, 1.72, 1.68, 1.78, 1.9], j = Math.max(0, BX.findIndex((b, q) => x <= BX[q + 1]))
    const len = 0.35 + ((i * 3 + k * 7) % 5) * 0.12, dx = (k - 1) * 0.04, y0 = BY[j] + (BY[j + 1] - BY[j]) * (x - BX[j]) / (BX[j + 1] - BX[j]) - 0.02
    return [sphere(0.05, { mat: "moss", pos: [x + dx, y0 - 0.03, 0], scale: [1.2, 0.8, 1], detail: SD(0), jitter: 0.01 }), tube([x + dx, y0, k * 0.03 - 0.03, x + dx + 0.03, y0 - len * 0.4, k * 0.02, x + dx - 0.02, y0 - len * 0.75, -0.02, x + dx + 0.02, y0 - len, 0.01], 0.014 + (k % 2) * 0.008, { mat: (i + k) % 2 ? "hangMoss" : "moss" })]
  })))

// ---------- ground clutter
model("fungus_stump",
  [0, 72, 144, 216, 288].map((a, i) => tf({ rot: [0, a + 20, 0] }, cone(0.13, 0.25, { mat: "barkD", sides: S(5), pos: [0.28, 0, 0], rot: [0, 0, 30], jitter: 0.02 }))),
  cyl(0.3, 0.55, { mat: "bark", sides: S(9), top: 0.25, wobble: WB(), jitter: 0.035 }),
  [0, 50, 95, 140, 200, 250, 300].map((a, i) => tf({ rot: [0, a, 0] }, cone(0.06, 0.08 + (i % 3) * 0.05, { mat: "barkD", sides: 4, pos: [0.22, 0.54, 0] }))),
  cyl(0.22, 0.02, { mat: "ring", sides: S(9), pos: [0, 0.53, 0] }),
  [[0.12, 0.17], [0.28, 0.13], [0.42, 0.1], [0.2, 0.11]].map(([y, r], i) => tf({ rot: [0, -30 + i * 22, 0] },
    cyl(r, 0.035, { mat: "fung", sides: S(8), scale: [1, 1, 0.6], pos: [0.27, y, 0], smooth: 40 }),
    cyl(r * 0.85, 0.015, { mat: "fungL", sides: S(8), scale: [1, 1, 0.55], pos: [0.27, y + 0.034, 0] }),
    cyl(r * 0.9, 0.01, { mat: "gill", sides: S(8), scale: [1, 1, 0.55], pos: [0.27, y - 0.008, 0] }))))
model("mossy_boulders", tf({ pos: [0, -0.08, 0] }, mossRock(0.5, { seed: 21 })), tf({ pos: [0.6, -0.05, 0.3] }, mossRock(0.28, { seed: 22 })), tf({ pos: [-0.45, -0.04, 0.35] }, mossRock(0.2, { seed: 23 })))
model("glow_toadstools",
  [[0, 0, 1], [0.12, 0.08, 0.7], [-0.1, 0.1, 0.6], [0.05, -0.12, 0.8], [-0.14, -0.05, 0.5]].map(([x, z, s]) =>
    tf({ pos: [x, 0, z], scale: [s, s, s], rot: [(x * 90) | 0, 0, (z * 90) | 0] }, cyl(0.025, 0.14, { mat: "stem", sides: S(6), top: 0.02 }),
      lathe([0.08 + x * 0.1, 0, 0.07, 0.025 + z * 0.08, 0.03, 0.06, 0, 0.065], { mat: "capG", sides: S(8), pos: [0, 0.13, 0], smooth: 50 }))),
  light({ type: "point", color: "#9aef60", power: 8, pos: [0, 0.35, 0.15] }))

// ---------- built
feature(3)
model("log_bridge",
  cyl(0.22, 3, { mat: "bark", sides: S(8), rot: [0, 0, 90], pos: [1.5, 0.22, 0], wobble: WB(), jitter: 0.02 }),
  sym("x", cyl(0.18, 0.01, { mat: "woodL", sides: S(8), rot: [0, 0, 90], pos: [1.505, 0.22, 0] })),
  [...Array(11)].map((_, i) => box(0.21, 0.04, 0.3 + (i % 3) * 0.02, { mat: i % 2 ? "woodL" : "wood", pos: [-1.2 + i * 0.24, 0.42, (i % 2) * 0.01], rot: [0, (i % 3 - 1) * 2, 0] })),
  sym("x", [box(0.06, 0.6, 0.06, { mat: "woodD", pos: [1.1, 0.3, 0.17] }), box(0.06, 0.6, 0.06, { mat: "woodD", pos: [0.3, 0.3, 0.17] })]),
  tube([-1.1, 0.88, 0.17, -0.7, 0.8, 0.17, -0.3, 0.86, 0.17, 0.3, 0.86, 0.17, 0.7, 0.8, 0.17, 1.1, 0.88, 0.17], F(0.02), { mat: "rope", sides: 5 }))
model("boardwalk",
  [...Array(10)].map((_, i) => box(1.0 + (i % 3) * 0.06, 0.05, 0.22, { mat: i % 2 ? "wood" : "woodL", pos: [(i % 2) * 0.04 - 0.02, 0.5, -1.1 + i * 0.245], rot: [0, (i % 3 - 1) * 2, 0] })),
  sym("x", box(0.08, 0.1, 2.5, { mat: "woodD", pos: [0.42, 0.4, 0] })),
  sym("x", [-1.1, 0, 1.1].map(z => cyl(0.07, 0.5, { mat: "barkD", sides: S(7), pos: [0.42, 0, z], jitter: 0.01 }))))
feature(3.25)
model("stilt_hut",
  sym("x", sym("z", cyl(0.07, 1.4, { mat: "barkD", sides: S(6), pos: [0.85, 0, 0.7], jitter: 0.01 }))),
  planks(2.0, 0.08, 1.7, { along: "z", across: "x", tones: ["woodL", "wood"], at: [0, 1.2, 0], seed: 7 }),
  box(1.56, 1.1, 1.26, { mat: "woodD", pos: [0, 1.28, -0.05] }),
  [0.6, -0.7].map((z, k) => planks(1.6, 1.1, 0.04, { along: "y", across: "x", n: 9, tones: ["wood", "woodL", "bark"], at: [0, 1.28, z], seed: 2 + k })),
  sym("x", planks(0.04, 1.1, 1.3, { along: "y", across: "z", n: 7, tones: ["wood", "bark"], at: [0.8, 1.28, -0.05], seed: 4 })),
  [0.25, 0.55, 0.85].map(y => sym("z", box(1.62, 0.03, 0.02, { mat: "woodD", pos: [0, 1.28 + y, 0.6] }))),
  box(0.4, 0.75, 0.02, { mat: "woodD", pos: [-0.35, 1.28, 0.605] }),
  box(0.3, 0.3, 0.02, { mat: "glass", pos: [0.4, 1.68, 0.605] }),
  prism(2.1, 0.8, 1.8, { mat: "thatch", pos: [0, 2.38, -0.05], jitter: 0.03 }),
  prism(2.3, 0.1, 2.0, { mat: "thatchD", pos: [0, 2.3, -0.05] }),
  [0, 1, 2].map(i => prism(2.2 - i * 0.25, 0.08, 1.9 - i * 0.28, { mat: i % 2 ? "thatchD" : "thatch", pos: [0, 2.42 + i * 0.22, -0.05], jitter: 0.015, seed: i })),
  prism(1.6, 0.55, 1.35, { mat: "thatch", pos: [0, 2.6, -0.05], jitter: 0.02 }),
  box(F(0.04) * 2.2, F(0.04) * 2.2, 1.9, { mat: "woodL", pos: [0, 3.13, -0.05] }),
  [-0.6, -0.1].map(x => tf({ pos: [x, 0, 1.9], rot: [-41, 0, 0] }, box(0.05, 1.6, 0.06, { mat: "woodD" }))),
  [0.2, 0.4, 0.6, 0.8].map(t => box(0.5, 0.04, 0.12, { mat: "wood", pos: [-0.35, 1.2 * t, 1.9 - 1.05 * t] })),
  light({ type: "point", color: "#ffc070", power: 30, pos: [0.4, 1.8, 0.9] }))
feature(1.7)
model("lantern_post",
  box(0.1, 1.7, 0.1, { mat: "barkD" }), box(0.45, 0.06, 0.06, { mat: "barkD", pos: [0.2, 1.62, 0] }),
  [0, 1].map(k => torus(F(0.02) * 1.3, F(0.02) * 0.45, { mat: "iron", rings: 8, sides: 4, rot: [90 * (k % 2), 0, 0], pos: [0.38, 1.6 - k * 0.06, 0] })),
  cyl(0.08, 0.2, { mat: "glass", sides: S(6), pos: [0.38, 1.22, 0] }), cone(0.11, 0.1, { mat: "iron", sides: S(6), pos: [0.38, 1.42, 0] }),
  cyl(0.09, 0.025, { mat: "iron", sides: S(6), pos: [0.38, 1.2, 0] }),
  light({ type: "point", color: "#ffbe70", power: 40, pos: [0.38, 1.1, 0.25] }))

pack("swamp_kit", ["bald_cypress", "cypress_knees", "dead_snag", "mangrove_roots", "lily_pads", "cattails", "moss_branch",
  "fungus_stump", "mossy_boulders", "glow_toadstools", "log_bridge", "boardwalk", "stilt_hut", "lantern_post"])

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
  hangMoss: "#8a9a6a", barkG: "#7a7468", ring: "#b89a6a" })

// ---------- trees
model("bald_cypress",
  [0, 60, 120, 180, 240, 300].map((a, i) => tf({ rot: [0, a + i * 7, 0] }, cone(0.16, 0.9 - (i % 2) * 0.2, { mat: i % 2 ? "bark" : "barkD", sides: S(5), pos: [0.3, 0, 0], rot: [0, 0, 22], wobble: WB(), jitter: 0.02 }))),
  cone(0.5, 1.2, { mat: "bark", sides: S(10), wobble: WB(), jitter: 0.03 }),
  trunk(5.4, { r: 0.24, lean: [0.15, -0.1], branches: [[0.7, 3.6, 0.2], [-0.6, 4.2, -0.3], [0.3, 4.8, 0.6]] }),
  [[3.7, 1.0, 0.45], [4.35, 0.85, 0.42], [4.95, 0.7, 0.4], [5.5, 0.55, 0.4], [5.95, 0.38, 0.45]].map(([y, r, sq], i) =>
    tf({ pos: [0.13 + (i % 2 ? 0.12 : -0.08), y, (i % 3 - 1) * 0.1], scale: [1.35, sq, 1.25] }, canopy(r, { seed: 3 + i * 4, wild: 0.8, puffs: 3, tones: ["leaf", "leafL", "leafD"] }))))
model("cypress_knees",
  [[0, 0, 0.32], [0.3, 0.15, 0.22], [-0.25, 0.2, 0.18], [0.12, -0.3, 0.26], [-0.1, -0.12, 0.14]].map(([x, z, h], i) =>
    tf({ pos: [x, 0, z], rot: [(i - 2) * 6, i * 50, (i % 3 - 1) * 9] },
      cyl(0.07 + h * 0.12, h, { mat: i % 2 ? "bark" : "barkD", sides: S(7), top: 0.05 + h * 0.08, wobble: WB(), jitter: 0.015, seed: i }),
      sphere(0.055 + h * 0.08, { mat: "barkG", pos: [0, h, 0], scale: [1, 0.7, 1], detail: SD(1), jitter: 0.01 }))),
  tube([0, 0.02, 0, 0.3, 0.05, 0.15, 0.12, 0.03, -0.3], 0.05, { mat: "barkD" }), tube([0, 0.02, 0, -0.25, 0.04, 0.2], 0.045, { mat: "bark" }))
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
    const len = 0.35 + ((i * 3 + k * 7) % 5) * 0.12, dx = (k - 1) * 0.04, y0 = 1.68
    return tube([x + dx, y0, k * 0.03 - 0.03, x + dx + 0.03, y0 - len * 0.4, k * 0.02, x + dx - 0.02, y0 - len * 0.75, -0.02, x + dx + 0.02, y0 - len, 0.01], 0.012 + (k % 2) * 0.006, { mat: (i + k) % 2 ? "hangMoss" : "moss" })
  })))

// ---------- ground clutter
model("fungus_stump",
  cyl(0.3, 0.45, { mat: "bark", sides: S(9), top: 0.26, wobble: WB(), jitter: 0.03 }),
  tf({ pos: [0, 0.45, 0], rot: [6, 0, -4] }, cyl(0.25, 0.02, { mat: "ring", sides: S(9) }), cyl(0.17, 0.025, { mat: "woodL", sides: S(9) }), cyl(0.08, 0.03, { mat: "ring", sides: S(7) })),
  [[0.22, 0.2, 0, 0], [0.15, 0.32, 0.15, 40], [-0.03, 0.14, 0.22, 95], [0.2, 0.1, -0.12, -30]].map(([x, y, z, a]) =>
    tf({ pos: [x, y, z], rot: [0, a, 0] }, cyl(0.1, 0.025, { mat: "shelf", sides: S(7), scale: [1, 1, 0.55], pos: [0.02, 0, 0] }), cyl(0.09, 0.012, { mat: "ring", sides: S(7), scale: [1, 1, 0.5], pos: [0.02, 0.024, 0] }))))
model("mossy_boulders", tf({ pos: [0, -0.08, 0] }, mossRock(0.5, { seed: 21 })), tf({ pos: [0.6, -0.05, 0.3] }, mossRock(0.28, { seed: 22 })), tf({ pos: [-0.45, -0.04, 0.35] }, mossRock(0.2, { seed: 23 })))
model("glow_toadstools",
  [[0, 0, 1], [0.12, 0.08, 0.7], [-0.1, 0.1, 0.6], [0.05, -0.12, 0.8], [-0.14, -0.05, 0.5]].map(([x, z, s]) =>
    tf({ pos: [x, 0, z], scale: [s, s, s], rot: [(x * 90) | 0, 0, (z * 90) | 0] }, cyl(0.025, 0.14, { mat: "stem", sides: S(6), top: 0.02 }),
      lathe([0.08 + x * 0.1, 0, 0.07, 0.025 + z * 0.08, 0.03, 0.06, 0, 0.065], { mat: "capG", sides: S(8), pos: [0, 0.13, 0], smooth: 50 }))),
  light({ type: "point", color: "#9aef60", power: 8, pos: [0, 0.35, 0.15] }))

// ---------- built
model("log_bridge",
  cyl(0.22, 3, { mat: "bark", sides: S(8), rot: [0, 0, 90], pos: [1.5, 0.22, 0], wobble: WB(), jitter: 0.02 }),
  sym("x", cyl(0.18, 0.01, { mat: "woodL", sides: S(8), rot: [0, 0, 90], pos: [1.505, 0.22, 0] })),
  box(2.6, 0.04, 0.3, { mat: "woodL", pos: [0, 0.42, 0] }),
  sym("x", [box(0.06, 0.9, 0.06, { mat: "woodD", pos: [1.1, 0, 0.3] }), box(0.06, 0.9, 0.06, { mat: "woodD", pos: [0.3, 0, 0.3] })]),
  tube([-1.1, 0.85, 0.3, -0.3, 0.8, 0.3, 0.3, 0.8, 0.3, 1.1, 0.85, 0.3], 0.02, { mat: "rope" }))
model("boardwalk",
  [...Array(7)].map((_, i) => box(0.24, 0.05, 1.0, { mat: i % 2 ? "wood" : "woodL", pos: [-0.78 + i * 0.26, 0.5, 0], rot: [0, (i % 3 - 1) * 1.5, 0] })),
  sym("z", box(1.9, 0.08, 0.08, { mat: "woodD", pos: [0, 0.42, 0.4] })),
  sym("x", sym("z", cyl(0.06, 0.45, { mat: "barkD", sides: S(6), pos: [0.85, 0, 0.42], jitter: 0.01 }))),
  sym("x", tube([0.85, 0.05, -0.42, 0.85, 0.42, 0.42], 0.025, { mat: "barkD" })), sym("x", tube([0.85, 0.05, 0.42, 0.85, 0.42, -0.42], 0.025, { mat: "barkD" })))
model("stilt_hut",
  sym("x", sym("z", cyl(0.07, 1.4, { mat: "barkD", sides: S(6), pos: [0.85, 0, 0.7], jitter: 0.01 }))),
  box(2.0, 0.08, 1.7, { mat: "woodL", pos: [0, 1.2, 0] }),
  box(1.6, 1.1, 1.3, { mat: "wood", pos: [0, 1.28, -0.05] }),
  [0.25, 0.55, 0.85].map(y => sym("z", box(1.62, 0.03, 0.02, { mat: "woodD", pos: [0, 1.28 + y, 0.6] }))),
  box(0.4, 0.75, 0.02, { mat: "woodD", pos: [-0.35, 1.28, 0.605] }),
  box(0.3, 0.3, 0.02, { mat: "glass", pos: [0.4, 1.68, 0.605] }),
  prism(2.1, 0.8, 1.8, { mat: "thatch", pos: [0, 2.38, -0.05], jitter: 0.03 }),
  prism(2.3, 0.1, 2.0, { mat: "thatchD", pos: [0, 2.3, -0.05] }),
  prism(1.6, 0.55, 1.35, { mat: "thatch", pos: [0, 2.6, -0.05], jitter: 0.02 }),
  box(0.08, 0.08, 1.9, { mat: "woodL", pos: [0, 3.15, -0.05] }),
  [...Array(4)].map((_, i) => box(0.5, 0.04, 0.22, { mat: "wood", pos: [-0.35, 0.9 - i * 0.29, 1.0 + i * 0.25] })),
  [-0.62, -0.08].map(x => tf({ pos: [x, 0, 1.38], rot: [-50, 0, 0] }, box(0.04, 1.45, 0.08, { mat: "woodD", pos: [0, 0, 0] }))),
  light({ type: "point", color: "#ffc070", power: 30, pos: [0.4, 1.8, 0.9] }))
model("lantern_post",
  box(0.1, 1.7, 0.1, { mat: "barkD" }), box(0.45, 0.06, 0.06, { mat: "barkD", pos: [0.2, 1.62, 0] }),
  [0, 1, 2].map(k => torus(0.02, 0.006, { mat: "iron", rings: 6, sides: 3, rot: [90 * (k % 2), 0, 0], pos: [0.38, 1.6 - k * 0.035, 0] })),
  cyl(0.08, 0.2, { mat: "glass", sides: S(6), pos: [0.38, 1.25, 0] }), cone(0.11, 0.1, { mat: "iron", sides: S(6), pos: [0.38, 1.45, 0] }),
  cyl(0.09, 0.02, { mat: "iron", sides: S(6), pos: [0.38, 1.24, 0] }),
  light({ type: "point", color: "#ffbe70", power: 40, pos: [0.38, 1.1, 0.25] }))

pack("swamp_kit", ["bald_cypress", "cypress_knees", "dead_snag", "mangrove_roots", "lily_pads", "cattails", "moss_branch",
  "fungus_stump", "mossy_boulders", "glow_toadstools", "log_bridge", "boardwalk", "stilt_hut", "lantern_post"])

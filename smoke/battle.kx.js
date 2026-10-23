// Battle-test kit: organic (irregular) + hard-surface (symmetric) set dressing. 2026-10-22.
include("../lib/grayson/nature.kx.js")
include("../lib/grayson/props.kx.js")
pal({
  leaf: "#3d8c48", leafL: "#74c45a", leafD: "#255238", bark: "#6e4535", barkD: "#3b2622",
  wood: "#9c6a4d", barkM: "#8a5a3c", rot: "#c9a878", hayL: "#f0d47a", woodD: "#6e4535", woodL: "#c08a5e", hay: "#e0bf5a", hayD: "#b8933a",
  stone: "#7a7f96", stoneL: "#a2a7c2", stoneD: "#4e5266", moss: "#5f8f3a",
  iron: { color: "#55595f", metal: 0.8, rough: 0.4 }, cloth: "#c94f3a", sack: "#c9b48a",
  cactusD: "#3a6e3c", cactus: "#4f8a4a", cactusL: "#78b060", sand: "#e0cc8a", agaveD: "#3f6e66", agave: "#5f8f80", agaveL: "#a8c8a0",
  capB: "#b88a5a", stem: "#f2e6cf", water: { color: "#2a5f9a", rough: 0.08 }, rope: "#c9b48a",
})

// ---------- organic: should read irregular
model("windswept_tree", trunk(1.8, { r: 0.16, lean: [0.6, 0.1], branches: [[1.3, 1.8, 0.2], [0.35, 1.5, -0.4]] }),
  tf({ pos: [0.75, 2.0, 0], scale: [1.1, 0.75, 1] }, canopy(0.5, { seed: 4, wild: 0.9, puffs: 4 })),
  tf({ pos: [1.45, 1.85, 0.15], scale: [1.4, 0.55, 0.9] }, canopy(0.38, { seed: 6, wild: 0.9, puffs: 3 })),
  tf({ pos: [1.95, 1.7, -0.05], scale: [1.5, 0.45, 0.7] }, canopy(0.25, { seed: 13, puffs: 2 })),
  tf({ pos: [0.35, 1.7, -0.35], scale: [1.2, 0.7, 1] }, canopy(0.3, { seed: 9, puffs: 3 })))
model("old_oak", tf({ scale: [2, 2, 2] }, trunk(1.3, { r: 0.3, lean: [-0.12, 0.08], branches: [[0.9, 1.5, 0.3], [-0.8, 1.6, -0.2], [0.1, 1.95, -0.7]] }),
  canopy(0.85, { at: [0, 2.0, 0], seed: 7, puffs: 7 }), canopy(0.5, { at: [0.9, 1.7, 0.3], seed: 8 }), canopy(0.45, { at: [-0.8, 1.75, -0.2], seed: 12 })))
model("pine_grove", tf({ pos: [-0.5, 0, 0], rot: [3, 0, -2] }, conifer(3, { seed: 2, tiers: 5 })),
  tf({ pos: [0.65, 0, 0.3], rot: [-2, 40, 4] }, conifer(2.2, { seed: 5, tiers: 4 })),
  tf({ pos: [0.1, 0, -0.75], rot: [0, 80, -3] }, conifer(1.4, { seed: 9, tiers: 3 })))
model("fern_patch", fronds(9, { len: 0.6, w0: 0.22, zig: 1.1, seed: 3, segs: 2, wild: 1, vee: 12, tones: ["leafD", "leaf"], tipTones: ["leafL", "leaf"] }),
  tf({ pos: [0.45, 0, 0.3], scale: [0.6, 0.6, 0.6], rot: [0, 37, 0] }, fronds(6, { seed: 8, segs: 2, wild: 1, vee: 12, w0: 0.2, zig: 1.1, tones: ["leafD"], tipTones: ["leafL"] })),
  fiddlehead(0.22, { at: [0.05, 0, 0.02], rot: 30 }), fiddlehead(0.16, { at: [-0.06, 0, -0.03], rot: 200 }))
model("agave", fronds(8, { len: 0.62, lift: 0.4, w0: 0.3, tip: 0.02, thick: 0.05, zig: 0, segs: 3, droop: 0.35, seed: 4, wild: 0.8, vee: 35, tones: ["agaveD", "agave"], tipTones: ["agaveL", "agave"] }),
  tf({ rot: [0, 23, 0] }, fronds(6, { len: 0.42, lift: 0.4, w0: 0.24, tip: 0.02, thick: 0.05, zig: 0, segs: 2, droop: 0.1, seed: 9, wild: 0.8, vee: 40, tones: ["agave"], tipTones: ["agaveL"] })),
  fronds(4, { len: 0.22, lift: 0.3, w0: 0.16, tip: 0.02, thick: 0.05, zig: 0, segs: 1, droop: 0, seed: 2, vee: 45, tones: ["agaveL"] }))
model("cactus", tf({ rot: [2, 0, 5] },
  cyl(0.14, 1.5, { mat: "cactus", sides: 8, top: 0.11, jitter: 0.01 }), sphere(0.11, { mat: "cactusL", pos: [0, 1.5, 0], detail: 1, scale: [1, 0.6, 1] }),
  tube([0, 0.55, 0, 0.3, 0.6, 0.02, 0.36, 0.72, 0.02, 0.37, 0.98, 0.02], 0.08, { mat: "cactusL" }), sphere(0.08, { mat: "cactusL", pos: [0.37, 0.98, 0.02], scale: [1, 0.6, 1] }),
  tube([0, 0.95, 0.02, -0.25, 0.98, 0.05, -0.3, 1.08, 0.05, -0.3, 1.22, 0.05], 0.065, { mat: "cactusD" }), sphere(0.065, { mat: "cactusD", pos: [-0.3, 1.22, 0.05], scale: [1, 0.6, 1] })),
  rock(0.35, { mat: "sand", squash: 0.15, seed: 2 }))
model("rotting_log", tf({ rot: [0, 12, 0] },
    cyl(0.2, 1.5, { mat: "barkM", sides: 8, top: 0.17, rot: [0, 0, 88], pos: [0.75, 0.2, 0], jitter: 0.05, seed: 3 }),
    cyl(0.13, 0.02, { mat: "barkD", sides: 8, rot: [0, 0, 88], pos: [0.76, 0.2, 0] }),
    [[0, 0.12, 0.06, 20], [0.02, 0.28, -0.08, -15], [0, 0.18, -0.12, 35], [0.03, 0.08, 0.13, -30]].map(([x, y, z, a], i) =>
      cone(0.07, 0.1 + i * 0.03, { mat: i % 2 ? "rot" : "barkM", sides: 4, rot: [a, 0, 90], pos: [-0.75 - x, y, z] })),
    box(0.5, 0.03, 0.16, { mat: "rot", pos: [0.15, 0.37, 0.04], rot: [0, 8, 0] }),
    [[0.1, 0.3, 0.17, 1], [0.32, 0.27, 0.19, 0.7], [-0.25, 0.3, 0.17, 0.8]].map(([x, y, z, s]) =>
      tf({ pos: [x, y, z], scale: [s, s, s], rot: [55, 0, 0] }, cyl(0.03, 0.1, { mat: "stem", sides: 5 }), cone(0.09, 0.05, { mat: "capB", sides: 6, pos: [0, 0.09, 0] }))),
    rock(0.2, { mat: "moss", seed: 11, squash: 0.2, pos: [-0.35, 0.37, -0.03] })))
feature(2.6)
model("well",
  cyl(0.6, 0.6, { mat: "stone", sides: 10, jitter: 0.015 }), cyl(0.47, 0.01, { mat: "water", sides: 10, pos: [0, 0.6, 0] }),
  torus(0.56, 0.08, { mat: "stoneL", rings: 10, sides: 5, pos: [0, 0.64, 0] }),
  [0.2, 0.4].map(y => cyl(0.605, 0.02, { mat: "stoneD", sides: 10, pos: [0, y, 0] })),
  box(F(0.02) * 2, F(0.02) * 2, 0.3, { mat: "iron", pos: [0.8, 1.56, 0.14] }), box(F(0.02) * 2, 0.22, F(0.02) * 2, { mat: "iron", pos: [0.8, 1.38, 0.29] }),
  sym("x", box(0.1, 2.0, 0.1, { mat: "woodD", pos: [0.72, 0, 0] })),
  cyl(0.06, 1.5, { mat: "wood", sides: 6, rot: [0, 0, 90], pos: [0.75, 1.6, 0] }),
  // roof as construction: two boards meeting at a ridge, stepped shingle rows, ridge beam
  sym("z", tf({ pos: [0, 2.24, 0.3], rot: [40, 0, 0] },
    box(1.95, 0.06, 0.8, { mat: "woodD", pos: [0, -0.03, 0] }),
    [-0.27, -0.02, 0.23].map((z, i) => box(2.0 - i * 0.02, 0.035, 0.3, { mat: i % 2 ? "woodL" : "wood", pos: [0, 0.03 + i * 0.012, z], rot: [-4, 0, 0] })))),
  tf({ pos: [0, 2.5, 0], rot: [45, 0, 0] }, box(2.06, 0.1, 0.1, { mat: "woodD", pos: [0, -0.05, 0] })),
  sym("x", box(0.08, 0.5, 0.08, { mat: "woodD", pos: [0.72, 2.0, 0] })),
  cyl(F(0.01), 0.4, { mat: "rope", sides: 6, pos: [0, 1.2, 0] }),
  cyl(0.12, 0.2, { mat: "woodD", sides: 8, top: 0.1, pos: [0, 1.0, 0] }))
feature(0)
model("fence",
  [-0.95, 0, 0.95].map(x => [box(0.1, 1.0, 0.1, { mat: "woodD", pos: [x, 0, 0] }), cone(0.08, 0.08, { mat: "barkD", sides: 4, pos: [x, 1.0, 0], rot: [0, 45, 0] })]),
  [0.35, 0.75].map(y => box(2.0, 0.12, 0.04, { mat: "wood", pos: [0, y, 0.07] })))
feature(1.9)
model("signpost", box(0.1, 1.8, 0.1, { mat: "woodD" }), cone(0.09, 0.1, { mat: "barkD", sides: 4, pos: [0, 1.8, 0], rot: [0, 45, 0] }),
  extrude([-0.4, 0, 0.35, 0, 0.5, 0.11, 0.35, 0.22, -0.4, 0.22], 0.04, { mat: "woodL", pos: [0, 1.45, 0.05] }),
  extrude([0.4, 0, -0.35, 0, -0.5, 0.11, -0.35, 0.22, 0.4, 0.22], 0.04, { mat: "woodL", pos: [0, 1.15, 0.05] }),
  [1.56, 1.26].map(y => cyl(F(0.015), 0.03, { mat: "iron", sides: 6, rot: [90, 0, 0], pos: [0, y, 0.09] })))
model("cart",
  planks(1.4, 0.06, 0.9, { along: "x", across: "z", tones: ["wood", "woodL"], at: [0, 0.5, 0], seed: 3 }), box(1.36, 0.03, 0.86, { mat: "woodD", pos: [0, 0.48, 0] }), sym("z", box(1.44, 0.04, 0.07, { mat: "woodL", pos: [0, 0.95, 0.43] })), sym("x", box(0.07, 0.04, 0.94, { mat: "woodL", pos: [0.69, 0.95, 0] })),
  [-0.35, 0, 0.35].map(x => sym("z", box(0.02, 0.36, 0.06, { mat: "woodD", pos: [x, 0.59, 0.455] }))), sym("x", sym("z", box(0.07, 0.36, 0.07, { mat: "iron", pos: [0.69, 0.6, 0.44] }))),
  sym("z", planks(1.4, 0.35, 0.05, { along: "x", across: "y", n: 3, tones: ["woodD", "wood"], at: [0, 0.6, 0.43], seed: 5 })), sym("x", planks(0.05, 0.35, 0.9, { along: "z", across: "y", n: 3, tones: ["woodD", "wood"], at: [0.68, 0.6, 0], seed: 6 })),
  cyl(0.05, 1.2, { mat: "iron", sides: 6, rot: [90, 0, 0], pos: [0, 0.4, -0.6] }),
  sym("z", wheel(0.4, { at: [0, 0, 0.52] })),
  sym("z", tube([-0.6, 0.52, 0.35, -1.2, 0.35, 0.32, -1.6, 0.25, 0.3], 0.035, { mat: "woodD" })),
  sym("z", box(0.05, 0.25, 0.05, { mat: "woodD", pos: [-1.4, 0, 0.31] })))
model("hay_bale", box(0.86, 0.41, 0.46, { mat: "hay", pos: [0, 0.02, 0] }), box(0.9, 0.37, 0.5, { mat: "hay", pos: [0, 0.04, 0] }),
  box(0.84, 0.03, 0.44, { mat: "hayL", pos: [0, 0.42, 0] }),
  [0.1, 0.2, 0.3].map((y, i) => box(0.905, 0.025, 0.505, { mat: i % 2 ? "hayL" : "hayD", pos: [0, y, 0] })),
  [-0.25, 0.25].map(x => box(0.03, 0.455, 0.515, { mat: "barkD", pos: [x, 0, 0] })),
  [[-0.38, 0.2], [0.35, -0.19], [0.1, 0.21]].map(([x, z], i) => tf({ pos: [x, 0.43, z] }, blades(3, { h: 0.07, spread: 0.03, tones: ["hayL"], w: 0.015, seed: i + 2 }))))
model("gravestone", tf({ pos: [0, 0.08, 0], rot: [-3, 0, 2] }, extrude([-0.25, 0, 0.25, 0, 0.25, 0.55, 0.18, 0.68, 0.05, 0.73, -0.02, 0.66, -0.18, 0.68, -0.25, 0.55], 0.12, { mat: "stone", pos: [0, 0, -0.06] }),
    extrude([-0.17, 0.25, 0.17, 0.25, 0.17, 0.5, 0, 0.58, -0.17, 0.5], 0.01, { mat: "stoneD", pos: [0, 0, 0.06] }),
    extrude([-0.25, 0.53, 0.25, 0.53, 0.18, 0.69, 0.05, 0.74, -0.02, 0.67, -0.18, 0.69], 0.125, { mat: "stoneL", pos: [0, 0.02, -0.0625] })),
  box(0.65, 0.08, 0.3, { mat: "stoneD" }), rock(0.1, { mat: "moss", squash: 0.25, seed: 4, pos: [0.15, 0.09, 0.08] }))
model("market_crates", crate(0.6, 0.5, 0.5), crate(0.5, 0.4, 0.45, { at: [0.08, 0.5, 0], rot: [0, 12, 0] }),
  sack(0.55, { at: [0.62, 0, 0.1] }), sack(0.4, { at: [-0.55, 0, 0.15], seed: 3 }))

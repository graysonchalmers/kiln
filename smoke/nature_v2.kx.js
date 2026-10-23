// Nature kit v2: same assets as nature.kx.js, rebuilt on lib/grayson/nature.kx.js recipes.
include("../lib/grayson/nature.kx.js")
pal({
  leaf: "#3d8c48", leafL: "#74c45a", leafD: "#255238", autumn: "#d8742c", autumnL: "#f0a83a",
  bark: "#6e4535", barkD: "#3b2622", birch: "#e8e2d4", birchK: "#2e2a28",
  stone: "#7a7f96", stoneL: "#a2a7c2", stoneD: "#4e5266", moss: "#5f8f3a",
  grass: "#74c45a", grassD: "#4a9a3c", reed: "#7a9a4a",
  crystal: { color: "#a678d6", rough: 0.2, emit: "#b98cff", glow: 2.5 },
  flame: { color: "#ff7a1f", emit: "#ff8020", glow: 6 }, flameL: { color: "#ffe86e", emit: "#ffe070", glow: 8 },
})

// was 9 lines each
model("oak", trunk(1.2, { r: 0.18, branches: [[0.55, 1.6, 0.15], [-0.4, 1.45, -0.1]] }), canopy(0.75, { at: [0, 1.75, 0] }))
model("oak_autumn", { base: "oak", swap: { leaf: "autumn", leafL: "autumnL", leafD: "barkD" } })
model("pine", conifer(2.6))
model("pine_tall", conifer(4, { tiers: 6, r: 0.9, seed: 3 }))
model("grass_tuft", blades(9, { h: 0.4 }))
model("reeds", blades(7, { h: 1, w: 0.015, sides: 4, spread: 0.1, tones: ["reed"] }))
model("campfire", [0, 72, 144, 216, 288].map(a => tf({ rot: [0, a, 0] }, rock(0.12, { mat: "stoneD", seed: a, pos: [0.35, 0.06, 0] }))),
  [0, 60, 120].map(a => tf({ rot: [0, a, 0] }, cyl(0.04, 0.55, { mat: "bark", sides: 5, rot: [0, 0, 90], pos: [0.27, 0.06, 0] }))),
  flame(0.45, { at: [0, 0.08, 0] }))

// the four ⚠️ and one ❌ from round 2
model("birch", cyl(0.08, 2.4, { mat: "birch", sides: 6, top: 0.06 }),
  [0.4, 0.9, 1.4, 1.9].map((y, i) => cyl(0.085, 0.05, { mat: "birchK", sides: 6, pos: [0, y, 0], rot: [0, i * 40, 8] })),
  canopy(0.6, { at: [0, 2.6, 0], seed: 21, tones: ["leafL", "leafL", "leaf"], puffs: 5 }))
model("mossy_rock", mossRock(0.5, { seed: 31 }))
model("crystal_cluster", crystals(0.6))
model("pebbles", gravel(10))
model("fern", fronds(8, { len: 0.55 }))
model("palm_small", trunk(1.6, { r: 0.08 }), tf({ pos: [0, 1.6, 0] }, fronds(7, { len: 0.9, lift: 0.3, leaflets: 6 })))

pack("nature_v2", ["oak", "oak_autumn", "pine", "pine_tall", "grass_tuft", "reeds", "campfire", "birch", "mossy_rock",
  "crystal_cluster", "pebbles", "fern", "palm_small"])

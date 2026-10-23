// Detail control demo: same recipes at _D 0.5 / 1 / 2 via lods().
include("../lib/grayson/nature.kx.js")
include("../lib/grayson/props.kx.js")
pal({ leaf: "#3d8c48", leafL: "#74c45a", leafD: "#255238", bark: "#6e4535", barkD: "#3b2622",
  wood: "#9c6a4d", woodD: "#6e4535", woodL: "#c08a5e", iron: { color: "#55595f", metal: 0.8, rough: 0.4 }, sack: "#c9b48a",
  stone: "#7a7f96", stoneL: "#a2a7c2", moss: "#5f8f3a" })
lods("oak", () => [trunk(1.3, { r: 0.2, lean: [-0.1, 0.05], branches: [[0.7, 1.5, 0.3], [-0.6, 1.6, -0.2]] }), canopy(0.8, { at: [0, 2.0, 0], seed: 7, puffs: 6 })])
lods("pine", () => conifer(2.6, { seed: 2 }))
lods("fern", () => [fronds(8, { len: 0.55, w0: 0.22, zig: 1.1, seed: 3, segs: 3, wild: 1, vee: 12, tones: ["leafD", "leaf"], tipTones: ["leafL"] }), fiddlehead(0.2, { rot: 30 })])
lods("wheel", () => wheel(0.4))
lods("rocks", () => [mossRock(0.5, { seed: 31 }), gravel(6).map(g => tf({ pos: [0.7, 0, 0.2] }, g))])

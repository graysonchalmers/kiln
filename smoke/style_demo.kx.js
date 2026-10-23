// Same 5 recipes under every style preset.
include("../lib/grayson/nature.kx.js")
include("../lib/grayson/props.kx.js")
include("../lib/grayson/styles.kx.js")
const STYLE = typeof STYLE_NAME === "string" ? STYLE_NAME : "cozy"
style(STYLE)
model("vignette",
  trunk(1.3, { r: 0.18, lean: [0.15, 0], branches: [[0.6, 1.5, 0.2]] }), canopy(0.7, { at: [0.15, 1.9, 0], seed: 7 }),
  tf({ pos: [1.3, 0, -0.4] }, conifer(2.2, { seed: 4 })),
  tf({ pos: [-0.9, 0, 0.5] }, mossRock(0.35, { seed: 5 })),
  tf({ pos: [0.6, 0, 0.9] }, blades(9, { h: 0.35 })),
  tf({ pos: [-0.2, 0, 1.0] }, crate(0.45, 0.4, 0.4)),
  terrain(4, 3.5, { res: 12, height: 0.05, fn: (x, z) => 0.5 + 0.5 * Math.sin(x * 2) * Math.cos(z * 2), mat: () => "ground", pos: [0.2, -0.02, 0.2] }))

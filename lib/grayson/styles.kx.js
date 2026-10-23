// Style presets: one call sets the palette (shared keys every recipe uses), detail, wobble and look.
// style("swamp") before building. Override any key after with pal({ ... }).
include("./detail.kx.js")

const _STYLES = {
  cozy: { look: { ao: 0.6, smooth: 0 }, pal: {
    leaf: "#3d8c48", leafL: "#74c45a", leafD: "#255238", grass: "#74c45a", grassD: "#4a9a3c", moss: "#5f8f3a",
    bark: "#6e4535", barkD: "#3b2622", wood: "#9c6a4d", woodL: "#c08a5e", woodD: "#6e4535",
    stone: "#7a7f96", stoneL: "#a2a7c2", stoneD: "#4e5266", ground: "#6f4337", water: { color: "#3e8fd8", rough: 0.08 } } },
  swamp: { look: { ao: 0.75, smooth: 35 }, pal: {
    // 2026-10-22 round 1: lifted ~1.7x (wood/bark rendered darker than the review floor), warmed, stone light grey-green
    leaf: "#4e7a34", leafL: "#8db04e", leafD: "#2e4a24", grass: "#7a9440", grassD: "#55702e", moss: "#86a844",
    bark: "#7a5838", barkD: "#5e4430", wood: "#8a6a48", woodL: "#b0926a", woodD: "#5e4632",
    stone: "#8a9284", stoneL: "#aab2a2", stoneD: "#5c6458", ground: "#5a4a36", water: { color: "#3f5a45", rough: 0.1 } } },
  desert: { look: { ao: 0.5, smooth: 0 }, pal: {
    leaf: "#7a8f4a", leafL: "#a8b86a", leafD: "#4f6136", grass: "#c2b072", grassD: "#9c8a52", moss: "#8a9a50",
    bark: "#8a6a4a", barkD: "#5a4330", wood: "#b88a5a", woodL: "#d8ac78", woodD: "#8a6440",
    stone: "#c8a27a", stoneL: "#e2c49c", stoneD: "#9a7656", ground: "#d8bc88", water: { color: "#4aa0b8", rough: 0.08 } } },
  autumn: { look: { ao: 0.6, smooth: 0 }, pal: {
    leaf: "#c8642c", leafL: "#f0a83a", leafD: "#8a3a20", grass: "#a89a4a", grassD: "#7a6c34", moss: "#7a7a3a",
    bark: "#5e3e2c", barkD: "#33231a", wood: "#9c6a4d", woodL: "#c08a5e", woodD: "#6e4535",
    stone: "#86807a", stoneL: "#aaa49c", stoneD: "#5a5550", ground: "#6f4a32", water: { color: "#3e7ab0", rough: 0.08 } } },
  winter: { look: { ao: 0.5, smooth: 30 }, pal: {
    leaf: "#2f5e4e", leafL: "#e8eef2", leafD: "#1f3d34", grass: "#dfe8ee", grassD: "#b8c6d0", moss: "#9ab0a8",
    bark: "#4e3e36", barkD: "#2c2420", wood: "#8a7060", woodL: "#ab917e", woodD: "#5e4a3e",
    stone: "#8a94a6", stoneL: "#c2cad6", stoneD: "#5a6274", ground: "#e8eef2", water: { color: "#8ab8d8", rough: 0.05 } } },
}

// Material looks: what something is made of decides its edges, so recipes never set smooth/bevel per shape.
//   stone: soft round masses, gentle bevel      bark/log: round sides smooth, cut ends crisp
//   sawn wood: flat faces, small crisp bevel    metal: tight bevel      foliage/moss/cloth: smooth, no bevel
const LOOKS = { stone: { smooth: 42, bevel: 0.02 }, bark: { smooth: 42 }, wood: { bevel: 0.012 },
  metal: { bevel: 0.008 }, soft: { smooth: 55 } }
const LOOK_KEYS = {
  stone: ["stone", "stoneL", "stoneD", "rockT"], bark: ["bark", "barkD", "barkG", "barkM", "cactus", "cactusL", "cactusD"],
  wood: ["wood", "woodL", "woodD", "thatch", "thatchD", "hay", "hayL", "hayD"], metal: ["iron", "gold"],
  soft: ["leaf", "leafL", "leafD", "moss", "sack", "cloth", "capR", "capB", "capG", "stem", "fung", "fungL", "agave", "agaveL", "agaveD"],
}
function materialLooks(overrides = {}) {
  const looks = {}
  for (const [cls, keys] of Object.entries(LOOK_KEYS)) for (const k of keys) looks[k] = { ...LOOKS[cls], ...(overrides[cls] ?? {}) }
  settings({ looks })
}

function style(name, { detail: d, wobble: w } = {}) {
  const s = _STYLES[name]
  if (!s) throw new Error(`style '${name}': one of ${Object.keys(_STYLES).join(", ")}`)
  pal(s.pal)
  settings(s.look)
  materialLooks()
  if (d !== undefined) detail(d)
  if (w !== undefined) wobble(w)
}

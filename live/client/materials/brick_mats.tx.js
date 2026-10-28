// Live Blockout brick detail: neutral grey, seamless, multiplied by the palette colour in voxel_sweep.gdshader.
// Build: node ~/Projects-local/z-Git/uilianks/loom/bin/loom.js build live/client/materials/brick_mats.tx.js
pal({ lo: "#555555", mid: "#9a9a9a", hi: "#e6e6e6" })
{
  const c = cells({ scale: 5, jitter: 0.9, seed: 2 })
  const g = noise({ scale: 18, octaves: 4, seed: 3 })
  const h = c.edge.smooth(0.05, 0.3).mul(0.7).add(g.mul(0.3))
  material("stone", { size: 256, depth: 0.05 }, { height: h, color: ramp(h.mix(c.id, 0.3), ["lo", "mid", "hi"]), rough: 0.9 })
}
{
  const p = planks({ rows: 4, per: 1, gap: 0.01, seed: 4 })
  const h = p.grain.mul(0.6).add(noise({ scale: [3, 40], seed: 5 }).mul(0.4))
  material("wood", { size: 256, depth: 0.03 }, { height: h, color: ramp(h, ["lo", "mid", "hi"]), rough: 0.7 })
}
{
  const h = ridged({ scale: [2, 64], octaves: 3, seed: 6 })
  material("metal", { size: 256, depth: 0.01 }, { height: h.mul(0.5), color: ramp(h, ["mid", "hi"]), rough: 0.4, metal: 1 })
}
{
  const w = stripes({ count: 24, dir: "h", soft: 0.4 }).mul(stripes({ count: 24, dir: "v", soft: 0.4 }))
  const h = w.mul(0.7).add(noise({ scale: 30, seed: 7 }).mul(0.3))
  material("cloth", { size: 256, depth: 0.04 }, { height: h, color: ramp(h, ["lo", "mid", "hi"]), rough: 0.95 })
}

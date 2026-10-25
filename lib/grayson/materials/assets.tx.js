// Loom detail materials for the image-to-blockout pack. Albedos are near-white with dark grain/cavities, so kiln's
// palette `color` tints them back to each model's measured hexes (multiply). No plank seams: the meshes have them.
// Build: lib/grayson/materials/build.sh (needs a loom checkout; LOOM=path/to/loom).
pal({ w: "#ffffff", g1: "#e4e4e4", g2: "#bdbdbd", g3: "#8c8c8c", g4: "#5e5e5e" })

// wood grain: long streaks along u (staves and planks run along x/y), knots, no seams
const wFib = noise({ scale: 3, octaves: 4, seed: 5 }).warp(noise({ scale: 40, seed: 6 }), 0.004)
const wLines = stripes({ count: 48, soft: 0.5 }).warp(wFib, 0.03).as("grain")
const wH = wLines.mul(0.3).add(wFib.mul(0.5)).as("height")
material("woodgrain", { size: 512, depth: 0.015 }, {
  height: wH,
  color: ramp(wLines.mix(wFib, 0.5), ["g2", "g1", "w"]),
  rough: wLines.levels(0, 1, 0.7, 0.9),
})

// painted wood (crate): grain under worn paint, chipped edges show darker wood
const pGrain = stripes({ count: 40, soft: 0.6 }).warp(noise({ scale: 4, octaves: 3, seed: 8 }), 0.03)
const pChip = noise({ scale: 10, octaves: 4, seed: 11 }).threshold(0.72, 0.04).as("chips")
const pH = pGrain.mul(0.2).sub(pChip.mul(0.3)).add(noise({ scale: 30, seed: 3 }).mul(0.1)).as("height")
material("painted", { size: 512, depth: 0.012 }, {
  height: pH,
  color: ramp(noise({ scale: 6, octaves: 3, seed: 9 }), ["g1", "w"]).mul(pGrain.levels(0, 1, 0.85, 1)).mix("g3", pChip.mul(0.8)),
  rough: pChip.mix(0.6, 0.5).levels(0, 1, 0.6, 0.9),
})

// metal (hoops, hardware): hammered, scuffed, rust in the hollows
const mDent = cells({ scale: 10, seed: 2 }).as("dents")
const mScuff = noise({ scale: 40, octaves: 3, seed: 4 })
const mH = mDent.mul(0.3).add(mScuff.mul(0.15)).as("height")
material("metal", { size: 512, depth: 0.01 }, {
  height: mH,
  color: ramp(mScuff.mix(mDent, 0.5), ["g2", "g1", "w"]).mix("g4", mH.cavity(0.01, 10).mul(0.6)),
  rough: mScuff.levels(0, 1, 0.35, 0.65),
  metal: 0.6,
})

// canvas: fine weave
const cW = weave({ threads: 40 }).as("weave")
material("canvas", { size: 512, depth: 0.008 }, {
  height: cW.mul(0.6).add(noise({ scale: 12, seed: 3 }).mul(0.2)),
  color: ramp(cW.mix(noise({ scale: 5, seed: 6 }), 0.5), ["g2", "g1", "w"]),
  rough: 0.9,
})

// wood grain running up v (barrel staves stand vertical)
material("woodgrain_v", { size: 512, depth: 0.015 }, {
  height: wH.rotate(90),
  color: ramp(wLines.mix(wFib, 0.5).rotate(90), ["g2", "g1", "w"]),
  rough: wLines.levels(0, 1, 0.7, 0.9).rotate(90),
})

// soft stone (boulder): no crack decal, just broad low-contrast value variation and gentle height for AO. Beat flat
// boulder_v2 6-5 blind; a grain variant and a warm/cool hue variant also won 6-5 but lost the 3-way pick.
const sBig = noise({ scale: 2, octaves: 3, seed: 21 }), sMid = noise({ scale: 7, octaves: 3, seed: 22 })
material("stone_broad", { size: 512, depth: 0.02 }, {
  height: sBig.mul(0.6).add(sMid.mul(0.4)),
  color: ramp(sBig.mix(sMid, 0.3).levels(0.3, 0.7, 0, 1), ["g2", "w"]),
  rough: 0.85,
})

// Grayson nature recipes for kiln. Load with include("<rel>/lib/grayson/nature.kx.js").
// Each returns shape items; tones default to leaf/leafL/leafD, bark, stone/stoneL, flame/flameL.
// Distilled from the 2026-10-22 nature-kit review (text-to-glb references/what-good-looks-like.md).

const _r = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

// Broadleaf canopy: jittered spheres, light on top, dark underneath.
function canopy(r, { at = [0, 0, 0], seed = 1, tones = ["leaf", "leafL", "leafD"], puffs = 4 } = {}) {
  const [x, y, z] = at, rnd = _r(seed * 97 + 13)
  const out = [sphere(r, { mat: tones[0], pos: [x, y, z], scale: [1.1, 0.85, 1], jitter: 0.07, seed })]
  for (let i = 1; i < puffs; i++) {
    const a = rnd() * 6.28, up = i % 2 ? 0.45 : -0.2
    out.push(sphere(r * (0.55 + rnd() * 0.2), { mat: up > 0 ? tones[1] : tones[2],
      pos: [x + Math.cos(a) * r * 0.6, y + up * r, z + Math.sin(a) * r * 0.5], jitter: 0.06, seed: seed + i }))
  }
  return out
}

// Conifer: stacked cones, alternating tones, twisted per tier.
function conifer(h, { r = h * 0.32, tiers = 4, seed = 10, tones = ["leaf", "leafD"], trunk = "barkD" } = {}) {
  const base = h * 0.2
  return [cyl(r * 0.15, base + 0.1, { mat: trunk, sides: 5 }),
    ...[...Array(tiers)].map((_, i) => {
      const t = i / tiers
      return cone(r * (1 - t * 0.68), (h - base) * (0.45 - t * 0.12), { mat: tones[i % 2], sides: 7,
        pos: [0, base + (h - base) * t * 0.78, 0], rot: [0, i * 23, 0], jitter: 0.035, seed: seed + i })
    })]
}

// Trunk + optional branches as tubes. branches: [[x, y, z], ...] tips; each grows from the trunk.
function trunk(h, { r = 0.15, mat = "bark", branches = [] } = {}) {
  return [cyl(r, h, { mat, sides: 7, top: r * 0.65, jitter: 0.02 }),
    ...branches.map(([x, y, z], i) => tube([0, y * 0.7, 0, x * 0.5, y * 0.88, z * 0.5, x, y, z], r * 0.35 * (1 - i * 0.1), { mat }))]
}

// Grass/reed blades: thin 3-sided cones with random tilt.
function blades(n, { h = 0.4, spread = 0.12, seed = 1, tones = ["grass", "grassD"], sides = 3, w = 0.04 } = {}) {
  const rnd = _r(seed + 7)
  return [...Array(n)].map((_, i) => {
    const a = rnd() * 6.28, d = rnd() * spread
    return cone(w, h * (0.75 + rnd() * 0.5), { mat: tones[i % tones.length], sides,
      pos: [Math.cos(a) * d, 0, Math.sin(a) * d], rot: [(rnd() - 0.5) * 36, rnd() * 360, (rnd() - 0.5) * 36] })
  })
}

// Arched fronds (ferns, palms, agave): rise steeply, arc over, droop at the tip.
// Leaflets are V-pairs (tilted ±25°) so fronds keep volume from above.
function fronds(n, { len = 0.5, lift = 0.45, seed = 1, tones = ["leaf", "leafL"], stem = "leafD", leaflets = 4, spread = 0 } = {}) {
  const yAt = (t) => lift * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) - lift * 0.45 * Math.max(0, t - 0.6) / 0.4
  return [...Array(n)].map((_, i) => tf({ rot: [spread, i * (360 / n) + seed * 11, 0] },
    tube([0, 0, 0, 0, yAt(0.2), len * 0.2, 0, yAt(0.5), len * 0.5, 0, yAt(0.8), len * 0.8, 0, yAt(1), len], 0.012, { mat: stem }),
    [...Array(leaflets)].map((_, j) => {
      const t = (j + 1) / (leaflets + 1), w = len * 0.22 * (1 - t * 0.5)
      return sym("x", box(w, 0.01, len * 0.1, { mat: tones[j % 2], pos: [w / 2, yAt(t), len * t], rot: [0, 0, 25] }))
    })))
}

// Layered flame: outer orange, inner yellow, side lick, plus a point light.
function flame(h, { at = [0, 0, 0], power = 80, tones = ["flame", "flameL"] } = {}) {
  const [x, y, z] = at
  return [cone(h * 0.42, h * 0.8, { mat: tones[0], sides: 5, pos: [x, y, z], jitter: 0.05, seed: 1 }),
    cone(h * 0.25, h, { mat: tones[1], sides: 5, pos: [x + 0.03, y + 0.02, z + 0.02], rot: [0, 30, 4], jitter: 0.05, seed: 2 }),
    cone(h * 0.17, h * 0.6, { mat: tones[0], sides: 4, pos: [x - h * 0.2, y + 0.02, z - 0.04], rot: [0, 10, -12], seed: 3 }),
    light({ type: "point", color: "#ff9a40", power, pos: [x, y + h * 1.8, z + 0.2] })]
}

// Rock with a thin moss cap draped over the top (not a lid).
function mossRock(r, { seed = 1, squash = 0.65, rock: rm = "stone", moss = "moss" } = {}) {
  return [rock(r, { mat: rm, seed, squash }),
    rock(r * 0.92, { mat: moss, seed, squash: squash * 0.55, pos: [r * 0.05, r * squash * 0.42, -r * 0.05] })]
}

// Scatter of small low-tri stones (gravel, pebbles).
function gravel(n, { r = 0.06, area = 0.3, seed = 50, tones = ["stone", "stoneL"] } = {}) {
  const rnd = _r(seed)
  return [...Array(n)].map((_, i) => rock(r * (0.6 + rnd() * 0.8), { mat: tones[i % 2], seed: seed + i, squash: 0.5, detail: 0,
    pos: [(rnd() - 0.5) * area * 2, 0, (rnd() - 0.5) * area * 2] }))
}

// Crystal cluster: one tall spike plus fanned-out smaller ones.
function crystals(h, { n = 5, mat = "crystal", base = "stoneD", seed = 60 } = {}) {
  const rnd = _r(seed)
  return [rock(h * 0.3, { mat: base, seed, squash: 0.4 }),
    ...[...Array(n)].map((_, i) => {
      const a = (i / n) * 360 + rnd() * 30, tilt = i ? 25 + rnd() * 20 : 0
      return tf({ rot: [0, a, 0] }, cone(h * (i ? 0.12 : 0.16), h * (i ? 0.45 + rnd() * 0.3 : 1), { mat, sides: 5, pos: [i ? h * 0.12 : 0, 0, 0], rot: [0, 0, -tilt] }))
    })]
}

# kiln reference

Model files are plain JavaScript (or TypeScript) evaluated with the DSL as globals. Geometry is
built when a shape is called; references (`stamp`, `scatter`) resolve at build time, so models may
use each other in any order.

Units are meters, Y is up, +Z faces the front, rotations are degrees applied X, then Y, then Z.
Meshes are flat-shaded (low-poly look); primitives are built with every face pointing outward (tested by signed volume).

## Materials

```js
pal({
  wood: "#9c6a4d",                                   // plain color, rough 0.8
  gold: { color: "#ffb43a", metal: 0.2, rough: 0.3 },
  lamp: { color: "#ffd28c", emit: "#ffc070", glow: 3 },   // emissive (glow = strength)
  copy: "wood",                                      // alias
})
```

The default palette has keys `0`–`f` (sweetie16). Voxel grids need single-character keys.
Every model keeps the palette active where it was defined.

## Models

```js
model(name, opts?, ...items)
group(name, ["rock_a", "rock_a", "rock_b"])   // random pick per stamp/scatter; repeat to weight
pack(name, ["tree*", "rock", group], { cols, spacing = 0.4 })
include("other.kx.js")
```

| Option | Meaning |
|---|---|
| `pivot` | `"bottom"` (default: centered in x/z, base on y = 0), `"center"`, `"origin"` (as built). |
| `base` | Start from another model (variant). |
| `swap` | `{ from: "to" }` material replacements. |
| `scale` | Uniform number or `[x, y, z]`. |

Names starting with `_` are parts: usable everywhere, never exported.

## Shapes

The last argument is a material key, or an options object with `mat` plus:

| Common option | Meaning |
|---|---|
| `pos`, `rot`, `scale` | Placement (scale, then rotate, then move). Rotation pivots on the shape's origin. |
| `jitter` | Move welded vertices randomly by up to this distance (hand-made look). |
| `seed` | Jitter seed (and rock shape). |

| Shape | Origin | Options |
|---|---|---|
| `box(w, h, d)` | base center | |
| `cyl(r, h)` | base center | `sides` (8), `top` (top radius: tapers) |
| `cone(r, h)` | base center | `sides` (8) |
| `sphere(r)` | center | `detail` 0–4 (1) |
| `rock(r)` | center | `detail` (1), `rough` (0.22), `squash` (0.75), `seed` |
| `lathe([r0, y0, r1, y1, ...])` | axis | `sides` (8). Profile from bottom to top; radius 0 closes a tip. |
| `extrude([x0, y0, x1, y1, ...], depth)` | outline coordinates | Any simple polygon (concave ok), in X/Y, extruded along Z. |
| `prism(w, h, d)` | base center | Gable roof: triangle in X/Y, ridge along Z. |
| `wedge(w, h, d)` | base center | Ramp: full height at the back, 0 at the front. |

## Voxels

```js
voxels([layer0, layer1, ...], { size = 1, pos, rot, scale })
voxfn([nx, ny, nz], (x, y, z) => key | null, { size })
```

Layers run bottom to top. Each layer is a top-down map: rows go from the back (-z) to the front
(+z), columns from left (-x) to right (+x); `.` or space is empty, any other character is a
palette key. The grid is centered in x/z with its base on y = 0. Faces between voxels are removed
and coplanar faces of one material merge (greedy meshing).

## Structure and reuse

| Item | Meaning |
|---|---|
| `tf({ pos, rot, scale }, ...items)` | Transform a group. |
| `sym("x" \| "z", ...items)` | Items plus their mirror image across x = 0 (or z = 0). Nest for 4-way symmetry. |
| `stamp(name, { pos, rot, scale, swap })` | Place another model (or a random member of a group / glob). |
| `scatter(name, { area: [x0, z0, x1, z1], count, scale: [min, max], rot, y, seed, swap })` | Random copies, reproducible. `rot`: `[min, max]` degrees around Y, default random 0–360, `false` for none. |
| lists, `null`, `false` | Flattened / skipped. |

## Output and commands

`kiln build file.kx.js [--out DIR] [--only a,b] [--turntable] [--no-preview]`

| Path | Content |
|---|---|
| `out/models/<name>.glb` | glTF 2.0 binary: one node, one primitive per material, flat normals, PBR materials. |
| `out/<pack>.glb` | One node per model, laid out in rows. Engines import it as a library of named meshes. |
| `out/_preview/<name>.png` | Hero / front / right / top views, dimensions, triangle count, grid spacing, materials. |
| `out/_preview/<name>.gif` | `--turntable`: 36-frame orbit (needs ffmpeg). |

`kiln render file.kx.js <model|pack> [--out FILE] [--size WxH] [--yaw] [--pitch] [--samples] [--no-ground] [--transparent] [--frames N]`
renders with headless Blender (EEVEE, AgX, sun + sky lights, compositor bloom). `--frames N` renders
a turntable MP4 (needs ffmpeg). Blender is found via `$KILN_BLENDER`, `blender` on PATH, or the
`org.blender.Blender` flatpak.

`kiln info file.kx.js <name>` prints bounds, triangles per material and build steps.
`kiln serve file.kx.js [--port 4340] [--no-out]` runs the live viewer. `kiln list file.kx.js` lists everything.

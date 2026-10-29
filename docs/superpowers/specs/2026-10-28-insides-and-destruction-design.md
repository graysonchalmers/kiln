# Insides, structural members and destruction (design, 2026-10-28)

Ask (Grayson): props should have insides and structural members (barrel staves, hoops, heads), so burnt or destroyed
versions look right. Proof of the idea: `live/tools/insides_demo.py` (intact, cutaway, burnt, burnt cutaway of a barrel).

## What was in the way
- `ladder.solidify` filled every sealed void, so no prop could have an inside.
- The client draws only the skin two bricks deep; the inside of a hollow prop was never a surface to show.
- The model had no way to say "this part is structure" or "this is deliberate air".

## Design
1. **Air key `_` (built, `ladder.AIR`).** A shape returns `"_"` for deliberate interior air. `solidify` never fills it and
   returns it as empty, so walls, heads and battens around it become surfaces the client already draws. Plain sealed voids
   are still filled, so every old prop and the 13-prop golden numbers are unchanged.
2. **Material tags `structural` and `charred` (built, `materials.TAGS`).** The model marks load-bearing parts with
   `mat:"structural"` (hoops, frames, ribs, battens). `metal` counts as sturdy too. Old clients fall back to default.
3. **`damage(cells, materials, amount, seed, mode)` (built, `live/server/damage.py`).** Skin breaks and chars first from the top
   (`burn`) or raggedly (`break`); structural parts mostly hold, so hoops and frames survive and the inside stays visible. New
   keys: a charred one (dark, tag charred) and an ember one (emissive), picked from letters and digits the grid does not use (kiln's `pal()` refuses symbols). Deterministic per seed; amount 0 is a no-op.
4. **Built since (2026-10-28):** the shader entries for `structural` and `charred`; a stateless `damage` request in the protocol (see live/README.md); X key in the client; parts that lose their support fall (`settle`).
5. **Not built yet:**
   - stage prompt: teach the model `_` and `mat:"structural"` (changes every request, so it needs a real-model eval first, 5+ props, best of 2);
   - client: a continuous damage scrub (X steps 25% at a time today);
   - bricks inside a hollow prop need the skin-depth rule checked (inner walls count as surface, so they draw);
   - falling is rigid and straight down, one piece at a time; no tumbling, no breaking on impact.

## Decisions for Grayson
- Is the model or the engine in charge of structure? Today the model writes `_` and `structural`; an engine fallback (auto-hollow thick shells, auto-structure for metal) is possible but guesses.
- Burn only, or also break, shatter and rot? The code has `break`; the look is untuned.

## Physics hand-off (later, not built)
This is the blockout part: the result is voxels, and `settle()` only drops pieces straight down. A physics engine would do it properly
(tumbling, impact, breaking). The seam for that already exists: `damage.py` finds the rigid pieces (`_components`: face-connected
groups of cells), so a future `chunks:true` option on the `damage` request can return them as `[{cells:[flat indices], keys, count,
y_min}]` next to the grid, and the engine takes each one as a rigid body (voxel shape, mass from cell count and material tag) while the
client keeps drawing bricks. Until then the pieces just fall the short way and stay voxels.

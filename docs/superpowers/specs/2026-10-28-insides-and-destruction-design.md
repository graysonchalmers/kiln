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
   keys: `~` charred (dark, tag charred), `^` ember (emissive). Deterministic per seed; amount 0 is a no-op.
4. **Not built yet:**
   - stage prompt: teach the model `_` and `mat:"structural"` (changes every request, so it needs a real-model eval first, 5+ props, best of 2);
   - protocol: a `damage` request (amount, seed, mode) answered with the damaged grid, or the client calls the same rule in GDScript;
   - client: shader entries for `structural` (matte, slightly darker wood) and `charred` (rough, dark, faint ember glow); a scrub for damage amount;
   - bricks inside a hollow prop need the skin-depth rule checked (inner walls count as surface, so they draw);
   - physics-ish step: members whose support is gone drop (the batten in the demo floats).

## Decisions for Grayson
- Is the model or the engine in charge of structure? Today the model writes `_` and `structural`; an engine fallback (auto-hollow thick shells, auto-structure for metal) is possible but guesses.
- Burn only, or also break, shatter and rot? The code has `break`; the look is untuned.

# Building any object better (design, 2026-10-28)

Ask (Grayson): the props "don't look that great"; find a systemic way to build any object better, not a prompt per category.

## What the data says (45 real runs: 6 organic + 6 man-made props, 2 runs, 2 prompts)
- 12 of 45 runs (27%) had a separate floating piece of real size: a lantern's base disc, both planks of a signpost, a cork above its neck, a
  crate lid hovering over the box, a frog's legs. The gaps were small (2 to 9 cells of 32), so they are slips in the model's arithmetic, not designs.
- The model writes raw math for every point of the box ("is this point a barrel?"). Every part's position, size and overlap is a hand-computed
  inequality, so near-misses are the normal failure, and nothing in the loop checks the result.
- Failures that look like model weakness are mostly plumbing: 2 of 12 current-prompt organic runs failed (one a 6 s sampling timeout on a loaded box,
  one a syntax slip).
- Thin features (a signpost's planks, a lantern's frame, a flower stem) are marginal at 32 cells, so geometry that is right in the model's head is
  half gone on screen.
- Tuning prompts per category (man-made, organic, then what?) does not scale and the router that picks them is itself a source of errors.

## Where the leverage is: fix things after the model writes them, in code, instead of asking the prompt to be perfect
1. **Repair (built, `server/repair.py`, behind `--repair`).** After the volume is sampled, a part that floats is slid straight to the body and
   finishes face to face; specks go; pieces that are far away (a gap over 30% of the box) are left as designed. On the 45 real grids: runs with a
   floating piece 12 -> 0, 2 cells lost in total, 0.3 s a grid. Sheet: `.proof/20261028-better-builds/repair_sheet.png`.
2. **Validators with typed feedback (next).** Cheap checks on the sampled volume, each a sentence: floating parts (now repaired), thin features under
   2 cells at the 16 level, a key that never appears, the prop using under 60% of the box height, no ground contact. Repair what can be repaired; for the
   rest, ONE retry whose message names the problem ("the lantern's base disc has no contact with the frame; the signpost's planks are 5 cells from the post").
3. **Text vision for the retry (next).** Three 24x24 ASCII silhouettes (front, side, top) of the model's own result in the retry message. Haiku reads
   text well and cannot see images; this gives it a look at what it built for a few hundred tokens.
4. **Plan then compile (the big one).** The model writes a short part list instead of math: `name | shape | centre | size | key | attach-to | mirror`
   (shapes: box, cylinder, ellipsoid, cone, capsule, torus; smooth blend flag for organic). A small deterministic compiler (numpy, no node sandbox)
   turns it into the volume. Connectivity is by construction (attach-to snaps a part to its parent's surface), symmetry is a flag, thin parts get a
   minimum thickness, and nothing the model wrote is executed, which also removes the 6 s node timeouts and the code-execution surface. The
   `f(u,v,w)` path stays as an escape hatch. Category knowledge becomes recipes (a skeleton part list for creature, container, plant, building) used
   as one example in the plan prompt, picked by the same router, instead of whole prompts.

## Order and how to judge it
Repair (done) -> validators and typed retry -> ASCII-silhouette retry -> part-list compiler. Each step is judged the way the insides prompt was: criteria
fixed beforehand, the same blind shuffled sheet with picks written before the mapping is read, plus automatic counts (failed props, runs with
floating pieces, thin-feature survival, latency). Cost to watch: a retry costs a model round trip (3-6 s); the compiler should make requests
faster, not slower, because the part list is shorter than the math.

# Better builds: eval criteria (fixed 2026-10-28 BEFORE any model run; this file's commit time is the proof)

Set: the 12 props of `live/tools/prompt_eval.py` (6 organic + 6 man-made), 2 runs each = 24 requests per arm, real isolated Haiku through the
server's pool. Arms are cumulative and each step is judged against its predecessor:

| arm | server flags | what it adds |
|---|---|---|
| A | none (plain default: one prompt, no router, no repair) | the current pipeline; `--observe` only measures, never acts |
| B | `--validate` | repair + validators on the sampled master + ONE typed retry (step 2) |
| C | `--validate --ascii` | B, and the retry message also carries three 24x24 ASCII silhouettes (step 3) |
| D | `--validate --ascii --plan-prompt ...` | C, and the model writes a part list that `parts.py` compiles (router picks the example) (step 4) |

## Measures (identical in every arm: computed from the `done.checks` report and the saved 32-cell grids)
- M1 failed requests (error event).
- M2 runs whose delivered volume still has a floating piece (>= 96 master voxels, separate from the main body).
- M3 runs whose delivered volume has any *retry-trigger* problem (floating, short, ground, thin, key_missing; see "Trigger set").
- M4 thin-feature survival: palette keys with >= 3 cells in the 32 grid / palette keys declared (air `_` excluded).
- M5 latency: request sent to `done`, median and p90 (for D this includes the router call).
- M6 blind preference vs the predecessor arm: 24 pairs (same prop, same run number), shuffled left/right with neutral file names, picks
  (L / R / =) written to a picks file BEFORE the mapping file is read. Judge question: which one reads better as the prompted object
  (connected, recognisable silhouette, its named features present, sane proportions)? Style is not a reason.
- M7 retry accounting (B, C, D): requests that retried, and share of those whose delivered volume has no trigger problem.

## Trigger set (tuned on arm A's observed fire rates BEFORE arm B runs, then frozen)
A code that fires in more than a third of A's runs is advisory only: it is named in a retry message but does not trigger one.
Thin-feature threshold: p90 of the shortest same-key run through a voxel < 4 master voxels (1 cell at the 16 level). The spec's 2 cells (8
voxels) flagged 52 of 57 grids from the earlier eval (91%), so every retry would be noise; 4 voxels flags 14 of 57 (25%).

## Pass rules (all must hold; one run's luck must not flip a verdict, hence the tolerances)
- Step 2, B vs A: M1 B <= A+1. M2 B <= A/2 (or <= 1 if A <= 2). M3 B <= 0.6 x A. M4 B >= A - 0.03. M5 median B <= A+4 s and p90 <= A+12 s.
  M6 B wins >= 14 of 24 (a tie counts half) and loses <= 6.
- Step 3, C vs B: M1 C <= B+1. M3 C <= B. M7 C's resolved share >= B's. M5 median C <= B+1.5 s. M6 all 24 pairs: C wins >= 12 and loses
  <= 7; on C's retried runs only: C wins >= C loses.
- Step 4, D vs C: M1 D <= C+1. M2 D <= C. M3 D <= C. M4 D >= C - 0.03. M5 median D <= C (the part list is shorter than math; the router call
  counts). M6 D wins >= 14 of 24 and loses <= 6.
- A step that fails stays on its branch with the numbers; a step that passes is its own commit so a later failure cannot block it.
- Unchanged gates for every step: unit tests green; Stealth gallery SSIM stays 1.000 (`gallery_check_stealth.sh`, and `SET=burnt`).

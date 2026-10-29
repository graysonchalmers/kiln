# Better builds, steps 2 to 4 (2026-10-28/29, branch `lb-validate`, NOT merged)

**Update 2026-10-29: steps 2 and 3 (`--validate`, `--ascii`, `--observe`) were merged to `grayson` on the mechanical numbers (Grayson's call, overriding the step-2 blind bar). Step 4 (`--plan`, `parts.py`, plan prompt) was merged later as an opt-in flag, off by default, after round 2 (fastest arm, blind bar still short).**

Built validators + typed retry, ASCII silhouettes, and the part-list compiler, each behind a flag that is off by default (`ladder.py` untouched).
Judged on the 12 props x 2 runs of `prompt_eval.py`, real isolated Haiku through the server pool, criteria committed first
(`docs/superpowers/specs/2026-10-28-better-builds-eval-criteria.md`, commit 9b228a4). Blind picks were written to `picks.json` before the mapping was read.
Sheets: `.proof/20261028-better-builds-eval/overview/sheet_ABCD_run1.png` (all four arms, run 1) and `blind_AB|BC|CD/sheet1|2.png`. `.proof` is gitignored.

**Base:** the spec and `repair.py` are on `lb-organic` (not on `grayson`, which is also behind `origin/grayson`), so `lb-validate` is cut from `lb-organic`
(= origin/grayson + organic prompt/router/repair, which were held for Grayson's look at the blind sheet). A merge to `grayson` would ship those too.

| | A plain (observe) | B `--validate` | C `--validate --ascii` | D `+ --plan` |
|---|---|---|---|---|
| failed requests of 24 | 0 | 0 | 0 | 0 |
| runs with a floating piece | 8 | 0 | 0 | 0 |
| runs with a retry-trigger problem delivered | 10 | 0 | 0 | 0 |
| palette keys visible at 32 cells | .918 | .921 | .915 | .931 |
| latency median / p90 (s) | 7.0 / 15.0 | 7.7 / 26.7 | 8.1 / 25.7 | 10.2 / 12.3 |
| requests that retried (resolved) | 0 | 5 (5) | 6 (6) | 4 (4; 2 were reply errors, 2 floating) |
| blind vs predecessor (wins/ties/losses, 24 pairs) | | 8 / 7 / 9 vs A | 9 / 9 / 6 vs B | 8 / 9 / 7 vs C |

Verdicts against the pre-set rules:
- **Step 2 (B vs A): FAIL on M6.** All mechanical measures pass (floating 8 -> 0, trigger runs 10 -> 0, latency median +0.7 s, p90 +11.7 s against a limit of 12),
  but the blind pairs came out 11.5 of 24 for B (needed 14, at most 6 losses; B lost 9).
- **Step 3 (C vs B): passes every rule** (blind 13.5 of 24, 6 losses; retried-only pairs 1 vs 1) but depends on step 2, so nothing merges.
- **Step 4 (D vs C): FAIL on M5 and M6.** Median latency 10.2 s vs 8.1 s (rule: not slower) and blind 12.5 of 24 (needed 14). It did cut thin
  features (3 runs flagged vs 11), kept the most palette keys (.931), had no model-code execution and the p90 fell from 25.7 to 12.3 s (no retries of 25 s+).

Read this honestly: M6 compares two independent samples of the model, and only 4 to 6 of 24 requests ever differ because of a retry, so a blind
sheet of this size cannot see a step-2 or step-3 effect (11.5 of 24 is chance). The retry's real effect is mechanical: floating parts gone, ground
contact and height fixed. It was the pre-set rule, so the branch stays unmerged. Options for Grayson: merge B (and C, same cost) on the mechanical
numbers alone; or run a paired test (same first attempt, delivered vs retried) which is the design that can see it.

What was learned along the way:
- The spec's thin rule (2 cells at the 16 level = 8 voxels) flagged 91% of 57 saved grids; 4 voxels (1 cell) is what shipped. Even so, thin fires in 14 of 24
  plain runs and `key_missing` in 8, so both are advisory (named in a retry, never a trigger); triggers are floating (after repair), short, ground.
- Where retries came from: ground (5-6 of 24), floating left by repair (0), short (1). D's compiled parts nearly never had them (floating 2, ground 0).
- ASCII silhouettes (C) did not hurt and the retried runs resolved 6 of 6, but 6 retried pairs cannot separate it from B.
- D's slowness is the router call plus a part list that is not shorter than the math on Haiku (about 10 s a request, flat); its knight run 1 cost 29 s and a
  reply-error retry. Two examples (mailbox, duck) are all the model sees; props that differ from them (bucket, chest, crate) read plainer than C's. Next for
  D: a prompt/example pass, and no router (one prompt with both examples) to take 1-2 s back.
- Gates: unit tests 115 green; Stealth gallery SSIM 1.000000 for both the default set and `SET=burnt`.

Flags: `--validate` (repair + checks + ONE typed retry keeping the better attempt; reports `checks` in `done`), `--ascii`, `--plan` (part list; prompt and the
two examples in `docs/superpowers/specs/*-stage-prompt-plan*.txt`), `--observe` (report only). Tools: `live/tools/run_arm.sh`, `eval_stats.py`, `blind_pairs.py`.
Not touched: the Legion; nested `claude -p` (only the server's isolated Haiku pool ran).

## Paired retry test (2026-10-29, on grayson after PR 17; `live/tools/paired_retry.py`, `blind_triplets.py`)
48 first attempts (12 props x 4 runs, router default, repair on); the 7 with a retry trigger (all 7 were `ground`, 0 floating after repair) were retried from
the SAME first attempt twice: typed (`--validate`) and typed + silhouettes (`--validate --ascii`). Blind triplets shuffled, ranks written before the mapping was read.
- Retry vs first attempt: typed won 7 of 7, ascii won 7 of 7 (zero losses, zero ties). This is the paired design the 24-pair sheet could not be.
- ascii vs typed: 1 win, 2 losses, 4 ties: no visible difference. Validator codes left in the delivered volume: first 17, typed 6, ascii 1 (a thin key).
  Triggers fully resolved: 7/7 both ways. ASCII costs about 0.4 s median and some tokens; keep it flag-only and off by default until it shows a gain.
- Only 7 of 48 first attempts needed a retry (15%), all for no ground contact: the cost is a round trip on about one request in seven.

## Step 4 round 2 (branch `lb-validate`; reworked prompt, new examples, no router; criteria addendum committed first)
Prompt: compact, hollow `_` carve rule, 8 to 16 parts; examples replaced by a stone well and a snowman, both in one prompt; `--plan` no longer calls the router.
C2 = `--validate --ascii --single-prompt` vs D2 = `--validate --ascii --plan`, 12 props x 2, run back to back (Envy load about 4 from another session).
| | C2 | D2 |
|---|---|---|
| failed / floating runs / trigger runs | 0 / 0 / 0 | 0 / 0 / 0 |
| palette keys visible at 32 cells | .951 | .952 |
| latency median / p90 (s) | 15.7 / 25.6 | 6.0 / 9.0 |
| retries | 7 (first attempts: 5 no ground) | 4 (first attempts: 0 ground, 1 floating) |
| blind (24 pairs, picks before mapping) | 8 wins | 7 wins, 9 ties |
Verdict: latency passes by a wide margin (partly load drift: C2 ran slower than the 8.1 s C of round 1, but D2 at 6.0 s is faster than any earlier arm) and every
mechanical measure passes; the blind bar still fails (D2 11.5 of 24, needs 14). D2 wins buckets, crates, potion, slime; C2 wins cactus, chest, lantern, mushroom.
Part lists nearly never forget ground contact (0 of 21 vs 5 of 24). Stays on `lb-validate`; next lever is per-category examples again (chest, lantern) or merging
D2 as an opt-in flag since it is now the fastest arm.

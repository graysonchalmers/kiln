# Organic prompt + router: eval, NOT merged (2026-10-28, branch lb-organic)

Two tuned prompts for the insides work: man-made (the current default) and a new organic one (plants, mushrooms, creatures, characters), picked per
request by `server/prompt_router.py` (keywords when clear, else one Haiku call answering `organic`/`manmade`). Off unless the server gets
`--organic-prompt <file>`; the default path is unchanged.

## Router
- Keywords alone: 100% on the two lists used to tune the word lists, but 31/40 on a fresh list; one stray word was often wrong ("bird house").
- So keywords decide only with a margin of 2+ hits (6-14 of 40 prompts); the rest go to the model.
- The model alone: 39/40 on the fresh list (one stone gargoyle called organic). Latency about 1-2 s warm (the 19 s seen in the test was three parallel
  respawn waits on a busy box).
- In the real eval, the model sent 2 of 12 organic prompts to the man-made prompt (knight with sword and shield; mushroom HOUSE with a door), 12 of 12
  man-made prompts went the right way.

## Eval (6 organic props x 2 runs, current prompt vs organic via router; criteria fixed beforehand)
1. Failed props not above current: 0/12 vs 2/12. PASS (one of the current's two was a load timeout).
2. Blind preference (shuffled, picks written before the mapping was read) at least 4 of 6, worse on at most 1: 5 of 6. PASS (cactus went to current).
3. More `structural` tags: 8 of 12 runs vs 0 of 10. PASS.
4. No more over-hollowed bodies than current: 3 runs (slime x2, mushroom 2, which the router sent to the man-made prompt) vs 0. FAIL.
Man-made group through the router: 12/12 routed right, 12/12 built (current: 11/12).

Result: not merged. Next: fix the router's head-noun problem (classify by the main subject, not its parts), tell the organic prompt that a crown or hat
on a creature is not a cavity, and re-run with fresh criteria.

## Round 2 (router head-noun fix, crown rule, repair; criteria fixed beforehand; repair OFF in the eval)
- Router: the subject (text before "with / in / holding / :" ...) is classified, not the whole prompt; ties go to one cheap model call on the subject.
  Model answers were identical on 4 repeats: 44/48, the 4 misses all being "mushroom house", which it reads as a house (man-made). That prop is
  genuinely ambiguous, so it was excluded from the criteria (declared before the rerun); it now goes to the man-made prompt.
- Organic prompt: a crown, hat, helmet, horns, hair, scales or armour is a solid piece, never a cavity.
- Criteria on the 5 props the router sends to the organic prompt (10 runs): 1 failed props 0/12 vs 2/12 PASS; 2 blind preference 5 of 5 PASS (picks written
  before the mapping was read); 3 structural tags 8/10 runs vs 0 PASS; 4 hollow bodies 0 vs 0 PASS; 5 routing 44/44 on the 11 unambiguous prompts PASS;
  6 runs with a floating piece 3 of 10 vs 1 of 9 (limit: current + 1) FAIL.
- With `--repair` the floating pieces are 0 of 9 and 0 of 10 (8 cells lost). Not merged: waiting for Grayson to look at the blind sheet
  (`.proof/20261028-organic-eval2/blind_sheet2.png`) and decide between merging with repair on by default or leaving it.
- New: `server/repair.py` (+ `--repair`), `docs/superpowers/specs/2026-10-28-better-builds-design.md` (the systemic plan).

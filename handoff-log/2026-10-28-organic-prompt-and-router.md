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

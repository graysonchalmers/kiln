import pathlib

PORT = 8795  # long-lived service port; tests use --port 0 (see _agent-commons/reference/ports.md)
PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt.txt"
ORGANIC_PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt-organic.txt"
ROUTER_PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-router-prompt.txt"
REPAIR = False  # --repair: pull parts that float beside the body back to it before the levels are pooled (server/repair.py)
VALIDATE = False  # --validate: repair, check the sampled master, and retry ONCE with the problems named (server/validate.py)
OBSERVE = False   # --observe: run the same checks and report them in `done`, but change nothing (the baseline arm of an eval)
ASCII = False     # --ascii: the validate retry also carries three 24x24 text silhouettes of the model's own result
TRIGGER_CODES = ("floating", "short", "ground")  # problems that start the retry; thin and key_missing fire in over a third of plain runs, so they are named in a retry message but never start one (eval criteria file)
PLAN = False      # --plan-prompt: the model writes a part list that parts.py compiles (f(u,v,w) stays as the escape hatch)
PLAN_PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt-plan.txt"
PLAN_EXAMPLES = {k: PLAN_PROMPT_PATH.with_name(f"2026-10-28-live-blockout-stage-prompt-plan-example-{k}.txt") for k in ("manmade", "organic")}

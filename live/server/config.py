import pathlib

PORT = 8795  # long-lived service port; tests use --port 0 (see _agent-commons/reference/ports.md)
PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt.txt"
ORGANIC_PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt-organic.txt"
ROUTER_PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-router-prompt.txt"
REPAIR = True  # on by default; --no-repair turns it off: parts that float beside the body slide back to it before the levels are pooled (server/repair.py)

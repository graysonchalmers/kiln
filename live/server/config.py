import pathlib

PORT = 8795  # long-lived service port; tests use --port 0 (see _agent-commons/reference/ports.md)
PROMPT_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs/superpowers/specs/2026-10-28-live-blockout-stage-prompt.txt"

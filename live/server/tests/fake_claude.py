"""Stand-in for `claude -p --input-format stream-json`: one result per user line."""
import json
import sys
import time

CHUNKS = ["pal({r:\"#a00\"})\n", "model(\"a\", voxfn([2,2,2], (x,y,z)=>\"r\", {size:0.1}))\n",
          "//---STAGE---\n", "pal({r:\"#a00\"})\n", "model(\"a\", voxfn([4,4,4], (x,y,z)=>\"r\", {size:0.05}))\n"]
DELAY = 0.05


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    msg = json.loads(line)
    text = msg["message"]["content"]
    if not text.startswith("warm-up"):
        for c in CHUNKS:
            time.sleep(DELAY)
            emit({"type": "stream_event", "event": {"type": "content_block_delta",
                  "delta": {"type": "text_delta", "text": c}}})
    emit({"type": "result", "total_cost_usd": 0.0001, "modelUsage": {"claude-haiku-5-5": {}}})

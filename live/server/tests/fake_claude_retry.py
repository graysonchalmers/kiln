"""Stand-in for `claude -p` whose first answer to a request fails (the function throws); once the request carries
'A previous attempt failed' it answers with a working shape. Like the real process, it only handles what it is sent."""
import json
import sys

BAD = 'pal({s:"#aa5522"})\nfunction f(u,v,w){throw new Error("boom")}\n'
GOOD = 'pal({s:"#aa5522"})\nfunction f(u,v,w){return Math.hypot(u-.5,v-.5,w-.5)<.5?"s":null}\n'


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    text = json.loads(line)["message"]["content"]
    if not text.startswith("warm-up"):
        reply = GOOD if "A previous attempt failed" in text else BAD
        for i in range(0, len(reply), 40):
            emit({"type": "stream_event", "event": {"type": "content_block_delta",
                  "delta": {"type": "text_delta", "text": reply[i:i + 40]}}})
    emit({"type": "result", "total_cost_usd": 0.0001, "modelUsage": {"claude-haiku-5-5": {}}})

"""Split a streamed model reply into complete kiln scripts."""
import re

DELIM = "//---STAGE---"
_CODE_START = re.compile(r"^\s*(pal|model|pack|const|let|var|function|//)")


def clean_script(text: str) -> str:
    lines = [l for l in text.splitlines() if not l.strip().startswith("```")]
    start = next((i for i, l in enumerate(lines) if _CODE_START.match(l)), None)
    if start is None:
        return ""
    end = max((i for i, l in enumerate(lines) if ")" in l), default=start)
    return "\n".join(lines[start:end + 1]).strip()


def _balanced(script: str) -> bool:
    depth, quote, esc = 0, None, False
    for ch in script:
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
        elif ch in "\"'`":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
    return depth == 0 and quote is None and "model(" in script


class StageSplitter:
    def __init__(self):
        self._buf = ""

    def feed(self, chunk: str) -> list[str]:
        self._buf += chunk
        out = []
        while True:
            m = re.search(r"^[ \t]*" + re.escape(DELIM) + r"[ \t]*\r?\n", self._buf, re.M)
            if not m:
                break
            piece, self._buf = self._buf[:m.start()], self._buf[m.end():]
            s = clean_script(piece)
            if s:
                out.append(s)
        return out

    def finish(self) -> list[str]:
        s = clean_script(self._buf)
        self._buf = ""
        return [s] if s and _balanced(s) else []

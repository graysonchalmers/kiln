#!/usr/bin/env python3
"""Streamed progressive kiln-script driver. usage: driver.py slug "prompt" sysfile outdir [tag]"""
import json, subprocess, sys, time, os, re, threading
KILN = os.path.expanduser("~/Projects-local/Tool-Blockout3D/bin/kiln.js")
HAIKU = "claude-haiku-5-5"
def strip(t): return "\n".join(l for l in t.split("\n") if not l.strip().startswith("```"))
def balanced_done(t):
    """True when t contains a model( call whose parens are balanced (string-aware)."""
    i = t.find("model(")
    if i < 0: return False
    d = 0; q = None; esc = False
    for ch in t[i:]:
        if q:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == q: q = None
            continue
        if ch in "\"'`": q = ch
        elif ch == "(": d += 1
        elif ch == ")":
            d -= 1
            if d == 0: return True
    return False
def kiln_build(path, out, preview=False):
    a = ["node", KILN, "build", path, "--out", out] + ([] if preview else ["--no-preview"])
    r = subprocess.run(a, capture_output=True, text=True)
    m = re.search(r"(\d+) tris", r.stdout)
    return r.returncode == 0 and bool(m), int(m.group(1)) if m else None, (r.stderr + r.stdout).strip()[-400:]
def claude(user, sysfile, on_text, model=HAIKU):
    cmd = ["claude","-p","--setting-sources","","--strict-mcp-config","--disable-slash-commands","--tools","",
           "--model",model,"--system-prompt",open(sysfile).read(),"--output-format","stream-json",
           "--include-partial-messages","--verbose", user]
    t0 = time.time()
    p = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    first = None; res = None
    for line in p.stdout:
        try: ev = json.loads(line)
        except: continue
        if ev.get("type") == "stream_event":
            e = ev["event"]
            if e.get("type") == "content_block_delta" and e["delta"].get("type") == "text_delta":
                now = time.time() - t0
                if first is None: first = now
                on_text(e["delta"]["text"], now)
        elif ev.get("type") == "result": res = ev
    p.wait()
    return t0, first, time.time() - t0, res
def run(slug, prompt, sysfile, outdir, tag="a"):
    os.makedirs(outdir, exist_ok=True)
    stages = []   # dicts
    state = {"buf": "", "n": 0}
    threads = []
    def finish_stage(text, now, delim):
        state["n"] += 1; n = state["n"]
        text = strip(text).strip()
        f = f"{outdir}/{slug}_{tag}_s{n}.kx.js"; open(f, "w").write(text + "\n")
        st = {"n": n, "t_complete": now, "file": f}
        stages.append(st)
        def b():
            ok, tris, msg = kiln_build(f, f"{outdir}/o_{slug}_{tag}_s{n}")
            st["t_glb"] = time.time() - T0; st["ok"] = ok; st["tris"] = tris; st["err"] = None if ok else msg
        th = threading.Thread(target=b); th.start(); threads.append(th)
    def on_text(d, now):
        state["buf"] += d
        while True:
            buf = state["buf"]
            if "//---STAGE---" in buf:
                a, b = buf.split("//---STAGE---", 1)
                if balanced_done(strip(a)) or a.strip():
                    finish_stage(a, now, True)
                state["buf"] = b; state["pending"] = False
                continue
            # balanced paren early-completion (before delimiter arrives)
            if balanced_done(strip(buf)) and not state.get("early_cut"):
                # complete stage; keep remainder (delimiter) in buffer after cutting at end of model(
                j = buf.find("model("); dd = 0; q = None; esc = False; end = None
                for k in range(j, len(buf)):
                    ch = buf[k]
                    if q:
                        if esc: esc = False
                        elif ch == "\\": esc = True
                        elif ch == q: q = None
                        continue
                    if ch in "\"'`": q = ch
                    elif ch == "(": dd += 1
                    elif ch == ")":
                        dd -= 1
                        if dd == 0: end = k + 1; break
                if end:
                    finish_stage(buf[:end], now, False)
                    state["buf"] = buf[end:]
                    continue
            break
    T0 = time.time()
    t0, first, total, res = claude(f'Model name "{slug}". Prop: {prompt}', sysfile, on_text)
    T0 = t0
    if strip(state["buf"]).strip() and "model(" in state["buf"] and balanced_done(strip(state["buf"])):
        finish_stage(state["buf"], total, False)
    for th in threads: th.join()
    stages.sort(key=lambda s: s["n"])
    retries = 0
    # validate-then-retry: failed stage -> ask once with the error; fallback to previous good stage
    for s in stages:
        if not s["ok"]:
            retries += 1
            prev = open(s["file"]).read()
            tr = time.time()
            buf = []
            _, _, tot2, res2 = claude(f"This kiln script failed.\nERROR:\n{s['err']}\nSCRIPT:\n{prev}\nOutput ONLY the fixed single script (one pal + model), no fences.",
                                      sysfile.replace("sys_", "sys_fix_") if os.path.exists(sysfile.replace("sys_", "sys_fix_")) else sysfile,
                                      lambda d, n: buf.append(d))
            txt = strip("".join(buf)).split("//---STAGE---")[0].strip()
            fx = s["file"].replace(".kx.js", "_fix.kx.js"); open(fx, "w").write(txt + "\n")
            ok, tris, msg = kiln_build(fx, f"{outdir}/o_{slug}_{tag}_s{s['n']}fix")
            s["retry"] = {"ok": ok, "tris": tris, "retry_secs": time.time() - tr, "t_glb_abs": s["t_glb"] + (time.time() - tr), "file": fx}
    # previews of first and last good stage
    good = [s for s in stages if s["ok"] or s.get("retry", {}).get("ok")]
    for s in (good[:1] + good[-1:]):
        f = s["file"] if s["ok"] else s["retry"]["file"]
        kiln_build(f, f"{outdir}/p_{slug}_{tag}_s{s['n']}", preview=True)
        s["preview"] = f"{outdir}/p_{slug}_{tag}_s{s['n']}/_preview/"
    out = {"slug": slug, "t_first_token": first, "t_total": total, "retries": retries, "stages": stages,
           "usage": (res or {}).get("modelUsage"), "cost": (res or {}).get("total_cost_usd")}
    json.dump(out, open(f"{outdir}/{slug}_{tag}.json", "w"), indent=1)
    return out
if __name__ == "__main__":
    o = run(*sys.argv[1:6]) if len(sys.argv) > 5 else run(*sys.argv[1:5])
    print(f"{o['slug']}: first_token={o['t_first_token']:.2f} total={o['t_total']:.2f} retries={o['retries']} cost={o['cost']} models={list((o['usage'] or {}).keys())}")
    for s in o["stages"]:
        print(f"  s{s['n']}: complete={s['t_complete']:.2f} glb={s['t_glb']:.2f} tris={s['tris']} ok={s['ok']} retry={s.get('retry',{}).get('ok')} {'' if s['ok'] else s['err'][:150]}")

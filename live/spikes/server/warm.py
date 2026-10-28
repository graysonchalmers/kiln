import json, subprocess, time, sys, os, threading
HAIKU="claude-haiku-5-5"
def cmd(sysfile):
    return ["claude","-p","--setting-sources","","--strict-mcp-config","--disable-slash-commands","--tools","",
      "--model",HAIKU,"--system-prompt",open(sysfile).read(),"--input-format","stream-json",
      "--output-format","stream-json","--include-partial-messages","--verbose"]
class Warm:
    def __init__(self, sysfile):
        self.t_spawn=time.time()
        self.p=subprocess.Popen(cmd(sysfile),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
        self.models=set(); self.cost=0.0; self.turns=0
    def send(self, text, on_text=lambda d,n:None):
        t0=time.time()
        self.p.stdin.write(json.dumps({"type":"user","message":{"role":"user","content":text}})+"\n"); self.p.stdin.flush()
        first=None; res=None
        for line in self.p.stdout:
            try: ev=json.loads(line)
            except: continue
            if ev.get("type")=="stream_event":
                e=ev["event"]
                if e.get("type")=="content_block_delta" and e["delta"].get("type")=="text_delta":
                    now=time.time()-t0
                    if first is None: first=now
                    on_text(e["delta"]["text"],now)
            elif ev.get("type")=="result": res=ev; break
        self.turns+=1
        if res:
            self.models|=set((res.get("modelUsage") or {}).keys()); self.cost=res.get("total_cost_usd",self.cost)
        return t0,first,time.time()-t0,res
    def close(self):
        try: self.p.stdin.close(); self.p.wait(timeout=5)
        except Exception: self.p.kill()

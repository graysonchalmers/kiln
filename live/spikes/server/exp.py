import sys,json,time,threading,statistics as S
sys.path.insert(0,"../spikeA2")
import driver
from warm import Warm
SYS="../spikeA2/sys_stage.txt"
PROPS=[("vend","rusty vending machine"),("barrel","wooden barrel"),("lamp","street lamp"),("chest","treasure chest"),("mailbox","mailbox")]
_orig_build=driver.kiln_build
driver.kiln_build=lambda p,o,preview=False:(True,None,"") if preview else _orig_build(p,o,preview)
CUR={}
def fake_claude(user,sysfile,on_text,model=None):
    w=CUR["w"]; r=w.send(user,on_text); return r
driver.claude=fake_claude
def one(w,slug,prompt,outdir,tag):
    CUR["w"]=w
    o=driver.run(slug,prompt,SYS,outdir,tag)
    s=o["stages"]; s1=s[0] if s else {}
    return dict(slug=slug,tag=tag,first=o["t_first_token"],s1_complete=s1.get("t_complete"),s1_glb=s1.get("t_glb"),s1_tris=s1.get("tris"),
      total=o["t_total"],nst=len(s),tris=[x["tris"] for x in s],ok=[x["ok"] for x in s],retries=o["retries"])
def show(r): print(json.dumps({k:(round(v,2) if isinstance(v,float) else v) for k,v in r.items()}),flush=True)
mode=sys.argv[1]; out=f"out_{mode}"; res=[]
if mode=="warm":
    w=Warm(SYS); t=w.send("Reply with just: ok"); print("warmup",t[1],t[2],flush=True)
    for rnd in (1,2):
        for slug,pr in PROPS:
            r=one(w,slug,pr,out,f"r{rnd}"); r["turn"]=w.turns; res.append(r); show(r)
    print("models",w.models,"cost",w.cost); w.close()
elif mode=="pool":
    pool=[];lock=threading.Lock()
    def mk():
        w=Warm(SYS); w.send("Reply with just: ok"); return w
    pool=[mk(),mk()]; models=set(); cost=0
    for rnd in (1,2):
        for slug,pr in PROPS:
            w=pool.pop(0)
            th=[None]
            def repl(): pool.append(mk())
            t=threading.Thread(target=repl); t.start()
            r=one(w,slug,pr,out,f"r{rnd}"); models|=w.models; cost+=w.cost; w.close()
            t.join(); res.append(r); show(r)
    print("models",models,"cost",cost)
    for w in pool: w.close()
json.dump(res,open(f"res_{mode}.json","w"))
f=[r["s1_glb"] for r in res if r["s1_glb"]]; fi=[r["first"] for r in res]
print("n",len(res),"first_med",S.median(fi),"s1glb_med",S.median(f),"<3:",sum(x<3 for x in f),"<5:",sum(x<5 for x in f),"of",len(res))

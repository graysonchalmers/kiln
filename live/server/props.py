"""A wider set of props for regression and smoke tests: hand-written shape functions in the format the model produces.

`size` is the box in metres (w, h, d). `must_keep` lists materials that must survive at 8 cells and finer (thin or detail
parts the prop is known for). Some props exist to test the pipeline itself: hollow_box (sealed, must be filled solid),
cup (open, must stay open), table and lamp (thin parts), stairs (hard edges), sphere and block (plain volumes).
"""

PROPS = {
    "barrel": {
        "size": (0.7, 0.9, 0.7), "must_keep": ["h", "t"],
        "pal": 'pal({w:"#9c6a4d",h:"#3a3a3a",t:"#c9a37a"})',
        "f": ('function f(u,v,w){const x=u-.5,z=w-.5,r=Math.hypot(x,z),bulge=.4+.1*Math.sin(Math.PI*v)\n'
              'if(r>bulge)return null\nif(v>.94||v<.03)return "t"\n'
              'if(Math.abs(v-.2)<.04||Math.abs(v-.8)<.04)return "h"\nreturn "w"}')},
    "mailbox": {
        "size": (0.5, 1.2, 0.4), "must_keep": ["r"],
        "pal": 'pal({b:"#3a5fa8",p:"#6b4a2f",r:"#c0392b"})',
        "f": ('function f(u,v,w){const x=u-.5,z=w-.5\n'
              'if(Math.abs(x)<.06&&Math.abs(z)<.06&&v<.5)return "p"\n'
              'if(v>.5&&v<.55&&u<.3&&Math.abs(z)<.04)return "r"\n'
              'if(v>.5&&Math.hypot(x,(v-.72)*1.0)<.28&&Math.abs(z)<.3)return "b"\nreturn null}')},
    "lamp": {
        "size": (1.0, 3.5, 0.5), "must_keep": ["p", "l"],
        "pal": 'pal({k:"#222222",p:"#3a3a3a",l:{color:"#ffe9a8",emit:"#ffd28a",glow:3}})',
        "f": ('function f(u,v,w){const x=u-.5,z=w-.5\n'
              'if(v<.05&&Math.hypot(x,z)<.2)return "k"\n'
              'if(Math.hypot(x,z)<.035&&v<.92)return "p"\n'
              'if(v>.9&&v<.97&&Math.abs(z)<.05&&u>.5&&u<.9)return "p"\n'
              'if(v>.8&&v<.9&&Math.abs(z)<.12&&u>.78&&u<.98)return "l"\nreturn null}')},
    "chest": {
        "size": (0.9, 0.6, 0.55), "must_keep": ["g", "i"],
        "pal": 'pal({w:"#7a4a26",y:"#8a5530",i:"#555555",g:"#d9b44a"})',
        "f": ('function f(u,v,w){const x=u-.5,z=w-.5\nif(Math.abs(x)>.49||Math.abs(z)>.49)return null\n'
              'if(v<.55){if(z>.44&&Math.abs(x)<.06&&v>.3&&v<.5)return "g";if(Math.abs(x)>.4)return "i";return "w"}\n'
              'if(Math.hypot(z,(v-.55)*1.6)<.46){if(Math.abs(x)>.4)return "i";return "y"}\nreturn null}')},
    "vending": {
        "size": (1.0, 2.0, 0.8), "must_keep": ["g", "y"],
        "pal": 'pal({r:"#a8432f",k:"#2b2b2b",g:{color:"#8fd3ff",rough:.1},y:"#d9b44a"})',
        "f": ('function f(u,v,w){if(u<.05||u>.95||w<.05||w>.95||v>.98)return null\nif(v<.04)return "k"\n'
              'if(w>.9&&u>.12&&u<.72&&v>.35&&v<.88)return "g"\n'
              'if(w>.9&&u>.78&&u<.9&&((v>.55&&v<.62)||(v>.4&&v<.5)))return "y"\n'
              'if(w>.9&&u>.2&&u<.8&&v>.08&&v<.16)return "k"\nreturn "r"}')},
    "sphere": {
        "size": (1.0, 1.0, 1.0), "must_keep": [],
        "pal": 'pal({s:"#4a90c0"})',
        "f": 'function f(u,v,w){return Math.hypot(u-.5,v-.5,w-.5)<.5?"s":null}'},
    "block": {
        "size": (1.0, 1.0, 1.0), "must_keep": [],
        "pal": 'pal({c:"#b0b0b0"})',
        "f": 'function f(u,v,w){return "c"}'},
    "hollow_box": {
        "size": (1.0, 1.0, 1.0), "must_keep": [],
        "pal": 'pal({s:"#8a6a3a"})',
        "f": ('function f(u,v,w){if(u<.1||u>.9||v<.1||v>.9||w<.1||w>.9)return null;'
              'const e=Math.min(u-.1,.9-u,v-.1,.9-v,w-.1,.9-w);return e<.1?"s":null}')},
    "cup": {
        "size": (0.6, 0.8, 0.6), "must_keep": [],
        "pal": 'pal({s:"#c0c0c8"})',
        "f": ('function f(u,v,w){if(u<.1||u>.9||w<.1||w>.9||v<.1||v>.9)return null;'
              'return (u<.2||u>.8||w<.2||w>.8||v<.2)?"s":null}')},
    "arch": {
        "size": (1.2, 1.2, 0.4), "must_keep": [],
        "pal": 'pal({s:"#9a9a8a"})',
        "f": ('function f(u,v,w){const x=u-.5\nif(Math.abs(w-.5)>.4)return null\n'
              'if(v<.5)return (Math.abs(x)>.3&&Math.abs(x)<.5)?"s":null\n'
              'const r=Math.hypot(x,v-.5);return (r<.5&&r>.3)?"s":null}')},
    "mushroom": {
        "size": (0.8, 0.8, 0.8), "must_keep": ["m"],
        "pal": 'pal({t:"#e8dcc2",c:"#c0392b",m:"#fff5e0"})',
        "f": ('function f(u,v,w){const x=u-.5,z=w-.5,r=Math.hypot(x,z)\n'
              'if(v<.5&&r<.12+.03*(1-v))return "t"\n'
              'if(v>=.45&&v<.95&&Math.hypot(r,(v-.5)*1.3)<.5){if(v>.7&&Math.sin(u*25)*Math.sin(w*25)>.8)return "m";return "c"}\nreturn null}')},
    "table": {
        "size": (1.2, 0.8, 0.8), "must_keep": ["l", "t"],
        "pal": 'pal({t:"#8a5a30",l:"#5a3a1a"})',
        "f": ('function f(u,v,w){if(v>.85&&v<.95)return "t"\n'
              'if(v<.85&&(u<.1||u>.9)&&(w<.1||w>.9))return "l"\nreturn null}')},
    "stairs": {
        "size": (1.5, 1.0, 1.0), "must_keep": ["a"],
        "pal": 'pal({s:"#9a9a9a",a:"#6a6a7a"})',
        "f": 'function f(u,v,w){const k=Math.floor(u*5);return v<(k+1)/5?((k%2)?"a":"s"):null}'},
}


# Palette keys that hold the prop together (they survive fire). Used for the burnt gallery set only; the regression gallery keeps its tags.
STRUCTURAL = {"barrel": ["h"], "mailbox": ["p"], "lamp": ["p", "k"], "chest": ["i"], "vending": ["k"], "table": ["l"]}

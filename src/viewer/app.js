// kiln live viewer. Views are rendered by the server's rasterizer, the same one the agent reads.
const $ = (id) => document.getElementById(id);
let state, sel = localStorage.getItem("kiln.sel") || undefined, yaw = 35, pitch = 25, step = -1, timer, pending = false, queued = false;

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
const info = () => state?.models.find((m) => m.name === sel);

function draw() {
  const m = info();
  if (!m || m.error) return;
  if (pending) { queued = true; return; }
  pending = true;
  const stage = $("stage"), mk = annotating && marks(false);
  const size = mk ? mk.view.w : Math.min(stage.clientWidth, stage.clientHeight, 1100);
  const s = step < 0 ? m.steps.length - 1 : step;
  const img = new Image();
  img.onload = () => { $("view").src = img.src; pending = false; drawMarks(); if (queued) { queued = false; draw(); } };
  img.onerror = () => { pending = false; };
  img.src = `/api/view?name=${encodeURIComponent(sel)}&yaw=${yaw.toFixed(1)}&pitch=${pitch.toFixed(1)}&step=${s}&w=${size}&h=${size}&v=${state.version}`;
}

function show() {
  const m = info();
  $("err").style.display = m?.error || state?.error ? "block" : "none";
  $("err").textContent = (state?.error ?? m?.error)?.message ?? "";
  if (!m || m.error) return;
  const last = m.steps.length - 1;
  if (step > last) step = -1;
  $("slider").max = String(last);
  $("slider").value = String(step < 0 ? last : step);
  $("count").textContent = `${(step < 0 ? last : step) + 1}/${last + 1}`;
  $("info").textContent = `${m.name} · ${m.dims} (w×h×d) · ${m.tris} tris`;
  $("dl").href = `/api/glb?name=${encodeURIComponent(m.name)}`;
  $("steps").innerHTML = "";
  m.steps.forEach((s, i) => {
    const li = document.createElement("li");
    li.className = i === (step < 0 ? last : step) ? "cur" : "";
    li.innerHTML = `<span class="i">${i}</span><span>${esc(s.label)}</span>`;
    li.title = s.loc ?? "";
    li.onclick = () => { stopPlay(); step = i === last ? -1 : i; show(); };
    $("steps").appendChild(li);
  });
  draw();
}

function renderList() {
  const box = $("list");
  box.innerHTML = "";
  if (!state) return;
  for (const [title, pred] of [["models", (m) => !m.part], ["parts", (m) => m.part]]) {
    const items = state.models.filter(pred);
    if (!items.length) continue;
    const h = document.createElement("div");
    h.className = "sect";
    h.textContent = title;
    box.appendChild(h);
    for (const m of items) {
      const row = document.createElement("div");
      row.className = "row" + (m.name === sel ? " sel" : "");
      row.innerHTML = (m.error ? `<img alt="">` : `<img src="/api/view?name=${encodeURIComponent(m.name)}&w=80&h=80&v=${state.version}">`) +
        `<span class="nm">${esc(m.name)}</span>` + (m.error ? `<span class="dot err"></span>` : m.changed && state.version > 1 ? `<span class="dot new"></span>` : "");
      row.onclick = () => { sel = m.name; localStorage.setItem("kiln.sel", sel); step = -1; renderList(); if (annotating) enterAnnotate(); show(); };
      box.appendChild(row);
    }
  }
}

function stopPlay() { clearInterval(timer); timer = undefined; $("play").textContent = "▶ steps"; }
$("play").onclick = () => {
  const m = info();
  if (!m) return;
  if (timer) return stopPlay();
  step = 0; show();
  $("play").textContent = "■ stop";
  timer = setInterval(() => { if (step >= m.steps.length - 1 || step < 0) { step = -1; show(); return stopPlay(); } step++; show(); }, 450);
};
$("slider").oninput = () => { stopPlay(); const v = Number($("slider").value); step = v === info()?.steps.length - 1 ? -1 : v; show(); };

let drag;
$("stage").onpointerdown = (e) => { if (annotating) return; drag = { x: e.clientX, y: e.clientY, yaw, pitch }; $("stage").setPointerCapture(e.pointerId); };
$("stage").onpointermove = (e) => {
  if (!drag) return;
  yaw = drag.yaw - (e.clientX - drag.x) * 0.5;
  pitch = Math.max(-5, Math.min(89, drag.pitch + (e.clientY - drag.y) * 0.4));
  draw();
};
$("stage").onpointerup = () => { drag = undefined; };
setInterval(() => { if ($("spin").checked && !drag && !annotating) { yaw -= 4; draw(); } }, 80);
addEventListener("resize", () => { draw(); drawMarks(); });
addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA") return;
  if (e.key === "a") setAnnotate(!annotating);
  if (annotating && "nbe".includes(e.key)) { tool = e.key === "n" ? "pin" : e.key === "b" ? "pen" : "erase"; renderAnnot(); }
});

const es = new EventSource("/events");
es.addEventListener("build", (e) => {
  const prev = state;
  state = JSON.parse(e.data);
  $("file").textContent = `${state.file}  v${state.version}  ${state.ms}ms`;
  const bad = state.error ? 1 : state.models.filter((m) => m.error).length + state.errors.length;
  $("status").textContent = bad ? `${bad} error${bad > 1 ? "s" : ""}` : "ok";
  $("status").className = "pill " + (bad ? "bad" : "ok");
  if (!sel || !state.models.some((m) => m.name === sel)) sel = state.models.find((m) => !m.part)?.name ?? state.models[0]?.name;
  const changed = prev && state.models.find((m) => m.changed && !m.part && !m.error);
  if (changed) { sel = changed.name; step = -1; }
  renderList();
  show();
});
es.onerror = () => { $("status").textContent = "disconnected"; $("status").className = "pill bad"; };

// ---------------------------------------------------------------- annotate: feedback for Claude
// Pins and strokes are drawn in the pixels of one frozen view (yaw, pitch, size); the server picks
// them onto the model's surface. Kept per model in localStorage until cleared.
const COLORS = ["#ff3df0", "#2ee6ff", "#ffe14a", "#ffffff"];
const ann = $("ann"), g = ann.getContext("2d"), view = $("view");
let annotating = false, tool = "pin", color = COLORS[0], stroke;

const mkey = () => "kiln.marks." + sel;
function marks(create) {
  let m; try { m = JSON.parse(localStorage.getItem(mkey()) || "null"); } catch {}
  if (!m && create) m = { view: currentView(), pins: [], strokes: [], comment: "" };
  return m || undefined;
}
const save = (m) => { try { localStorage.setItem(mkey(), JSON.stringify(m)); } catch {} };
function currentView() {
  const st = $("stage");
  const size = Math.round(Math.min(st.clientWidth, st.clientHeight, 1100));
  return { yaw, pitch, w: size, h: size };
}

/** The view image's rect inside the stage, and view pixels per CSS pixel. */
function rect() {
  const r = view.getBoundingClientRect(), s = $("stage").getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, k: (view.naturalWidth || r.width) / (r.width || 1) };
}
const toView = (e) => { const r = view.getBoundingClientRect(), k = rect().k; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };

function paint(c, m, s) {
  for (const st of m.strokes) {
    c.strokeStyle = st.color; c.lineWidth = 3; c.lineCap = c.lineJoin = "round"; c.globalAlpha = 0.9;
    c.beginPath(); st.points.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, x * s, y * s)); c.stroke();
  }
  c.globalAlpha = 1; c.font = "700 12px ui-monospace, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
  m.pins.forEach((p, i) => {
    const x = p.x * s, y = p.y * s;
    c.fillStyle = p.color; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill();
    c.strokeStyle = "#15131c"; c.lineWidth = 1; c.stroke();
    c.fillStyle = "#ffb454"; c.beginPath(); c.arc(x + 12, y - 12, 9, 0, 7); c.fill();
    c.fillStyle = "#15131c"; c.fillText(String(i + 1), x + 12, y - 11);
  });
  c.textAlign = "start"; c.textBaseline = "alphabetic";
}

function drawMarks() {
  const r = rect(), dpr = devicePixelRatio || 1;
  Object.assign(ann.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
  if (ann.width !== Math.round(r.w * dpr) || ann.height !== Math.round(r.h * dpr)) { ann.width = Math.round(r.w * dpr); ann.height = Math.round(r.h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.w, r.h);
  const m = annotating && marks(false);
  if (m) paint(g, m, 1 / r.k);
}

/** Entering annotate on a model: snap back to the view its marks were drawn on, or start fresh here. */
function enterAnnotate() {
  const m = marks(false);
  if (m && (Math.abs(m.view.yaw - yaw) > 0.5 || Math.abs(m.view.pitch - pitch) > 0.5)) {
    if (confirm(`${sel} has marks drawn from another angle. OK: go back to that view. Cancel: clear them and annotate this view.`)) { yaw = m.view.yaw; pitch = m.view.pitch; }
    else localStorage.removeItem(mkey());
  }
}

function setAnnotate(on) {
  annotating = on;
  document.body.classList.toggle("annotating", on);
  $("annotbtn").classList.toggle("on", on);
  $("hint").textContent = on ? "annotating: camera frozen" : "drag to orbit";
  if (on) { stopPlay(); $("spin").checked = false; step = -1; enterAnnotate(); show(); }
  renderAnnot(); draw(); drawMarks();
}

function renderAnnot() {
  for (const t of ["pin", "pen", "erase"]) $("t-" + t).classList.toggle("on", tool === t);
  $("colors").innerHTML = "";
  for (const c of COLORS) {
    const b = document.createElement("button");
    b.className = "chip" + (c === color ? " on" : ""); b.style.background = c;
    b.onclick = () => { color = c; renderAnnot(); };
    $("colors").appendChild(b);
  }
  const m = marks(false);
  $("pins").innerHTML = "";
  m?.pins.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${i + 1}</b><span>${esc(p.text)}</span><a title="remove">×</a>`;
    li.lastChild.onclick = () => { m.pins.splice(i, 1); save(m); renderAnnot(); drawMarks(); };
    $("pins").appendChild(li);
  });
  $("comment").value = m?.comment ?? "";
}

ann.addEventListener("pointerdown", (e) => {
  if (!annotating) return;
  const p = toView(e), m = marks(true);
  if (tool === "erase") {
    const tol = 10 * rect().k;
    let i = m.pins.findIndex((q) => Math.hypot(q.x - p[0], q.y - p[1]) < tol);
    if (i >= 0) m.pins.splice(i, 1);
    else if ((i = m.strokes.findIndex((s) => s.points.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < tol))) >= 0) m.strokes.splice(i, 1);
    save(m); renderAnnot(); drawMarks(); return;
  }
  if (tool === "pin") {
    const text = prompt("Note for Claude about this spot:");
    if (text && text.trim()) { m.pins.push({ x: p[0], y: p[1], text: text.trim(), color }); save(m); renderAnnot(); drawMarks(); }
    return;
  }
  stroke = { color, points: [p] }; m.strokes.push(stroke); save(m);
  ann.setPointerCapture(e.pointerId);
});
ann.addEventListener("pointermove", (e) => {
  if (!stroke) return;
  const p = toView(e), q = stroke.points[stroke.points.length - 1];
  if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 3) {
    stroke.points.push(p);
    const m = marks(false); m.strokes[m.strokes.length - 1] = stroke; save(m); drawMarks();
  }
});
ann.addEventListener("pointerup", () => { stroke = undefined; });

async function sendFeedback() {
  const m = marks(false), st = $("fbstatus");
  if (!m) { st.textContent = "nothing to send yet"; return; }
  const cv = document.createElement("canvas"); cv.width = view.naturalWidth; cv.height = view.naturalHeight;
  const c = cv.getContext("2d"); c.drawImage(view, 0, 0); paint(c, m, 1);
  st.textContent = "sending…";
  const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: sel, view: m.view, pins: m.pins, strokes: m.strokes, comment: m.comment, annotated: cv.toDataURL("image/png") }) });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  st.textContent = r.ok ? `sent ✓ ${j.summary} — tell Claude to check the feedback` : `not sent: ${j.error}`;
}

$("annotbtn").onclick = () => setAnnotate(!annotating);
$("t-pin").onclick = () => { tool = "pin"; renderAnnot(); };
$("t-pen").onclick = () => { tool = "pen"; renderAnnot(); };
$("t-erase").onclick = () => { tool = "erase"; renderAnnot(); };
$("t-clear").onclick = () => { if (sel && confirm(`Clear all marks on ${sel}?`)) { localStorage.removeItem(mkey()); renderAnnot(); drawMarks(); } };
$("comment").oninput = () => { const m = marks(true); m.comment = $("comment").value; save(m); };
$("send").onclick = () => sendFeedback();

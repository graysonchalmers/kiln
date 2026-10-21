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
  const stage = $("stage"), size = Math.min(stage.clientWidth, stage.clientHeight, 1100);
  const s = step < 0 ? m.steps.length - 1 : step;
  const img = new Image();
  img.onload = () => { $("view").src = img.src; pending = false; if (queued) { queued = false; draw(); } };
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
      row.onclick = () => { sel = m.name; localStorage.setItem("kiln.sel", sel); step = -1; renderList(); show(); };
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
$("stage").onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; $("stage").setPointerCapture(e.pointerId); };
$("stage").onpointermove = (e) => {
  if (!drag) return;
  yaw = drag.yaw - (e.clientX - drag.x) * 0.5;
  pitch = Math.max(-5, Math.min(89, drag.pitch + (e.clientY - drag.y) * 0.4));
  draw();
};
$("stage").onpointerup = () => { drag = undefined; };
setInterval(() => { if ($("spin").checked && !drag) { yaw -= 4; draw(); } }, 80);
addEventListener("resize", draw);

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

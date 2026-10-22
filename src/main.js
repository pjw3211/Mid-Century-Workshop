// The app: choose the coffee table, pick its size, features, profiles and
// joints from dropdowns, see the exact parts in 3D, and download a flat DXF
// of every part and a PDF cut list with the board layout.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { cad } from "./cad/client.js";
import { GROUPS, SIZES, LIMITS, DEFAULT_CHOICE, MM, unavailable, normalize, toParams, sizeOf, summary, sliderState } from "./coffeeTable.js";
import { picture } from "./pictures.js";
import { BOARDS, DEFAULT_BOARD } from "./cutlist/layout.js";
import { cutListPDF, fraction } from "./cutlist/pdf.js";

const $ = id => document.getElementById(id);
const TITLE = "Mid-century coffee table";
const STORE = "mcm-workshop-v1";

// ---- state, kept in this browser -------------------------------------------
let state = { choice: { ...DEFAULT_CHOICE }, units: "in", board: DEFAULT_BOARD, screen: "home" };
try { state = { ...state, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch (e) { /* start fresh */ }
state.choice = normalize(state.choice);
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private window */ } };

// ---- screens ------------------------------------------------------------------
function show(screen) {
  state.screen = screen; save();
  $("home").hidden = screen !== "home";
  $("design").hidden = screen !== "design";
  if (screen === "design") { startViewer(); renderGroups(); scheduleBuild(0); }
}
document.querySelector('[data-piece="coffee_table"]').onclick = () => show("design");
$("back").onclick = $("home-link").onclick = () => show("home");

for (const b of document.querySelectorAll("[data-units]")) b.onclick = () => {
  state.units = b.dataset.units; save();
  for (const x of document.querySelectorAll("[data-units]")) x.setAttribute("aria-pressed", String(x === b));
  renderGroups(); if (last) showParts(last);
};
for (const x of document.querySelectorAll("[data-units]")) x.setAttribute("aria-pressed", String(x.dataset.units === state.units));

$("board").innerHTML = BOARDS.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
$("board").value = state.board;
$("board").onchange = () => { state.board = $("board").value; save(); };

// ---- the choices: pictures, the size dropdown and sliders ------------------------------------------------------------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toUnits = inches => state.units === "mm" ? Math.round(inches * MM) : inches;
const fromUnits = v => state.units === "mm" ? v / MM : v;

function sizeLabel(s) {
  if (s.id === "custom") return "Custom size…";
  return state.units === "mm"
    ? `${s.name}: ${Math.round(s.l * MM)} × ${Math.round(s.w * MM)} × ${Math.round(s.h * MM)} mm`
    : `${s.name}: ${s.l} × ${s.w} × ${s.h} in`;
}

const DEFAULT_OPEN = { size: true, legs: true };
const isOpen = id => (state.open || DEFAULT_OPEN)[id] ?? false;

// A slider value in the units shown: inches as fractions, mm whole.
function sliderText(v, unit) {
  if (unit !== "in") return `${+v.toFixed(1)}${unit}`;
  return state.units === "mm" ? `${Math.round(v * MM)} mm` : `${fraction(v * MM)} in`;
}

function renderGroups() {
  const c = state.choice, out = [], sliders = sliderState(c);
  for (const g of GROUPS) {
    const picks = g.fields.filter(f => !f.dropdown).map(f => f.options.find(o => o.id === c[f.key])?.name).join(", ");
    const head = g.id === "size" ? sizeLabel(SIZES.find(s => s.id === c.size)) : picks;
    out.push(`<details data-group="${g.id}"${isOpen(g.id) ? " open" : ""}><summary><h3>${g.title}</h3><span class="picked">${esc(head)}</span></summary>`);
    for (const f of g.fields) {
      const picked = f.options.find(o => o.id === c[f.key]);
      if (f.dropdown) {
        const opts = f.options.map(o => `<option value="${o.id}"${o.id === c[f.key] ? " selected" : ""}>${esc(sizeLabel(SIZES.find(s => s.id === o.id)))}</option>`).join("");
        out.push(`<div class="field"><label for="f-${f.key}">${f.label}</label><select id="f-${f.key}" data-key="${f.key}">${opts}</select></div>`);
      } else {
        out.push(`<div class="field"><div class="flabel">${f.label}</div><div class="tiles" role="radiogroup" aria-label="${f.label}">`);
        for (const o of f.options) {
          const why = unavailable(c, f.key, o.id);
          out.push(`<button type="button" class="tile" role="radio" data-key="${f.key}" data-val="${o.id}" aria-checked="${o.id === c[f.key]}"${why ? ` disabled title="${esc(why)}"` : ""}>${picture(f.key, o.id)}<b>${esc(o.name)}</b></button>`);
        }
        out.push(`</div>`);
        if (picked?.desc) out.push(`<div class="why">${esc(picked.desc)}</div>`);
        out.push(`</div>`);
      }
      if (f.key === "size" && c.size === "custom") {
        const sz = sizeOf(c), u = state.units, step = u === "mm" ? 5 : 0.5;
        const box = (k, label) => `<div><label for="d-${k}">${label} (${u})</label><input type="number" id="d-${k}" data-dim="${k}"
          min="${toUnits(LIMITS[k][0])}" max="${toUnits(LIMITS[k][1])}" step="${step}" value="${toUnits(sz[k])}"></div>`;
        out.push(`<div class="dims">${box("l", "Length")}${box("w", "Width")}${box("h", "Height")}</div>`);
      }
    }
    const sl = (g.sliders || []).filter(x => sliders[x.key]);
    if (sl.length) {
      out.push(`<div class="sliders">`);
      for (const x of sl) {
        const v = sliders[x.key];
        out.push(`<div class="sl"><label for="s-${x.key}">${esc(x.label)}</label><output id="o-${x.key}">${sliderText(v.value, v.unit)}</output>
          <input type="range" id="s-${x.key}" data-slider="${x.key}" data-unit="${v.unit}" min="${v.min}" max="${v.max}" step="${v.step}" value="${Math.min(v.max, Math.max(v.min, v.value))}"></div>`);
      }
      if (sl.some(x => sliders[x.key].set)) out.push(`<button type="button" class="reset" data-reset="${g.id}">Reset these sliders</button>`);
      out.push(`</div>`);
    }
    out.push(`</details>`);
  }
  $("groups").innerHTML = out.join("");
  const commit = next => { state.choice = normalize(next); save(); renderGroups(); scheduleBuild(); };
  for (const d of $("groups").querySelectorAll("details")) d.ontoggle = () => {
    state.open = { ...(state.open || DEFAULT_OPEN), [d.dataset.group]: d.open }; save();
  };
  for (const sel of $("groups").querySelectorAll("select")) sel.onchange = () => {
    const key = sel.dataset.key;
    commit({ ...state.choice, [key]: sel.value, ...(key === "size" && sel.value === "custom" ? sizeOf(state.choice) : {}) });
  };
  for (const t of $("groups").querySelectorAll(".tile")) t.onclick = () => {
    if (state.choice[t.dataset.key] !== t.dataset.val) commit({ ...state.choice, [t.dataset.key]: t.dataset.val });
  };
  for (const inp of $("groups").querySelectorAll("[data-slider]")) {
    inp.oninput = () => { $("o-" + inp.dataset.slider).textContent = sliderText(+inp.value, inp.dataset.unit); };
    inp.onchange = () => commit({ ...state.choice, [inp.dataset.slider]: +inp.value });
  }
  for (const b of $("groups").querySelectorAll("[data-reset]")) b.onclick = () => {
    const next = { ...state.choice };
    for (const x of GROUPS.find(g => g.id === b.dataset.reset).sliders) delete next[x.key];
    commit(next);
  };
  for (const inp of $("groups").querySelectorAll("[data-dim]")) inp.onchange = () => {
    const v = parseFloat(inp.value);
    if (!isFinite(v)) return;
    commit({ ...state.choice, [inp.dataset.dim]: fromUnits(v) });
  };
}

// ---- 3D view ------------------------------------------------------------------
let renderer, scene, camera, controls, tableGroup = null, framed = false, exploded = false;
const COLORS = { walnut: 0x5a3a24, teak: 0x9a6634, oak: 0xc9a77a, beech: 0xd9b98c, maple: 0xeadbb8, plywood: 0xd8c39a,
  steel: 0x8a9096, brass: 0xc09a45 };

function startViewer() {
  if (renderer) return;
  const host = $("view");
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  host.prepend(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4efe6);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  camera.position.set(1.6, 1.1, 1.9);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.2, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1.5, 3, 1.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5 });
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xd8cbb8, 0.5));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}

// Parts come in millimetres with Z up; the scene is in metres with Y up.
function showMeshes(meshes) {
  if (tableGroup) { scene.remove(tableGroup); tableGroup.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  tableGroup = new THREE.Group();
  tableGroup.rotation.x = -Math.PI / 2;
  tableGroup.scale.setScalar(0.001);
  const all = new THREE.Box3();
  for (const m of meshes) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(m.vertices, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(m.triangles, 1));
    geo.computeBoundingBox();
    const metal = m.kind === "hardware";
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[m.material] ?? COLORS.walnut, roughness: metal ? 0.35 : 0.6, metalness: metal ? 0.8 : 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { group: m.group, id: m.id, centre: geo.boundingBox.getCenter(new THREE.Vector3()) };
    all.union(geo.boundingBox);
    tableGroup.add(mesh);
  }
  tableGroup.userData.size = all.getSize(new THREE.Vector3());
  scene.add(tableGroup);
  applyExplode();
  if (!framed) {
    framed = true;
    const s = tableGroup.userData.size, r = Math.max(s.x, s.y, s.z) * 0.001;
    controls.target.set(0, s.z * 0.0005, 0);
    camera.position.set(r * 1.05, r * 0.85, r * 1.25);
  }
}

// Pull the table apart so the joints show: the top lifts, aprons and legs
// move out from the middle, loose joinery stays between them.
const LIFT = { top: 220, fixings: 120 }, OUT = { aprons: 110, legs: 200, joinery: 70, shelf: 0, fixings: 0 };
function applyExplode() {
  if (!tableGroup) return;
  const size = tableGroup.userData.size;
  for (const m of tableGroup.children) {
    const c = m.userData.centre, g = m.userData.group;
    let dx = 0, dy = 0, dz = 0;
    if (exploded) {
      const o = OUT[g] ?? 0;
      dx = Math.abs(c.x) > size.x * 0.2 ? Math.sign(c.x) * o : 0;
      dy = Math.abs(c.y) > size.y * 0.2 ? Math.sign(c.y) * o : 0;
      dz = LIFT[g] ?? 0;
      // The shelf drops: boards a little, rails further and out, screws below.
      const id = m.userData.id;
      if (/^shelf-slat|^shelf$/.test(id)) dz = -40;
      if (/^shelf-rail/.test(id)) { dx = Math.sign(c.x) * 120; dz = -90; }
      if (/^shelf-dowel/.test(id)) { dx = Math.sign(c.x) * 120; dy = Math.sign(c.y) * 100; dz = -90; }
      if (/^screw-shelf/.test(id)) { dx = Math.sign(c.x) * 120; dz = -160; }
    }
    m.position.set(dx, dy, dz);
  }
}
$("explode").onclick = () => {
  exploded = !exploded;
  $("explode").setAttribute("aria-pressed", String(exploded));
  $("explode").textContent = exploded ? "Put together" : "Pull apart";
  applyExplode();
};

// ---- building ----------------------------------------------------------------
let timer = 0, seq = 0, last = null;
function setStatus(text, kind = "") { const s = $("status"); s.textContent = text; s.className = "chip " + kind; }

function scheduleBuild(delay = 300) {
  clearTimeout(timer);
  $("dl-dxf").disabled = $("dl-pdf").disabled = true;
  setStatus(last ? "Updating the parts…" : "Starting the exact model engine…", "busy");
  timer = setTimeout(build, delay);
}

async function build() {
  const n = ++seq, choice = { ...state.choice };
  try {
    const res = await cad("build", { params: toParams(choice) });
    if (n !== seq) return;
    last = { ...res, choice };
    showMeshes(res.meshes);
    showParts(last);
    setStatus("Exact parts ready, with every joint cut");
    $("dl-dxf").disabled = $("dl-pdf").disabled = false;
    window.__built = (window.__built || 0) + 1;
  } catch (e) {
    if (n !== seq) return;
    setStatus("Could not build this combination: " + e.message, "error");
  }
}

const fmt = v => state.units === "mm" ? `${Math.round(v)}` : fraction(v);
function showParts(res) {
  const u = state.units;
  $("parts").innerHTML = `<table><tr><th></th><th>Part</th><th>Qty</th><th>Finished size (${u})</th><th>Stock</th></tr>` +
    res.rows.map((r, i) => `<tr><td><b>${String.fromCharCode(65 + i)}</b></td><td>${esc(r.name)}</td><td>${r.qty}</td>
      <td>${fmt(r.finished.length)} × ${fmt(r.finished.width)} × ${u === "mm" ? r.finished.thickness.toFixed(1) : fraction(r.finished.thickness)}</td><td>${r.rough.stock}</td></tr>`).join("") + `</table>`;
  $("buy").innerHTML = res.hardware.length ? "<b>To buy:</b> " + res.hardware.map(h => `${h.qty} × ${esc(h.name)}`).join(", ") : "";
  $("notes").innerHTML = res.notes.map(esc).join("<br>");
}

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const slug = () => `coffee-table-${sizeOf(state.choice).l}x${sizeOf(state.choice).w}`;

$("dl-dxf").onclick = async () => {
  if (!last) return;
  $("dl-dxf").disabled = true;
  try {
    const heading = [`${TITLE} - every part laid flat`, ...summary(last.choice, state.units).map(([k, v]) => `${k}: ${v}`)];
    const text = await cad("dxf", { units: state.units, heading });
    download(`${slug()}-parts.dxf`, new Blob([text], { type: "application/dxf" }));
  } catch (e) { setStatus("The DXF could not be made: " + e.message, "error"); }
  $("dl-dxf").disabled = false;
};

$("dl-pdf").onclick = () => {
  if (!last) return;
  let image = null;
  try { renderer.render(scene, camera); image = renderer.domElement.toDataURL("image/png"); } catch (e) { /* no picture */ }
  const pdf = cutListPDF({ title: TITLE, summary: summary(last.choice, state.units), rows: last.rows, hardware: last.hardware,
    notes: last.notes, board: BOARDS.find(b => b.id === state.board), units: state.units, image });
  download(`${slug()}-cut-list.pdf`, new Blob([pdf], { type: "application/pdf" }));
};

// For the browser tests.
window.__app = { state: () => state, last: () => last };
show(state.screen === "design" ? "design" : "home");
window.__ready = true;

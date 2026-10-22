import { Exploration, type NavigationMode } from "./exploration";
import { visualBounds } from "./bounds";
import { installDemoSigils } from "../src/presets/demoSigils";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { allStories, releaseObject, type Control, type ControlValue, type Story, type StoryInstance } from "./registry";
import.meta.glob("./stories/**/*.ts", { eager: true });

installDemoSigils();

const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const stage = el("stage"), nav = el("nav");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stage.prepend(renderer.domElement);
renderer.domElement.setAttribute("aria-label", "Interactive 3D component preview");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 20000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.12;
const hemi = new THREE.HemisphereLight("#fff5de", "#485340", 2.1);
const sun = new THREE.DirectionalLight("#fff7e7", 3); sun.position.set(4, 8, 6);
const fill = new THREE.DirectionalLight("#d1e0f0", 1); fill.position.set(-3, 3, -4);
scene.add(hemi, sun, fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: "#76856a", roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.001; scene.add(ground);
let grid = new THREE.GridHelper(10, 20, "#bbc2a1", "#abb89a"); grid.position.y = 0.001;
(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.22;
scene.add(grid);
let boundsHelper: THREE.Box3Helper | undefined;
let current: StoryInstance | null = null;
let assetsReady = false, initialFramePending = false;
let activeStory: Story | undefined;
let values: Record<string, ControlValue> = {};
const frameIntervals: number[] = [];
let buildMs = 0, frameMs = 0, lastTime = performance.now(), elapsed = 0, lastStats = 0, qaToken = 0;
let qaMode = false, turntable = false, wireframe = false;
const exploration = new Exploration(camera, orbit, renderer.domElement, mode => { settings.navigation = mode; applyStage(); writeURL(); });
const orderedCategories = ["Explore", "Pieces", "Armies", "Wildlings", "Castles", "Cities & seats", "Nature", "Props", "Dragons", "Effects", "Tokens", "Materials", "Heraldry", "Scale"];
const orderedStories = () => [...allStories()].sort((a,b) => {
  const ai = orderedCategories.indexOf(a.category), bi = orderedCategories.indexOf(b.category);
  return (ai < 0 ? 1 : ai) - (bi < 0 ? 1 : bi) || a.title.localeCompare(b.title);
});
const stageSchema: Record<string, Control> = {
  navigation: { type: "select", label: "Camera mode", default: "orbit", options: ["orbit", "fly", "walk"] },
  turntable: { type: "boolean", label: "Turntable", default: false },
  grid: { type: "boolean", label: "Grid", default: true },
  ground: { type: "select", label: "Ground", default: "grass", options: ["grass", "sand", "snow", "water", "parchment"] },
  light: { type: "select", label: "Light", default: "day", options: ["day", "dusk", "overcast"] },
  wireframe: { type: "boolean", label: "Wireframe", default: false },
  fog: { type: "boolean", label: "Atmospheric fog", default: false },
  bounds: { type: "boolean", label: "Bounding box", default: false },
  ratio: { type: "select", label: "Pixel ratio", default: "1", options: ["1", "1.5", "2"] },
};
let settings: Record<string, ControlValue> = {};
function parseValue(control: Control, raw: string | null): ControlValue {
  if (raw === null) return control.default;
  if (control.type === "boolean") return raw === "true";
  if (control.type === "number") { const n = Number(raw); return Number.isFinite(n) ? Math.min(control.max, Math.max(control.min, n)) : control.default; }
  if (control.type === "select") return control.options.includes(raw) ? raw : control.default;
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : control.default;
}
function readValues(schema: Record<string, Control>, params: URLSearchParams, prefix = ""): Record<string, ControlValue> {
  return Object.fromEntries(Object.entries(schema).map(([key, control]) => [key, parseValue(control, params.get(prefix + key))]));
}
function route(): { id: string; params: URLSearchParams } {
  const [id, query = ""] = location.hash.slice(1).split("?"); return { id, params: new URLSearchParams(query) };
}
function writeURL(): void {
  if (!activeStory) return;
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => params.set(key, String(value)));
  Object.entries(settings).forEach(([key, value]) => params.set(`view.${key}`, String(value)));
  history.replaceState(null, "", `#${activeStory.id}?${params}`);
}
function addControls(container: HTMLElement, schema: Record<string, Control>, state: Record<string, ControlValue>, changed: () => void): void {
  container.replaceChildren();
  Object.entries(schema).forEach(([key, control]) => {
    const label = document.createElement("label"); label.className = "control";
    const name = document.createElement("span"); name.textContent = control.label; label.append(name);
    let input: HTMLInputElement | HTMLSelectElement;
    if (control.type === "select") {
      input = document.createElement("select"); control.options.forEach(option => { const el = document.createElement("option"); el.value = option; el.textContent = option; input.append(el); });
    } else {
      input = document.createElement("input"); input.type = control.type === "colour" ? "color" : control.type === "boolean" ? "checkbox" : "number";
      if (control.type === "number") { input.min = String(control.min); input.max = String(control.max); input.step = String(control.step ?? 1); }
    }
    input.setAttribute("aria-label", control.label);
    input.value = String(state[key]); if (input instanceof HTMLInputElement && control.type === "boolean") input.checked = Boolean(state[key]);
    input.addEventListener("change", () => { state[key] = parseValue(control, input instanceof HTMLInputElement && control.type === "boolean" ? String(input.checked) : input.value); changed(); });
    label.append(input); container.append(label);
  });
}
function disposeCurrent(): void {
  if (current) { scene.remove(current.object); current.dispose?.(); releaseObject(current.object); current = null; }
  el("story-overlay").replaceChildren(); el("story-hud").replaceChildren();
  if (boundsHelper) { scene.remove(boundsHelper); boundsHelper.geometry.dispose(); (boundsHelper.material as THREE.Material).dispose(); boundsHelper = undefined; }
}
function frame(object: THREE.Object3D, targetCamera = camera, aspect = camera.aspect): void {
  object.updateMatrixWorld(true);
  const box = visualBounds(object);
  if (box.isEmpty()) throw new Error("Story has empty bounds");
  const center = box.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(0.8, 0.62, 1.25).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tanY = Math.tan(THREE.MathUtils.degToRad(targetCamera.fov / 2)), tanX = tanY * aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(center); const depth = point.dot(direction);
    distance = Math.max(distance, Math.abs(point.dot(right)) / tanX + depth, Math.abs(point.dot(up)) / tanY + depth);
  }
  distance = Math.max(0.05, distance * 1.23);
  targetCamera.position.copy(center).addScaledVector(direction, distance);
  targetCamera.near = Math.max(0.0001, distance / 1000); targetCamera.far = Math.max(10, distance * 50); targetCamera.updateProjectionMatrix(); targetCamera.lookAt(center);
  const extent = Math.max(0.01, box.getSize(new THREE.Vector3()).length());
  ground.scale.setScalar(extent * 40); ground.position.set(center.x, -0.001, center.z);
  grid.scale.setScalar(extent / 5); grid.position.set(center.x, 0.001, center.z);
  if (targetCamera === camera) { orbit.target.copy(center); orbit.minDistance = 0; orbit.maxDistance = distance * 10; orbit.update(); }
}
function applyStage(): void {
  const mode = String(settings.navigation) as NavigationMode;
  if (mode !== exploration.mode) exploration.setMode(mode);
  el<HTMLSelectElement>("navigation").value = mode;
  const modeControl = el("stage-controls").querySelector<HTMLSelectElement>('[aria-label="Camera mode"]');
  if (modeControl) modeControl.value = mode;
  el("move-pad").hidden = mode === "orbit";
  el("stage").dataset.navigation = mode;
  el("stage").querySelector(".stage-badge > span:last-child")!.textContent = mode === "orbit" ? "ORBIT TO INSPECT" : mode === "walk" ? "WALK · 1.8 M EYE HEIGHT" : "FREE FLIGHT";
  el("stage").querySelector(".stage-hint")!.textContent = mode === "orbit" ? "Drag to orbit · Scroll to zoom · Double-click a surface to approach" : "Drag to look · WASD / arrows move · Q/E down/up · Shift faster · Wheel speed · G walk · Esc orbit";
  const colors: Record<string, string> = { grass: "#79866c", sand: "#b7a585", snow: "#c6d0cf", water: "#4b7480", parchment: "#bfad85" };
  const color = colors[String(settings.ground)] ?? colors.grass;
  (ground.material as THREE.MeshStandardMaterial).color.set(color);
  (ground.material as THREE.MeshStandardMaterial).roughness = settings.ground === "water" ? 0.24 : 1;
  const sky = activeStory?.category === "Explore" ? settings.light === "dusk" ? "#a28c85" : "#afc5cd" : color;
  scene.background = new THREE.Color(sky);
  const span = current ? visualBounds(current.object).getSize(new THREE.Vector3()).length() : 10;
  scene.fog = settings.fog ? new THREE.Fog(sky,span*0.45,span*2) : null;
  ground.visible = activeStory?.category !== "Explore";
  grid.visible = Boolean(settings.grid); turntable = Boolean(settings.turntable); wireframe = Boolean(settings.wireframe);
  const dusk = settings.light === "dusk", cloud = settings.light === "overcast";
  hemi.intensity = dusk ? 0.95 : cloud ? 2.5 : 2.1; sun.intensity = dusk ? 2.3 : cloud ? 0.7 : 3;
  sun.color.set(dusk ? "#ffb075" : cloud ? "#dce5ee" : "#fff7e7"); sun.position.set(dusk ? -6 : 4, dusk ? 2 : 8, 6);
  fill.intensity = dusk ? 0.6 : 1;
  renderer.setPixelRatio(Number(settings.ratio));
  current?.object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => {
      if (material instanceof THREE.MeshStandardMaterial) material.wireframe = wireframe;
      const seasonal = material as THREE.Material & { setSeason?: (dusk: boolean, winter: boolean, full: boolean) => void };
      seasonal.setSeason?.(dusk, settings.ground === "snow", true);
    });
  });
  if (boundsHelper) boundsHelper.visible = Boolean(settings.bounds);
  resize(false);
}
function rebuild(): void {
  if (!activeStory) return;
  disposeCurrent();
  const start = performance.now();
  current = activeStory.build({ scene, camera, renderer, values, overlay: el("story-overlay"), hud: el("story-hud") });
  scene.add(current.object); initialFramePending = true; assetsReady = !current.ready; buildMs = performance.now() - start;
  frame(current.object);
  exploration.bind(current);
  exploration.setMode(String(settings.navigation) as NavigationMode);
  const box = visualBounds(current.object);
  boundsHelper = new THREE.Box3Helper(box, new THREE.Color("#f4c56d")); scene.add(boundsHelper);
  const extent = Math.max(0.1, box.getSize(new THREE.Vector3()).length());
  grid.scale.setScalar(extent / 5); grid.position.x = box.getCenter(new THREE.Vector3()).x; grid.position.z = box.getCenter(new THREE.Vector3()).z;
  applyStage();
  document.body.dataset.ready = activeStory.id;
}
function showStory(id: string, params = new URLSearchParams()): void {
  qaMode = false; qaToken++;
  el("view").hidden = false; el("qa-sheet").hidden = true;
  const story = allStories().find(entry => entry.id === id) ?? allStories()[0]; if (!story) return;
  activeStory = story; values = readValues(story.controls ?? {}, params); settings = readValues(stageSchema, params, "view.");
  el("title").textContent = story.title; el("category").textContent = story.category;
  el("description").textContent = story.description ?? "Original procedural geometry, isolated from game state. Inspect the silhouette, materials and authored scale.";
  el("story-index").textContent = String(orderedStories().findIndex(s => s.id === story.id) + 1).padStart(2, "0");
  addControls(el("story-controls"), story.controls ?? {}, values, () => { writeURL(); rebuild(); });
  addControls(el("stage-controls"), stageSchema, settings, () => { writeURL(); applyStage(); });
  if (!Object.keys(story.controls ?? {}).length) el("story-controls").textContent = "Authored reference · no variants";
  nav.querySelectorAll<HTMLAnchorElement>("a").forEach(link => { const active = link.dataset.id === story.id; link.classList.toggle("active", active); if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
  document.body.classList.remove("drawer"); el("menu").setAttribute("aria-expanded", "false");
  resize(false); rebuild();
}
function buildNav(): void {
  nav.replaceChildren(); const categories = new Map<string, HTMLElement>();
  const query = el<HTMLInputElement>("search").value.toLowerCase();
  for (const story of orderedStories().filter(story => `${story.category} ${story.title}`.toLowerCase().includes(query))) {
    let section = categories.get(story.category);
    if (!section) { section = document.createElement("section"); const h2 = document.createElement("h2"); h2.textContent = story.category; section.append(h2); nav.append(section); categories.set(story.category, section); }
    const link = document.createElement("a"); link.href = `#${story.id}`; link.dataset.id = story.id; link.textContent = story.title; link.classList.toggle("active", story.id === activeStory?.id); section.append(link);
  }
  if (!nav.childElementCount) nav.textContent = "No components match your search.";
  el("count").textContent = String(allStories().length);
}
function resize(reframe = true): void {
  if (qaMode) return;
  const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight);
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  if (reframe && current) frame(current.object);
}
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function showSheet(): Promise<void> {
  qaMode = true; const token = ++qaToken;
  disposeCurrent(); activeStory = undefined; document.body.dataset.ready = "qa-loading";
  el("view").hidden = true; el("qa-sheet").hidden = false; el("title").textContent = "Visual QA sheet"; el("category").textContent = "THE COMPLETE COLLECTION";
  document.body.classList.remove("drawer"); el("menu").setAttribute("aria-expanded", "false");
  el("qa-grid").replaceChildren(); settings = readValues(stageSchema, new URLSearchParams()); applyStage();
  const pixelRatio = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(480, 360, false);
  const thumbCamera = camera.clone(); thumbCamera.aspect = 4 / 3; thumbCamera.updateProjectionMatrix();
  const target = new THREE.WebGLRenderTarget(480,360);
  let lastCategory = "", count = 0;
  for (const story of orderedStories()) {
    if (token !== qaToken) break;
    if (story.category !== lastCategory) { const h = document.createElement("h2"); h.textContent = story.category; el("qa-grid").append(h); lastCategory = story.category; }
    let built: StoryInstance | undefined;
    try {
      built = story.build({ scene, camera: thumbCamera, renderer, overlay: document.createElement("div"), hud: document.createElement("div"), values: readValues(story.controls ?? {}, new URLSearchParams()) }); scene.add(built.object);
      if (built.ready) {
        const deadline = performance.now() + 15000;
        while (!built.ready()) { if (performance.now() > deadline) throw new Error(`Asset readiness timeout: ${story.id}`); await nextFrame(); }
      }
      frame(built.object, thumbCamera, 4 / 3);
      // Sample visible motion for the sheet instead of capturing a zero-age burst.
      if (story.category === "Dragons") for (let i = 0; i < 60; i++) built.update?.(1 / 30, i / 30);
      else built.update?.(story.category === "Effects" ? 0.35 : 0, 1);
      // Builders may initialize animated bounds or request their own legacy frame on first update.
      frame(built.object, thumbCamera, 4 / 3);
      renderer.setRenderTarget(target); renderer.render(scene, thumbCamera); renderer.setRenderTarget(null);
      // Render to the canvas as well: color management matches the normal stage exactly.
      renderer.render(scene, thumbCamera);
      const link = document.createElement("a"); link.href = `#${story.id}`; link.className = "qa-card";
      const img = document.createElement("img"); img.src = renderer.domElement.toDataURL("image/jpeg",0.72); img.alt = story.title; img.loading = "lazy";
      const caption = document.createElement("span"); caption.textContent = story.title; link.append(img,caption); el("qa-grid").append(link);
    } catch (error) {
      console.error(`QA thumbnail failed: ${story.id}`, error);
      const card = document.createElement("a"); card.href = `#${story.id}`; card.className = "qa-card";
      card.textContent = `${story.title}: could not render. Open to inspect.`; el("qa-grid").append(card);
    } finally {
      if (built) { scene.remove(built.object); built.dispose?.(); releaseObject(built.object); }
    }
    el("qa-progress").textContent = `Rendered ${++count} / ${allStories().length} studies · click any component to inspect`;
    await nextFrame();
  }
  target.dispose(); renderer.setPixelRatio(pixelRatio);
  if (token === qaToken) document.body.dataset.ready = "qa";
  else resize(false);
}
function navigate(): void { const { id, params } = route(); if (id === "qa") void showSheet(); else showStory(id, params); }
el("navigation").addEventListener("change", () => { settings.navigation = el<HTMLSelectElement>("navigation").value; writeURL(); applyStage(); });
el("search").addEventListener("input", buildNav);
el("menu").addEventListener("click", () => { const open = document.body.classList.toggle("drawer"); el("menu").setAttribute("aria-expanded", String(open)); });
addEventListener("keydown", event => { if (event.key === "Escape") { document.body.classList.remove("drawer"); el("menu").setAttribute("aria-expanded", "false"); } });
el("reset").addEventListener("click", () => { if (activeStory) { showStory(activeStory.id); writeURL(); } });
el("copy").addEventListener("click", async () => {
  writeURL(); await navigator.clipboard.writeText(location.href); el("toast").textContent = "QA link copied"; el("toast").hidden = false; setTimeout(() => { el("toast").hidden = true; }, 2000);
});
addEventListener("hashchange", navigate);
new ResizeObserver(() => resize(exploration.mode === "orbit")).observe(stage);
buildNav(); resize(false); navigate();
function stats(): Record<string, number> {
  return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0, buildMs: Number(buildMs.toFixed(2)), frameMs: Number(frameMs.toFixed(2)) };
}
renderer.setAnimationLoop(now => {
  const intervalMs = now - lastTime; const dt = Math.min(0.1, intervalMs / 1000); lastTime = now; elapsed += dt;
  if (qaMode) return;
  const start = performance.now();
  if (current && turntable && !matchMedia("(prefers-reduced-motion: reduce)").matches) { current.object.rotation.y += dt * 0.22; if (boundsHelper) boundsHelper.box.copy(visualBounds(current.object)); }
  if (current && !assetsReady && (current.ready?.() ?? true)) {
    assetsReady = true; frame(current.object); boundsHelper?.box.copy(visualBounds(current.object));
  }
  frameIntervals.push(intervalMs); if (frameIntervals.length > 1200) frameIntervals.shift();
  current?.update?.(dt, elapsed);
  // The gallery owns initial framing, including legacy stories that also set the camera.
  if (initialFramePending && current) { initialFramePending = false; if (exploration.mode === "orbit") frame(current.object); }
  exploration.update(dt); renderer.render(scene, camera);
  frameMs = frameMs ? frameMs * 0.9 + (performance.now() - start) * 0.1 : performance.now() - start;
  if (now - lastStats > 250) { const s = stats(); el("stats").textContent = `${s.calls} draws · ${s.triangles.toLocaleString()} triangles\n${s.geometries} geometries · ${s.textures} textures · ${s.programs} programs\nBuild ${s.buildMs} ms · frame CPU ${s.frameMs} ms`; el("stats").style.whiteSpace = "pre-line"; lastStats = now; }
});
// Explicit inspection surface for the documented QA runner and downstream integrations.
Object.assign(window, { __realmforge: { navigation: () => exploration.state(), resetMetrics: () => { frameIntervals.length=0; }, metrics: () => { const sorted=[...frameIntervals].sort((a,b)=>a-b); return { samples:sorted.length,frameP50:sorted[Math.floor(sorted.length*0.5)]??0,frameP95:sorted[Math.floor(sorted.length*0.95)]??0,...stats() }; }, stories: () => orderedStories().map(({ id, title, category }) => ({ id, title, category })), stats, ready: () => current?.ready?.() ?? true, values: () => ({ story: activeStory?.id, values, settings }), framing: () => {
  if (!current) return [];
  const box = visualBounds(current.object); const points: {x:number;y:number;z:number}[] = [];
  for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) { const p = new THREE.Vector3(x,y,z).project(camera); points.push({x:p.x,y:p.y,z:p.z}); }
  return points;
} } });

import * as THREE from "three";
import { installArmyDemoHeraldry } from "./heraldry";
import { disposeHeraldry } from "../../../src/heraldry";
import { visualBounds } from "../../bounds";
import { ArmyBatch, type ArmyType } from "../../../src/armies";
import type { StoryContext, StoryInstance } from "../../registry";

// Demonstration data only; the public army API has no game-specific house names.
export const houses = [
  { id: "greyjoy", color: "#1c1c1c", name: "Greyjoy" },
  { id: "stark", color: "#d8d8d8", name: "Stark" },
  { id: "lannister", color: "#ae2927", name: "Lannister" },
  { id: "baratheon", color: "#dfb72f", name: "Baratheon" },
  { id: "tyrell", color: "#347b42", name: "Tyrell" },
  { id: "martell", color: "#d5742d", name: "Martell" },
];
export const terrains = [
  { id: "grass", color: "#687a52" }, { id: "sand", color: "#b8a57d" },
  { id: "snow", color: "#c5cecc" }, { id: "water", color: "#406d7b" },
];
export const names: Record<ArmyType, string> = { footman: "Infantry", knight: "Cavalry", "siege-engine": "Trebuchet", ship: "War galley", dragon: "Wyvern" };

export function label(text: string, x: number, y: number, z: number, width = 1.2, color = "#f1ead8"): THREE.Sprite {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color; ctx.font = "500 40px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(width, width * 96 / 512, 1); sprite.position.set(x, y, z); sprite.renderOrder = 3;
  return sprite;
}

export function swatch(group: THREE.Group, x: number, z: number, color: string, width = 1.8, depth = 1.9): void {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec3 vTerrainPoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTerrainPoint=position;");
    shader.fragmentShader = "varying vec3 vTerrainPoint;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float grain=fract(sin(dot(floor(vTerrainPoint.xz*130.),vec2(12.9898,78.233)))*43758.5453);
      float mottling=sin(vTerrainPoint.x*9.+sin(vTerrainPoint.z*7.))*sin(vTerrainPoint.z*13.);
      diffuseColor.rgb*=.91+grain*.09+mottling*.025;`);
  };
  material.customProgramCacheKey = () => "army-terrain-grain";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, depth), material);
  mesh.position.set(x, -0.024, z); group.add(mesh);
}

const css = `
/* Temporary local overlay adapter until StoryContext has overlay / hud slots. */
.rf-armies #stats { display:none; }
.army-panel { position:absolute; z-index:4; left:16px; bottom:18px; max-width:calc(100% - 32px); color:#e9e1ca; padding:0; border:0; }
.army-panel summary { font:10px system-ui; letter-spacing:.08em; color:#d4b77c; margin:0; padding:8px 10px; background:#172327ed; border:1px solid #53615c; border-radius:4px; width:fit-content; }
.army-controls { display:flex; flex-wrap:wrap; gap:7px 10px; padding:10px; border:1px solid #52615d; border-radius:4px; background:#172327f5; width:fit-content; max-width:580px; box-shadow:0 6px 20px #0003; }
.army-controls label { display:flex; gap:6px; align-items:center; color:#d2dbd0; font:11px system-ui; }
.army-controls select,.army-controls button { font:11px system-ui; background:#2a383a; color:#f3e6c8; border:1px solid #536260; border-radius:3px; padding:5px 6px; }
.army-controls input[type=range] { width:64px; accent-color:#d4b77c; }
.army-controls input[type=checkbox] { accent-color:#d4b77c; }
.army-hud { position:absolute; z-index:3; top:18px; right:16px; font:10px/1.7 ui-monospace,monospace; background:#172327e8; border:1px solid #52615d; border-radius:4px; padding:7px 10px; color:#d4dfd0; pointer-events:none; white-space:pre-line; }
.army-footer { position:absolute; right:16px; bottom:18px; max-width:180px; color:#eee8d5; font:9px/1.6 system-ui; text-align:right; pointer-events:none; white-space:pre-line; }
.rf-armies .stage-hint { display:none; }
@media(max-width:600px) {
  .army-panel { left:10px; bottom:10px; max-width:calc(100% - 20px); }
  .army-controls { gap:6px 8px; padding:8px; }
  .army-controls label { font-size:10px; }
  .army-controls select,.army-controls button { font-size:10px; padding:5px; }
  .army-hud { top:16px; right:10px; font-size:8px; padding:6px 8px; }
  .army-footer { display:none; }
}
`;

export interface Lab extends StoryInstance {
  object: THREE.Group;
  batch: ArmyBatch;
  controls: HTMLElement;
  hud: HTMLElement;
  footer: HTMLElement;
  /** Resolves when the batch has compiled every material variant. */
  warmed: Promise<void>;
  tick?: (delta: number, elapsed: number) => void;
  frame: () => void;
}

export function lab(ctx: StoryContext, title: string, description: string, detail: "high" | "balanced" | "low" = "high"): Lab {
  // Clear cached paths as this story deliberately replaces demo sources.
  disposeHeraldry();
  const restoreHeraldry = installArmyDemoHeraldry();
  const object = new THREE.Group();
  const batch = new ArmyBatch({ renderer: ctx.renderer, detail }); object.add(batch.object);
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style); document.body.classList.add("rf-armies");
  const panel = document.createElement("details"); panel.className = "army-panel"; panel.open = true; panel.setAttribute("aria-label", title);
  panel.innerHTML = `<summary>Company controls</summary><div class="army-controls"></div>`;
  panel.title = description;
  const hud = document.createElement("output"); hud.className = "army-hud";
  const footer = document.createElement("div"); footer.className = "army-footer"; footer.textContent = "";
  document.getElementById("stage")!.append(panel, hud, footer);
  const background = ctx.scene.background; ctx.scene.background = new THREE.Color("#26383c");
  const galleryGround = ctx.scene.children.find(child => child instanceof THREE.Mesh && ["CircleGeometry", "PlaneGeometry"].includes(child.geometry.type));
  const groundVisible = galleryGround?.visible ?? true;
  if (galleryGround) galleryGround.visible = false;
  const samples = new Float32Array(1200), updateSamples = new Float32Array(1200);
  let previousFrame = performance.now();
  let sampleIndex = 0, samplesCount = 0, previousPrograms = 0, latePrograms = 0, ready = false, started = false, hudClock = 1, frameRequested = true, disposed = false;
  const bounds = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3();
  const result: Lab = {
    object, batch, controls: panel.querySelector(".army-controls")!, hud, footer,
    warmed: Promise.resolve(),
    // Geometry is built synchronously; shader warmup runs on the first update.
    ready: () => true,
    frame() { frameRequested = true; },
    update(delta, elapsed) {
      if (disposed) return;
      if (galleryGround) galleryGround.visible = false;
      if (frameRequested) {
        bounds.copy(visualBounds(object)); bounds.getCenter(center); bounds.getSize(size);
        const aspect = ctx.camera.aspect;
        const span = Math.max(size.x / Math.max(0.5, aspect), size.z * 0.9, size.y * 1.6);
        const distance = span / (2 * Math.tan(ctx.camera.fov * Math.PI / 360)) * 1.2;
        ctx.camera.position.set(center.x + distance * 0.1, center.y + distance * 0.52, center.z + distance * 0.85);
        ctx.camera.lookAt(center);
        frameRequested = false;
      }
      if (!started) {
        started = true;
        result.warmed = batch.warmup(ctx.renderer, ctx.camera, ctx.scene).then(() => { if (!disposed) { ready = true; previousPrograms = ctx.renderer.info.programs?.length ?? 0; } });
      }
      const updateStart = performance.now();
      const frameInterval = updateStart - previousFrame; previousFrame = updateStart;
      result.tick?.(delta, elapsed);
      batch.update(delta, ctx.camera);
      const updateMs = performance.now() - updateStart;
      const programs = ctx.renderer.info.programs?.length ?? 0;
      if (ready) {
        if (programs > previousPrograms) latePrograms += programs - previousPrograms;
        previousPrograms = programs;
        updateSamples[sampleIndex] = updateMs; samples[sampleIndex] = frameInterval; sampleIndex = (sampleIndex + 1) % samples.length; samplesCount = Math.min(samplesCount + 1, samples.length);
      }
      hudClock += delta;
      if (hudClock > 0.35) {
        hudClock = 0;
        const stats = batch.stats;
        hud.textContent = `${stats.companies} companies · ${detail.toUpperCase()}\n${stats.draws} army draws · ${stats.triangles.toLocaleString()} tris\n${ctx.renderer.info.render.calls} scene draws · ${programs} programs\n${frameInterval.toFixed(1)} ms frame`;
      }
    },
    dispose() {
      disposed = true;
      batch.dispose(); restoreHeraldry(); disposeHeraldry();
      object.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(m => { const map = (m as THREE.MeshBasicMaterial).map; map?.dispose(); m.dispose(); });
      } });
      panel.remove(); hud.remove(); footer.remove(); style.remove(); document.body.classList.remove("rf-armies"); ctx.scene.background = background; if (galleryGround) galleryGround.visible = groundVisible;
      delete (window as unknown as { __armyQA?: unknown }).__armyQA;
    },
  };
  (window as unknown as { __armyQA: unknown }).__armyQA = {
    batch, camera: ctx.camera, scene: ctx.scene, renderer: ctx.renderer,
    get ready() { return ready; },
    metrics() {
      const values = Array.from(samples.subarray(0, samplesCount)).sort((a, b) => a - b);
      const updates = Array.from(updateSamples.subarray(0, samplesCount)).sort((a, b) => a - b);
      const gl = ctx.renderer.getContext(), debug = gl.getExtension("WEBGL_debug_renderer_info");
      return { updateP95: updates[Math.floor(updates.length * 0.95)] ?? 0, hardware: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable", ...batch.stats, programs: ctx.renderer.info.programs?.length ?? 0, latePrograms, frameP50: values[Math.floor(values.length * 0.5)] ?? 0, frameP95: values[Math.floor(values.length * 0.95)] ?? 0, samples: samplesCount, renderer: ctx.renderer.getContext().getParameter(ctx.renderer.getContext().RENDERER), sceneDraws: ctx.renderer.info.render.calls, sceneTriangles: ctx.renderer.info.render.triangles, webglError: gl.getError() };
    },
    resetMetrics() { samplesCount = sampleIndex = latePrograms = 0; previousPrograms = ctx.renderer.info.programs?.length ?? 0; },
  };
  return result;
}

export function select(parent: HTMLElement, title: string, values: readonly string[], initial: string, change: (value: string) => void): HTMLSelectElement {
  const label = document.createElement("label"); label.textContent = title;
  const input = document.createElement("select"); input.setAttribute("aria-label", title);
  values.forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; input.add(option); }); input.value = initial;
  input.addEventListener("change", () => change(input.value)); label.append(input); parent.append(label); return input;
}
export function toggle(parent: HTMLElement, title: string, initial: boolean, change: (value: boolean) => void): HTMLInputElement {
  const label = document.createElement("label"); label.textContent = title;
  const input = document.createElement("input"); input.type = "checkbox"; input.checked = initial; input.setAttribute("aria-label", title);
  input.addEventListener("change", () => change(input.checked)); label.append(input); parent.append(label); return input;
}

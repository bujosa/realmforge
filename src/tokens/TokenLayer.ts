import * as THREE from "three";
import TokenAtlas, { ATLAS_CELL, ATLAS_GUTTER } from "./TokenAtlas";
import { bandOf, TOKEN_CLOSE_LIFT_METRES, TOKEN_HIT_PIXELS, TOKEN_MAX_PUSH, TOKEN_OCCLUDED_OPACITY, TokenKind, tokenPixels } from "../core/SizeLaw";
import { separate, TokenDisc } from "./tokenSeparation";
import { METRES_PER_UNIT } from "../core/SceneFrame";
import { coarsePointer } from "./screenFixed";

/**
 * Order, power, garrison and loyalty tokens at a fixed screen size
 * (docs/v3-world-scale-design.md §2.5, decision 3), as ONE instanced batch
 * per token kind. Each batch is drawn twice from the same buffers: a ghost
 * without depth test at 60 % (a token behind a hill or a wall stays visible
 * and pickable) and the solid pass with depth test on top of it. Faces
 * come from one atlas, so neither the face nor the house changes the draw.
 *
 * The scene still owns the piece records, their animation and opacity; it
 * feeds the layer per frame (`begin` → `add` per token → `end`) and asks it
 * first when picking. Only used when the World frame has k > 1.
 */

export interface TokenInput {
  id: string;
  kind: Exclude<TokenKind, "lock">;
  /** Anchor in world space (the token's slot on the ground). */
  position: THREE.Vector3;
  /** Face texture the 3D token would show now (already fog/reveal-filtered). */
  face: THREE.Texture | null | undefined;
  /** House colour of the rim (CSS colour). */
  color: string;
  /** Piece opacity (fades, cinema dim). */
  opacity: number;
  /** Animation scale (attention pulse, fade-out shrink). */
  scale: number;
  /** cos of the flip angle: 1 face up, 0 edge-on, −1 upside down. */
  flip: number;
  /** Highlight colour or null. */
  highlight: string | null;
  /** May intercept clicks and hovers. */
  pickable: boolean;
}

interface Placed extends TokenInput { x: number; y: number; depth: number; size: number; dx: number; dy: number }

const KINDS: Exclude<TokenKind, "lock">[] = ["power", "loyalty", "garrison", "order"];
const RENDER_ORDER: Record<Exclude<TokenKind, "lock">, number> = { power: 6, loyalty: 6, garrison: 7, order: 8 };
/** Extra quad margin around the disc for the drop shadow and highlight ring (px). */
const MARGIN = 6;

const vertexShader = /* glsl */ `
attribute vec3 aCenter;
attribute vec4 aScreen;   // push offset (px, y down), diameter (px), x squash
attribute vec2 aCell;     // atlas cell origin (uv)
attribute vec3 aRim;
attribute vec4 aGlow;     // rgb + strength
attribute float aAlpha;
uniform vec2 uViewport;
uniform float uMargin;
varying vec2 vPx;
varying vec2 vCell;
varying vec3 vRim;
varying vec4 vGlow;
varying float vAlpha;
varying float vRadius;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
  float half_ = aScreen.z * 0.5 + uMargin;
  vec2 corner = position.xy;
  vPx = corner * half_;
  vec2 offset = vec2(corner.x * half_ * aScreen.w, corner.y * half_) + vec2(aScreen.x, -aScreen.y);
  clip.xy += offset * 2.0 / uViewport * clip.w;
  gl_Position = clip;
  vCell = aCell;
  vRim = aRim;
  vGlow = aGlow;
  vAlpha = aAlpha;
  vRadius = aScreen.z * 0.5;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uCell;      // cell size in uv
uniform float uInset;     // gutter in uv
uniform float uOpacity;
uniform float uAlphaShape; // power/garrison keep the authored silhouette
varying vec2 vPx;
varying vec2 vCell;
varying vec3 vRim;
varying vec4 vGlow;
varying float vAlpha;
varying float vRadius;
void main() {
  float r = length(vPx);
  float R = vRadius;
  // Sample the entire transparent face, not an inset circle that clips seals,
  // crowned shields and fortified square corners. All art contains its bevel.
  vec2 f = vec2(vPx.x, -vPx.y) / R * 0.5 + 0.5;
  vec2 uv = vCell + vec2(uInset) + clamp(f, 0.0, 1.0) * (uCell - 2.0 * uInset);
  float bounds = step(0.0, f.x) * step(f.x, 1.0) * step(0.0, f.y) * step(f.y, 1.0);
  vec4 face = texture2D(uAtlas, uv);
  float disc = 1.0 - smoothstep(R - 1.0, R, r);
  float alpha = face.a * bounds * mix(disc, 1.0, uAlphaShape);
  vec3 color = face.rgb;
  float ring = vGlow.a * (1.0 - smoothstep(R + 1.0, R + 4.5, r)) * smoothstep(R - 1.0, R + 0.5, r);
  vec2 shadowF = (vec2(vPx.x, -vPx.y) + vec2(0.0, 2.5)) / R * 0.5 + 0.5;
  vec2 shadowUV = vCell + vec2(uInset) + clamp(shadowF, 0.0, 1.0) * (uCell - 2.0 * uInset);
  float shadowBounds = step(0.0, shadowF.x) * step(shadowF.x, 1.0) * step(0.0, shadowF.y) * step(shadowF.y, 1.0);
  float shadow = 0.35 * texture2D(uAtlas, shadowUV).a * shadowBounds;
  vec3 outside = mix(vec3(0.0), vGlow.rgb, ring / max(0.0001, ring + shadow * (1.0 - ring)));
  float outsideAlpha = max(ring, shadow);
  // Straight alpha compositing keeps anti-aliased gold edges free of dark halos.
  float combined = alpha + outsideAlpha * (1.0 - alpha);
  color = (color * alpha + outside * outsideAlpha * (1.0 - alpha)) / max(0.0001, combined);
  alpha = combined;
  gl_FragColor = vec4(color, alpha * vAlpha * uOpacity);
  if (gl_FragColor.a < 0.004) discard;
  #include <colorspace_fragment>
}
`;

interface Attributes {
  center: THREE.InstancedBufferAttribute;
  screen: THREE.InstancedBufferAttribute;
  cell: THREE.InstancedBufferAttribute;
  rim: THREE.InstancedBufferAttribute;
  glow: THREE.InstancedBufferAttribute;
  alpha: THREE.InstancedBufferAttribute;
}

interface Batch {
  geometry: THREE.BufferGeometry;
  attributes: Attributes;
  solid: THREE.InstancedMesh;
  ghost: THREE.InstancedMesh;
  capacity: number;
}

interface Uniforms {
  uAtlas: { value: THREE.Texture };
  uViewport: { value: THREE.Vector2 };
  uMargin: { value: number };
  uCell: { value: number };
  uInset: { value: number };
  uOpacity: { value: number };
  uAlphaShape: { value: number };
}

export default class TokenLayer {
  readonly group = new THREE.Group();
  readonly atlas = new TokenAtlas();
  private batches = new Map<Exclude<TokenKind, "lock">, Batch>();
  private inputs: TokenInput[] = [];
  private placed: Placed[] = [];
  private solidUniforms: Uniforms;
  private ghostUniforms: Uniforms;
  private solidMaterial: THREE.ShaderMaterial;
  private ghostMaterial: THREE.ShaderMaterial;
  private color = new THREE.Color("#ffffff");
  private view = new THREE.Vector3();
  private touch: boolean;
  private disposed = false;

  constructor() {
    this.group.name = "Strategic tokens";
    this.touch = coarsePointer();
    const uniforms = (opacity: number): Uniforms => ({
      uAtlas: { value: this.atlas.texture },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uMargin: { value: MARGIN },
      uCell: { value: 1 / this.atlas.grid },
      uInset: { value: ATLAS_GUTTER / (ATLAS_CELL * this.atlas.grid) },
      uOpacity: { value: opacity },
      uAlphaShape: { value: 0 }
    });
    this.solidUniforms = uniforms(1);
    this.ghostUniforms = uniforms(TOKEN_OCCLUDED_OPACITY);
    const material = (values: Uniforms, depthTest: boolean, name: string): THREE.ShaderMaterial => {
      const value = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: values as unknown as Record<string, { value: unknown }>, transparent: true, depthWrite: false });
      value.depthTest = depthTest;
      value.toneMapped = false;
      value.name = name;
      return value;
    };
    this.solidMaterial = material(this.solidUniforms, true, "strategic-token");
    this.ghostMaterial = material(this.ghostUniforms, false, "strategic-token-occluded");
  }

  /** Touch-sized tokens (48/34/40 px) instead of desktop (40/28/34 px). */
  setTouch(touch: boolean): void {
    this.touch = touch;
  }

  begin(): void {
    this.inputs.length = 0;
    this.atlas.beginFrame();
  }

  add(token: TokenInput): void {
    if (this.disposed || token.opacity <= 0.001 || token.scale <= 0.001) return;
    this.inputs.push(token);
  }

  /**
   * Project, separate (≤ 24 px push) and upload the frame's tokens. Call
   * after the camera matrices are final and before rendering. `distance` is
   * the orbit distance used for the band (anchor lift in ground/local).
   */
  end(camera: THREE.PerspectiveCamera, width: number, height: number, distance: number): void {
    if (this.disposed) return;
    const lift = bandOf(distance) == "ground" || bandOf(distance) == "local" ? TOKEN_CLOSE_LIFT_METRES / METRES_PER_UNIT : 0;
    this.placed = [];
    for (const token of this.inputs) {
      const anchor = this.view.copy(token.position);
      anchor.y += lift;
      const viewZ = anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const projected = anchor.project(camera);
      if (viewZ >= 0 || projected.z < -1 || projected.z > 1) continue;
      const size = tokenPixels(token.kind, this.touch) * token.scale;
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      if (x < -size || x > width + size || y < -size || y > height + size) continue;
      this.placed.push({ ...token, position: token.position.clone().setY(token.position.y + lift), x, y, depth: -viewZ, size, dx: 0, dy: 0 });
    }
    const discs: TokenDisc[] = this.placed.map(p => ({ x: p.x, y: p.y, r: p.size / 2, dx: 0, dy: 0 }));
    separate(discs, TOKEN_MAX_PUSH);
    discs.forEach((disc, i) => { this.placed[i].dx = disc.dx; this.placed[i].dy = disc.dy; });
    // Far first, so the nearest token of a kind wins an overlap.
    this.placed.sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
    this.atlas.reserve(this.placed.map(token => token.face));
    const viewport = new THREE.Vector2(width, height);
    [this.solidUniforms, this.ghostUniforms].forEach(uniforms => {
      uniforms.uViewport.value.copy(viewport);
      uniforms.uCell.value = 1 / this.atlas.grid;
      uniforms.uInset.value = ATLAS_GUTTER / (ATLAS_CELL * this.atlas.grid);
    });
    // RTC: buffers relative to the camera; the meshes carry the camera position.
    const base = camera.position;
    for (const kind of KINDS) {
      const tokens = this.placed.filter(p => p.kind == kind);
      const batch = tokens.length ? this.batch(kind, tokens.length) : this.batches.get(kind);
      if (!batch) continue;
      const { center, screen, cell, rim, glow, alpha } = batch.attributes;
      tokens.forEach((token, i) => {
        center.setXYZ(i, token.position.x - base.x, token.position.y - base.y, token.position.z - base.z);
        screen.setXYZW(i, token.dx, token.dy, token.size, Math.max(0.04, Math.abs(token.flip)));
        const uv = this.atlas.cell(token.face);
        cell.setXY(i, uv.u, uv.v);
        this.color.set(token.color);
        rim.setXYZ(i, this.color.r, this.color.g, this.color.b);
        if (token.highlight) {
          this.color.set(token.highlight);
          glow.setXYZW(i, this.color.r, this.color.g, this.color.b, 1);
        } else glow.setXYZW(i, 0, 0, 0, 0);
        alpha.setX(i, uv.ready ? Math.min(1, token.opacity) : 0);
      });
      [center, screen, cell, rim, glow, alpha].forEach(attribute => { attribute.needsUpdate = true; });
      batch.solid.count = batch.ghost.count = tokens.length;
      batch.solid.visible = batch.ghost.visible = tokens.length > 0;
      batch.solid.position.copy(base);
      batch.ghost.position.copy(base);
    }
  }

  private batch(kind: Exclude<TokenKind, "lock">, count: number): Batch {
    let batch = this.batches.get(kind);
    if (batch && batch.capacity >= count) return batch;
    const capacity = Math.max(32, 2 ** Math.ceil(Math.log2(count)));
    const geometry = new THREE.PlaneGeometry(2, 2);
    const attribute = (name: string, size: number): THREE.InstancedBufferAttribute => {
      const value = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
      value.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, value);
      return value;
    };
    const attributes: Attributes = {
      center: attribute("aCenter", 3), screen: attribute("aScreen", 4), cell: attribute("aCell", 2),
      rim: attribute("aRim", 3), glow: attribute("aGlow", 4), alpha: attribute("aAlpha", 1)
    };
    if (batch) {
      this.group.remove(batch.solid, batch.ghost);
      batch.solid.dispose(); batch.ghost.dispose();
      batch.geometry.dispose();
    }
    const mesh = (material: THREE.ShaderMaterial, order: number, name: string): THREE.InstancedMesh => {
      const value = new THREE.InstancedMesh(geometry, material, capacity);
      value.name = name;
      value.onBeforeRender = () => {
        const shader = material as THREE.ShaderMaterial & { uniforms: Uniforms; uniformsNeedUpdate: boolean };
        shader.uniforms.uAlphaShape.value = kind == "power" || kind == "garrison" ? 1 : 0;
        shader.uniformsNeedUpdate = true;
      };
      value.count = 0;
      value.frustumCulled = false;
      value.renderOrder = order;
      value.castShadow = value.receiveShadow = false;
      this.group.add(value);
      return value;
    };
    batch = {
      geometry,
      attributes,
      ghost: mesh(this.ghostMaterial, RENDER_ORDER[kind] - 0.5, `Strategic tokens: ${kind} (occluded)`),
      solid: mesh(this.solidMaterial, RENDER_ORDER[kind], `Strategic tokens: ${kind}`),
      capacity
    };
    this.batches.set(kind, batch);
    return batch;
  }

  /** Hide every batch (World ×20 inactive, ocean camera, Table). */
  hide(): void {
    this.placed = [];
    this.batches.forEach(batch => { batch.solid.visible = batch.ghost.visible = false; batch.solid.count = batch.ghost.count = 0; });
  }

  /**
   * Token under a CSS pixel of the canvas, with a ≥ 44 px target. Orders
   * win over other kinds, then the nearest centre.
   */
  pick(x: number, y: number, accept: (id: string) => boolean = () => true): string | null {
    let best: Placed | null = null, bestScore = Infinity;
    for (const token of this.placed) {
      if (!token.pickable || !accept(token.id)) continue;
      const radius = Math.max(TOKEN_HIT_PIXELS, token.size) / 2;
      const distance = Math.hypot(x - (token.x + token.dx), y - (token.y + token.dy));
      if (distance > radius) continue;
      const score = distance - (token.kind == "order" ? 1000 : 0);
      if (score < bestScore) { best = token; bestScore = score; }
    }
    return best?.id ?? null;
  }

  /** Screen rectangles of the drawn tokens (labels step around them). */
  rects(): { left: number; top: number; right: number; bottom: number }[] {
    return this.placed.map(token => {
      const r = token.size / 2, x = token.x + token.dx, y = token.y + token.dy;
      return { left: x - r, right: x + r, top: y - r, bottom: y + r };
    });
  }

  /** Drawn screen centre of a token (tooltips, focus rings), if on screen. */
  screenPoint(id: string): { x: number; y: number } | null {
    const token = this.placed.find(candidate => candidate.id == id);
    return token ? { x: token.x + token.dx, y: token.y + token.dy } : null;
  }

  /** Draw calls this layer adds now (2 per visible kind). */
  get draws(): number {
    let draws = 0;
    this.batches.forEach(batch => { if (batch.solid.visible) draws += 2; });
    return draws;
  }

  get count(): number {
    return this.placed.length;
  }

  dispose(): void {
    this.disposed = true;
    this.group.parent?.remove(this.group);
    this.batches.forEach(batch => { batch.solid.dispose(); batch.ghost.dispose(); batch.geometry.dispose(); });
    this.batches.clear();
    this.solidMaterial.dispose();
    this.ghostMaterial.dispose();
    this.atlas.dispose();
  }
}

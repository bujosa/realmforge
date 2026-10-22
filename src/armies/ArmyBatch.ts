import * as THREE from "three";
import { paintSigil } from "../heraldry";
import { sigilIdentity } from "../heraldry/sources";
import { armyGeometry } from "./geometry";
import { armyMaterial, contactMaterial, type ArmyUniforms } from "./material";
import { armyTypes, type ArmyBatchOptions, type ArmyOptions, type ArmyPoint, type ArmyState, type ArmyStateOptions, type ArmyType } from "./types";

const weightIndex: Partial<Record<ArmyState, number>> = { march: 0, attack: 1, charge: 2, defend: 3, rout: 4, retreat: 4, wounded: 5, destroyed: 6, victory: 7 };
const radius: Record<ArmyType, number> = { footman: 0.63, knight: 0.89, "siege-engine": 0.87, ship: 0.95, dragon: 1.12 };
const stateCount = 8;

class Pool {
  readonly mesh: THREE.InstancedMesh;
  readonly contact: THREE.InstancedMesh;
  readonly units: ArmyUnit[] = [];
  readonly a: THREE.InstancedBufferAttribute;
  readonly b: THREE.InstancedBufferAttribute;
  readonly meta: THREE.InstancedBufferAttribute;
  readonly params: THREE.InstancedBufferAttribute;
  constructor(readonly type: ArmyType, readonly far: boolean, capacity: number, detail: NonNullable<ArmyBatchOptions["detail"]>, material: THREE.Material, groundMaterial: THREE.Material) {
    const geometry = armyGeometry(type, detail, far);
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.b = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.meta = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.params = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("poseA", this.a); geometry.setAttribute("poseB", this.b); geometry.setAttribute("meta", this.meta); geometry.setAttribute("params", this.params);
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.name = `army-${type}-${far ? "far" : "near"}`;
    const ground = new THREE.PlaneGeometry(radius[type] * 2, radius[type] * 2).rotateX(-Math.PI / 2).translate(0, 0.008, 0);
    ground.setAttribute("meta", this.meta); ground.setAttribute("params", this.params); ground.setAttribute("poseB", this.b);
    this.contact = new THREE.InstancedMesh(ground, groundMaterial, capacity);
    this.contact.instanceMatrix = this.mesh.instanceMatrix; this.contact.instanceColor = this.mesh.instanceColor;
    this.contact.count = 0; this.contact.frustumCulled = false; this.contact.renderOrder = 1;
  }
  write(unit: ArmyUnit, matrix: THREE.Matrix4): void {
    const i = unit.slot;
    this.mesh.setMatrixAt(i, matrix); this.mesh.setColorAt(i, unit.color);
    this.a.setXYZW(i, unit.weights[0], unit.weights[1], unit.weights[2], unit.weights[3]);
    this.b.setXYZW(i, unit.weights[4], unit.weights[5], unit.weights[6], unit.weights[7]);
    this.meta.setXYZW(i, unit.tile, unit.seed, unit.wounded ? 1 : 0, unit.selected ? 1 : 0);
    this.params.setXYZW(i, unit.plinth ? 1 : 0, unit.deathProgress, unit.type === "ship" ? 1 : 0, 0);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.a.needsUpdate = this.b.needsUpdate = this.meta.needsUpdate = this.params.needsUpdate = true;
    this.mesh.count = this.contact.count = this.units.length;
    this.mesh.boundingBox = this.contact.boundingBox = null;
    this.mesh.boundingSphere = this.contact.boundingSphere = null;
  }
  dispose(): void { this.units.length = 0; this.mesh.count = this.contact.count = 0; this.mesh.geometry.dispose(); this.contact.geometry.dispose(); this.mesh.dispose(); this.contact.dispose(); }
}

/** A lightweight company handle; transforms are in batch-local coordinates. */
export class ArmyUnit {
  readonly position = new THREE.Vector3();
  readonly color: THREE.Color;
  readonly type: ArmyType;
  readonly seed: number;
  readonly tile: number;
  readonly plinth: boolean;
  lod: "auto" | "near" | "far";
  readonly weights = new Float32Array(stateCount);
  readonly from = new Float32Array(stateCount);
  readonly target = new Float32Array(stateCount);
  heading: number;
  scale: number;
  selected = false;
  wounded = false;
  state: ArmyState = "idle";
  slot = 0;
  pool!: Pool;
  removed = false;
  deathProgress = 0;
  deathFrom = 0;
  transitionStart = 0;
  transitionDuration = 0.3;
  stateStart = 0;
  path: readonly ArmyPoint[] | undefined;
  pathLengths: Float64Array | undefined;
  pathLength = 0;
  pathDuration = 1;
  pathStart = 0;
  pathReverse = false;

  constructor(readonly batch: ArmyBatch, options: ArmyOptions, tile: number) {
    this.type = options.type; this.color = new THREE.Color(options.color);
    this.tile = tile; this.seed = options.seed ?? batch.nextSeed++;
    this.heading = options.heading ?? 0; this.scale = options.scale ?? 1;
    if (!Number.isFinite(this.scale) || this.scale <= 0) throw new Error("Army scale must be positive and finite");
    this.plinth = options.plinth ?? options.presentation === "table";
    this.lod = options.lod ?? "auto";
    if (options.position) this.position.set(options.position.x, options.position.y ?? 0, options.position.z);
  }
  setState(state: ArmyState, options: ArmyStateOptions = {}): this {
    if (this.removed) return this;
    if (!(state === "idle" || state in weightIndex)) throw new Error(`Unknown army state: ${state}`);
    this.deathFrom = this.deathProgress;
    this.state = state; this.stateStart = this.batch.time;
    this.from.set(this.weights); this.target.fill(0);
    const index = weightIndex[state];
    if (index !== undefined) this.target[index] = 1;
    this.transitionStart = this.batch.time;
    this.transitionDuration = Math.max(0, options.transition ?? 0.3);
    this.path = undefined; this.pathLengths = undefined;
    this.pathReverse = state === "rout" || state === "retreat";
    if (options.path && options.path.length >= 2) {
      // Copy on a cue, never in update: host mutation cannot bend an active path.
      this.path = options.path.map(p => ({ x: p.x, y: p.y ?? 0, z: p.z }));
      this.pathLengths = new Float64Array(this.path.length);
      this.pathLength = 0;
      for (let i = 1; i < this.path.length; i++) {
        const a = this.path[i - 1], b = this.path[i];
        this.pathLength += Math.hypot(b.x - a.x, (b.y ?? 0) - (a.y ?? 0), b.z - a.z);
        this.pathLengths[i] = this.pathLength;
      }
      this.pathStart = this.batch.time; this.pathDuration = Math.max(0.001, options.duration ?? 1.8);
    }
    if (this.batch.motionScale === 0 || this.transitionDuration === 0) this.weights.set(this.target);
    if (this.batch.motionScale === 0) this.from.set(this.target);
    return this;
  }
  setWounded(value: boolean): this { this.wounded = value; return this; }
  setSelected(value: boolean): this { this.selected = value; return this; }
  remove(): void { this.batch.remove(this); }
}

/**
 * Two instanced LOD pools per type, one shared lit material and one contact pass.
 * No scene nodes, materials, timers or CPU animation jobs per soldier.
 */
export class ArmyBatch {
  readonly object = new THREE.Group();
  readonly detail: NonNullable<ArmyBatchOptions["detail"]>;
  readonly capacityPerType: number;
  readonly units: ArmyUnit[] = [];
  nextSeed = 1;
  time = 0;
  motionScale = 1;
  paused = false;
  private disposed = false;
  private readonly pools = new Map<ArmyType, [Pool, Pool]>();
  private readonly canvas = document.createElement("canvas");
  private readonly atlas: THREE.CanvasTexture;
  private readonly tiles = new Map<string, number>();
  private readonly uniforms: ArmyUniforms;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly groundMaterial = contactMaterial();
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scaleVector = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly cameraPosition = new THREE.Vector3();
  private readonly unitWorld = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();

  constructor(options: ArmyBatchOptions = {}) {
    this.detail = options.detail ?? "balanced"; this.capacityPerType = options.capacityPerType ?? 128;
    if (!Number.isInteger(this.capacityPerType) || this.capacityPerType < 1) throw new Error("Army capacity must be a positive integer");
    this.canvas.width = this.canvas.height = 1024;
    this.atlas = new THREE.CanvasTexture(this.canvas);
    this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.atlas.anisotropy = Math.min(4, options.renderer?.capabilities.getMaxAnisotropy() ?? 1);
    this.uniforms = { time: { value: 0 }, motion: { value: 1 }, atlas: { value: this.atlas } };
    this.material = armyMaterial(this.uniforms);
    for (const type of armyTypes) {
      const pair: [Pool, Pool] = [new Pool(type, false, this.capacityPerType, this.detail, this.material, this.groundMaterial), new Pool(type, true, this.capacityPerType, this.detail, this.material, this.groundMaterial)];
      this.pools.set(type, pair);
      for (const pool of pair) this.object.add(pool.mesh, pool.contact);
    }
    this.object.name = "Realmforge armies";
  }
  private tile(house: string): number {
    const identity = sigilIdentity(house), existing = this.tiles.get(identity);
    if (existing !== undefined) return existing;
    const index = this.tiles.size;
    if (index >= 64) throw new Error("One army batch supports 64 registered sigils");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Army heraldry requires a 2D canvas context");
    paintSigil(ctx, identity, (index % 8 + 0.5) * 128, (Math.floor(index / 8) + 0.5) * 128, 110, "#ffffff", true);
    this.tiles.set(identity, index); this.atlas.needsUpdate = true;
    return index;
  }
  add(options: ArmyOptions): ArmyUnit {
    if (this.disposed) throw new Error("ArmyBatch has been disposed");
    const pair = this.pools.get(options.type);
    if (!pair) throw new Error(`Unknown army type: ${options.type}`);
    if (pair[0].units.length + pair[1].units.length >= this.capacityPerType) throw new Error(`Army capacity exceeded for ${options.type}`);
    const unit = new ArmyUnit(this, options, this.tile(options.house ?? "neutral"));
    const pool = pair[options.lod === "far" || this.detail === "low" ? 1 : 0];
    unit.pool = pool; unit.slot = pool.units.length; pool.units.push(unit); this.units.push(unit);
    this.write(unit);
    return unit;
  }
  remove(unit: ArmyUnit): void {
    if (unit.batch !== this || unit.removed) return;
    this.detach(unit);
    const index = this.units.indexOf(unit);
    if (index >= 0) { this.units[index] = this.units[this.units.length - 1]; this.units.pop(); }
    unit.removed = true; unit.path = undefined; unit.pathLengths = undefined;
  }
  private detach(unit: ArmyUnit): void {
    const pool = unit.pool, last = pool.units.pop();
    if (last && last !== unit) { pool.units[unit.slot] = last; last.slot = unit.slot; this.write(last); }
    pool.mesh.count = pool.contact.count = pool.units.length;
    pool.mesh.boundingBox = pool.contact.boundingBox = null;
    pool.mesh.boundingSphere = pool.contact.boundingSphere = null;
  }
  private write(unit: ArmyUnit): void {
    this.quaternion.setFromAxisAngle(this.axis, unit.heading + (unit.pathReverse && !unit.path ? Math.PI * unit.weights[4] : 0));
    this.scaleVector.setScalar(unit.scale);
    this.matrix.compose(unit.position, this.quaternion, this.scaleVector);
    unit.pool.write(unit, this.matrix);
  }
  setMotionScale(value: number): void {
    this.motionScale = Math.max(0, Math.min(2, Number.isFinite(value) ? value : 0));
    this.uniforms.motion.value = this.motionScale > 0 ? 1 : 0;
    if (!this.motionScale) for (const unit of this.units) { unit.weights.set(unit.target); unit.from.set(unit.target); }
  }
  setPaused(value: boolean): void { this.paused = value; }
  /** Explicit clock; no RAF/timers. Optional camera chooses LOD with hysteresis. */
  update(deltaSeconds: number, camera?: THREE.PerspectiveCamera): void {
    if (this.disposed || this.paused) return;
    const delta = Number.isFinite(deltaSeconds) ? Math.min(0.1, Math.max(0, deltaSeconds)) : 0;
    this.time += delta * this.motionScale;
    this.uniforms.time.value = this.time;
    if (camera) {
      this.object.updateWorldMatrix(true, false);
      camera.getWorldPosition(this.cameraPosition);
      this.object.getWorldScale(this.worldScale);
    }
    for (let u = 0; u < this.units.length; u++) {
      const unit = this.units[u];
      const linear = this.motionScale === 0 || unit.transitionDuration === 0 ? 1 : Math.min(1, (this.time - unit.transitionStart) / Math.max(0.001, unit.transitionDuration));
      const blend = linear * linear * (3 - 2 * linear);
      for (let i = 0; i < stateCount; i++) unit.weights[i] = unit.from[i] + (unit.target[i] - unit.from[i]) * blend;
      unit.deathProgress = unit.state === "destroyed"
        ? this.motionScale === 0 ? 1 : unit.deathFrom + (1 - unit.deathFrom) * Math.min(1, (this.time - unit.stateStart) / 1.4)
        : unit.deathFrom * (1 - blend);
      // Settle reduced-motion cues permanently: re-enabling motion must not
      // rewind a completed path, resurrect a faded unit or replay a transition.
      if (this.motionScale === 0) {
        unit.from.set(unit.target); unit.deathFrom = unit.deathProgress;
        unit.stateStart = this.time - 1.4;
        if (unit.path) unit.pathStart = this.time - unit.pathDuration;
      }
      if (unit.path && unit.pathLengths) {
        const progress = this.motionScale === 0 ? 1 : Math.min(1, (this.time - unit.pathStart) / unit.pathDuration);
        const distance = progress * unit.pathLength;
        let segment = 1;
        while (segment < unit.path.length - 1 && unit.pathLengths[segment] < distance) segment++;
        const a = unit.path[segment - 1], b = unit.path[segment];
        const length = unit.pathLengths[segment] - unit.pathLengths[segment - 1];
        const t = length ? (distance - unit.pathLengths[segment - 1]) / length : 1;
        unit.position.set(a.x + (b.x - a.x) * t, (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * t, a.z + (b.z - a.z) * t);
        if (length) {
          const target = Math.atan2(-(b.x - a.x), -(b.z - a.z));
          const difference = Math.atan2(Math.sin(target - unit.heading), Math.cos(target - unit.heading));
          unit.heading += difference * (this.motionScale === 0 ? 1 : Math.min(1, delta * this.motionScale * 14));
        }
      }
      if (camera || unit.lod !== "auto") {
        this.unitWorld.copy(unit.position).applyMatrix4(this.object.matrixWorld);
        const d = Math.sqrt(this.cameraPosition.distanceToSquared(this.unitWorld));
        const apparent = unit.scale * Math.max(this.worldScale.x, this.worldScale.z) * radius[unit.type] * 2 * (camera?.zoom ?? 1) / Math.max(0.01, d * 2 * Math.tan((camera?.fov ?? 38) * Math.PI / 360));
        const pair = this.pools.get(unit.type)!;
        const far = this.detail === "low" || unit.lod === "far" || (unit.lod === "auto" && (unit.pool.far ? apparent < 0.105 : apparent < 0.075));
        const pool = pair[far ? 1 : 0];
        if (pool !== unit.pool) { this.detach(unit); unit.pool = pool; unit.slot = pool.units.length; pool.units.push(unit); }
      }
      this.write(unit);
    }
  }
  /** Supply the actual lit scene to avoid a second light-layout shader variant. */
  async warmup(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene?: THREE.Scene): Promise<void> {
    await renderer.compileAsync(this.object, camera, scene);
  }
  get stats(): { companies: number; draws: number; triangles: number } {
    let draws = 0, triangles = 0;
    for (const pair of this.pools.values()) for (const pool of pair) if (pool.units.length) {
      draws += 2;
      const g = pool.mesh.geometry;
      triangles += pool.units.length * ((g.index?.count ?? g.getAttribute("position").count) / 3 + 2);
    }
    return { companies: this.units.length, draws, triangles };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unit of this.units) { unit.removed = true; unit.path = undefined; unit.pathLengths = undefined; }
    this.units.length = 0;
    for (const pair of this.pools.values()) for (const pool of pair) pool.dispose();
    this.pools.clear(); this.object.clear(); this.material.dispose(); this.groundMaterial.dispose(); this.atlas.dispose();
    this.canvas.width = this.canvas.height = 1;
  }
}

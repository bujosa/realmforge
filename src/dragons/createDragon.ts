import * as THREE from "three";
import { buildDragonGeometry, countTriangles, snoutRest } from "./mesh";
import { createDragonMaterial, createDragonUniforms, DragonUniforms } from "./material";
import { DragonFlightController } from "./motion";
import { dragonPalette } from "./palette";
import { BONE, DragonRig, MODEL_SCALE } from "./rig";
import type {
  CreateDragonOptions,
  FireBreathHandler,
  FireBreathPayload,
  LivingDragon,
  DragonStats
} from "./types";

class ProceduralDragon implements LivingDragon {
  readonly object = new THREE.Group();
  private readonly mesh: THREE.SkinnedMesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly skeleton: THREE.Skeleton;
  private readonly rig = new DragonRig();
  private readonly uniforms: DragonUniforms;
  private readonly flight = new DragonFlightController();
  private readonly house: string;
  private readonly tier: "high" | "balanced";
  private readonly triangles: number;
  private reducedMotion: boolean;
  private paused = false;
  private disposed = false;
  private fireHandler: FireBreathHandler | null = null;
  private readonly snout = snoutRest();
  private readonly breathOrigin = new THREE.Vector3();
  private readonly breathDir = new THREE.Vector3();
  private breathPulse = 0;

  constructor(options: CreateDragonOptions & { tier: "high" | "balanced" }) {
    this.house = options.house;
    this.tier = options.tier;
    this.reducedMotion =
      options.reducedMotion ??
      (typeof matchMedia == "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches);

    const palette = options.palette ?? dragonPalette(options.house);
    const built = buildDragonGeometry(options.tier, palette);
    this.geometry = built.geometry;
    this.triangles = built.triangles;
    this.uniforms = createDragonUniforms(palette);
    this.material = createDragonMaterial(this.uniforms, options.tier);
    // One SkinnedMesh draw: skinning runs in the vertex shader from a tiny
    // bone texture; bones are posed by our own FK (rig.ts), no mixer.
    this.mesh = new THREE.SkinnedMesh(this.geometry, this.material);
    this.mesh.scale.setScalar(MODEL_SCALE);
    this.mesh.add(...this.rig.bones);
    this.mesh.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.rig.bones);
    this.mesh.bind(this.skeleton);
    this.mesh.castShadow = false; // GPU poses must not invalidate cached scene shadows.
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = true;
    // Rest geometry has the wings spread (largest extent); flapping stays
    // within this sphere, so it never needs a per-frame skinned recompute.
    const sphere = this.geometry.boundingSphere?.clone() ?? null;
    if (sphere) sphere.radius *= 1.25;
    if (sphere) this.mesh.boundingSphere = sphere;
    this.object.add(this.mesh);
    this.object.name = `dragon-${options.house}`;
    this.object.userData.dragon = true;
    this.object.userData.house = options.house;
    this.object.userData.tier = options.tier;
    const positions = this.geometry.getAttribute("position");
    let left = Infinity, right = -Infinity;
    for (let i = 0; i < positions.count; i++) { left = Math.min(left, positions.getX(i)); right = Math.max(right, positions.getX(i)); }
    this.object.userData.wingspan = (right - left) * MODEL_SCALE;

    // Start in the grounded wyvern stance, even if paused before any update.
    this.rig.apply(this.flight.pose);
    this.object.updateMatrixWorld(true);
    this.object.userData.sole = this.groundedSole();
  }

  /** Lowest skinned vertex of the grounded pose, in object units. */
  private groundedSole(): number {
    const positions = this.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    let sole = Infinity;
    for (let i = 0; i < positions.count; i++) {
      v.set(positions.getX(i), positions.getY(i), positions.getZ(i));
      this.mesh.applyBoneTransform(i, v);
      sole = Math.min(sole, v.y);
    }
    return Number.isFinite(sole) ? sole * MODEL_SCALE : 0;
  }

  patrol(center: THREE.Vector3, radius: number, altitude: number): void {
    if (this.disposed) return;
    this.flight.patrolTo(center, radius, altitude);
  }

  flyTo(pos: THREE.Vector3, durationMs: number): void {
    if (this.disposed) return;
    this.flight.flyTo(pos, durationMs);
  }

  land(pos: THREE.Vector3): void {
    if (this.disposed) return;
    this.flight.landAt(pos);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setAirborne(airborne: boolean): void {
    if (this.disposed) return;
    this.flight.articulate(airborne && !this.reducedMotion);
  }

  setFireBreathHandler(handler: FireBreathHandler | null): void {
    this.fireHandler = handler;
  }

  breathFire(): void {
    if (this.disposed || this.paused || this.reducedMotion || (typeof document != "undefined" && document.hidden) || !this.fireHandler) return;
    this.breathPulse = 1;
    // Snout tip and head direction from the current pose, in world space.
    this.object.updateMatrixWorld(true);
    this.rig.attached(BONE.head, this.snout, this.breathOrigin);
    this.rig.forward(BONE.head, this.breathDir);
    this.breathOrigin.applyMatrix4(this.mesh.matrixWorld);
    this.breathDir.transformDirection(this.mesh.matrixWorld);
    this.breathDir.y = Math.max(this.breathDir.y, -0.2);
    const payload: FireBreathPayload = {
      origin: this.breathOrigin.clone(),
      direction: this.breathDir.clone().normalize(),
      house: this.house
    };
    this.fireHandler(payload);
  }

  update(dtMs: number): void {
    if (this.disposed) return;
    // Hidden tab / explicit pause: no time advance (caller may still tick).
    if (this.paused || (typeof document != "undefined" && document.hidden)) {
      return;
    }
    const sample = this.flight.sample(dtMs, this.reducedMotion);
    this.object.position.copy(sample.position);
    this.object.rotation.y = sample.heading;
    this.object.rotation.z = sample.bank * 0.65;
    this.object.rotation.x = 0;

    this.breathPulse = Math.max(0, this.breathPulse - dtMs / 900);
    const pose = sample.pose;
    pose.jaw = Math.max(pose.jaw, Math.min(1, this.breathPulse * 1.6));
    this.uniforms.fire.value = this.breathPulse;
    this.uniforms.fold.value = pose.fold;
    this.rig.apply(pose);
  }

  stats(): DragonStats {
    return {
      tier: this.tier,
      triangles: this.triangles || countTriangles(this.geometry),
      drawCalls: this.disposed ? 0 : 1,
      bones: this.skeleton.bones.length,
      state: this.flight.state,
      disposed: this.disposed
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fireHandler = null;
    this.object.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.skeleton.dispose();
    if (this.object.parent) {
      this.object.parent.remove(this.object);
    }
  }
}

/**
 * Build a living procedural dragon, or null on Low (use existing static figurine).
 */
export function createDragon(
  options: CreateDragonOptions
): LivingDragon | null {
  if (options.tier == "low") {
    return null;
  }
  return new ProceduralDragon({
    house: options.house,
    palette: options.palette,
    tier: options.tier,
    reducedMotion: options.reducedMotion
  });
}

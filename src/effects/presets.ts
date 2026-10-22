import * as THREE from "three";
import { createInstancedVfx, Particle, VfxHandle, VfxOptions } from "./InstancedVfx";

export type { VfxHandle, VfxOptions, VfxStats } from "./InstancedVfx";

export interface PointCue { origin: THREE.Vector3; direction?: THREE.Vector3; color?: string | number }
export interface PathCue { from: THREE.Vector3; to: THREE.Vector3; color?: string | number }
export interface SiegeCue extends PointCue { burning?: boolean }
export interface ShipCue extends PathCue { sinking?: boolean }
export interface DragonFireCue extends PathCue { width?: number }

const GOLD = new THREE.Color("#e9aa57");
const DUST = new THREE.Color("#a89479");
const SMOKE = new THREE.Color("#514d4a");
const FOAM = new THREE.Color("#b6dedc");
const FIRE = new THREE.Color("#ed7437");
function rnd(i: number, salt = 0): number {
  const x = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function direction(value?: THREE.Vector3): THREE.Vector3 {
  const d = value?.clone() || new THREE.Vector3(1, 0, 0);
  d.y = 0;
  return d.length() > 0.001 ? d.multiplyScalar(1 / d.length()) : new THREE.Vector3(1, 0, 0);
}
function color(value: string | number | undefined, fallback: THREE.Color): THREE.Color {
  return value === undefined ? fallback.clone() : new THREE.Color(value);
}
function sideways(axis: THREE.Vector3): THREE.Vector3 { return new THREE.Vector3(-axis.z, 0, axis.x); }
function offset(base: THREE.Vector3, axis: THREE.Vector3, along: number, lateral: number): THREE.Vector3 {
  return base.clone().add(axis.clone().multiplyScalar(along)).add(sideways(axis).multiplyScalar(lateral));
}
function withY(point: THREE.Vector3, y: number): THREE.Vector3 { point.y = y; return point; }
function blend(from: THREE.Color, to: THREE.Color, t: number): THREE.Color { return from.clone().lerpColors(from, to, t); }

/** Charge impact: ground hugging dust. Play only from a fresh public attack. */
export function createChargeDust(options: VfxOptions): VfxHandle<PointCue> | null {
  return createInstancedVfx(options, { high: 96, balanced: 32 }, ({ origin, direction: toward, color: tint }, count) => {
    const axis = direction(toward), base = color(tint, DUST);
    return Array.from({ length: count }, (_, i): Particle => ({
      origin: offset(origin, axis, rnd(i, 1) * 0.24 - 0.12, (rnd(i, 2) - 0.5) * 0.34),
      velocity: withY(offset(new THREE.Vector3(), axis, 0.10 + rnd(i, 3) * 0.22, (rnd(i, 4) - 0.5) * 0.18), 0.035 + rnd(i, 5) * 0.085),
      color: base.clone().multiplyScalar(0.75 + rnd(i, 6) * 0.3),
      delay: i * 10, lifetime: 550 + rnd(i, 7) * 500,
      size: 0.035, endSize: 0.14 + rnd(i, 8) * 0.07, alpha: 0.27,
    }));
  });
}

/** Neutral sparks; a winner is never implied before the public result. */
export function createMeleeSparks(options: VfxOptions): VfxHandle<PointCue> | null {
  return createInstancedVfx(options, { high: 80, balanced: 24 }, ({ origin, color: tint }, count) => {
    const base = color(tint, GOLD);
    return Array.from({ length: count }, (_, i): Particle => ({
      origin: origin.clone().add(new THREE.Vector3((rnd(i, 1) - 0.5) * 0.20, rnd(i, 2) * 0.10, (rnd(i, 3) - 0.5) * 0.20)),
      velocity: new THREE.Vector3((rnd(i, 4) - 0.5) * 0.42, 0.16 + rnd(i, 5) * 0.28, (rnd(i, 6) - 0.5) * 0.42),
      acceleration: new THREE.Vector3(0, -0.85, 0), color: blend(base, new THREE.Color("#fff4c4"), rnd(i, 7)),
      delay: (i % 4) * 180 + Math.floor(i / 4) * 24, lifetime: 230 + rnd(i, 8) * 300,
      size: 0.022, endSize: 0.007, alpha: 0.92, aspect: 0.16, shape: 1,
      angle: rnd(i, 9) * Math.PI * 2, spin: (rnd(i, 10) - 0.5) * 9,
    }));
  });
}

/** One arc per arrow; both endpoints must have passed the caller's fog check. */
export function createArrowVolley(options: VfxOptions): VfxHandle<PathCue> | null {
  return createInstancedVfx(options, { high: 48, balanced: 16 }, ({ from, to, color: tint }, count) => {
    const axis = direction(to.clone().sub(from));
    const distance = from.distanceTo(to), base = color(tint, new THREE.Color("#c3b59b"));
    return Array.from({ length: count }, (_, i): Particle => {
      const spread = (rnd(i, 1) - 0.5) * 0.25;
      return {
        origin: offset(from, axis, (rnd(i, 2) - 0.5) * 0.10, spread).add(new THREE.Vector3(0, 0.07, 0)),
        velocity: to.clone().sub(from).multiplyScalar(1000 / (820 + (i % 4) * 90)),
        color: base, delay: i * 29, lifetime: 820 + (i % 4) * 90,
        size: 0.075, aspect: 0.10, alpha: 0.95, shape: 1,
        arc: Math.max(0.16, distance * 0.24), angle: Math.atan2(axis.z, axis.x) - Math.PI / 2,
      };
    });
  });
}

/** Small falling cloth fragments around the existing emblem bearing banner. */
export function createBannerFall(options: VfxOptions): VfxHandle<PointCue> | null {
  return createInstancedVfx(options, { high: 12, balanced: 4 }, ({ origin, color: tint }, count) => {
    const base = color(tint, DUST);
    return Array.from({ length: count }, (_, i): Particle => ({
      origin: origin.clone().add(new THREE.Vector3((rnd(i, 1) - 0.5) * 0.07, 0.08 + rnd(i, 2) * 0.12, (rnd(i, 3) - 0.5) * 0.07)),
      velocity: new THREE.Vector3((rnd(i, 4) - 0.5) * 0.14, -0.12 - rnd(i, 5) * 0.10, (rnd(i, 6) - 0.5) * 0.14),
      color: base, delay: i * 45, lifetime: 500 + rnd(i, 7) * 350,
      size: 0.033 + rnd(i, 8) * 0.014, aspect: 1.6, alpha: 0.70, shape: 2,
      angle: rnd(i, 9) * Math.PI, spin: (rnd(i, 10) - 0.5) * 7,
    }));
  });
}

/** Ephemeral siege impact; burning is opt-in after a public resolved event. */
export function createSiegeSmoke(options: VfxOptions): VfxHandle<SiegeCue> | null {
  return createInstancedVfx(options, { high: 72, balanced: 24 }, ({ origin, burning }, count) =>
    Array.from({ length: count }, (_, i): Particle => {
      const ember = !!burning && i % 6 === 0;
      return {
        origin: origin.clone().add(new THREE.Vector3((rnd(i, 1) - 0.5) * 0.16, rnd(i, 2) * 0.05, (rnd(i, 3) - 0.5) * 0.16)),
        velocity: new THREE.Vector3((rnd(i, 4) - 0.5) * 0.055, 0.07 + rnd(i, 5) * 0.13, (rnd(i, 6) - 0.5) * 0.055),
        color: ember ? FIRE.clone() : SMOKE.clone(), delay: i * 24,
        lifetime: ember ? 500 + rnd(i, 7) * 400 : 1100 + rnd(i, 7) * 800,
        size: ember ? 0.018 : 0.045, endSize: ember ? 0.005 : 0.18,
        alpha: ember ? 0.65 : 0.14, shape: ember ? 4 : 0,
      };
    }));
}

/** Ram foam; sinking foam requires a public ship casualty. */
export function createShipRam(options: VfxOptions): VfxHandle<ShipCue> | null {
  return createInstancedVfx(options, { high: 80, balanced: 28 }, ({ from, to, sinking }, count) => {
    const axis = direction(to.clone().sub(from));
    return Array.from({ length: count }, (_, i): Particle => ({
      origin: offset(to, axis, (rnd(i, 1) - 0.5) * (sinking ? 0.24 : 0.10), (rnd(i, 2) - 0.5) * 0.20),
      velocity: new THREE.Vector3((rnd(i, 3) - 0.5) * 0.24, 0.07 + rnd(i, 4) * 0.13, (rnd(i, 5) - 0.5) * 0.24),
      acceleration: new THREE.Vector3(0, -0.24, 0), color: FOAM.clone(),
      delay: i * (sinking ? 25 : 12), lifetime: 450 + rnd(i, 6) * 500,
      size: 0.020, endSize: 0.075 + rnd(i, 7) * 0.035, alpha: 0.50,
    }));
  });
}

/** C4 hook: cone, embers and ground scorch share one draw and ≤256 quads. */
export function createDragonFire(options: VfxOptions): VfxHandle<DragonFireCue> | null {
  return createInstancedVfx(options, { high: 256, balanced: 80 }, ({ from, to, width }, count) => {
    const axis = direction(to.clone().sub(from));
    const length = from.distanceTo(to);
    const coneWidth = Math.min(0.5, Math.max(0.06, width ?? length * 0.25));
    return Array.from({ length: count }, (_, i): Particle => {
      const decal = i < Math.max(4, Math.floor(count * 0.06));
      const t = decal ? rnd(i, 1) : rnd(i, 2) * 0.9;
      const pos = offset(from, axis, length * t, (rnd(i, 3) - 0.5) * coneWidth * t);
      if (decal) pos.y = to.y + 0.005;
      return {
        origin: pos,
        velocity: decal ? new THREE.Vector3() : withY(offset(new THREE.Vector3(), axis, 0.12 + rnd(i, 4) * 0.26, (rnd(i, 5) - 0.5) * coneWidth), 0.03 + rnd(i, 6) * 0.12),
        color: decal ? new THREE.Color("#332820") : blend(FIRE, GOLD, rnd(i, 7)),
        delay: decal ? 350 : (i % 24) * 20,
        lifetime: decal ? 1700 : 420 + rnd(i, 8) * 500,
        size: decal ? 0.07 : 0.025,
        endSize: decal ? 0.16 : 0.065 + rnd(i, 9) * 0.035,
        alpha: decal ? 0.24 : 0.63,
        shape: decal ? 3 : i % 5 === 0 ? 1 : 4,
        aspect: decal ? 1.5 : 1,
      };
    });
  });
}

/** Follows only the public retreat route supplied by BattleStage. */
export function createRetreatDust(options: VfxOptions): VfxHandle<PathCue> | null {
  return createInstancedVfx(options, { high: 96, balanced: 32 }, ({ from, to }, count) => {
    const axis = direction(to.clone().sub(from));
    const length = from.distanceTo(to);
    return Array.from({ length: count }, (_, i): Particle => ({
      origin: offset(from, axis, length * rnd(i, 1), (rnd(i, 2) - 0.5) * 0.14),
      velocity: withY(offset(new THREE.Vector3(), axis, 0.04 + rnd(i, 3) * 0.10, (rnd(i, 4) - 0.5) * 0.05), 0.03 + rnd(i, 5) * 0.05),
      color: DUST.clone(), delay: i * 18, lifetime: 650 + rnd(i, 6) * 500,
      size: 0.030, endSize: 0.13, alpha: 0.22,
    }));
  });
}

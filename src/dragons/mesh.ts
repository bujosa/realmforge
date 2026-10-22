import * as THREE from "three";
import type { DragonPalette, DragonTier } from "./types";
import {
  BONE,
  BONE_COUNT,
  FINGERS,
  LEG,
  SIDES,
  SNOUT,
  Side,
  TAIL_TIP,
  WING,
  joint,
  legBone,
  drapeBone,
  sideSign,
  spineJoint,
  thumbBone,
  wingBone
} from "./rig";

/**
 * Surface kinds packed in dragonSurface.z for material.ts. Skin stores its
 * belly factor in [0, 0.4]; everything else is an integer code.
 */
export const KIND_MEMBRANE = 1;
export const KIND_HORN = 2;
export const KIND_EYE = 3;
export const KIND_MOUTH = 4;

interface MeshBudget {
  bodyRows: number;
  bodyRadial: number;
  limbRadial: number;
  fingerRadial: number;
  hornRadial: number;
  membraneSpan: number;
  membraneCross: number;
  plates: number;
  teeth: boolean;
}

const BUDGETS: Record<"high" | "balanced", MeshBudget> = {
  high: {
    bodyRows: 66,
    bodyRadial: 20,
    limbRadial: 8,
    fingerRadial: 5,
    hornRadial: 6,
    membraneSpan: 9,
    membraneCross: 4,
    plates: 30,
    teeth: true
  },
  balanced: {
    bodyRows: 30,
    bodyRadial: 10,
    limbRadial: 4,
    fingerRadial: 3,
    hornRadial: 4,
    membraneSpan: 4,
    membraneCross: 2,
    plates: 12,
    teeth: false
  }
};

type Influence = [bone: number, weight: number];

class Builder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly skinIndex: number[] = [];
  readonly skinWeight: number[] = [];
  readonly surface: number[] = [];
  readonly indices: number[] = [];

  get count(): number {
    return this.positions.length / 3;
  }

  /** `dorsal` (0 … 1) selects the scale size in material.ts: big scutes along the spine. */
  vertex(p: THREE.Vector3, color: THREE.Color, influences: Influence[], su: number, sv: number, kind: number, dorsal = 0): number {
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(color.r, color.g, color.b);
    const merged = new Map<number, number>();
    for (const [bone, weight] of influences) {
      if (weight > 1e-4) merged.set(bone, (merged.get(bone) ?? 0) + weight);
    }
    const top = Array.from(merged).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = top.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    for (let i = 0; i < 4; i++) {
      this.skinIndex.push(top[i]?.[0] ?? 0);
      this.skinWeight.push(top[i] ? top[i][1] / total : 0);
    }
    this.surface.push(su, sv, kind, dorsal);
    return this.count - 1;
  }

  /** Helpers below emit clockwise rings; store counter-clockwise (outward). */
  tri(a: number, b: number, c: number): void {
    this.indices.push(a, c, b);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, c, b, a, d, c);
  }

  /** Flat-shaded triangle with its own vertices (plates, teeth, spade). */
  facet(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, influences: Influence[], kind: number): void {
    const i = this.vertex(a, color, influences, 0, 0, kind);
    const j = this.vertex(b, color, influences, 0.5, 0, kind);
    const k = this.vertex(c, color, influences, 1, 0, kind);
    this.tri(i, j, k);
  }
}

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a: Influence[], b: Influence[], t: number): Influence[] {
  return [
    ...a.map(([bone, w]): Influence => [bone, w * (1 - t)]),
    ...b.map(([bone, w]): Influence => [bone, w * t])
  ];
}

// ---------------------------------------------------------------- spine

/** Bone segments along the body loft (z of the centerline), head to tail. */
const SPINE_SEGMENTS: readonly [bone: number, zFront: number, zBack: number][] = [
  [BONE.head, 0.445, 0.31],
  [BONE.neck2, 0.31, 0.255],
  [BONE.neck1, 0.255, 0.205],
  [BONE.neck0, 0.205, 0.145],
  [BONE.chest, 0.145, 0.03],
  [BONE.hips, 0.03, -0.2],
  [BONE.tail0, -0.2, -0.31],
  [BONE.tail1, -0.31, -0.42],
  [BONE.tail2, -0.42, -0.52],
  [BONE.tail3, -0.52, -0.61],
  [BONE.tail4, -0.61, -0.75]
];

/** Smooth 1D skinning: hat functions centred on each segment. */
function spineWeights(z: number): Influence[] {
  const out: Influence[] = [];
  for (const [bone, front, back] of SPINE_SEGMENTS) {
    const centre = (front + back) / 2;
    const half = (front - back) / 2;
    const w = 1 - Math.abs(z - centre) / (half + 0.035);
    if (w > 0) out.push([bone, w * w]);
  }
  if (z > 0.43) return [[BONE.head, 1]];
  if (z < -0.68) return [[BONE.tail4, 1]];
  return out.length ? out : [[BONE.hips, 1]];
}

/** [z, half-width, half-height, superellipse exponent, dorsal keel]. */
const PROFILE: readonly (readonly [number, number, number, number, number])[] = [
  [0.445, 0.006, 0.006, 2.6, 0],
  [0.436, 0.0125, 0.0115, 2.7, 0],
  [0.412, 0.0158, 0.0158, 2.8, 0],
  [0.38, 0.0198, 0.0192, 2.7, 0],
  [0.348, 0.0245, 0.0228, 2.5, 0],
  [0.32, 0.024, 0.0232, 2.3, 0],
  [0.29, 0.0195, 0.0215, 2.1, 0.08],
  [0.255, 0.02, 0.0225, 2, 0.12],
  [0.205, 0.0245, 0.027, 2, 0.14],
  [0.145, 0.034, 0.037, 2, 0.16],
  [0.05, 0.061, 0.058, 2.1, 0.18],
  [-0.03, 0.064, 0.055, 2.1, 0.18],
  [-0.11, 0.055, 0.05, 2, 0.16],
  [-0.2, 0.04, 0.037, 2, 0.15],
  [-0.31, 0.027, 0.025, 2, 0.14],
  [-0.42, 0.018, 0.016, 2, 0.12],
  [-0.52, 0.0115, 0.0105, 2, 0.1],
  [-0.61, 0.0068, 0.0065, 2, 0.08],
  [-0.7, 0.0022, 0.0022, 2, 0]
];

/** Girth multiplier: heavier head, neck and barrel than the raw table. */
function girth(z: number): number {
  if (z > 0.31) return 1.18;
  if (z > 0.15) return 1.3 - (0.31 - z) * 0.6;
  if (z > -0.25) return 1.14;
  return 1.14 - Math.min(0.1, (-0.25 - z) * 0.3);
}

function profileAt(z: number): { w: number; h: number; n: number; keel: number } {
  const g = girth(z);
  const raw = rawProfileAt(z);
  return { ...raw, w: raw.w * g, h: raw.h * g };
}

function rawProfileAt(z: number): { w: number; h: number; n: number; keel: number } {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (z <= a[0] && z >= b[0]) {
      const t = smooth(a[0], b[0], z);
      return {
        w: a[1] + (b[1] - a[1]) * t,
        h: a[2] + (b[2] - a[2]) * t,
        n: a[3] + (b[3] - a[3]) * t,
        keel: a[4] + (b[4] - a[4]) * t
      };
    }
  }
  const end = z > 0 ? PROFILE[0] : PROFILE[PROFILE.length - 1];
  return { w: end[1], h: end[2], n: end[3], keel: end[4] };
}

/** Scale size in design units: fine on the head, coarse on the barrel. */
function scaleSize(z: number): number {
  if (z > 0.3) return 0.004;
  if (z > 0.15) return 0.0055 + (0.3 - z) * 0.015;
  if (z > -0.25) return 0.0085;
  return 0.0085 - Math.min(0.0035, (-0.25 - z) * 0.008);
}

const MOUTH_ANGLE = 1.78; // from the dorsal line, slightly below the side

function spineCurve(): THREE.CatmullRomCurve3 {
  const pts: [number, number, number][] = [
    [SNOUT[0], SNOUT[1], SNOUT[2]],
    [0, 0.384, 0.405],
    [0, 0.394, 0.355],
    [0, 0.388, 0.315],
    [0, 0.36, 0.262],
    [0, 0.318, 0.208],
    [0, 0.272, 0.148],
    [0, 0.237, 0.055],
    [0, 0.226, -0.03],
    [0, 0.205, -0.11],
    [0, 0.183, -0.2],
    [0, 0.152, -0.31],
    [0, 0.118, -0.42],
    [0, 0.09, -0.52],
    [0, 0.071, -0.61],
    [TAIL_TIP[0], TAIL_TIP[1], TAIL_TIP[2]]
  ];
  return new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
}

interface Frame {
  centre: THREE.Vector3;
  forward: THREE.Vector3;
  side: THREE.Vector3;
  up: THREE.Vector3;
}

function frameAt(curve: THREE.CatmullRomCurve3, s: number): Frame {
  const centre = curve.getPointAt(s);
  const forward = curve.getTangentAt(s).negate();
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, side).normalize();
  return { centre, forward, side, up };
}

function addBody(b: Builder, budget: MeshBudget, palette: DragonPalette, curve: THREE.CatmullRomCurve3): void {
  const scales = new THREE.Color(palette.scales);
  const belly = new THREE.Color(palette.belly);
  const accent = new THREE.Color(palette.membrane);
  const mouth = new THREE.Color(palette.membrane).multiplyScalar(0.45);
  // Ring angles from the dorsal line (0) through the right flank; extra
  // vertices straddle the mouth so the jaw can hinge open cleanly.
  const angles: number[] = [];
  for (let i = 0; i < budget.bodyRadial; i++) angles.push((i / budget.bodyRadial) * Math.PI * 2);
  for (const a of [MOUTH_ANGLE - 0.05, MOUTH_ANGLE + 0.05]) angles.push(a, Math.PI * 2 - a);
  angles.sort((x, y) => x - y);
  const n = angles.length;
  const rows = budget.bodyRows;
  const headShare = 0.27;
  const headS = 0.11;
  let su = 0;
  let previous: THREE.Vector3 | null = null;
  const ring: number[][] = [];
  const color = new THREE.Color("#000000");
  const p = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const s = t < headShare ? (t / headShare) * headS : headS + ((t - headShare) / (1 - headShare)) * (1 - headS);
    const f = frameAt(curve, Math.min(0.999, Math.max(0.001, s)));
    const z = f.centre.z;
    const prof = profileAt(z);
    if (previous) su += f.centre.distanceTo(previous) / scaleSize(z);
    previous = f.centre;
    const radius = (prof.w + prof.h) / 2;
    const head = z > 0.305;
    const row: number[] = [];
    for (const theta of angles) {
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const along = theta <= Math.PI ? theta : Math.PI * 2 - theta; // 0 dorsal … π belly
      const e = 2 / prof.n;
      let x = prof.w * Math.sign(sin) * Math.pow(Math.abs(sin), e);
      let y = prof.h * Math.sign(cos) * Math.pow(Math.abs(cos), e);
      if (y < 0) y *= 0.88;
      if (cos > 0) y += prof.h * prof.keel * Math.pow(cos, 8);
      // Brow ridges over the eyes, jowls behind the jaw, nostril bosses.
      const brow = Math.exp(-(((z - 0.358) / 0.017) ** 2)) * Math.exp(-(((along - 0.78) / 0.28) ** 2));
      const jowl = Math.exp(-(((z - 0.325) / 0.016) ** 2)) * Math.exp(-(((along - 2.05) / 0.35) ** 2));
      const nostril = Math.exp(-(((z - 0.428) / 0.008) ** 2)) * Math.exp(-(((along - 0.62) / 0.25) ** 2));
      const bulge = 1 + (brow * 0.32 + jowl * 0.2 + nostril * 0.25) * (head ? 1 : 0);
      x *= bulge;
      y *= 1 + brow * 0.18 * (head ? 1 : 0);
      p.copy(f.centre).addScaledVector(f.side, x).addScaledVector(f.up, y);
      // Colour: dark scales, lighter belly plates, darker lower flanks (AO),
      // a faint warm dorsal accent like the reference silhouettes.
      const bellyF = smooth(1.95, 2.55, along) * (head ? 0.55 : 1);
      const ao = 0.62 + 0.38 * smooth(-0.75, 0.5, cos);
      const ridge = Math.pow(Math.max(0, cos), 14) * (head ? 0 : 0.18);
      const isMouth = head && z < 0.442 && Math.abs(along - MOUTH_ANGLE) < 0.03;
      color.copy(scales).lerp(belly, bellyF).lerp(accent, ridge).multiplyScalar(ao * (1 + brow * 0.12));
      if (isMouth) color.copy(mouth);
      let weights = spineWeights(z);
      if (head) {
        const jaw = smooth(MOUTH_ANGLE - 0.02, MOUTH_ANGLE + 0.02, along) * smooth(0.305, 0.33, z);
        weights = mix(weights, [[BONE.jaw, 1]], jaw);
      }
      const sv = (along * radius) / scaleSize(z);
      const dorsal = head || z < -0.5 ? 0 : Math.max(0, cos);
      row.push(b.vertex(p, color, weights, su, sv, isMouth ? KIND_MOUTH : bellyF * 0.4, dorsal));
    }
    ring.push(row);
  }
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      b.quad(ring[r][i], ring[r + 1][i], ring[r + 1][j], ring[r][j]);
    }
  }
  // Snout and tail caps.
  const snout = b.vertex(joint(SNOUT).add(new THREE.Vector3(0, -0.001, 0.003)), scales, [[BONE.head, 1]], 0, 0, 0);
  const tail = b.vertex(joint(TAIL_TIP).add(new THREE.Vector3(0, 0, -0.004)), scales, [[BONE.tail4, 1]], su, 0, 0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    b.tri(snout, ring[0][i], ring[0][j]);
    b.tri(tail, ring[rows][j], ring[rows][i]);
  }
}

// ---------------------------------------------------------------- tubes

interface TubePoint {
  p: THREE.Vector3;
  r: number;
  weights: Influence[];
  color: THREE.Color;
  kind: number;
}

/**
 * Rotation-minimising tube; closes at the end when the last radius is 0.
 * `cell` is the scale size along the surface (design units).
 */
function addTube(b: Builder, pts: TubePoint[], radial: number, su0 = 0, cell = 0.0045): void {
  const tangents = pts.map((pt, i) => {
    const a = pts[Math.max(0, i - 1)].p;
    const c = pts[Math.min(pts.length - 1, i + 1)].p;
    return c.clone().sub(a).normalize();
  });
  let normal = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normal.dot(tangents[0])) > 0.9) normal = new THREE.Vector3(1, 0, 0);
  normal.sub(tangents[0].clone().multiplyScalar(normal.dot(tangents[0]))).normalize();
  const rings: number[][] = [];
  let su = su0;
  for (let i = 0; i < pts.length; i++) {
    const t = tangents[i];
    if (i > 0) {
      normal.sub(t.clone().multiplyScalar(normal.dot(t))).normalize();
      su += pts[i].p.distanceTo(pts[i - 1].p) / cell;
    }
    const binormal = new THREE.Vector3().crossVectors(t, normal);
    const pt = pts[i];
    if (pt.r <= 0) {
      rings.push([b.vertex(pt.p, pt.color, pt.weights, su, 0, pt.kind)]);
      continue;
    }
    const ring: number[] = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const q = pt.p.clone().addScaledVector(normal, Math.cos(a) * pt.r).addScaledVector(binormal, Math.sin(a) * pt.r);
      ring.push(b.vertex(q, pt.color, pt.weights, su, ((Math.min(j, radial - j) / radial) * Math.PI * 2 * pt.r) / cell, pt.kind));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const c = rings[i + 1];
    for (let j = 0; j < radial; j++) {
      const k = (j + 1) % radial;
      if (c.length == 1) b.tri(a[j], c[0], a[k]);
      else if (a.length == 1) b.tri(a[0], c[j], c[k]);
      else b.quad(a[j], c[j], c[k], a[k]);
    }
  }
}

function polyline(points: THREE.Vector3[], steps: number[]): { p: THREE.Vector3; seg: number; t: number }[] {
  const out: { p: THREE.Vector3; seg: number; t: number }[] = [];
  for (let s = 0; s < points.length - 1; s++) {
    const count = steps[s];
    for (let i = s == 0 ? 0 : 1; i <= count; i++) {
      const t = i / count;
      out.push({ p: points[s].clone().lerp(points[s + 1], t), seg: s, t });
    }
  }
  return out;
}

// ---------------------------------------------------------------- wings

function armWeights(side: Side, seg: number, t: number): Influence[] {
  const humerus = wingBone(side, 0);
  const forearm = wingBone(side, 1);
  if (seg == 0) {
    const toChest = (1 - smooth(0, 0.35, t)) * 0.6;
    const toForearm = smooth(0.8, 1, t) * 0.5;
    return [[BONE.chest, toChest], [humerus, 1 - toChest - toForearm], [forearm, toForearm]];
  }
  const back = (1 - smooth(0, 0.2, t)) * 0.5;
  return [[humerus, back], [forearm, 1 - back]];
}

/** Arm-chain weights by arc fraction from shoulder (0) to wrist (1). */
function armWeightsAt(side: Side, a: number, elbowAt: number): Influence[] {
  return a < elbowAt ? armWeights(side, 0, a / elbowAt) : armWeights(side, 1, (a - elbowAt) / (1 - elbowAt));
}

/**
 * Muscled arm profile: a heavy shoulder and biceps tapering to the elbow
 * knob, then a forearm belly near the elbow thinning to a knuckled wrist.
 */
function armRadius(seg: number, t: number): number {
  const bump = (centre: number, width: number): number => Math.exp(-(((t - centre) / width) ** 2));
  if (seg == 0) return 0.025 - t * 0.01 + bump(0.38, 0.22) * 0.004 + bump(1, 0.12) * 0.004;
  return 0.0165 - t * 0.007 + bump(0.2, 0.2) * 0.004 + bump(1, 0.1) * 0.005;
}

function fingerPath(side: Side, f: number, u: number): THREE.Vector3 {
  const W = joint(WING.wrist, side);
  const tip = joint(WING.tips[f], side);
  const dir = tip.clone().sub(W);
  const trailing = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize().multiplyScalar(sideSign(side));
  return W.add(dir.multiplyScalar(u)).addScaledVector(trailing, Math.sin(Math.PI * u) * 0.022 * (0.6 + f * 0.25)).add(
    new THREE.Vector3(0, -Math.sin(Math.PI * u) * 0.006, 0)
  );
}

function fingerWeights(side: Side, f: number, u: number): Influence[] {
  const toForearm = (1 - smooth(0, 0.12, u)) * 0.5;
  return [[wingBone(side, 1), toForearm], [wingBone(side, 2 + f), 1 - toForearm]];
}

function addWing(b: Builder, side: Side, budget: MeshBudget, palette: DragonPalette): void {
  const s = sideSign(side);
  const bone = new THREE.Color(palette.bone).multiplyScalar(0.55).lerp(new THREE.Color(palette.scales), 0.58);
  // Slightly warmer and lighter than the body so the folded arm reads as
  // scaled limb rather than a black tube.
  const knuckle = new THREE.Color(palette.scales).multiplyScalar(1.18).lerp(new THREE.Color(palette.membrane), 0.1);
  const claw = new THREE.Color(palette.horn);
  const membrane = new THREE.Color(palette.membrane);
  const S = joint(WING.shoulder, side);
  const E = joint(WING.elbow, side);
  const W = joint(WING.wrist, side);
  const H = joint(WING.hip, side);
  const lenSE = S.distanceTo(E);
  const lenEW = E.distanceTo(W);
  const elbowAt = lenSE / (lenSE + lenEW);
  const radial = budget.limbRadial;
  const fine = radial > 5;

  // Arm (the wing IS the forelimb): muscular shoulder, elbow, knuckled wrist.
  const arm = polyline([S, E, W], fine ? [5, 7] : [2, 3]);
  addTube(
    b,
    arm.map(({ p, seg, t }) => ({
      p,
      r: armRadius(seg, t),
      weights: armWeights(side, seg, t),
      color: knuckle,
      kind: 0.05
    })),
    radial,
    0,
    0.007
  );
  // Thumb claw at the wrist; grips the ground in the wyvern stance.
  const thumbBase = W.clone().add(new THREE.Vector3(-0.004 * s, -0.004, 0.006));
  const thumbDir = new THREE.Vector3(-0.25 * s, -0.35, 1).normalize();
  addTube(
    b,
    [
      { p: thumbBase, r: 0.0065, weights: [[thumbBone(side), 1]], color: knuckle, kind: 0.05 },
      { p: thumbBase.clone().addScaledVector(thumbDir, 0.022), r: 0.0042, weights: [[thumbBone(side), 1]], color: claw, kind: KIND_HORN },
      { p: thumbBase.clone().addScaledVector(thumbDir, 0.04).add(new THREE.Vector3(0, -0.008, 0)), r: 0, weights: [[thumbBone(side), 1]], color: claw, kind: KIND_HORN }
    ],
    Math.max(3, radial - 2)
  );
  // Finger spars.
  const fingerSteps = fine ? 6 : 2;
  for (let f = 0; f < FINGERS; f++) {
    const pts: TubePoint[] = [];
    for (let i = 0; i <= fingerSteps; i++) {
      const u = i / fingerSteps;
      pts.push({
        p: fingerPath(side, f, u),
        r: i == fingerSteps ? 0 : 0.0075 * (1 - u * 0.7) + (i == 0 ? 0.002 : 0),
        weights: fingerWeights(side, f, u),
        color: i == fingerSteps ? claw : bone,
        kind: i == fingerSteps ? KIND_HORN : 0.02
      });
    }
    addTube(b, pts, budget.fingerRadial);
  }

  const span = budget.membraneSpan;
  const cross = budget.membraneCross;
  const up = new THREE.Vector3(0, 1, 0);
  const shade = (u: number, v: number, root: number): THREE.Color =>
    membrane.clone().multiplyScalar((0.72 + 0.28 * Math.sin(Math.PI * v)) * (0.8 + 0.2 * u) * (1 - root * 0.25));

  // Dactylopatagium between fingers, scalloped trailing edge, cambered.
  for (let f = 0; f < FINGERS - 1; f++) {
    const rows: number[][] = [[b.vertex(W, shade(0, 0.5, 0), [[wingBone(side, 1), 1]], 0, f + 0.5, KIND_MEMBRANE)]];
    for (let i = 1; i <= span; i++) {
      const u = i / span;
      const row: number[] = [];
      for (let j = 0; j <= cross; j++) {
        const v = j / cross;
        const ue = u * (1 - 0.24 * Math.sin(Math.PI * v) * Math.pow(u, 1.5));
        const a = fingerPath(side, f, ue);
        const c = fingerPath(side, f + 1, ue);
        const p = a.clone().lerp(c, v);
        p.addScaledVector(up, Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.min(1, ue * 1.1)) * a.distanceTo(c) * 0.14);
        const weights = mix(fingerWeights(side, f, ue), fingerWeights(side, f + 1, ue), v);
        row.push(b.vertex(p, shade(u, v, 0), weights, ue, f + v, KIND_MEMBRANE));
      }
      rows.push(row);
    }
    for (let i = 0; i < span; i++) {
      for (let j = 0; j < cross; j++) {
        if (i == 0) b.tri(rows[0][0], rows[1][j], rows[1][j + 1]);
        else b.quad(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
      }
    }
  }

  // Arm path helper by arc fraction a ∈ [0,1] (shoulder → wrist).
  const armAt = (a: number): THREE.Vector3 =>
    a < elbowAt ? S.clone().lerp(E, a / elbowAt) : E.clone().lerp(W, (a - elbowAt) / (1 - elbowAt));

  // Propatagium: leading membrane from shoulder to wrist in front of the arm.
  const leadRows = fine ? 8 : 3;
  const leadCols = fine ? 2 : 1;
  const lead: number[][] = [];
  for (let i = 0; i <= leadRows; i++) {
    const a = 0.02 + (i / leadRows) * 0.96;
    const armP = armAt(a);
    const chord = S.clone().lerp(W, a).add(new THREE.Vector3(0, 0.002, -0.014 * Math.sin(Math.PI * a)));
    const row: number[] = [];
    for (let j = 0; j <= leadCols; j++) {
      const v = j / leadCols;
      const p = armP.clone().lerp(chord, v);
      row.push(b.vertex(p, shade(a, v, 0.3), armWeightsAt(side, a, elbowAt), a, 3 + v, KIND_MEMBRANE));
    }
    lead.push(row);
  }
  for (let i = 0; i < leadRows; i++) {
    for (let j = 0; j < leadCols; j++) b.quad(lead[i][j], lead[i][j + 1], lead[i + 1][j + 1], lead[i + 1][j]);
  }

  // Plagiopatagium: from the trailing finger and the arm back to the flank.
  const F4 = fingerPath(side, FINGERS - 1, 1);
  const trailMid = F4.clone().lerp(H, 0.5);
  const inward = E.clone().sub(trailMid).setY(0).normalize();
  const trailLen = F4.distanceTo(H);
  const rowsU = span + 1;
  const colsV = fine ? 5 : 2;
  const inner: number[][] = [];
  for (let i = 0; i <= rowsU; i++) {
    const u = i / rowsU;
    const row: number[] = [];
    for (let j = 0; j <= colsV; j++) {
      const v = j / colsV;
      // C0: arm from wrist (v=0) to shoulder (v=1); C1: trailing edge F4 → hip.
      const armA = 1 - v;
      const c0 = armAt(armA);
      const c1 = F4.clone().lerp(H, v).addScaledVector(inward, Math.sin(Math.PI * v) * trailLen * 0.16);
      const p = c0.clone().lerp(c1, u);
      const bow = fingerPath(side, FINGERS - 1, u).sub(W.clone().lerp(F4, u));
      p.addScaledVector(bow, (1 - v) * (1 - v));
      p.addScaledVector(up, Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 0.028);
      const w0 = armWeightsAt(side, armA, elbowAt);
      const w1 = mix(fingerWeights(side, FINGERS - 1, 1), [[drapeBone(side), 1]], smooth(0.05, 0.6, v));
      // Near the shoulder the membrane hands over to the body sooner, so the
      // folded wing drapes onto the flank instead of tenting over the back.
      const handover = smooth(0, 1 - 0.7 * v, u);
      row.push(b.vertex(p, shade(u, Math.min(1, v * 2), v * 0.6), mix(w0, w1, handover), u, FINGERS - 1 + v, KIND_MEMBRANE));
    }
    inner.push(row);
  }
  for (let i = 0; i < rowsU; i++) {
    for (let j = 0; j < colsV; j++) b.quad(inner[i][j], inner[i + 1][j], inner[i + 1][j + 1], inner[i][j + 1]);
  }
}

// ---------------------------------------------------------------- legs

function addLeg(b: Builder, side: Side, budget: MeshBudget, palette: DragonPalette): void {
  const s = sideSign(side);
  const skin = new THREE.Color(palette.scales);
  const lower = new THREE.Color(palette.scales).multiplyScalar(0.78);
  const claw = new THREE.Color(palette.horn);
  const hip = joint(LEG.hip, side);
  const knee = joint(LEG.knee, side);
  const ankle = joint(LEG.ankle, side);
  const ball = joint(LEG.ball, side);
  const thigh = legBone(side, 0);
  const shin = legBone(side, 1);
  const foot = legBone(side, 2);
  const fine = budget.limbRadial > 5;
  const path = polyline([hip.clone().add(new THREE.Vector3(-0.012 * s, 0.018, 0.01)), knee, ankle, ball], fine ? [4, 4, 2] : [2, 2, 1]);
  addTube(
    b,
    path.map(({ p, seg, t }) => {
      const radii = [
        [0.04, 0.021],
        [0.019, 0.0105],
        [0.0105, 0.0085]
      ][seg];
      const r = radii[0] + (radii[1] - radii[0]) * t + (seg == 1 && t < 0.15 ? 0.003 : 0);
      const weights: Influence[] =
        seg == 0
          ? [[BONE.hips, (1 - smooth(0, 0.45, t)) * 0.55], [thigh, 1], [shin, smooth(0.8, 1, t) * 0.5]]
          : seg == 1
            ? [[thigh, (1 - smooth(0, 0.2, t)) * 0.5], [shin, 1], [foot, smooth(0.85, 1, t) * 0.5]]
            : [[shin, (1 - smooth(0, 0.3, t)) * 0.5], [foot, 1]];
      return { p, r, weights, color: seg == 0 ? skin : lower, kind: seg == 0 ? 0.04 : 0.02 };
    }),
    budget.limbRadial
  );
  // Toes: three forward, one back, each ending in a claw.
  const toes = fine ? [-0.42, 0, 0.42, Math.PI] : [-0.38, 0.38, Math.PI];
  for (const yaw of toes) {
    const back = Math.abs(yaw) > 3;
    const dir = new THREE.Vector3(Math.sin(yaw) * s, back ? 0.35 : -0.08, Math.cos(yaw)).normalize();
    const len = back ? 0.016 : 0.028;
    const base = ball.clone().add(new THREE.Vector3(0, 0.001, 0));
    const knuckleP = base.clone().addScaledVector(dir, len);
    const tip = knuckleP.clone().addScaledVector(dir, 0.013).add(new THREE.Vector3(0, -0.008, 0));
    tip.y = Math.max(tip.y, 0.0005);
    addTube(
      b,
      [
        { p: base, r: 0.0062, weights: [[foot, 1]], color: lower, kind: 0.02 },
        { p: knuckleP, r: 0.0045, weights: [[foot, 1]], color: claw, kind: KIND_HORN },
        { p: tip, r: 0, weights: [[foot, 1]], color: claw, kind: KIND_HORN }
      ],
      fine ? 5 : 3
    );
  }
}

// ---------------------------------------------------------------- head dressing

function addHorn(
  b: Builder,
  base: THREE.Vector3,
  ctrl: THREE.Vector3,
  tip: THREE.Vector3,
  radius: number,
  rows: number,
  radial: number,
  bone: number,
  palette: DragonPalette
): void {
  const curve = new THREE.QuadraticBezierCurve3(base, ctrl, tip);
  const root = new THREE.Color(palette.horn).multiplyScalar(0.55);
  const pts: TubePoint[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    pts.push({
      p: curve.getPoint(t),
      r: i == rows ? 0 : radius * (1 - t * 0.85),
      weights: [[bone, 1]],
      color: root.clone().lerp(new THREE.Color(palette.horn), t),
      kind: KIND_HORN
    });
  }
  addTube(b, pts, radial);
}

function addHeadDressing(b: Builder, budget: MeshBudget, palette: DragonPalette): void {
  const fine = budget.hornRadial > 4;
  const rows = fine ? 6 : 3;
  for (const side of SIDES) {
    const s = sideSign(side);
    // Main swept-back horns from the crown, heavier and slightly uneven
    // (one a little longer) so the head silhouette is not machined.
    addHorn(
      b,
      new THREE.Vector3(0.012 * s, 0.405, 0.322),
      new THREE.Vector3(0.028 * s, 0.432, 0.272),
      new THREE.Vector3(0.04 * s, 0.428, side == 0 ? 0.19 : 0.2),
      0.0095,
      rows,
      budget.hornRadial,
      BONE.head,
      palette
    );
    // Cheek horns framing the jaw.
    addHorn(
      b,
      new THREE.Vector3(0.022 * s, 0.39, 0.326),
      new THREE.Vector3(0.038 * s, 0.392, 0.298),
      new THREE.Vector3(0.052 * s, 0.382, 0.252),
      0.0058,
      fine ? 4 : 2,
      Math.max(3, budget.hornRadial - 2),
      BONE.head,
      palette
    );
    if (fine) {
      // Brow spurs and jaw spikes.
      addHorn(b, new THREE.Vector3(0.017 * s, 0.403, 0.358), new THREE.Vector3(0.022 * s, 0.41, 0.35), new THREE.Vector3(0.026 * s, 0.413, 0.336), 0.003, 2, 4, BONE.head, palette);
      addHorn(b, new THREE.Vector3(0.019 * s, 0.358, 0.336), new THREE.Vector3(0.028 * s, 0.35, 0.318), new THREE.Vector3(0.032 * s, 0.346, 0.296), 0.0035, 2, 4, BONE.jaw, palette);
      addHorn(b, new THREE.Vector3(0.012 * s, 0.356, 0.37), new THREE.Vector3(0.018 * s, 0.349, 0.36), new THREE.Vector3(0.02 * s, 0.346, 0.348), 0.0025, 2, 4, BONE.jaw, palette);
      // Secondary frill spikes behind the crown and a small nasal spur.
      addHorn(b, new THREE.Vector3(0.019 * s, 0.396, 0.312), new THREE.Vector3(0.04 * s, 0.404, 0.292), new THREE.Vector3(0.056 * s, 0.396, 0.258), 0.0045, 3, 4, BONE.head, palette);
      addHorn(b, new THREE.Vector3(0.008 * s, 0.398, 0.41), new THREE.Vector3(0.01 * s, 0.407, 0.405), new THREE.Vector3(0.011 * s, 0.411, 0.396), 0.0026, 2, 4, BONE.head, palette);
    }
    // Eye: small ellipsoid under the brow; the shader adds a faint glow.
    const eye = new THREE.Color(palette.eye);
    const eyeProf = profileAt(0.36);
    const centre = new THREE.Vector3(eyeProf.w * 0.93 * s, 0.392 + eyeProf.h * 0.28, 0.36);
    const axes = [
      new THREE.Vector3(0.0035 * s, 0, 0),
      new THREE.Vector3(0, 0.0032, 0),
      new THREE.Vector3(0, -0.0008, 0.0062)
    ];
    const ids = [
      b.vertex(centre.clone().add(axes[0]), eye, [[BONE.head, 1]], 0, 0, KIND_EYE),
      b.vertex(centre.clone().add(axes[1]), eye, [[BONE.head, 1]], 0, 0, KIND_EYE),
      b.vertex(centre.clone().sub(axes[1]), eye, [[BONE.head, 1]], 0, 0, KIND_EYE),
      b.vertex(centre.clone().add(axes[2]), eye, [[BONE.head, 1]], 0, 0, KIND_EYE),
      b.vertex(centre.clone().sub(axes[2]), eye, [[BONE.head, 1]], 0, 0, KIND_EYE)
    ];
    const [o, top, bottom, front, rear] = ids;
    const faces = [
      [o, front, top],
      [o, top, rear],
      [o, rear, bottom],
      [o, bottom, front]
    ];
    for (const [i, j, k] of faces) {
      if (s > 0) b.tri(i, j, k);
      else b.tri(i, k, j);
    }
    if (budget.teeth) {
      const tooth = new THREE.Color(palette.horn).lerp(new THREE.Color("#f2ead8"), 0.5);
      for (let i = 0; i < 6; i++) {
        const z = 0.432 - i * 0.017;
        const prof = profileAt(z);
        const x = prof.w * 0.86 * s;
        const y = 0.384 - (0.432 - z) * 0.2 - prof.h * 0.12;
        const top = new THREE.Vector3(x, y, z);
        b.facet(top, new THREE.Vector3(x, y, z - 0.004), new THREE.Vector3(x, y - 0.006, z - 0.002), tooth, [[BONE.head, 1]], KIND_HORN);
        b.facet(top, new THREE.Vector3(x, y - 0.006, z - 0.002), new THREE.Vector3(x, y, z - 0.004), tooth, [[BONE.head, 1]], KIND_HORN);
      }
    }
  }
}

// ---------------------------------------------------------------- back

function addPlates(b: Builder, budget: MeshBudget, palette: DragonPalette, curve: THREE.CatmullRomCurve3): void {
  const base = new THREE.Color(palette.scales).lerp(new THREE.Color(palette.horn), 0.25);
  const tipColor = new THREE.Color(palette.membrane).lerp(new THREE.Color(palette.horn), 0.35);
  const start = 0.17;
  const end = 0.96;
  for (let i = 0; i < budget.plates; i++) {
    const s = start + (i / (budget.plates - 1)) * (end - start);
    const f = frameAt(curve, s);
    const prof = profileAt(f.centre.z);
    const z = f.centre.z;
    const base0 = z > 0.15 ? 0.009 + (0.3 - z) * 0.03 : z > -0.15 ? 0.021 - Math.abs(z - 0.02) * 0.02 : Math.max(0.0055, 0.019 - (-0.15 - z) * 0.025);
    // Irregular ridge: every third plate is a tall spike, the others vary.
    const jitter = Math.sin(i * 12.9898) * 43758.5453;
    const size = base0 * (i % 3 == 1 ? 1.45 : 0.78 + 0.3 * (jitter - Math.floor(jitter)));
    const spacing = ((end - start) / budget.plates) * curve.getLength();
    const root = f.centre.clone().addScaledVector(f.up, prof.h * (1 + prof.keel) * 0.92);
    const front = root.clone().addScaledVector(f.forward, spacing * 0.45);
    const back = root.clone().addScaledVector(f.forward, -spacing * 0.5);
    const apex = root.clone().addScaledVector(f.up, size).addScaledVector(f.forward, -spacing * 0.55);
    const w = Math.max(0.0018, size * 0.18);
    const left = root.clone().addScaledVector(f.side, -w);
    const right = root.clone().addScaledVector(f.side, w);
    const weights = spineWeights(z);
    b.facet(front, right, apex, base, weights, KIND_HORN);
    b.facet(right, back, apex, tipColor, weights, KIND_HORN);
    b.facet(back, left, apex, tipColor, weights, KIND_HORN);
    b.facet(left, front, apex, base, weights, KIND_HORN);
  }
  // Tail spade: a flat barbed diamond.
  const tipF = frameAt(curve, 0.985);
  const c = tipF.centre;
  const dark = new THREE.Color(palette.scales).lerp(new THREE.Color(palette.membrane), 0.35);
  const fwd = tipF.forward;
  const side = tipF.side;
  const upV = tipF.up;
  const front = c.clone().addScaledVector(fwd, 0.03);
  const rear = c.clone().addScaledVector(fwd, -0.05);
  const l = c.clone().addScaledVector(side, -0.032).addScaledVector(fwd, -0.004);
  const r = c.clone().addScaledVector(side, 0.032).addScaledVector(fwd, -0.004);
  const top = c.clone().addScaledVector(upV, 0.006).addScaledVector(fwd, -0.01);
  const bottom = c.clone().addScaledVector(upV, -0.004).addScaledVector(fwd, -0.01);
  const tw: Influence[] = [[BONE.tail4, 1]];
  b.facet(front, r, top, dark, tw, 0.02);
  b.facet(r, rear, top, dark, tw, 0.02);
  b.facet(rear, l, top, dark, tw, 0.02);
  b.facet(l, front, top, dark, tw, 0.02);
  b.facet(front, bottom, r, dark, tw, 0.02);
  b.facet(r, bottom, rear, dark, tw, 0.02);
  b.facet(rear, bottom, l, dark, tw, 0.02);
  b.facet(l, bottom, front, dark, tw, 0.02);
}

export interface DragonMeshResult {
  geometry: THREE.BufferGeometry;
  triangles: number;
  /** Skeleton bones driven by rig.ts (one SkinnedMesh draw). */
  bones: number;
}

/**
 * Smooth lofted wyvern: body/neck/head/tail along a spine curve, wing arm +
 * four finger spars with cambered, scalloped membranes, hind legs with claws,
 * horns, eyes and dorsal plates. Rest pose = wings spread (flight); rig.ts
 * folds them. Skin weights use up to 4 bones per vertex.
 */
export function buildDragonGeometry(tier: Exclude<DragonTier, "low">, palette: DragonPalette): DragonMeshResult {
  const budget = BUDGETS[tier];
  const b = new Builder();
  const curve = spineCurve();
  addBody(b, budget, palette, curve);
  for (const side of SIDES) {
    addWing(b, side, budget, palette);
    addLeg(b, side, budget, palette);
  }
  addHeadDressing(b, budget, palette);
  addPlates(b, budget, palette, curve);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(b.skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(b.skinWeight, 4));
  geometry.setAttribute("dragonSurface", new THREE.Float32BufferAttribute(b.surface, 4));
  geometry.setIndex(b.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return { geometry, triangles: b.indices.length / 3, bones: BONE_COUNT };
}

export function countTriangles(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  return (index ? index.count : geometry.getAttribute("position").count) / 3;
}

/** Bone pivot helper for callers that need head/snout positions. */
export function snoutRest(): THREE.Vector3 {
  return joint(SNOUT);
}

export { spineJoint };

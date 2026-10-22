import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import CastleBuilder from "../../castles/CastleBuilder";
import { stoneRing } from "../../castles/CastleArchitecture";
import { castleGeometry } from "../../castles/castles";
import { CityLayoutSpec } from "../../presets/cityLayouts";
import { CityPlan, HousePlacement, LandmarkPlacement, Strip } from "./CityLayout";
import { gateSpan, kitBits, palisadeHeight, towerHeight, towerSize, wallHeight, wallLength, wallThickness } from "./CityKit";
import { exclusionState } from "./plane";
import { CityExclusion } from "./types";

type Rgb = [number, number, number];
type Xyz = [number, number, number];

// Three r186 constructors with parameters the app's TS 4.5 declarations omit.
const Sphere = THREE.SphereGeometry as unknown as new (radius: number, widthSegments: number, heightSegments: number, phiStart: number, phiLength: number, thetaStart: number, thetaLength: number) => THREE.BufferGeometry;

const linear = (hex: string): Rgb => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

/** Flat-shaded triangle soup with the castle material's attribute layout. */
export class SilhouetteWriter {
  private position: number[] = [];
  private normal: number[] = [];
  private color: number[] = [];
  private surface: number[] = [];

  /** Quad a-b-c-d; winding is corrected to face `out`. */
  quad(a: Xyz, b: Xyz, c: Xyz, d: Xyz, color: Rgb, surface: number, out: Xyz): void {
    this.tri(a, b, c, color, surface, out);
    this.tri(a, c, d, color, surface, out);
  }

  tri(a: Xyz, b: Xyz, c: Xyz, color: Rgb, surface: number, out: Xyz): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(n[0], n[1], n[2]);
    if (length < 1e-12) return;
    n = n.map(value => value / length);
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) { [b, c] = [c, b]; n = n.map(value => -value); }
    [a, b, c].forEach(p => {
      this.position.push(p[0], p[1], p[2]);
      this.normal.push(n[0], n[1], n[2]);
      this.color.push(color[0], color[1], color[2]);
      this.surface.push(surface, 0, 0);
    });
  }

  /** Oriented box without a bottom face; local X is `yaw`'s along axis. */
  box(x: number, z: number, yaw: number, hw: number, hd: number, y0: number, y1: number, color: Rgb, surface = 0, top = true): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const p = (i: number, j: number, y: number): Xyz => [x + i * hw * c + j * hd * s, y, z - i * hw * s + j * hd * c];
    const sides: [number, number, number, number][] = [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]];
    sides.forEach(([i0, j0, i1, j1]) => {
      const mi = (i0 + i1) / 2, mj = (j0 + j1) / 2;
      this.quad(p(i0, j0, y0), p(i1, j1, y0), p(i1, j1, y1), p(i0, j0, y1), color, surface, [mi * c + mj * s, 0, -mi * s + mj * c]);
    });
    if (top) this.quad(p(-1, -1, y1), p(1, -1, y1), p(1, 1, y1), p(-1, 1, y1), color, surface, [0, 1, 0]);
  }

  /** Gable roof over a box top, ridge along the longer side. */
  gable(x: number, z: number, yaw: number, hw: number, hd: number, y: number, ridge: number, color: Rgb, snow = 0): void {
    if (hd > hw) { yaw += Math.PI / 2; [hw, hd] = [hd, hw]; }
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const p = (i: number, j: number, h: number): Xyz => [x + i * hw * c + j * hd * s, h, z - i * hw * s + j * hd * c];
    const start = this.surface.length;
    [-1, 1].forEach(j => this.quad(p(-1, j, y), p(1, j, y), p(1, 0, y + ridge), p(-1, 0, y + ridge), color, 1, [j * s, 1, j * c]));
    [-1, 1].forEach(i => this.tri(p(i, -1, y), p(i, 1, y), p(i, 0, y + ridge), color, 1, [i * c, 0, -i * s]));
    for (let k = start; k < this.surface.length; k += 3) this.surface[k + 2] = snow * Math.max(0, this.normal[k + 1]);
  }

  cylinder(x: number, z: number, r0: number, r1: number, y0: number, y1: number, n: number, color: Rgb, surface = 0, top = true): void {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, m = (a + b) / 2;
      const p = (angle: number, r: number, y: number): Xyz => [x + Math.sin(angle) * r, y, z + Math.cos(angle) * r];
      if (r1 > 0) this.quad(p(a, r0, y0), p(b, r0, y0), p(b, r1, y1), p(a, r1, y1), color, surface, [Math.sin(m), 0, Math.cos(m)]);
      else this.tri(p(a, r0, y0), p(b, r0, y0), [x, y1, z], color, surface, [Math.sin(m), 0.4, Math.cos(m)]);
      if (top && r1 > 0) this.tri(p(a, r1, y1), p(b, r1, y1), [x, y1, z], color, surface, [0, 1, 0]);
    }
  }

  get triangles(): number { return this.position.length / 9; }

  /** `raw` omits the static skirt inputs, for merging with castle geometry. */
  geometry(raw = false): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const count = this.position.length / 3;
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      // Same object-space box projection and scale as finishGeometry.
      const [px, py, pz] = [this.position[i * 3], this.position[i * 3 + 1], this.position[i * 3 + 2]];
      uv[i * 2] = (Math.abs(this.normal[i * 3]) > 0.7 ? pz : px) * 3;
      uv[i * 2 + 1] = (Math.abs(this.normal[i * 3 + 1]) > 0.7 ? pz : py) * 3;
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute("castleSurface", new THREE.Float32BufferAttribute(this.surface, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return raw ? geometry : staticGeometry(geometry);
  }
}

/** Non-instanced meshes bake their seat; the shared skirt inputs stay zero. */
export function staticGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("castleSkirt", new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("instanceCastleDepth", new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function average(houses: HousePlacement[], pick: (house: HousePlacement) => Rgb): Rgb {
  const sum: Rgb = [0, 0, 0];
  houses.forEach(house => { const c = pick(house); sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; });
  return [sum[0] / houses.length, sum[1] / houses.length, sum[2] / houses.length];
}

/** Far LOD: walls, towers, gates, landmark masses and block skylines in one draw. */
export function silhouetteGeometry(spec: CityLayoutSpec, plan: CityPlan, exclusions: CityExclusion[], farBlocks: number, keep?: THREE.BufferGeometry): THREE.BufferGeometry {
  const w = new SilhouetteWriter();
  const north = spec.style == "north";
  const timber = linear("#6b5643");
  plan.walls.forEach(p => {
    if (p.mask & kitBits.palisade) w.box(p.x, p.z, p.yaw, wallLength * p.sx / 2, 0.003, p.y - p.depth * p.sy, p.y + wallHeight * palisadeHeight * p.sy, timber, 2);
    else w.box(p.x, p.z, p.yaw, wallLength * p.sx / 2, wallThickness * p.sz / 2, p.y - p.depth * p.sy, p.y + wallHeight * p.sy, p.wall);
  });
  plan.towers.forEach(p => {
    if (p.mask & kitBits.palisade) {
      const top = p.y + wallHeight * 0.95 * p.sy;
      w.box(p.x, p.z, p.yaw, 0.0085, 0.0085, p.y - p.depth * p.sy, top, timber, 2);
      w.cylinder(p.x, p.z, 0.013, 0, top, top + 0.012, 4, p.roof, 1);
    } else {
      const top = p.y + towerHeight * p.sy;
      w.box(p.x, p.z, p.yaw, towerSize / 2, towerSize / 2, p.y - p.depth * p.sy, top, p.wall);
      if (p.mask & kitBits.north) w.cylinder(p.x, p.z, towerSize * 0.75, 0, top, top + 0.024, 4, p.roof, 1);
    }
  });
  plan.gates.forEach(p => {
    if (p.mask & kitBits.palisade) w.box(p.x, p.z, p.yaw, gateSpan / 2, 0.006, p.y - p.depth * p.sy, p.y + wallHeight * p.sy, timber, 2);
    else w.box(p.x, p.z, p.yaw, gateSpan / 2, (wallThickness * p.sz + 0.008) / 2, p.y - p.depth * p.sy, p.y + towerHeight * 1.04 * p.sy, p.wall);
  });
  plan.moat.forEach(s => w.box(s.x, s.z, s.yaw, s.length / 2, s.width / 2, s.y - 0.002, s.y, linear("#3f6672"), 4));
  plan.quays.forEach(s => w.box(s.x, s.z, s.yaw, s.length / 2, s.width / 2, s.y - s.depth, s.y + 0.004, linear(spec.palette.stone)));
  plan.landmarks.forEach(l => farLandmark(w, l));
  plan.trees.filter((_, i) => i % 3 == 0).forEach(t => w.cylinder(t.x, t.z, t.h * 0.32, 0, t.y, t.y + t.h * 1.2, 5, linear(t.kind == "weirwood" ? "#a8453c" : "#2f4637"), 0));

  // Skyline masses: one box and gable per block of houses; per-house tents
  // where a block's hull would cross an exclusion or its halo.
  const blocks = new Map<string, HousePlacement[]>();
  plan.houses.forEach(house => { const list = blocks.get(house.block); if (list) list.push(house); else blocks.set(house.block, [house]); });
  const ordered = [...blocks.values()].sort((a, b) => b.length - a.length).slice(0, farBlocks);
  const tent = (h: HousePlacement): void => {
    w.box(h.x, h.z, h.yaw, h.w / 2, h.d / 2, h.y - h.depth * h.sy, h.y + h.h, h.wall);
    w.gable(h.x, h.z, h.yaw, h.w / 2, h.d / 2, h.y + h.h, h.ridge, h.roof, north ? 1 : 0);
  };
  ordered.forEach(list => {
    const yaw = list[0].yaw, c = Math.cos(yaw), s = Math.sin(yaw);
    let minA = Infinity, maxA = -Infinity, minC = Infinity, maxC = -Infinity, top = 0, bottom = Infinity;
    list.forEach(h => {
      const a = h.x * c - h.z * s, cc = h.x * s + h.z * c, r = Math.max(h.w, h.d) / 2;
      minA = Math.min(minA, a - r); maxA = Math.max(maxA, a + r); minC = Math.min(minC, cc - r); maxC = Math.max(maxC, cc + r);
      top += h.y + h.h; bottom = Math.min(bottom, h.y - h.depth * h.sy);
    });
    top /= list.length;
    const a = (minA + maxA) / 2, cc = (minC + maxC) / 2;
    const x = a * c + cc * s, z = -a * s + cc * c, hw = (maxA - minA) / 2, hd = (maxC - minC) / 2;
    const hull = exclusionState(exclusions, x + plan.frame.center.x, z + plan.frame.center.z, Math.hypot(hw, hd), top - bottom);
    if (list.length < 3 || hull != "free") { list.forEach(tent); return; }
    w.box(x, z, yaw, hw * 0.94, hd * 0.9, bottom, top, average(list, h => h.wall));
    const ridge = list.reduce((sum, h) => sum + h.ridge / Math.min(h.w, h.d), 0) / list.length;
    w.gable(x, z, yaw, hw * 0.94, hd * 0.9, top, Math.min(0.012, Math.min(hw, hd) * ridge), average(list, h => h.roof), north ? 1 : 0);
  });
  if (!keep) return w.geometry();
  const geometry = w.geometry(true);
  const merged = mergeGeometries([geometry, keep]);
  geometry.dispose(); keep.dispose();
  if (!merged) throw new Error("Could not merge city silhouette");
  return staticGeometry(merged);
}

function farLandmark(w: SilhouetteWriter, l: LandmarkPlacement): void {
  const { x, z, y } = l, base = y - l.depth;
  if (l.kind == "great-sept") {
    // The pale dome must read from afar: a rounded profile and seven towers.
    w.cylinder(x, z, 0.074, 0.07, base, y + 0.012, 7, linear("#d8d0bf"));
    w.cylinder(x, z, 0.046, 0.042, y + 0.012, y + 0.057, 7, linear("#e3dccb"));
    w.cylinder(x, z, 0.045, 0.039, y + 0.057, y + 0.08, 10, linear("#d9cfb4"), 1, false);
    w.cylinder(x, z, 0.039, 0.024, y + 0.08, y + 0.1, 10, linear("#d6ccb0"), 1, false);
    w.cylinder(x, z, 0.024, 0, y + 0.1, y + 0.112, 10, linear("#cfc5ab"), 1);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      w.cylinder(x + Math.sin(a) * 0.056, z + Math.cos(a) * 0.056, 0.0068, 0, y + 0.012, y + 0.104, 4, linear("#e1d9c6"));
    }
  } else if (l.kind == "dragonpit") {
    w.cylinder(x, z, 0.058, 0.052, base, y + 0.012, 10, linear("#9a8a76"));
    w.cylinder(x, z, 0.047, 0.047, y + 0.012, y + 0.042, 10, linear("#b4a189"));
    w.cylinder(x, z, 0.045, 0, y + 0.042, y + 0.06, 10, linear("#8d7c69"), 0);
  } else if (l.kind == "broken-tower") {
    w.cylinder(x, z, 0.016, 0.014, base, y + 0.12, 6, linear("#7d8380"));
  } else if (l.kind == "first-keep") {
    w.cylinder(x, z, 0.024, 0.022, base, y + 0.062, 8, linear("#6f7572"));
  } else if (l.kind == "glass-gardens") {
    w.box(x, z, l.yaw, 0.028, 0.012, base, y + 0.014, linear("#9fb6b2"), 4);
  }
}

function seated(b: CastleBuilder, l: { x: number; y: number; z: number; yaw: number }): THREE.BufferGeometry {
  return b.finish().rotateY(l.yaw).translate(l.x, l.y, l.z);
}

/** One merged mesh per LOD for landmarks, godswood, moat, bridges and harbor. */
export function landmarkGeometry(spec: CityLayoutSpec, plan: CityPlan, near: boolean, keep?: THREE.BufferGeometry): THREE.BufferGeometry | undefined {
  const parts: THREE.BufferGeometry[] = [];
  const style = spec.style;
  plan.landmarks.forEach(l => {
    if (l.kind == "godswood") return;
    const b = new CastleBuilder(style, false);
    if (l.kind == "great-sept") greatSept(b, l.depth, near);
    else if (l.kind == "dragonpit") dragonpit(b, l.depth, near);
    else if (l.kind == "broken-tower") brokenTower(b, l.depth, near);
    else if (l.kind == "first-keep") firstKeep(b, l.depth, near);
    else glassGardens(b, l.depth, near);
    parts.push(seated(b, l));
  });
  if (plan.trees.length) {
    const b = new CastleBuilder(style, false);
    plan.trees.filter((_, i) => near || i % 2 == 0).forEach((t, i) => tree(b, t.x, t.y, t.z, t.h, t.kind, near, i));
    parts.push(b.finish());
  }
  const strips = (list: Strip[], add: (b: CastleBuilder, s: Strip) => void): void => {
    if (!list.length) return;
    const b = new CastleBuilder(style, false);
    list.forEach(s => add(b, s));
    parts.push(b.finish());
  };
  strips(plan.moat, (b, s) => {
    // Still water held by dark stone kerbs that stand above it and root below.
    b.add(new THREE.BoxGeometry(s.length, 0.004, s.width), s.x, s.y - 0.002, s.z, "#3a5f6a", s.yaw, 4);
    [-1, 1].forEach(side => b.add(new THREE.BoxGeometry(s.length, s.depth + 0.005, 0.0035), s.x + Math.sin(s.yaw) * side * (s.width / 2 + 0.00175), s.y + 0.005 - (s.depth + 0.005) / 2,
      s.z + Math.cos(s.yaw) * side * (s.width / 2 + 0.00175), "#5d6461", s.yaw));
  });
  strips(plan.bridges, (b, s) => {
    b.add(new THREE.BoxGeometry(s.length, 0.004 + s.depth, s.width).translate(0, -s.depth / 2, 0), s.x, s.y, s.z, spec.palette.wood, s.yaw, 2);
    if (near) [-1, 1].forEach(side => b.add(new THREE.BoxGeometry(s.length, 0.004, 0.0012), s.x + Math.sin(s.yaw) * side * s.width * 0.45, s.y + 0.004, s.z + Math.cos(s.yaw) * side * s.width * 0.45, spec.palette.wood, s.yaw, 2));
  });
  strips(plan.quays, (b, s) => b.add(new THREE.BoxGeometry(s.length, 0.006 + s.depth, s.width).translate(0, -s.depth / 2, 0), s.x, s.y + 0.001, s.z, spec.palette.trim, s.yaw));
  strips(plan.piers, (b, s) => {
    b.add(new THREE.BoxGeometry(s.length, 0.0025, s.width), s.x, s.y, s.z, "#7a5f45", s.yaw, 2);
    if (near) [-0.4, 0, 0.4].forEach(t => [-1, 1].forEach(side => b.add(new THREE.CylinderGeometry(0.0011, 0.0011, s.depth, 5),
      s.x + Math.cos(s.yaw) * t * s.length + Math.sin(s.yaw) * side * s.width * 0.42, s.y - s.depth / 2, s.z - Math.sin(s.yaw) * t * s.length + Math.cos(s.yaw) * side * s.width * 0.42, "#5c4634", 0, 2)));
  });
  strips(plan.boats, (b, s) => boat(b, s, near));
  if (keep) parts.push(keep);
  if (!parts.length) return undefined;
  const merged = mergeGeometries(parts);
  parts.forEach(part => { if (part != merged) part.dispose(); });
  if (!merged) throw new Error("Could not merge city landmarks");
  return staticGeometry(merged);
}

/** Signature keep for standalone previews; scaled and seated like castles.
 * Returned without skirt inputs: the landmark/silhouette merge adds them. */
export function keepGeometry(plan: CityPlan, id: string, near: boolean): THREE.BufferGeometry | undefined {
  if (!plan.keep) return undefined;
  const geometry = castleGeometry(id, id == "winterfell" ? "north" : "crownlands", 0, near, undefined, 2);
  const position = geometry.getAttribute("position");
  // Foundation vertices extend to the lowest footprint sample.
  for (let i = 0; i < position.count; i++) if (position.getY(i) < 0) position.setXYZ(i, position.getX(i), position.getY(i) - plan.keep.depth / plan.keep.scale, position.getZ(i));
  return geometry.scale(plan.keep.scale, plan.keep.scale, plan.keep.scale).translate(plan.keep.x, plan.keep.y, plan.keep.z);
}

// Original procedural studies; see README for observed/inferred notes.
function greatSept(b: CastleBuilder, depth: number, near: boolean, whiteMarble = false): void {
  const marble = whiteMarble ? "#eeece5" : "#e6dfcf", dome = whiteMarble ? "#f4f2eb" : "#d6ccb2", n = near ? 14 : 7;
  b.add(new THREE.CylinderGeometry(0.07, 0.076, 0.012 + depth, 7).translate(0, -depth / 2, 0), 0, 0.006, 0, "#d1c8b4");
  b.add(new THREE.CylinderGeometry(0.055, 0.06, 0.008, 7), 0, 0.016, 0, marble);
  b.add(new THREE.CylinderGeometry(0.042, 0.046, 0.045, 7), 0, 0.0425, 0, marble);
  b.add(new THREE.LatheGeometry(Array.from({ length: near ? 9 : 5 }, (_, i) => {
    const a = i / (near ? 8 : 4) * Math.PI / 2;
    return new THREE.Vector2(0.044 * Math.cos(a), 0.046 * Math.sin(a));
  }), n), 0, 0.065, 0, dome, 0, whiteMarble ? 7 : 1);
  b.add(new THREE.CylinderGeometry(0.0075, 0.009, 0.012, near ? 8 : 5), 0, 0.116, 0, marble);
  if (near) b.add(new THREE.ConeGeometry(0.0085, 0.016, 8), 0, 0.13, 0, "#c9b98f", 0, 1);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7, x = Math.sin(a) * 0.056, z = Math.cos(a) * 0.056;
    b.add(new THREE.CylinderGeometry(0.0062, 0.007, 0.068, near ? 8 : 5), x, 0.05, z, marble);
    if (near) {
      b.add(new THREE.ConeGeometry(0.0075, 0.022, 8), x, 0.095, z, dome, 0, whiteMarble ? 7 : 1);
      b.add(new THREE.PlaneGeometry(0.003, 0.012), Math.sin(a) * 0.0631, 0.06, Math.cos(a) * 0.0631, "#3b3f45", a, 3);
    }
  }
  // Broad stair toward the plaza (local +Z).
  for (let i = 0; i < (near ? 4 : 2); i++) b.add(new THREE.BoxGeometry(0.05 - i * 0.006, 0.004 + depth, 0.009).translate(0, -depth / 2, 0), 0, 0.002 + i * 0.004, 0.083 - i * 0.008, "#d1c8b4");
}

function dragonpit(b: CastleBuilder, depth: number, near: boolean): void {
  const stone = "#ad9a82";
  b.add(new THREE.CylinderGeometry(0.056, 0.062, 0.012 + depth, 12).translate(0, -depth / 2, 0), 0, 0.006, 0, "#998a76");
  stoneRing(b, 0.05, 0.043, 0.012, 0.03);
  // A collapsed dome: shell segments with the crown and a flank missing.
  b.add(new Sphere(0.047, near ? 16 : 9, near ? 5 : 3, 0.4, Math.PI * 1.35, Math.PI * 0.18, Math.PI * 0.32), 0, 0.03, 0, "#8f7f6c", 0, 0);
  if (near) {
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      b.add(new THREE.BoxGeometry(0.006, 0.012, 0.004), Math.sin(a) * 0.0505, 0.024, Math.cos(a) * 0.0505, "#3c3933", a, 2);
    }
    for (let i = 0; i < 5; i++) b.add(new THREE.BoxGeometry(0.007, 0.004, 0.005), Math.sin(i * 1.7) * 0.02, 0.014, Math.cos(i * 1.7) * 0.02, stone, i);
  }
}

function brokenTower(b: CastleBuilder, depth: number, near: boolean): void {
  const n = near ? 12 : 7, h = 0.112;
  b.add(new THREE.CylinderGeometry(0.0135, 0.016, h + depth, n).translate(0, -depth / 2, 0), 0, h / 2, 0, "#7f8582");
  // Jagged, roofless crown left after the fire.
  for (let i = 0; i < (near ? 7 : 4); i++) {
    const a = i * Math.PI * 2 / 9, rise = [0.012, 0.004, 0.017, 0.007, 0.002, 0.014, 0.009][i];
    b.add(new THREE.BoxGeometry(0.008, rise, 0.004), Math.sin(a) * 0.0125, h + rise / 2, Math.cos(a) * 0.0125, "#727875", a);
  }
  if (near) [0.45, 0.7].forEach(t => b.add(new THREE.PlaneGeometry(0.0028, 0.008), 0, h * t, 0.0142, "#3a3f45", 0, 3));
}

function firstKeep(b: CastleBuilder, depth: number, near: boolean): void {
  const n = near ? 14 : 8;
  b.add(new THREE.CylinderGeometry(0.022, 0.025, 0.06 + depth, n).translate(0, -depth / 2, 0), 0, 0.03, 0, "#6f7572");
  b.add(new THREE.CylinderGeometry(0.0245, 0.0235, 0.005, n), 0, 0.058, 0, "#8c918c");
  if (near) for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.add(new THREE.BoxGeometry(0.006, 0.0075, 0.004), Math.sin(a) * 0.022, 0.0645, Math.cos(a) * 0.022, "#8c918c", a);
  }
}

function glassGardens(b: CastleBuilder, depth: number, near: boolean): void {
  [-1, 1].forEach(side => {
    b.add(new THREE.BoxGeometry(0.05, 0.008 + depth, 0.022).translate(0, -depth / 2, 0), 0, 0.004, side * 0.014, "#7d827f");
    const roof = new THREE.Shape();
    roof.moveTo(-0.011, 0); roof.lineTo(0.011, 0); roof.lineTo(0, 0.011); roof.closePath();
    b.add(new THREE.ExtrudeGeometry(roof, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025).rotateY(Math.PI / 2), 0, 0.008, side * 0.014, "#a7c4bf", 0, 4);
    if (near) for (let i = -2; i <= 2; i++) b.add(new THREE.BoxGeometry(0.0009, 0.012, 0.0225), i * 0.012, 0.012, side * 0.014, "#3f3a33", 0, 2);
  });
}

function tree(b: CastleBuilder, x: number, y: number, z: number, h: number, kind: "pine" | "oak" | "weirwood", near: boolean, seed: number): void {
  if (kind == "weirwood") {
    // The heart tree: pale bark and a red crown, beside the black pool.
    b.add(new THREE.CylinderGeometry(0.0022, 0.0034, h * 0.7, 6), x, y + h * 0.35, z, "#e6e0d1");
    for (let i = 0; i < (near ? 5 : 3); i++) b.add(new THREE.SphereGeometry(h * 0.33, near ? 7 : 5, 4).scale(1, 0.7, 1), x + Math.sin(i * 2.4) * h * 0.24, y + h * 0.78 + i % 2 * 0.003, z + Math.cos(i * 2.4) * h * 0.24, i % 2 ? "#8e3530" : "#ad4a3d");
    b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.002, near ? 12 : 7), x + 0.022, y + 0.001, z + 0.008, "#1f2a2e", 0, 4);
    return;
  }
  if (near) b.add(new THREE.CylinderGeometry(0.0012, 0.0018, h * 0.3, 5), x, y + h * 0.15, z, "#4f3d2e", 0, 2);
  if (kind == "pine") b.add(new THREE.ConeGeometry(h * 0.3, h * 0.85, near ? 7 : 5), x, y + h * 0.55, z, seed % 3 ? "#2c4537" : "#344d3c");
  else b.add(new THREE.SphereGeometry(h * 0.36, near ? 7 : 5, near ? 5 : 3), x, y + h * 0.6, z, seed % 2 ? "#4a5d3b" : "#3f5636");
}

function boat(b: CastleBuilder, s: Strip, near: boolean): void {
  const hull = new THREE.Shape();
  hull.moveTo(-s.length / 2, 0); hull.lineTo(s.length * 0.36, 0); hull.lineTo(s.length / 2, s.width * 0.5);
  hull.lineTo(s.length * 0.36, s.width); hull.lineTo(-s.length / 2, s.width); hull.closePath();
  b.add(new THREE.ExtrudeGeometry(hull, { depth: 0.004, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.004, -s.width / 2), s.x, s.y, s.z, "#5d4532", s.yaw, 2);
  if (!near) return;
  b.add(new THREE.CylinderGeometry(0.0006, 0.0006, 0.026, 4), s.x, s.y + 0.015, s.z, "#4a3a2c", 0, 2);
  b.add(new THREE.PlaneGeometry(0.012, 0.014), s.x, s.y + 0.017, s.z, "#d9cdb1", s.yaw + Math.PI / 2);
}

// ---- World ×20 (k = 20) physical cities: the same landmark studies at a
// nominal scale, unseated and centred, for PhysicalCity to scale into metres.

export type PhysicalLandmark = "great-sept" | "dragonpit" | "broken-tower" | "first-keep" | "glass-gardens" | "citadel" | "sept" | "merman"
  | "starry-sept" | "wolfs-den" | "sun-tower" | "seal-rock";

/** One landmark's merged geometry at the nominal (k = 1) size, origin at its ground centre; `depth` extends its base down. */
export function landmarkPart(kind: PhysicalLandmark, style: CityLayoutSpec["style"], depth: number, near: boolean, whiteMarble = false): THREE.BufferGeometry {
  const b = new CastleBuilder(style, false);
  if (kind == "great-sept") greatSept(b, depth, near, whiteMarble);
  else if (kind == "dragonpit") dragonpit(b, depth, near);
  else if (kind == "broken-tower") brokenTower(b, depth, near);
  else if (kind == "first-keep") firstKeep(b, depth, near);
  else if (kind == "glass-gardens") glassGardens(b, depth, near);
  else if (kind == "citadel") citadel(b, depth, near);
  else if (kind == "sept") septSmall(b, depth, near);
  else if (kind == "starry-sept") vaultedTemple(b, depth, near);
  else if (kind == "wolfs-den") riverFort(b, depth, near);
  else if (kind == "sun-tower") domedTower(b, depth, near);
  else if (kind == "seal-rock") harborRock(b, depth, near);
  else merman(b, depth, near);
  return b.finish();
}

/** Godswood tree at nominal scale (h in nominal units), origin at its foot. */
export function treePart(style: CityLayoutSpec["style"], h: number, kind: "pine" | "oak" | "weirwood", near: boolean, seed: number): THREE.BufferGeometry {
  const b = new CastleBuilder(style, false);
  tree(b, 0, 0, 0, h, kind, near, seed);
  return b.finish();
}

// the old city's Citadel (inferred): a domed hall over a cloister court with two
// lesser domes and a squat tower, pale stone (study, not a copy).
function citadel(b: CastleBuilder, depth: number, near: boolean): void {
  // Round 2: the old city grey — weathered stone halls under lead domes.
  const stone = "#aaa69c", dome = "#6f7b7d", n = near ? 14 : 8;
  b.add(new THREE.BoxGeometry(0.15, 0.012 + depth, 0.11).translate(0, -depth / 2, 0), 0, 0.006, 0, "#9b978e");
  // Cloister ranges round a court.
  [[0, -0.045, 0.14, 0.018], [0, 0.045, 0.14, 0.018], [-0.062, 0, 0.018, 0.072], [0.062, 0, 0.018, 0.072]].forEach(([x, z, w, d]) => {
    b.add(new THREE.BoxGeometry(w, 0.022, d), x, 0.023, z, stone);
    if (near) b.add(new THREE.BoxGeometry(w + 0.002, 0.002, d + 0.002), x, 0.035, z, "#5d6468", 0, 1);
  });
  b.add(new THREE.CylinderGeometry(0.026, 0.028, 0.03, n), -0.025, 0.027, 0, stone);
  b.add(new THREE.LatheGeometry(Array.from({ length: near ? 7 : 4 }, (_, i) => { const a = i / (near ? 6 : 3) * Math.PI / 2; return new THREE.Vector2(0.027 * Math.cos(a), 0.026 * Math.sin(a)); }), n), -0.025, 0.042, 0, dome, 0, 1);
  [[0.03, -0.028], [0.03, 0.028]].forEach(([x, z]) => {
    b.add(new THREE.CylinderGeometry(0.011, 0.012, 0.02, n), x, 0.022, z, stone);
    b.add(new Sphere(0.0115, n, 4, 0, Math.PI * 2, 0, Math.PI / 2), x, 0.032, z, dome, 0, 1);
  });
  b.add(new THREE.BoxGeometry(0.016, 0.06, 0.016), 0.058, 0.036, -0.04, stone);
  b.add(new THREE.ConeGeometry(0.012, 0.016, 4), 0.058, 0.074, -0.04, dome, Math.PI / 4, 1);
}

// K5 `sept-small`: a heptagonal sept with a low spire.
function septSmall(b: CastleBuilder, depth: number, near: boolean): void {
  const stone = "#e3dccb";
  b.add(new THREE.CylinderGeometry(0.034, 0.036, 0.008 + depth, 7).translate(0, -depth / 2, 0), 0, 0.004, 0, "#d1c8b4");
  b.add(new THREE.CylinderGeometry(0.026, 0.028, 0.03, 7), 0, 0.023, 0, stone);
  b.add(new THREE.ConeGeometry(0.03, 0.022, 7), 0, 0.049, 0, "#9c8a72", 0, 1);
  b.add(new THREE.CylinderGeometry(0.006, 0.007, 0.03, near ? 7 : 5), 0, 0.072, 0, stone);
  b.add(new THREE.ConeGeometry(0.0075, 0.018, near ? 7 : 5), 0, 0.096, 0, "#9c8a72", 0, 1);
}

// White Harbor's merman (bible: always lower than the castle banner): a
// stylised figure with a trident on a round plinth.
function merman(b: CastleBuilder, depth: number, near: boolean): void {
  const bronze = "#6f7d74";
  b.add(new THREE.CylinderGeometry(0.02, 0.023, 0.012 + depth, near ? 12 : 8).translate(0, -depth / 2, 0), 0, 0.006, 0, "#d9d6cc");
  b.add(new THREE.CylinderGeometry(0.004, 0.007, 0.03, near ? 8 : 5), 0, 0.027, 0, bronze);
  b.add(new THREE.SphereGeometry(0.0045, near ? 8 : 5, near ? 6 : 4), 0, 0.046, 0, bronze);
  b.add(new THREE.CylinderGeometry(0.0009, 0.0009, 0.05, 4), 0.006, 0.04, 0, bronze);
  if (near) [-1, 0, 1].forEach(i => b.add(new THREE.ConeGeometry(0.0012, 0.006, 4), 0.006 + i * 0.002, 0.067, 0, bronze));
}

// ---- Round 2 studies, authored in metres at scale 10 (1 m = 0.002).
const metre = 1 / 500;
const mm = (v: number): number => v * metre;

// the old city's Starry Sept (inferred; books: the Faith's old seat): a heptagonal
// sept of dark grey stone under slate, seven turrets at the corners, a
// lantern drum and a tall spire crowned by a gilded seven-pointed star.
function vaultedTemple(b: CastleBuilder, depth: number, near: boolean): void {
  // Pale weathered limestone under dark slate: it stands out of the grey town.
  const stone = "#cfc9b9", roof = "#3c4247", trim = "#b9b3a3", gold = "#cdb06a", n = 7;
  b.add(new THREE.CylinderGeometry(mm(36), mm(38), mm(2) + depth, n).translate(0, -depth / 2, 0), 0, mm(1), 0, trim);
  b.add(new THREE.CylinderGeometry(mm(27), mm(28), mm(18), n), 0, mm(11), 0, stone);
  b.add(new THREE.ConeGeometry(mm(30), mm(10), n), 0, mm(25), 0, roof, 0, 1);
  b.add(new THREE.CylinderGeometry(mm(10), mm(11), mm(10), n), 0, mm(33), 0, stone);
  b.add(new THREE.ConeGeometry(mm(11), mm(30), n), 0, mm(53), 0, roof, 0, 1);
  // The star: two crossed flat heptagrams read as a seven-pointed star.
  b.add(new THREE.OctahedronGeometry(mm(2.6)), 0, mm(70), 0, gold, 0, 1);
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) * Math.PI * 2 / n, x = Math.sin(a) * mm(28), z = Math.cos(a) * mm(28);
    b.add(new THREE.CylinderGeometry(mm(3.4), mm(3.8), mm(24), near ? 8 : 5), x, mm(13), z, stone);
    b.add(new THREE.ConeGeometry(mm(4), mm(9), near ? 8 : 5), x, mm(29.5), z, roof, 0, 1);
    if (near) b.add(new THREE.PlaneGeometry(mm(2.4), mm(9)), Math.sin(i * Math.PI * 2 / n) * mm(26.1), mm(12), Math.cos(i * Math.PI * 2 / n) * mm(26.1), "#2e3237", i * Math.PI * 2 / n, 3);
  }
  for (let i = 0; i < (near ? 4 : 2); i++) b.add(new THREE.BoxGeometry(mm(24 - i * 3), mm(0.6) + depth, mm(4)).translate(0, -depth / 2, 0), 0, mm(0.3 + i * 0.6), mm(38 + 8 - i * 4), trim);
}

// White Harbor's Wolf's Den (inferred; books: the town's old castle, later a
// gaol): a dark square keep under slate inside a low curtain with round
// corner towers and a gatehouse on the harbour side (local +Z).
function riverFort(b: CastleBuilder, depth: number, near: boolean): void {
  const stone = "#6f726e", dark = "#5f625e", roof = "#3b4442", half = mm(36), wallH = mm(9), thick = mm(3);
  b.add(new THREE.BoxGeometry(half * 2 + mm(6), mm(2) + depth, half * 2 + mm(6)).translate(0, -depth / 2, 0), 0, mm(1), 0, dark);
  [[0, -half, half * 2, thick], [-half, 0, thick, half * 2]].forEach(([x, z, w, d]) => {
    b.add(new THREE.BoxGeometry(w, wallH, d), x, mm(2) + wallH / 2, z, stone);
    b.add(new THREE.BoxGeometry(w, wallH, d), -x, mm(2) + wallH / 2, -z, stone);
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, k]) => {
    b.add(new THREE.CylinderGeometry(mm(5), mm(5.6), mm(15), near ? 10 : 6), i * half, mm(9.5), k * half, stone);
    b.add(new THREE.ConeGeometry(mm(6), mm(8), near ? 10 : 6), i * half, mm(21), k * half, roof, 0, 1);
  });
  b.add(new THREE.BoxGeometry(mm(14), mm(14), mm(8)), 0, mm(9), half, stone);
  if (near) b.add(new THREE.PlaneGeometry(mm(5), mm(7)), 0, mm(5.5), half + mm(4.05), "#2c2a27", 0, 2);
  b.add(new THREE.BoxGeometry(mm(22), mm(26), mm(22)), mm(-6), mm(15), mm(-6), stone);
  b.add(new THREE.ConeGeometry(mm(17), mm(10), 4), mm(-6), mm(33), mm(-6), roof, Math.PI / 4, 1);
  if (near) [-1, 1].forEach(side => b.add(new THREE.PlaneGeometry(mm(2), mm(4)), mm(-6) + side * mm(5), mm(20), mm(5.05), "#2e3237", 0, 3));
}

// the desert seat's Tower of the Sun (inferred; books): a sandstone drum under a
// gilded dome, with the slender Spear Tower beside it. Only drawn when the
// castle has no physical complex of its own (P3·C2 carries it otherwise).
function domedTower(b: CastleBuilder, depth: number, near: boolean): void {
  const sand = "#d6b688", gold = "#c9a24a", n = near ? 20 : 10;
  b.add(new THREE.CylinderGeometry(mm(20), mm(21), mm(4) + depth, n).translate(0, -depth / 2, 0), 0, mm(2), 0, "#c9a67a");
  b.add(new THREE.CylinderGeometry(mm(14), mm(15), mm(30), n), 0, mm(19), 0, sand);
  b.add(new Sphere(mm(15), n, near ? 8 : 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, mm(34), 0, gold, 0, 1);
  b.add(new THREE.CylinderGeometry(mm(3.2), mm(4), mm(62), near ? 10 : 6), mm(26), mm(31), mm(-8), sand);
  b.add(new THREE.ConeGeometry(mm(1.6), mm(12), near ? 8 : 5), mm(26), mm(68), mm(-8), gold, 0, 1);
}

// Seal Rock (inferred; books: an island in White Harbor's bay with an old
// ruined fort): a low weathered rock with a broken round tower.
function harborRock(b: CastleBuilder, depth: number, near: boolean): void {
  const rock = new THREE.SphereGeometry(mm(40), near ? 12 : 7, near ? 7 : 4);
  const p = rock.getAttribute("position") as unknown as { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number; setXYZ(i: number, x: number, y: number, z: number): void };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 0.82 + 0.18 * Math.sin(x * 900 + z * 700) * Math.cos(z * 1100 - y * 500);
    p.setXYZ(i, x * n, y > 0 ? y * 0.42 * n : y * (1 + depth / mm(40)), z * n * 0.8);
  }
  rock.computeVertexNormals();
  // Surface 6: the castle shader's weathered rock (mineral seams), not masonry.
  b.add(rock, 0, 0, 0, "#77746b", 0, 6);
  b.add(new THREE.CylinderGeometry(mm(5.5), mm(6.5), mm(12), near ? 10 : 6), mm(6), mm(18), mm(-4), "#8a8780");
  // The broken crown: one high stub of the ring.
  b.add(new THREE.BoxGeometry(mm(4), mm(5), mm(2.2)), mm(8.5), mm(26.5), mm(-4), "#8a8780", 0.4);
}

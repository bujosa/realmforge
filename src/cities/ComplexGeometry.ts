import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { METRES_PER_UNIT } from "../core/SceneFrame";
import CastleBuilder from "../castles/CastleBuilder";
import { buildIslandFortress } from "../castles/IslandFortress";
import { castlePalettes } from "../castles/castleStyles";
import { buildDragonstoneCarvings } from "./CrownSeatArt";
import { ComplexPlan, HeroPlan, Prop, rockDrift, rockShrink, RoofKind, Seated } from "./ComplexPlan";

// Physical castle complexes, authored in metres and built through the shared
// CastleBuilder (vertex colours, surface tags, box UVs, one merged draw). The
// UV scale stays physical: a stone course is ~0.6 m on every piece, so walls
// are built at their real size rather than stretched instances.

const U = 1 / METRES_PER_UNIT;
const SLIT = "#25292d";

type B = CastleBuilder;

/** Smooth-shaded triangle soup (metres → scene units): shared vertices are welded first. */
function surface(points: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.map(v => v * U), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(points.length / 3 * 2), 2));
  const welded = mergeVertices(geometry, 1e-4);
  geometry.dispose();
  welded.computeVertexNormals();
  return welded;
}

/** Plain box in metres (no bevel; used for small repeated parts). */
function block(b: B, w: number, h: number, d: number, x: number, y: number, z: number, color: string, angle = 0, surface = 0): void {
  b.add(new THREE.BoxGeometry(w * U, h * U, d * U), x * U, y * U, z * U, color, angle, surface);
}

/** Bevelled masonry box in metres (bevel only in the detailed form). */
function mass(b: B, w: number, h: number, d: number, x: number, y: number, z: number, color = b.palette.stone, angle = 0, surface = 0): void {
  b.box(w * U, h * U, d * U, x * U, y * U, z * U, color, angle, surface);
}

/** Rotate a local offset by a three.js Y rotation `angle`. */
function turn(lx: number, lz: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [lx * c + lz * s, -lx * s + lz * c];
}

function roof(b: B, kind: RoofKind, x: number, z: number, y: number, rx: number, rz: number, square: boolean): void {
  const p = b.palette;
  const segments = square ? 4 : b.detailed ? 20 : 10;
  if (kind == "cone" || kind == "pyramid") {
    const h = kind == "cone" ? Math.max(rx, rz) * 2.1 : Math.max(rx, rz) * 0.9;
    const cone = new THREE.ConeGeometry(1, 1, segments);
    if (square) cone.rotateY(Math.PI / 4).scale(Math.SQRT2, 1, Math.SQRT2);
    cone.scale(rx * U, h * U, rz * U);
    b.add(cone, x * U, (y + h / 2) * U, z * U, p.roof, 0, 1, 1);
    if (b.detailed) b.add(new THREE.ConeGeometry(0.35 * U, 3 * U, 6), x * U, (y + h + 1.2) * U, z * U, p.trim);
  } else if (kind == "dome") {
    const r = Math.max(rx, rz);
    const steps = b.detailed ? 8 : 4;
    const dome = new THREE.LatheGeometry(Array.from({ length: steps + 1 }, (_, i) => new THREE.Vector2(r * U * Math.cos(i * Math.PI / 2 / steps), r * U * Math.sin(i * Math.PI / 2 / steps))), b.detailed ? 20 : 10);
    dome.scale(rx / r, 0.9, rz / r);
    b.add(dome, x * U, y * U, z * U, p.roof, 0, 1);
    if (b.detailed) b.add(new THREE.ConeGeometry(0.5 * U, 4 * U, 6), x * U, (y + r * 0.9 + 1.8) * U, z * U, p.trim);
  }
}

/** Ring of merlons on a round crown. */
function roundCrown(b: B, x: number, z: number, r: number, y: number): void {
  const p = b.palette;
  b.add(new THREE.CylinderGeometry(r * 1.1 * U, r * 0.98 * U, 1.4 * U, b.detailed ? 24 : 12), x * U, (y - 0.7) * U, z * U, p.trim);
  if (!b.detailed) {
    b.add(new THREE.CylinderGeometry(r * 1.1 * U, r * 1.1 * U, 1.4 * U, 12), x * U, (y + 0.7) * U, z * U, p.stone);
    return;
  }
  const count = Math.max(8, Math.round(Math.PI * 2 * r * 1.1 / 3));
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count;
    block(b, 1.6, 1.8, 0.8, x + Math.sin(a) * r * 1.05, y + 0.9, z + Math.cos(a) * r * 1.05, p.stone, a);
  }
}

/** Merlons along a straight crown edge from (x0, z0) to (x1, z1). */
function edgeCrown(b: B, x0: number, z0: number, x1: number, z1: number, y: number, thickness = 0.8): void {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const angle = -Math.atan2(z1 - z0, x1 - x0);
  if (!b.detailed) {
    block(b, length, 1.4, thickness, (x0 + x1) / 2, y + 0.7, (z0 + z1) / 2, b.palette.stone, angle);
    return;
  }
  const count = Math.max(1, Math.round(length / 3));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    block(b, Math.min(1.7, length / count * 0.6), 1.8, thickness, x0 + (x1 - x0) * t, y + 0.9, z0 + (z1 - z0) * t, b.palette.stone, angle);
  }
}

/**
 * A light window for physical complexes (scene units, like CastleBuilder.window):
 * a stone frame and a recessed pane that glows at dusk (tag 3). 24 triangles
 * instead of the arched kit's ~170 — keeps and halls carry dozens of them.
 */
function pane(b: B, x: number, y: number, z: number, angle: number, w: number, h: number): void {
  if (!b.detailed) return;
  b.add(new THREE.BoxGeometry(w + 0.012, h + 0.012, 0.008), x, y, z, b.palette.trim, angle);
  b.add(new THREE.BoxGeometry(w, h, 0.012), x, y, z, "#494540", angle, 3);
}

function slits(b: B, x: number, z: number, r: number, from: number, to: number, round: boolean, seed: number): void {
  if (!b.detailed) return;
  const levels = Math.max(1, Math.floor((to - from) / 9));
  for (let level = 0; level < levels; level++) {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + (level % 2) * Math.PI / 4 + seed;
      const d = round ? r + 0.05 : r / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) + 0.05;
      block(b, 0.55, 2.2, 0.3, x + Math.sin(a) * d, from + (level + 0.6) * (to - from) / levels, z + Math.cos(a) * d, SLIT, a);
    }
  }
}

function curtain(b: B, s: Extract<Seated, { type: "curtain" }>): void {
  const p = b.palette;
  const [ax, az] = s.a, [bx, bz] = s.b;
  const length = Math.hypot(bx - ax, bz - az) + 0.6;
  const angle = -Math.atan2(bz - az, bx - ax);
  const x = (ax + bx) / 2, z = (az + bz) / 2;
  const top = s.top;
  mass(b, length, top - s.base, s.t, x, (s.base + top) / 2, z, p.stone, angle);
  // Battered footing: the wall widens where it meets the slope.
  block(b, length, s.ground - s.base + 3.2, s.t + 2.2, x, (s.base + s.ground + 3.2) / 2, z, p.stone, angle);
  if (s.ruined) {
    if (b.detailed) for (let i = 0; i < 3; i++) block(b, length * 0.22, 1 + (i % 2) * 1.6, s.t * 0.9, x + Math.cos(angle) * (i - 1) * length * 0.3, top + 0.5, z - Math.sin(angle) * (i - 1) * length * 0.3, p.stone, angle);
    return;
  }
  block(b, length, 0.6, s.t + 0.6, x, top - 1.6, z, p.trim, angle);
  // Wall walk: merlons on the outer parapet (away from the ward's centre), a plain parapet inside.
  const [nx, nz] = turn(0, s.t / 2 - 0.4, angle);
  const outer = nx * x + nz * z >= 0 ? 1 : -1;
  edgeCrown(b, ax + nx * outer, az + nz * outer, bx + nx * outer, bz + nz * outer, top, 0.8);
  block(b, length, 1.1, 0.6, x - nx * outer, top + 0.55, z - nz * outer, p.stone, angle);
}

function tower(b: B, s: Extract<Seated, { type: "tower" }>, seed: number): void {
  if (s.ruin == "melted") { meltedTower(b, s, seed); return; }
  const p = b.palette;
  const shaftTop = s.ground + s.h;
  if (s.round) {
    b.add(new THREE.CylinderGeometry(s.r * U, s.r * 1.05 * U, (shaftTop - s.base) * U, b.detailed ? 24 : 12), s.x * U, (s.base + shaftTop) / 2 * U, s.z * U);
    b.add(new THREE.CylinderGeometry(s.r * 1.12 * U, s.r * 1.22 * U, (s.ground - s.base + 4) * U, b.detailed ? 24 : 12), s.x * U, (s.base + s.ground + 4) / 2 * U, s.z * U);
  } else {
    mass(b, s.r * 2, shaftTop - s.base, s.r * 2, s.x, (s.base + shaftTop) / 2, s.z);
    block(b, s.r * 2.3, s.ground - s.base + 4, s.r * 2.3, s.x, (s.base + s.ground + 4) / 2, s.z, p.stone);
  }
  if (s.ruin == "broken") {
    // Broken crown: shards of uneven height around an open top.
    const count = s.round ? 9 : 8;
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count;
      const rise = (Math.sin(i * 2.7 + seed) * 0.5 + 0.5) * s.h * 0.18;
      block(b, s.r * 0.7, rise + 1, 1.6, s.x + Math.sin(a) * s.r * 0.85, shaftTop + rise / 2, s.z + Math.cos(a) * s.r * 0.85, i % 3 ? p.stone : "#4b4f4c", a);
    }
    slits(b, s.x, s.z, s.r, s.ground + 4, shaftTop - 4, s.round, seed);
    return;
  }
  if (s.round) roundCrown(b, s.x, s.z, s.r, shaftTop);
  else {
    block(b, s.r * 2.25, 1.2, s.r * 2.25, s.x, shaftTop - 0.6, s.z, p.trim);
    const e = s.r * 1.05;
    [[-e, -e, e, -e], [e, -e, e, e], [e, e, -e, e], [-e, e, -e, -e]].forEach(([x0, z0, x1, z1]) => edgeCrown(b, s.x + x0, s.z + z0, s.x + x1, s.z + z1, shaftTop));
  }
  roof(b, s.roof, s.x, s.z, shaftTop + (s.roof == "dome" ? 0 : 0.4), s.r * 1.18, s.r * 1.18, !s.round);
  slits(b, s.x, s.z, s.r, s.ground + 4, shaftTop - 3, s.round, seed);
}

/**
 * the ruined fortress: a tower «like melted wax»: slumped, dripping crowns of scorched
 * grey stone, lighter courses showing through the soot, glassy where the
 * dragonfire vitrified it (darker, never black, catching the sky).
 */
function meltedTower(b: B, s: Extract<Seated, { type: "tower" }>, seed: number): void {
  const rings = b.detailed ? 20 : 9, sides = b.detailed ? 28 : 14;
  const top = s.ground + s.h;
  // Tone bands, mixed face by face: weathered stone, soot, dark soot, vitrified glaze, pale patches.
  const bands: { color: string; surface: number; points: number[] }[] = [
    { color: "#7f7b70", surface: 0, points: [] }, { color: "#615f58", surface: 0, points: [] }, { color: "#4e4e4b", surface: 0, points: [] },
    { color: "#4a4c4f", surface: 4, points: [] }, { color: "#85816f", surface: 0, points: [] }
  ];
  const vertex = (ring: number, side: number): [number, number, number] => {
    const t = ring / rings, a = side / sides * Math.PI * 2;
    // Molten rivulets down the upper half, a slumped, bulging crown.
    const drip = Math.pow(Math.max(0, Math.sin(a * 5 + seed * 1.7)), 6) * Math.max(0, t - 0.4) * 0.7;
    const slump = t > 0.62 ? Math.pow((t - 0.62) / 0.38, 2) * 0.34 : 0;
    const wobble = Math.sin(a * 3 + seed + t * 4) * 0.05 + Math.sin(a * 7 - t * 9) * 0.03 * t;
    const r = s.r * (1.06 - 0.12 * t + slump + wobble + drip * 0.12);
    // The crown sags unevenly: one side melted far lower than the other, in lobes.
    const sag = t > 0.85 ? ((Math.sin(a + seed) * 0.5 + 0.5) * s.h * 0.2 + Math.pow(Math.max(0, Math.sin(a * 4 + seed)), 3) * s.h * 0.07) * (t - 0.85) / 0.15 : 0;
    const y = s.base + (top - s.base) * t - drip * s.h * 0.1 - sag;
    return [s.x + Math.sin(a) * r, y, s.z + Math.cos(a) * r];
  };
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / rings;
    for (let side = 0; side < sides; side++) {
      const a = vertex(ring, side), c = vertex(ring, side + 1), d = vertex(ring + 1, side), e = vertex(ring + 1, side + 1);
      const h = Math.abs(Math.sin(ring * 31.7 + side * 7.3 + seed * 3.1) * 43758.5453) % 1;
      const band = t < 0.3 ? (h < 0.6 ? 0 : 1) : t < 0.62 ? (h < 0.6 ? 1 : h < 0.88 ? 2 : 4) : (h < 0.5 ? 3 : h < 0.9 ? 2 : 4);
      bands[band].points.push(...a, ...e, ...c, ...a, ...d, ...e);
    }
  }
  bands.filter(band => band.points.length).forEach(band => {
    b.add(surface(band.points), 0, 0, 0, band.color, 0, band.surface);
  });
  if (b.detailed) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + seed;
      block(b, 1.2, 3.2, 0.4, s.x + Math.sin(a) * s.r * 1.02, s.ground + s.h * (0.25 + (i % 3) * 0.17), s.z + Math.cos(a) * s.r * 1.02, SLIT, a);
    }
  }
}

function gatehouse(b: B, s: Extract<Seated, { type: "gatehouse" }>): void {
  const p = b.palette;
  const at = (lx: number, lz: number): [number, number] => { const [dx, dz] = turn(lx, lz, s.angle); return [s.x + dx, s.z + dz]; };
  const span = s.w / 2 + s.r * 0.75;
  [-1, 1].forEach(side => {
    const [x, z] = at(side * span, s.r * 0.25);
    tower(b, { type: "tower", x, z, r: s.r, h: s.h, round: s.round, roof: "none", base: s.base, ground: s.ground, top: s.top }, side);
  });
  const [cx, cz] = at(0, 0);
  const top = s.ground + s.h - 3;
  mass(b, s.w + s.r, top - s.base, s.r * 2.2, cx, (s.base + top) / 2, cz, p.stone, s.angle);
  block(b, s.w + s.r + 0.6, 0.7, s.r * 2.2 + 1.4, cx, top - 0.35, cz, p.trim, s.angle);
  const [fx, fz] = at(0, s.r * 1.1);
  // Machicolation band, the dark arch and the portcullis.
  block(b, s.w + s.r, 1.4, 1.6, fx, top - 3, fz, p.trim, s.angle);
  block(b, s.w * 0.62, s.h * 0.45, 0.6, fx, s.ground + s.h * 0.225, fz, "#232629", s.angle);
  if (b.detailed) {
    for (let i = -3; i <= 3; i++) {
      const [gx, gz] = at(i * s.w * 0.08, s.r * 1.12 + 0.35);
      block(b, 0.18, s.h * 0.4, 0.18, gx, s.ground + s.h * 0.2, gz, "#3e3a33", s.angle);
    }
    [0.12, 0.3].forEach(rise => { const [gx, gz] = at(0, s.r * 1.12 + 0.35); block(b, s.w * 0.6, 0.25, 0.2, gx, s.ground + s.h * rise, gz, "#3e3a33", s.angle); });
  }
  const [x0, z0] = at(-(s.w + s.r) / 2, s.r * 1.1), [x1, z1] = at((s.w + s.r) / 2, s.r * 1.1);
  edgeCrown(b, x0, z0, x1, z1, top);
  // Paved threshold through the gate passage.
  const [px, pz] = at(0, s.r * 2.2);
  block(b, s.w * 0.8, 0.5, s.r * 3, px, s.ground + 0.1, pz, "#8a8272", s.angle);
}

function keep(b: B, s: Extract<Seated, { type: "keep" }>, seed: number): void {
  const p = b.palette;
  const top = s.ground + s.h;
  mass(b, s.w, top - s.base, s.d, s.x, (s.base + top) / 2, s.z);
  block(b, s.w + 2.2, s.ground - s.base + 4, s.d + 2.2, s.x, (s.base + s.ground + 4) / 2, s.z, p.stone);
  [0.33, 0.66].forEach(t => block(b, s.w + 0.6, 0.5, s.d + 0.6, s.x, s.ground + s.h * t, s.z, p.trim));
  block(b, s.w + 1.6, 1.3, s.d + 1.6, s.x, top - 0.65, s.z, p.trim);
  const ex = s.w / 2 + 0.4, ez = s.d / 2 + 0.4;
  if (s.roof == "none" || s.roof == "dome") {
    [[-ex, -ez, ex, -ez], [ex, -ez, ex, ez], [ex, ez, -ex, ez], [-ex, ez, -ex, -ez]].forEach(([x0, z0, x1, z1]) => edgeCrown(b, s.x + x0, s.z + z0, s.x + x1, s.z + z1, top));
  }
  if (s.roof == "pyramid") roof(b, "pyramid", s.x, s.z, top, s.w * 0.52, s.d * 0.52, true);
  else if (s.roof == "cone") roof(b, "cone", s.x, s.z, top, Math.min(s.w, s.d) * 0.42, Math.min(s.w, s.d) * 0.42, false);
  else if (s.roof == "dome") roof(b, "dome", s.x, s.z, top + 1, Math.min(s.w, s.d) * 0.4, Math.min(s.w, s.d) * 0.4, false);
  if (s.turrets) {
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j]) => {
      const x = s.x + i * s.w / 2, z = s.z + j * s.d / 2, r = Math.min(s.w, s.d) * 0.1 + 1;
      b.add(new THREE.CylinderGeometry(r * U, r * 0.6 * U, 12 * U, b.detailed ? 14 : 8), x * U, (top - 4) * U, z * U);
      if (s.roof != "none") roof(b, "cone", x, z, top + 2, r * 1.15, r * 1.15, false);
      else roundCrown(b, x, z, r, top + 2);
    });
  }
  if (b.detailed) {
    // Rows of tall windows on every face, smaller near the ground.
    [0.5, 0.72, 0.88].forEach((t, row) => {
      for (let face = 0; face < 4; face++) {
        const a = face * Math.PI / 2;
        const half = face % 2 ? s.d / 2 : s.w / 2, depth = face % 2 ? s.w / 2 : s.d / 2;
        const count = Math.max(2, Math.floor(half * 2 / 7));
        for (let i = 0; i < count; i++) {
          const along = (i + 0.5) / count * half * 2 - half;
          const [dx, dz] = turn(along, depth + 0.05, a);
          pane(b, (s.x + dx) * U, (s.ground + s.h * t) * U, (s.z + dz) * U, a, row ? 0.026 : 0.02, row ? 0.07 : 0.05);
        }
      }
    });
    block(b, 2.2, 7, 2.2, s.x - s.w * 0.3, top + 2.5, s.z - s.d * 0.2, p.stone);
  }
  void seed;
}

function hall(b: B, s: Extract<Seated, { type: "hall" }>): void {
  const p = b.palette;
  const top = s.ground + s.h;
  mass(b, s.w, top - s.base, s.d, s.x, (s.base + top) / 2, s.z, p.stone, s.angle);
  const rise = s.d * 0.42;
  const shape = new THREE.Shape();
  shape.moveTo(-s.d / 2 - 0.6, 0); shape.lineTo(s.d / 2 + 0.6, 0); shape.lineTo(0, rise); shape.closePath();
  const gable = new THREE.ExtrudeGeometry(shape, { depth: s.w + 1.2, bevelEnabled: false }).translate(0, 0, -(s.w + 1.2) / 2).rotateY(Math.PI / 2);
  gable.scale(U, U, U);
  b.add(gable, s.x * U, top * U, s.z * U, s.glass ? "#9fb9b4" : p.roof, s.angle, s.glass ? 4 : 1, 1);
  if (b.detailed) {
    const count = Math.max(2, Math.floor(s.w / 6));
    [-1, 1].forEach(side => {
      for (let i = 0; i < count; i++) {
        const [dx, dz] = turn((i + 0.5) / count * s.w - s.w / 2, side * (s.d / 2 + 0.05), s.angle);
        pane(b, (s.x + dx) * U, (s.ground + s.h * 0.55) * U, (s.z + dz) * U, s.angle + (side > 0 ? 0 : Math.PI), 0.024, Math.min(0.11, s.h * 0.45 * U));
      }
    });
  }
}

function drum(b: B, s: Extract<Seated, { type: "drum" }>): void {
  const p = b.palette;
  const top = s.ground + s.h;
  b.add(new THREE.CylinderGeometry(s.r * U, s.r * 1.08 * U, (top - s.base) * U, b.detailed ? 40 : 18), s.x * U, (s.base + top) / 2 * U, s.z * U);
  [0.3, 0.62].forEach(t => b.add(new THREE.CylinderGeometry(s.r * 1.02 * U, s.r * 1.03 * U, 0.6 * U, b.detailed ? 40 : 18), s.x * U, (s.ground + s.h * t) * U, s.z * U, p.trim));
  if (s.roof == "dome") roof(b, "dome", s.x, s.z, top, s.r * 0.98, s.r * 0.98, false);
  else roundCrown(b, s.x, s.z, s.r * 0.98, top);
  slits(b, s.x, s.z, s.r, s.ground + 6, top - 6, true, 0.4);
}

function structure(b: B, s: Seated, index: number): void {
  switch (s.type) {
    case "curtain": curtain(b, s); break;
    case "tower": tower(b, s, index * 0.37); break;
    case "gatehouse": gatehouse(b, s); break;
    case "keep": keep(b, s, index); break;
    case "hall": hall(b, s); break;
    case "drum": drum(b, s); break;
  }
}

/** Ward dressing (detailed form): well, stable, woodpile, carts, training yard, godswood trees. */
function prop(b: B, p: Prop): void {
  const wood = b.palette.wood, dark = "#3d3127", y = p.ground;
  const at = (lx: number, lz: number): [number, number] => { const [dx, dz] = turn(lx, lz, p.angle); return [p.x + dx, p.z + dz]; };
  switch (p.type) {
    case "garden-bed": {
      block(b, p.size + 0.6, 0.65, 3.4, p.x, y + 0.25, p.z, "#dedbcc", p.angle);
      block(b, p.size, 1.8, 2.6, p.x, y + 1.35, p.z, "#3c6843", p.angle, 7);
      for (let k = 0; k < 5; k++) {
        const [x, z] = at(-p.size * 0.4 + k * p.size * 0.2, 0);
        b.add(new THREE.SphereGeometry(0.7 * U, 6, 4).scale(1, 0.6, 1), x * U, (y + 2.35) * U, z * U, k % 2 ? "#d2aab6" : "#b07a85", p.angle, 7);
      }
      break;
    }
    case "well": {
      b.add(new THREE.CylinderGeometry(1.7 * U, 1.8 * U, 1.1 * U, 12), p.x * U, (y + 0.55) * U, p.z * U, b.palette.stone);
      b.add(new THREE.CylinderGeometry(1.25 * U, 1.25 * U, 0.2 * U, 12), p.x * U, (y + 1.02) * U, p.z * U, "#1f2326");
      [-1, 1].forEach(side => { const [x, z] = at(side * 1.4, 0); block(b, 0.25, 2.8, 0.25, x, y + 1.4, z, wood, p.angle, 2); });
      block(b, 3.1, 0.22, 0.22, p.x, y + 2.6, p.z, wood, p.angle, 2);
      b.add(new THREE.ConeGeometry(2.2 * U, 1.2 * U, 4).rotateY(Math.PI / 4), p.x * U, (y + 3.4) * U, p.z * U, b.palette.roof, p.angle, 1, 1);
      break;
    }
    case "stable": {
      // Timber stalls on a stone sill, an open front of dark stall doors, a lean-to roof.
      const w = p.size, d = 7;
      block(b, w, 0.8, d, p.x, y + 0.4, p.z, b.palette.stone, p.angle);
      block(b, w, 3.4, d, p.x, y + 2.5, p.z, wood, p.angle, 2);
      const [fx, fz] = at(0, d / 2 + 0.05);
      block(b, w * 0.92, 2.2, 0.15, fx, y + 1.9, fz, "#2a241f", p.angle);
      const count = Math.round(w / 3.5);
      for (let i = 0; i <= count; i++) { const [x, z] = at(-w / 2 + w * i / count, d / 2 + 0.15); block(b, 0.3, 3.4, 0.3, x, y + 2.5, z, dark, p.angle, 2); }
      const roof = new THREE.BoxGeometry((w + 1.2) * U, 0.35 * U, (d + 2) * U).rotateX(-0.28);
      b.add(roof, p.x * U, (y + 4.6) * U, p.z * U, b.palette.roof, p.angle, 1, 1);
      break;
    }
    case "woodpile":
      block(b, p.size, 1.6, 2.2, p.x, y + 0.8, p.z, "#6c5440", p.angle, 2);
      block(b, p.size + 0.6, 0.25, 2.8, p.x, y + 1.75, p.z, "#4d4a44", p.angle, 1);
      break;
    case "cart": {
      block(b, 3.4, 0.9, 1.7, p.x, y + 1.1, p.z, "#5d4733", p.angle, 2);
      const [hx, hz] = at(2.6, 0);
      block(b, 2, 0.12, 0.12, hx, y + 0.9, hz, dark, p.angle, 2);
      [-1, 1].forEach(side => {
        const [x, z] = at(-0.2, side * 0.95);
        b.add(new THREE.CylinderGeometry(0.62 * U, 0.62 * U, 0.16 * U, 10).rotateX(Math.PI / 2), x * U, (y + 0.62) * U, z * U, "#3c3026", p.angle, 2);
      });
      break;
    }
    case "yard": {
      // Packed sand, a post-and-rail fence and three pells.
      const w = p.size, d = p.size * 0.7;
      b.add(new THREE.BoxGeometry(w * U, 0.3 * U, d * U), p.x * U, (y + 0.05) * U, p.z * U, "#9c8c6c", p.angle, 7);
      const rail = (x0: number, z0: number, x1: number, z1: number): void => {
        const length = Math.hypot(x1 - x0, z1 - z0), count = Math.max(2, Math.round(length / 3));
        for (let i = 0; i <= count; i++) { const [x, z] = at(x0 + (x1 - x0) * i / count, z0 + (z1 - z0) * i / count); block(b, 0.22, 1.3, 0.22, x, y + 0.65, z, wood, p.angle, 2); }
        const [mx, mz] = at((x0 + x1) / 2, (z0 + z1) / 2);
        block(b, length, 0.14, 0.14, mx, y + 1.1, mz, wood, p.angle - Math.atan2(z1 - z0, x1 - x0), 2);
      };
      const hx = w / 2, hz = d / 2;
      rail(-hx, -hz, hx, -hz); rail(hx, -hz, hx, hz); rail(hx, hz, -hx, hz); rail(-hx, hz, -hx, -hz);
      [[-0.25, -0.15], [0.05, 0.2], [0.3, -0.2]].forEach(([u, v]) => {
        const [x, z] = at(u * w, v * d);
        block(b, 0.3, 1.9, 0.3, x, y + 0.95, z, wood, p.angle, 2);
        block(b, 1.2, 0.22, 0.22, x, y + 1.45, z, wood, p.angle + 0.4, 2);
      });
      break;
    }
    case "tree": {
      b.add(new THREE.CylinderGeometry(0.3 * U, 0.45 * U, p.size * 0.5 * U, 6), p.x * U, (y + p.size * 0.25) * U, p.z * U, "#4b3b2c", 0, 2);
      const crown = new THREE.SphereGeometry(1, 7, 5).scale(p.size * 0.32 * U, p.size * 0.3 * U, p.size * 0.3 * U);
      b.add(crown, p.x * U, (y + p.size * 0.66) * U, p.z * U, "#4f6136", p.angle, 7, 1);
      break;
    }
    case "conifer": {
      b.add(new THREE.CylinderGeometry(0.25 * U, 0.4 * U, p.size * 0.3 * U, 6), p.x * U, (y + p.size * 0.15) * U, p.z * U, "#45362a", 0, 2);
      [0, 1, 2].forEach(i => {
        const r = p.size * (0.24 - i * 0.06), h = p.size * (0.42 - i * 0.08);
        b.add(new THREE.ConeGeometry(r * U, h * U, 8), p.x * U, (y + p.size * (0.3 + i * 0.22) + h / 2) * U, p.z * U, i == 1 ? "#2f4531" : "#2a3e2c", p.angle + i, 7, 1);
      });
      break;
    }
    case "heart-tree": {
      // A weirwood: a pale, thick, twisted trunk under a crown of blood-red leaves.
      const trunk = new THREE.CylinderGeometry(0.75 * U, 1.3 * U, p.size * 0.55 * U, 9).rotateZ(0.06);
      b.add(trunk, p.x * U, (y + p.size * 0.27) * U, p.z * U, "#e4e0d5", p.angle);
      [[0, 0.72, 0, 0.36], [0.22, 0.64, 0.12, 0.26], [-0.2, 0.62, -0.1, 0.25]].forEach(([dx, dy, dz, r]) => {
        const [x, z] = at(dx * p.size, dz * p.size);
        b.add(new THREE.SphereGeometry(1, 8, 6).scale(r * p.size * U, r * p.size * 0.82 * U, r * p.size * U), x * U, (y + dy * p.size) * U, z * U, "#93261d", p.angle, 7);
      });
      break;
    }
  }
}

/** Palette of a complex: the miniature's own palette when it has one. */
export function complexBuilder(plan: ComplexPlan, detailed: boolean): CastleBuilder {
  // the ruined fortress: scorched grey stone, lighter courses through the soot (never black slabs).
  const palette = plan.recipe == "harrenhal" ? { stone: "#706d64", trim: "#827e72", roof: "#47484b" }
    : plan.recipe == "red-keep" ? { stone: "#ad6853", trim: "#c18b70", roof: "#753e34" }
    : plan.recipe == "casterly-summit" ? { stone: "#b9a477", trim: "#cdbb92", roof: "#8e4636" } : plan.palette;
  return new CastleBuilder(plan.style, detailed, undefined, { ...castlePalettes[plan.style], ...palette });
}

/**
 * Sliced build of a complex (local metres → scene units around the anchor,
 * raised by `plan.lift`). Yields between structures so a caller can spread
 * the work over frames; returns the merged geometry.
 */
export function* complexGeometry(plan: ComplexPlan, detailed: boolean): Generator<void, THREE.BufferGeometry, void> {
  const b = complexBuilder(plan, detailed);
  if (plan.recipe == "pyke-stacks") {
    buildIslandFortress(b);
    const geometry = b.finish(), uv = geometry.getAttribute("uv") as unknown as { count: number; getX(i: number): number; getY(i: number): number; setXY(i: number, x: number, y: number): void };
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 520 * U, uv.getY(i) * 260 * U);
    return geometry.scale(520 * U, 260 * U, 520 * U).translate(plan.offset[0] * U, plan.lift * U, plan.offset[1] * U);
  }
  const lifted = plan.lift ? plan.structures.map(s => ({ ...s, base: s.base + plan.lift, ground: s.ground + plan.lift, top: s.top + plan.lift }) as Seated) : plan.structures;
  for (let i = 0; i < lifted.length; i++) {
    structure(b, lifted[i], i);
    if (i % 6 == 5) yield;
  }
  if (plan.recipe == "dragonstone") buildDragonstoneCarvings(b, plan);
  if (detailed) {
    plan.props.forEach(p => prop(b, plan.lift ? { ...p, ground: p.ground + plan.lift } : p));
    yield;
  }
  return b.finish();
}

const smoothstep = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Castle surface tag of hero rock (ComplexMaterial's HeroMaterial: bedding planes, joints, lichen). */
export const ROCK_SURFACE = 8;

/**
 * Faceted rock from a triangle soup in local metres: flat normals per face (hard
 * edges read as fractured stone at any range), one painted colour per face,
 * uv in metres (the HeroMaterial's bedding and joints), tag ROCK_SURFACE, snow
 * on upward faces when `snow`.
 */
function rockGeometry(points: number[], paint: (x: number, y: number, z: number, up: number, face: number) => THREE.Color, snow = 0): THREE.BufferGeometry {
  const count = points.length / 3;
  const positions = new Float32Array(points.length), colors = new Float32Array(points.length), tags = new Float32Array(points.length), uvs = new Float32Array(count * 2);
  for (let f = 0; f < count / 3; f++) {
    const i = f * 9;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = points.slice(i, i + 9);
    // Face normal (c − b) × (a − b), as three.js winds front faces.
    const ux = cx - bx, uy = cy - by, uz = cz - bz, vx = ax - bx, vy = ay - by, vz = az - bz;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz) || 1;
    const up = ny / length;
    const color = paint((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3, up, f);
    const side = Math.abs(nx) > Math.abs(nz);
    for (let k = 0; k < 3; k++) {
      const v = f * 3 + k, px = points[i + k * 3], py = points[i + k * 3 + 1], pz = points[i + k * 3 + 2];
      positions[v * 3] = px * U; positions[v * 3 + 1] = py * U; positions[v * 3 + 2] = pz * U;
      colors[v * 3] = color.r; colors[v * 3 + 1] = color.g; colors[v * 3 + 2] = color.b;
      tags[v * 3] = ROCK_SURFACE; tags[v * 3 + 2] = snow * Math.max(0, up);
      uvs[v * 2] = side ? pz : px; uvs[v * 2 + 1] = Math.abs(up) > 0.75 ? (side ? px : pz) : py;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("castleSurface", new THREE.Float32BufferAttribute(tags, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** One stratum of a stacked rock body: an outline (local metres x, z) between two heights. */
interface Stratum { y0: number; y1: number; ring: [number, number][]; batter: number; jitter: number }

/**
 * Stacked strata as a triangle soup (metres): each stratum a near-vertical
 * face (batter, and a jittered middle ring in the detailed form), a ledge to
 * the next stratum's outline, and a flat cap on the last. Outlines share their
 * vertex count.
 */
function strataPoints(strata: Stratum[], detailed: boolean, seed: number, floor = false): number[] {
  const out: number[] = [];
  if (floor) {
    // Underside of a free-standing slab (the arch's lintel), facing down.
    const ring = strata[0].ring, m = ring.length;
    const cx = ring.reduce((sum, p) => sum + p[0], 0) / m, cz = ring.reduce((sum, p) => sum + p[1], 0) / m;
    for (let k = 0; k < m; k++) out.push(ring[k][0], strata[0].y0, ring[k][1], ring[(k + 1) % m][0], strata[0].y0, ring[(k + 1) % m][1], cx, strata[0].y0, cz);
  }
  const quad = (p: number[], q: number[], r: number[], s: number[]): void => { out.push(...p, ...r, ...q, ...p, ...s, ...r); };
  const centre = (ring: [number, number][]): [number, number] => [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  strata.forEach((stratum, i) => {
    const m = stratum.ring.length, [cx, cz] = centre(stratum.ring);
    const scaled = (k: number, f: number, y: number): number[] => [cx + (stratum.ring[k % m][0] - cx) * f, y, cz + (stratum.ring[k % m][1] - cz) * f];
    const mid = (stratum.y0 + stratum.y1) / 2;
    const bulge = (k: number): number => 1 + (hash01(seed + i * 131 + k * 7.7) - 0.45) * stratum.jitter;
    for (let k = 0; k < m; k++) {
      const top = 1 - stratum.batter;
      if (detailed) {
        quad(scaled(k, 1, stratum.y0), scaled(k + 1, 1, stratum.y0), scaled(k + 1, bulge(k + 1) * (1 + top) / 2, mid), scaled(k, bulge(k) * (1 + top) / 2, mid));
        quad(scaled(k, bulge(k) * (1 + top) / 2, mid), scaled(k + 1, bulge(k + 1) * (1 + top) / 2, mid), scaled(k + 1, top, stratum.y1), scaled(k, top, stratum.y1));
      } else {
        quad(scaled(k, 1, stratum.y0), scaled(k + 1, 1, stratum.y0), scaled(k + 1, top, stratum.y1), scaled(k, top, stratum.y1));
      }
      const next = strata[i + 1];
      if (next) {
        // Ledge from this stratum's crown to the next one's foot (same vertex count).
        quad(scaled(k, top, stratum.y1), scaled(k + 1, top, stratum.y1), [next.ring[(k + 1) % m][0], stratum.y1, next.ring[(k + 1) % m][1]], [next.ring[k][0], stratum.y1, next.ring[k][1]]);
      } else {
        const p = scaled(k, top, stratum.y1), q = scaled(k + 1, top, stratum.y1);
        out.push(...p, cx, stratum.y1, cz, ...q);
      }
    }
  });
  return out;
}

/**
 * A rock needle of the highland palace: a stack of fractured, angular drums, each
 * offset and turned a little (columnar jointing), notched by deep cracks,
 * flared where it meets the mountain, leaning, with snow on the high ledges
 * and a level summit for the palace.
 */
function spire(b: B, x: number, z: number, r: number, base: number, top: number, seed: number, color: string): THREE.BufferGeometry {
  const drums = b.detailed ? 18 : 8, sides = b.detailed ? 13 : 7;
  const lean = (seed % 2 ? 1 : -1) * 0.22, leanAngle = seed * 1.9;
  const weights = Array.from({ length: drums }, (_, i) => 0.6 + hash01(seed * 17 + i) * 0.8);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const strata: Stratum[] = [];
  let y = base;
  weights.forEach((w, i) => {
    const y1 = y + (top - base) * w / total;
    const t = (y - base) / (top - base);
    const flare = 1 + 1.15 * (1 - smoothstep(0, 0.22, t));
    const taper = 1 - 0.5 * Math.pow(t, 0.9);
    const turn = (hash01(seed * 5 + i * 3.3) - 0.5) * 0.5 + seed;
    const drift = lean * t * t * r, jx = (hash01(seed + i * 9.1) - 0.5) * 0.07 * r, jz = (hash01(seed + i * 4.7) - 0.5) * 0.07 * r;
    const ring: [number, number][] = Array.from({ length: sides }, (_, k) => {
      const a = (k + hash01(seed * 3 + k) * 0.35) / sides * Math.PI * 2 + turn;
      // Angular facets with persistent cracks (the same sides notch drum after drum).
      const crack = hash01(seed * 11 + k) > 0.78 ? 0.7 + hash01(seed + i * 2.2 + k) * 0.12 : 1;
      const rough = 1 + (hash01(seed * 7 + k * 1.3 + i * 0.61) - 0.5) * 0.3 + 0.18 * Math.sin(a * 3 + seed);
      const rr = r * flare * taper * rough * crack * (i == drums - 1 ? 0.97 : 1);
      // Counter-clockwise from +x toward +z: strataPoints winds faces outward.
      return [x + Math.cos(a) * rr + Math.sin(leanAngle) * drift + jx, z + Math.sin(a) * rr * 0.92 + Math.cos(leanAngle) * drift + jz];
    });
    strata.push({ y0: y, y1, ring, batter: 0.02 + hash01(seed + i) * 0.05, jitter: 0.12 });
    y = y1;
  });
  strata[strata.length - 1].y1 = top;
  const rock = new THREE.Color(color), dark = new THREE.Color(color).multiplyScalar(0.62), snow = new THREE.Color("#dfe3e2"), pale = new THREE.Color("#a9aaa3");
  const tone = new THREE.Color("#ffffff");
  const paint = (px: number, py: number, pz: number, up: number, face: number): THREE.Color => {
    const t = (py - base) / (top - base);
    tone.copy(dark).lerp(rock, 0.35 + hash01(face * 0.37 + seed) * 0.65);
    if (hash01(Math.floor(py / 9) * 3.1 + seed) > 0.8) tone.lerp(pale, 0.5);
    if (up > 0.6) tone.lerp(snow, smoothstep(0.35, 0.8, t) * 0.9 + 0.1);
    return tone.clone().lerp(snow, smoothstep(0.9, 0.99, t) * 0.6);
  };
  return rockGeometry(strataPoints(strata, b.detailed, seed * 101), paint, 1);
}

/** Ellipse radius of the headland's footprint at local angle θ (local x seaward). */
function ellipse(rx: number, rz: number, theta: number): number {
  return 1 / Math.hypot(Math.cos(theta) / rx, Math.sin(theta) / rz);
}

/**
 * the golden headland: a colossal headland of golden-grey stone rising out of the
 * sea. Stacked strata (each a sheer, fractured face over a ledge) taper
 * gently toward the land and stand almost vertical toward the sea; gullies
 * cleave the faces from top to bottom; the foot is wave-cut and wet. The
 * Lion's Mouth opens at the waterline of the seaward tip, a natural arch
 * stands off it, three tiers of carved galleries with balconies face the
 * sea, and the summit carries a curtain with towers round the castle.
 */
function* rock(b: B, hero: Extract<HeroPlan, { kind: "rock" }>, extras: THREE.BufferGeometry[]): Generator<void, void, void> {
  const detailed = b.detailed;
  const sides = detailed ? 84 : 30;
  const c = Math.cos(hero.yaw), s = Math.sin(hero.yaw);
  const world = (u: number, v: number): [number, number] => [hero.x + u * c + v * s, hero.z - u * s + v * c];
  const sea = hero.sea, height = hero.height;
  const gullies = Array.from({ length: 8 }, (_, g) => (hash01(hero.seed + g * 13.7) * 2 - 1) * Math.PI);
  const centreOf = (t: number): [number, number] => world(rockDrift(hero.rx, t), 0);
  const ring = (t: number, layer: number): [number, number][] => Array.from({ length: sides }, (_, k) => {
    const theta = k / sides * Math.PI * 2;
    const land = Math.pow(Math.max(0, -Math.cos(theta)), 1.4);
    // Each bed recesses unevenly round the headland, more toward the land.
    const recess = (0.05 + 0.09 * land) * t * (0.5 + 0.5 * Math.sin(theta * 2 + layer * 1.3 + hero.seed));
    const cleft = gullies.reduce((sum, g) => { const d = Math.atan2(Math.sin(theta - g), Math.cos(theta - g)); return sum + Math.exp(-d * d / 0.006) * 0.16; }, 0);
    // Asymmetric lobes, buttresses that run through every bed (groups of three facets), bed-by-bed fracture.
    const buttress = (hash01(hero.seed + Math.floor(k / 3) * 7.1) - 0.5) * 0.1;
    const lobes = 0.1 * Math.sin(theta + hero.seed * 0.3) + 0.08 * Math.sin(theta * 2 + hero.seed) + 0.05 * Math.sin(theta * 3 - hero.seed * 0.7) +
      0.055 * Math.sin(theta * 5 + layer * 1.1 + hero.seed) + 0.02 * Math.sin(theta * 11 + layer * 1.7) + buttress + (hash01(hero.seed + layer * 97 + k * 3.1) - 0.5) * 0.03;
    const r = ellipse(hero.rx, hero.rz, theta) * Math.max(0.15, 1 - rockShrink(t) - recess - cleft * (0.5 + 0.5 * t) + lobes * (1 - 0.5 * t));
    return world(rockDrift(hero.rx, t) + Math.cos(theta) * r, Math.sin(theta) * r);
  });
  // Strata: a wave-cut foot from the seabed to just above the water, then beds of 18–40 m.
  const strata: Stratum[] = [{ y0: hero.base, y1: sea + 6, ring: ring(0, 0), batter: 0.004, jitter: 0.012 }];
  let y = sea + 6, layer = 1;
  while (y < height - 4) {
    const thickness = Math.min(height - y, 18 + hash01(hero.seed + layer * 5.3) * 22);
    const t = (y - sea) / (height - sea);
    const own = ring(t, layer);
    // Never overhang the stratum below (measured from this stratum's centre).
    const below = strata[strata.length - 1].ring, top = 1 - strata[strata.length - 1].batter;
    const [cx, cz] = centreOf(t);
    own.forEach((p, k) => {
      const limit = Math.hypot(below[k][0] - cx, below[k][1] - cz) * top * 0.995, d = Math.hypot(p[0] - cx, p[1] - cz);
      if (d > limit) { p[0] = cx + (p[0] - cx) * limit / d; p[1] = cz + (p[1] - cz) * limit / d; }
    });
    strata.push({ y0: y, y1: y + thickness, ring: own, batter: 0.008 + hash01(hero.seed + layer) * 0.018, jitter: 0.012 });
    y += thickness;
    layer++;
  }
  strata[strata.length - 1].y1 = height;
  // Golden sandstone beds with the odd grey one, varied over the massif; the wet
  // foot dark with a pale salt line; scrub on the ledges, grass on the summit.
  const beds = ["#b8a06f", "#c4ab79", "#a99572", "#b29a6a", "#9e958a", "#c9b386", "#a38f6c"].map(hex => new THREE.Color(hex));
  const grey = new THREE.Color("#968f84"), wet = new THREE.Color("#57524a"), salt = new THREE.Color("#a8a294"), scrub = new THREE.Color("#7c7a58"), summit = new THREE.Color("#7f7c5b");
  const tone = new THREE.Color("#ffffff");
  const paint = (px: number, py: number, pz: number, up: number, face: number): THREE.Color => {
    const bed = strata.findIndex(stratum => py <= stratum.y1 + 0.01);
    if (bed <= 0) return tone.copy(wet).lerp(salt, smoothstep(sea + 1, sea + 5, py) * 0.6).clone();
    tone.copy(beds[Math.floor(hash01(hero.seed + bed * 2.9) * beds.length)]);
    // Broad patches of greyer stone across the beds (≈ 200 m), so no bed reads as a ring.
    const patch = Math.sin(px * 0.017 + pz * 0.011 + hero.seed) * Math.sin(pz * 0.019 - py * 0.023) * 0.5 + 0.5;
    tone.lerp(grey, smoothstep(0.55, 0.9, patch) * 0.55);
    tone.multiplyScalar(0.86 + hash01(face * 0.731 + bed) * 0.2);
    // Darker streaks down the faces under some ledges.
    if (up < 0.3 && hash01(Math.floor((px + pz) / 19) + bed * 7) > 0.8) tone.multiplyScalar(0.82);
    if (up > 0.7) tone.lerp(py >= height - 0.5 ? summit : scrub, py >= height - 0.5 ? 0.9 : 0.55);
    return tone.clone();
  };
  extras.push(rockGeometry(strataPoints(strata, detailed, hero.seed), paint));
  // The neck: low beds joining the headland's landward foot to the shore, stopping
  // short of the castle's own yard (the anchor, local origin), so the headland reads
  // as a headland, not an island.
  const [lx, lz] = world(-hero.rx * 0.85, 0);
  const reach = Math.hypot(lx, lz) - 70;
  if (reach > 20) {
    const ux = -lx / Math.hypot(lx, lz), uz = -lz / Math.hypot(lx, lz);
    const neck = [[sea - 30, sea + 14, 1], [sea + 14, sea + 30, 0.7]].map(([y0, y1, k], i): Stratum => ({
      y0, y1, batter: 0.03, jitter: 0.02, ring: Array.from({ length: 14 }, (_, n) => {
        const a = n / 14 * Math.PI * 2, rough = 1 + (hash01(hero.seed + i * 31 + n * 5.7) - 0.5) * 0.16;
        const along = (Math.cos(a) * 0.5 + 0.5) * (reach + 60) * k - 30, across = Math.sin(a) * 55 * k * rough;
        return [lx + ux * along - uz * across, lz + uz * along + ux * across] as [number, number];
      })
    }));
    extras.push(rockGeometry(strataPoints(neck, detailed, hero.seed + 9), paint));
  }
  if (!detailed) return;
  yield;
  // Outward face of a stratum at outline vertex k: position (metres) and facing angle.
  const faceAt = (stratum: Stratum, k: number, f: number): { x: number; z: number; angle: number } => {
    const m = stratum.ring.length, p = stratum.ring[k % m], prev = stratum.ring[(k - 1 + m) % m], next = stratum.ring[(k + 1) % m];
    const [cx, cz] = centreOf((stratum.y0 - sea) / (height - sea)), scale = 1 - stratum.batter * f;
    let nx = next[1] - prev[1], nz = -(next[0] - prev[0]);
    if (nx * (p[0] - cx) + nz * (p[1] - cz) < 0) { nx = -nx; nz = -nz; }
    const length = Math.hypot(nx, nz) || 1;
    return { x: cx + (p[0] - cx) * scale + nx / length * 0.5, z: cz + (p[1] - cz) * scale + nz / length * 0.5, angle: Math.atan2(nx, nz) };
  };
  const seaward = (k: number): number => Math.cos(k / sides * Math.PI * 2);
  // Three tiers of carved galleries with balconies on the seaward faces.
  const tiers = [0.4, 0.56, 0.72].map(t => strata.reduce((best, stratum, i) => Math.abs((stratum.y0 - sea) / (height - sea) - t) < Math.abs((strata[best].y0 - sea) / (height - sea) - t) ? i : best, 1));
  tiers.forEach((index, row) => {
    const stratum = strata[index];
    const yMid = stratum.y0 + (stratum.y1 - stratum.y0) * 0.45;
    let last: { x: number; z: number } | undefined;
    for (let k = row % 2; k < sides; k += 2) {
      if (seaward(k) < 0.15) { last = undefined; continue; }
      const at = faceAt(stratum, k, 0.45);
      b.window(at.x * U, yMid * U, at.z * U, at.angle, 2.6 * U, 5 * U);
      if (last) {
        const length = Math.hypot(at.x - last.x, at.z - last.z);
        if (length < 60) block(b, length, 0.8, 2.2, (at.x + last.x) / 2, yMid - 3.2, (at.z + last.z) / 2, "#c9b48a", -Math.atan2(at.z - last.z, at.x - last.x));
      }
      last = at;
    }
  });
  yield;
  // The Lion's Mouth: a dark arched sea cave at the waterline of the tip.
  const mouth = new THREE.Shape();
  mouth.moveTo(-20, 0); mouth.lineTo(20, 0);
  for (let i = 0; i <= 10; i++) mouth.lineTo(Math.cos(i / 10 * Math.PI) * 20, 16 + Math.sin(i / 10 * Math.PI) * 20 * (1 - (i % 2) * 0.06));
  mouth.closePath();
  const tip = faceAt(strata[0], 0, 0.5);
  b.add(new THREE.ExtrudeGeometry(mouth, { depth: 1.5, bevelEnabled: false }).scale(U, U, U), tip.x * U, (sea - 2) * U, tip.z * U, "#17140f", tip.angle, 7);
  // Realm C: small blocked mine portals in the lower landward cliff beds.
  // Sample the hero's actual ring, not guessed world offsets. The masonry
  // collar projects out of the rock; an opaque backing seals every entrance.
  for (const k of [Math.floor(sides * 0.38), Math.floor(sides * 0.56), Math.floor(sides * 0.7)]) {
    const at = faceAt(strata[1], k, 0.35);
    const floor = strata[1].y0 + 2;
    const arch = new THREE.Shape();
    arch.moveTo(-3.8, 0); arch.lineTo(3.8, 0); arch.lineTo(3.8, 4.5);
    for (let j = 0; j <= 12; j++) arch.lineTo(Math.cos(j * Math.PI / 12) * 3.8, 4.5 + Math.sin(j * Math.PI / 12) * 3.8);
    arch.closePath();
    const nx = Math.sin(at.angle), nz = Math.cos(at.angle);
    b.add(new THREE.ExtrudeGeometry(arch, { depth: 2, bevelEnabled: false }).scale(U, U, U),
      (at.x + nx * 2) * U, floor * U, (at.z + nz * 2) * U, "#24221e", at.angle, 7);
    for (const side of [-1, 1]) {
      const [dx, dz] = turn(side * 4.3, -0.8, at.angle);
      block(b, 1.2, 5, 10, at.x + dx, floor + 2.5, at.z + dz, "#9e9278", at.angle);
    }
    for (let j = 0; j < 15; j++) {
      const a = (j + 0.5) * Math.PI / 15;
      const [dx, dz] = turn(Math.cos(a) * 4.3, -0.8, at.angle);
      b.add(new THREE.BoxGeometry(1.1 * U, 1.2 * U, 10 * U).rotateZ(a + Math.PI / 2),
        (at.x + dx) * U, (floor + 4.5 + Math.sin(a) * 4.3) * U, (at.z + dz) * U, "#aa9a7b", at.angle);
    }
  }
  yield;
  // A natural arch standing off the tip in the surf: two fractured pillars and a lintel, the sea through it.
  const archStrata = (u: number, v: number, ru: number, rv: number, y0: number, y1: number, beds: number, salt: number): Stratum[] => Array.from({ length: beds }, (_, i) => {
    const t = i / beds, shrink = 1 - 0.18 * t;
    const ring = Array.from({ length: 10 }, (_, k) => {
      const a = k / 10 * Math.PI * 2, rough = 1 + (hash01(salt + i * 7 + k * 3.3) - 0.5) * 0.12;
      return world(u + Math.cos(a) * ru * rough * shrink, v + Math.sin(a) * rv * rough * shrink);
    });
    return { y0: y0 + (y1 - y0) * t, y1: y0 + (y1 - y0) * (i + 1) / beds, ring, batter: 0.03, jitter: 0.03 };
  });
  const au = hero.rx * 1.2, av = hero.rz * 0.15;
  const archPoints = [
    ...strataPoints(archStrata(au - 30, av, 13, 15, hero.base, sea + 62, 5, hero.seed + 1), true, hero.seed + 1),
    ...strataPoints(archStrata(au + 30, av, 12, 14, hero.base, sea + 62, 5, hero.seed + 2), true, hero.seed + 2),
    ...strataPoints(archStrata(au, av, 48, 17, sea + 50, sea + 84, 2, hero.seed + 3), true, hero.seed + 3, true)
  ];
  extras.push(rockGeometry(archPoints, (_px, py, _pz, up, face) => (py < sea + 5 ? tone.copy(wet) : tone.copy(beds[Math.floor(Math.abs(py) / 24) % beds.length]).multiplyScalar(0.88 + hash01(face) * 0.16)).lerp(scrub, up > 0.7 ? 0.5 : 0).clone()));
  yield;
  // The summit curtain: golden walls and square towers on the crown's rim, clear of the fortress.
  const crown = strata[strata.length - 1];
  const [cx, cz] = centreOf(1);
  const rim = crown.ring.map(([px, pz]) => [cx + (px - cx) * 0.9, cz + (pz - cz) * 0.9] as [number, number]);
  const golden = "#b9a477";
  let segment = 0;
  for (let k = 0; k < rim.length; k += 2) {
    const a = rim[k], q = rim[(k + 2) % rim.length];
    if (Math.min(Math.hypot(a[0] - cx, a[1] - cz), Math.hypot(q[0] - cx, q[1] - cz)) < 92) continue;
    const length = Math.hypot(q[0] - a[0], q[1] - a[1]);
    const angle = -Math.atan2(q[1] - a[1], q[0] - a[0]);
    mass(b, length + 1, 10, 3.2, (a[0] + q[0]) / 2, height + 4, (a[1] + q[1]) / 2, golden, angle);
    edgeCrown(b, a[0], a[1], q[0], q[1], height + 9);
    if (segment++ % 4 == 0) {
      mass(b, 10, 20, 10, a[0], height + 9, a[1], golden, angle);
      block(b, 11, 1.2, 11, a[0], height + 19.4, a[1], "#cdbb92", angle);
    }
  }
}

/** The the lighthouse: a white stepped tower of ~240 m on its black-stone base, crowned by the beacon. */
function hightower(b: B, hero: Extract<HeroPlan, { kind: "hightower" }>): void {
  const white = "#d9d3c4", trim = "#ece6d6";
  const g = hero.ground;
  mass(b, 64, g + 26 - hero.base, 64, hero.x, (hero.base + g + 26) / 2, hero.z, "#4f5354");
  [[-30, -30, 30, -30], [30, -30, 30, 30], [30, 30, -30, 30], [-30, 30, -30, -30]].forEach(([x0, z0, x1, z1]) => edgeCrown(b, hero.x + x0 * 1.06, hero.z + z0 * 1.06, hero.x + x1 * 1.06, hero.z + z1 * 1.06, g + 26));
  let y = g + 26;
  const tiers: [number, number][] = [[24, 60], [19, 50], [15, 44], [11, 34], [7.5, 14]];
  const seg = b.detailed ? 32 : 14;
  tiers.forEach(([r, h], i) => {
    b.add(new THREE.CylinderGeometry(r * 0.94 * U, r * U, h * U, seg), hero.x * U, (y + h / 2) * U, hero.z * U, white);
    b.add(new THREE.CylinderGeometry((r + 2.2) * U, (r + 1.2) * U, 1.6 * U, seg), hero.x * U, (y + h) * U, hero.z * U, trim);
    if (i < tiers.length - 1) roundCrown(b, hero.x, hero.z, r + 1.4, y + h + 0.8);
    if (b.detailed) {
      const rows = Math.max(1, Math.floor(h / 11));
      for (let row = 0; row < rows; row++) {
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4 + row * 0.39;
          b.window((hero.x + Math.sin(a) * (r * 0.95 + 0.1)) * U, (y + (row + 0.55) * h / rows) * U, (hero.z + Math.cos(a) * (r * 0.95 + 0.1)) * U, a, 0.03, 0.08);
        }
      }
    }
    y += h;
  });
  // Open beacon cage: posts and a cap; the fire itself is drawn by the layer.
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    block(b, 0.9, 10, 0.9, hero.x + Math.sin(a) * 6, y + 5, hero.z + Math.cos(a) * 6, trim, a);
  }
  b.add(new THREE.ConeGeometry(8 * U, 6 * U, 16), hero.x * U, (y + 13) * U, hero.z * U, "#8e8a7e", 0, 1);
}

/** Top of the the lighthouse's beacon (local metres), where the fire burns. */
export function beaconPoint(hero: Extract<HeroPlan, { kind: "hightower" }>): [number, number, number] {
  return [hero.x, hero.ground + 26 + 60 + 50 + 44 + 34 + 14 + 4, hero.z];
}

/** Always-physical hero geometry (needles, the headland, the the lighthouse), sliced. */
export function* heroGeometry(plan: ComplexPlan, detailed: boolean): Generator<void, THREE.BufferGeometry | undefined, void> {
  const hero = plan.hero;
  if (!hero) return undefined;
  const b = complexBuilder(plan, detailed);
  // Painted rock grids are merged after the builder's parts (same attributes).
  const extras: THREE.BufferGeometry[] = [];
  let parts = 0;
  if (hero.kind == "needles") {
    for (const s of hero.spires) {
      extras.push(spire(b, s.x, s.z, s.r, s.base, s.ground + s.height, s.seed, s.seed % 2 ? "#8c9090" : "#9a9c97"));
      yield;
    }
  } else if (hero.kind == "rock") {
    yield* rock(b, hero, extras);
    parts = detailed ? 1 : 0;
  } else {
    hightower(b, hero);
    parts = 1;
  }
  yield;
  const built = parts ? b.finish() : undefined;
  const merged = mergeGeometries(built ? [built, ...extras] : extras);
  built?.dispose();
  extras.forEach(geometry => geometry.dispose());
  merged?.computeBoundingSphere();
  return merged ?? undefined;
}

export { U as METRES };

import * as THREE from "three";
import CastleBuilder from "../../castles/CastleBuilder";
import type { KitLevel, KitLod, KitVariant } from "../../core/KitPool";

// Shared kit variants for the global pool (realism/kits/pool; bible §2 K1/K2),
// authored once per level of detail in world units at a nominal size. Origin:
// ground-floor centre; front/outer face is local +Z. Every vertex below y=0 is
// a foundation skirt that the castle shader lowers by instanceCastleDepth, so
// pieces root into slopes without floating. Plaster/stone (surface 0) and
// roofs (surface 1) are near-white and take per-instance cityWall/cityRoof
// tints; timber, doors and window panes keep their baked colours.
//
// One geometry serves every place: optional parts carry a mask (kitShape.y)
// and only draw on instances whose cityKit.x has all of those bits; roof
// vertices carry their height above the eave (kitShape.x), which cityKit.y
// scales (low terracotta vs steep northern roofs). The `plaster` bit pins
// wall UVs to one masonry cell in the shader: lime plaster instead of stone.

export type KitPiece = "wall" | "tower" | "gate";
export type HouseKit = "gable" | "tall" | "court" | "flat";
export type { KitLevel, KitLod };

/** Option bits. A part is drawn when the instance has all of its bits. */
export const kitBits = { crown: 1, north: 2, stone: 4, palisade: 16, plaster: 32, dome: 64 } as const;

export const wallLength = 0.032;
export const wallHeight = 0.05;
export const wallThickness = 0.012;
export const towerSize = 0.022;
export const towerHeight = 0.072;
export const gateOpening = 0.016;
export const gateTower = 0.018;
/** Wall gap occupied by a gatehouse instance. */
export const gateSpan = gateOpening + gateTower * 2;
/** Palisade stake height relative to wallHeight (instance sy = 1). */
export const palisadeHeight = 0.68;

const plaster = "#f3efe6", masonry = "#e2dcd0", roof = "#ffffff", trim = "#ffffff", glass = "#3a3f45", door = "#57432f", beam = "#3f342a", dark = "#2c2a27", timber = "#6b5643";
const skirt = 0.03;
// Three r186 constructor parameters the app's TS 4.5 declarations omit.
const Sphere = THREE.SphereGeometry as unknown as new (radius: number, widthSegments: number, heightSegments: number, phiStart: number, phiLength: number, thetaStart: number, thetaLength: number) => THREE.BufferGeometry;

/**
 * Nominal house sizes (world). Instances scale to their lot; `ridge` is the
 * nominal roof height as a fraction of depth (gable) or width (hip).
 */
export const houseKits: Record<HouseKit, { w: number; d: number; h: number; ridge: number }> = {
  gable: { w: 0.0125, d: 0.0115, h: 0.017, ridge: 0.5 },
  tall: { w: 0.0105, d: 0.0105, h: 0.023, ridge: 0.4 },
  court: { w: 0.017, d: 0.0155, h: 0.016, ridge: 0.34 },
  // World ×20 only (Dorne/Essos `flat-dome`): flat roof, parapet, optional dome.
  flat: { w: 0.0125, d: 0.0115, h: 0.016, ridge: 0.3 }
};

/** Instance pitch that turns the nominal ridge into `ratio` × depth (or width). */
export function roofPitch(kit: HouseKit, ratio: number, sy: number, sz: number): number {
  const { d, w, ridge } = houseKits[kit];
  const span = kit == "tall" ? w : d;
  return (ratio * span * sz) / (ridge * span * sy);
}

/** CastleBuilder that tags each added part with a mask and an eave height. */
class KitBuilder {
  readonly b: CastleBuilder;
  private ranges: { count: number; mask: number; eave?: number; lift?: number }[] = [];

  constructor() { this.b = new CastleBuilder("crownlands", false, undefined, { trim, wood: timber }); }

  add(mask: number, shape: { eave?: number; lift?: number }, g: THREE.BufferGeometry, x: number, y: number, z: number, color: string, angle = 0, surface = 0, snow = 0): void {
    const index = g.index as { count: number } | null;
    this.ranges.push({ count: index ? index.count : g.getAttribute("position").count, mask, ...shape });
    this.b.add(g, x, y, z, color, angle, surface, snow);
  }

  finish(uvScale: number): THREE.BufferGeometry {
    const geometry = this.b.finish();
    const position = geometry.getAttribute("position");
    const shape = new Float32Array(position.count * 2);
    let vertex = 0;
    this.ranges.forEach(range => {
      for (let i = 0; i < range.count; i++, vertex++) {
        shape[vertex * 2] = range.lift ?? (range.eave != undefined ? Math.max(0, position.getY(vertex) - range.eave) : 0);
        shape[vertex * 2 + 1] = range.mask;
      }
    });
    geometry.setAttribute("kitShape", new THREE.Float32BufferAttribute(shape, 2));
    return prepare(geometry, uvScale);
  }
}

/** Pitched roof on top of y; ridge along local X unless `ridgeZ`. */
function gable(k: KitBuilder, mask: number, span: number, length: number, pitch: number, x: number, y: number, z: number, ridgeZ: boolean): void {
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0); shape.lineTo(span / 2, 0); shape.lineTo(0, pitch); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false }).translate(0, 0, -length / 2);
  k.add(mask, { eave: y }, ridgeZ ? g : g.rotateY(Math.PI / 2), x, y, z, roof, 0, 1, 1);
}

function hip(k: KitBuilder, mask: number, w: number, d: number, pitch: number, x: number, y: number, z: number, eave = true): void {
  k.add(mask, eave ? { eave: y } : {}, new THREE.ConeGeometry(Math.SQRT1_2, pitch, 4).rotateY(Math.PI / 4).scale(w, 1, d), x, y + pitch / 2, z, roof, 0, 1, 1);
}

function body(k: KitBuilder, mask: number, w: number, h: number, d: number, x = 0, z = 0, base = 0, color = plaster, surface = 0): void {
  const bottom = base == 0 ? -skirt : base;
  k.add(mask, {}, new THREE.BoxGeometry(w, h - bottom, d), x, (h + bottom) / 2, z, color, 0, surface);
}

function pane(k: KitBuilder, mask: number, w: number, h: number, x: number, y: number, z: number, angle: number, color: string, surface: number): void {
  k.add(mask, {}, new THREE.PlaneGeometry(w, h), x, y, z, color, angle, surface);
}

function front(k: KitBuilder, mask: number, w: number, h: number, x: number, y: number, d: number, color = glass, surface = 3, back = false): void {
  pane(k, mask, w, h, x, y, back ? -d / 2 - 0.0003 : d / 2 + 0.0003, back ? Math.PI : 0, color, surface);
}

function house(k: KitBuilder, kit: HouseKit, lod: KitLevel): void {
  const { w, d, h, ridge } = houseKits[kit];
  const near = lod == "near";
  const o = 0.0011;
  const { crown, north } = kitBits;
  if (kit == "gable") {
    // Row house, hovel, stone house, byre and long house: lot scale and pitch.
    body(k, 0, w, h, d);
    gable(k, 0, d + o * 2, w + o * 2, d * ridge, 0, h, 0, false);
    if (!near) return;
    k.add(0, { lift: d * ridge * 0.45 }, new THREE.BoxGeometry(0.0024, 0.0055, 0.0024), w * 0.28, h + d * ridge * 0.45 + 0.0018, -d * 0.18, "#e2dbcf");
    front(k, 0, w * 0.2, h * 0.36, -w * 0.22, h * 0.18, d, door, 2);
    [-1, 1].forEach(side => front(k, 0, w * 0.16, h * 0.15, side * w * 0.25, h * 0.68, d));
    front(k, 0, w * 0.18, h * 0.14, w * 0.2, h * 0.32, d);
    [-1, 1].forEach(side => front(k, 0, w * 0.16, h * 0.15, side * w * 0.25, h * 0.68, d, glass, 3, true));
    // Crownlands awning over the door; northern timber lintel and turf strip.
    k.add(crown, {}, new THREE.BoxGeometry(w * 0.34, 0.0007, 0.0035).rotateX(-0.35), -w * 0.22, h * 0.4, d / 2 + 0.0017, "#8a6d55", 0, 2);
    front(k, north, w + 0.0008, 0.0012, 0, h * 0.42, d, beam, 2);
  } else if (kit == "tall") {
    // Dubrovnik tower house (crown) or northern stone hall with a timber floor.
    body(k, 0, w, h, d);
    hip(k, 0, w + o * 2, d + o * 2, w * ridge, 0, h, 0);
    if (!near) return;
    k.add(crown, {}, new THREE.BoxGeometry(w * 0.7, h * 0.12, 0.0024), 0, h * 0.86, d / 2 + 0.0012, "#6c5949", 0, 2);
    k.add(north, {}, new THREE.BoxGeometry(w + 0.0016, h * 0.36, d + 0.0016), 0, h * 0.8, 0, "#76604b", 0, 2);
    front(k, 0, w * 0.26, h * 0.2, 0, h * 0.1, d, door, 2);
    [0.38, 0.58].forEach(rise => [-1, 1].forEach(side => front(k, 0, w * 0.2, h * 0.1, side * w * 0.24, h * rise, d)));
    [-1, 1].forEach(side => pane(k, 0, d * 0.22, h * 0.1, side * (w / 2 + 0.0003), h * 0.58, 0, side * Math.PI / 2, glass, 3));
  } else if (kit == "flat") {
    // Dornish house: lime walls, flat roof behind a parapet, a small dome on
    // some (mask `dome`), an awning (`crown`) over the door near.
    body(k, 0, w, h, d);
    k.add(0, {}, new THREE.BoxGeometry(w + o, d * 0.06, d + o), 0, h + d * 0.03, 0, roof, 0, 1);
    // Parapet ring: four thin walls round the roof terrace.
    [-1, 1].forEach(side => {
      k.add(0, {}, new THREE.BoxGeometry(w + o * 2, d * 0.1, o), 0, h + d * 0.05, side * (d / 2 + o / 2), trim);
      k.add(0, {}, new THREE.BoxGeometry(o, d * 0.1, d + o * 2), side * (w / 2 + o / 2), h + d * 0.05, 0, trim);
    });
    k.add(kitBits.dome, {}, new Sphere(Math.min(w, d) * 0.28, near ? 10 : 6, near ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2), w * 0.12, h + d * 0.06, -d * 0.1, roof, 0, 1);
    if (!near) return;
    front(k, 0, w * 0.2, h * 0.38, -w * 0.18, h * 0.19, d, door, 2);
    [-1, 1].forEach(side => front(k, 0, w * 0.13, h * 0.15, side * w * 0.26, h * 0.66, d));
    [-1, 1].forEach(side => front(k, 0, w * 0.13, h * 0.15, side * w * 0.26, h * 0.66, d, glass, 3, true));
    k.add(kitBits.crown, {}, new THREE.BoxGeometry(w * 0.4, 0.0007, 0.004).rotateX(-0.3), -w * 0.18, h * 0.42, d / 2 + 0.002, "#8a6d55", 0, 2);
  } else {
    // Street range and a rear wing around a small yard.
    const fd = d * 0.55, wd = d - fd, ww = w * 0.42;
    body(k, 0, w, h, fd, 0, d / 2 - fd / 2);
    gable(k, 0, fd + o * 2, w + o * 2, fd * ridge, 0, h, d / 2 - fd / 2, false);
    body(k, 0, ww, h * 0.82, wd + 0.001, -w / 2 + ww / 2, -d / 2 + wd / 2);
    gable(k, 0, ww + o * 2, wd + o * 2, ww * ridge, -w / 2 + ww / 2, h * 0.82, -d / 2 + wd / 2, true);
    if (!near) return;
    front(k, 0, w * 0.16, h * 0.36, 0, h * 0.18, d, door, 2);
    [-1, -0.35, 0.35, 1].forEach(side => front(k, 0, w * 0.1, h * 0.15, side * w * 0.36, h * 0.68, d));
    [-1, 1].forEach(side => front(k, 0, w * 0.1, h * 0.14, side * w * 0.33, h * 0.32, d));
  }
}

function stakes(k: KitBuilder, length: number, lod: KitLevel): void {
  // One extrusion: a fence of pointed stakes (8 near, a plain crest mid).
  const h = wallHeight * palisadeHeight, p = kitBits.palisade, teeth = lod == "near" ? 8 : 1, tip = lod == "near" ? 0.0045 : 0.003;
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, -skirt);
  shape.lineTo(length / 2, -skirt);
  for (let i = teeth; i > 0; i--) {
    const x = -length / 2 + i * length / teeth;
    shape.lineTo(x, h);
    shape.lineTo(x - length / teeth / 2, h + tip);
  }
  shape.lineTo(-length / 2, h);
  shape.closePath();
  k.add(p, {}, new THREE.ExtrudeGeometry(shape, { depth: 0.0045, bevelEnabled: false }).translate(0, 0, -0.00225), 0, 0, 0, timber, 0, 2);
  if (lod == "near") k.add(p, {}, new THREE.BoxGeometry(length, 0.0018, 0.0016), 0, h * 0.62, -0.0031, beam, 0, 2);
}

function wall(k: KitBuilder, lod: KitLevel): void {
  const { stone, crown, north } = kitBits;
  k.add(stone, {}, new THREE.BoxGeometry(wallLength + 0.0004, wallHeight + skirt, wallThickness), 0, (wallHeight - skirt) / 2, 0, masonry);
  if (lod == "mid") {
    k.add(stone, {}, new THREE.BoxGeometry(wallLength + 0.0004, 0.005, 0.003), 0, wallHeight + 0.0025, wallThickness / 2 - 0.0015, trim, 0, 0, 1);
  } else {
    // Outer merlons, low inner parapet and a string course or timber hoarding.
    [-1, 0, 1].forEach(i => k.add(stone, {}, new THREE.BoxGeometry(wallLength / 6, 0.0075, 0.003), i * wallLength / 3, wallHeight + 0.00375, wallThickness / 2 - 0.0015, trim, 0, 0, 1));
    k.add(stone, {}, new THREE.BoxGeometry(wallLength + 0.0004, 0.003, 0.002), 0, wallHeight + 0.0015, -wallThickness / 2 + 0.001, trim, 0, 0, 1);
    k.add(stone | north, {}, new THREE.BoxGeometry(wallLength + 0.0004, 0.0035, 0.006), 0, wallHeight - 0.006, -wallThickness / 2 - 0.003, timber, 0, 2, 1);
    k.add(stone | crown, {}, new THREE.BoxGeometry(wallLength + 0.0004, 0.0018, wallThickness + 0.002), 0, wallHeight * 0.72, 0, trim);
  }
  stakes(k, wallLength + 0.0004, lod);
}

function tower(k: KitBuilder, lod: KitLevel): void {
  const { stone, crown, north, palisade } = kitBits;
  const near = lod == "near";
  k.add(stone, {}, new THREE.BoxGeometry(towerSize, towerHeight + skirt, towerSize), 0, (towerHeight - skirt) / 2, 0, masonry);
  k.add(stone, {}, new THREE.BoxGeometry(towerSize + 0.003, 0.0045, towerSize + 0.003), 0, towerHeight - 0.002, 0, trim);
  // Steep slate caps on the northern towers; merlons on the southern ones.
  hip(k, stone | north, towerSize + 0.004, towerSize + 0.004, 0.024, 0, towerHeight, 0, false);
  if (near) {
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([x, z]) => k.add(stone | crown, {}, new THREE.BoxGeometry(0.006, 0.008, 0.006), x * (towerSize / 2 - 0.0015), towerHeight + 0.004, z * (towerSize / 2 - 0.0015), trim, 0, 0, 1));
    [0, Math.PI].forEach(a => pane(k, stone, 0.0022, 0.009, Math.sin(a) * (towerSize / 2 + 0.0003), towerHeight * 0.64, Math.cos(a) * (towerSize / 2 + 0.0003), a, glass, 3));
  }
  // Timber watch tower for palisades.
  const ph = wallHeight * 0.95;
  k.add(palisade, {}, new THREE.BoxGeometry(0.015, ph + skirt, 0.015), 0, (ph - skirt) / 2, 0, timber, 0, 2);
  hip(k, palisade, 0.019, 0.019, 0.012, 0, ph, 0, false);
}

function gatehouse(k: KitBuilder, lod: KitLevel): void {
  const { stone, crown, north, palisade } = kitBits;
  const near = lod == "near";
  const h = towerHeight * 1.04, lintel = wallHeight * 0.42, depth = wallThickness + 0.008;
  [-1, 1].forEach(side => {
    const x = side * (gateOpening / 2 + gateTower / 2);
    k.add(stone, {}, new THREE.BoxGeometry(gateTower, h + skirt, depth), x, (h - skirt) / 2, 0, masonry);
    k.add(stone, {}, new THREE.BoxGeometry(gateTower + 0.0025, 0.004, depth + 0.0025), x, h - 0.002, 0, trim);
    hip(k, stone | north, gateTower + 0.003, depth + 0.003, 0.02, x, h, 0, false);
    if (near) [-1, 1].forEach(i => k.add(stone | crown, {}, new THREE.BoxGeometry(0.0055, 0.0075, 0.0045), x + i * gateTower * 0.3, h + 0.0037, depth / 2 - 0.0022, trim, 0, 0, 1));
    // Palisade gate: two timber towers on posts.
    k.add(palisade, {}, new THREE.BoxGeometry(0.012, wallHeight + skirt, 0.012), x, (wallHeight - skirt) / 2, 0, timber, 0, 2);
    hip(k, palisade, 0.015, 0.015, 0.01, x, wallHeight, 0, false);
  });
  k.add(stone, {}, new THREE.BoxGeometry(gateOpening + 0.001, lintel, depth), 0, wallHeight * 1.08 - lintel / 2, 0, masonry);
  k.add(palisade, {}, new THREE.BoxGeometry(gateOpening + 0.006, 0.004, 0.006), 0, wallHeight * 0.8, 0, beam, 0, 2);
  // Dark passage and the timber leaves / portcullis on both faces.
  [1, -1].forEach(side => pane(k, stone, gateOpening, wallHeight * 1.08 - lintel, 0, (wallHeight * 1.08 - lintel) / 2, side * depth / 2 * 0.4, side > 0 ? 0 : Math.PI, side > 0 ? door : dark, 2));
  if (near) {
    [-1, 0, 1].forEach(i => k.add(stone, {}, new THREE.BoxGeometry(0.004, 0.006, 0.004), i * gateOpening * 0.34, wallHeight * 1.08 + 0.003, depth / 2 - 0.002, trim, 0, 0, 1));
    [-1, 1].forEach(side => pane(k, stone, 0.0022, 0.009, side * (gateOpening / 2 + gateTower / 2), h * 0.66, depth / 2 + 0.0003, 0, glass, 3));
  }
}

/** Adds castleSkirt; `uvScale` refines the shared masonry/roof-course pattern. */
function prepare(geometry: THREE.BufferGeometry, uvScale: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const skirtFlags = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) skirtFlags[i] = position.getY(i) < -0.0005 ? 1 : 0;
  geometry.setAttribute("castleSkirt", new THREE.Float32BufferAttribute(skirtFlags, 1));
  const uv = geometry.getAttribute("uv") as unknown as { count: number; getX(i: number): number; getY(i: number): number; setXY(i: number, x: number, y: number): void };
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * World ×20 far roofscape (design §4.5): a unit box (1 × 1 × 1, origin at the
 * ground centre, skirt below) under a gable whose ridge (nominal 0.5, along
 * local X) the instance pitch scales; pitch 0 gives a flat-topped block for
 * curtain pieces, towers and gates. ~16 triangles: one instance per block of
 * houses or wall piece. No masked parts.
 */
function roofscapeBlock(k: KitBuilder): void {
  k.add(0, {}, new THREE.BoxGeometry(1, 1 + 0.4, 1), 0, 0.3, 0, plaster);
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0); shape.lineTo(0.5, 0); shape.lineTo(0, 0.5); shape.closePath();
  k.add(0, { eave: 1 }, new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2), 0, 1, 0, roof, 0, 1, 1);
}

/**
 * World ×20 far roofscape tile (round 2): roof-only — four ridges along local
 * X over a unit footprint (ridge 0.5 nominal over the eave at y = 1, scaled
 * by the instance pitch like `block`), each ridge a shade lighter or darker
 * and a little shorter or lower than its neighbour, over a dark eave skirt
 * down to the foundation. One instance covers a 40–80 m patch of houses: at
 * 1–3 km it reads as rows of roofs, not a field of boxes. 32 triangles.
 */
function roofTile(k: KitBuilder): void {
  // Eave skirt: the four sides only (the top is under the ridges, the base in the ground).
  k.add(0, {}, faces([
    [[-0.5, -0.4, 0.5], [0.5, -0.4, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]], [[0.5, -0.4, -0.5], [-0.5, -0.4, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]],
    [[0.5, -0.4, 0.5], [0.5, -0.4, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5]], [[-0.5, -0.4, -0.5], [-0.5, -0.4, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5]]
  ]), 0, 0, 0, "#b9b2a7");
  // Alternate light and shaded ridges: the rows still read where the sun is flat.
  const ridges = 4, tones = ["#ffffff", "#bcb8b2", "#efece8", "#aeaaa4"], lengths = [1, 0.9, 0.97, 0.86], rises = [0.5, 0.43, 0.5, 0.46], shifts = [0, 0.05, -0.015, -0.07];
  for (let i = 0; i < ridges; i++) {
    const half = 1 / ridges / 2 + 0.005, z = -0.5 + (i + 0.5) / ridges, l = lengths[i] / 2, r = rises[i];
    // Two slopes and two gable ends (no hidden base): 6 triangles.
    k.add(0, { eave: 1 }, faces([
      [[-l, 0, half], [l, 0, half], [l, r, 0], [-l, r, 0]], [[l, 0, -half], [-l, 0, -half], [-l, r, 0], [l, r, 0]],
      [[l, 0, half], [l, 0, -half], [l, r, 0]], [[-l, 0, -half], [-l, 0, half], [-l, r, 0]]
    ]), shifts[i], 1, z, tones[i], 0, 1, 1);
  }
}

/** Flat-shaded polygons (triangles or quads, counter-clockwise seen from outside) with a planar UV. */
function faces(polygons: [number, number, number][][]): THREE.BufferGeometry {
  const position: number[] = [], uv: number[] = [];
  polygons.forEach(points => {
    const triangles = points.length == 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
    triangles.forEach(t => t.forEach(i => { position.push(...points[i]); uv.push(points[i][0] + points[i][2], points[i][1]); }));
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Pool variants: 3 house families (K1) and 3 masonry/timber pieces (K2). */
export const cityKitVariants: Record<string, KitVariant> = {
  "house-gable": { shadow: false, build: lod => { const k = new KitBuilder(); house(k, "gable", lod); return k.finish(3); } },
  "house-tall": { shadow: false, build: lod => { const k = new KitBuilder(); house(k, "tall", lod); return k.finish(3); } },
  "house-court": { shadow: false, build: lod => { const k = new KitBuilder(); house(k, "court", lod); return k.finish(3); } },
  wall: { shadow: true, build: lod => { const k = new KitBuilder(); wall(k, lod); return k.finish(2); } },
  tower: { shadow: true, build: lod => { const k = new KitBuilder(); tower(k, lod); return k.finish(2); } },
  gate: { shadow: true, build: lod => { const k = new KitBuilder(); gatehouse(k, lod); return k.finish(2); } }
};

/** World ×20 additions: Dorne's flat-roofed house, the far block (curtains) and the roofscape tile (houses). */
export const physicalExtraVariants: Record<string, KitVariant> = {
  "house-flat": { shadow: false, build: lod => { const k = new KitBuilder(); house(k, "flat", lod); return k.finish(3); } },
  block: { shadow: false, build: () => { const k = new KitBuilder(); roofscapeBlock(k); return k.finish(0.08); } },
  roofs: { shadow: false, build: () => { const k = new KitBuilder(); roofTile(k); return k.finish(0.08); } }
};

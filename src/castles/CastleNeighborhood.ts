import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";

// Inhabited ground inside a castle's existing foundation: dwellings, a stable,
// smithy, granary, well and lanes. Each helper emits through CastleBuilder in
// both LODs; Balanced only drops trim/window detail, never a building or roof.
// Each yard returns the ground rectangles it claims. Those rectangles include
// eaves and front-face protrusions, and the layouts were checked against the
// emitted original geometry (walls, window frames, towers, keep, gate).
export interface Footprint { name: string; x0: number; x1: number; z0: number; z1: number }

export class Yard {
  readonly footprints: Footprint[] = [];
  constructor(readonly b: CastleBuilder) {}

  record(name: string, x0: number, x1: number, z0: number, z1: number): void {
    this.footprints.push({ name, x0, x1, z0, z1 });
  }
}

// Declared plan rect for a house: eaves overhang x by .004, and the door, lintel
// and window stand .014 proud of the front (+Z) face.
function houseRecord(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number): void {
  y.record(name, x0 - 0.004, x1 + 0.004, z0 - 0.004, z1 + 0.014);
}

// Gable body with its ridge along z. The roof extrusion starts exactly at the
// wall top, so the eave meets the wall with no gap.
function gableBody(y: Yard, x0: number, x1: number, z0: number, z1: number, base: number, h: number, wall: string, roof: string, frontWindow = true): void {
  const b = y.b;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box(w, h, d, cx, base + h / 2, cz, wall);
  const pitch = w * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.004, 0); shape.lineTo(w / 2 + 0.004, 0); shape.lineTo(0, pitch); shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth: d + 0.008, bevelEnabled: false }).translate(0, 0, -d / 2 - 0.004), cx, base + h, cz, roof, 0, 1);
  // Door on the front (+Z) face, with a dark opening and a lintel in detail.
  b.box(w * 0.22, h * 0.5, 0.004, cx - w * 0.2, base + h * 0.25, z1 + 0.002, "#4b4f49", 0, 2);
  if (b.detailed && frontWindow) {
    b.window(cx + w * 0.2, base + h * 0.62, z1 + 0.003, 0, 0.008, 0.012);
    b.box(w * 0.3, 0.004, 0.006, cx - w * 0.2, base + h * 0.52, z1 + 0.004, b.palette.trim);
  }
}

function gableHouse(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, base: number, h: number, wall: string, roof: string): void {
  gableBody(y, x0, x1, z0, z1, base, h, wall, roof);
  houseRecord(y, name, x0, x1, z0, z1);
}

// Hip-roofed terracotta house: low pyramid roof on a square-ish mass.
function hipHouse(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, base: number, h: number, wall: string, roof: string): void {
  const b = y.b;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box(w, h, d, cx, base + h / 2, cz, wall);
  const roofGeom = new THREE.ConeGeometry(w * Math.SQRT1_2, h * 0.45, 4).rotateY(Math.PI / 4).scale(1, 1, d / w);
  b.add(roofGeom, cx, base + h + h * 0.225, cz, roof, 0, 1);
  if (b.detailed) b.window(cx, base + h * 0.5, z1 + 0.003, 0, 0.007, 0.011);
  b.box(w * 0.2, h * 0.42, 0.004, cx, base + h * 0.21, z1 + 0.002, "#4b4f49", 0, 2);
  houseRecord(y, name, x0, x1, z0, z1);
}

// Flat-roofed house with a thin parapet, for Dorne-style masonry.
function flatHouse(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, base: number, h: number, wall: string, cap: string): void {
  const b = y.b;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box(w, h, d, cx, base + h / 2, cz, wall);
  b.box(w + 0.006, 0.008, d + 0.006, cx, base + h + 0.004, cz, cap);
  b.box(w * 0.2, h * 0.5, 0.004, cx, base + h * 0.25, z1 + 0.002, "#4b4f49", 0, 2);
  if (b.detailed) b.window(cx - w * 0.25, base + h * 0.6, z1 + 0.003, 0, 0.007, 0.011);
  houseRecord(y, name, x0, x1, z0, z1);
}

// Open-fronted stable: a dark interior bay behind a gable front.
function stable(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, base: number, h: number, wall: string, roof: string): void {
  gableBody(y, x0, x1, z0, z1, base, h, wall, roof);
  const b = y.b, cx = (x0 + x1) / 2;
  b.box((x1 - x0) * 0.5, h * 0.55, 0.004, cx, base + h * 0.28, z1 + 0.002, "#2c3033");
  houseRecord(y, name, x0, x1, z0, z1);
}

// Smithy with a visible forge glow and a chimney stack on the ridge end. It has
// no front window: the outer curtain's window frames sit beside its front.
function smithy(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, base: number, h: number, wall: string, roof: string): void {
  const b = y.b;
  gableBody(y, x0, x1, z0, z1, base, h, wall, roof, false);
  const cz = (z0 + z1) / 2;
  b.box(0.012, 0.034, 0.012, x1 - 0.010, base + h + 0.02, cz - 0.008, "#8e8a80");
  b.box(0.015, 0.004, 0.015, x1 - 0.010, base + h + 0.039, cz - 0.008, "#5b5f5e");
  b.box((x1 - x0) * 0.22, 0.02, 0.004, x0 + (x1 - x0) * 0.3, base + 0.02, z1 + 0.002, "#ff9a3c", 0, 3);
  houseRecord(y, name, x0, x1, z0, z1);
}

// Raised granary on timber posts, with a small hip cap. Leaves air beneath.
function granary(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, base: number, wall: string, roof: string, wood: string): void {
  const b = y.b;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const post = 0.012, lift = 0.028;
  [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([px, pz]) => b.box(post, lift + 0.01, post, px - Math.sign(px - cx) * post / 2, base + lift / 2, pz - Math.sign(pz - cz) * post / 2, wood, 0, 2));
  b.box(w, 0.014, d, cx, base + lift + 0.007, cz, wood, 0, 2);
  b.box(w, 0.03, d, cx, base + lift + 0.029, cz, wall);
  b.add(new THREE.ConeGeometry(w * Math.SQRT1_2, 0.028, 4).rotateY(Math.PI / 4).scale(1, 1, d / w), cx, base + lift + 0.058, cz, roof, 0, 1);
  y.record(name, x0, x1, z0, z1);
}

// Open well: a stone ring, two posts and a crossbar, all within a small disc.
function well(y: Yard, name: string, x: number, z: number, r: number, stone: string, wood: string): void {
  const b = y.b;
  const ground = 0.02;
  b.add(new THREE.LatheGeometry([
    new THREE.Vector2(r * 0.64, 0), new THREE.Vector2(r * 0.64, 0.022),
    new THREE.Vector2(r, 0.022), new THREE.Vector2(r * 1.08, 0),
    new THREE.Vector2(r * 0.64, 0)
  ], b.detailed ? 16 : 8), x, ground, z, stone);
  b.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.002, 8), x, ground + 0.003, z, "#273b3c");
  [-1, 1].forEach(side => b.box(0.006, 0.05, 0.006, x + side * r * 0.9, ground + 0.036, z, wood, 0, 2));
  b.box(r * 2.2, 0.008, 0.008, x, ground + 0.062, z, wood, 0, 2);
  y.record(name, x - r * 1.08, x + r * 1.08, z - r * 1.08, z + r * 1.08);
}

// Paved lane between buildings, flush on the foundation: y .020..024.
function lane(y: Yard, name: string, x0: number, x1: number, z0: number, z1: number, color: string): void {
  y.b.box(x1 - x0, 0.004, z1 - z0, (x0 + x1) / 2, 0.022, (z0 + z1) / 2, color, 0, 0);
  y.record(name, x0, x1, z0, z1);
}

// Each site lays out its own yard. Coordinates are local to the castle origin,
// gate toward +Z. Winterfell keeps clear of the godswood root strip
// (x .1655..2005, z -.027..0977) and the gate passage (|x| < .05).
export function winterfellYard(b: CastleBuilder): Footprint[] {
  const y = new Yard(b);
  const p = b.palette;
  // Timber and slate: heavier roof pitch than the Riverlands, lighter than the Red Keep.
  // The inner ward's free corner beside the keep holds the stable; the outer west
  // ward, between the curtain's window frames and clear of the corner towers,
  // holds the smithy and granary. No room remains for a well or longhouse.
  lane(y, "winterfell-lane", -0.02, 0.02, 0.10, 0.15, "#8f8778");
  smithy(y, "winterfell-smithy", -0.1975, -0.1685, -0.0455, -0.0155, 0.02, 0.05, "#6c6c66", "#4c4f52");
  granary(y, "winterfell-granary", -0.1975, -0.1685, 0.013, 0.046, 0.02, "#8a7b66", "#5b4d3d", p.wood);
  stable(y, "winterfell-stable", -0.1175, -0.07, 0.026, 0.046, 0.02, 0.045, "#7b6a58", p.roof);
  return y.footprints;
}

export function kingsLandingYard(b: CastleBuilder): Footprint[] {
  const y = new Yard(b);
  const p = b.palette;
  // Low terracotta hip roofs and whitewashed walls, arranged along lanes. The
  // palace block occupies x -.105..195, z -.178..062 from y .0145, so the yard
  // runs in the back-left corner, the front-centre court and the east lane.
  hipHouse(y, "kl-house-a", -0.1875, -0.1425, -0.12, -0.08, 0.02, 0.035, "#d7b7a0", p.roof);
  hipHouse(y, "kl-house-b", -0.1875, -0.1475, -0.1655, -0.1355, 0.02, 0.03, "#c9a48b", p.roof);
  well(y, "kl-well", -0.13, -0.045, 0.012, "#c9b9a0", p.wood);
  lane(y, "kl-street-east", 0.196, 0.2215, -0.05, 0.07, "#b9a48a");
  stable(y, "kl-stable", 0.02, 0.10, 0.07, 0.11, 0.02, 0.03, "#c69d86", p.roof);
  smithy(y, "kl-smithy", 0.12, 0.18, 0.07, 0.104, 0.02, 0.035, "#b98c76", p.roof);
  hipHouse(y, "kl-stall-west", -0.2, -0.16, -0.06, -0.02, 0.02, 0.02, "#ddc4ad", p.roof);
  hipHouse(y, "kl-stall-east", -0.06, 0.0, 0.07, 0.11, 0.02, 0.02, "#ddc4ad", p.roof);
  return y.footprints;
}

export function sunspearYard(b: CastleBuilder): Footprint[] {
  const y = new Yard(b);
  const p = b.palette;
  // Parapeted flat roofs with a fountain-style well: Dornish reference is inferred.
  // Houses clear the sandship, the south-west tower, the garden and the curtain
  // windows and their trims; the well sits inside the court, clear of the wall.
  flatHouse(y, "sun-house-east", 0.09, 0.14, 0.05, 0.0715, 0.02, 0.05, "#dfb98c", p.trim);
  flatHouse(y, "sun-house-west", -0.14, -0.095, 0.034, 0.07, 0.02, 0.04, "#d7ad7c", p.trim);
  flatHouse(y, "sun-house-back", -0.072, -0.042, -0.0835, -0.0655, 0.02, 0.04, "#cfa37a", p.trim);
  well(y, "sun-well", -0.13, 0.014, 0.011, "#e2c196", p.wood);
  return y.footprints;
}

export function riverrunYard(b: CastleBuilder): Footprint[] {
  const y = new Yard(b);
  const p = b.palette;
  // Riverside timber lanes: the front yard runs between the gate and the keep.
  // Houses stay clear of the gate towers; the granary sits off the keep's trim
  // bands; the smithy sits in the narrow apex between the diagonal curtains.
  lane(y, "rr-lane", -0.018, 0.018, 0.045, 0.105, "#8e8067");
  gableHouse(y, "rr-house-west", -0.14, -0.105, 0.074, 0.1, 0.02, 0.035, "#8c7a64", p.roof);
  gableHouse(y, "rr-house-east", 0.105, 0.14, 0.074, 0.1, 0.02, 0.035, "#8c7a64", p.roof);
  granary(y, "rr-granary", -0.1265, -0.0785, 0.04, 0.066, 0.02, "#7e6d58", p.roof, p.wood);
  smithy(y, "rr-smithy", -0.015, 0.015, -0.13, -0.10, 0.02, 0.04, "#70655a", p.roof);
  well(y, "rr-well", -0.04, 0.085, 0.011, "#8e9a94", p.wood);
  return y.footprints;
}

// Existing regional forts retain their keep, entrance and resource ledge.
// Small service houses occupy the side court below the keep's windows.
export function genericYard(b: CastleBuilder, strong: boolean): Footprint[] {
  const y = new Yard(b), p = b.palette;
  const narrow = !strong && b.style == "stormlands";
  const side = b.style == "vale" ? 1 : -1;
  // Castle service houses sit in the gaps between the side-window trims at z 0
  // and ±.0616, and clear the narrow stormlands wall line.
  const cx = side * (strong ? 0.15 : narrow ? 0.0905 : 0.093);
  const halfWidth = strong ? 0.021 : narrow ? 0.0075 : 0.013;
  const depth = strong ? 0.050 : 0.021;
  (strong ? [-0.064, 0.047] : [-0.036, 0.0268]).forEach((z, index) => {
    if (b.style == "vale" && index == 0) return;
    const name = `service-${index}`, h = strong ? 0.048 : 0.030;
    if (b.style == "dorne" || b.style == "essos") {
      flatHouse(y, name, cx - halfWidth, cx + halfWidth, z - depth / 2, z + depth / 2, 0.02, h, p.stone, p.trim);
    } else if (b.style == "westerlands" || b.style == "crownlands") {
      hipHouse(y, name, cx - halfWidth, cx + halfWidth, z - depth / 2, z + depth / 2, 0.02, h, p.stone, p.roof);
    } else {
      gableHouse(y, name, cx - halfWidth, cx + halfWidth, z - depth / 2, z + depth / 2, 0.02, h, p.stone, p.roof);
    }
  });
  return y.footprints;
}

import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";
import { CastlePalette } from "./castleStyles";
import { approach, curtainSegment, portal, squareTower, stoneRing, terrace } from "./CastleArchitecture";
import { kingsLandingYard, winterfellYard } from "./CastleNeighborhood";
import { winterfellGodswood } from "./CastleGodswood";

// Original, bounded procedural studies of the landmark exteriors. Production
// references and remaining fidelity work: docs/design/v3-architecture-references.md.
// Geometry remains one merged draw per castle, including the Balanced variant.
// A "-city" suffix marks the World keep inside a realism/cities capital:
// same palette and sculpt, minus pieces the city already draws.
const baseKind = (kind: string): string => kind.replace(/-city$/, "");

export function landmarkCastlePalette(variant: string): Partial<CastlePalette> | undefined {
  const kind = baseKind(variant);
  if (kind == "dragonstone") return { stone: "#515b5e", trim: "#788080", roof: "#434e52", round: false };
  if (kind == "winterfell") return { stone: "#838b88", trim: "#a9ada5", roof: "#514b40", wood: "#665343", round: true };
  if (kind == "kings-landing") return { stone: "#ad6c54", trim: "#cc987c", roof: "#8d4f39", round: true };
  if (kind == "highgarden") return { stone: "#b3a88a", trim: "#c9bd9d", roof: "#82765b", wood: "#65523a", round: false };
  if (kind == "storms-end") return { stone: "#737b7b", trim: "#92958b", roof: "#666e70", wood: "#4b4940", round: true };
  return undefined;
}

function gable(b: CastleBuilder, w: number, h: number, d: number, x: number, y: number, z: number): void {
  const roof = new THREE.Shape();
  roof.moveTo(-w / 2, 0); roof.lineTo(w / 2, 0); roof.lineTo(0, h); roof.closePath();
  b.add(new THREE.ExtrudeGeometry(roof, { depth: d, bevelEnabled: false }), x, y, z - d / 2, b.palette.roof, 0, 2, 1);
}

function winterfell(b: CastleBuilder): number {
  const p = b.palette;
  b.box(0.54, 0.11, 0.44, 0, -0.035, 0);
  b.curtain(0.44, 0.34, 0.02, false, 0.12);
  b.curtain(0.28, 0.21, 0.035, false, 0.15);
  // Broad Great Keep and long timber-roofed hall, rather than a single spire.
  b.tower(-0.04, -0.055, 0.25, 0.071, 0.035, false);
  b.roof(-0.04, -0.055, 0.315, 0.086, 0.085);
  b.box(0.10, 0.14, 0.22, 0.06, 0.105, -0.015);
  gable(b, 0.125, 0.073, 0.245, 0.06, 0.175, -0.015);
  b.tower(-0.15, -0.10, 0.34, 0.039, 0.02, false);
  b.box(0.10, 0.055, 0.05, 0.12, 0.055, -0.085, "#849b91");
  gable(b, 0.11, 0.032, 0.057, 0.12, 0.083, -0.085);
  b.box(0.018, 0.065, 0.023, -0.072, 0.4025, -0.068, p.stone);
  if (b.detailed) {
    // Covered wall walks, repeated timber supports and the glass gardens.
    [-1, 1].forEach(side => {
      b.box(0.35, 0.015, 0.038, 0, 0.153, side * 0.17, p.wood, 0, 2);
      for (let i = 0; i < 7; i++) b.box(0.006, 0.028, 0.008, (i - 3) * 0.049, 0.134, side * 0.184, p.wood, 0, 2);
      b.window(side * 0.053 + 0.06, 0.115, 0.01, side * Math.PI / 2);
    });
    for (let i = 0; i < 5; i++) b.box(0.004, 0.055, 0.057, 0.078 + i * 0.021, 0.058, -0.085, p.trim);
  }
  winterfellGodswood(b);
  // Inner-ward smithy, stable, granary and well sit on the free ground beside the keep.
  winterfellYard(b);
  return 0.207;
}

function redKeep(b: CastleBuilder, sept = true): number {
  const p = b.palette;
  b.box(0.58, 0.11, 0.47, 0, -0.035, 0);
  b.curtain(0.48, 0.37, 0.02, false, 0.10);
  b.box(0.30, 0.085, 0.24, 0.045, 0.057, -0.058, "#b59177");
  // Clustered terracotta towers and tall paired windows of the landmark Red Keep.
  b.box(0.15, 0.23, 0.12, 0.055, 0.21, -0.075);
  b.roof(0.055, -0.075, 0.325, 0.115, 0.10, true);
  const towers = [[-0.055, -0.13, 0.275, 0.031], [0.145, -0.13, 0.31, 0.036], [0.145, 0.005, 0.235, 0.028], [-0.04, 0.005, 0.215, 0.028]];
  towers.forEach(([x, z, h, r]) => b.tower(x, z, h, r, 0.095));
  b.box(0.19, 0.12, 0.055, 0.055, 0.155, 0.015);
  b.roof(0.055, 0.015, 0.215, 0.145, 0.055, true);
  b.box(0.022, 0.065, 0.024, 0.021, 0.4425, -0.096);
  // The Sept is a separate low city landmark, with a pale dome and seven towers.
  // A mounted World city draws its own Great Sept on Visenya's Hill instead.
  if (sept) {
    b.box(0.105, 0.075, 0.10, -0.14, 0.06, 0.075, "#d8cbb2");
    b.add(new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(0.060 * Math.cos(i * Math.PI / 16), 0.055 * Math.sin(i * Math.PI / 16))), b.detailed ? 24 : 12), -0.14, 0.10, 0.075, "#c7bd9e", 0, 1);
  }
  if (b.detailed) {
    if (sept) {
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        b.tower(-0.14 + Math.sin(a) * 0.063, 0.075 + Math.cos(a) * 0.063, 0.075, 0.009, 0.025);
      }
    }
    [-1, 1].forEach(side => {
      for (let i = 0; i < 3; i++) b.window(0.055 + side * 0.041, 0.18 + i * 0.046, -0.010, 0, 0.014, 0.031);
    });
    for (let i = 0; i < 6; i++) {
      const x = -0.18 + i * 0.067;
      b.box(0.043, 0.035 + i % 2 * 0.015, 0.047, x, 0.042, 0.15, "#c5af8c");
      b.add(new THREE.ConeGeometry(0.037, 0.028, 4), x, 0.078 + i % 2 * 0.015, 0.15, p.roof, Math.PI / 4, 1);
    }
  }
  if (sept) {
    // Rhaenys's ruined dome remains distinct from the pale Sept and red palace.
    b.add(new THREE.CylinderGeometry(0.037, 0.041, 0.013, 12), -0.20, 0.034, -0.105, "#968773");
    b.add(new THREE.CylinderGeometry(0.018, 0.034, 0.025, 9), -0.20, 0.043, -0.105, "#9d8b75");
    // Neutral hulls and short Blackwater quays: no sails or heraldry.
    for (let i = 0; i < 3; i++) {
      const x = 0.08 + i * 0.055;
      b.box(0.014, 0.009, 0.055, x, 0.004, 0.224, "#716351", 0, 2);
      b.add(new THREE.SphereGeometry(1, 8, 4).scale(0.009, 0.005, 0.024), x + 0.018, 0.002, 0.232, "#584d41", 0, 2);
    }
  }
  // Lower-city stalls and the palace-side yard sit inside the existing skirt.
  kingsLandingYard(b);
  return 0.22;
}

function dragonstone(b: CastleBuilder): number {
  const p = b.palette;
  b.cliff(0.15, 0.235, 0, 0, "#465257");
  b.box(0.32, 0.045, 0.22, 0, 0.1125, -0.025, p.stone);
  // Stepped angular masses and blade-like buttresses, from landmark's season 7
  // production concept. The silhouette is masonry; no detached wing tokens.
  b.box(0.12, 0.265, 0.11, -0.025, 0.2675, -0.065);
  b.box(0.067, 0.32, 0.074, -0.045, 0.295, -0.085);
  [-1, 1].forEach(side => {
    b.box(0.065, 0.19, 0.10, side * 0.104, 0.23, -0.025);
    b.box(0.07, 0.12, 0.12, side * 0.11, 0.195, 0.035);
    const blade = new THREE.Shape();
    blade.moveTo(-0.017, 0); blade.lineTo(0.017, 0); blade.lineTo(0.007, 0.25); blade.lineTo(-0.007, 0.205); blade.closePath();
    for (let i = 0; i < 3; i++) b.add(new THREE.ExtrudeGeometry(blade, { depth: 0.043, bevelEnabled: false }), side * (0.073 + i * 0.033), 0.115, -0.096 + i * 0.033, i % 2 ? p.trim : p.stone, side * 0.15);
    b.box(0.024, 0.035, 0.025, -0.045 + side * 0.026, 0.47, -0.085, p.trim);
    b.box(0.035, 0.10, 0.032, side * 0.067, 0.185, 0.10);
    b.window(side * 0.067, 0.19, 0.119, 0, 0.012, 0.041);
  });
  // Recessed pointed audience-chamber opening and a stair between stone walls.
  const opening = new THREE.Shape();
  opening.moveTo(-0.020, 0); opening.lineTo(0.020, 0); opening.lineTo(0, 0.095); opening.closePath();
  b.add(new THREE.ExtrudeGeometry(opening, { depth: 0.004, bevelEnabled: false }), -0.025, 0.23, -0.008, "#202c31");
  for (let i = 0; i < (b.detailed ? 10 : 5); i++) {
    const t = i / (b.detailed ? 10 : 5);
    b.box(0.075, 0.018, b.detailed ? 0.016 : 0.032, 0, 0.032 + t * 0.095, 0.17 - t * 0.14, p.trim);
  }
  [-1, 1].forEach(side => b.box(0.014, 0.04, 0.16, side * 0.05, 0.098, 0.10));
  // Two stable ledges keep actual barrel/crown resources out of the stair.
  [-1, 1].forEach(side => b.box(0.075, 0.018, 0.068, side * 0.115, 0.126, 0.052));
  return 0.202;
}

function highgarden(b: CastleBuilder): number {
  const p = b.palette;
  // Almodóvar / landmark S7: an irregular hill fortress, square towers of different
  // heights and open courts. No book-derived three concentric garden rings.
  const outline = [[-0.245, -0.17], [-0.15, -0.226], [0.16, -0.21], [0.245, -0.10], [0.245, 0.095], [0.15, 0.21], [0.085, 0.282], [-0.095, 0.282], [-0.18, 0.21], [-0.25, 0.08]];
  terrace(b, outline, -0.09, 0.025, "#81836b", true);
  terrace(b, [[-0.185, -0.175], [0.15, -0.175], [0.19, -0.10], [0.18, 0.095], [0.13, 0.15], [-0.17, 0.15]], -0.03, 0.078, p.stone);
  b.box(0.25, 0.006, 0.24, 0, 0.081, -0.015, "#b8ad8a");
  // Forward ledges keep the actual resource ornaments ahead of the curtains.
  // Their matching anchors live in castlePlacement, not in gameplay data.
  [-1, 1].forEach(side => b.box(0.064, 0.1135, 0.064, side * 0.212, 0.02675, 0.145, p.stone));
  const walls = [[-0.182, 0.12], [-0.19, -0.12], [-0.12, -0.18], [0.14, -0.17], [0.19, -0.085], [0.17, 0.12]];
  walls.slice(0, -1).forEach((point, i) => curtainSegment(b, point, walls[i + 1], 0.078, i < 3 ? 0.16 : 0.13));
  curtainSegment(b, [-0.18, 0.13], [-0.038, 0.16], 0.025, 0.14);
  curtainSegment(b, [0.038, 0.16], [0.17, 0.13], 0.025, 0.14);
  squareTower(b, -0.105, -0.115, 0.092, 0.094, 0.078, 0.32);
  squareTower(b, 0.135, -0.12, 0.080, 0.083, 0.078, 0.235);
  squareTower(b, -0.17, 0.095, 0.071, 0.08, 0.025, 0.225);
  squareTower(b, 0.16, 0.09, 0.066, 0.077, 0.025, 0.18);
  // A lower residential wing and raised inner walk leave daylight in the court.
  b.box(0.18, 0.118, 0.065, 0.016, 0.137, -0.115);
  curtainSegment(b, [-0.065, -0.075], [0.12, -0.075], 0.078, 0.12);
  b.garden(0.08, 0.025, 0.064, 0.085, 0.085);
  b.garden(-0.085, 0.055, 0.047, 0.06, 0.085);
  // Bent outer approach and narrow gate: grounded stone rather than a wooden
  // gate module perched on the edge of a square slab.
  [-1, 1].forEach(side => squareTower(b, side * 0.054, 0.157, 0.039, 0.048, 0.025, 0.14));
  b.box(0.07, 0.035, 0.028, 0, 0.151, 0.161);
  portal(b, 0, 0.176, 0.029, 0.040, 0.083);
  approach(b, 0, 0.196, 0.238, 0.04, 0.075);
  if (b.detailed) {
    for (let i = 0; i < 5; i++) {
      // A small internal stair joins the lower and upper courts, backed by
      // the terrace below rather than suspended individual treads.
      b.box(0.037, 0.012 + i * 0.01, 0.013, -0.025, 0.031 + i * 0.005, 0.136 - i * 0.013, p.trim);
      b.window(-0.04 + i * 0.032, 0.147, -0.079, 0, 0.011, 0.027);
    }
    // Sparse climbing greenery, kept below the parapets and resource ledges.
    for (let i = 0; i < 5; i++) b.add(new THREE.SphereGeometry(0.019, 7, 4).scale(0.7, 1.3, 0.6), -0.153 + i * 0.013, 0.10 + i % 2 * 0.019, 0.133, "#647453");
  }
  return 0.244;
}

function stormsEnd(b: CastleBuilder): number {
  const p = b.palette;
  // Belshaw's late exterior study: one dominant ribbed drum, a narrow windowed
  // crown and low dome above a walled approach. Earlier multi-tower concepts
  // are not treated as the final screen layout. Dimensions here are inferred.
  terrace(b, [[-0.19, -0.13], [-0.12, -0.19], [0.13, -0.18], [0.205, -0.07], [0.18, 0.14], [0.09, 0.195], [0.075, 0.238], [-0.075, 0.238], [-0.12, 0.19], [-0.205, 0.075]], -0.10, 0.035, "#6a7473", true);
  b.add(new THREE.CylinderGeometry(0.124, 0.142, 0.085, b.detailed ? 40 : 20), 0, 0.0775, -0.044);
  b.add(new THREE.CylinderGeometry(0.117, 0.124, 0.30, b.detailed ? 48 : 24), 0, 0.27, -0.044);
  const ribs = 12;
  for (let i = 0; i < ribs; i++) {
    const a = i * Math.PI * 2 / ribs;
    const rib = new THREE.Shape();
    rib.moveTo(0.117, 0.115); rib.lineTo(0.142, 0.115); rib.lineTo(0.126, 0.22); rib.lineTo(0.120, 0.42); rib.lineTo(0.113, 0.42); rib.closePath();
    b.add(new THREE.ExtrudeGeometry(rib, { depth: 0.012, bevelEnabled: false }).translate(0, 0, -0.006), 0, 0, -0.044, i % 3 == 0 ? p.trim : p.stone, -a);
  }
  // A real open arcade: piers and rings surround recessed panes. The crown
  // remains in the simple LOD so the distant silhouette does not become a rook.
  stoneRing(b, 0.128, 0.107, 0.415, 0.014, -0.044);
  const openings = b.detailed ? 24 : 16;
  for (let i = 0; i < openings; i++) {
    const a = i * Math.PI * 2 / openings;
    b.box(0.008, 0.030, 0.016, Math.sin(a) * 0.118, 0.443, -0.044 + Math.cos(a) * 0.118, p.stone, a);
    if (b.detailed) b.window(Math.sin(a + Math.PI / openings) * 0.111, 0.442, -0.044 + Math.cos(a + Math.PI / openings) * 0.111, a + Math.PI / openings, 0.014, 0.024);
  }
  stoneRing(b, 0.130, 0.106, 0.458, 0.012, -0.044);
  const domePoints = b.detailed ? 13 : 7;
  const dome = Array.from({ length: domePoints }, (_, i) => {
    const a = i / (domePoints - 1) * Math.PI / 2;
    return new THREE.Vector2(0.127 * Math.cos(a), 0.040 * Math.sin(a));
  });
  b.add(new THREE.LatheGeometry(dome, b.detailed ? 48 : 24), 0, 0.470, -0.044, p.roof);
  // Open forecourt, not another solid concentric pedestal. The front gap is
  // closed by the recessed entrance and its structural arch.
  stoneRing(b, 0.18, 0.155, 0.035, 0.115, 0, 0.20, Math.PI * 2 - 0.40);
  const merlons = 25;
  for (let i = 0; i < merlons; i++) {
    const a = 0.25 + i / (merlons - 1) * (Math.PI * 2 - 0.50);
    b.box(0.017, 0.023, 0.027, Math.sin(a) * 0.168, 0.160, Math.cos(a) * 0.168, p.stone, a);
  }
  [-1, 1].forEach(side => {
    b.box(0.019, 0.13, 0.034, side * 0.033, 0.10, 0.166);
    b.box(0.022, 0.017, 0.041, side * 0.033, 0.17, 0.166, p.trim);
  });
  portal(b, 0, 0.174, 0.035, 0.044, 0.105);
  portal(b, 0, 0.081, 0.058, 0.037, 0.077);
  approach(b, 0, 0.195, 0.229, 0.037, 0.060);
  return 0.205;
}

export function buildLandmarkCastle(variant: string, b: CastleBuilder): number | undefined {
  const kind = baseKind(variant);
  if (kind == "winterfell") return winterfell(b);
  if (kind == "kings-landing") return redKeep(b, kind == variant);
  if (kind == "dragonstone") return dragonstone(b);
  if (kind == "highgarden") return highgarden(b);
  if (kind == "storms-end") return stormsEnd(b);
  return undefined;
}

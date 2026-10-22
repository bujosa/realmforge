import * as THREE from "three";
import CastleBuilder from "../castles/CastleBuilder";
import { CastleStyle } from "../castles/castleStyles";

export type CastleSettlementKind = "vale-hamlet" | "vale-croft" | "village-house";
// Regional home masonry/roof forms; essos never receives a public village.
export type SettlementHomeStyle = Exclude<CastleStyle, "essos">;

export interface CastleSettlementBlock {
  id: string;
  kind: CastleSettlementKind;
  // Only one-house blocks are regional; Vale blocks omit it and keep their v1 look.
  style?: SettlementHomeStyle;
  anchor: THREE.Vector3;
  boundsWorld: { min: THREE.Vector3; max: THREE.Vector3 };
  // Absolute world street port, outside all eaves, at the oriented +Z edge.
  // With yaw it may lie inside the world AABB; it is not a house doorway.
  entry: THREE.Vector3;
  scale: number;
  yaw: number;
}

interface SettlementDesign {
  halfSize: [number, number];
  height: number;
  // Model units below the anchor that the rooted base must reach. It is
  // deeper than the support range so every sampled low point is buried.
  root: number;
  entry: [number, number, number];
}

// Includes roofs, chimney, rooted base and the entrance. These are model units;
// CastlePlacement converts them once to absolute world bounds for the terrain
// owner to accept/omit. They are proposals, never automatically rendered.
export const castleSettlementDesigns: Record<CastleSettlementKind, SettlementDesign> = {
  "vale-hamlet": { halfSize: [0.12, 0.105], height: 0.12, root: 0.035, entry: [0, 0.006, 0.105] },
  "vale-croft": { halfSize: [0.11, 0.095], height: 0.105, root: 0.035, entry: [0, 0.006, 0.095] },
  // One small inhabited house: at most 0.05 local half-extent including eaves.
  "village-house": { halfSize: [0.046, 0.042], height: 0.10, root: 0.04, entry: [0, 0.006, 0.042] }
};

export interface CastleSettlementCandidate {
  id: string;
  kind: CastleSettlementKind;
  offset: [number, number];
  yaw: number;
}

// Ordered alternatives share an id: consumers accept at most one per id.
// No owner, army, resource or other private game state selects a design.
export function castleSettlementCandidates(regionId: string): CastleSettlementCandidate[] {
  if (regionId == "the-eyrie") return [
    { id: "eyrie-lower-hamlet", kind: "vale-hamlet", offset: [-0.42, 0.16], yaw: 0 },
    { id: "eyrie-lower-hamlet", kind: "vale-hamlet", offset: [-0.38, -0.22], yaw: Math.PI / 2 },
    { id: "eyrie-croft", kind: "vale-croft", offset: [-0.48, 0.43], yaw: -0.2 },
    { id: "eyrie-croft", kind: "vale-croft", offset: [-0.48, -0.45], yaw: 0.2 }
  ];
  if (regionId == "the-vale-of-arryn") return [
    { id: "vale-market", kind: "vale-hamlet", offset: [-0.36, 0.08], yaw: 0 },
    { id: "vale-market", kind: "vale-hamlet", offset: [0.36, 0.08], yaw: 0 },
    { id: "vale-croft", kind: "vale-croft", offset: [-0.31, 0.35], yaw: -0.15 },
    { id: "vale-croft", kind: "vale-croft", offset: [0.31, 0.35], yaw: 0.15 }
  ];
  return [];
}

// Original inhabited architecture: different spans, occupied upper storeys,
// plaster infill, ridge caps, shutters, chimneys and working yards. Both LODs
// keep every dwelling and the same ground/roof silhouette.
export function castleHouse(b: CastleBuilder, x: number, z: number, w: number, d: number, h: number, base: number, variant = 0, yaw = 0): void {
  const p = b.palette;
  const wall = ["#c8c3ae", "#b7b6a5", "#d1cbb8", "#a9b1aa"][variant % 4];
  const roof = ["#61717b", "#73828a", "#5a6870", "#777d78"][variant % 4];
  const transform = (dx: number, dz: number): [number, number] => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  const box = (width: number, height: number, depth: number, dx: number, y: number, dz: number, color: string, surface = 0): void => {
    const [px, pz] = transform(dx, dz);
    b.box(width, height, depth, px, y, pz, color, yaw, surface);
  };
  box(w + 0.004, 0.022, d + 0.004, 0, base - 0.007, 0, "#9c9f94");
  box(w, h, d, 0, base + h / 2, 0, wall);
  const pitch = w * 0.46;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.004, 0); shape.lineTo(w / 2 + 0.004, 0);
  shape.lineTo(0, pitch); shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth: d + 0.009, bevelEnabled: false }).translate(0, 0, -d / 2 - 0.0045), x, base + h, z, roof, yaw, 1);
  box(0.004, 0.004, d + 0.011, 0, base + h + pitch, 0, p.trim);
  box(0.009, 0.026, 0.010, w * 0.23, base + h + pitch * 0.65 + 0.007, -d * 0.24, "#a4a99f");
  // Door and lower shutters stay present in Balanced too.
  box(w * 0.22, h * 0.46, 0.002, -w * 0.15, base + h * 0.23, d / 2 + 0.001, "#4b4f49", 2);
  if (!b.detailed) return;
  box(w + 0.002, 0.004, d + 0.002, 0, base + h * 0.53, 0, "#72766c", 2);
  [-1, 1].forEach(side => {
    box(0.003, h, 0.003, side * w * 0.46, base + h / 2, d / 2 + 0.002, "#74796e", 2);
    box(w * 0.17, h * 0.23, 0.002, side * w * 0.25, base + h * 0.75, d / 2 + 0.002, "#37434a");
    box(w * 0.20, 0.002, 0.005, side * w * 0.25, base + h * 0.62, d / 2 + 0.004, p.trim);
    box(0.002, h * 0.24, d * 0.25, side * (w / 2 + 0.001), base + h * 0.65, 0, "#445357");
  });
  box(0.012, 0.005, 0.013, -w * 0.15, base + 0.002, d / 2 + 0.008, p.trim);
  box(0.012, 0.003, 0.013, w * 0.23, base + h + pitch * 0.65 + 0.021, -d * 0.24, "#606d6c");
  // Roofing courses are baked timber/slate geometry, no texture or animation.
  for (let i = 1; i < 4; i++) {
    const dx = w * 0.5 * i / 4;
    [-1, 1].forEach(side => box(0.0015, 0.002, d + 0.009, side * dx, base + h + pitch * (1 - i / 4) + 0.001, 0, roof));
  }
}

// Regional roof pitch in model units. Dorne keeps low terraces, the north
// keeps steep timber roofs; every form stays inside the declared height.
const homePitch: Record<SettlementHomeStyle, number> = {
  north: 0.05, riverlands: 0.042, vale: 0.04, westerlands: 0.036, reach: 0.042,
  stormlands: 0.044, dorne: 0.014, islands: 0.046, crownlands: 0.038
};

// One original cottage: rooted plinth, plastered or stone walls, a gable roof,
// a lintel door on the entry side and an occupied upper storey in Detailed.
// Both LODs keep the same plinth, walls, roof and door silhouette.
export function villageHouseGeometry(style: SettlementHomeStyle, detailed: boolean): THREE.BufferGeometry {
  const b = new CastleBuilder(style, detailed);
  const design = castleSettlementDesigns["village-house"];
  const [rx, rz] = design.halfSize;
  // Plinth top sits at the anchor; its bottom reaches the declared root.
  b.box(rx * 2, design.root, rz * 2, 0, -design.root / 2, 0, "#8f9981");
  const w = 0.072, d = 0.06, wallH = 0.05, pitch = homePitch[style];
  b.box(w, wallH, d, 0, wallH / 2, 0, b.palette.stone);
  const shape = new THREE.Shape();
  shape.moveTo(-(w + 0.012) / 2, 0); shape.lineTo((w + 0.012) / 2, 0);
  shape.lineTo(0, pitch); shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth: d + 0.016, bevelEnabled: false }).translate(0, 0, -(d + 0.016) / 2), 0, wallH, 0, b.palette.roof, 0, 1);
  // Door on the +Z entry face, kept clear of the street port.
  b.box(0.014, 0.024, 0.002, -0.012, 0.012, d / 2 + 0.001, "#4b4f49", 0, 2);
  // The street's authored port is the outer edge of this real threshold,
  // at Y .006 in both LODs, rather than a point floating above the plinth.
  b.box(0.042, 0.006, 0.012, 0, 0.003, 0.036, b.palette.trim);
  if (!detailed) return b.finish();
  b.box(w + 0.002, 0.004, d + 0.002, 0, wallH * 0.53, 0, b.palette.trim, 0, 2);
  [-1, 1].forEach(side => {
    b.box(0.010, 0.018, 0.002, side * w * 0.25, wallH * 0.7, d / 2 + 0.002, "#37434a");
    b.box(0.003, wallH, 0.003, side * w * 0.46, wallH / 2, d / 2 + 0.002, b.palette.wood, 0, 2);
  });
  b.box(0.012, 0.022, 0.010, w * 0.2, wallH + pitch * 0.6, -d * 0.2, "#a4a99f");
  return b.finish();
}

export function castleSettlementGeometry(kind: CastleSettlementKind, detailed: boolean, style: SettlementHomeStyle = "vale"): THREE.BufferGeometry {
  if (kind == "village-house") return villageHouseGeometry(style, detailed);
  const b = new CastleBuilder("vale", detailed);
  const design = castleSettlementDesigns[kind];
  const [rx, rz] = design.halfSize;
  b.add(new THREE.BoxGeometry(rx * 2, 0.038, rz * 2), 0, -0.016, 0, "#8f9981");
  // A clear lane joins the common entrance; roofs never bridge that lane.
  b.box(0.025, 0.003, rz * 2, 0, 0.0045, 0, "#a7a28c");
  if (kind == "vale-hamlet") {
    [[-0.064, -0.056, 0.046, 0.058, 0.050], [0.067, -0.056, 0.055, 0.059, 0.064],
      [-0.069, 0.042, 0.049, 0.061, 0.060], [0.064, 0.047, 0.046, 0.052, 0.045]].forEach(([x, z, w, d, h], i) => castleHouse(b, x, z, w, d, h, 0.005, i));
    b.box(0.19, 0.003, 0.026, 0, 0.0045, -0.002, "#b2ab92");
    if (detailed) {
      b.add(new THREE.CylinderGeometry(0.010, 0.012, 0.013, 10), 0.033, 0.0115, -0.004, "#c0c0aa");
      b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 10), 0.033, 0.019, -0.004, "#34484d");
      b.box(0.026, 0.003, 0.016, -0.040, 0.030, -0.006, "#a5916e", 0, 2);
      [-1, 1].forEach(side => b.box(0.003, 0.027, 0.003, -0.040 + side * 0.011, 0.0165, -0.006, b.palette.wood, 0, 2));
    }
  } else {
    castleHouse(b, -0.044, -0.025, 0.057, 0.067, 0.052, 0.005, 2);
    castleHouse(b, 0.058, -0.039, 0.047, 0.076, 0.035, 0.005, 3);
    b.box(0.067, 0.004, 0.041, 0.056, 0.006, 0.047, "#73805f");
    if (detailed) {
      for (let i = 0; i < 5; i++) b.box(0.004, 0.003, 0.035, 0.031 + i * 0.012, 0.0095, 0.047, "#999475");
      [-1, 1].forEach(side => b.box(0.004, 0.023, 0.059, -0.044 + side * 0.038, 0.0165, 0.048, b.palette.wood, 0, 2));
      b.box(0.080, 0.004, 0.004, -0.044, 0.026, 0.078, b.palette.wood, 0, 2);
    }
  }
  return b.finish();
}

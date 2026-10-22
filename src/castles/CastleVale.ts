import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";
import { curtainSegment, portal, squareTower, terrace } from "./CastleArchitecture";
import { castleHouse } from "../cities/CastleSettlement";

// Compact, original interpretations for a game map. The Eyrie's pale palace,
// narrow rock and open galleries study the televised environment; this is not
// a measured reconstruction, nor the book's separate seven-tower plan.
export const valeArchitecture = {
  "the-eyrie": {
    height: 0.79, banner: [0, 0.705, -0.055], resource: [0.044, 0.348, 0.081],
    gate: [0, 0.026, 0.167], approach: [0, 0.025, 0.1835]
  },
  "the-vale-of-arryn": {
    height: 0.36, banner: [-0.075, 0.292, -0.078], resource: [0.16, 0.025, 0],
    gate: [0, 0.025, 0.127], approach: [0, 0.025, 0.179]
  }
} as const;

function rockySpire(b: CastleBuilder): void {
  const sides = b.detailed ? 36 : 18;
  const rings = b.detailed ? 10 : 5;
  const vertices: number[] = [];
  const point = (i: number, ring: number): number[] => {
    const a = i / sides * Math.PI * 2;
    const t = ring / rings;
    const radius = (1 - t * 0.27) * (0.89 + Math.sin(a * 3 + 0.25) * 0.065 + Math.sin(a * 7 + t * 2) * 0.025 + Math.sin(a * 17 + t * 49) * 0.014);
    return [Math.sin(a) * 0.207 * radius, -0.055 + t * 0.395, Math.cos(a) * 0.170 * radius - t * 0.016];
  };
  for (let ring = 0; ring < rings; ring++) for (let i = 0; i < sides; i++) {
    const a = point(i, ring), c = point(i + 1, ring), d = point(i, ring + 1), e = point(i + 1, ring + 1);
    vertices.push(...a, ...c, ...d, ...c, ...e, ...d);
  }
  for (let i = 0; i < sides; i++) vertices.push(...point(i, rings), ...point(i + 1, rings), 0, 0.34, -0.016);
  for (let i = 0; i < sides; i++) vertices.push(...point(i, 0), 0, -0.055, 0, ...point(i + 1, 0));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  geometry.computeVertexNormals();
  b.add(geometry, 0, 0, 0, "#8c9690", 0, 6);
}

// Arcades contain real openings: piers and curved spandrels, not black window
// stickers across a solid block. Balanced retains their structural openings.
function gallery(b: CastleBuilder, x: number, z: number, width: number, base: number, height: number, count: number, yaw = 0): void {
  const local = (dx: number, dz: number): [number, number] => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  const span = width / count, opening = span - 0.008;
  for (let i = 0; i <= count; i++) {
    const [px, pz] = local(-width / 2 + i * span, 0);
    b.box(0.008, height, 0.018, px, base + height / 2, pz, b.palette.trim, yaw);
    b.box(0.012, 0.006, 0.023, px, base + 0.003, pz, b.palette.trim, yaw);
  }
  for (let i = 0; i < count; i++) {
    const shape = new THREE.Shape();
    const r = opening / 2;
    shape.moveTo(-r, r + 0.007); shape.lineTo(r, r + 0.007); shape.lineTo(r, 0);
    for (let j = 0; j <= 8; j++) {
      const a = j / 8 * Math.PI;
      shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const [px, pz] = local(-width / 2 + (i + 0.5) * span, -0.009);
    b.add(new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false }), px, base + height - r - 0.005, pz, b.palette.trim, yaw);
  }
  const [px, pz] = local(0, 0);
  b.box(width + 0.017, 0.013, 0.031, px, base + height + 0.004, pz, b.palette.trim, yaw);
  b.box(width + 0.018, 0.008, 0.032, px, base - 0.004, pz, b.palette.trim, yaw);
}

function palaceTower(b: CastleBuilder, x: number, z: number, base: number, h: number, r: number, crown = false): void {
  const p = b.palette, segments = b.detailed ? 24 : 12;
  b.add(new THREE.CylinderGeometry(r, r * 1.06, h, segments), x, base + h / 2, z);
  [0.03, h * 0.45, h - 0.015].forEach(y => b.add(new THREE.CylinderGeometry(r * 1.10, r * 1.10, 0.008, segments), x, base + y, z, p.trim));
  if (crown) {
    b.add(new THREE.CylinderGeometry(r * 1.12, r, 0.021, segments), x, base + h + 0.0105, z, p.trim);
    b.add(new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.006, segments), x, base + h + 0.021, z, "#a9b8b8");
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      b.box(0.012, 0.019, 0.010, x + Math.sin(a) * r, base + h + 0.029, z + Math.cos(a) * r, p.trim, a);
    }
  } else {
    b.add(new THREE.ConeGeometry(r * 1.15, 0.062, segments), x, base + h + 0.031, z, p.roof, 0, 1);
  }
  if (b.detailed) for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    [0.35, 0.72].forEach(t => b.window(x + Math.sin(a) * (r + 0.001), base + h * t, z + Math.cos(a) * (r + 0.001), a, 0.009, 0.033));
  }
}

export function buildEyrie(b: CastleBuilder): number {
  const p = b.palette;
  rockySpire(b);
  terrace(b, [[-0.135, -0.094], [-0.095, -0.122], [0.098, -0.122], [0.139, -0.072], [0.139, 0.074], [0.105, 0.102], [-0.106, 0.102], [-0.137, 0.065]], 0.321, 0.347, p.stone);
  // Rear audience palace, attached wings and an open forecourt form one place.
  b.box(0.149, 0.184, 0.071, 0, 0.439, -0.057);
  b.box(0.162, 0.012, 0.081, 0, 0.533, -0.057, p.trim);
  palaceTower(b, 0, -0.055, 0.53, 0.151, 0.037, true);
  [-1, 1].forEach(side => {
    palaceTower(b, side * 0.094, -0.063, 0.347, 0.204, 0.027);
    palaceTower(b, side * 0.114, 0.038, 0.347, side < 0 ? 0.161 : 0.181, 0.020);
    b.box(0.038, 0.108, 0.119, side * 0.092, 0.401, -0.004);
    b.box(0.047, 0.011, 0.131, side * 0.092, 0.459, -0.004, p.trim);
    gallery(b, side * 0.073, 0.002, 0.094, 0.464, 0.057, 3, side * Math.PI / 2);
    b.box(0.047, 0.015, 0.112, side * 0.092, 0.534, -0.004, p.roof, 0, 1);
    // Lodgings and kitchen roofs are seated on the palace court.
    castleHouse(b, side * 0.079, 0.058, 0.032, 0.040, 0.036, 0.347, side < 0 ? 0 : 2);
  });
  gallery(b, 0, 0.001, 0.139, 0.348, 0.071, 5);
  // Lower open galleries/sky cells face the cliff. Recesses remain visible from
  // the side instead of a featureless pedestal below three detached cones.
  [-1, 1].forEach(side => gallery(b, side * 0.112, 0.001, 0.092, 0.259, 0.058, 3, side * Math.PI / 2));
  if (b.detailed) {
    for (let i = -2; i <= 2; i++) b.window(i * 0.026, 0.484, -0.094, Math.PI, 0.012, 0.030);
    [-1, 1].forEach(side => {
      for (let i = 0; i < 3; i++) b.box(0.014, 0.055, 0.026, side * 0.137, 0.332, -0.050 + i * 0.052, p.trim);
    });
  }
  // Mountain approach and gate lodge; both LODs share every landing/contact.
  const landings = [[0, 0.044, 0.148], [-0.095, 0.115, 0.108], [-0.144, 0.190, 0.018], [-0.116, 0.267, -0.071], [-0.071, 0.347, -0.081]];
  for (let i = 0; i < landings.length - 1; i++) {
    const a = landings[i], c = landings[i + 1], count = 8;
    for (let step = 0; step < count; step++) {
      const t = (step + 0.5) / count;
      const x = a[0] + (c[0] - a[0]) * t, z = a[2] + (c[2] - a[2]) * t;
      const y = a[1] + (c[1] - a[1]) * (step + 1) / count;
      b.box(0.031, 0.016, Math.hypot(c[0] - a[0], c[2] - a[2]) / count + 0.003, x, y - 0.008, z, p.trim, Math.atan2(c[0] - a[0], c[2] - a[2]));
    }
  }
  terrace(b, [[-0.058, 0.115], [0.058, 0.115], [0.058, 0.185], [-0.058, 0.185]], -0.055, 0.025, "#929a8e");
  b.box(0.064, 0.055, 0.036, 0, 0.0525, 0.133);
  portal(b, 0, 0.157, 0.026, 0.028, 0.044);
  // Actual resources retain dedicated, unobstructed seats on the front court.
  [-1, 1].forEach(side => b.box(0.031, 0.012, 0.029, side * 0.044, 0.342, 0.081, p.trim));
  b.box(0.108, 0.080, 0.057, 0, -0.0075, 0.15, "#929a8e");
  return 0.15;
}

export function buildValeSettlement(b: CastleBuilder): number {
  const p = b.palette;
  terrace(b, [[-0.173, -0.13], [-0.13, -0.163], [0.12, -0.163], [0.174, -0.11], [0.174, 0.13], [0.12, 0.18], [-0.13, 0.18], [-0.174, 0.11]], -0.06, 0.025, "#a7ad96", true);
  b.box(0.31, 0.006, 0.275, 0, 0.022, -0.008, "#aaa58d");
  // A small fortified town below a compact seat; a central lane and a square
  // separate housing from the keep. It is inferred architecture, not Gulltown.
  curtainSegment(b, [-0.147, -0.133], [0.145, -0.133], 0.025, 0.057, 0.014);
  [-1, 1].forEach(side => {
    curtainSegment(b, [side * 0.147, -0.133], [side * 0.147, 0.113], 0.025, 0.048, 0.014);
    curtainSegment(b, [side * 0.147, 0.113], [side * 0.026, 0.113], 0.025, 0.043, 0.014);
    squareTower(b, side * 0.034, 0.108, 0.025, 0.029, 0.025, 0.075);
  });
  squareTower(b, -0.075, -0.078, 0.061, 0.064, 0.025, 0.265);
  b.box(0.030, 0.006, 0.027, -0.075, 0.289, -0.078, "#a8b4b4");
  b.box(0.048, 0.092, 0.067, -0.017, 0.071, -0.076);
  b.add(new THREE.ConeGeometry(0.038, 0.042, 4), -0.017, 0.138, -0.076, p.roof, Math.PI / 4, 1);
  const houses = [[0.067, -0.088, 0.043, 0.055, 0.068], [0.113, -0.065, 0.027, 0.051, 0.046],
    [-0.101, 0.006, 0.041, 0.045, 0.051], [-0.049, 0.011, 0.033, 0.044, 0.063],
    [0.059, -0.006, 0.035, 0.044, 0.051], [0.112, 0.012, 0.030, 0.047, 0.059],
    [-0.105, 0.068, 0.042, 0.039, 0.056], [0.102, 0.073, 0.039, 0.036, 0.045]];
  houses.forEach(([x, z, w, d, h], i) => castleHouse(b, x, z, w, d, h, 0.026, i));
  b.box(0.028, 0.003, 0.257, 0.012, 0.027, -0.003, "#c4baa0");
  b.box(0.23, 0.003, 0.022, 0.004, 0.027, 0.043, "#c4baa0");
  portal(b, 0, 0.117, 0.025, 0.027, 0.056);
  // A continuous solid toe, outside the plaque, defines the external contact.
  b.add(new THREE.BoxGeometry(0.060, 0.085, 0.065), 0, -0.0175, 0.15, p.trim);
  [-1, 1].forEach(side => b.box(0.036, 0.085, 0.043, side * 0.16, -0.0175, 0, p.trim));
  if (b.detailed) {
    b.add(new THREE.CylinderGeometry(0.009, 0.011, 0.014, 10), 0.048, 0.034, 0.049, "#bec3ae");
    b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 10), 0.048, 0.042, 0.049, "#344950");
    [-1, 1].forEach(side => {
      b.box(0.023, 0.003, 0.018, side * 0.052, 0.056, 0.069, side > 0 ? "#8f9f9c" : "#b5a381", 0, 2);
      b.box(0.002, 0.029, 0.003, side * 0.052, 0.0415, 0.069, p.wood, 0, 2);
    });
  }
  return 0.15;
}

import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";
import { CastlePalette } from "./castleStyles";
import { squareTower } from "./CastleArchitecture";

// Original, compact study of the televised sea-stack fortress. The existing
// footprint, banner apex and strategic plaque remain the placement authority.
export const islandFortressPalette: Partial<CastlePalette> = {
  stone: "#626d70", trim: "#858c86", roof: "#39464b", wood: "#655541", round: true
};

type Point3 = [number, number, number];

function seaStack(b: CastleBuilder, x: number, z: number, top: number, rx: number, rz: number, phase: number, lean = 0, crownScale = 1): void {
  const sides = b.detailed ? 20 : 8, rings = b.detailed ? 8 : 3;
  const vertices: number[] = [];
  const point = (i: number, ring: number): Point3 => {
    const a = i % sides / sides * Math.PI * 2, t = ring / rings;
    // Coherent vertical fissures and broad erosion, rather than a wavy cylinder.
    const profile = 0.86 + Math.sin(a * 3 + phase) * 0.11 + Math.sin(a * 7 + phase * 2) * 0.065;
    const erosion = 0.94 + Math.sin(t * 8 + a * 2 + phase) * 0.08 + Math.sin(t * 19 - a * 3) * 0.035;
    const crown = Math.max(0.84, profile * (1.04 + Math.sin(a * 5 + phase) * 0.03));
    const radius = Math.min(1.07, profile * erosion * (1 - Math.pow(t, 4)) + crown * Math.pow(t, 4)) * (1 - (1 - crownScale) * t * t);
    const elevation = t + Math.sin(a * 4 + phase + t * 4) * Math.sin(t * Math.PI) * 0.03;
    return [Math.sin(a) * rx * radius + lean * t, -0.045 + (top + 0.045) * elevation, Math.cos(a) * rz * radius];
  };
  for (let ring = 0; ring < rings; ring++) for (let i = 0; i < sides; i++) {
    const a = point(i, ring), c = point(i + 1, ring), d = point(i, ring + 1), e = point(i + 1, ring + 1);
    vertices.push(...a, ...c, ...d, ...c, ...e, ...d);
  }
  for (let i = 0; i < sides; i++) {
    vertices.push(...point(i, rings), ...point(i + 1, rings), lean, top, 0);
    // Closed, downward-facing root participates in the shared terrain skirt.
    vertices.push(...point(i, 0), 0, -0.045, 0, ...point(i + 1, 0));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  g.computeVertexNormals();
  b.add(g, x, 0, z, "#737e79", 0, 6);
  // Damp mineral at the toe, salt staining near the crown; no water shader on
  // stone and no extra mesh/material for the colour transition.
  const colors = g.getAttribute("color"), positions = g.getAttribute("position");
  const wet = new THREE.Color("#303e42"), dry = new THREE.Color("#79817a");
  for (let i = 0; i < positions.count; i++) {
    const t = Math.max(0, Math.min(1, (positions.getY(i) + 0.01) / (top + 0.01)));
    const salt = Math.pow(t, 1.5) * (1 - 0.35 * Math.pow(t, 12)), grain = 0.94 + Math.sin(positions.getX(i) * 211 + positions.getZ(i) * 153) * 0.06;
    colors.setXYZ(i, (wet.r + (dry.r - wet.r) * salt) * grain, (wet.g + (dry.g - wet.g) * salt) * grain, (wet.b + (dry.b - wet.b) * salt) * grain);
  }
}

function arch(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape(), r = width / 2;
  shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, height - r);
  for (let i = 1; i <= 8; i++) {
    const a = i / 8 * Math.PI;
    shape.lineTo(Math.cos(a) * r, height - r + Math.sin(a) * r);
  }
  shape.closePath();
  return shape;
}

function plaqueToe(b: CastleBuilder): void {
  const outline = [[-0.091, 0.050], [-0.082, 0.042], [0.057, 0.042], [0.063, 0.050], [0.063, 0.105], [0.056, 0.114], [-0.056, 0.114], [-0.090, 0.105]];
  const vertices: number[] = [];
  outline.forEach(([x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    const a = [x, 0.0265, z], c = [nx, 0.0265, nz], d = [x * 0.97, -0.045, 0.075 + (z - 0.075) * 0.97], e = [nx * 0.97, -0.045, 0.075 + (nz - 0.075) * 0.97];
    vertices.push(...a, ...c, ...d, ...c, ...e, ...d, ...a, 0, 0.0265, 0.075, ...c, ...d, ...e, 0, -0.045, 0.075);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
  g.computeVertexNormals();
  b.add(g, 0, 0, 0, "#47585b", 0, 6);
}

function door(b: CastleBuilder, [x, sill, z]: Point3, angle: number, width = 0.018, height = 0.038): void {
  if (!b.detailed) {
    // Distant LOD retains the opening and its exact sill, without arch rings.
    b.box(width, height, 0.007, x, sill + height / 2, z, "#202a2e", angle, 2);
    b.box(width + 0.012, 0.009, 0.008, x, sill - 0.0045, z, b.palette.stone, angle);
    return;
  }
  // The surround has an actual opening. Its recessed leaf and lintel are
  // rotated as one authored doorway, including doors facing the two bridges.
  const shape = arch(width + 0.010, height + 0.006) as THREE.Shape & { holes: THREE.Shape[] };
  shape.holes.push(arch(width, height));
  b.add(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }), x, sill, z, b.palette.trim, angle);
  b.add(new THREE.ExtrudeGeometry(arch(width, height), { depth: 0.0015, bevelEnabled: false }), x, sill, z, "#202a2e", angle, 2);
  const local = (dx: number, dz: number): [number, number] => [x + Math.cos(angle) * dx + Math.sin(angle) * dz, z - Math.sin(angle) * dx + Math.cos(angle) * dz];
  const [dx, dz] = local(0, 0.002);
  b.add(new THREE.ExtrudeGeometry(arch(width * 0.80, height * 0.94), { depth: 0.0015, bevelEnabled: false }), dx, sill, dz, b.palette.wood, angle, 2);
  [0.23, 0.64].forEach(t => {
    const [bx, bz] = local(0, 0.004);
    b.box(width * 0.82, 0.002, 0.002, bx, sill + height * t, bz, "#343e3f", angle);
  });
  const [lx, lz] = local(0, 0.001);
  b.box(width + 0.012, 0.009, 0.008, lx, sill - 0.0045, lz, b.palette.stone, angle);
}

function beam(b: CastleBuilder, a: Point3, c: Point3, thickness: number, width: number, rope = false): void {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
  const length = Math.hypot(dx, dy, dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)), yaw = -Math.atan2(dz, dx);
  const g = rope
    ? new THREE.CylinderGeometry(thickness / 2, thickness / 2, length, 4).rotateZ(pitch - Math.PI / 2)
    : new THREE.BoxGeometry(length + 0.0004, thickness, width).rotateZ(pitch);
  b.add(g, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2, rope ? "#8a7c61" : b.palette.wood, yaw, 2);
}

function ropeBridge(b: CastleBuilder, a: Point3, c: Point3, sag: number): void {
  const count = b.detailed ? 14 : 3, dx = c[0] - a[0], dz = c[2] - a[2], length = Math.hypot(dx, dz);
  const nx = -dz / length, nz = dx / length;
  const point = (t: number, side = 0, rail = false): Point3 => [
    a[0] + dx * t + nx * side * 0.013,
    a[1] + (c[1] - a[1]) * t - 4 * t * (1 - t) * (sag + (rail ? 0.004 : 0)) + (rail ? 0.026 : 0),
    a[2] + dz * t + nz * side * 0.013
  ];
  for (let i = 0; i < count; i++) {
    const p = point(i / count), q = point((i + 1) / count);
    p[1] -= 0.0015; q[1] -= 0.0015;
    beam(b, p, q, 0.003, 0.022);
    [-1, 1].forEach(side => beam(b, point(i / count, side, true), point((i + 1) / count, side, true), b.detailed ? 0.002 : 0.0035, 0, true));
  }
  for (let i = 0; i <= count; i++) {
    if (i != 0 && i != count && (!b.detailed || i % 2)) continue;
    [-1, 1].forEach(side => {
      const p = point(i / count, side), q = point(i / count, side, true);
      if (i == 0 || i == count) {
        q[1] += 0.007;
        beam(b, p, q, 0.004, 0.004);
      } else beam(b, p, q, 0.0015, 0, true);
    });
  }
}

function hallRoof(b: CastleBuilder): void {
  const shape = new THREE.Shape();
  shape.moveTo(-0.031, 0); shape.lineTo(0.031, 0); shape.lineTo(0, 0.038); shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth: 0.078, bevelEnabled: false }).rotateY(Math.PI / 2), -0.240, 0.232, 0.012, b.palette.roof, 0, 1);
}

export function buildIslandFortress(b: CastleBuilder): number {
  const p = b.palette;
  seaStack(b, -0.015, 0, 0.195, 0.102, 0.080, 0.3);
  seaStack(b, 0.195, -0.032, 0.258, 0.053, 0.049, 1.7, 0.004);
  seaStack(b, -0.202, 0.010, 0.115, 0.057, 0.053, 3.1, -0.003);
  seaStack(b, 0.092, 0.073, 0.095, 0.017, 0.022, 2.3, 0, 0.12);
  seaStack(b, -0.108, -0.078, 0.125, 0.022, 0.025, 4.8, 0, 0.18);

  // Broad keep and a separate tall sea tower replace the three equal drums.
  b.box(0.127, 0.028, 0.094, -0.015, 0.196, 0, "#4a585a");
  squareTower(b, -0.015, 0, 0.117, 0.078, 0.205, 0.196);
  b.add(new THREE.CylinderGeometry(0.024, 0.029, 0.100, b.detailed ? 16 : 8), 0, 0.40, 0);
  b.add(new THREE.CylinderGeometry(0.028, 0.026, 0.009, b.detailed ? 16 : 8), 0, 0.446, 0, p.trim);
  b.roof(0, 0, 0.45, 0.034, 0.065);
  squareTower(b, 0.199, -0.032, 0.050, 0.050, 0.253, 0.202);
  b.box(0.070, 0.121, 0.050, -0.201, 0.1715, 0.012);
  hallRoof(b);
  b.add(new THREE.CylinderGeometry(0.017, 0.020, 0.165, b.detailed ? 16 : 8), -0.224, 0.1945, -0.015);
  b.add(new THREE.CylinderGeometry(0.022, 0.020, 0.012, b.detailed ? 16 : 8), -0.224, 0.277, -0.015, p.trim);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    b.box(0.010, 0.015, 0.010, -0.224 + Math.sin(a) * 0.019, 0.29, -0.015 + Math.cos(a) * 0.019, p.stone, a);
  }

  const west: Point3 = [-0.166, 0.182, 0.012], keepWest: Point3 = [-0.0735, 0.226, -0.004];
  const keepEast: Point3 = [0.0435, 0.307, -0.025], sea: Point3 = [0.174, 0.327, -0.032];
  door(b, west, Math.PI / 2); door(b, keepWest, -Math.PI / 2);
  door(b, keepEast, Math.PI / 2); door(b, sea, -Math.PI / 2);
  ropeBridge(b, west, keepWest, 0.006); ropeBridge(b, keepEast, sea, 0.022);

  // Rooted, irregular rock toe supports the unchanged real castle-level plaque.
  // Its top is exactly the plaque underside (0.0265); it adds no game resource.
  plaqueToe(b);
  b.box(0.034, 0.050, 0.024, -0.076, 0.048, 0.046, p.stone);
  door(b, [-0.076, 0.028, 0.059], 0, 0.017, 0.037);
  if (b.detailed) {
    [-1, 1].forEach(side => {
      b.box(0.010, 0.145, 0.014, -0.015 + side * 0.044, 0.286, 0.040, p.trim);
      b.window(-0.015 + side * 0.029, 0.255, 0.042, 0, 0.006, 0.025);
      b.window(-0.201 + side * 0.019, 0.19, 0.039, 0, 0.008, 0.027);
    });
    b.window(0, 0.428, 0.025, 0, 0.008, 0.025);
    // Timber hoarding is carried by corbels, rather than a floating balcony.
    b.box(0.018, 0.008, 0.039, 0.231, 0.397, -0.032, p.wood, 0, 2);
    [-1, 1].forEach(side => {
      b.box(0.019, 0.020, 0.008, 0.229, 0.386, -0.032 + side * 0.013, p.stone);
    });
    b.box(0.004, 0.028, 0.039, 0.238, 0.413, -0.032, p.wood, 0, 2);
    b.add(new THREE.BoxGeometry(0.029, 0.004, 0.043).rotateZ(-0.18), 0.2315, 0.429, -0.032, p.roof, 0, 1);
  }
  return 0.082;
}

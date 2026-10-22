import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";
import { portal } from "./CastleArchitecture";

// Original limestone bank study, informed by the Šibenik filming location.
// Local bounds, plaque and the existing banner anchor remain unchanged. This
// architecture never depicts a house's balance or the availability of a loan.
function arch(width: number, height: number, segments: number): THREE.Shape {
  const shape = new THREE.Shape();
  const radius = width / 2;
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, height - radius);
  for (let i = 1; i <= segments; i++) {
    const angle = i / segments * Math.PI;
    shape.lineTo(Math.cos(angle) * radius, height - radius + Math.sin(angle) * radius);
  }
  shape.closePath();
  return shape;
}

function window(b: CastleBuilder, x: number, base: number, z: number, yaw: number, width: number, height: number): void {
  const segments = b.detailed ? 10 : 5;
  const surround = arch(width + 0.012, height + 0.008, segments) as THREE.Shape & { holes: THREE.Shape[] };
  surround.holes.push(arch(width, height, segments));
  b.add(new THREE.ExtrudeGeometry(surround, { depth: 0.012, bevelEnabled: false }), x, base, z, "#cfcdbd", yaw);
  b.add(new THREE.ExtrudeGeometry(arch(width, height, segments), { depth: 0.002, bevelEnabled: false }), x, base, z, "#394346", yaw);
  if (b.detailed) {
    b.box(0.003, height * 0.83, 0.004, x, base + height * 0.42, z, "#8d978f", yaw);
  }
}

function barrelVault(b: CastleBuilder, width: number, height: number, depth: number, x: number, base: number, z: number): void {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  const segments = b.detailed ? 20 : 10;
  for (let i = 1; i <= segments; i++) {
    const angle = i / segments * Math.PI;
    shape.lineTo(Math.cos(angle) * width / 2, Math.sin(angle) * height);
  }
  shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), x, base, z - depth / 2, "#a7ada6");
}

export function buildIronBank(b: CastleBuilder): number {
  const limestone = "#bec3b8", trim = "#dad7c6", shadow = "#868f87";
  b.box(0.52, 0.11, 0.43, 0, -0.035, 0, limestone);
  b.box(0.40, 0.020, 0.29, 0, 0.04, 0.02, trim);
  // Connected nave and lower aisles; the portal recess has actual depth rather
  // than being painted on an uninterrupted front box.
  b.box(0.32, 0.23, 0.022, 0, 0.155, -0.144, limestone);
  [-1, 1].forEach(side => {
    b.box(0.070, 0.23, 0.26, side * 0.125, 0.155, -0.025, limestone);
    b.box(0.105, 0.13, 0.26, side * 0.1475, 0.105, -0.025, limestone);
    barrelVault(b, 0.105, 0.036, 0.27, side * 0.1475, 0.17, -0.025);
    b.box(0.018, 0.20, 0.28, side * 0.099, 0.15, -0.025, limestone);
    // Buttress feet, shafts and caps share the same foundation and keep their
    // structural silhouette in Balanced; only narrow masonry joints are near.
    for (let i = 0; i < 4; i++) {
      const z = -0.135 + i * 0.075;
      b.box(0.033, 0.035, 0.037, side * 0.207, 0.0625, z, shadow);
      b.box(0.025, 0.143, 0.027, side * 0.204, 0.1155, z, limestone);
      b.box(0.030, 0.012, 0.034, side * 0.204, 0.193, z, trim);
      if (i < 3) window(b, side * 0.201, 0.092, z + 0.036, side * Math.PI / 2, 0.026, 0.060);
    }
    b.box(0.017, 0.021, 0.283, side * 0.10, 0.255, -0.025, trim);
    b.box(0.030, 0.235, 0.035, side * 0.061, 0.1575, 0.121, limestone);
    b.box(0.038, 0.015, 0.044, side * 0.061, 0.053, 0.121, trim);
    b.box(0.038, 0.016, 0.044, side * 0.061, 0.272, 0.121, trim);
    window(b, side * 0.127, 0.097, 0.108, 0, 0.026, 0.066);
  });
  b.box(0.15, 0.079, 0.030, 0, 0.2405, 0.112, limestone);
  barrelVault(b, 0.215, 0.071, 0.28, 0, 0.265, -0.025);
  // Recessed portal, iron door leaves, threshold and rooted stair. The panel
  // remains the game's existing Bank UI; this is not a second purchase flow.
  b.box(0.084, 0.153, 0.010, 0, 0.1265, 0.086, "#303938");
  portal(b, 0, 0.116, 0.05, 0.076, 0.143);
  [-1, 1].forEach(side => {
    b.box(0.027, 0.106, 0.006, side * 0.016, 0.104, 0.129, "#414844");
    if (b.detailed) {
      b.add(new THREE.TorusGeometry(0.004, 0.0014, 4, 8), side * 0.010, 0.102, 0.135, "#b5a77d");
    }
  });
  // Keep the authored r1 stair envelope and plaqueDepth. No entry/footprint
  // metadata is moved by this finish pass.
  for (let step = 0; step < 4; step++) b.box(0.21, 0.009, 0.025, 0, 0.013 + step * 0.009, 0.202 - step * 0.021, trim);
  b.box(0.090, 0.012, 0.042, 0, 0.045, 0.132, trim);
  // The rose has a dark backing, real concentric mouldings and radial stone
  // tracery. It is architectural ornament, not an income/coin resource marker.
  b.add(new THREE.CylinderGeometry(0.030, 0.030, 0.003, b.detailed ? 24 : 12).rotateX(Math.PI / 2), 0, 0.241, 0.129, "#394346");
  [0.033, 0.025].forEach(radius => b.add(new THREE.TorusGeometry(radius, 0.003, 4, b.detailed ? 24 : 12), 0, 0.241, 0.132, trim));
  const spokes = b.detailed ? 8 : 4;
  for (let i = 0; i < spokes; i++) {
    const angle = i * Math.PI * 2 / spokes;
    b.add(new THREE.BoxGeometry(0.003, 0.026, 0.004).rotateZ(-angle), Math.sin(angle) * 0.013, 0.241 + Math.cos(angle) * 0.013, 0.133, trim);
  }
  // Octagonal crossing drum, ribbed stone dome and a small seated roof boss
  // retain a recognisable silhouette at range without a generic blue cone.
  b.add(new THREE.CylinderGeometry(0.081, 0.089, 0.052, 8), 0, 0.310, -0.025, limestone, Math.PI / 8);
  b.add(new THREE.CylinderGeometry(0.090, 0.087, 0.012, 8), 0, 0.337, -0.025, trim, Math.PI / 8);
  const count = b.detailed ? 13 : 7;
  const dome = Array.from({ length: count }, (_, i) => {
    const angle = i / (count - 1) * Math.PI / 2;
    return new THREE.Vector2(0.086 * Math.cos(angle), 0.073 * Math.sin(angle));
  });
  b.add(new THREE.LatheGeometry(dome, b.detailed ? 32 : 16), 0, 0.343, -0.025, "#9ba69e", Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2 + Math.PI / 8;
    const samples = b.detailed ? 10 : 5;
    const rib = new THREE.Shape();
    for (let j = 0; j < samples; j++) {
      const arc = j / (samples - 1) * Math.PI / 2;
      if (j == 0) rib.moveTo(0.087, 0);
      else rib.lineTo(0.087 * Math.cos(arc), 0.0735 * Math.sin(arc));
    }
    for (let j = samples - 1; j >= 0; j--) {
      const arc = j / (samples - 1) * Math.PI / 2;
      rib.lineTo(0.083 * Math.cos(arc), 0.0695 * Math.sin(arc));
    }
    rib.closePath();
    b.add(new THREE.ExtrudeGeometry(rib, { depth: 0.0044, bevelEnabled: false }).translate(0, 0, -0.0022), 0, 0.343, -0.025, trim, angle - Math.PI / 2);
  }
  b.add(new THREE.CylinderGeometry(0.009, 0.012, 0.020, 8), 0, 0.425, -0.025, trim);
  if (b.detailed) {
    // Sparse horizontal joints and corbels, bounded rather than one block per
    // stone. Both side and rear elevations receive the same level of finish.
    [0.083, 0.147, 0.214].forEach(y => {
      b.box(0.326, 0.003, 0.003, 0, y, -0.157, shadow);
      [-1, 1].forEach(side => b.box(0.003, 0.003, 0.26, side * 0.201, y < 0.17 ? y : 0.163, -0.025, shadow));
    });
    [-1, 1].forEach(side => window(b, side * 0.075, 0.137, -0.157, Math.PI, 0.030, 0.070));
    for (let i = -2; i <= 2; i++) b.box(0.013, 0.018, 0.017, i * 0.056, 0.253, 0.112, trim);
  }
  return 0.22;
}

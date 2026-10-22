import * as THREE from "three";
import CastleBuilder from "../castles/CastleBuilder";

// Original masonry study. Local X crosses the river, Z follows its current.
// The caller retains the crossing, clearance, visibility and disposal contract.
export default function bridgeGeometry(span: number, opening: number, ends: [number[], number[]], physical = false): THREE.BufferGeometry {
  if (physical) return physicalBridge(span, opening, ends);
  const b = new CastleBuilder("riverlands", true);
  const arch = new THREE.Shape();
  arch.moveTo(-span / 2, -0.05); arch.lineTo(-span / 2, 0.10);
  arch.lineTo(span / 2, 0.10); arch.lineTo(span / 2, -0.05);
  arch.lineTo(opening / 2, -0.05);
  for (let i = 0; i <= 20; i++) {
    const a = i / 20 * Math.PI;
    arch.lineTo(Math.cos(a) * opening / 2, Math.sin(a) * 0.075);
  }
  arch.lineTo(-opening / 2, -0.05); arch.closePath();
  b.add(new THREE.ExtrudeGeometry(arch, { depth: 0.085, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1, steps: 1 }), 0, 0, -0.0425, "#858c81");

  // Radial voussoirs describe a real opening on both faces, with a crown stone.
  for (let i = 0; i < 13; i++) {
    const a = (i + 0.045) / 13 * Math.PI, c = (i + 0.955) / 13 * Math.PI;
    const stone = new THREE.Shape();
    stone.moveTo(Math.cos(a) * opening / 2, Math.sin(a) * 0.075);
    stone.lineTo(Math.cos(c) * opening / 2, Math.sin(c) * 0.075);
    stone.lineTo(Math.cos(c) * (opening / 2 + 0.014), Math.sin(c) * 0.095);
    stone.lineTo(Math.cos(a) * (opening / 2 + 0.014), Math.sin(a) * 0.095);
    stone.closePath();
    [-1, 1].forEach(side => b.add(new THREE.ExtrudeGeometry(stone, { depth: 0.003, bevelEnabled: false }), 0, 0, side < 0 ? -0.047 : 0.044, i == 6 ? "#bec0ac" : i % 3 ? "#a7ad9c" : "#969f91"));
  }
  const courses = Math.max(4, Math.ceil(span / 0.035));
  [-1, 1].forEach(side => {
    for (let i = 0; i < courses; i++) {
      const x = -span / 2 + (i + 0.5) * span / courses;
      b.box(span / courses - 0.001, 0.027, 0.012, x, 0.112, side * 0.043, i % 3 ? "#939c8b" : "#a4ad99");
      b.box(span / courses - 0.0008, 0.006, 0.018, x, 0.128, side * 0.043, "#b7bca8");
    }
    // Battered abutments and triangular cutwaters, within the former bank width.
    b.box(0.040, 0.125, 0.096, side * (span / 2 - 0.015), 0.005, 0, "#747e72");
    [-1, 1].forEach(face => {
      const nose = new THREE.Shape();
      nose.moveTo(-0.018, 0); nose.lineTo(0.018, 0); nose.lineTo(0, face * 0.014); nose.closePath();
      const g = new THREE.ExtrudeGeometry(nose, { depth: 0.072, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      b.add(g, side * (span / 2 - 0.015), 0.027, face * 0.048, "#7d8879");
    });
    const inner = side * span / 2, outer = inner + side * 0.13;
    const heights = ends[side < 0 ? 0 : 1];
    // Each outer row follows the full terrain width. Both the top and closed
    // foundation share those samples, rather than burying one edge in a slope.
    const vertices: number[] = [];
    const quad = (a: number[], c: number[], d: number[], e: number[]): void => {
      if (side > 0) vertices.push(...a, ...c, ...d, ...a, ...d, ...e);
      else vertices.push(...a, ...d, ...c, ...a, ...e, ...d);
    };
    for (let i = 0; i < heights.length - 1; i++) {
      const z0 = -0.043 + i / (heights.length - 1) * 0.086;
      const z1 = -0.043 + (i + 1) / (heights.length - 1) * 0.086;
      const a = [inner, 0.10, z0], c = [inner, 0.10, z1];
      const d = [outer, heights[i + 1], z1], e = [outer, heights[i], z0];
      const ab = [inner, -0.05, z0], cb = [inner, -0.05, z1];
      const db = [outer, heights[i + 1] - 0.035, z1], eb = [outer, heights[i] - 0.035, z0];
      quad(a, c, d, e); quad(ab, eb, db, cb);
      quad(eb, e, d, db); quad(ab, cb, c, a);
      if (i == 0) quad(ab, a, e, eb);
      if (i == heights.length - 2) quad(cb, db, d, c);
    }
    const ramp = new THREE.BufferGeometry();
    ramp.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    ramp.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
    ramp.computeVertexNormals();
    b.add(ramp, 0, 0, 0, "#929b88");
    [-1, 1].forEach(edge => {
      const end = heights[edge < 0 ? 0 : heights.length - 1];
      const curb = new THREE.Shape();
      curb.moveTo(inner, 0.10); curb.lineTo(outer, end);
      curb.lineTo(outer, end + 0.006); curb.lineTo(inner, 0.119); curb.closePath();
      b.add(new THREE.ExtrudeGeometry(curb, { depth: 0.010, bevelEnabled: false }), 0, 0, edge < 0 ? -0.048 : 0.038, "#a4ad98");
    });
  });
  return b.finish();
}

// At ×20 the old single shallow arch would span a river hundreds of metres
// wide. Repeated 20–30 m segmental vaults spring just above the water from
// 5 m piers with cutwaters, under a 6 m road with parapets that continue down
// the approach ramps, so the crossing reads as a stone bridge from 2 km and
// from the bank. Scene units of the World ×20 frame (1 u = 50 m); the mesh
// origin sits 0.015 u (0.75 m) below the water surface.
function physicalBridge(span: number, opening: number, ends: [number[], number[]]): THREE.BufferGeometry {
  const b = new CastleBuilder("riverlands", true);
  const pier = 0.1;
  const count = Math.max(2, Math.round((opening + pier) / (0.52 + pier)));
  const archWidth = (opening - (count - 1) * pier) / count;
  const base = -0.08, spring = 0.035, rise = Math.min(0.2, archWidth * 0.32);
  const deck = spring + rise + 0.05, halfDeck = 0.06;
  const centers = Array.from({ length: count }, (_, arch) => opening / 2 - archWidth / 2 - arch * (archWidth + pier));
  const arc = (shape: THREE.Shape, center: number, half: number, height: number, from: number, to: number): void => {
    for (let i = 0; i <= 18; i++) {
      const angle = from + (to - from) * i / 18;
      shape.lineTo(center + Math.cos(angle) * half, spring + Math.sin(angle) * height);
    }
  };
  // Spandrel wall: solid from the river bed to the road, open under each vault.
  const wall = new THREE.Shape();
  wall.moveTo(-span / 2, base); wall.lineTo(-span / 2, deck);
  wall.lineTo(span / 2, deck); wall.lineTo(span / 2, base);
  centers.forEach(center => {
    wall.lineTo(center + archWidth / 2, base);
    arc(wall, center, archWidth / 2, rise, 0, Math.PI);
    wall.lineTo(center - archWidth / 2, base);
  });
  wall.lineTo(-span / 2, base); wall.closePath();
  b.add(new THREE.ExtrudeGeometry(wall, { depth: halfDeck * 2, bevelEnabled: false, steps: 1 }), 0, 0, -halfDeck, "#8e8a7c");
  [-1, 1].forEach(face => {
    const z = face * (halfDeck + 0.002);
    // Voussoir ring on both faces: the lighter band that makes each vault read.
    centers.forEach(center => {
      const ring = new THREE.Shape();
      ring.moveTo(center + archWidth / 2 + 0.024, spring);
      arc(ring, center, archWidth / 2 + 0.024, rise + 0.024, 0, Math.PI);
      ring.lineTo(center - archWidth / 2, spring);
      arc(ring, center, archWidth / 2, rise, Math.PI, 0);
      ring.closePath();
      b.add(new THREE.ExtrudeGeometry(ring, { depth: 0.004, bevelEnabled: false }), 0, 0, face < 0 ? z - 0.004 : z, "#aaa593");
    });
    // String course under the parapet, and the parapet with its coping.
    b.box(span, 0.012, 0.008, 0, deck - 0.018, face * (halfDeck + 0.004), "#a19d8c");
    const courseCount = Math.max(4, Math.ceil(span / 0.1));
    for (let i = 0; i < courseCount; i++) {
      const x = -span / 2 + (i + 0.5) * span / courseCount;
      b.box(span / courseCount - 0.002, 0.024, 0.012, x, deck + 0.012, face * (halfDeck - 0.006), i % 3 ? "#959181" : "#a29e8d");
      b.box(span / courseCount - 0.001, 0.007, 0.016, x, deck + 0.0275, face * (halfDeck - 0.006), "#b4b0a0");
    }
    // Triangular cutwaters split the current at every pier, up to the springing.
    centers.slice(0, -1).forEach(center => {
      const x = center - archWidth / 2 - pier / 2;
      const nose = new THREE.Shape();
      nose.moveTo(x - pier / 2, -face * halfDeck); nose.lineTo(x, -face * (halfDeck + 0.065)); nose.lineTo(x + pier / 2, -face * halfDeck); nose.closePath();
      const g = new THREE.ExtrudeGeometry(nose, { depth: spring + 0.05 - base, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      b.add(g, 0, base, 0, "#7f7b6e");
    });
  });
  // Darker paving on the road.
  b.box(span, 0.004, halfDeck * 2 - 0.024, 0, deck + 0.002, 0, "#7c766a");
  [-1, 1].forEach(side => {
    const inner = side * span / 2, outer = inner + side * 1.6; // 80 m floodplain approach
    const heights = ends[side < 0 ? 0 : 1];
    const vertices: number[] = [];
    const quad = (a: number[], c: number[], d: number[], e: number[]): void => {
      if (side > 0) vertices.push(...a, ...c, ...d, ...a, ...d, ...e);
      else vertices.push(...a, ...d, ...c, ...a, ...e, ...d);
    };
    for (let i = 0; i < heights.length - 1; i++) {
      const z0 = -halfDeck + i / (heights.length - 1) * halfDeck * 2;
      const z1 = -halfDeck + (i + 1) / (heights.length - 1) * halfDeck * 2;
      const a = [inner, deck, z0], c = [inner, deck, z1];
      const d = [outer, heights[i + 1], z1], e = [outer, heights[i], z0];
      const ab = [inner, base, z0], cb = [inner, base, z1];
      const db = [outer, heights[i + 1] - 0.04, z1], eb = [outer, heights[i] - 0.04, z0];
      quad(a, c, d, e); quad(ab, eb, db, cb);
      quad(eb, e, d, db); quad(ab, cb, c, a);
      if (i == 0) quad(ab, a, e, eb);
      if (i == heights.length - 2) quad(cb, db, d, c);
    }
    const ramp = new THREE.BufferGeometry();
    ramp.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    ramp.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
    ramp.computeVertexNormals();
    b.add(ramp, 0, 0, 0, "#8a8576");
    // The parapets follow both ramp edges down to the bank.
    [-1, 1].forEach(edge => {
      const end = heights[edge < 0 ? 0 : heights.length - 1];
      const curb = new THREE.Shape();
      curb.moveTo(inner, deck); curb.lineTo(outer, end);
      curb.lineTo(outer, end + 0.02); curb.lineTo(inner, deck + 0.031); curb.closePath();
      b.add(new THREE.ExtrudeGeometry(curb, { depth: 0.012, bevelEnabled: false }), 0, 0, edge < 0 ? -halfDeck : halfDeck - 0.012, "#9d9988");
    });
    // Abutment: the bank pier where the last vault lands.
    b.box(0.08, deck - base, halfDeck * 2 + 0.03, side * (span / 2 - 0.03), (deck + base) / 2, 0, "#7f7b6e");
  });
  return b.finish();
}

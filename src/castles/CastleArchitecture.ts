import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";

// Small authored masonry helpers. Everything goes through CastleBuilder so
// colour, projected UVs, surface tags, merging and scene disposal stay shared.
export function terrace(b: CastleBuilder, outline: number[][], bottom: number, top: number, color: string, rock = false): void {
  if (rock) {
    // An irregular battered toe meets relief without the broad vertical edge
    // of a rectangular display slab. The negative rings retain skirt support.
    const vertices: number[] = [];
    const triangle = (a: number[], c: number[], d: number[]): void => { vertices.push(...a, ...c, ...d); };
    outline.forEach(([x, z], i) => {
      const [nx, nz] = outline[(i + 1) % outline.length];
      const a = [x, bottom, z], c = [nx, bottom, nz];
      const d = [x * 0.96, -0.013, z * 0.96], e = [nx * 0.96, -0.013, nz * 0.96];
      // The narrow front toe supports the entrance and its resource plaque;
      // unlike the sides, it must reach the full authored approach depth.
      const f = [x * 0.88, top, z * (z > 0.19 ? 1 : 0.88)];
      const g = [nx * 0.88, top, nz * (nz > 0.19 ? 1 : 0.88)];
      triangle(a, d, c); triangle(c, d, e);
      triangle(d, f, e); triangle(e, f, g);
      triangle(f, [0, top, 0], g);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
    geometry.computeVertexNormals();
    b.add(geometry, 0, 0, 0, color, 0, 5);
    return;
  }
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false }).rotateX(-Math.PI / 2), 0, bottom, 0, color, 0, rock ? 5 : 0);
}

export function curtainSegment(b: CastleBuilder, from: number[], to: number[], base: number, h: number, thickness = 0.025): void {
  const [x, z] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const angle = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  b.box(length + 0.005, h, thickness, x, base + h / 2, z, b.palette.stone, angle);
  b.box(length + 0.007, 0.009, thickness + 0.008, x, base + h - 0.02, z, b.palette.trim, angle);
  const count = Math.max(2, Math.ceil(length / 0.032));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    b.box(length / count * 0.52, 0.022, thickness + 0.003,
      from[0] + (to[0] - from[0]) * t, base + h + 0.009,
      from[1] + (to[1] - from[1]) * t, b.palette.stone, angle);
  }
}

export function squareTower(b: CastleBuilder, x: number, z: number, width: number, depth: number, base: number, h: number): void {
  const p = b.palette;
  b.box(width, h, depth, x, base + h / 2, z);
  b.box(width + 0.008, 0.018, depth + 0.008, x, base + 0.012, z, p.trim);
  b.box(width + 0.012, 0.016, depth + 0.012, x, base + h - 0.018, z, p.trim);
  b.box(width - 0.014, 0.005, depth - 0.014, x, base + h + 0.001, z, "#696654");
  [-1, 1].forEach(side => {
    b.box(width + 0.009, 0.019, 0.012, x, base + h + 0.01, z + side * depth / 2);
    b.box(0.012, 0.019, depth + 0.009, x + side * width / 2, base + h + 0.01, z);
    for (let i = 0; i < 3; i++) {
      b.box(width / 5, 0.023, 0.017, x + (i - 1) * width * 0.41, base + h + 0.03, z + side * depth / 2);
      if (i == 1) b.box(0.017, 0.023, depth / 5, x + side * width / 2, base + h + 0.03, z);
    }
    if (b.detailed) {
      b.window(x, base + h * 0.66, z + side * (depth / 2 + 0.002), side > 0 ? 0 : Math.PI, 0.012, 0.035);
      b.window(x + side * (width / 2 + 0.002), base + h * 0.66, z, side * Math.PI / 2, 0.009, 0.031);
      // Small corbels carry the projecting crown; no floating battlements.
      for (let i = -1; i <= 1; i++) b.box(0.009, 0.021, 0.012, x + i * width * 0.32, base + h - 0.031, z + side * depth / 2, p.trim);
    }
  });
}

function archShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h - w / 2);
  for (let i = 1; i <= 10; i++) {
    const a = i * Math.PI / 10;
    shape.lineTo(Math.cos(a) * w / 2, h - w / 2 + Math.sin(a) * w / 2);
  }
  shape.closePath();
  return shape;
}

export function portal(b: CastleBuilder, x: number, z: number, base: number, w: number, h: number): void {
  // Shape extends Path in Three; the project's minimal Three declaration does
  // not expose holes, so describe that supported capability locally.
  const surround = archShape(w + 0.02, h + 0.012) as THREE.Shape & { holes: THREE.Shape[] };
  const opening = archShape(w, h);
  surround.holes.push(archShape(w, h));
  b.add(new THREE.ExtrudeGeometry(surround, { depth: 0.024, bevelEnabled: false }), x, base, z, b.palette.trim);
  b.add(new THREE.ExtrudeGeometry(opening, { depth: 0.004, bevelEnabled: false }), x, base, z + 0.001, "#242b2c", 0, 2);
  const door = archShape(w * 0.76, h * 0.94);
  b.add(new THREE.ExtrudeGeometry(door, { depth: 0.004, bevelEnabled: false }), x, base, z + 0.006, b.palette.wood, 0, 2);
  if (b.detailed) {
    for (let i = -2; i <= 2; i++) b.box(0.002, h * 0.71, 0.003, x + i * w * 0.12, base + h * 0.36, z + 0.012, "#303431");
    [0.22, 0.57].forEach(t => b.box(w * 0.78, 0.004, 0.004, x, base + h * t, z + 0.013, "#55564c"));
  }
}

export function approach(b: CastleBuilder, x: number, near: number, far: number, top: number, width: number): void {
  const count = b.detailed ? 9 : 5;
  // Every tread is a solid rooted riser. Its negative bottom participates in
  // the existing castleSkirt / instanceCastleDepth relief extension.
  for (let i = 0; i < count; i++) {
    const z = far + (near - far) * (i + 0.5) / count;
    const rise = 0.005 + (top - 0.005) * (i + 1) / count;
    b.box(width, rise + 0.09, (far - near) / count + 0.001, x, (rise - 0.09) / 2, z, b.palette.trim);
  }
}

export function stoneRing(b: CastleBuilder, outer: number, inner: number, base: number, h: number, z = 0, start = 0, sweep = Math.PI * 2): void {
  const shape = new THREE.Shape();
  const count = b.detailed ? 48 : 24;
  for (let i = 0; i <= count; i++) {
    const a = start + i / count * sweep;
    const [x, y] = [Math.sin(a) * outer, -Math.cos(a) * outer];
    if (i == 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  for (let i = count; i >= 0; i--) {
    const a = start + i / count * sweep;
    shape.lineTo(Math.sin(a) * inner, -Math.cos(a) * inner);
  }
  shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2), 0, base, z);
}

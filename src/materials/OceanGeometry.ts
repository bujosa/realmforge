import * as THREE from "three";

// frame: object — ring spacing is a vertex density around the eye, not a map extent.

export interface OceanRingLayout {
  /** Spacing of the innermost level, in scene units. */
  spacing: number;
  /** Cells from the centre to the edge of each level, per axis. Even. */
  cells: number;
  /** Number of nested levels; level L has spacing × 2^L. */
  levels: number;
}

export interface OceanRings {
  geometry: THREE.BufferGeometry;
  layout: OceanRingLayout;
  /** Half-width of each level's outer square, in scene units. */
  radii: number[];
}

type Corner = [number, number];

// One triangle wound to face +Y (the same front face as the old XZ grid).
function pushFacingUp(indices: number[], points: Corner[], a: number, b: number, c: number): void {
  const [ax, az] = points[a], [bx, bz] = points[b], [cx, cz] = points[c];
  const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (up > 0) indices.push(a, b, c);
  else if (up < 0) indices.push(a, c, b);
}

// Integer lattice coordinates within ±2^20, packed into one exact double.
const key = (x: number, z: number): number => (x + 1048576) * 2097152 + z + 1048576;

class Lattice {
  readonly points: Corner[] = [];
  private ids = new Map<number, number>();

  has(x: number, z: number): boolean { return this.ids.has(key(x, z)); }

  id(x: number, z: number): number {
    const k = key(x, z);
    let id = this.ids.get(k);
    if (id == undefined) {
      id = this.points.length;
      this.points.push([x, z]);
      this.ids.set(k, id);
    }
    return id;
  }

  // Vertices of finer, dyadically aligned neighbours strictly inside the edge
  // a→b, in order. A quarter point exists only if the midpoint does.
  private inner(ax: number, az: number, bx: number, bz: number, ring: number[]): void {
    if (Math.abs(bx - ax) + Math.abs(bz - az) < 2) return;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (!this.has(mx, mz)) return;
    this.inner(ax, az, mx, mz, ring);
    ring.push(this.id(mx, mz));
    this.inner(mx, mz, bx, bz, ring);
  }

  // A quad whose edges may carry vertices of finer neighbours (T-junctions).
  // Plain quads use two triangles; others fan from an added centre vertex so
  // every shared edge uses the same vertices on both sides: no cracks.
  cell(indices: number[], x0: number, z0: number, size: number): void {
    const ring: number[] = [];
    const walk: Corner[] = [[x0, z0], [x0 + size, z0], [x0 + size, z0 + size], [x0, z0 + size]];
    walk.forEach(([ax, az], i) => {
      const [bx, bz] = walk[(i + 1) % 4];
      ring.push(this.id(ax, az));
      this.inner(ax, az, bx, bz, ring);
    });
    if (ring.length == 4) {
      pushFacingUp(indices, this.points, ring[0], ring[1], ring[2]);
      pushFacingUp(indices, this.points, ring[0], ring[2], ring[3]);
      return;
    }
    const centre = this.id(x0 + size / 2, z0 + size / 2);
    ring.forEach((id, i) => pushFacingUp(indices, this.points, centre, id, ring[(i + 1) % ring.length]));
  }
}

// `y` receives lattice coordinates (multiples of `unit`).
function build(lattice: Lattice, indices: number[], unit: number, y: (x: number, z: number) => number): THREE.BufferGeometry {
  const positions = new Float32Array(lattice.points.length * 3), normals = new Float32Array(lattice.points.length * 3);
  lattice.points.forEach(([x, z], i) => {
    positions.set([x * unit, y(x, z), z * unit], i * 3);
    normals[i * 3 + 1] = 1;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  // The local Three declaration omits this installed BufferGeometry API.
  // Three picks 16- or 32-bit indices from the largest index.
  (geometry as THREE.BufferGeometry & { setIndex(index: number[]): void }).setIndex(indices);
  return geometry;
}

// Camera-centred geometry clipmap: a full square of fine cells, then rings that
// double their spacing and their size. Coordinates are local to the ring centre;
// the owner places the mesh at a snapped eye position (relative-to-centre, so
// k = 20 keeps millimetre vertex precision). Each level's lattice is a multiple
// of its spacing, so snapping the centre to the spacing of level L leaves every
// vertex of levels 0..L fixed in the world: those levels never swim.
// Default: 0.04 near the eye, 163.84 units of reach (the camera far plane is
// max(100, 2 × orbit limit), and fog covers the sea well before that edge).
export function oceanRings(layout: OceanRingLayout = { spacing: 0.04, cells: 16, levels: 9 }): OceanRings {
  const { cells, levels } = layout;
  if (cells % 2) throw new Error("Ocean rings need an even cell count");
  const lattice = new Lattice(), indices: number[] = [];
  const quads: [number, number, number][] = [];
  for (let level = 0; level < levels; level++) {
    const size = 2 ** level, hole = level == 0 ? 0 : cells / 2;
    for (let j = -cells; j < cells; j++) for (let i = -cells; i < cells; i++) {
      if (i >= -hole && i < hole && j >= -hole && j < hole) continue;
      quads.push([i * size, j * size, size]);
    }
  }
  // Register every corner first, so coarse cells see the finer level's
  // vertices on their inner edge.
  quads.forEach(([x, z, size]) => { lattice.id(x, z); lattice.id(x + size, z); lattice.id(x, z + size); lattice.id(x + size, z + size); });
  quads.forEach(([x, z, size]) => lattice.cell(indices, x, z, size));
  const geometry = build(lattice, indices, layout.spacing, () => 0);
  geometry.computeBoundingSphere();
  return { geometry, layout, radii: Array.from({ length: levels }, (_, level) => cells * layout.spacing * 2 ** level) };
}

// Static, error-bounded height mesh over a square centred on the origin.
// `flat(x, z, radius)` may prove that a disc is a plateau (no split needed);
// otherwise cells split until the linear patch matches `y` within
// `tolerance(mean corner height)` at a 5 × 5 probe, or reach `minimum`. Cells larger than `probeLimit` always
// split unless flat, so small islands cannot hide between probes.
export function adaptiveHeightGeometry(half: number, minimum: number, probeLimit: number, tolerance: (height: number) => number,
  y: (x: number, z: number) => number, flat: (x: number, z: number, radius: number) => boolean): THREE.BufferGeometry {
  const span = Math.round(half * 2 / minimum);
  if (2 ** Math.round(Math.log2(span)) != span) throw new Error("Adaptive height mesh needs a power-of-two span");
  const limit = Math.max(1, Math.round(probeLimit / minimum));
  const origin = -span / 2;
  const heights = new Map<number, number>();
  const at = (x: number, z: number): number => {
    const k = key(x, z);
    let value = heights.get(k);
    if (value == undefined) { value = y(x * minimum, z * minimum); heights.set(k, value); }
    return value;
  };
  const leaves: [number, number, number][] = [];
  const visit = (x: number, z: number, size: number): void => {
    const cx = (x + size / 2) * minimum, cz = (z + size / 2) * minimum;
    if (flat(cx, cz, size * minimum * Math.SQRT1_2)) { leaves.push([x, z, size]); return; }
    if (size > 1 && size <= limit) {
      const a = at(x, z), b = at(x + size, z), c = at(x, z + size), d = at(x + size, z + size);
      const allowed = tolerance((a + b + c + d) / 4);
      let error = 0;
      for (let v = 0; v <= 4 && error <= allowed; v++) for (let u = 0; u <= 4; u++) {
        // Probe on the lattice when the cell is small, so values are reused.
        const px = x + size * u / 4, pz = z + size * v / 4;
        const sample = size % 4 == 0 ? at(px, pz) : y(px * minimum, pz * minimum);
        const fu = u / 4, fv = v / 4;
        // The same diagonal as Lattice.cell: (x, z) to (x + size, z + size).
        const linear = fu >= fv ? a + (b - a) * fu + (d - b) * fv : a + (c - a) * fv + (d - c) * fu;
        error = Math.max(error, Math.abs(sample - linear));
        if (error > allowed) break;
      }
      if (error <= allowed) { leaves.push([x, z, size]); return; }
    } else if (size == 1) { leaves.push([x, z, size]); return; }
    const next = size / 2;
    visit(x, z, next); visit(x + next, z, next); visit(x, z + next, next); visit(x + next, z + next, next);
  };
  visit(origin, origin, span);
  const lattice = new Lattice(), indices: number[] = [];
  leaves.forEach(([x, z, size]) => { lattice.id(x, z); lattice.id(x + size, z); lattice.id(x, z + size); lattice.id(x + size, z + size); });
  leaves.forEach(([x, z, size]) => lattice.cell(indices, x, z, size));
  return build(lattice, indices, minimum, at);
}

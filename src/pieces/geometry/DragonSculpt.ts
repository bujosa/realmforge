import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../sculpt";

// Original dragon miniature: a wyvern-like figure on two hind legs with two
// membranous wings. Each arm articulates at shoulder, elbow and wrist. Points
// are in the pre-scale miniature space: the head faces -Z, the tail faces +Z
// and the feet rest on y 0.05. Shared UVs and finish shading are applied once
// by the caller.

const SCALES = "#3e4145";
const SPINE = "#4b4f55";
const MEMBRANE = "#893d4b";
const MEMBRANE_UNDERSIDE = "#6b2c38";
const BONE = "#c8b18a";
const IVORY = "#e5d6b6";
const EYE = "#edbd5a";
const PUPIL = "#1d1a1c";

type Vec = [number, number, number];
type Station = { p: Vec; r: [number, number] };
type Add = (geometry: THREE.BufferGeometry, color: string) => void;

const add3 = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a: Vec): Vec => scale3(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Non-indexed geometry with the miniature vertex layout (position, normal, later uv and color).
function buffer(positions: number[], normals: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

// Uniform Catmull-Rom through the stations: t=0 and t=1 land on the end stations.
function sample(stations: Station[], t: number): { point: Vec; tangent: Vec; radius: [number, number] } {
  const last = stations.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * last;
  const k = Math.min(Math.floor(f), last - 1);
  const u = f - k;
  const p0 = stations[Math.max(k - 1, 0)].p;
  const p1 = stations[k].p;
  const p2 = stations[k + 1].p;
  const p3 = stations[Math.min(k + 2, last)].p;
  const point: Vec = [0, 0, 0];
  const tangent: Vec = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = p0[c], b = p1[c], d = p2[c], e = p3[c];
    point[c] = 0.5 * (2 * b + (d - a) * u + (2 * a - 5 * b + 4 * d - e) * u * u + (3 * b - a - 3 * d + e) * u * u * u);
    tangent[c] = 0.5 * ((d - a) + 2 * (2 * a - 5 * b + 4 * d - e) * u + 3 * (3 * b - a - 3 * d + e) * u * u);
  }
  const s0 = stations[k];
  const s1 = stations[k + 1];
  return { point, tangent, radius: [lerp(s0.r[0], s1.r[0], u), lerp(s0.r[1], s1.r[1], u)] };
}

// Lofts an elliptical section along a smooth spine. Radii are set per station,
// so necks, tails, limbs, toes and spikes taper instead of using straight cones.
// Normals are analytic, so the sides stay smooth without index welding.
function tube(stations: Station[], radial: number, rings: number): THREE.BufferGeometry {
  const rows: { center: Vec; tangent: Vec; side: Vec; up: Vec; rx: number; ry: number }[] = [];
  // Parallel-transported frame: the section turns smoothly along steep spines instead of flipping.
  let side: Vec = [0, 0, 0];
  for (let i = 0; i <= rings; i++) {
    const s = sample(stations, i / rings);
    const tangent = unit3(s.tangent);
    if (i == 0) {
      const upRef: Vec = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
      side = unit3(cross3(upRef, tangent));
    } else {
      side = unit3(sub3(side, scale3(tangent, dot3(side, tangent))));
    }
    const up = unit3(cross3(tangent, side));
    rows.push({ center: s.point, tangent, side, up, rx: s.radius[0], ry: s.radius[1] });
  }
  const ringPoint = (i: number, j: number): { p: Vec; n: Vec } => {
    const row = rows[i];
    const angle = (j / radial) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const p = add3(add3(row.center, scale3(row.side, c * row.rx)), scale3(row.up, s * row.ry));
    // Ellipse gradient: exact for a straight section and close along a taper.
    const n = unit3(add3(scale3(row.side, c / row.rx), scale3(row.up, s / row.ry)));
    return { p, n };
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const push = (v: { p: Vec; n: Vec }): void => {
    positions.push(v.p[0], v.p[1], v.p[2]);
    normals.push(v.n[0], v.n[1], v.n[2]);
  };
  const last = rows.length - 1;
  for (let i = 0; i < last; i++) {
    for (let j = 0; j < radial; j++) {
      const a = ringPoint(i, j);
      const b = ringPoint(i, j + 1);
      const c = ringPoint(i + 1, j);
      const d = ringPoint(i + 1, j + 1);
      [a, b, c, b, d, c].forEach(push);
    }
  }
  // Flat caps close both ends with their outward spine direction.
  const capNormal = (i: number, sign: number): Vec => scale3(rows[i].tangent, sign);
  for (let j = 0; j < radial; j++) {
    const start = capNormal(0, -1);
    const end = capNormal(last, 1);
    [{ p: rows[0].center, n: start }, { p: ringPoint(0, j + 1).p, n: start }, { p: ringPoint(0, j).p, n: start }].forEach(push);
    [{ p: rows[last].center, n: end }, { p: ringPoint(last, j).p, n: end }, { p: ringPoint(last, j + 1).p, n: end }].forEach(push);
  }
  return buffer(positions, normals);
}

// Tapered spike or claw from base to apex.
function cone(radius: number, from: Vec, to: Vec): THREE.BufferGeometry {
  return tube(
    [
      { p: from, r: [radius, radius] },
      { p: to, r: [0.0004, 0.0004] }
    ],
    6,
    2
  );
}

function ball(radius: number, at: Vec, scale: Vec = [1, 1, 1]): THREE.BufferGeometry {
  const segments = radius < 0.02 ? 6 : 8;
  return new THREE.SphereGeometry(radius, segments, segments - 2)
    .scale(scale[0], scale[1], scale[2])
    .translate(at[0], at[1], at[2]);
}

// Ear clipping for a simple counter-clockwise 2D polygon.
function triangulate(points: [number, number][]): number[][] {
  const cross2 = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const remaining = points.map((_, i) => i);
  const triangles: number[][] = [];
  while (remaining.length > 3) {
    let clipped = false;
    for (let k = 0; k < remaining.length && !clipped; k++) {
      const ia = remaining[(k + remaining.length - 1) % remaining.length];
      const ib = remaining[k];
      const ic = remaining[(k + 1) % remaining.length];
      const a = points[ia], b = points[ib], c = points[ic];
      if (cross2(a, b, c) <= 1e-12) continue;
      const blocked = remaining.some(j => {
        if (j == ia || j == ib || j == ic) return false;
        const p = points[j];
        return cross2(a, b, p) > 0 && cross2(b, c, p) > 0 && cross2(c, a, p) > 0;
      });
      if (blocked) continue;
      triangles.push([ia, ib, ic]);
      remaining.splice(k, 1);
      clipped = true;
    }
    if (!clipped) break;
  }
  if (remaining.length == 3) triangles.push(remaining);
  return triangles;
}

// A scalloped membrane with thickness. The lit top, the darker underside and
// the rim wall are separate geometries so the skin reads as two faces.
function membrane(outline: Vec[], thickness: number): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const n = outline.length;
  let center: Vec = [0, 0, 0];
  outline.forEach(p => {
    center = add3(center, p);
  });
  center = scale3(center, 1 / n);
  // Newell's method gives the average plane normal; keep the top facing upward.
  let normal: Vec = [0, 0, 0];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % n];
    normal = add3(normal, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]);
  });
  normal = unit3(normal);
  if (normal[1] < 0) normal = scale3(normal, -1);
  const d0 = sub3(outline[0], center);
  const e1 = unit3(sub3(d0, scale3(normal, dot3(d0, normal))));
  const e2 = cross3(normal, e1);
  const contour = outline.map((p): [number, number] => {
    const d = sub3(p, center);
    return [dot3(d, e1), dot3(d, e2)];
  });
  let area = 0;
  contour.forEach((p, i) => {
    const q = contour[(i + 1) % n];
    area += p[0] * q[1] - q[0] * p[1];
  });
  const ccw = area >= 0 ? contour.map((_, i) => i) : contour.map((_, i) => n - 1 - i);
  const half = thickness / 2;
  const top = outline.map(p => add3(p, scale3(normal, half)));
  const bottom = outline.map(p => add3(p, scale3(normal, -half)));

  // Emits a flat triangle wound to face the wanted direction.
  const emit = (positions: number[], normals: number[], a: Vec, b: Vec, c: Vec, want: Vec): void => {
    const winding = dot3(cross3(sub3(b, a), sub3(c, a)), want) < 0 ? [a, c, b] : [a, b, c];
    winding.forEach(v => {
      positions.push(v[0], v[1], v[2]);
      normals.push(want[0], want[1], want[2]);
    });
  };
  const topPositions: number[] = [];
  const topNormals: number[] = [];
  const underPositions: number[] = [];
  const underNormals: number[] = [];
  const polygon = ccw.map(i => contour[i]);
  triangulate(polygon).forEach(([a, b, c]) => {
    const [ia, ib, ic] = [ccw[a], ccw[b], ccw[c]];
    emit(topPositions, topNormals, top[ia], top[ib], top[ic], normal);
    emit(underPositions, underNormals, bottom[ia], bottom[ib], bottom[ic], scale3(normal, -1));
  });
  ccw.forEach((i, k) => {
    const j = ccw[(k + 1) % n];
    const d = [contour[j][0] - contour[i][0], contour[j][1] - contour[i][1]];
    // Counter-clockwise outlines have their exterior on the right of each edge.
    const outward = add3(scale3(e1, d[1]), scale3(e2, -d[0]));
    emit(underPositions, underNormals, top[i], top[j], bottom[j], unit3(outward));
    emit(underPositions, underNormals, top[i], bottom[j], bottom[i], unit3(outward));
  });
  return [buffer(topPositions, topNormals), buffer(underPositions, underNormals)];
}

// Gives each part the shared miniature vertex layout: non-indexed, with a
// placeholder UV that finishGeometry replaces after the merge.
function part(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.deleteAttribute("uv");
  flat.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute("position").count * 2), 2));
  return paintGeometry(flat, color);
}

function wing(side: number, add: Add): void {
  const at = (x: number, y: number, z: number): Vec => [side * x, y, z];
  const shoulder = at(0.075, 0.335, -0.075);
  const elbow = at(0.19, 0.415, -0.1);
  const wrist = at(0.3, 0.455, -0.07);
  const tips = [at(0.353, 0.43, 0.02), at(0.32, 0.36, 0.1), at(0.27, 0.31, 0.16), at(0.19, 0.28, 0.2)];
  const flank = at(0.085, 0.22, 0.12);

  // Each scallop bows toward the wrist between two finger tips.
  const outline: Vec[] = [shoulder, elbow, wrist, tips[0]];
  tips.slice(1).forEach((tip, i) => {
    [0.25, 0.5, 0.75].forEach(t => {
      const q = mix(tips[i], tip, t);
      outline.push(mix(q, wrist, Math.sin(Math.PI * t) * 0.2));
    });
    outline.push(tip);
  });
  outline.push(flank);
  const [top, under] = membrane(outline, 0.014);
  add(top, MEMBRANE);
  add(under, MEMBRANE_UNDERSIDE);

  add(tube([{ p: shoulder, r: [0.02, 0.02] }, { p: elbow, r: [0.016, 0.016] }], 8, 4), SCALES);
  add(tube([{ p: elbow, r: [0.016, 0.016] }, { p: wrist, r: [0.011, 0.011] }], 8, 4), SCALES);
  add(ball(0.024, shoulder), SCALES);
  add(ball(0.017, elbow), SCALES);
  add(ball(0.013, wrist), SCALES);
  tips.forEach(tip => {
    add(
      tube(
        [
          { p: wrist, r: [0.008, 0.008] },
          { p: mix(wrist, tip, 0.6), r: [0.006, 0.006] },
          { p: tip, r: [0.0025, 0.0025] }
        ],
        6,
        4
      ),
      SPINE
    );
    add(cone(0.005, tip, mix(wrist, tip, 1.2)), IVORY);
  });
}

function leg(side: number, add: Add): void {
  const at = (x: number, y: number, z: number): Vec => [side * x, y, z];
  const hip = at(0.068, 0.27, 0.05);
  const knee = at(0.085, 0.14, -0.02);
  const ankle = at(0.07, 0.07, 0.06);
  const toeBase = at(0.07, 0.064, -0.02);
  add(
    tube(
      [
        { p: hip, r: [0.05, 0.06] },
        { p: at(0.078, 0.2, 0), r: [0.05, 0.05] },
        { p: knee, r: [0.03, 0.03] }
      ],
      12,
      10
    ),
    SCALES
  );
  add(ball(0.031, knee), SCALES);
  add(
    tube(
      [
        { p: knee, r: [0.03, 0.03] },
        { p: at(0.08, 0.1, 0.02), r: [0.024, 0.024] },
        { p: ankle, r: [0.018, 0.018] }
      ],
      10,
      8
    ),
    SCALES
  );
  add(ball(0.018, ankle), SCALES);
  add(tube([{ p: ankle, r: [0.016, 0.016] }, { p: toeBase, r: [0.013, 0.013] }], 10, 4), SCALES);
  [-1, 0, 1].forEach(k => {
    const base = at(0.07 + k * 0.014, 0.064, -0.02);
    const tip = at(0.07 + k * 0.022, 0.064, -0.06);
    add(tube([{ p: base, r: [0.011, 0.011] }, { p: tip, r: [0.008, 0.008] }], 8, 3), SCALES);
    add(cone(0.0055, [tip[0], 0.062, -0.058], [tip[0], 0.054, -0.085]), IVORY);
  });
}

export function dragonSculpt(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add: Add = (geometry, color) => {
    parts.push(part(geometry, color));
  };

  // Torso from deep hips to a narrow chest.
  add(
    tube(
      [
        // The rear cap sits inside the tail root, keeping the hip silhouette
        // continuous from overhead instead of ending in a broad flat disk.
        { p: [0, 0.26, 0.09], r: [0.045, 0.045] },
        { p: [0, 0.27, 0.07], r: [0.08, 0.085] },
        { p: [0, 0.285, -0.03], r: [0.092, 0.095] },
        { p: [0, 0.315, -0.095], r: [0.073, 0.075] },
        // End inside the neck instead of exposing a broad, flat chest cap.
        { p: [0, 0.33, -0.12], r: [0.052, 0.057] }
      ],
      12,
      10
    ),
    SCALES
  );
  // Arched neck with a tapered head: skull, brow, snout and a hinged lower jaw.
  add(
    tube(
      [
        { p: [0, 0.31, -0.10], r: [0.06, 0.065] },
        { p: [0, 0.33, -0.12], r: [0.055, 0.06] },
        { p: [0, 0.37, -0.16], r: [0.04, 0.042] },
        { p: [0, 0.405, -0.2], r: [0.03, 0.03] },
        { p: [0, 0.42, -0.225], r: [0.027, 0.027] }
      ],
      12,
      12
    ),
    SCALES
  );
  add(
    tube(
      [
        { p: [0, 0.425, -0.225], r: [0.046, 0.043] },
        { p: [0, 0.42, -0.255], r: [0.047, 0.043] },
        { p: [0, 0.41, -0.28], r: [0.032, 0.03] },
        { p: [0, 0.4, -0.296], r: [0.02, 0.018] }
      ],
      12,
      10
    ),
    SCALES
  );
  add(
    tube(
      [
        { p: [0, 0.372, -0.23], r: [0.028, 0.012] },
        { p: [0, 0.368, -0.265], r: [0.022, 0.009] },
        { p: [0, 0.364, -0.292], r: [0.012, 0.006] }
      ],
      10,
      8
    ),
    SCALES
  );
  [-1, 1].forEach(side => {
    add(ball(0.0065, [side * 0.04, 0.44, -0.245]), EYE);
    add(ball(0.0035, [side * 0.042, 0.44, -0.25]), PUPIL);
    add(ball(0.016, [side * 0.035, 0.462, -0.24], [1.1, 0.6, 1.6]), SCALES);
    add(
      tube(
        [
          { p: [side * 0.03, 0.46, -0.215], r: [0.011, 0.011] },
          { p: [side * 0.05, 0.487, -0.19], r: [0.008, 0.008] },
          { p: [side * 0.065, 0.478, -0.165], r: [0.0035, 0.0035] }
        ],
        8,
        6
      ),
      BONE
    );
  });

  // Dorsal spines follow the neck and tail.
  const spines: [Vec, Vec][] = [
    [[0, 0.340, 0.075], [0, 0.375, 0.09]],
    [[0, 0.357, 0.035], [0, 0.393, 0.05]],
    [[0, 0.365, -0.005], [0, 0.405, 0.01]],
    [[0, 0.369, -0.045], [0, 0.409, -0.03]],
    [[0, 0.372, -0.085], [0, 0.405, -0.07]],
    [[0, 0.398, -0.16], [0, 0.428, -0.17]],
    [[0, 0.43, -0.2], [0, 0.458, -0.21]],
    [[0, 0.265, 0.18], [0, 0.3, 0.19]],
    [[0, 0.21, 0.27], [0, 0.24, 0.28]],
    [[0, 0.16, 0.33], [0, 0.18, 0.335]]
  ];
  spines.forEach(([from, to]) => add(cone(0.009, from, to), SPINE));

  // Long tail with a spade tip.
  add(
    tube(
      [
        { p: [0, 0.26, 0.08], r: [0.05, 0.05] },
        { p: [0, 0.23, 0.18], r: [0.04, 0.04] },
        { p: [0, 0.19, 0.27], r: [0.024, 0.024] },
        { p: [0, 0.15, 0.33], r: [0.013, 0.013] },
        { p: [0, 0.13, 0.345], r: [0.006, 0.006] }
      ],
      10,
      14
    ),
    SCALES
  );
  add(ball(0.017, [0, 0.13, 0.35], [1.3, 0.7, 1]), SCALES);

  [-1, 1].forEach(side => {
    leg(side, add);
    wing(side, add);
  });

  const merged = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  if (!merged) {
    throw new Error("Could not assemble dragon sculpt");
  }
  return merged;
}

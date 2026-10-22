import * as THREE from "three";
import { METRES_PER_UNIT } from "../core/SceneFrame";
import CastleBuilder from "../castles/CastleBuilder";
import CastleMaterial from "../materials/CastleMaterial";
import { normalAt, WALL_BASE_HALF_METRES as BASE_HALF, WALL_STATION_METRES as STATION, WALL_TOP_HALF_METRES as TOP_HALF, wallCrest, WallCrest, WallEdge, WallPath, wallPath, wallProfileHeight } from "./WallProfile";

export type { WallEdge } from "./WallProfile";

// World ×20 art for the Wall (213 m of ice, design §2.4 and bible §3.10/§4.1):
// one continuous ice cliff per run of the border (edges chained and their
// corners rounded, so no panel seams or folds), near-vertical faces with
// flutes and crevasses, uneven blue-white strata, a wind-carved undercut at
// the foot, melt streaks, a snow cornice on the crest and drifts at the foot.
// The Watch's forts stand on terraced ground at the south foot; Castle Black
// adds the switchback stair and the winch cage. Built only at k > 1.

const U = 1 / METRES_PER_UNIT;

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const smoothstep = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Blue-white ice tones of the strata; grit layers are rare and grey. */
const ICE = ["#dce7eb", "#c0d6e1", "#a7c3d2", "#e6eef1", "#b4cedb", "#9cbacb", "#cfdfe7", "#b9cfdb"].map(hex => new THREE.Color(hex));
const GRIT = new THREE.Color("#a2aaa9"), SNOW = new THREE.Color("#f1f5f6"), DRIFT = new THREE.Color("#e4ebed"), MUD = new THREE.Color("#8f9896");

/** Ice colour at arc length s (m), height fraction f of a section; strata wander along the Wall. */
function iceColor(s: number, f: number, out: THREE.Color): THREE.Color {
  const band = f * 12 + Math.sin(s * 0.0037) * 1.1 + Math.sin(s * 0.0113 + f * 4) * 0.45 + Math.sin(s * 0.031 + f * 9) * 0.12;
  const k = Math.floor(band), frac = band - k;
  const tone = (n: number): THREE.Color => hash01(n * 7.3 + 2) > 0.9 ? GRIT : ICE[Math.floor(hash01(n * 3.1) * ICE.length)];
  out.copy(tone(k)).lerp(tone(k + 1), smoothstep(0.7, 1, frac));
  // Dirtier, greyer ice near the foot, where meltwater and grit collect.
  out.lerp(MUD, (1 - smoothstep(0.02, 0.16, f)) * 0.45);
  return out;
}

interface ProfilePoint { d: number; y: number; f: number; tone?: THREE.Color }

/**
 * One section of the Wall, north drift to south drift: (d m from the centre
 * line, +south; y m above the foot; height fraction for the strata).
 */
function section(s: number, height: number, salt: number): ProfilePoint[] {
  // Flutes and buttresses: the face bulges and recedes along the Wall.
  const flute = (side: number): number => 5.5 * Math.sin(s * 0.016 + side * 1.3 + salt) + 3 * Math.sin(s * 0.043 + side * 2.1) + 1.5 * Math.sin(s * 0.11 + side);
  const cell = Math.round(s / STATION);
  const face = (side: number): ProfilePoint[] => {
    // A crevasse: some stations are cut back over most of the height.
    const crevasse = hash01(cell * 1.7 + side * 31 + salt) > 0.8 ? 5 + hash01(cell * 2.9 + side) * 5 : 0;
    const fractions = [0, 0.022, 0.055, 0.11, 0.19, 0.28, 0.38, 0.49, 0.6, 0.71, 0.81, 0.9, 0.96];
    return fractions.map((f, k) => {
      // Wind-carved base: a notch near the foot (deeper on the north face), then the face.
      const notch = k == 1 ? (side < 0 ? 5 : 2.6) * (0.7 + hash01(cell * 0.7 + side) * 0.6) : k == 2 ? -0.8 : 0;
      const relief = k > 0 ? (hash01(cell * 5.3 + k * 1.9 + side * 7) - 0.5) * 3 : 0;
      const body = k > 1 && k < fractions.length - 1 ? flute(side) * Math.sin(Math.PI * f) + (f > 0.08 && f < 0.92 ? -crevasse : 0) : 0;
      return { d: side * (BASE_HALF - (BASE_HALF - TOP_HALF) * f - notch + relief + body), y: f * height, f };
    });
  };
  const cornice = 1.2 + hash01(cell * 4.1 + salt) * 1.6;
  const north = face(-1), south = face(1).reverse();
  return [
    { d: -(BASE_HALF + 28), y: -8, f: 0, tone: DRIFT }, { d: -(BASE_HALF + 10), y: 3 + hash01(cell * 1.7) * 6, f: 0, tone: DRIFT },
    ...north,
    // Snow crest: a cornice lip overhanging the north face, the crown, the south lip.
    { d: -(TOP_HALF + cornice), y: height - 1.2, f: 1, tone: SNOW }, { d: -(TOP_HALF - 2), y: height + 2.6, f: 1, tone: SNOW },
    { d: 0, y: height + 3.6 + hash01(cell * 2.3) * 1.4, f: 1, tone: SNOW },
    { d: TOP_HALF - 2, y: height + 2.4, f: 1, tone: SNOW }, { d: TOP_HALF + 0.8, y: height - 1.6, f: 1, tone: SNOW },
    ...south,
    { d: BASE_HALF + 10, y: 3 + hash01(cell * 4.1) * 6, f: 0, tone: DRIFT }, { d: BASE_HALF + 28, y: -8, f: 0, tone: DRIFT }
  ];
}

/**
 * The Wall's ice body along every run, in scene units relative to `origin`:
 * one indexed strip per run (smooth normals across stations, so no panel
 * seams), capped at the run's ends. Attribute `wallCoord` = (arc length m,
 * height fraction) drives the crevasse lines and melt streaks in the shader.
 */
export function wallGeometry(path: WallPath, ground: (x: number, z: number) => number, origin: THREE.Vector3, step = 1): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], coords: number[] = [], indices: number[] = [];
  const color = new THREE.Color("#ffffff");
  path.runs.forEach((run, r) => {
    let previous = -1, width = 0;
    const stations: number[] = [];
    for (let j = 0; j < run.points.length; j += step) stations.push(j);
    if (stations[stations.length - 1] != run.points.length - 1) stations.push(run.points.length - 1);
    const sections: { row: number; profile: ProfilePoint[]; p: [number, number]; n: [number, number]; g: number }[] = [];
    stations.forEach(j => {
      const p = run.points[j], [nx, nz] = normalAt(run.points, j), s = run.along[j];
      const g = Math.min(ground(p[0], p[1]), ...[-1, 1].map(side => ground(p[0] + nx * side * BASE_HALF * U, p[1] + nz * side * BASE_HALF * U)));
      const height = Math.max(20, (run.crest[j] - g) * METRES_PER_UNIT);
      const profile = section(s + r * 7919, height, r * 1.3);
      const row = positions.length / 3;
      const weather = 0.95 + hash01(Math.round(s / STATION) * 0.37 + r) * 0.07;
      profile.forEach(({ d, y, f, tone }) => {
        positions.push(p[0] + nx * d * U - origin.x, g + y * U - origin.y, p[1] + nz * d * U - origin.z);
        if (tone) color.copy(tone); else iceColor(s, f, color).multiplyScalar(weather);
        colors.push(color.r, color.g, color.b);
        coords.push(s, f);
      });
      width = profile.length;
      if (previous >= 0) for (let k = 0; k < width - 1; k++) indices.push(previous + k, row + k, previous + k + 1, previous + k + 1, row + k, row + k + 1);
      previous = row;
      sections.push({ row, profile, p, n: [nx, nz], g });
    });
    // End caps: the section polygon on its own vertices (a hard edge), facing out along the run.
    [sections[0], sections[sections.length - 1]].forEach((cap, end) => {
      if (!cap) return;
      const base = positions.length / 3, profile = cap.profile, n = profile.length;
      profile.forEach(({ d, y, f, tone }) => {
        positions.push(cap.p[0] + cap.n[0] * d * U - origin.x, cap.g + y * U - origin.y, cap.p[1] + cap.n[1] * d * U - origin.z);
        const shade = tone ?? iceColor(end ? run.length : 0, f, color);
        colors.push(shade.r, shade.g, shade.b);
        coords.push(end ? run.length : 0, f);
      });
      // A strip across the section: the k-th north point pairs with the k-th south point.
      const faces = (n - 4 - 5) / 2, north = (k: number): number => 2 + k, south = (k: number): number => n - 3 - k, crown = 2 + faces + 2;
      const triangles: number[][] = [[0, 1, north(0)], [0, north(0), south(0)], [0, south(0), n - 1], [n - 1, south(0), n - 2]];
      for (let k = 0; k < faces - 1; k++) triangles.push([north(k), north(k + 1), south(k + 1)], [north(k), south(k + 1), south(k)]);
      for (let k = north(faces - 1); k < south(faces - 1); k++) if (k != crown && k + 1 != crown) triangles.push([crown, k, k + 1]);
      triangles.push([crown, south(faces - 1), north(faces - 1)]);
      // Start caps face −tangent: counter-clockwise in (d, y); end caps clockwise.
      triangles.forEach(([a, b, c]) => {
        const cross = (profile[b].d - profile[a].d) * (profile[c].y - profile[a].y) - (profile[c].d - profile[a].d) * (profile[b].y - profile[a].y);
        const flip = (cross > 0) == (end == 1);
        indices.push(base + a, base + (flip ? c : b), base + (flip ? b : c));
      });
    });
  });
  // Ice-cut parapet merlons sit above the snow cornice. They are part of
  // the same indexed ice mesh/material, with no additional draw or texture.
  path.runs.forEach(run => {
    for (let j = 1; j < run.points.length - 1; j += 2) {
      const [x, z] = run.points[j], [nx, nz] = normalAt(run.points, j);
      for (const side of [-1, 1]) {
        const start = positions.length / 3;
        for (const y of [1, 6]) for (const d of [-2, 2]) for (const along of [-4, 4]) {
          const off = side * (TOP_HALF - 1) + d;
          positions.push(x + (nx * off - nz * along) * U - origin.x, run.crest[j] + y * U - origin.y,
            z + (nz * off + nx * along) * U - origin.z);
          colors.push(SNOW.r, SNOW.g, SNOW.b); coords.push(run.along[j] + along, 1);
        }
        const faces = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
        faces.forEach(i => indices.push(start + i));
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("wallCoord", new THREE.Float32BufferAttribute(coords, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Ice of the ×20 Wall: vertex-coloured strata plus, in metres along the Wall,
 * thin crevasse lines, melt streaks and fine layering — each faded by its
 * screen footprint so nothing shimmers at range — and a faint cold sheen.
 * No transmission pass.
 */
export class WallIceMaterial extends THREE.MeshStandardMaterial {
  constructor() {
    super({ color: "#ffffff", vertexColors: true, roughness: 0.5, metalness: 0, emissive: "#9fc0d0", emissiveIntensity: 0.035 });
    this.onBeforeCompile = shader => {
      shader.vertexShader = "attribute vec2 wallCoord;\nvarying vec2 vWallCoord;\nvarying vec3 wallLocal;\nvarying float vWallUp;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        wallLocal = position * ${METRES_PER_UNIT.toFixed(1)};
        vWallCoord = wallCoord;
        vWallUp = normal.y;`);
      shader.fragmentShader = "varying vec2 vWallCoord;\nvarying vec3 wallLocal;\nvarying float vWallUp;\n" + `
        float wallHash(float n) { vec2 q = fract(vec2(n, n * 1.37) * vec2(0.1031, 0.1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.y); }
        float wallNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = wallHash(i.x + i.y * 57.0), b = wallHash(i.x + 1.0 + i.y * 57.0);
          float c = wallHash(i.x + (i.y + 1.0) * 57.0), d = wallHash(i.x + 1.0 + (i.y + 1.0) * 57.0);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
      ` + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float wallFace = 1.0 - smoothstep(0.5, 0.8, abs(vWallUp));
        float wallAlong = vWallCoord.x, wallF = vWallCoord.y;
        // Crevasse lines: some 13 m cells hold one thin, slightly wavering line over part of the height.
        float wallCell = wallAlong / 13.0, wallId = floor(wallCell);
        float wallPix = fwidth(wallCell);
        float wallFrom = 0.04 + wallHash(wallId * 3.7) * 0.6, wallTo = wallFrom + 0.12 + wallHash(wallId * 5.1) * 0.35;
        float wallSpan = step(0.42, wallHash(wallId)) * smoothstep(wallFrom, wallFrom + 0.04, wallF) * (1.0 - smoothstep(wallTo - 0.06, wallTo, wallF));
        float wallX = abs(fract(wallCell) - 0.2 - 0.6 * wallHash(wallId + 13.1) + sin(wallF * 23.0 + wallId) * 0.025);
        float wallLine = (1.0 - smoothstep(0.012, 0.012 + wallPix * 1.5, wallX)) * wallSpan * (1.0 - smoothstep(0.06, 0.25, wallPix));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.74, 0.86), wallLine * wallFace * 0.7);
        // Melt streaks: long vertical runs, darker and greyer toward the foot.
        float wallStreakPix = fwidth(wallAlong * 0.12);
        float wallStreak = smoothstep(0.58, 0.92, wallNoise(vec2(wallAlong * 0.12, wallF * 2.2))) * (1.0 - smoothstep(0.35, 1.2, wallStreakPix));
        diffuseColor.rgb *= 1.0 - wallStreak * wallFace * (0.05 + 0.08 * (1.0 - wallF));
        // Broad blotches of clearer, bluer ice that stay visible at range.
        float wallBlotch = wallNoise(vec2(wallAlong * 0.011, wallF * 3.0 + 4.0));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.92, 0.97, 1.03), smoothstep(0.55, 0.85, wallBlotch) * wallFace);
        // Fine layering in metres.
        float wallBand = wallLocal.y * 1.3 + sin(wallAlong * 0.017) * 2.0 + wallNoise(vec2(wallAlong * 0.05, wallLocal.y * 0.2)) * 2.0;
        float wallFine = 1.0 - smoothstep(0.35, 1.0, fwidth(wallBand));
        diffuseColor.rgb *= 1.0 + sin(wallBand) * 0.03 * wallFine * wallFace;`);
    };
    this.customProgramCacheKey = () => "wall-ice-k20-v2";
  }
}

interface FortSeat { ground: (x: number, z: number) => number }

/**
 * A building's terrace (local metres, centre x, z, size w × d): cut into the
 * slope at the footprint's median ground, packed earth on top, a low
 * dry-stone retaining wall where the ground falls away. Returns its level.
 */
function terrace(b: CastleBuilder, seat: FortSeat, x: number, z: number, w: number, d: number): number {
  const samples: number[] = [];
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 2; j++) samples.push(seat.ground(x - w / 2 + w * i / 3, z - d / 2 + d * j / 2));
  samples.sort((p, q) => p - q);
  const level = samples[Math.floor(samples.length / 2)], low = samples[0] - 1.5;
  if (level - low > 1.2) b.add(new THREE.BoxGeometry(w * U, (level - 0.3 - low) * U, d * U), x * U, (low + level - 0.3) / 2 * U, z * U, "#6d6f6a", 0, 0);
  b.add(new THREE.BoxGeometry((w - 0.8) * U, 0.6 * U, (d - 0.8) * U), x * U, (level - 0.3) * U, z * U, "#6f6757", 0, 7, 1);
  return level;
}

function gableRoof(b: CastleBuilder, w: number, d: number, x: number, y: number, z: number, color: string, pitch = 0.45): void {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.6, 0); shape.lineTo(d / 2 + 0.6, 0); shape.lineTo(0, d * pitch); shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: w + 1, bevelEnabled: false }).translate(0, 0, -(w + 1) / 2).rotateY(Math.PI / 2).scale(U, U, U);
  b.add(roof, x * U, y * U, z * U, color, 0, 1, 1);
}

/** A Watch building on a terrace: stone ground storey, timber upper storey with posts, steep snowy roof. */
function hall(b: CastleBuilder, x: number, z: number, level: number, w: number, d: number, stone: number, timber: number, roof = "#4a4c4b"): number {
  const p = b.palette;
  b.box(w * U, (stone + 1) * U, d * U, x * U, (level - 1 + (stone + 1) / 2) * U, z * U, p.stone);
  let top = level + stone;
  if (timber > 0) {
    b.add(new THREE.BoxGeometry((w + 0.8) * U, timber * U, (d + 0.8) * U), x * U, (top + timber / 2) * U, z * U, p.wood, 0, 2);
    if (b.detailed) {
      // Dark posts and a sill beam on the long faces.
      const posts = Math.max(2, Math.round(w / 3.2));
      [-1, 1].forEach(side => {
        for (let i = 0; i <= posts; i++) b.add(new THREE.BoxGeometry(0.35 * U, timber * U, 0.3 * U), (x - w / 2 + w * i / posts) * U, (top + timber / 2) * U, (z + side * (d / 2 + 0.5)) * U, "#3a2f26", 0, 2);
        b.add(new THREE.BoxGeometry((w + 1) * U, 0.4 * U, 0.35 * U), x * U, (top + 0.2) * U, (z + side * (d / 2 + 0.55)) * U, "#3a2f26", 0, 2);
        for (let i = 0; i < posts; i++) b.window((x - w / 2 + w * (i + 0.5) / posts) * U, (top + timber * 0.55) * U, (z + side * (d / 2 + 0.45)) * U, side > 0 ? 0 : Math.PI, 0.7 * U, 1.3 * U);
      });
    }
    top += timber;
  } else if (b.detailed) {
    const count = Math.max(2, Math.round(w / 5));
    [-1, 1].forEach(side => { for (let i = 0; i < count; i++) b.window((x - w / 2 + w * (i + 0.5) / count) * U, (level + stone * 0.6) * U, (z + side * (d / 2 + 0.05)) * U, side > 0 ? 0 : Math.PI, 0.8 * U, 1.6 * U); });
  }
  gableRoof(b, w + 0.8, d + 1.2, x, top, z, roof, 0.55);
  return top + d * 0.55;
}

/** A round stone tower with a merlon crown, or a broken, leaning crown (Hardin's Tower). */
function roundTower(b: CastleBuilder, x: number, z: number, level: number, r: number, h: number, broken = false): void {
  const p = b.palette, seg = b.detailed ? 20 : 10;
  const shaft = new THREE.CylinderGeometry(r * U, r * 1.07 * U, (h + 3) * U, seg);
  if (broken) shaft.rotateZ(0.035);
  b.add(shaft, x * U, (level - 3 + (h + 3) / 2) * U, z * U, p.stone);
  const lean = broken ? Math.tan(0.035) * h : 0;
  const count = b.detailed ? Math.max(8, Math.round(r * 1.6)) : 0;
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count;
    const rise = broken ? (Math.sin(i * 2.3) * 0.5 + 0.5) * 4 * (i % 3 ? 1 : 0.2) : 1.8;
    b.box(1.5 * U, rise * U, 0.9 * U, (x - lean + Math.sin(a) * r) * U, (level + h + rise / 2) * U, (z + Math.cos(a) * r) * U, broken && i % 4 == 0 ? "#545856" : p.stone, a);
  }
  if (b.detailed) {
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + x;
      b.window((x + Math.sin(a) * (r + 0.05)) * U, (level + h * (0.35 + k * 0.2)) * U, (z + Math.cos(a) * (r + 0.05)) * U, a, 0.7 * U, 1.6 * U);
    }
  }
}

/** Training yard: a low fence of posts and rails with a few pells. */
function trainingYard(b: CastleBuilder, x: number, z: number, level: number, w: number, d: number): void {
  if (!b.detailed) return;
  const wood = "#5a4836";
  const posts = (x0: number, z0: number, x1: number, z1: number): void => {
    const length = Math.hypot(x1 - x0, z1 - z0), count = Math.max(2, Math.round(length / 3));
    for (let i = 0; i <= count; i++) b.add(new THREE.BoxGeometry(0.25 * U, 1.3 * U, 0.25 * U), (x0 + (x1 - x0) * i / count) * U, (level + 0.65) * U, (z0 + (z1 - z0) * i / count) * U, wood, 0, 2);
    b.add(new THREE.BoxGeometry(length * U, 0.15 * U, 0.15 * U), (x0 + x1) / 2 * U, (level + 1.1) * U, (z0 + z1) / 2 * U, wood, -Math.atan2(z1 - z0, x1 - x0), 2);
  };
  const hx = w / 2, hz = d / 2;
  posts(x - hx, z - hz, x + hx, z - hz); posts(x + hx, z - hz, x + hx, z + hz); posts(x + hx, z + hz, x - hx, z + hz); posts(x - hx, z + hz, x - hx, z - hz);
  [[-0.25, -0.2], [0.2, 0.15], [0.3, -0.25]].forEach(([u, v]) => {
    b.add(new THREE.BoxGeometry(0.3 * U, 1.9 * U, 0.3 * U), (x + u * w) * U, (level + 0.95) * U, (z + v * d) * U, wood, 0, 2);
    b.add(new THREE.BoxGeometry(1.2 * U, 0.22 * U, 0.22 * U), (x + u * w) * U, (level + 1.45) * U, (z + v * d) * U, wood, 0.4, 2);
  });
}

/** Stacked firewood and a cart (Castle Black lives on its woodpiles). */
function woodpile(b: CastleBuilder, x: number, z: number, level: number, w: number): void {
  if (!b.detailed) return;
  b.add(new THREE.BoxGeometry(w * U, 1.6 * U, 2.2 * U), x * U, (level + 0.8) * U, z * U, "#6a5340", 0, 2);
  b.add(new THREE.BoxGeometry((w + 0.6) * U, 0.25 * U, 2.8 * U), x * U, (level + 1.75) * U, z * U, "#4d4a44", 0, 1, 1);
}

function cart(b: CastleBuilder, x: number, z: number, level: number, angle: number): void {
  if (!b.detailed) return;
  b.add(new THREE.BoxGeometry(3.4 * U, 0.9 * U, 1.7 * U), x * U, (level + 1.1) * U, z * U, "#5d4733", angle, 2);
  [-1, 1].forEach(side => {
    const wheel = new THREE.CylinderGeometry(0.62 * U, 0.62 * U, 0.16 * U, 10).rotateX(Math.PI / 2);
    const [dx, dz] = [Math.sin(angle) * side * 0.95, Math.cos(angle) * side * 0.95];
    b.add(wheel, (x + dx) * U, (level + 0.62) * U, (z + dz) * U, "#3c3026", angle, 2);
  });
}

/**
 * One fort of the Night's Watch at the Wall's south foot, local metres: x along
 * the Wall, z away from it (south), y relative to the fort's own foot. The
 * crest is `height` metres up. Buildings stand on terraces cut into the slope;
 * Castle Black adds the stair and the winch cage.
 */
export function watchFortGeometry(castleBlack: boolean, height: number, seat: FortSeat, detailed: boolean): THREE.BufferGeometry {
  const b = new CastleBuilder("north", detailed, undefined, { stone: "#6f7576", trim: "#8f9595", roof: "#3f4244", wood: "#5b4632" });
  const p = b.palette;
  // Face of the Wall: at height y it stands this far north of the fort origin.
  const gap = 18;
  const face = (y: number): number => -(gap + (BASE_HALF - TOP_HALF) * Math.min(1, Math.max(0, y / height)));
  if (castleBlack) {
    // Castle Black has no curtain (the Wall is its wall): each building on its own terrace cut into the slope.
    const king = terrace(b, seat, -66, 26, 22, 22);
    roundTower(b, -66, 26, king, 8, 34);                  // King's Tower
    // Lord Commander's Tower: a square stone tower with a timber top storey and a pyramid roof.
    const lord = terrace(b, seat, -30, 32, 19, 19);
    b.box(13 * U, 22 * U, 13 * U, -30 * U, (lord - 1 + 11) * U, 32 * U, p.stone);
    b.add(new THREE.BoxGeometry(14.4 * U, 5 * U, 14.4 * U), -30 * U, (lord + 21 + 2.5) * U, 32 * U, p.wood, 0, 2);
    b.add(new THREE.ConeGeometry(11 * U, 8 * U, 4).rotateY(Math.PI / 4), -30 * U, (lord + 26 + 4) * U, 32 * U, p.roof, 0, 1, 1);
    hall(b, 18, 30, terrace(b, seat, 18, 30, 46, 20), 40, 14, 8, 0);          // Common Hall
    hall(b, 72, 24, terrace(b, seat, 72, 24, 22, 16), 16, 10, 5, 4);           // Lord Steward's lodging
    const stables = terrace(b, seat, -128, 70, 42, 16);
    hall(b, -128, 70, stables, 36, 10, 2, 4, "#433f3a");                       // the stables (timber on a stone sill)
    woodpile(b, -128, 84, stables, 12);
    hall(b, -84, 84, terrace(b, seat, -84, 84, 36, 16), 30, 10, 6, 0);         // Flint Barracks
    const forge = terrace(b, seat, -40, 68, 30, 20);
    const armory = hall(b, -40, 68, forge, 22, 12, 7, 3);                      // the armory and Donal Noye's forge
    b.box(2.4 * U, (armory - forge + 4) * U, 2.4 * U, -32 * U, (forge + (armory - forge + 4) / 2) * U, 72 * U, p.stone);
    cart(b, -26, 84, forge, -0.4);
    const yard = terrace(b, seat, 4, 80, 32, 24);
    trainingYard(b, 4, 80, yard, 26, 18);
    const hardin = terrace(b, seat, 76, 76, 16, 16);
    roundTower(b, 76, 76, hardin, 5.5, 24, true);         // Hardin's Tower
    // Maester Aemon's rookery: a small stone tower with a timber cap.
    const rookery = terrace(b, seat, 108, 86, 14, 14);
    b.box(9 * U, 12 * U, 9 * U, 108 * U, (rookery - 1 + 6) * U, 86 * U, p.stone);
    b.add(new THREE.BoxGeometry(9.8 * U, 3 * U, 9.8 * U), 108 * U, (rookery + 12.5) * U, 86 * U, p.wood, 0, 2);
    b.add(new THREE.ConeGeometry(7.5 * U, 6 * U, 4).rotateY(Math.PI / 4), 108 * U, (rookery + 17) * U, 86 * U, p.roof, 0, 1, 1);
    woodpile(b, 100, 60, terrace(b, seat, 100, 60, 18, 6), 14);
    cart(b, 40, 56, terrace(b, seat, 40, 56, 8, 6), 0.3);
    // Switchback timber stair fixed to the south face, landing by landing up to the crest.
    const rise = 16, run = 58;
    const flights = Math.ceil(height / rise);
    for (let i = 0; i < flights; i++) {
      const y0 = i * rise, y1 = Math.min(height, (i + 1) * rise);
      const dir = i % 2 ? -1 : 1;
      const x0 = -dir * run / 2, x1 = dir * run / 2;
      const z = face((y0 + y1) / 2) + 2.2;
      const pitch = Math.atan2(y1 - y0, run) * dir;
      const plank = new THREE.BoxGeometry(Math.hypot(run, y1 - y0) * U, 0.6 * U, 3.2 * U).rotateZ(pitch);
      b.add(plank, (x0 + x1) / 2 * U, (y0 + y1) / 2 * U, z * U, p.wood, 0, 2);
      b.box(6 * U, 0.7 * U, 5 * U, x1 * U, y1 * U, (face(y1) + 2.6) * U, p.wood, 0, 2);
      if (detailed) {
        const rail = new THREE.BoxGeometry(Math.hypot(run, y1 - y0) * U, 0.25 * U, 0.25 * U).rotateZ(pitch);
        b.add(rail, (x0 + x1) / 2 * U, ((y0 + y1) / 2 + 1.1) * U, (z + 1.5) * U, p.wood, 0, 2);
        [0.2, 0.5, 0.8].forEach(t => {
          const y = y0 + (y1 - y0) * t, x = x0 + (x1 - x0) * t;
          // Braces driven into the ice under the treads.
          b.box(0.45 * U, 0.45 * U, 4.2 * U, x * U, (y - 1.4) * U, (face(y) + 0.8) * U, p.wood, 0, 2);
        });
      }
    }
    // Winch cage on its chains beside the stair, and the winch house and jib on the crest.
    const cageY = height * 0.55;
    const cx = run / 2 + 16, cz = face(cageY) + 6;
    b.box(6 * U, 5 * U, 6 * U, cx * U, cageY * U, cz * U, "#3e3328", 0, 2);
    const jib = face(height) + 8;
    [-1.8, 1.8].forEach(dx => b.box(0.3 * U, (height - cageY) * U, 0.3 * U, (cx + dx) * U, (cageY + height) / 2 * U, cz * U, "#4b4d4f"));
    b.box(16 * U, 1.2 * U, 1.4 * U, cx * U, (height + 5) * U, (jib - 2) * U, p.wood, Math.PI / 2, 2);
    b.box(14 * U, 7 * U, 10 * U, cx * U, (height + 6.5) * U, (face(height) - 6) * U, p.wood, 0, 2);
    gableRoof(b, 14, 10, cx, height + 10, face(height) - 6, p.roof);
  } else {
    // Shadow Tower / Eastwatch: one tall tower, a hall and outbuildings, each on its terrace.
    const tower = terrace(b, seat, -14, 40, 20, 20);
    b.box(14 * U, 41 * U, 14 * U, -14 * U, (tower - 1 + 20.5) * U, 40 * U, p.stone);
    b.box(15 * U, 1.4 * U, 15 * U, -14 * U, (tower + 40.7) * U, 40 * U, p.trim);
    hall(b, 22, 52, terrace(b, seat, 22, 52, 36, 16), 30, 10, 6, 3);
    hall(b, -40, 96, terrace(b, seat, -40, 96, 24, 14), 18, 8, 2, 3, "#433f3a");
    const store = terrace(b, seat, 30, 96, 30, 14);
    hall(b, 22, 96, store, 18, 8, 5, 0);
    woodpile(b, 40, 96, store, 6);
  }
  return b.finish();
}

/** Metres under which a Watch fort uses its detailed form. */
const FORT_DETAIL = 3000;

/** Stand-alone World ×20 Wall: ice body plus the three forts, rebuilt only when its inputs change. */
export default class WallArt {
  readonly group = new THREE.Group();
  readonly material = new WallIceMaterial();
  private mesh?: THREE.Mesh;
  private forts: THREE.Mesh[] = [];
  private signature = "";
  private edges: WallEdge[] = [];
  private crest: WallCrest = () => 0;
  private ground?: (x: number, z: number) => number;

  constructor(parent: THREE.Object3D, private fortMaterial: CastleMaterial) {
    this.group.name = "wall-k20";
    parent.add(this.group);
  }

  /** Rebuilds the ice and forts when the edges, crest or fort seats change. */
  update(edges: WallEdge[], rise: number, ground: (x: number, z: number) => number, forts: { x: number; z: number; castleBlack: boolean }[], detailed: boolean): void {
    this.ground = ground;
    const signature = `${detailed}:${rise.toFixed(3)}:` + edges.map(e => `${e.a.x.toFixed(3)},${e.a.z.toFixed(3)},${e.b.x.toFixed(3)},${e.b.z.toFixed(3)}`).join("|") +
      forts.map(f => `${f.x.toFixed(3)},${f.z.toFixed(3)}`).join("|") + `:${ground(edges[0]?.a.x ?? 0, edges[0]?.a.z ?? 0).toFixed(3)}`;
    if (signature == this.signature) return;
    this.signature = signature;
    this.edges = edges;
    this.clear();
    if (!edges.length) return;
    const path = wallPath(edges, rise, ground);
    const crest = this.crest = wallCrest(edges, rise, ground, path);
    const origin = new THREE.Vector3(edges[0].a.x, crest(0, 0), edges[0].a.z);
    // Balanced: sections every 60 m (half the ice triangles).
    const geometry = wallGeometry(path, ground, origin, detailed ? 1 : 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.copy(origin);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    const longestIndex = edges.reduce((best, e, i) => Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z) > Math.hypot(edges[best].b.x - edges[best].a.x, edges[best].b.z - edges[best].a.z) ? i : best, 0);
    const longest = edges[longestIndex];
    forts.forEach(fort => {
      // Seat on the Wall's south foot: local +z points away from the ice.
      const dx = longest.b.x - longest.a.x, dz = longest.b.z - longest.a.z;
      const along = Math.hypot(dx, dz) || 1;
      let yaw = Math.atan2(-dz, dx);
      const south = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      if (south.z < 0) { yaw += Math.PI; south.negate(); }
      // The fort origin sits on the foot line, 18 m off the ice toe, at the
      // flattest public ground within ~25 % of its nominal place along the Wall.
      const nominal = ((fort.x - longest.a.x) * dx + (fort.z - longest.a.z) * dz) / (along * along);
      const c0 = Math.cos(yaw), s0 = Math.sin(yaw);
      const origin = (t: number): [number, number] => [longest.a.x + dx * t + south.x * (BASE_HALF + 18) * U, longest.a.z + dz * t + south.z * (BASE_HALF + 18) * U];
      const roughness = (t: number): number => {
        const [x0, z0] = origin(t);
        const heights = [-120, -60, 0, 60, 90].flatMap(lx => [20, 45, 70].map(lz => ground(x0 + (lx * c0 + lz * s0) * U, z0 + (-lx * s0 + lz * c0) * U)));
        return (Math.max(...heights) - Math.min(...heights)) * METRES_PER_UNIT + Math.abs(t - nominal) * 40;
      };
      let t = nominal;
      for (let step = -25; step <= 25; step++) {
        const candidate = nominal + step * 0.01;
        if (candidate > 0.05 && candidate < 0.95 && roughness(candidate) < roughness(t)) t = candidate;
      }
      const [ox, oz] = origin(t);
      const foot = ground(ox, oz);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const local = (x: number, z: number): number => (ground(ox + (x * c + z * s) * U, oz + (-x * s + z * c) * U) - foot) * METRES_PER_UNIT;
      const height = (crest(longestIndex, t) - foot) * METRES_PER_UNIT;
      // Detailed form near the eye only (FORT_DETAIL); the simple form beyond, and on Balanced.
      [false, ...(detailed ? [true] : [])].forEach(form => {
        const mesh = new THREE.Mesh(watchFortGeometry(fort.castleBlack, height, { ground: local }, form), this.fortMaterial);
        mesh.position.set(ox, foot, oz);
        mesh.rotation.y = yaw;
        mesh.receiveShadow = true;
        mesh.name = fort.castleBlack ? "castle-black" : "watch-fort";
        mesh.userData.detailed = form;
        mesh.visible = !form;
        this.group.add(mesh);
        this.forts.push(mesh);
      });
    });
  }

  /**
   * Fort forms and shadow casters for this eye: detailed forts within
   * FORT_DETAIL; shadows from the ice within 3 km and the forts within 1.5 km
   * (the 7 km ribbon otherwise fills every cascade). True when a caster or a
   * form was toggled.
   */
  updateShadows(eye: THREE.Vector3, enabled: boolean): boolean {
    let changed = false;
    const near = new Set(this.forts.filter(mesh => mesh.userData.detailed && eye.distanceTo(mesh.position) * METRES_PER_UNIT < FORT_DETAIL * (mesh.visible ? 1.15 : 1)).map(mesh => mesh.name + mesh.position.x));
    this.forts.forEach(mesh => {
      const show = mesh.userData.detailed ? near.has(mesh.name + mesh.position.x) : !near.has(mesh.name + mesh.position.x);
      if (mesh.visible != show) { mesh.visible = show; changed = true; }
    });
    const set = (mesh: THREE.Mesh, on: boolean): void => { if (mesh.castShadow != on) { mesh.castShadow = on; changed = true; } };
    if (this.mesh) {
      const near = this.edges.some(({ a, b }) => {
        const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz || 1;
        const t = Math.min(1, Math.max(0, ((eye.x - a.x) * dx + (eye.z - a.z) * dz) / length2));
        return Math.hypot(eye.x - a.x - dx * t, eye.z - a.z - dz * t) * METRES_PER_UNIT < 3000;
      });
      set(this.mesh, enabled && near);
    }
    this.forts.forEach(mesh => set(mesh, enabled && mesh.visible && eye.distanceTo(mesh.position) * METRES_PER_UNIT < 1500));
    return changed;
  }

  /** Surface of the ice under a scene point (scene y), for camera clearance; -Infinity off the Wall. */
  floorAt(x: number, z: number): number {
    if (!this.ground || !this.mesh) return -Infinity;
    let floor = -Infinity;
    for (let edge = 0; edge < this.edges.length; edge++) {
      const { a, b } = this.edges[edge];
      const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
      if (!length2) continue;
      const t = ((x - a.x) * dx + (z - a.z) * dz) / length2;
      if (t < -0.02 || t > 1.02) continue;
      const d = Math.abs((x - a.x) * dz - (z - a.z) * dx) / Math.sqrt(length2) * METRES_PER_UNIT;
      if (d > BASE_HALF + 2) continue;
      const foot = this.ground(x, z);
      const height = (this.crest(edge, t) - foot) * METRES_PER_UNIT;
      floor = Math.max(floor, foot + wallProfileHeight(d, height) * U);
    }
    return floor;
  }

  private clear(): void {
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = undefined; }
    this.forts.forEach(mesh => { this.group.remove(mesh); mesh.geometry.dispose(); });
    this.forts = [];
  }

  dispose(): void {
    this.clear();
    this.group.parent?.remove(this.group);
    this.material.dispose();
  }
}

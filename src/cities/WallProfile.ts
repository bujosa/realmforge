/**
 * Profile and path of the World ×20 Wall (pure; WallArt builds the mesh from
 * them and the camera floor reads them). Metres from the centre line and above
 * the foot; the path in scene units.
 */
import { METRES_PER_UNIT } from "../core/SceneFrame";

const U = 1 / METRES_PER_UNIT;
/** Station spacing along the Wall (m). */
export const WALL_STATION_METRES = 30;
const STATION = WALL_STATION_METRES;

export interface WallEdge { a: { x: number; z: number }; b: { x: number; z: number } }

/** Half thickness of the Wall at its foot (m). */
export const WALL_BASE_HALF_METRES = 38;
/** Half thickness of the Wall at its crest (m). */
export const WALL_TOP_HALF_METRES = 14;

/** Height (m above the foot) of the Wall's surface at |d| metres from its centre line. */
export function wallProfileHeight(d: number, height: number): number {
  const off = Math.abs(d);
  if (off <= WALL_TOP_HALF_METRES) return height + 4;
  if (off >= WALL_BASE_HALF_METRES + 2) return -Infinity;
  return height * Math.min(1, Math.max(0, (WALL_BASE_HALF_METRES - off) / (WALL_BASE_HALF_METRES - WALL_TOP_HALF_METRES))) + 2;
}

/** Crest (scene y) at parameter `t` of edge `edge`. */
export type WallCrest = (edge: number, t: number) => number;

/** One continuous run of the Wall: consecutive border edges chained end to end. */
export interface WallRun {
  /** Stations every STATION metres along the run (scene x, z), corners rounded. */
  points: [number, number][];
  /** Arc length (m) of every station. */
  along: number[];
  /** Crest (scene y) of every station. */
  crest: number[];
  length: number;
}

/** The Wall's runs and, for every edge, its run and arc offset (m). */
export interface WallPath { runs: WallRun[]; edges: { run: number; offset: number; length: number }[] }

/** Chains edges whose ends meet into runs (the border polygon may start mid-run). */
function chain(edges: WallEdge[]): number[][] {
  const meets = (p: { x: number; z: number }, q: { x: number; z: number }): boolean => Math.hypot(p.x - q.x, p.z - q.z) * METRES_PER_UNIT < 1;
  const runs: number[][] = [];
  edges.forEach((edge, i) => {
    const last = runs[runs.length - 1];
    if (last && meets(edges[last[last.length - 1]].b, edge.a)) last.push(i); else runs.push([i]);
  });
  if (runs.length > 1) {
    const first = runs[0], last = runs[runs.length - 1];
    if (meets(edges[last[last.length - 1]].b, edges[first[0]].a)) { runs[0] = [...last, ...first]; runs.pop(); }
  }
  return runs;
}

/**
 * The Wall's path: runs resampled every 30 m with corners rounded over ±90 m,
 * and a crest that follows the land: 213 m (`rise`) over the higher ground
 * within ±600 m along the run, never more than 60 m above the local foot,
 * smoothed. One constant crest made valley sections 500 m tall at ×20 relief.
 */
export function wallPath(edges: WallEdge[], rise: number, ground: (x: number, z: number) => number): WallPath {
  const reach = Math.round(600 / STATION), smooth = 5, round = 3, cap = 60 * U;
  const path: WallPath = { runs: [], edges: edges.map(() => ({ run: 0, offset: 0, length: 0 })) };
  chain(edges).forEach(list => {
    const run = path.runs.length;
    const corners: [number, number][] = [[edges[list[0]].a.x, edges[list[0]].a.z]];
    let length = 0;
    list.forEach(i => {
      const { a, b } = edges[i];
      const edgeLength = Math.hypot(b.x - a.x, b.z - a.z) * METRES_PER_UNIT;
      path.edges[i] = { run, offset: length, length: edgeLength };
      length += edgeLength;
      corners.push([b.x, b.z]);
    });
    const count = Math.max(1, Math.ceil(length / STATION));
    // Point on the raw polyline at arc length s (m).
    const at = (s: number): [number, number] => {
      let rest = Math.min(length, Math.max(0, s));
      for (let k = 0; k < list.length; k++) {
        const edgeLength = path.edges[list[k]].length;
        if (rest <= edgeLength || k == list.length - 1) {
          const t = edgeLength ? rest / edgeLength : 0;
          return [corners[k][0] + (corners[k + 1][0] - corners[k][0]) * t, corners[k][1] + (corners[k + 1][1] - corners[k][1]) * t];
        }
        rest -= edgeLength;
      }
      return corners[corners.length - 1];
    };
    const raw = Array.from({ length: count + 1 }, (_, j) => at(j * length / count));
    // A moving average leaves straight runs untouched and rounds the corners.
    const points = raw.map((p, j) => {
      if (j == 0 || j == count) return p;
      const k = Math.min(round, j, count - j);
      let x = 0, z = 0;
      for (let o = -k; o <= k; o++) { x += raw[j + o][0]; z += raw[j + o][1]; }
      return [x / (2 * k + 1), z / (2 * k + 1)] as [number, number];
    });
    const along = points.map((_, j) => j * length / count);
    const foot = points.map((p, j) => {
      const [nx, nz] = normalAt(points, j);
      return Math.max(ground(p[0], p[1]), ...[-1, 1].map(side => ground(p[0] + nx * side * WALL_BASE_HALF_METRES * U, p[1] + nz * side * WALL_BASE_HALF_METRES * U)));
    });
    const raised = foot.map((g, i) => Math.min(Math.max(...foot.slice(Math.max(0, i - reach), i + reach + 1)), g + cap));
    const crest = raised.map((_, i) => {
      const window = raised.slice(Math.max(0, i - smooth), i + smooth + 1);
      return window.reduce((sum, v) => sum + v, 0) / window.length + rise;
    });
    path.runs.push({ points, along, crest, length });
  });
  return path;
}

/** Unit normal (scene x, z) of a run at station j (from its neighbours). */
export function normalAt(points: [number, number][], j: number): [number, number] {
  const p = points[Math.max(0, j - 1)], q = points[Math.min(points.length - 1, j + 1)];
  const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz) || 1;
  return [-dz / length, dx / length];
}

/** Crest (scene y) of a run at arc length s (m). */
function crestOf(run: WallRun, s: number): number {
  const f = Math.min(1, Math.max(0, s / (run.length || 1))) * (run.crest.length - 1), i = Math.floor(f);
  return run.crest[i] + (run.crest[Math.min(run.crest.length - 1, i + 1)] - run.crest[i]) * (f - i);
}

/** Crest lookup by edge and edge parameter (forts, camera floor). */
export function wallCrest(edges: WallEdge[], rise: number, ground: (x: number, z: number) => number, path = wallPath(edges, rise, ground)): WallCrest {
  return (edge, t) => {
    const e = path.edges[edge];
    return crestOf(path.runs[e.run], e.offset + Math.min(1, Math.max(0, t)) * e.length);
  };
}

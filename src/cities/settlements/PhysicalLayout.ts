import { hillHeight, TerrainHill } from "../../core/HillProfile";
import { clipConvex, convexHull, inside, insetPolygon, polygonArea, polylineDistance, seeded, simplifyPolygon } from "./plane";
import { CurtainRecipe, DistrictRecipe, FlowRecipe, LandmarkRecipe, PhysicalLandmarkKind, PhysicalRecipe } from "../../presets/physicalCities";
import type { HouseFamily } from "./PhysicalKit";
import { CityTier, Vec2 } from "./types";

// World ×20 physical city planner (design §2.3, §4.5, §5.5). Pure and
// deterministic: the same recipe, region, terrain and reserves give the same
// plan on every machine (seeded streams per element, no Math.random).
// Everything is in local metres about the city origin: +x east, +z south
// (scene axes × 50). Heights are absolute metres. Static public map data
// only — reserves are the static unit slots and other castles; formations
// that come and go hide houses later (PhysicalCity), they never re-plan.
//
// Planned in resumable steps (`planPhysicalCity` is a generator): the World
// advances it ≤ 8 ms per rendered frame after the terrain has streamed in.

export interface PhysicalInputs {
  hills?: TerrainHill[];
  recipe: PhysicalRecipe;
  tier: CityTier;
  /** Area polygon (host region), local metres. */
  boundary: Vec2[];
  /** Castle sculpt footprint, local metres (centre and half extents). */
  keep?: { x: number; z: number; hw: number; hd: number };
  /** Absolute terrain height (m) at local metres; `ground` adds the rendered grids. */
  height(x: number, z: number): number;
  ground?(x: number, z: number): number[];
  water(x: number, z: number): boolean;
  /** Signed metres to the exact rendered ocean shore; positive on land. */
  shore?(x: number, z: number): number;
  /** Permanent clear discs (unit slots, other castles), local metres. */
  reserves: { x: number; z: number; r: number }[];
  /** The castle has a physical complex (P3·C2): landmarks it carries are skipped. */
  complex?: boolean;
}

export interface PlannedHouse {
  x: number; z: number; y: number; yaw: number;
  w: number; d: number; h: number;
  family: HouseFamily;
  foundation: number;
  wall: [number, number, number]; roof: [number, number, number];
  ridge: number; dome: boolean;
  distantWall?: [number, number, number]; distantRoof?: [number, number, number];
  /** Wall finish (round 2): bare masonry or lime plaster; undefined keeps the family's. */
  finish?: "plaster" | "stone";
  district: string;
  /** Roofscape block: houses of one lot block share one far instance. */
  block: string;
}

export type PieceKind = "wall" | "tower" | "gate";
export interface PlannedPiece {
  kind: PieceKind;
  x: number; z: number; y: number; yaw: number;
  /** Along / across / height (m). */
  length: number; thickness: number; height: number;
  foundation: number;
  palisade: boolean; low: boolean;
  wall: [number, number, number];
  ring: number;
  /** Curtain run (ring:edge) and position along it, for merged far blocks. */
  run?: string;
}

export interface PlannedGate { name: string; x: number; z: number; y: number; outward: Vec2 }
export interface PlannedLandmark { kind: PhysicalLandmarkKind; x: number; z: number; y: number; yaw: number; foundation: number; scale: number; reserve: number }
export interface PlannedStrip { x: number; z: number; y: number; yaw: number; length: number; width: number; depth: number }
/** A stone stair from a high bank down to the foot quay: treads from `top` to `bottom` (m) over `length` seaward. */
export interface PlannedStair { x: number; z: number; yaw: number; top: number; bottom: number; length: number; width: number }
export interface PlannedTree { x: number; z: number; y: number; h: number; kind: "pine" | "oak" | "weirwood" }

export interface PhysicalPlan {
  hills?: TerrainHill[];
  houses: PlannedHouse[];
  pieces: PlannedPiece[];
  gates: PlannedGate[];
  landmarks: PlannedLandmark[];
  quays: PlannedStrip[];
  piers: PlannedStrip[];
  moat: PlannedStrip[];
  bridges: PlannedStrip[];
  stairs: PlannedStair[];
  /** Paved market square round the hub: 8 m flags seated on the ground. */
  paving: PlannedStrip[];
  /** The square where the gate streets meet. */
  hub?: Vec2;
  trees: PlannedTree[];
  streets: { points: Vec2[]; width: number }[];
  /** Lots that passed every test, before the tier cap. */
  candidates: number;
  /** Clipped city area (local metres): the composer leaves it to the city. */
  area: Vec2[];
  /** Rejected lots by reason (QA). */
  rejects: Record<string, number>;
}

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16);
  const linear = (c: number): number => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return [linear(value >> 16 & 255), linear(value >> 8 & 255), linear(value & 255)];
};
const shade = (color: Rgb, amount: number): Rgb => [color[0] * amount, color[1] * amount, color[2] * amount];

/** Water distance grid resolution (m). */
const GRID = 10;
/** Market square radius round the hub (m). */
const SQUARE = 30;
/** Main-thread time per planning step (ms): loops yield once past it (outputs never depend on it). */
const STEP_MS = 2.5;

export function* planPhysicalCity(input: PhysicalInputs): Generator<void, PhysicalPlan, void> {
  const { recipe } = input;
  const id = recipe.id;
  // Time-sliced: a loop yields once STEP_MS have passed since the last such yield.
  let mark = performance.now();
  const due = (): boolean => { const now = performance.now(); if (now - mark < STEP_MS) return false; mark = now; return true; };
  const area = yield* cityAreaSteps(input.boundary, recipe.radius, input.water);
  const plan: PhysicalPlan = { houses: [], pieces: [], gates: [], landmarks: [], quays: [], piers: [], moat: [], bridges: [], stairs: [], paving: [], trees: [], streets: [], candidates: 0, area, rejects: {} };
  if (area.length < 3) return plan;
  const keep = input.keep;
  // Districts, landmarks and the square measure from the city centre (the
  // local origin): the keep for capitals, the coastal centre otherwise.
  const keepAt: Vec2 = [0, 0];
  // The castle itself (coastal cities: away from the centre).
  const castleAt: Vec2 = keep ? [keep.x, keep.z] : [0, 0];
  const inArea = (x: number, z: number): boolean => inside(area, x, z);

  // ---- Water distance (m) on a GRID lattice over the area (+ margin).
  const xs = area.map(p => p[0]), zs = area.map(p => p[1]);
  // Margin round the area: 120 m, or 320 m to find an islet out in the bay.
  const margin = recipe.landmarks.some(l => l.water) ? 320 : 120;
  const x0 = Math.min(...xs) - margin, z0 = Math.min(...zs) - margin;
  const nx = Math.ceil((Math.max(...xs) + margin - x0) / GRID) + 1, nz = Math.ceil((Math.max(...zs) + margin - z0) / GRID) + 1;
  const dist = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      dist[j * nx + i] = input.shore?.(x0 + i * GRID, z0 + j * GRID)
        ?? (input.water(x0 + i * GRID, z0 + j * GRID) ? 0 : 1e6);
      if ((i & 63) == 63 && due()) yield;
    }
    if (due()) yield;
  }
  if (!input.shore) {
    chamfer(dist, nx, nz, true);
    yield;
    chamfer(dist, nx, nz, false);
    yield;
  }
  // Distance (m) from water cells to dry land: islets, river widths.
  const landDist = new Float32Array(nx * nz);
  for (let k = 0; k < landDist.length; k++) landDist[k] = dist[k] > 0 ? 0 : 1e6;
  chamfer(landDist, nx, nz, true);
  chamfer(landDist, nx, nz, false);
  const lattice = (x: number, z: number): number => {
    const i = Math.round((x - x0) / GRID), j = Math.round((z - z0) / GRID);
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
  };
  const wet = (x: number, z: number): boolean => input.shore ? input.shore(x, z) < 0 : (() => { const k = lattice(x, z); return k >= 0 && dist[k] <= 0; })();
  yield;
  const shoreDistance = (x: number, z: number): number => {
    if (input.shore) return input.shore(x, z);
    const fi = (x - x0) / GRID, fj = (z - z0) / GRID;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fi))), j = Math.max(0, Math.min(nz - 2, Math.floor(fj)));
    const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
    const a = dist[j * nx + i], b = dist[j * nx + i + 1], c = dist[(j + 1) * nx + i], d = dist[(j + 1) * nx + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  // Seaward direction: the descending water-distance gradient.
  const seaward = (x: number, z: number): Vec2 => {
    const s = GRID * 3;
    const gx = shoreDistance(x + s, z) - shoreDistance(x - s, z), gz = shoreDistance(x, z + s) - shoreDistance(x, z - s);
    const length = Math.hypot(gx, gz) || 1;
    return [-gx / length, -gz / length];
  };

  const hills: TerrainHill[] = [...input.hills ?? []];
  // Seat: highest footprint sample (dug up to `sink` into the slope); the
  // skirt reaches the lowest; `plinth` is the worst single grid's drop.
  const seat = (x: number, z: number, hx: number, hz: number, angle: number, sink = 0): { y: number; foundation: number; plinth: number } => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const grids = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
      const px = x + i * hx * c + j * hz * s, pz = z - i * hx * s + j * hz * c;
      return [input.height(px, pz), ...(input.ground?.(px, pz) ?? [])].map(h => hillHeight(hills, px, pz, h));
    });
    const samples = grids.flat(), top = Math.max(...samples), bottom = Math.min(...samples);
    const y = top - Math.min(sink, (top - bottom) / 2);
    const plinth = Math.max(...grids[0].map((_, k) => y - Math.min(...grids.map(grid => grid[k] ?? grid[0]))));
    return { y, foundation: y - bottom + 0.6, plinth };
  };

  const keepRect = keep ? { x: keep.x, z: keep.z, hw: keep.hw + recipe.keepMargin, hd: keep.hd + recipe.keepMargin } : undefined;
  const inKeep = (x: number, z: number, r: number): boolean => !!keepRect && Math.abs(x - keepRect.x) < keepRect.hw + r && Math.abs(z - keepRect.z) < keepRect.hd + r;
  const reserved = (x: number, z: number, r: number): boolean => input.reserves.some(q => Math.hypot(x - q.x, z - q.z) < q.r + r);

  // ---- Curtain outlines (stone; a palisade is fitted round its town later).
  const rings: { recipe: CurtainRecipe; points: Vec2[]; index: number }[] = [];
  recipe.curtains.forEach((curtain, index) => {
    if (curtain.palisade) return;
    const points = curtainOutline(curtain);
    if (points.length >= 3) rings.push({ recipe: curtain, points, index });
  });
  const mainRing = rings[0]?.points;
  const outerRing = rings.length ? rings[rings.length - 1].points : undefined;

  // ---- Landmarks: best compass match in the distance band, clear ground
  // inside the main curtain.
  for (const landmark of recipe.landmarks) { yield* placeLandmark(landmark); yield; }

  function* placeLandmark(l: LandmarkRecipe): Generator<void, void, void> {
    if (l.unlessComplex && input.complex) return;
    if (l.water) { placeIslet(l); return; }
    let best: { x: number; z: number; score: number } | undefined;
    const step = 20;
    const from = l.from == "castle" ? castleAt : keepAt;
    // From the castle, the bearing turns from the castle → city-centre line.
    const facing = l.from == "castle" ? Math.atan2(keepAt[1] - castleAt[1], keepAt[0] - castleAt[0]) + l.bearing : l.bearing;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) for (let z = Math.min(...zs); z <= Math.max(...zs); z += step) {
      if (z == Math.min(...zs) && due()) yield;
      const distance = Math.hypot(x - from[0], z - from[1]);
      if (distance < l.distance[0] || distance > l.distance[1]) continue;
      if (!inArea(x, z) || polylineDistance(x, z, area, true) < l.reserve * 0.7 || shoreDistance(x, z) < l.reserve * 0.8) continue;
      if (l.shore != undefined && shoreDistance(x, z) > l.reserve + l.shore) continue;
      // Inside the main curtain, clear of it — a waterfront landmark may stand on
      // the sea side, where the curtain gives way to the quays.
      if (mainRing && l.shore == undefined && (!inside(mainRing, x, z) || polylineDistance(x, z, mainRing, true) < l.reserve + rings[0].recipe.thickness)) continue;
      if (inKeep(x, z, l.reserve) || reserved(x, z, l.reserve)) continue;
      if (plan.landmarks.some(o => Math.hypot(o.x - x, o.z - z) < o.reserve + l.reserve)) continue;
      const bearing = Math.atan2(z - from[1], x - from[0]);
      const h = input.height(x, z);
      const score = Math.cos(bearing - facing) + (l.high ? h / 120 : 0) - distance * 0.0002;
      if (!best || score > best.score) best = { x, z, score };
    }
    if (!best) return;
    // A landmark faces the keep (its stair toward the square).
    const yaw = Math.atan2(keepAt[0] - best.x, keepAt[1] - best.z);
    const ground = seat(best.x, best.z, l.reserve * 0.5, l.reserve * 0.5, 0);
    plan.landmarks.push({ kind: l.kind, x: best.x, z: best.z, y: ground.y + (id == "kings-landing" ? 20 : 0), yaw, foundation: ground.foundation, scale: l.scale, reserve: l.reserve });
  }
  /** An islet: open water `reserve` + 60 m round it, ≤ 180 m beyond that from the shore. */
  function placeIslet(l: LandmarkRecipe): void {
    let best: { x: number; z: number; score: number } | undefined;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = x0 + i * GRID, z = z0 + j * GRID, shore = landDist[k];
      // Open water: a channel narrower than ~2 × (reserve + 60) m is a river, not a bay.
      if (dist[k] > 0 || shore < l.reserve + 60 || shore > l.reserve + 180) continue;
      const distance = Math.hypot(x - keepAt[0], z - keepAt[1]);
      if (distance < l.distance[0] || distance > l.distance[1] || reserved(x, z, l.reserve)) continue;
      const score = Math.cos(Math.atan2(z - keepAt[1], x - keepAt[0]) - l.bearing) - distance * 0.0015 - shore * 0.004;
      if (!best || score > best.score) best = { x, z, score };
    }
    if (!best) return;
    const y = input.height(best.x, best.z);
    plan.landmarks.push({ kind: l.kind, x: best.x, z: best.z, y, yaw: seeded(`${id}:${l.kind}`)() * Math.PI * 2, foundation: 14, scale: l.scale, reserve: l.reserve });
  }
  if (id == "kings-landing") {
    for (const l of plan.landmarks) hills.push({ x: l.x, z: l.z, top: l.y, crown: l.reserve * 0.54, radius: l.reserve * 1.85 });
    plan.hills = hills;
  }
  const nearLandmark = (x: number, z: number, r: number): boolean => plan.landmarks.some(l => Math.hypot(x - l.x, z - l.z) < l.reserve + r);

  // ---- Curtains: pieces, gatehouses and towers.
  const gateCentres: Vec2[] = [];
  for (const ring of rings) yield* placeRing(ring.recipe, ring.points, ring.index, false);

  function curtainOutline(curtain: CurtainRecipe): Vec2[] {
    const outline = curtain.outline;
    if ("keep" in outline) {
      if (!keep) return [];
      const hw = keep.hw + outline.keep, hd = keep.hd + outline.keep, cut = Math.min(hw, hd) * 0.28;
      return [[keep.x - hw + cut, keep.z - hd], [keep.x + hw - cut, keep.z - hd], [keep.x + hw, keep.z - hd + cut], [keep.x + hw, keep.z + hd - cut],
        [keep.x + hw - cut, keep.z + hd], [keep.x - hw + cut, keep.z + hd], [keep.x - hw, keep.z + hd - cut], [keep.x - hw, keep.z - hd + cut]];
    }
    const simple = simplifyPolygon(area, 18, 5);
    if (simple.length < 3) return [];
    if (outline.inset < 60) return insetPolygon(simple, outline.inset);
    // Deep rings (the desert seat's middle wall) shrink about the centre: a miter
    // inset of 150 m would fold a concave outline over itself.
    const [cx, cz] = keepAt, share = Math.max(0.35, 1 - outline.inset / Math.max(150, recipe.radius));
    return simple.map(([x, z]) => [cx + (x - cx) * share, cz + (z - cz) * share] as Vec2);
  }

  function* placeRing(curtain: CurtainRecipe, points: Vec2[], index: number, palisade: boolean, accept?: (x: number, z: number) => boolean): Generator<void, void, void> {
    const n = points.length, sign = polygonArea(points) > 0 ? 1 : -1;
    const tone = rgb(palisade ? "#6b5643" : recipe.palette.stone);
    const cityWall = "inset" in curtain.outline;
    // Pieces stand on dry land inside the area; a city curtain never faces the
    // sea (that shore gets quays), and nothing stands on the keep or a landmark.
    const valid = (x: number, z: number, r: number): boolean => accept ? accept(x, z)
      : inArea(x, z) && shoreDistance(x, z) > (cityWall ? 34 : curtain.thickness) && !inKeep(x, z, r * 0.2) && !nearLandmark(x, z, r * 0.5) && !reserved(x, z, r);
    type Station = { x: number; z: number; angle: number; outward: Vec2; key: string };
    const walk: (PlannedPiece | undefined)[] = [];
    const stations: Station[] = [];
    // Gates: the best valid curtain point toward each compass bearing.
    const gates: { name: string; edge: number; s: number }[] = [];
    const candidates: { edge: number; s: number; x: number; z: number }[] = [];
    const span = curtain.piece * 1.6;
    for (let edge = 0; edge < n; edge++) {
      const a = points[edge], b = points[(edge + 1) % n], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = span / 2 + 4; s < length - span / 2 - 4; s += 8) {
        const x = a[0] + (b[0] - a[0]) * s / length, z = a[1] + (b[1] - a[1]) * s / length;
        if ([-1, 0, 1].every(k => valid(x + (b[0] - a[0]) / length * k * span / 2, z + (b[1] - a[1]) / length * k * span / 2, span / 2))) candidates.push({ edge, s, x, z });
      }
      if (due()) yield;
    }
    yield;
    const ringCentre = centroid(points);
    curtain.gates.forEach(gate => {
      let best: typeof candidates[0] | undefined, score = 0.5;
      candidates.forEach(candidate => {
        const value = Math.cos(Math.atan2(candidate.z - ringCentre[1], candidate.x - ringCentre[0]) - gate.bearing);
        if (value > score && gates.every(g => { const p = candidates.find(c => c.edge == g.edge && c.s == g.s); return !p || Math.hypot(p.x - candidate.x, p.z - candidate.z) > span * 4; })) { best = candidate; score = value; }
      });
      if (best) gates.push({ name: gate.name, edge: best.edge, s: best.s });
    });
    const gatePieces: { piece: PlannedPiece; gate: PlannedGate }[] = [];
    for (let edge = 0; edge < n; edge++) {
      const a = points[edge], b = points[(edge + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 1e-3) continue;
      // Outward normal (local +Z of the piece faces out of the ring).
      const outward: Vec2 = [dz / length * sign, -dx / length * sign];
      const angle = Math.atan2(outward[0], outward[1]);
      const at = (s: number): Vec2 => [a[0] + dx * s / length, a[1] + dz * s / length];
      const cuts = gates.filter(g => g.edge == edge).map(g => ({ from: g.s - span / 2, to: g.s + span / 2, gate: g })).sort((p, q) => p.from - q.from);
      let start = 0;
      [...cuts, { from: length, to: length, gate: undefined }].forEach(cut => {
        const run = cut.from - start;
        if (run > 2) {
          const count = Math.max(1, Math.round(run / curtain.piece)), piece = run / count;
          for (let k = 0; k < count; k++) {
            const [x, z] = at(start + (k + 0.5) * piece);
            const ends = [at(start + k * piece + piece * 0.1), at(start + (k + 1) * piece - piece * 0.1)];
            if (!valid(x, z, piece / 2) || ends.some(([ex, ez]) => !valid(ex, ez, 0))) { walk.push(undefined); continue; }
            const ground = seat(x, z, piece / 2, curtain.thickness / 2, angle);
            walk.push({ kind: "wall", x, z, y: ground.y, yaw: angle, length: piece * 1.02, thickness: curtain.thickness, height: curtain.height, foundation: ground.foundation,
              palisade, low: !!curtain.low, wall: shade(tone, 0.94 + seeded(`${id}:${index}:${edge}:${k}:${start.toFixed(1)}`)() * 0.1), ring: index, run: `${index}:${edge}` });
          }
        }
        if (cut.gate) {
          const [x, z] = at(cut.gate.s);
          gateCentres.push([x, z]);
          const ground = seat(x, z, span / 2, curtain.thickness, angle);
          const piece: PlannedPiece = { kind: "gate", x, z, y: ground.y, yaw: angle, length: span, thickness: curtain.thickness + 3, height: curtain.towerHeight, foundation: ground.foundation,
            palisade, low: !!curtain.low, wall: tone, ring: index };
          gatePieces.push({ piece, gate: { name: cut.gate.name, x: x + outward[0] * (curtain.thickness + 6), z: z + outward[1] * (curtain.thickness + 6), y: ground.y, outward } });
          walk.push(piece);
        }
        start = Math.max(start, cut.to);
      });
      if (due()) yield;
      const marks = [0];
      for (let s = curtain.towerEvery; s < length - curtain.towerSize * 1.5; s += curtain.towerEvery) marks.push(s);
      marks.forEach((s, i) => {
        if (cuts.some(cut => s > cut.from - curtain.towerSize && s < cut.to + curtain.towerSize)) return;
        const [x, z] = at(s);
        stations.push({ x, z, angle, outward, key: `${id}:${index}:${edge}:${i}` });
      });
    }
    // Isolated runs read as loose fragments: keep runs of 3+ pieces.
    const kept = keepRuns(walk, run => run.filter(p => p.kind == "wall").length >= 3);
    const walls = kept.filter(p => p.kind == "wall");
    plan.pieces.push(...walls);
    const beside = (x: number, z: number, reach: number): boolean => walls.some(w => Math.hypot(w.x - x, w.z - z) < reach);
    gatePieces.filter(({ piece }) => beside(piece.x, piece.z, piece.length / 2 + curtain.piece * 0.8)).forEach(({ piece, gate }) => { plan.pieces.push(piece); plan.gates.push(gate); });
    stations.forEach(station => {
      if (!beside(station.x, station.z, curtain.piece * 0.8) || !valid(station.x, station.z, curtain.towerSize / 2)) return;
      const ground = seat(station.x, station.z, curtain.towerSize / 2, curtain.towerSize / 2, station.angle);
      plan.pieces.push({ kind: "tower", x: station.x, z: station.z, y: ground.y, yaw: station.angle, length: curtain.towerSize, thickness: curtain.towerSize, height: curtain.towerHeight,
        foundation: ground.foundation, palisade, low: !!curtain.low, wall: shade(tone, 0.95 + seeded(station.key)() * 0.08), ring: index });
    });
  }
  const insideMain = (x: number, z: number): boolean => !mainRing || inside(mainRing, x, z);
  const outsideOuter = (x: number, z: number): boolean => !outerRing || !inside(outerRing, x, z);
  const ringClear = (x: number, z: number, r: number): boolean => rings.every(ring => polylineDistance(x, z, ring.points, true) > ring.recipe.thickness / 2 + r + 2.5);

  // ---- Moat between the first two curtains (the northern seat), bridged at gates.
  if (recipe.moat && rings.length > 1 && keep) {
    const margin = (outlineMargin(rings[0].recipe) + outlineMargin(rings[1].recipe)) / 2;
    const moat = curtainOutline({ ...rings[0].recipe, outline: { keep: margin } });
    for (let edge = 0; edge < moat.length; edge++) {
      const a = moat[edge], b = moat[(edge + 1) % moat.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const count = Math.max(1, Math.round(length / 20)), yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (gateCentres.some(([gx, gz]) => Math.hypot(gx - x, gz - z) < 70 && Math.cos(Math.atan2(gz - keep.z, gx - keep.x) - Math.atan2(z - keep.z, x - keep.x)) > Math.cos(0.12))) {
          const ground = seat(x, z, 10, recipe.moat / 2, yaw);
          plan.bridges.push({ x, z, y: ground.y + 0.8, yaw: yaw + Math.PI / 2, length: recipe.moat + 8, width: 7, depth: ground.foundation + 1 });
          continue;
        }
        const ground = seat(x, z, length / count / 2, recipe.moat / 2, yaw);
        plan.moat.push({ x, z, y: ground.y - 1.4, yaw, length: length / count + 0.6, width: recipe.moat, depth: ground.foundation });
      }
    }
  }
  const inMoat = (x: number, z: number, r: number): boolean => plan.moat.some(s => Math.hypot(s.x - x, s.z - z) < s.length / 2 + s.width / 2 + r);

  // ---- Godswood: sentinels, oaks and one weirwood inside the inner curtain.
  if (recipe.godswood && keep && mainRing) {
    const g = recipe.godswood, sapling = seeded(`${id}:grove`);
    const reach = Math.max(keep.hw, keep.hd) + g.distance;
    const gx = keep.x + Math.cos(g.bearing) * reach, gz = keep.z + Math.sin(g.bearing) * reach;
    if (inside(mainRing, gx, gz)) {
      plan.trees.push({ x: gx, z: gz, y: input.height(gx, gz), h: 16, kind: "weirwood" });
      for (let attempt = 0; attempt < g.trees * 12 && plan.trees.length < g.trees; attempt++) {
        const a = sapling() * Math.PI * 2, r = Math.sqrt(sapling()) * g.radius, x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r * 1.6;
        const h = 12 + sapling() * 10, kind = sapling() < 0.68 ? "pine" : "oak";
        if (!inside(mainRing, x, z) || polylineDistance(x, z, mainRing, true) < 14 || inKeep(x, z, 3) || nearLandmark(x, z, 4)) continue;
        if (plan.trees.some(t => Math.hypot(t.x - x, t.z - z) < (t.kind == "weirwood" ? 12 : 7))) continue;
        plan.trees.push({ x, z, y: input.height(x, z), h, kind });
      }
    }
  }
  const inGrove = (x: number, z: number, r: number): boolean => plan.trees.some(t => Math.hypot(t.x - x, t.z - z) < (t.kind == "weirwood" ? 14 : 6) + r);

  // ---- Square and main streets: gate → square → keep (and landmarks).
  const hub = yield* square();
  plan.hub = hub;
  if (hub) {
    // The market square: one level of flags inside SQUARE m of the hub, on dry
    // ground clear of everything, terraced into the slope: the level is the
    // 70th-percentile ground; no flag where the ground would cover it, nor
    // where its edge would stand more than 3 m over the ground.
    const flags: { x: number; z: number; low: number; high: number }[] = [];
    for (let u = -SQUARE; u <= SQUARE; u += 8) for (let v = -SQUARE; v <= SQUARE; v += 8) {
      const x = hub[0] + u, z = hub[1] + v;
      if (Math.hypot(u, v) > SQUARE || !inArea(x, z) || wet(x, z) || inKeep(x, z, 4) || nearLandmark(x, z, 2) || reserved(x, z, 2)) continue;
      const ground = seat(x, z, 4, 4, 0);
      flags.push({ x, z, low: ground.y - ground.foundation + 0.6, high: ground.y });
    }
    const highs = flags.map(f => f.high).sort((p, q) => p - q);
    const level = (highs[Math.floor(highs.length * 0.7)] ?? 0) + 0.15;
    flags.forEach(f => {
      if (f.high > level || f.low < level - 3) return;
      plan.paving.push({ x: f.x, z: f.z, y: level, yaw: 0, length: 8.05, width: 8.05, depth: level - f.low + 0.6 });
    });
    plan.gates.forEach(gate => {
      const g: Vec2 = [gate.x, gate.z], length = Math.hypot(hub[0] - g[0], hub[1] - g[1]) || 1, bend = (seeded(`${id}:${gate.name}`)() - 0.5) * 0.18 * length;
      const mid: Vec2 = [(g[0] + hub[0]) / 2 - (hub[1] - g[1]) / length * bend, (g[1] + hub[1]) / 2 + (hub[0] - g[0]) / length * bend];
      plan.streets.push({ points: [g, mid, hub], width: recipe.street });
    });
    if (keep) plan.streets.push({ points: [hub, keepAt], width: recipe.street + 1 });
    plan.landmarks.forEach(l => { if (!wet(l.x, l.z)) plan.streets.push({ points: [hub, [l.x, l.z]], width: recipe.street * 0.8 }); });
  }
  yield;
  if (recipe.bridges) yield* bridges(recipe.bridges);

  /**
   * Bridges over the rivers and inlets inside the city: the shortest crossing
   * (12 bearings) through water cells near a channel's centre line, banks on
   * both sides in the area; greedy by span (and nearness to a street), spaced.
   * Each bridge carries a lane: houses keep clear of its approaches.
   */
  function* bridges(rule: { span: number; every: number; max: number }): Generator<void, void, void> {
    const found: { x: number; z: number; a: Vec2; b: Vec2; span: number; score: number; k: number }[] = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (dist[k] > 0 || landDist[k] > rule.span / 2) continue;
        const x = x0 + i * GRID, z = z0 + j * GRID;
        if (!inArea(x, z) || !insideMain(x, z)) continue;
        let best: { a: Vec2; b: Vec2; span: number } | undefined;
        for (let n = 0; n < 12; n++) {
          const t = n * Math.PI / 12, dx = Math.cos(t), dz = Math.sin(t);
          const reach = (sign: number): number => { for (let d = 4; d <= rule.span; d += 4) if (!wet(x + dx * d * sign, z + dz * d * sign)) return d; return Infinity; };
          const p = reach(1), q = reach(-1);
          if (p + q > rule.span || Math.abs(p - q) > 16) continue;
          // A channel, not a notch of the coast: water runs on along it both ways.
          if (![1, -1].every(sign => [20, 40].every(d => wet(x - dz * d * sign, z + dx * d * sign)))) continue;
          if (!best || p + q < best.span) best = { a: [x + dx * (p + 6), z + dz * (p + 6)], b: [x - dx * (q + 6), z - dz * (q + 6)], span: p + q };
        }
        if (!best || !inArea(...best.a) || !inArea(...best.b)) continue;
        if ([best.a, best.b].some(([px, pz]) => inKeep(px, pz, 6) || nearLandmark(px, pz, 6) || reserved(px, pz, 6))) continue;
        found.push({ x, z, ...best, score: best.span + Math.min(200, streetDistanceAt(x, z)) * 0.25, k });
      }
      if (due()) yield;
    }
    found.sort((p, q) => p.score - q.score || p.k - q.k);
    const chosen: typeof found = [];
    for (const f of found) {
      if (chosen.length >= rule.max) break;
      if (chosen.some(c => Math.hypot(c.x - f.x, c.z - f.z) < rule.every)) continue;
      const ha = input.height(...f.a), hb = input.height(...f.b);
      if (Math.abs(ha - hb) > 8) continue;
      chosen.push(f);
      const deck = Math.max(ha, hb) + 0.8, sea = Math.min(input.height(f.x, f.z), ha, hb);
      const yaw = Math.atan2(f.a[0] - f.b[0], f.a[1] - f.b[1]);
      const length = Math.hypot(f.a[0] - f.b[0], f.a[1] - f.b[1]) + 6;
      plan.bridges.push({ x: (f.a[0] + f.b[0]) / 2, z: (f.a[1] + f.b[1]) / 2, y: deck, yaw, length, width: 8, depth: deck - sea + 3 });
      const ux = (f.a[0] - f.b[0]) / length, uz = (f.a[1] - f.b[1]) / length;
      plan.streets.push({ points: [[f.b[0] - ux * 24, f.b[1] - uz * 24], [f.a[0] + ux * 24, f.a[1] + uz * 24]], width: 9 });
    }
  }

  function* square(): Generator<void, Vec2 | undefined, void> {
    const ring = mainRing ?? area, centre = centroid(ring);
    let best: Vec2 | undefined, score = Infinity;
    const rx = ring.map(p => p[0]), rz = ring.map(p => p[1]), zMin = Math.min(...rz), zMax = Math.max(...rz);
    for (let x = Math.min(...rx); x <= Math.max(...rx); x += 20) for (let z = zMin; z <= zMax; z += 20) {
      if (z == zMin && due()) yield;
      if (!inside(ring, x, z) || !inArea(x, z) || shoreDistance(x, z) < 40 || inKeep(x, z, 30) || nearLandmark(x, z, 30) || reserved(x, z, 30)) continue;
      if (rings.length && polylineDistance(x, z, rings[0].points, true) < 50) continue;
      const value = Math.hypot(x - centre[0], z - centre[1]) + Math.hypot(x - keepAt[0], z - keepAt[1]) * 0.4;
      if (value < score) { score = value; best = [x, z]; }
    }
    return best;
  }
  function streetDistanceAt(x: number, z: number): number { return plan.streets.reduce((best, street) => Math.min(best, polylineDistance(x, z, street.points) - street.width / 2), Infinity); }
  const streetDistance = (x: number, z: number): number => plan.streets.reduce((best, street) => Math.min(best, polylineDistance(x, z, street.points) - street.width / 2), Infinity);

  // ---- Harbor: quay strips on the shore, piers into the water.
  if (recipe.harbor) {
    const harbor = recipe.harbor;
    const shore: { x: number; z: number; out: Vec2 }[] = [], cliffs: { x: number; z: number; out: Vec2; top: number; sea: number }[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (i == 0 && due()) yield;
      const x = x0 + i * GRID, z = z0 + j * GRID, d = dist[j * nx + i];
      if (d <= 0 || d > GRID * 1.05 || !inArea(x, z) || inKeep(x, z, 4) || nearLandmark(x, z, 4) || reserved(x, z, 6)) continue;
      // No quay at the foot of a cliff: the bank must be low over the sea.
      const out = seaward(x, z), sea = input.height(x + out[0] * GRID * 2, z + out[1] * GRID * 2);
      if (input.height(x, z) - sea > 9) {
        if (harbor.stairs && input.height(x, z) - sea <= 70) cliffs.push({ x, z, out, top: input.height(x, z), sea });
        continue;
      }
      shore.push({ x, z, out });
    }
    shore.forEach(cell => {
      const ground = seat(cell.x, cell.z, GRID / 2, harbor.quay / 2, Math.atan2(cell.out[0], cell.out[1]));
      // A stone quay at the waterline: the deck sits 1.6 m over the sea (or bank).
      // Decks run level along the waterline: 1.8 m over the sea surface.
      const sea = input.height(cell.x + cell.out[0] * GRID * 1.5, cell.z + cell.out[1] * GRID * 1.5);
      const deck = sea + 1.8;
      plan.quays.push({ x: cell.x, z: cell.z, y: deck, yaw: Math.atan2(cell.out[0], cell.out[1]), length: GRID * 1.6, width: harbor.quay, depth: deck - Math.min(sea, ground.y - ground.foundation) + 3 });
    });
    yield;
    // High banks: a stone quay along the foot and a stair down every `stairs` m.
    const flights: Vec2[] = [];
    cliffs.forEach(c => {
      const fx = c.x + c.out[0] * GRID * 1.2, fz = c.z + c.out[1] * GRID * 1.2;
      if (!wet(fx, fz)) return;
      const deck = c.sea + 1.8;
      plan.quays.push({ x: fx, z: fz, y: deck, yaw: Math.atan2(c.out[0], c.out[1]), length: GRID * 1.6, width: harbor.quay, depth: 6 });
      if (!harbor.stairs || flights.some(([x, z]) => Math.hypot(x - c.x, z - c.z) < (harbor.stairs ?? 0))) return;
      flights.push([c.x, c.z]);
      const run = Math.min(48, (c.top - deck) * 1.15 + 4);
      // The flight runs along the bank (a ramp on the cliff face), not out to sea.
      const along: Vec2 = [-c.out[1], c.out[0]];
      plan.stairs.push({ x: c.x + c.out[0] * GRID * 0.6 + along[0] * run / 2, z: c.z + c.out[1] * GRID * 0.6 + along[1] * run / 2, yaw: Math.atan2(along[0], along[1]), top: c.top, bottom: deck, length: run, width: 6 });
    });
    const used: Vec2[] = [];
    shore.forEach(cell => {
      if (used.some(([x, z]) => Math.hypot(x - cell.x, z - cell.z) < harbor.pierEvery)) return;
      const tx = cell.x + cell.out[0] * harbor.pierLength, tz = cell.z + cell.out[1] * harbor.pierLength;
      if (!input.water(tx, tz) || !input.water(cell.x + cell.out[0] * harbor.pierLength * 0.5, cell.z + cell.out[1] * harbor.pierLength * 0.5)) return;
      used.push([cell.x, cell.z]);
      const sea = input.height(tx, tz);
      plan.piers.push({ x: (cell.x + tx) / 2, z: (cell.z + tz) / 2, y: sea + 1.5, yaw: Math.atan2(cell.out[0], cell.out[1]), length: harbor.pierLength, width: 6, depth: 6 });
    });

  }
  const onQuay = (x: number, z: number, r: number): boolean => !!recipe.harbor && shoreDistance(x, z) < recipe.harbor.quay + r + 2;

  // ---- Houses: rotated lot grids per district, ranked; districts claim lots in recipe order.
  const occupied = new Map<string, { x: number; z: number; r: number }[]>();
  const cell = (x: number, z: number): string => `${Math.floor(x / 20)}:${Math.floor(z / 20)}`;
  const ranked: { house: PlannedHouse; score: number }[] = [];
  const classify = (x: number, z: number): DistrictRecipe | undefined => recipe.districts.find(d => matches(d, x, z));
  // Coarse district mask on the lattice: a lot whose grid centre lies two
  // cells deep in another district (or outside the area) is skipped before
  // any seeded draw; the exact test runs on the jittered lot.
  const mask = new Int8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * GRID, z = z0 + j * GRID;
      mask[j * nx + i] = inArea(x, z) ? recipe.districts.indexOf(classify(x, z) as DistrictRecipe) : -1;
      if ((i & 31) == 31 && due()) yield;
    }
    if (due()) yield;
  }
  const maybe = (index: number, x: number, z: number): boolean => {
    const i = Math.round((x - x0) / GRID), j = Math.round((z - z0) / GRID);
    for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) {
      const ii = i + u, jj = j + v;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && mask[jj * nx + ii] == index) return true;
    }
    return false;
  };
  for (const district of recipe.districts) yield* houses(district);
  plan.candidates = ranked.length;
  ranked.sort((a, b) => b.score - a.score);
  plan.houses = ranked.slice(0, recipe.houses[input.tier == "high" ? "high" : "balanced"]).map(entry => entry.house);

  // ---- Palisade round the placed outside town (Winter Town).
  const palisade = recipe.curtains.find(c => c.palisade);
  if (palisade) {
    const index = recipe.curtains.indexOf(palisade);
    const town = plan.houses.filter(h => recipe.districts.find(d => d.id == h.district && "outside" in d.rule));
    if (town.length >= 10) {
      const pad = 14, hug = 40;
      const corners: Vec2[] = town.flatMap(h => Array.from({ length: 8 }, (_, k) => [h.x + Math.cos(k * Math.PI / 4) * (Math.hypot(h.w, h.d) / 2 + pad), h.z + Math.sin(k * Math.PI / 4) * (Math.hypot(h.w, h.d) / 2 + pad)] as Vec2));
      const hull = convexHull(corners);
      const points = hull.length > 4 ? simplifyPolygon(hull, 30, 6) : hull;
      // Spatial hash of the placed houses (20 m cells) for the stake tests.
      const homes = new Map<string, PlannedHouse[]>();
      plan.houses.forEach(h => { const key = cell(h.x, h.z), list = homes.get(key); if (list) list.push(h); else homes.set(key, [h]); });
      const townIds = new Set(town);
      const nearby = (x: number, z: number, reach: number, test: (h: PlannedHouse) => boolean): boolean => {
        const ci = Math.floor(x / 20), cj = Math.floor(z / 20), n = Math.ceil(reach / 20);
        for (let u = -n; u <= n; u++) for (let v = -n; v <= n; v++) if ((homes.get(`${ci + u}:${cj + v}`) ?? []).some(test)) return true;
        return false;
      };
      const accept = (x: number, z: number): boolean => inArea(x, z) && shoreDistance(x, z) > 4 && outsideOuter(x, z) && ringClear(x, z, 4) && !reserved(x, z, 2)
        && nearby(x, z, pad + hug + 12, h => townIds.has(h) && Math.hypot(x - h.x, z - h.z) < Math.hypot(h.w, h.d) / 2 + pad + hug)
        && !nearby(x, z, 12, h => Math.hypot(x - h.x, z - h.z) < Math.hypot(h.w, h.d) / 2 + 3);
      yield;
      if (points.length >= 3) yield* placeRing(palisade, points, index, true, accept);
    }
  }
  return plan;

  function matches(d: DistrictRecipe, x: number, z: number): boolean {
    const rule = d.rule;
    if ("outside" in rule) {
      const distance = Math.hypot(x - keepAt[0], z - keepAt[1]);
      if (!outsideOuter(x, z) || distance < rule.outside || distance > (rule.max ?? Infinity)) return false;
      return rule.bearing == undefined || Math.cos(Math.atan2(z - keepAt[1], x - keepAt[0]) - rule.bearing) > Math.cos(rule.spread ?? Math.PI);
    }
    if (!insideMain(x, z)) return false;
    if ("keep" in rule) {
      const dx = x - keepAt[0], dz = z - keepAt[1], distance = Math.hypot(dx, dz);
      return distance >= rule.keep[0] && distance < rule.keep[1]
        && (rule.bearing == undefined || Math.cos(Math.atan2(dz, dx) - rule.bearing) > Math.cos(rule.spread ?? Math.PI));
    }
    if ("castle" in rule) { const distance = Math.hypot(x - castleAt[0], z - castleAt[1]); return distance >= rule.castle[0] && distance < rule.castle[1]; }
    if ("landmark" in rule) return plan.landmarks.some(l => l.kind == rule.landmark && Math.hypot(x - l.x, z - l.z) < rule.radius);
    if ("shore" in rule) return shoreDistance(x, z) < rule.shore;
    return true;
  }

  function* houses(district: DistrictRecipe): Generator<void, void, void> {
    if (district.flow) { yield* flowHouses(district); return; }
    const index = recipe.districts.indexOf(district);
    let theta = typeof district.angle == "number" ? district.angle : 0;
    if (district.angle == "shore") {
      // Rows parallel to the shore: the mean seaward direction over the band.
      let sx = 0, sz = 0;
      for (let j = 0; j < nz; j += 3) for (let i = 0; i < nx; i += 3) {
        const x = x0 + i * GRID, z = z0 + j * GRID, d = dist[j * nx + i];
        if (d <= 0 || d > 160 || !inArea(x, z)) continue;
        const out = seaward(x, z);
        // Axial mean (a shore curving round a bay keeps its dominant axis).
        const a = Math.atan2(out[1], out[0]) * 2;
        sx += Math.cos(a); sz += Math.sin(a);
      }
      theta = Math.atan2(sz, sx) / 2 + Math.PI / 2;
    }
    const c = Math.cos(theta), s = Math.sin(theta);
    const along = (x: number, z: number): number => x * c + z * s, across = (x: number, z: number): number => -x * s + z * c;
    const as = area.map(([x, z]) => along(x, z)), cs = area.map(([x, z]) => across(x, z));
    const [lw, ld] = district.lot, [bc, br] = district.block;
    // Party walls along a row (gap); rows are a yard apart (2 × gap + 2 m).
    const pitchA = lw + district.gap, pitchC = ld + district.gap * 2 + 2;
    const minA = Math.min(...as), maxA = Math.max(...as), minC = Math.min(...cs), maxC = Math.max(...cs);
    let tested = 0;
    for (let j = 0; ; j++) {
      const rowC = minC + j * pitchC + Math.floor(j / br) * district.lane + ld / 2;
      if (rowC > maxC) break;
      // Back-to-back rows: each faces its own lane.
      const facing = br > 1 && j % br == 0 ? Math.PI : 0;
      for (let i = 0; ; i++) {
        const cellA = minA + i * pitchA + Math.floor(i / bc) * district.lane + lw / 2;
        if (cellA > maxA) break;
        if (!maybe(index, cellA * c - rowC * s, cellA * s + rowC * c)) continue;
        if ((++tested & 7) == 0 && due()) yield;
        const random = seeded(`${id}:${district.id}:${i}:${j}`);
        const draws = lotDraws(random);
        if (draws.roll > district.density) continue;
        const a = cellA + draws.jitterA * (district.gap + lw * district.jitter * 0.5), cc = rowC + draws.jitterC * (district.gap + ld * district.jitter * 0.5);
        lot(district, a * c - cc * s, a * s + cc * c, theta, facing, draws, `${district.id}:${Math.floor(i / bc)}:${Math.floor((i % bc) / 3)}:${j}`);
      }
    }
  }

  /**
   * Organic districts (round 2): rows run along iso-lines of a distance field
   * — to the water (quays, river banks, terraces over a harbour), to the
   * castle (a town under its walls) or the nearer of both — bent by a seeded
   * domain warp, so streets wind with the shore and the river. Blocks are
   * irregular runs of lots split by alleys; some blocks stay open as squares.
   */
  function* flowHouses(district: DistrictRecipe): Generator<void, void, void> {
    const flow = district.flow as FlowRecipe, index = recipe.districts.indexOf(district);
    const warp = valueNoise(`${id}:${district.id}:warp`), wobble = valueNoise(`${id}:${district.id}:wobble`);
    const [cx, cz] = castleAt;
    const field = new Float32Array(nx * nz);
    let low = Infinity, high = -Infinity, i0 = nx, i1 = 0, j0 = nz, j1 = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * GRID, z = z0 + j * GRID, k = j * nx + i;
        const keepDistance = Math.hypot(x - cx, z - cz) * (flow.stretch ?? 1);
        let f = flow.field == "shore" ? dist[k] : flow.field == "keep" ? keepDistance : Math.min(dist[k], keepDistance);
        f += flow.warp * (warp(x / flow.wavelength, z / flow.wavelength) * 2 - 1) + flow.warp * 0.15 * (wobble(x / (flow.wavelength * 0.4), z / (flow.wavelength * 0.4)) * 2 - 1);
        field[k] = f;
        if (mask[k] == index) { low = Math.min(low, f); high = Math.max(high, f); i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
        if ((i & 63) == 63 && due()) yield;
      }
      if (due()) yield;
    }
    if (!Number.isFinite(low)) return;
    const [lw, ld] = district.lot, br = district.block[1];
    const pitchA = lw + district.gap, pitchC = ld + district.gap * 2 + 2;
    const gradient = (x: number, z: number): Vec2 => {
      const fi = Math.max(0, Math.min(nx - 2, Math.round((x - x0) / GRID))), fj = Math.max(0, Math.min(nz - 2, Math.round((z - z0) / GRID)));
      const k = fj * nx + fi;
      return [field[k + 1] - field[k], field[k + nx] - field[k]];
    };
    let tested = 0;
    // Rows, then an infill pass half a row out: where the warp stretched the
    // rows apart, a third row fits; elsewhere the spacing test refuses it.
    for (let pass = 0; pass < 2; pass++) for (let j = 0; ; j++) {
      const level = low + ld / 2 + 1 + j * pitchC + Math.floor(j / br) * district.lane + pass * pitchC / 2;
      if (level > high + ld) break;
      // Back-to-back rows: the first of a pair faces down the field, the rest up.
      const up = !(br > 1 && j % br == 0);
      // Only the district's own cells (+ the 2-cell `maybe` reach) are traced.
      const lines = isolines(field, nx, nz, level, [Math.max(0, i0 - 3), Math.max(0, j0 - 3), Math.min(nx - 1, i1 + 3), Math.min(nz - 1, j1 + 3)]);
      yield;
      for (let p = 0; p < lines.length; p++) {
        const line = lines[p].map(([fi, fj]) => [x0 + fi * GRID, z0 + fj * GRID] as Vec2);
        const lengths = [0];
        for (let k = 1; k < line.length; k++) lengths.push(lengths[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
        const total = lengths[lengths.length - 1];
        if (total < pitchA * 2) continue;
        const at = (s: number): Vec2 => {
          s = Math.max(0, Math.min(total, s));
          let k = 1;
          while (k < lengths.length - 1 && lengths[k] < s) k++;
          const t = (s - lengths[k - 1]) / Math.max(1e-6, lengths[k] - lengths[k - 1]);
          return [line[k - 1][0] + (line[k][0] - line[k - 1][0]) * t, line[k - 1][1] + (line[k][1] - line[k - 1][1]) * t];
        };
        const runs = seeded(`${id}:${district.id}:runs:${pass}:${j}:${p}`);
        let s = runs() * pitchA, block = 0;
        while (s < total) {
          const count = flow.run[0] + Math.floor(runs() * (flow.run[1] - flow.run[0] + 1));
          const open = runs() < (flow.squares ?? 0);
          for (let n = 0; n < count && s < total; n++, s += pitchA) {
            if (open) continue;
            const [px, pz] = at(s);
            if (!maybe(index, px, pz)) continue;
            if ((++tested & 7) == 0 && due()) yield;
            const random = seeded(`${id}:${district.id}:${pass}:${j}:${p}:${block}:${n}`);
            const draws = lotDraws(random);
            if (draws.roll > district.density) continue;
            // Tangent over ±1½ lots smooths the 10 m lattice steps.
            const a = at(s - pitchA * 1.5), b = at(s + pitchA * 1.5);
            let theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
            const g = gradient(px, pz), door: Vec2 = [-Math.sin(theta), Math.cos(theta)];
            if ((door[0] * g[0] + door[1] * g[1] > 0) != up) theta += Math.PI;
            const ja = draws.jitterA * (district.gap + lw * district.jitter * 0.5), jc = draws.jitterC * (district.gap + ld * district.jitter * 0.5);
            const x = px + Math.cos(theta) * ja - Math.sin(theta) * jc, z = pz + Math.sin(theta) * ja + Math.cos(theta) * jc;
            lot(district, x, z, theta, 0, draws, `${district.id}:${pass}:${j}:${p}:${block}:${Math.floor(n / 3)}`, pass ? pitchC * 0.85 : 0);
          }
          s += district.lane;
          block++;
        }
      }
    }
  }

  /** Tests and records one lot; `spacing` > 0 (infill) also keeps that far from every placed house. */
  function lot(district: DistrictRecipe, x: number, z: number, theta: number, facing: number, draws: LotDraws, block: string, spacing = 0): void {
    const { pick, size, tall, tint, roofPick, rank, turn, finish } = draws;
    const [lw, ld] = district.lot;
    const families = Object.entries(district.families) as [HouseFamily, number][];
    const total = families.reduce((sum, [, weight]) => sum + weight, 0);
    if (!inArea(x, z)) return;
    let family = families[0][0];
    for (let k = 0, sum = 0; k < families.length; k++) { sum += families[k][1] / total; if (pick <= sum) { family = families[k][0]; break; } }
    const long = family == "turf-long" || family == "hall";
    const w = Math.min(lw * (long ? 1.25 : 0.84 + size * 0.14), lw + district.gap * 0.6), d = ld * (0.84 + size * 0.12);
    const h = district.height[0] + (district.height[1] - district.height[0]) * tall * (family == "tower-house" ? 1.4 : 1);
    const r = Math.hypot(w, d) / 2, core = Math.min(w, d) / 2;
    const reject = (reason: string): void => { plan.rejects[reason] = (plan.rejects[reason] ?? 0) + 1; plan.rejects[`${district.id}:${reason}`] = (plan.rejects[`${district.id}:${reason}`] ?? 0) + 1; };
    if (classify(x, z) != district) { reject("district"); return; }
    if (polylineDistance(x, z, area, true) < r * 0.6 || shoreDistance(x, z) < r + 1) { reject("edge"); return; }
    if (inKeep(x, z, r) || nearLandmark(x, z, r) || reserved(x, z, r) || onQuay(x, z, r) || inMoat(x, z, r) || inGrove(x, z, r)) { reject("reserved"); return; }
    if (!ringClear(x, z, r)) { reject("curtain"); return; }
    if (gateCentres.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < 22 + r)) { reject("gate"); return; }
    if (hub && Math.hypot(x - hub[0], z - hub[1]) < SQUARE + r) { reject("square"); return; }
    const street = streetDistance(x, z);
    if (street < r * 0.7) { reject("street"); return; }
    const key = cell(x, z), [cx, cz] = key.split(":").map(Number);
    let clash = false;
    // Terraces share party walls: lots clash only when their cores overlap
    // (districts meeting at a band edge with different grid angles).
    for (let u = -1; u <= 1 && !clash; u++) for (let v = -1; v <= 1 && !clash; v++) clash = (occupied.get(`${cx + u}:${cz + v}`) ?? []).some(o => Math.hypot(o.x - x, o.z - z) < Math.max((o.r + core) * 0.95, spacing));
    if (clash) { reject("clash"); return; }
    // Door toward its lane: yaw turns local +Z onto the row's facing side.
    const yaw = -theta + facing + turn * district.jitter * 2;
    const ground = seat(x, z, w / 2, d / 2, yaw, h * 0.25);
    // Hillside terraces: a stone base up to half the eave (≥ 3.5 m); taller reads as stilts.
    if (ground.plinth > Math.max(3.5, h * 0.5)) { reject("slope"); return; }
    const palette = recipe.palette;
    const stone = finish < (district.masonry ?? palette.masonry ?? 0);
    const plaster = stone && palette.walls ? palette.walls : palette.plaster, roofs = palette.roofs[family] ?? Object.values(palette.roofs)[0] ?? ["#7b6a5a"];
    const house: PlannedHouse = {
      x, z, y: ground.y, yaw, w, d, h, family, foundation: ground.foundation,
      wall: shade(rgb(plaster[Math.floor(tint * plaster.length)]), 0.92 + size * 0.12),
      roof: shade(rgb(roofs[Math.floor(roofPick * roofs.length)]), 0.88 + tall * 0.18),
      ridge: family == "turf-long" ? 0.95 : family == "gable-steep" ? (palette.pitch ? palette.pitch[0] + (palette.pitch[1] - palette.pitch[0]) * size : 0.72 + size * 0.2) : family == "hall" ? 0.6 : family == "court" ? 0.34 : 0.3 + size * 0.06,
      dome: family == "flat-dome" && rank > 1 - (palette.domes ?? 0.28),
      finish: palette.masonry == undefined && district.masonry == undefined ? undefined : stone ? "stone" : "plaster",
      // Far roofscape: one block per ≤ 3 neighbouring lots of a row.
      district: district.id, block
    };
    const distant = recipe.distantPalette;
    if (distant) {
      const masonry = finish < (district.masonry ?? distant.masonry ?? 0);
      const walls = masonry && distant.walls ? distant.walls : distant.plaster;
      const shades = distant.roofs[family] ?? Object.values(distant.roofs)[0] ?? ["#7b6a5a"];
      house.distantWall = shade(rgb(walls[Math.floor(tint * walls.length)]), 0.92 + size * 0.12);
      house.distantRoof = shade(rgb(shades[Math.floor(roofPick * shades.length)]), 0.88 + tall * 0.18);
    }
    const list = occupied.get(key);
    if (list) list.push({ x, z, r: core }); else occupied.set(key, [{ x, z, r: core }]);
    ranked.push({ house, score: district.priority + (street < 14 ? 0.3 : 0) + rank * 0.35 - (spacing ? 0.1 : 0) });
  }
}

interface LotDraws { roll: number; pick: number; jitterA: number; jitterC: number; size: number; tall: number; tint: number; roofPick: number; rank: number; turn: number; finish: number }

/** One lot's seeded draws, in the round-1 order (extra draws go last). */
function lotDraws(random: () => number): LotDraws {
  const roll = random(), pick = random(), jitterA = random() - 0.5, jitterC = random() - 0.5, size = random(), tall = random(), tint = random(), roofPick = random(), rank = random(), turn = random() - 0.5;
  return { roll, pick, jitterA, jitterC, size, tall, tint, roofPick, rank, turn, finish: random() };
}

/** Smooth seeded value noise in [0, 1] (two lattice octaves are mixed by the caller). */
function valueNoise(key: string): (x: number, z: number) => number {
  const base = seeded(key)() * 4294967296 | 0;
  const lattice = (i: number, j: number): number => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + base) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = lattice(i, j), b = lattice(i + 1, j), c = lattice(i, j + 1), d = lattice(i + 1, j + 1);
    return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
  };
}

/**
 * Iso-lines of `field` (nx × nz lattice) at `level` inside `bounds` (cell
 * range i0, j0, i1, j1), marching squares with the saddle split by the cell
 * mean; segments chained into polylines in lattice coordinates.
 * Deterministic: cells and chains in index order.
 */
export function isolines(field: Float32Array, nx: number, nz: number, level: number, bounds: [number, number, number, number] = [0, 0, nx - 1, nz - 1]): Vec2[][] {
  const points = new Map<number, Vec2>();
  const links = new Map<number, number[]>();
  const point = (edge: number): void => {
    if (points.has(edge)) return;
    const vertical = edge & 1, cellIndex = edge >> 1, i = cellIndex % nx, j = Math.floor(cellIndex / nx);
    const a = field[j * nx + i], b = vertical ? field[(j + 1) * nx + i] : field[j * nx + i + 1];
    const t = Math.max(0, Math.min(1, (level - a) / ((b - a) || 1e-6)));
    points.set(edge, vertical ? [i, j + t] : [i + t, j]);
  };
  const link = (p: number, q: number): void => {
    point(p); point(q);
    const lp = links.get(p), lq = links.get(q);
    if (lp) lp.push(q); else links.set(p, [q]);
    if (lq) lq.push(p); else links.set(q, [p]);
  };
  const [bi0, bj0, bi1, bj1] = bounds;
  for (let j = bj0; j < Math.min(bj1, nz - 1); j++) for (let i = bi0; i < Math.min(bi1, nx - 1); i++) {
    const a = field[j * nx + i], b = field[j * nx + i + 1], c = field[(j + 1) * nx + i + 1], d = field[(j + 1) * nx + i];
    const code = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
    if (code == 0 || code == 15) continue;
    const bottom = (j * nx + i) * 2, top = ((j + 1) * nx + i) * 2, left = (j * nx + i) * 2 + 1, right = (j * nx + i + 1) * 2 + 1;
    const centre = (a + b + c + d) / 4 > level;
    switch (code) {
      case 1: case 14: link(left, bottom); break;
      case 2: case 13: link(bottom, right); break;
      case 3: case 12: link(left, right); break;
      case 4: case 11: link(right, top); break;
      case 6: case 9: link(bottom, top); break;
      case 7: case 8: link(left, top); break;
      case 5: if (centre) { link(left, top); link(bottom, right); } else { link(left, bottom); link(right, top); } break;
      case 10: if (centre) { link(left, bottom); link(right, top); } else { link(left, top); link(bottom, right); } break;
    }
  }
  const used = new Set<number>(), lines: Vec2[][] = [];
  const edges = Array.from(links.keys()).sort((p, q) => p - q);
  const walk = (start: number): void => {
    const chain = [start];
    used.add(start);
    for (let current = start; ;) {
      const next = (links.get(current) ?? []).find(e => !used.has(e));
      if (next == undefined) break;
      used.add(next); chain.push(next); current = next;
    }
    lines.push(chain.map(e => points.get(e) as Vec2));
  };
  // Open chains from their ends first, then closed loops.
  edges.forEach(e => { if (!used.has(e) && (links.get(e)?.length ?? 0) == 1) walk(e); });
  edges.forEach(e => { if (!used.has(e)) walk(e); });
  return lines;
}

function outlineMargin(curtain: CurtainRecipe): number { return "keep" in curtain.outline ? curtain.outline.keep : 0; }

/**
 * The host region inside an oval of the recipe radius round the centre (local
 * metres). The oval (0.72 aspect) takes the orientation of 8 that holds the
 * most dry ground, so a walled town follows its coast instead of a compass
 * circle. Deterministic (fixed sampling).
 */
export function cityArea(boundary: Vec2[], radius: number, water?: (x: number, z: number) => boolean): Vec2[] {
  const steps = cityAreaSteps(boundary, radius, water);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/** `cityArea` in resumable steps: one orientation per step (≈ 600 water samples each). */
function* cityAreaSteps(boundary: Vec2[], radius: number, water?: (x: number, z: number) => boolean): Generator<void, Vec2[], void> {
  const oval = (angle: number): Vec2[] => Array.from({ length: 48 }, (_, i) => {
    const t = i / 48 * Math.PI * 2, x = Math.cos(t) * radius, z = Math.sin(t) * radius * 0.72;
    return [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
  });
  let best: Vec2[] = [], score = -1;
  for (let k = 0; k < 8; k++) {
    const clipped = clipConvex(boundary, oval(k * Math.PI / 8));
    if (clipped.length < 3) continue;
    let dry = 0;
    const step = radius / 12;
    for (let x = -radius; x <= radius; x += step) for (let z = -radius; z <= radius; z += step) if (inside(clipped, x, z) && !water?.(x, z)) dry++;
    if (dry > score) { score = dry; best = clipped; }
    yield;
  }
  return best;
}

export function centroid(points: Vec2[]): Vec2 {
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
}

/** Chamfer distance (m) from the zero cells, one pass (forward, then backward); 8-neighbour weights. */
function chamfer(d: Float32Array, nx: number, nz: number, forward: boolean): void {
  const a = GRID, b = GRID * Math.SQRT2;
  if (forward) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + a);
    if (j > 0) {
      v = Math.min(v, d[k - nx] + a);
      if (i > 0) v = Math.min(v, d[k - nx - 1] + b);
      if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b);
    }
    d[k] = v;
  }
  else for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    let v = d[k];
    if (i < nx - 1) v = Math.min(v, d[k + 1] + a);
    if (j < nz - 1) {
      v = Math.min(v, d[k + nx] + a);
      if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b);
      if (i > 0) v = Math.min(v, d[k + nx - 1] + b);
    }
    d[k] = v;
  }
}

/** Splits a closed ring walk (undefined = gap) into runs; keeps those `keep` accepts. */
function keepRuns(walk: (PlannedPiece | undefined)[], keep: (run: PlannedPiece[]) => boolean): PlannedPiece[] {
  const runs: PlannedPiece[][] = [];
  let current: PlannedPiece[] = [];
  walk.forEach(entry => {
    if (entry) current.push(entry);
    else if (current.length) { runs.push(current); current = []; }
  });
  if (current.length) runs.push(current);
  if (runs.length > 1 && walk[0] && walk[walk.length - 1]) runs[0] = [...(runs.pop() ?? []), ...runs[0]];
  return runs.filter(keep).flat();
}

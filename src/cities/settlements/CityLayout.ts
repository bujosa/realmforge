import { CityLayoutSpec, DistrictSpec, HouseVariant, houseVariants, LandmarkKind, PalisadeSpec, RegionFitSpec } from "../../presets/cityLayouts";
import { convexHull, exclusionClearance, exclusionState, inside, insetPolygon, polygonArea, polylineDistance, seeded, simplifyPolygon } from "./plane";
import { CityExclusion, CityFrame, CityOptions, CityTier, Vec2 } from "./types";
import { gateSpan, HouseKit, houseKits, kitBits, roofPitch, towerSize, wallHeight, wallLength, wallThickness } from "./CityKit";

// Pure, deterministic city plan: same spec, frame, options and exclusions give
// the same placements. Output XZ is relative to frame.center; Y is absolute
// world height. `depth` is the skirt depth in instance-local units.
//
// Two modes. Authored: the normalized plan in layouts.ts is placed by the
// frame (the northern seat, and the capital in standalone previews). Region fit
// (`spec.regionFit` with a real region polygon): the curtain follows the land
// borders inside the region, quays face open water, districts are bands by
// distance from the keep, and landmarks take the best clear ground. Either way
// nothing is placed outside `options.boundary` or in water, and short wall
// runs, lone gatehouses and towers without a curtain are dropped. A palisade
// (Winter Town) is laid out last, around the houses actually placed.

export interface Placement {
  x: number; y: number; z: number;
  yaw: number;
  sx: number; sy: number; sz: number;
  depth: number;
  wall: [number, number, number];
  roof: [number, number, number];
  /** Kit option bits (CityKit.kitBits). */
  mask: number;
  /** Roof pitch multiplier (1 = nominal kit ridge). */
  pitch: number;
}

export interface HousePlacement extends Placement {
  variant: HouseVariant;
  kit: HouseKit;
  block: string;
  /** World footprint, wall height and ridge after scaling, for far skylines. */
  w: number; d: number; h: number; ridge: number;
}

export interface GatePlacement extends Placement { name: string; outward: Vec2 }
export interface Strip { x: number; y: number; z: number; yaw: number; length: number; width: number; depth: number }
export interface LandmarkPlacement { kind: LandmarkKind; x: number; y: number; z: number; yaw: number; depth: number; reserve: number }
export interface TreePlacement { x: number; y: number; z: number; h: number; kind: "pine" | "oak" | "weirwood" }

export interface CityPlan {
  frame: CityFrame;
  houses: HousePlacement[];
  walls: Placement[];
  /** Square stone towers and palisade watch towers (mask `palisade`). */
  towers: Placement[];
  gates: GatePlacement[];
  landmarks: LandmarkPlacement[];
  trees: TreePlacement[];
  moat: Strip[];
  bridges: Strip[];
  quays: Strip[];
  piers: Strip[];
  boats: Strip[];
  keep?: { x: number; y: number; z: number; scale: number; depth: number };
  /** Candidates before the tier cap, for reporting. */
  candidates: number;
}

/** World distance a curtain may sit outside the region polygon (authored mode). */
export const boundaryTolerance = 0.03;

/**
 * Palisade fit (world units): lots closer than `link` form one town cluster;
 * clusters under `minLots` stay open. The ring runs `pad` outside the lots,
 * and a stake run more than `hug` beyond its nearest lot is dropped, so no
 * stretch ever crosses open country, a river, a road gap or the region edge.
 */
export const palisadeFit = { link: 0.07, minLots: 10, pad: 0.018, hug: 0.05, margin: 0.015 };

/** Hard per-city caps. Houses are ranked; lower tiers keep the best lots. */
export const tierCaps: Record<CityTier, { houses: number; mid: number; farBlocks: number; trees: number; boats: number }> = {
  high: { houses: 1400, mid: 900, farBlocks: 320, trees: 44, boats: 8 },
  balanced: { houses: 700, mid: 420, farBlocks: 180, trees: 26, boats: 4 },
  low: { houses: 260, mid: 260, farBlocks: 90, trees: 12, boats: 0 }
};

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16);
  // sRGB hex → linear, matching THREE.Color with the default color management.
  const linear = (c: number): number => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return [linear(value >> 16 & 255), linear(value >> 8 & 255), linear(value & 255)];
};
const shade = (color: Rgb, amount: number): Rgb => [color[0] * amount, color[1] * amount, color[2] * amount];

interface Ring {
  id: string; points: Vec2[]; height: number; thickness: number; towerEvery: number; gates: { name: string; edge: number; t: number }[]; palisade: boolean;
  /** Overrides the boundary test for every piece (palisade fit). */
  accept?: (x: number, z: number) => boolean;
}
interface District { spec: Omit<DistrictSpec, "polygon">; polygon: Vec2[]; keep?: Vec2 }
interface LandmarkSlot { kind: LandmarkKind; at: Vec2[]; yaw: number; reserve: number; height: number; soft: boolean }
interface Hill { at: Vec2; radius: number; lift: number }
interface Quay { points: Vec2[]; normals: Vec2[] }

/** Region-fit frame: centred on the region, covering it; yaw 0. */
export function regionFrame(boundary: Vec2[]): CityFrame {
  const xs = boundary.map(p => p[0]), zs = boundary.map(p => p[1]);
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  return { center, radius: Math.max(...boundary.map(p => Math.hypot(p[0] - center.x, p[1] - center.z))), yaw: 0 };
}

export function defaultFrame(spec: CityLayoutSpec, options: Pick<CityOptions, "keep" | "frame" | "boundary">): CityFrame {
  if (spec.regionFit && options.boundary?.length && !options.frame) return regionFrame(options.boundary);
  const radius = options.frame?.radius ?? spec.radius;
  const yaw = options.frame?.yaw ?? spec.yaw;
  if (options.frame?.center) return { center: options.frame.center, radius, yaw };
  const keep = options.keep ?? { x: 0, z: 0 };
  const [u, v] = spec.keepAt, cos = Math.cos(yaw), sin = Math.sin(yaw);
  return { center: { x: keep.x - radius * (u * cos + v * sin), z: keep.z - radius * (-u * sin + v * cos) }, radius, yaw };
}

export function planCity(spec: CityLayoutSpec, frame: CityFrame, options: CityOptions): CityPlan {
  const steps = planCitySteps(spec, frame, options);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/**
 * planCity in resumable steps: yields after each curtain ring, the landmark
 * and harbor pass and every row of house lots, so a caller can spread a build
 * over frames (World ×20). Draining it gives exactly planCity's plan.
 */
export function* planCitySteps(spec: CityLayoutSpec, frame: CityFrame, options: CityOptions): Generator<void, CityPlan, void> {
  // Independent streams: a lot, wall piece or grove never shifts because the
  // tier, an exclusion or another district changed what was placed before it.
  const sapling = seeded(`${spec.id}:grove`);
  const caps = tierCaps[options.tier];
  const { center, radius, yaw } = frame;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const world = ([u, v]: Vec2): Vec2 => [center.x + radius * (u * cos + v * sin), center.z + radius * (-u * sin + v * cos)];
  const height = (x: number, z: number): number => options.heightAt(x, z);
  const water = (x: number, z: number): boolean => !!options.isWater?.(x, z);
  const boundary = options.boundary?.length ? options.boundary : undefined;
  const fit = spec.regionFit && boundary ? spec.regionFit : undefined;
  const exclusions: CityExclusion[] = [...(options.exclusions ?? [])];
  const keepAt: Vec2 = options.keep ? [options.keep.x, options.keep.z] : world(spec.keepAt);
  if (options.keep?.footprint) {
    exclusions.push({ kind: "rect", x: options.keep.x, z: options.keep.z, halfWidth: options.keep.footprint[0] + 0.004, halfDepth: options.keep.footprint[1] + 0.004, halo: 0 });
  }
  const inBoundary = (x: number, z: number): boolean => !boundary || inside(boundary, x, z) || water(x, z);
  // Authored curtains, like coastal castle silhouettes, may graze the border.
  const nearBoundary = (x: number, z: number): boolean => inBoundary(x, z) || polylineDistance(x, z, boundary ?? [], true) < boundaryTolerance;
  const strictly = (x: number, z: number, margin: number): boolean => !boundary || (inside(boundary, x, z) && polylineDistance(x, z, boundary, true) >= margin);
  // Highest of the footprint samples seats the piece (less `sink`, at most half
  // the fall, dug into the uphill side); the skirt reaches the lowest. Only one
  // terrain grid shows at a time, so `plinth`, the visible foundation, is the
  // worst single grid's drop below the seat.
  const seat = (x: number, z: number, hx: number, hz: number, angle: number, extra = 0, sink = 0): { y: number; depth: number; plinth: number } => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const grids = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
      const px = x + i * hx * c + j * hz * s, pz = z - i * hx * s + j * hz * c;
      return [height(px, pz), ...(options.groundAt?.(px, pz) ?? [])];
    });
    const samples = grids.flat(), top = Math.max(...samples), bottom = Math.min(...samples);
    const y = top + extra - Math.min(sink, (top - bottom) / 2);
    const plinth = Math.max(...grids[0].map((_, k) => y - Math.min(...grids.map(grid => grid[k] ?? grid[0])))) + 0.003;
    return { y, depth: y - bottom + 0.003, plinth };
  };
  const local = (x: number, z: number): [number, number] => [x - center.x, z - center.z];
  const stone = rgb(spec.palette.stone);
  const capRoof = rgb(spec.style == "north" ? "#4e5354" : spec.palette.stone);
  const timber = rgb("#8a7560");
  const plan: CityPlan = { frame, houses: [], walls: [], towers: [], gates: [], landmarks: [], trees: [], moat: [], bridges: [], quays: [], piers: [], boats: [], candidates: 0 };

  // ---- Resolve the plan geometry in world space (authored or region fit).
  const interior = fit && boundary ? simplifyPolygon(boundary, 0.018, 0.004) : undefined;
  const centroid: Vec2 = interior ? [interior.reduce((s, p) => s + p[0], 0) / interior.length, interior.reduce((s, p) => s + p[1], 0) / interior.length] : [center.x, center.z];
  // A border point faces open water when the ground just across it is water.
  const across = (x: number, z: number, outward: Vec2, reach: number): boolean => water(x + outward[0] * reach, z + outward[1] * reach);
  const rings: Ring[] = fit && interior ? [fitRing(fit, interior)] : spec.rings.map(ring => ({
    id: ring.id, points: ring.outline.map(world), height: ring.height, thickness: ring.thickness, towerEvery: ring.towerEvery,
    gates: ring.gates, palisade: false
  }));
  const outerRing = rings[rings.length - 1], innerRing = rings[0];
  const hub: Vec2 | undefined = fit && interior ? hubPoint(rings[0].points) : undefined;
  const streets = fit ? fitStreets() : spec.streets.map(street => ({ width: street.width, points: street.points.map(world) }));
  const plazas = fit ? (hub ? [{ at: hub, radius: 0.028 }] : []) : spec.plazas.map(plaza => ({ at: world(plaza.at), radius: plaza.radius * radius }));
  const moat = !fit && spec.moat ? { points: spec.moat.outline.map(world), width: spec.moat.width } : undefined;
  const districts: District[] = fit && interior
    ? fit.districts.map(d => ({ spec: { ...d, outside: false }, polygon: rings[0].points, keep: d.keep }))
    : spec.districts.map(d => ({ spec: d, polygon: d.polygon.map(world) }));
  const slots: LandmarkSlot[] = fit && interior ? fitLandmarks(fit) : spec.landmarks.map(l => ({ kind: l.kind, at: l.at.map(world), yaw: yaw + (l.yaw ?? 0), reserve: l.reserve, height: l.height, soft: !!l.soft }));

  // ---- Walls, towers and gatehouses.
  const gateCenters: Vec2[] = [];
  for (const ring of rings) { placeRing(ring); yield; }

  function placeRing(ring: Ring): void {
    const points = ring.points, n = points.length;
    const sy = ring.height, sz = ring.thickness / wallThickness;
    const mask = ring.palisade ? kitBits.palisade : spec.stoneMask;
    const tone = ring.palisade ? timber : stone;
    // Region fit: strictly inside the region, on land, and not facing water.
    const valid = (x: number, z: number, outward: Vec2): boolean => ring.accept ? ring.accept(x, z) : fit
      ? strictly(x, z, fit.inset * 0.4) && !water(x, z) && !across(x, z, outward, fit.inset + 0.03)
      : nearBoundary(x, z);
    const walk: (Placement | undefined)[] = [];
    const ringGates: GatePlacement[] = [];
    const stations: { x: number; z: number; angle: number; key: string }[] = [];
    for (let edge = 0; edge < n; edge++) {
      const a = points[edge], b = points[(edge + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 1e-6) continue;
      let angle = -Math.atan2(dz, dx);
      const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      // Local +Z is the outer face.
      if (inside(points, mid[0] + Math.sin(angle) * 0.01, mid[1] + Math.cos(angle) * 0.01)) angle += Math.PI;
      const outward: Vec2 = [Math.sin(angle), Math.cos(angle)];
      const at = (s: number): Vec2 => [a[0] + dx * s / length, a[1] + dz * s / length];
      const gates = ring.gates.filter(gate => gate.edge == edge);
      const placed = gates.map(gate => {
        const [x, z] = at(gate.t * length);
        gateCenters.push([x, z]);
        if (!valid(x, z, outward) || exclusionState(exclusions, x, z, gateSpan / 2, wallHeight * sy * 1.5) != "free") return undefined;
        const ground = seat(x, z, gateSpan / 2, ring.thickness, angle);
        const [lx, lz] = local(x, z);
        const placement: GatePlacement = { name: gate.name, x: lx, y: ground.y, z: lz, yaw: angle, sx: 1, sy, sz: ring.palisade ? 1 : sz,
          depth: ground.depth / sy, wall: ring.palisade ? timber : stone, roof: capRoof, mask, pitch: 1, outward };
        ringGates.push(placement);
        return placement;
      });
      const cuts = [...gates.map((gate, i) => ({ from: gate.t * length - gateSpan / 2, to: gate.t * length + gateSpan / 2, gate: placed[i], end: false })),
        { from: length, to: length, gate: undefined, end: true }].sort((p, q) => p.from - q.from);
      let start = 0;
      cuts.forEach(cut => {
        const span = cut.from - start;
        if (span > 0.004) {
          const count = Math.max(1, Math.round(span / wallLength)), piece = span / count;
          for (let k = 0; k < count; k++) {
            const [x, z] = at(start + (k + 0.5) * piece);
            const ends = [at(start + k * piece + piece * 0.1), at(start + (k + 1) * piece - piece * 0.1)];
            if (!valid(x, z, outward) || ends.some(([ex, ez]) => !valid(ex, ez, outward))) { walk.push(undefined); continue; }
            const state = exclusionState(exclusions, x, z, Math.max(piece / 2, ring.thickness / 2), wallHeight * sy);
            if (state == "blocked") { walk.push(undefined); continue; }
            // Within a slot halo the curtain drops below the clear height.
            const lowered = state == "low" ? Math.min(sy, 0.5) : sy;
            const ground = seat(x, z, piece / 2, ring.thickness / 2, angle);
            const [lx, lz] = local(x, z);
            const shadeBy = 0.94 + seeded(`${ring.id}:${edge}:${start.toFixed(4)}:${k}`)() * 0.1;
            walk.push({ x: lx, y: ground.y, z: lz, yaw: angle, sx: piece / wallLength * 1.015, sy: lowered, sz: ring.palisade ? 1 : sz, depth: ground.depth / lowered,
              wall: shade(tone, shadeBy), roof: [1, 1, 1], mask, pitch: 1 });
          }
        }
        // A standing gatehouse keeps its run connected (mask -1: not a wall).
        if (!cut.end) walk.push(cut.gate ? { ...cut.gate, mask: -1 } : undefined);
        start = Math.max(start, cut.to);
      });
      // Corner towers, then intermediate towers clear of gates.
      const every = ring.towerEvery;
      const marks = [0];
      for (let s = every; s < length - towerSize * 1.5; s += every) marks.push(s);
      marks.forEach((s, index) => {
        if (gates.some(gate => Math.abs(gate.t * length - s) < gateSpan / 2 + towerSize)) return;
        const [x, z] = at(s);
        stations.push({ x, z, angle, key: `${ring.id}:${edge}:${index}` });
      });
    }
    // Short isolated runs read as loose fragments: keep runs of 3+ pieces, or
    // runs that abut the keep (its sculpt continues the curtain).
    const keepRect = exclusions.find(shape => shape.halo === 0 && shape.kind == "rect");
    const touchesKeep = (p: Placement): boolean => !!keepRect && exclusionClearance(keepRect, p.x + center.x, p.z + center.z, wallLength) < 0.004;
    const kept = keepRuns(walk, list => list.length >= 3 || (list.length >= 2 && list.some(touchesKeep)));
    const walls = kept.filter(p => p.mask >= 0);
    plan.walls.push(...walls);
    // Gatehouses and towers need a curtain beside them.
    const beside = (x: number, z: number, reach: number): boolean => walls.some(w => Math.hypot(w.x + center.x - x, w.z + center.z - z) < reach);
    plan.gates.push(...ringGates.filter(gate => beside(gate.x + center.x, gate.z + center.z, gateSpan / 2 + wallLength * 0.75)));
    stations.forEach(station => {
      const { x, z } = station;
      if (!beside(x, z, wallLength * 0.85)) return;
      if (exclusionState(exclusions, x, z, towerSize * 0.8, wallHeight * sy * 1.45) != "free") return;
      if (ring.accept ? !ring.accept(x, z) : fit ? !strictly(x, z, fit.inset * 0.3) || water(x, z) : !nearBoundary(x, z)) return;
      const ground = seat(x, z, towerSize / 2, towerSize / 2, station.angle);
      const [lx, lz] = local(x, z);
      const towerMask = ring.palisade ? kitBits.palisade : spec.stoneMask;
      plan.towers.push({ x: lx, y: ground.y, z: lz, yaw: station.angle, sx: 1, sy, sz: 1, depth: ground.depth / sy,
        wall: shade(tone, 0.95 + seeded(station.key)() * 0.08), roof: capRoof, mask: towerMask, pitch: 1 });
    });
  }

  // ---- Moat: water between stone kerbs.
  if (moat) {
    const n = moat.points.length;
    for (let edge = 0; edge < n; edge++) {
      const a = moat.points[edge], b = moat.points[(edge + 1) % n];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.round(length / 0.04));
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (exclusionState(exclusions, x, z, 0, 0) == "blocked") continue;
        const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
        const ground = seat(x, z, length / count / 2, moat.width / 2, angle);
        const [lx, lz] = local(x, z);
        // Terrain is not carved here (geography owns the heightfield): the water
        // sits just above the ground between stone kerbs that root to the lowest
        // sample. y: water surface; depth: kerb skirt below it.
        plan.moat.push({ x: lx, y: ground.y + 0.0012, z: lz, yaw: angle, length: length / count + 0.003, width: moat.width, depth: ground.depth + 0.0012 });
      }
    }
    if (rings.length > 1) rings[0].gates.forEach((gate, index) => {
      const outer = rings[1].gates[index];
      if (!outer) return;
      const edgePoint = (ring: Ring, g: { edge: number; t: number }): Vec2 => {
        const a = ring.points[g.edge], b = ring.points[(g.edge + 1) % ring.points.length];
        return [a[0] + (b[0] - a[0]) * g.t, a[1] + (b[1] - a[1]) * g.t];
      };
      const [ax, az] = edgePoint(rings[0], gate), [bx, bz] = edgePoint(rings[1], outer);
      const x = (ax + bx) / 2, z = (az + bz) / 2, length = Math.hypot(bx - ax, bz - az);
      if (exclusionState(exclusions, x, z, length / 2, 0.01) == "blocked") return;
      const angle = -Math.atan2(bz - az, bx - ax);
      const ground = seat(x, z, length / 2, 0.006, angle);
      const [lx, lz] = local(x, z);
      plan.bridges.push({ x: lx, y: ground.y + 0.002, z: lz, yaw: angle, length, width: 0.012, depth: ground.depth + 0.002 });
    });
  }

  // ---- Landmarks: the first alternative clear of exclusions and each other.
  const chosen: { slot: LandmarkSlot; x: number; z: number }[] = [];
  slots.forEach(landmark => {
    for (const [x, z] of landmark.at) {
      const clear = landmark.soft ? exclusionState(exclusions, x, z, 0.01, 0) != "blocked" : exclusionState(exclusions, x, z, landmark.reserve * 0.7, landmark.height) == "free";
      if (!inBoundary(x, z) || water(x, z) || !clear) continue;
      if (chosen.some(other => Math.hypot(other.x - x, other.z - z) < (other.slot.reserve + landmark.reserve) * 0.9)) continue;
      // Region fit searches open ground: no landmark on a tall plinth over a shore.
      if (fit && seat(x, z, landmark.reserve * 0.55, landmark.reserve * 0.55, 0).depth > 0.011) continue;
      chosen.push({ slot: landmark, x, z });
      break;
    }
  });
  // Region fit: Visenya's and Rhaenys's hills rise under the chosen landmarks.
  const hills: Hill[] = fit
    ? chosen.filter(c => c.slot.kind == "great-sept" || c.slot.kind == "dragonpit").map(c => ({ at: [c.x, c.z] as Vec2, radius: fit.hill.radius, lift: fit.hill.lift }))
    : spec.hills.map(hill => ({ at: world(hill.at), radius: hill.radius * radius, lift: hill.lift }));
  const lift = (x: number, z: number): number => hills.reduce((sum, hill) => {
    const t = Math.max(0, 1 - Math.hypot(x - hill.at[0], z - hill.at[1]) / hill.radius);
    return sum + hill.lift * t * t * (3 - 2 * t);
  }, 0);
  chosen.forEach(({ slot, x, z }) => {
    const ground = seat(x, z, slot.reserve * 0.55, slot.reserve * 0.55, 0, lift(x, z));
    const [lx, lz] = local(x, z);
    plan.landmarks.push({ kind: slot.kind, x: lx, y: ground.y, z: lz, yaw: slot.yaw, depth: ground.depth, reserve: slot.reserve });
  });
  const reserves = plan.landmarks.map(l => ({ x: l.x + center.x, z: l.z + center.z, r: l.reserve, kind: l.kind }));

  // ---- Godswood: sentinels, oaks and one weirwood inside the inner curtain.
  const grove = plan.landmarks.find(l => l.kind == "godswood");
  if (grove && innerRing) {
    const gx = grove.x + center.x, gz = grove.z + center.z, r = grove.reserve;
    const trees: TreePlacement[] = [{ x: grove.x, z: grove.z, y: height(gx, gz), h: 0.036, kind: "weirwood" }];
    for (let attempt = 0; attempt < caps.trees * 12 && trees.length < caps.trees; attempt++) {
      const a = sapling() * Math.PI * 2, d = Math.sqrt(sapling()) * r;
      // An elongated grove along the curtain, turned with the frame.
      const u = Math.cos(a) * d * 0.9, v = Math.sin(a) * d * 2.1;
      const x = gx + u * cos + v * sin, z = gz - u * sin + v * cos;
      if (!inside(innerRing.points, x, z) || polylineDistance(x, z, innerRing.points, true) < innerRing.thickness + 0.012) continue;
      const [lx, lz] = local(x, z);
      if (trees.some(t => Math.hypot(t.x - lx, t.z - lz) < (t.kind == "weirwood" ? 0.026 : 0.017))) continue;
      if (plan.landmarks.some(l => l != grove && Math.hypot(l.x - lx, l.z - lz) < l.reserve + 0.01)) continue;
      const h = 0.022 + sapling() * 0.02;
      if (exclusionState(exclusions, x, z, 0.008, h) != "free") continue;
      trees.push({ x: lx, z: lz, y: height(x, z), h, kind: sapling() < 0.68 ? "pine" : "oak" });
    }
    plan.trees = trees;
  }

  // ---- Harbor: quays on the shore, piers into open water, moored boats.
  const harbor = fit && interior ? { quays: fitQuays(interior), pierEvery: fit.harbor.pierEvery, pier: fit.harbor.pierLength, boats: fit.harbor.boats }
    : spec.harbor ? { quays: [authoredQuay()], pierEvery: spec.harbor.pierEvery * radius, pier: spec.harbor.pierLength * radius, boats: spec.harbor.boats } : undefined;
  if (harbor) harbor.quays.forEach(quay => {
    let travelled = 0, nextPier = harbor.pierEvery * 0.5;
    for (let edge = 0; edge < quay.points.length - 1; edge++) {
      const a = quay.points[edge], b = quay.points[edge + 1], normal = quay.normals[edge];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      const point = (t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const count = Math.max(1, Math.round(length / 0.035));
      for (let k = 0; k < count; k++) {
        const [x, z] = point((k + 0.5) / count);
        if (options.isWater && !water(x + normal[0] * 0.015, z + normal[1] * 0.015)) continue;
        if (water(x, z) || !inBoundary(x, z) || exclusionState(exclusions, x, z, length / count / 2, 0.012) == "blocked") continue;
        const ground = seat(x, z, length / count / 2, 0.005, angle);
        const [lx, lz] = local(x, z);
        plan.quays.push({ x: lx, y: ground.y, z: lz, yaw: angle, length: length / count + 0.002, width: 0.01, depth: ground.depth });
      }
      for (; nextPier < travelled + length; nextPier += harbor.pierEvery) {
        const [bx, bz] = point((nextPier - travelled) / length);
        const tx = bx + normal[0] * harbor.pier, tz = bz + normal[1] * harbor.pier;
        if (options.isWater && (!water(tx, tz) || water(bx, bz))) continue;
        const px = (bx + tx) / 2, pz = (bz + tz) / 2;
        if (exclusionState(exclusions, px, pz, harbor.pier / 2, 0.01) == "blocked" || exclusionState(exclusions, tx, tz, 0.006, 0.01) == "blocked") continue;
        const base = height(bx, bz);
        const [lx, lz] = local(px, pz);
        plan.piers.push({ x: lx, y: base + 0.003, z: lz, yaw: angle + Math.PI / 2, length: harbor.pier, width: 0.007, depth: 0.03 });
        if (plan.boats.length >= Math.min(caps.boats, harbor.boats)) continue;
        const side = plan.boats.length % 2 ? 1 : -1;
        const ox = tx - normal[0] * harbor.pier * 0.3 + Math.cos(angle) * side * 0.012, oz = tz - normal[1] * harbor.pier * 0.3 - Math.sin(angle) * side * 0.012;
        if ((options.isWater && !water(ox, oz)) || exclusionState(exclusions, ox, oz, 0.012, 0.03) != "free") continue;
        const [bxl, bzl] = local(ox, oz);
        plan.boats.push({ x: bxl, y: Math.min(base, height(ox, oz)) + 0.001, z: bzl, yaw: angle + Math.PI / 2, length: 0.024, width: 0.008, depth: 0 });
      }
      travelled += length;
    }
  });

  // Embedded keep seat (standalone previews only).
  if (options.embedKeep) {
    const keep = options.keep ?? { x: center.x, z: center.z };
    const scale = options.keep?.scale ?? 1.05, [hx, hz] = options.keep?.footprint ?? [0.3 * scale, 0.27 * scale];
    const ground = seat(keep.x, keep.z, hx, hz, 0);
    plan.keep = { x: keep.x - center.x, y: ground.y - 0.001, z: keep.z - center.z, scale, depth: ground.depth };
  }

  // ---- Houses: rotated lot grids per district, lanes every block, ranked by street frontage.
  const ranked: { house: HousePlacement; score: number }[] = [];
  const occupied = new Map<string, { x: number; z: number; r: number }[]>();
  const cell = (x: number, z: number): string => `${Math.floor(x / 0.03)}:${Math.floor(z / 0.03)}`;
  yield;
  for (const district of districts) yield* houses(district);
  plan.candidates = ranked.length;
  ranked.sort((a, b) => b.score - a.score);
  plan.houses = ranked.slice(0, caps.houses).map(entry => entry.house);
  if (spec.palisade && !fit) for (const ring of palisadeRings(spec.palisade)) { yield; placeRing(ring); }
  return plan;

  function* houses(district: District): Generator<void, void, void> {
    const spec2 = district.spec, polygon = district.polygon;
    const theta = yaw + spec2.angle, c = Math.cos(theta), s = Math.sin(theta);
    const along = (x: number, z: number): number => x * c - z * s, acrossC = (x: number, z: number): number => x * s + z * c;
    const as = polygon.map(([x, z]) => along(x, z)), cs = polygon.map(([x, z]) => acrossC(x, z));
    const [lw, ld] = spec2.lot, [bc, br] = spec2.block;
    const pitchA = lw + spec2.gap, pitchC = ld + spec2.gap;
    const variants = Object.entries(spec2.variants) as [HouseVariant, number][];
    const total = variants.reduce((sum, [, weight]) => sum + weight, 0);
    const minA = Math.min(...as), maxA = Math.max(...as), minC = Math.min(...cs), maxC = Math.max(...cs);
    for (let j = 0; ; j++) {
      const rowC = minC + j * pitchC + Math.floor(j / br) * spec2.lane + ld / 2;
      if (rowC > maxC) break;
      yield;
      // Back-to-back rows: each faces its own lane.
      const facing = br > 1 && j % br == 0 ? Math.PI : 0;
      for (let i = 0; ; i++) {
        const cellA = minA + i * pitchA + Math.floor(i / bc) * spec2.lane + lw / 2;
        if (cellA > maxA) break;
        const random = seeded(`${spec.id}:${spec2.id}:${i}:${j}`);
        const roll = random(), pick = random(), jitterA = random() - 0.5, jitterC = random() - 0.5, size = random(), tall = random(), tint = random(), roofPick = random(), rank = random();
        const a = cellA + jitterA * spec2.gap * 0.6, cc = rowC + jitterC * spec2.gap * 0.6;
        const x = a * c + cc * s, z = -a * s + cc * c;
        if (roll > spec2.density || !inside(polygon, x, z)) continue;
        if (district.keep) {
          const distance = Math.hypot(x - keepAt[0], z - keepAt[1]);
          if (distance < district.keep[0] || distance >= district.keep[1]) continue;
        }
        let variant = variants[0][0];
        for (let k = 0, sum = 0; k < variants.length; k++) { sum += variants[k][1] / total; if (pick <= sum) { variant = variants[k][0]; break; } }
        const type = houseVariants[variant], kit = houseKits[type.kit];
        // Lots never stretch a house thin: tall houses stay under 2:1.
        const w = Math.min(type.w * (0.9 + size * 0.22), lw * 0.97), d = Math.min(type.d * (0.93 + size * 0.12), ld * 0.97);
        const h = Math.min(type.h * (0.86 + tall * 0.28), Math.min(w, d) * 2.1);
        const ridge = (type.kit == "tall" ? w : d) * type.pitch;
        const r = Math.hypot(w, d) / 2, top = h + ridge;
        if (!inBoundary(x, z) || [[0, 0], [-1, -1], [1, 1], [1, -1], [-1, 1]].some(([p, q]) => water(x + p * w / 2, z + q * d / 2))) continue;
        if (fit && !strictly(x, z, r * 0.5)) continue;
        if (!fit && outerRing && (spec2.outside ? inside(outerRing.points, x, z) : !inside(innerRing.points, x, z))) continue;
        if (rings.some(ring => polylineDistance(x, z, ring.points, true) < ring.thickness / 2 + r + 0.003)) continue;
        if (moat && polylineDistance(x, z, moat.points, true) < moat.width / 2 + r + 0.002) continue;
        let street = Infinity;
        streets.forEach(st => { street = Math.min(street, polylineDistance(x, z, st.points) - st.width / 2); });
        if (street < r * 0.75) continue;
        if (plazas.some(p => Math.hypot(x - p.at[0], z - p.at[1]) < p.radius + r)) continue;
        if (reserves.some(l => l.kind != "godswood" ? Math.hypot(x - l.x, z - l.z) < l.r + r : false)) continue;
        if (gateCenters.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < gateSpan * 0.85 + r)) continue;
        if (plan.quays.some(q => Math.hypot(x - center.x - q.x, z - center.z - q.z) < q.length / 2 + r + 0.004)) continue;
        if (exclusionState(exclusions, x, z, r, top) != "free") continue;
        // Districts of a fitted city meet at band edges: no overlapping lots.
        const key = cell(x, z), [cx, cz] = key.split(":").map(Number);
        let clash = false;
        for (let u = -1; u <= 1 && !clash; u++) for (let v = -1; v <= 1 && !clash; v++) clash = (occupied.get(`${cx + u}:${cz + v}`) ?? []).some(o => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.82);
        if (clash) continue;
        const angle = theta + facing + (random() - 0.5) * 0.07;
        // Houses sit on the terrain itself (a hill lift counted as foundation
        // and emptied every lot on Visenya's and Rhaenys's hills), dug up to a
        // fifth of their wall into a slope. Skip lots whose foundation would
        // show taller than a plinth: such skirts read as stilted towers on
        // river banks, coves and castle pads.
        const ground = seat(x, z, w / 2, d / 2, angle, 0, h * 0.2);
        if (ground.plinth > Math.max(0.0045, h * 0.3)) continue;
        const sx = w / kit.w, sy = h / kit.h, sz = d / kit.d;
        const plasters = spec.palette.plaster, roofs = spec.palette.roofs[variant] ?? ["#7b6a5a"];
        const [lx, lz] = local(x, z);
        const house: HousePlacement = {
          variant, kit: type.kit, block: `${spec2.id}:${Math.floor(i / bc)}:${Math.floor(j / br)}`,
          x: lx, y: ground.y, z: lz, yaw: angle, sx, sy, sz, depth: ground.depth / sy,
          wall: shade(rgb(plasters[Math.floor(tint * plasters.length)]), 0.93 + size * 0.1),
          roof: shade(rgb(roofs[Math.floor(roofPick * roofs.length)]), 0.9 + tall * 0.16),
          mask: type.mask, pitch: roofPitch(type.kit, type.pitch, sy, sz),
          w, d, h, ridge
        };
        const list = occupied.get(key);
        if (list) list.push({ x, z, r }); else occupied.set(key, [{ x, z, r }]);
        ranked.push({ house, score: spec2.priority + (street < 0.012 ? 0.3 : 0) + rank * 0.35 });
      }
    }
  }

  /**
   * One closed ring per compact cluster of the placed outside lots, `pad`
   * beyond them (convex hull, simplified). Every stake must stay within `hug`
   * of a lot of its own town, clear of other lots, outside the stone curtain,
   * on dry land and `margin` inside the region, so nothing runs off across
   * country. Gates open where an authored street crosses the ring.
   */
  function palisadeRings(p: PalisadeSpec): Ring[] {
    const { link, minLots, pad, hug, margin } = palisadeFit;
    const lot = (h: HousePlacement): { x: number; z: number; r: number } => ({ x: h.x + center.x, z: h.z + center.z, r: Math.hypot(h.w, h.d) / 2 });
    const homes = plan.houses.map(lot);
    const lots = plan.houses.filter(h => p.districts.includes(h.block.split(":")[0])).map(lot);
    const parent = lots.map((_, i) => i);
    const root = (i: number): number => parent[i] == i ? i : (parent[i] = root(parent[i]));
    lots.forEach((a, i) => { for (let j = i + 1; j < lots.length; j++) if (Math.hypot(a.x - lots[j].x, a.z - lots[j].z) < link + a.r + lots[j].r) parent[root(j)] = root(i); });
    const clusters = new Map<number, typeof lots>();
    lots.forEach((entry, i) => { const list = clusters.get(root(i)); if (list) list.push(entry); else clusters.set(root(i), [entry]); });
    const result: Ring[] = [];
    Array.from(clusters.values()).filter(list => list.length >= minLots).forEach((town, index) => {
      const corners: Vec2[] = town.flatMap(h => Array.from({ length: 8 }, (_, k) => [h.x + Math.cos(k * Math.PI / 4) * (h.r + pad), h.z + Math.sin(k * Math.PI / 4) * (h.r + pad)] as Vec2));
      const hull = convexHull(corners);
      const points = hull.length > 4 ? simplifyPolygon(hull, 0.02, 0.006) : hull;
      if (points.length < 3) return;
      const gates: Ring["gates"] = [];
      points.forEach((a, edge) => {
        const b = points[(edge + 1) % points.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < gateSpan + 0.012) return;
        streets.forEach((street, i) => street.points.slice(0, -1).forEach((c, k) => {
          const t = crossing(a, b, c, street.points[k + 1]);
          if (t == undefined) return;
          const s = Math.max(gateSpan / 2 + 0.006, Math.min(length - gateSpan / 2 - 0.006, t * length));
          if (gates.some(g => g.edge == edge && Math.abs(g.t * length - s) < gateSpan * 1.5)) return;
          gates.push({ name: `${p.name} Gate (${spec.streets[i]?.name ?? "lane"})`, edge, t: s / length });
        }));
      });
      // A town no street reaches still gets a gate, on its side away from the keep.
      if (!gates.length) {
        let best = -1, score = -Infinity;
        points.forEach((a, edge) => {
          const b = points[(edge + 1) % points.length];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) < gateSpan + 0.012) return;
          const value = Math.hypot((a[0] + b[0]) / 2 - keepAt[0], (a[1] + b[1]) / 2 - keepAt[1]);
          if (value > score) { score = value; best = edge; }
        });
        if (best >= 0) gates.push({ name: `${p.name} Gate`, edge: best, t: 0.5 });
      }
      const accept = (x: number, z: number): boolean => strictly(x, z, margin) && !water(x, z)
        && town.some(h => Math.hypot(x - h.x, z - h.z) < h.r + pad + hug)
        && !homes.some(h => Math.hypot(x - h.x, z - h.z) < h.r + p.thickness / 2 + 0.004)
        && (!outerRing || (!inside(outerRing.points, x, z) && polylineDistance(x, z, outerRing.points, true) > outerRing.thickness + 0.02));
      result.push({ id: `palisade-${index}`, points, height: 1, thickness: p.thickness, towerEvery: p.towerEvery, gates, palisade: true, accept });
    });
    return result;
  }

  /** Curtain ring `inset` inside the region; water-facing stretches are skipped later. */
  function fitRing(f: RegionFitSpec, polygon: Vec2[]): Ring {
    const points = insetPolygon(polygon, f.inset);
    const n = points.length, gates: Ring["gates"] = [];
    // Each gate takes the best valid curtain point toward its compass bearing.
    const candidates: { edge: number; t: number; x: number; z: number }[] = [];
    for (let edge = 0; edge < n; edge++) {
      const a = points[edge], b = points[(edge + 1) % n], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < gateSpan + 0.01) continue;
      const sign = polygonArea(points) > 0 ? 1 : -1, outward: Vec2 = [(b[1] - a[1]) / length * sign, -(b[0] - a[0]) / length * sign];
      for (let s = gateSpan / 2 + 0.004; s < length - gateSpan / 2 - 0.004; s += 0.008) {
        const t = s / length, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const ok = [-1, 0, 1].every(k => {
          const px = x + (b[0] - a[0]) / length * k * gateSpan / 2, pz = z + (b[1] - a[1]) / length * k * gateSpan / 2;
          return strictly(px, pz, f.inset * 0.4) && !water(px, pz) && !across(px, pz, outward, f.inset + 0.03);
        });
        if (ok && exclusionState(exclusions, x, z, gateSpan / 2 + 0.01, wallHeight * 1.5) == "free") candidates.push({ edge, t, x, z });
      }
    }
    f.gates.forEach(gate => {
      let best: typeof candidates[0] | undefined, score = 0.55;
      candidates.forEach(candidate => {
        const bearing = Math.atan2(candidate.z - centroid[1], candidate.x - centroid[0]);
        const value = Math.cos(bearing - gate.bearing);
        if (value > score && gates.every(g => { const p = candidates.find(c => c.edge == g.edge && c.t == g.t); return !p || Math.hypot(p.x - candidate.x, p.z - candidate.z) > 0.16; })) { best = candidate; score = value; }
      });
      if (best) gates.push({ name: gate.name, edge: best.edge, t: best.t });
    });
    return { id: "city", points, height: 1, thickness: 0.012, towerEvery: f.towerEvery, gates, palisade: false };
  }

  /** The city's open square: clear ground nearest the region's centroid. */
  function hubPoint(ring: Vec2[]): Vec2 | undefined {
    let best: Vec2 | undefined, score = Infinity;
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.012) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.012) {
      if (!inside(ring, x, z) || water(x, z) || polylineDistance(x, z, ring, true) < 0.05) continue;
      if (exclusionState(exclusions, x, z, 0.03, 0) == "blocked") continue;
      const value = Math.hypot(x - centroid[0], z - centroid[1]) + Math.hypot(x - keepAt[0], z - keepAt[1]) * 0.5;
      if (value < score) { score = value; best = [x, z]; }
    }
    return best;
  }

  /** Streets from each gate to the square, gently bent, and square → keep. */
  function fitStreets(): { width: number; points: Vec2[] }[] {
    if (!hub) return [];
    const list: { width: number; points: Vec2[] }[] = [];
    const ring = rings[0];
    ring.gates.forEach(gate => {
      const a = ring.points[gate.edge], b = ring.points[(gate.edge + 1) % ring.points.length];
      const g: Vec2 = [a[0] + (b[0] - a[0]) * gate.t, a[1] + (b[1] - a[1]) * gate.t];
      const length = Math.hypot(hub[0] - g[0], hub[1] - g[1]) || 1, bend = (seeded(`${spec.id}:${gate.name}`)() - 0.5) * 0.08;
      const mid: Vec2 = [(g[0] + hub[0]) / 2 - (hub[1] - g[1]) / length * bend, (g[1] + hub[1]) / 2 + (hub[0] - g[0]) / length * bend];
      list.push({ width: 0.011, points: [g, mid, hub] });
    });
    list.push({ width: 0.012, points: [hub, keepAt] });
    return list;
  }

  /** Clear ground ranked by compass preference from the keep. */
  function fitLandmarks(f: RegionFitSpec): LandmarkSlot[] {
    const ring = rings[0].points;
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    return f.landmarks.map(l => {
      const scored: { at: Vec2; score: number }[] = [];
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.012) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.012) {
        const distance = Math.hypot(x - keepAt[0], z - keepAt[1]);
        if (distance < l.keep[0] || distance > l.keep[1] || !inside(ring, x, z) || water(x, z) || polylineDistance(x, z, ring, true) < l.reserve * 0.8) continue;
        if (exclusionState(exclusions, x, z, l.reserve * 0.7, l.height) != "free") continue;
        const bearing = Math.atan2(z - keepAt[1], x - keepAt[0]);
        scored.push({ at: [x, z], score: Math.cos(bearing - l.bearing) - distance * 0.6 });
      }
      scored.sort((a, b) => b.score - a.score);
      return { kind: l.kind, at: scored.slice(0, 80).map(entry => entry.at), yaw: 0, reserve: l.reserve, height: l.height, soft: false };
    });
  }

  /** Shore runs: region border points with open water just across them. */
  function fitQuays(polygon: Vec2[]): Quay[] {
    const sign = polygonArea(polygon) > 0 ? 1 : -1, quays: Quay[] = [];
    let current: Quay | undefined;
    polygon.forEach((a, edge) => {
      const b = polygon[(edge + 1) % polygon.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const inward: Vec2 = [-(b[1] - a[1]) / length * sign, (b[0] - a[0]) / length * sign];
      const count = Math.max(1, Math.round(length / 0.02));
      for (let k = 0; k <= count; k++) {
        const t = k / count, x = a[0] + (b[0] - a[0]) * t + inward[0] * 0.009, z = a[1] + (b[1] - a[1]) * t + inward[1] * 0.009;
        const shore = !water(x, z) && water(x - inward[0] * 0.03, z - inward[1] * 0.03);
        if (shore) {
          if (!current) { current = { points: [], normals: [] }; quays.push(current); }
          current.points.push([x, z]);
          current.normals.push([-inward[0], -inward[1]]);
        } else current = undefined;
      }
    });
    return quays.filter(quay => quay.points.length >= 2);
  }

  function authoredQuay(): Quay {
    const quay = spec.harbor ? spec.harbor.quay.map(world) : [];
    // Seaward normal: away from the city centre.
    const normals = quay.slice(0, -1).map((a, i) => {
      const b = quay[i + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const n: Vec2 = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      return Math.hypot(mx + n[0] * 0.05 - center.x, mz + n[1] * 0.05 - center.z) < Math.hypot(mx - center.x, mz - center.z) ? [-n[0], -n[1]] as Vec2 : n;
    });
    return { points: quay, normals };
  }
}

/** Parameter along a→b where it crosses segment c→d, if it does. */
function crossing(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number | undefined {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1];
  const denominator = rx * sz - rz * sx;
  if (Math.abs(denominator) < 1e-9) return undefined;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / denominator, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : undefined;
}

/**
 * Splits a closed ring's walk (undefined = gap) into runs and keeps those
 * `keep` accepts; the last and first runs join.
 */
function keepRuns(walk: (Placement | undefined)[], keep: (run: Placement[]) => boolean): Placement[] {
  const runs: Placement[][] = [];
  let current: Placement[] = [];
  walk.forEach(entry => {
    if (entry) current.push(entry);
    else if (current.length) { runs.push(current); current = []; }
  });
  if (current.length) runs.push(current);
  if (runs.length > 1 && walk[0] && walk[walk.length - 1]) runs[0] = [...(runs.pop() ?? []), ...runs[0]];
  return runs.filter(run => keep(run.filter(p => p.mask >= 0))).flat();
}

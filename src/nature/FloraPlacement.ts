import { indexedContainsPoint } from "../core/containsPoint";
import { BoardPoint, SceneFrame } from "../core/SceneFrame";
import { floraPhysicalClearance } from "./Clearance";
import { castleStyle } from "../castles/castleStyles";

export type FloraSpecies = "pine" | "birch" | "oak" | "cypress" | "olive" | "palm" | "willow" | "orchard" | "weirwood" | "reed";
export interface FloraProfile {
  cover: number;
  treelineM: number;
  species: readonly FloraSpecies[];
  colour: string;
  /** Optional multiplier for crown groups; absent preserves the original tint. */
  crownTint?: string;
}
/** Public geography only. No viewer, unit, order, controller or event input. */
export interface FloraZone {
  id: string;
  polygon: readonly BoardPoint[];
  variant: string;
  /** Optional public recipe override (e.g. an Essos margin cell). */
  profile?: FloraProfile;
  /** Static settlement/crop/road/slot exclusions, in board px. Include crown overhang. */
  cleared?: (point: BoardPoint, radiusM: number) => boolean;
  /** Public river distance in metres. No river input means no wetland plants. */
  riverDistance?: (point: BoardPoint) => number;
  /** Only explicitly authored godswoods may contain a weirwood south of the Wall. */
  sacred?: readonly BoardPoint[];
  /** Exact public garden planting plan, in board px; subject to all static masks. */
  authored?: readonly FloraTree[];
}
export interface FloraGround {
  /** Scene units, from the active terrain sampler. */
  height: number;
  /** Metres above sea level; do not infer it from absolute scene Y. */
  altitudeM: number;
  slope: number;
  land: boolean;
}
export interface FloraTree {
  point: BoardPoint;
  species: FloraSpecies;
  heightM: number;
  radiusM: number;
  yaw: number;
  shade: number;
}
export const FLORA_VERSION = 1;
export const TREE_SPACING_M = 7; // 204 candidates/ha; thinning preserves physical spacing across tiers.

export function floraSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function floraHash(seed: number, x: number, z: number, salt = 0): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 1274126177);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
export function floraProfile(id: string): FloraProfile {
  if (id == "kings-landing") return { cover: 0, treelineM: 900, species: [], colour: "#6b7556" };
  if (id.startsWith("beyond-wall") || id.startsWith("north-margin")) return { cover: 0.52, treelineM: 780, species: ["pine", "pine", "birch"], colour: "#40554a" };
  if (id == "crackclaw-point") return { cover: 0.63, treelineM: 800, species: ["pine", "pine", "oak", "birch"], colour: "#405443" };
  if (id == "storms-end") return { cover: 0.96, treelineM: 900, species: ["oak", "oak", "oak", "birch"], colour: "#263f35", crownTint: "#a4b6a5" };
  if (id == "kingswood") return { cover: 0.97, treelineM: 900, species: ["oak", "oak", "oak", "birch"], colour: "#2c4534", crownTint: "#a4b3a0" };
  if (id == "greywater-watch" || id == "moat-cailin") return { cover: 0.36, treelineM: 700, species: ["willow", "birch", "willow"], colour: "#62715a" };
  if (["the-stony-shore", "the-fingers", "dragonstone"].includes(id)) return { cover: 0.03, treelineM: 800, species: ["pine"], colour: "#596653" };
  switch (castleStyle(id)) {
    case "north": return { cover: id == "winterfell" ? 0.64 : 0.46, treelineM: 780, species: ["pine", "pine", "pine", "birch"], colour: "#465e50" };
    case "riverlands": return { cover: 0.40, treelineM: 850, species: ["oak", "willow", "birch"], colour: "#667758" };
    case "vale": return { cover: 0.32, treelineM: 900, species: ["pine", "pine", "orchard"], colour: "#60745a" };
    case "reach": return { cover: 0.32, treelineM: 900, species: ["orchard", "orchard", "cypress", "olive"], colour: "#697653" };
    case "dorne": return { cover: 0.055, treelineM: 650, species: ["olive", "palm", "cypress"], colour: "#747b57" };
    case "islands": return { cover: 0, treelineM: 0, species: [], colour: "#68705a" };
    case "stormlands": return { cover: 0.68, treelineM: 900, species: ["oak", "oak", "pine"], colour: "#465a48" };
    case "westerlands": return { cover: 0.27, treelineM: 900, species: ["oak", "oak", "birch"], colour: "#6d7554" };
    case "crownlands": return { cover: 0.40, treelineM: 900, species: ["olive", "cypress", "oak"], colour: "#6b7556" };
    default: return { cover: id.includes("rhoyne") ? 0.48 : 0.22, treelineM: 900, species: id.includes("braavos") || id.includes("rhoyne") ? ["willow", "cypress", "oak"] : ["olive", "cypress", "orchard"], colour: "#727c60" };
  }
}
export function floraInside(point: BoardPoint, polygon: readonly BoardPoint[]): boolean {
  return indexedContainsPoint(polygon as BoardPoint[], point);
}
/** Continuous patch mask, shared by individual trees, group impostors and canopy. */
export function floraCover(zone: FloraZone, point: BoardPoint, frame: SceneFrame, ground: FloraGround): number {
  if (frame.k != 20 || !ground.land || !floraInside(point, zone.polygon) || ground.slope > 0.65 || floraPhysicalClearance(frame, point, 8) || zone.cleared?.(point, 8)) return 0;
  const profile = zone.profile ?? floraProfile(zone.id);
  if (!profile.cover || ground.altitudeM > profile.treelineM) return 0;
  const seed = floraSeed(`${zone.variant}:${zone.id}:flora:${FLORA_VERSION}`);
  const pxPerPatch = frame.boardLen(frame.m(120));
  const x = point.x / pxPerPatch, z = point.y / pxPerPatch;
  const ix = Math.floor(x), iz = Math.floor(z);
  const smooth = (v: number): number => v * v * (3 - 2 * v);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = floraHash(seed, ix, iz), b = floraHash(seed, ix + 1, iz);
  const c = floraHash(seed, ix, iz + 1), d = floraHash(seed, ix + 1, iz + 1);
  const patch = (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  const cover = Math.max(0, Math.min(1, (patch - (1 - profile.cover)) * 5 + 0.45));
  const treeline = Math.max(0, Math.min(1, (profile.treelineM - ground.altitudeM) / 100));
  const slope = Math.max(0, Math.min(1, (0.65 - ground.slope) / 0.35));
  // Wolfswood occupies the western half; retain a little woodland east of Winterfell.
  const west = zone.id == "winterfell" && point.x > 290 ? 0.32 : 1;
  return cover * treeline * slope * west;
}
/** One stable jittered lattice cell. Coordinates are physical metres from map NW. */
export function floraTreeAt(zone: FloraZone, cellX: number, cellZ: number, frame: SceneFrame,
  sample: (point: BoardPoint) => FloraGround): FloraTree | undefined {
  if (frame.k != 20) return undefined;
  const seed = floraSeed(`${zone.variant}:${zone.id}:flora:${FLORA_VERSION}`);
  const point = {
    x: frame.boardLen(frame.m((cellX + 0.2 + floraHash(seed, cellX, cellZ, 1) * 0.6) * TREE_SPACING_M)),
    y: frame.boardLen(frame.m((cellZ + 0.2 + floraHash(seed, cellX, cellZ, 2) * 0.6) * TREE_SPACING_M))
  };
  if (!floraInside(point, zone.polygon)) return undefined;
  const ground = sample(point);
  if (floraHash(seed, cellX, cellZ, 3) >= floraCover(zone, point, frame, ground)) return undefined;
  const profile = zone.profile ?? floraProfile(zone.id);
  if (!profile.species.length) return undefined;
  let species = profile.species[Math.floor(floraHash(seed, cellX, cellZ, 4) * profile.species.length)];
  const wet = (zone.riverDistance?.(point) ?? Infinity) < 18;
  if (species == "willow" && !wet && !zone.id.includes("braavos")) species = "oak";
  if (wet && floraHash(seed, cellX, cellZ, 5) < 0.5) species = "reed";
  // Exact sacred anchors are emitted separately; keep surrounding lattice trees out.
  if (zone.sacred?.some(p => Math.hypot(frame.len(p.x - point.x), frame.len(p.y - point.y)) < frame.m(12))) return undefined;
  if (zone.authored?.some(t => Math.hypot(frame.len(t.point.x - point.x), frame.len(t.point.y - point.y)) < frame.m(t.radiusM + 3))) return undefined;
  const baseHeight = { pine: 23, birch: 18, oak: 21, cypress: 20, olive: 9, palm: 16, willow: 18, orchard: 7, weirwood: 17, reed: 1.8 }[species];
  const heightM = baseHeight * (0.78 + floraHash(seed, cellX, cellZ, 6) * 0.36);
  const radiusM = heightM * ({ pine: 0.2, birch: 0.22, oak: 0.34, cypress: 0.1, olive: 0.43, palm: 0.28, willow: 0.4, orchard: 0.42, weirwood: 0.4, reed: 0.6 }[species]);
  if (floraPhysicalClearance(frame, point, radiusM) || zone.cleared?.(point, radiusM)) return undefined;
  return { point, species, heightM, radiusM, yaw: floraHash(seed, cellX, cellZ, 7) * Math.PI * 2, shade: 0.86 + floraHash(seed, cellX, cellZ, 8) * 0.22 };
}

/** Exact recipe anchors keep the heart tree from depending on a lucky lattice hit. */
export function floraSacredTrees(zone: FloraZone, frame: SceneFrame, sample: (point: BoardPoint) => FloraGround): FloraTree[] {
  if (frame.k != 20) return [];
  return (zone.sacred ?? []).filter(point => {
    if (!floraInside(point, zone.polygon) || floraPhysicalClearance(frame, point, 6.8) || zone.cleared?.(point, 6.8)) return false;
    const ground = sample(point);
    return ground.land && ground.slope < 0.45;
  }).map(point => ({ point: { ...point }, species: "weirwood", heightM: 17, radiusM: 6.8,
    yaw: floraHash(floraSeed(zone.id), Math.round(point.x * 10), Math.round(point.y * 10), 91) * Math.PI * 2, shade: 1 }));
}

/** Authored grove points share natural trees' coast/slope/clearance policy. */
export function floraAuthoredTrees(zone: FloraZone, frame: SceneFrame, sample: (point: BoardPoint) => FloraGround): FloraTree[] {
  if (frame.k != 20) return [];
  return (zone.authored ?? []).filter(tree => {
    if (!floraInside(tree.point, zone.polygon) || floraPhysicalClearance(frame, tree.point, tree.radiusM) || zone.cleared?.(tree.point, tree.radiusM)) return false;
    const ground = sample(tree.point);
    return ground.land && ground.slope < 0.45;
  });
}

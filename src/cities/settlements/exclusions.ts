import { boardRect } from "./plane";
import { CityExclusion } from "./types";
import { SceneFrame } from "../../core/SceneFrame";

// Token/banner exclusions shared by World cities and living armies. Kept apart
// from the city builders so the "living-units" chunk does not pull them in.
export { boardRect } from "./plane";

/**
 * Converts the slots castlePlacement already protects (board px) into world
 * exclusions. Sizes match TabletopLandscape.landmarkPoint's reservations.
 */
export function regionSlotExclusions(slots: {
  unit?: { point: { x: number; y: number }; width: number };
  order?: { x: number; y: number };
  power?: { x: number; y: number };
  improvement?: { point: { x: number; y: number }; width: number };
  pieces?: { x: number; y: number }[];
}, mapWidth: number, mapHeight: number, scale = 1, frame?: SceneFrame): CityExclusion[] {
  const list: CityExclusion[] = [];
  // `scale` follows the visible piece size: 1 for strategic-size pieces, about
  // unitModelScale(type, true, distance) / 0.7 for close World inspection.
  // frame: map — these legacy board-pixel slot extents reserve authored map
  // space in P0. P2's fixed-screen strategic pieces need ui() footprints.
  const halo = { halo: 0.03 * Math.max(0.35, scale), clearHeight: 0.024 };
  const rect = (point: { x: number; y: number }, hw: number, hh: number): number => list.push(boardRect(point, hw * scale, hh * scale, mapWidth, mapHeight, halo, frame));
  if (slots.unit) rect(slots.unit.point, Math.min(30, slots.unit.width / 2), 20);
  if (slots.order) rect(slots.order, 23, 23);
  if (slots.power) rect(slots.power, 15, 15);
  if (slots.improvement) rect(slots.improvement.point, slots.improvement.width / 2, 20);
  slots.pieces?.forEach(point => rect(point, 19, 23));
  return list;
}

/** World point (THREE.Vector3-like) → small circular exclusion, e.g. banners. */
export function pointExclusion(point: { x: number; z: number }, radius: number, halo = 0.04, clearHeight = 0.02): CityExclusion {
  return { kind: "circle", x: point.x, z: point.z, radius, halo, clearHeight };
}

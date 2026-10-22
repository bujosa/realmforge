import type { CastlePalette } from "../castles/castleStyles";
import type { Seated, Structure, Vec2, Volume } from "./ComplexPlan";

/** Original, metre-space massing; read only by the physical (k > 1) planner.
 * Named parts follow the books; dimensions and footprint are art-directed.
 * Dragonmont is geography and stays in atlas intake, never a castle prop.
 */
// Native polygonWard winding makes the gateway face out of the ward.
export const DRAGONSTONE_OUTLINE: Vec2[] = [
  [-91, 8], [-54, 52], [24, 65], [74, 43], [87, -44], [36, -88], [-38, -96], [-86, -58]
];

export const DRAGONSTONE_STRUCTURES: Structure[] = [
  // Stone Drum, Sea Dragon Tower and Windwyrm: unequal, steep silhouettes.
  { type: "drum", x: -12, z: -47, r: 22, h: 56, roof: "none" },
  { type: "tower", x: 61, z: -37, r: 9, h: 68, round: true, roof: "cone" },
  { type: "tower", x: -61, z: -46, r: 8, h: 59, round: true, roof: "cone" },
  { type: "tower", x: 35, z: -73, r: 7, h: 43, round: true, roof: "none" },
  // Great Hall and gallery flank the open yard; the public anchor stays clear.
  { type: "hall", x: -53, z: 0, w: 49, d: 17, h: 23, angle: Math.PI / 2 },
  { type: "hall", x: 44, z: 4, w: 52, d: 11, h: 17, angle: Math.PI / 2 },
  { type: "hall", x: 25, z: -53, w: 39, d: 10, h: 24, angle: 0.2 },
  // Splayed, low wings break the rectangular default fortress footprint.
  { type: "hall", x: -62, z: 25, w: 34, d: 9, h: 13, angle: -0.6 },
  { type: "hall", x: 57, z: 29, w: 31, d: 9, h: 14, angle: 0.65 }
];

export const DRAGONSTONE_PALETTE: Partial<CastlePalette> = {
  stone: "#414b4e", trim: "#687577", roof: "#303b3e", wood: "#53483c"
};

export const STORMS_END_PALETTE: Partial<CastlePalette> = {
  stone: "#58636e", trim: "#8e9a9d", roof: "#414851", wood: "#6a5547"
};

/** Original heraldic stone dragons, never characters or animated creatures.
 * Both fit within the existing ward footprint; y/size follow the fitted seat.
 */
export function dragonstoneCarvings(structures: readonly Seated[], fit: number): { x: number; y: number; z: number; size: number; angle: number }[] {
  return structures.flatMap(s => s.type == "drum" ? [{ x: s.x, y: s.top - 1, z: s.z, size: 17 * fit, angle: 0 }]
    : s.type == "gatehouse" ? [{ x: s.x, y: s.top - 1, z: s.z, size: 6 * fit, angle: s.angle }] : []);
}

export function dragonstoneCarvingVolumes(structures: readonly Seated[], fit: number): Volume[] {
  return dragonstoneCarvings(structures, fit).map(s => ({ minX: s.x - s.size * 1.3, maxX: s.x + s.size * 1.3,
    minZ: s.z - s.size * 1.3, maxZ: s.z + s.size * 1.3, top: s.y + s.size * 0.95 }));
}

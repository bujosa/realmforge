import type { KitInstance, KitVariant, Rgb } from "../../core/KitPool";
import { cityKitVariants, HouseKit, houseKits, kitBits, physicalExtraVariants, roofPitch } from "./CityKit";

// World ×20 (k = 20) physical K1 houses in metres (bible §2 K1, design §3:
// houses 6–10 m). The kit geometry stays the shared nominal pool geometry;
// a lot only chooses the variant, scale, roof pitch, tints and option mask,
// so a village of the composer (C1) and a capital share the same draws.
// Pure: no Three objects, no state; same lot → same instances.

/** Physical metres per scene unit (SceneFrame.metresPerUnit). */
const METRES = 50;

/** Every World ×20 kit variant: the k = 1 city kits plus `house-flat` and `block`. */
export const physicalKitVariants: Record<string, KitVariant> = { ...cityKitVariants, ...physicalExtraVariants };

/**
 * Roof families of the bible (§2 K1, §3): `gable-steep` (North, Riverlands,
 * Vale, Stormlands), `gable-low` terracotta (Crownlands, West, Reach),
 * `flat-dome` (Dorne, Essos), `turf-long` (Iron Islands, beyond the Wall,
 * northern coast), plus the larger `tower-house` / `hall` and the two-wing
 * `court` of the cities.
 */
export type HouseFamily = "gable-steep" | "gable-low" | "flat-dome" | "turf-long" | "tower-house" | "hall" | "court";

/** One house on its lot. Scene units for position, metres for sizes. */
export interface HouseLot {
  /** World-absolute scene position of the footprint centre, and its seat height. */
  x: number; y: number; z: number;
  /** Rotation about +Y (three.js); the door faces local +Z. */
  yaw: number;
  /** Footprint along local X / Z and eave height, metres (houses: 6–10 m). */
  w: number; d: number; h: number;
  family: HouseFamily;
  /** Foundation skirt below the seat, metres (slope: seat minus lowest ground). */
  foundation: number;
  /** Linear RGB tints (saturation ≤ 35 %, bible §1.1.3); defaults per family. */
  wall?: Rgb;
  roof?: Rgb;
  /** Winter snow on roofs (0–1): the North and beyond the Wall answer winter. */
  snow?: number;
  /** Roof ridge height as a fraction of the span; defaults per family. */
  ridge?: number;
  /** Flat-dome houses: draw the small dome. */
  dome?: boolean;
  /** Wall finish: bare masonry (`stone`) or lime plaster / daub (`plaster`); defaults per family. */
  finish?: "plaster" | "stone";
}

export interface HouseLotInstance {
  /** Pool variant (near/mid levels): "house-gable" | "house-tall" | "house-court" | "house-flat". */
  variant: string;
  /** The same instance for the near and mid levels (the level picks the geometry). */
  instance: KitInstance;
  /** Far roofscape stand-in for one house (`block:far`); cities merge blocks of houses instead. */
  far: KitInstance;
  /** Ridge height above the eave, metres (for far blocks and height rules). */
  ridgeM: number;
}

const families: Record<HouseFamily, { kit: HouseKit; ridge: number; mask: number; wall: Rgb; roof: Rgb }> = {
  "gable-steep": { kit: "gable", ridge: 0.8, mask: kitBits.north, wall: [0.32, 0.31, 0.28], roof: [0.11, 0.1, 0.08] },
  "gable-low": { kit: "gable", ridge: 0.32, mask: kitBits.crown | kitBits.plaster, wall: [0.68, 0.6, 0.45], roof: [0.38, 0.12, 0.06] },
  "flat-dome": { kit: "flat", ridge: 0.3, mask: kitBits.crown | kitBits.plaster, wall: [0.8, 0.72, 0.58], roof: [0.48, 0.24, 0.11] },
  "turf-long": { kit: "gable", ridge: 1, mask: kitBits.north, wall: [0.24, 0.21, 0.17], roof: [0.11, 0.1, 0.06] },
  "tower-house": { kit: "tall", ridge: 0.36, mask: kitBits.crown | kitBits.plaster, wall: [0.68, 0.6, 0.45], roof: [0.34, 0.1, 0.05] },
  hall: { kit: "tall", ridge: 0.62, mask: kitBits.north, wall: [0.3, 0.29, 0.27], roof: [0.08, 0.07, 0.06] },
  court: { kit: "court", ridge: 0.34, mask: kitBits.crown | kitBits.plaster, wall: [0.68, 0.6, 0.45], roof: [0.4, 0.15, 0.08] }
};

/** Pool variant of a house kit. */
export const houseVariant = (kit: HouseKit): string => `house-${kit}`;

/** Converts one physical lot into pool instances (no state, deterministic). */
export function houseLotInstance(lot: HouseLot): HouseLotInstance {
  const family = families[lot.family];
  const kit = houseKits[family.kit];
  const w = lot.w / METRES, d = lot.d / METRES, h = lot.h / METRES;
  const sx = w / kit.w, sy = h / kit.h, sz = d / kit.d;
  const ratio = lot.ridge ?? family.ridge;
  const wall = lot.wall ?? family.wall, roof = lot.roof ?? family.roof, snow = lot.snow ?? 0;
  const finish = lot.finish == "stone" ? family.mask & ~kitBits.plaster : lot.finish == "plaster" ? family.mask | kitBits.plaster : family.mask;
  const mask = finish | (lot.dome ? kitBits.dome : 0);
  const foundation = Math.max(0, lot.foundation) / METRES;
  const instance: KitInstance = {
    x: lot.x, y: lot.y, z: lot.z, yaw: lot.yaw, sx, sy, sz, depth: foundation / sy, wall, roof, mask,
    pitch: family.kit == "flat" ? 1 : roofPitch(family.kit, ratio, sy, sz), snow
  };
  const ridgeM = family.kit == "flat" ? 0 : ratio * (family.kit == "tall" ? lot.w : lot.d);
  return { variant: houseVariant(family.kit), instance, far: blockInstance(lot.x, lot.y, lot.z, lot.yaw, lot.w, lot.d, lot.h, ridgeM, lot.foundation, wall, roof, snow), ridgeM };
}

/**
 * Far roofscape block (`block:far`): a box `w × d × h` metres with a gable of
 * `ridgeM` along local X (0 = flat top), seated at `y` (scene units) with
 * `foundationM` of skirt. Used for house blocks, curtain pieces and towers.
 */
export function blockInstance(x: number, y: number, z: number, yaw: number, wM: number, dM: number, hM: number, ridgeM: number, foundationM: number,
  wall: Rgb, roof: Rgb, snow = 0): KitInstance {
  const sx = wM / METRES, sy = hM / METRES, sz = dM / METRES;
  return { x, y, z, yaw, sx, sy, sz, depth: Math.max(0, foundationM) / METRES / sy, wall, roof, mask: 0, pitch: Math.max(0, ridgeM / METRES) / (0.5 * sy), snow };
}

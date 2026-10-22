/**
 * Camera distance bands and ground-camera rules of World ×20
 * (docs/v3-world-scale-design.md §2.5). Distances are physical metres, so a
 * band means the same at k = 1 and k = 20; only the framings that cover the
 * map (Play, board, world) grow with k.
 */
import { mapUnits, METRES_PER_UNIT, SceneFrame } from "./SceneFrame";

export type CameraBand = "ground" | "local" | "regional" | "realm" | "map";

/** Upper limit of each band, metres of camera-to-target distance (§2.5). */
export const BAND_LIMITS_METRES: ReadonlyArray<readonly [CameraBand, number]> = [
  ["ground", 30], ["local", 600], ["regional", 3000], ["realm", 12500], ["map", Infinity]
];

/** Band of a camera distance in scene units (independent of k: metres are physical). */
export function bandOf(distance: number): CameraBand {
  const metres = distance * METRES_PER_UNIT;
  for (const [band, limit] of BAND_LIMITS_METRES) if (metres < limit) return band;
  return "map";
}

/** Ground camera («mirar alrededor», decision 3 and director decision 2). */
export const GROUND = Object.freeze({
  /** Below this eye height over the floor the orbit hands over to look-around. */
  enterMetres: 30,
  /** Look-around hands back to the orbit above this height (20 % hysteresis). */
  exitMetres: 36,
  /** Eye clearance over terrain or water. */
  eyeMetres: 2,
  /** Walking/flying speed, linear in eye height: 4 m/s at 2 m → 25 m/s at 30 m. */
  slowMetresPerSecond: 4,
  fastMetresPerSecond: 25,
  /** Pitch limits, degrees (negative looks down). */
  minPitchDeg: -70,
  maxPitchDeg: 35,
  /** Keyboard look rate, degrees per second. */
  lookDegPerSecond: 70,
  /** Closest orbit distance in the scaled World: the orbit can reach the ground band at any tilt. */
  orbitMinMetres: 20
});

/** Look-around speed (scene units per second) at an eye height over the floor. */
export function groundSpeed(frame: SceneFrame, eyeHeight: number): number {
  const metres = eyeHeight * frame.metresPerUnit;
  const t = Math.max(0, Math.min(1, (metres - GROUND.eyeMetres) / (GROUND.enterMetres - GROUND.eyeMetres)));
  return frame.m(GROUND.slowMetresPerSecond + (GROUND.fastMetresPerSecond - GROUND.slowMetresPerSecond) * t);
}

/**
 * Reference framings of §2.5 for a frame, in scene units (documentation and
 * harness checks; the live framings are solved from the board in
 * TabletopScene). At k = 20: Play ≈ 132 u (6.6 km), board ≈ 440 u (22 km),
 * world ≈ 770 u (38.6 km), max 940 u (47 km).
 */
export function referenceFramings(frame: SceneFrame): { play: number; board: number; world: number; max: number } {
  return { play: mapUnits(frame, 6.6), board: mapUnits(frame, 22), world: mapUnits(frame, 38.6), max: mapUnits(frame, 47) };
}

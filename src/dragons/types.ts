import type { Group, Vector3 } from "three";

export type DragonTier = "high" | "balanced" | "low";

export interface DragonPalette {
  scales: string;
  membrane: string;
  bone: string;
  horn: string;
  eye: string;
  belly: string;
}

export interface CreateDragonOptions {
  house: string;
  palette?: DragonPalette;
  tier: DragonTier;
  /** When true, only a slow grounded idle runs. */
  reducedMotion?: boolean;
}

export interface FireBreathPayload {
  origin: Vector3;
  direction: Vector3;
  house: string;
}

export type FireBreathHandler = (payload: FireBreathPayload) => void;

export interface DragonStats {
  tier: DragonTier;
  triangles: number;
  drawCalls: number;
  bones: number;
  state: DragonFlightState;
  disposed: boolean;
}

export type DragonFlightState =
  | "grounded"
  | "takeoff"
  | "patrol"
  | "transit"
  | "hover"
  | "landing";

export interface LivingDragon {
  readonly object: Group;
  patrol(center: Vector3, radius: number, altitude: number): void;
  flyTo(pos: Vector3, durationMs: number): void;
  land(pos: Vector3): void;
  update(dtMs: number): void;
  setPaused(paused: boolean): void;
  setReducedMotion(reduced: boolean): void;
  /** Pose-only control for the region-bound public presentation layer. */
  setAirborne(airborne: boolean): void;
  /** Placeholder: emits a public fire-breath event; VFX owned elsewhere. */
  breathFire(): void;
  setFireBreathHandler(handler: FireBreathHandler | null): void;
  stats(): DragonStats;
  dispose(): void;
}

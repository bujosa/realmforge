/**
 * Strategic size law (docs/v3-world-scale-design.md §2.5, decision 2).
 *
 * Close up (d ≤ d_c) a castle, army, ship or dragon keeps its physical size.
 * Further away it is the board miniature with a screen height
 * `H(d) = P_c · (d_c / d)^0.2`, never below a per-kind floor, where
 * `d_c = h_physical / (P_c · ρ₁)` and `ρ₁` is the world size of one screen
 * pixel per unit of distance. d_c depends on the object, not on k.
 *
 * Everything here is pure (no three.js, no DOM) and only used when the World
 * frame has k > 1 (`?worldScale=20`): at k = 1 the callers keep today's code.
 */

import { METRES_PER_UNIT } from "./SceneFrame";

export type StrategicKind = "castle" | "stronghold" | "capital" | "army" | "ship" | "dragon";

export interface StrategicSpec {
  /** Screen height at d_c (CSS px). */
  readonly pc: number;
  /** Physical reference size (metres): keep height for castles, block width for armies. */
  readonly metres: number;
  /** Screen floor of the miniature (CSS px). */
  readonly minPx: number;
}

/**
 * §2.5 table. P2b retune for castles (World ×20 screenshots: 15–23 px grey
 * miniatures vanished into the land at 9–30 km): the reference heights are
 * the live castle meshes measured at k = 20 (level-1 castles 12–25 m, median
 * 22 m; strongholds 17–33 m, median 26 m; the King's Landing keep 16 m inside
 * its city), and the strategic floors match the 28–40 px tokens beside them.
 */
export const STRATEGIC_SPECS: Readonly<Record<StrategicKind, StrategicSpec>> = {
  castle: { pc: 36, metres: 22, minPx: 30 },
  stronghold: { pc: 40, metres: 26, minPx: 34 },
  capital: { pc: 46, metres: 30, minPx: 40 },
  army: { pc: 44, metres: 50, minPx: 28 },
  ship: { pc: 40, metres: 30, minPx: 28 },
  dragon: { pc: 48, metres: 60, minPx: 32 }
};

/** Camera parameters the law needs; `fov` is the vertical FOV in degrees. */
export interface ViewMetrics { fov: number; height: number }

/** Reference view of the design document: FOV 38°, 900 px tall. */
export const REFERENCE_VIEW: ViewMetrics = { fov: 38, height: 900 };

/** Exponent of the strategic growth law. */
export const SIZE_LAW_EXPONENT = 0.2;

/** World units covered by one CSS pixel per unit of camera distance (ρ₁). */
export function pixelPerDistance(view: ViewMetrics): number {
  return view.height > 0 ? 2 * Math.tan(view.fov * Math.PI / 360) / view.height : 0;
}

/** World units covered by one CSS pixel at `distance`. */
export function pixelAt(distance: number, view: ViewMetrics): number {
  return Math.max(0, distance) * pixelPerDistance(view);
}

/** Physical reference size of a kind, in scene units (k independent). */
export function physicalUnits(kind: StrategicKind): number {
  return STRATEGIC_SPECS[kind].metres / METRES_PER_UNIT;
}

/**
 * Switch distance d_c in scene units for this view. `units` is the height of
 * the actual mesh at its physical scale (defaults to the kind's reference).
 */
export function criticalDistance(kind: StrategicKind, view: ViewMetrics = REFERENCE_VIEW, units = physicalUnits(kind)): number {
  const rho = pixelPerDistance(view);
  return rho > 0 ? units / (STRATEGIC_SPECS[kind].pc * rho) : Infinity;
}

/** Screen height (px) of the board miniature at `distance` (d ≥ d_c). */
export function boardPixels(kind: StrategicKind, distance: number, view: ViewMetrics = REFERENCE_VIEW, units = physicalUnits(kind)): number {
  const spec = STRATEGIC_SPECS[kind];
  const dc = criticalDistance(kind, view, units);
  if (!(distance > dc)) return spec.pc;
  return Math.max(spec.minPx, spec.pc * Math.pow(dc / distance, SIZE_LAW_EXPONENT));
}

/**
 * World size (scene units) the object should have at `distance`: physical
 * below d_c, the board law above it. Continuous at d_c.
 */
export function strategicUnits(kind: StrategicKind, distance: number, view: ViewMetrics = REFERENCE_VIEW, units = physicalUnits(kind)): number {
  const dc = criticalDistance(kind, view, units);
  if (!(distance > dc)) return units;
  return Math.max(units, boardPixels(kind, distance, view, units) * pixelAt(distance, view));
}

/**
 * Multiplier over the physical size (≥ 1). Apply it to a mesh already at
 * physical scale. Pass the mesh's own height at that scale as `units` when it
 * is known (a castle sculpt is 12–36 m, not its kind's reference), so every
 * mesh reaches the same screen height.
 */
export function sizeLawFactor(kind: StrategicKind, distance: number, view: ViewMetrics = REFERENCE_VIEW, units?: number): number {
  const height = units != undefined && units > 0 ? units : physicalUnits(kind);
  return strategicUnits(kind, distance, view, height) / height;
}

/**
 * P3 hand-over below the regional band (World ×20). H(d) keeps a piece at
 * ~40 px wherever it is, so with the camera over a city a piece 3–6 km
 * from the eye grew to 100–270 m: a grey tower over the houses. The world
 * height of a unit miniature is capped by the camera-to-target distance D:
 * ≤ 72 m (2× the tallest keeps, ~36 m) with the target 2 km away, shrinking
 * to a 16 m standard-bearer group at close/ground; beyond 2 km the cap grows
 * linearly (≥ 200 m from 6 km), so the regional and strategic bands keep the
 * pure law. Identity stays on the screen-space labels and the 44 px pick.
 */
export const PRESENCE_CAP = Object.freeze({
  /** Target distance (m) at and below which the close cap applies. */
  closeMetres: 150,
  /** Cap (m) at close/ground. */
  closeHeight: 16,
  /** Target distance (m) of the local cap; linear growth beyond it. */
  localMetres: 2000,
  /** Cap (m) at the local distance. */
  localHeight: 72
});

/** Smallest world height (m) of an army piece in the World ×20: a standard-bearer group, not a 1.7 m figure. */
export const STANDARD_BEARER_METRES = 14;

/** Dragons span 40–60 m (§3): their cap is 1.5× the army cap. */
const PRESENCE_SCALE: Readonly<Record<StrategicKind, number>> = {
  castle: 1, stronghold: 1, capital: 1, army: 1, ship: 1, dragon: 1.5
};

/** Cap on a unit miniature's world height (metres) for a camera-to-target distance in metres. */
export function presenceCapMetres(targetMetres: number, kind: StrategicKind = "army"): number {
  const { closeMetres, closeHeight, localMetres, localHeight } = PRESENCE_CAP;
  const d = Math.max(0, targetMetres);
  const t = Math.max(0, Math.min(1, (d - closeMetres) / (localMetres - closeMetres)));
  const cap = d >= localMetres ? localHeight * d / localMetres : closeHeight + (localHeight - closeHeight) * t * t * (3 - 2 * t);
  return cap * PRESENCE_SCALE[kind];
}

/** Castle class of a region (C1 castle, C2 stronghold, capital or signature seat). */
export function castleKind(level: number, capital = false): StrategicKind {
  return capital ? "capital" : level > 1 ? "stronghold" : "castle";
}

/** Strategic class of a unit type. */
export function unitKind(type: string): StrategicKind {
  return type == "ship" ? "ship" : type == "dragon" ? "dragon" : "army";
}


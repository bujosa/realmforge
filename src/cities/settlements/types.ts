import * as THREE from "three";
type QualityTier = "high" | "balanced" | "low";
import AssetMaterials from "../../materials/AssetMaterials";

export type CityId = "kings-landing" | "winterfell";
export type CityTier = QualityTier;
/** far: one merged silhouette; mid: simplified instances; near: full kit. */
export type CityDetail = "far" | "mid" | "near";
export type Vec2 = [number, number];

/**
 * Absolute world XZ in the active SceneFrame. Nothing is placed inside the
 * shape. Inside `halo` only pieces lower than `clearHeight` remain, so tall
 * towers/landmarks cannot hide a unit stack, banner or resource ornament.
 */
export type CityExclusion =
  | { kind: "circle"; x: number; z: number; radius: number; halo?: number; clearHeight?: number }
  | { kind: "rect"; x: number; z: number; halfWidth: number; halfDepth: number; angle?: number; halo?: number; clearHeight?: number };

export interface CityKeep {
  /** Existing landscape castle anchor (CastlePlacement.anchor), world units. */
  x: number;
  z: number;
  /** World half-extents of the castle sculpt; reserved as a hard exclusion. */
  footprint?: Vec2;
  /** Castle sculpt scale (CastlePlacement.scale); used by `embedKeep`. */
  scale?: number;
}

export interface CityFrame {
  center: { x: number; z: number };
  /** World units per normalized layout unit. */
  radius: number;
  /** Rotation of the authored layout about +Y (Three convention). */
  yaw: number;
}

/**
 * World ×20: the plan is laid out in a board-scale "plan space" and every
 * output (instances, static geometry, gates, frame, LOD) is magnified about
 * `origin` by `factor`. With it, every CityOptions input is in plan space
 * (`magnifyToPlan` maps world inputs). Absent at k = 1.
 */
export interface CityMagnify {
  /** World XZ fixed point (the keep anchor). */
  origin: { x: number; z: number };
  factor: number;
}

export interface CityOptions {
  tier: CityTier;
  magnify?: CityMagnify;
  /** Absolute world terrain height at world XZ. Everything is seated on it. */
  heightAt(x: number, z: number): number;
  /**
   * Optional heights of the rendered terrain meshes at world XZ (one per LOD
   * grid). Pieces seat on the highest and root to the lowest of these and
   * `heightAt`, so a coarse grid on a steep shore never shows a tall plinth.
   */
  groundAt?(x: number, z: number): number[];
  exclusions?: CityExclusion[];
  keep?: CityKeep;
  /** Overrides the frame derived from `keep` and the authored defaults. */
  frame?: Partial<CityFrame>;
  /** Region polygon, world XZ. Houses outside it are not placed. */
  boundary?: Vec2[];
  /** Optional open-water test; drops houses there and places piers in it. */
  isWater?(x: number, z: number): boolean;
  /** Also draw the signature keep (castleGeometry) for standalone previews. */
  embedKeep?: boolean;
  detail?: CityDetail;
  /** Registers the shared ambientCG masonry/timber maps, as castles do. */
  assets?: AssetMaterials;
  /**
   * World ×20: plan in resumable slices driven by CityHandle.advance (the
   * city appears, or keeps its previous layout, until its plan completes).
   * Absent (k = 1): every layout is planned synchronously, as before.
   */
  sliced?: boolean;
}

export interface CityStats {
  detail: CityDetail;
  triangles: number;
  drawCalls: number;
  instances: number;
  houses: number;
}

export interface CityGate {
  name: string;
  /** Absolute world position at the threshold, on the ground. */
  position: THREE.Vector3;
  /** Unit world XZ direction pointing out of the city. */
  outward: Vec2;
}

/** Structurally matches realism/lod LodRegistration (index 0 = cheapest). */
export interface CityLodRegistration {
  id: string;
  center: { x: number; y: number; z: number };
  radius: number;
  levels: { minPixels: number; drawCalls: number; triangles: number }[];
  priority?: number;
  apply(level: number): void;
}

export interface CityHandle {
  readonly id: CityId;
  /** Holds the private kit pool of a standalone city; empty with a shared pool. */
  readonly root: THREE.Group;
  readonly frame: CityFrame;
  setDetail(level: CityDetail): void;
  detail(): CityDetail;
  /** Hidden or blocked regions draw nothing (instances and static layer). */
  setVisible(visible: boolean): void;
  visible(): boolean;
  /** Re-runs the deterministic layout; geometry kits are reused. */
  setExclusions(exclusions: CityExclusion[]): void;
  setSeason(dusk: boolean, winter: boolean, full: boolean): void;
  /** Standalone cost of the given (default current) level, from built buffers. */
  stats(level?: CityDetail): CityStats;
  gates(): CityGate[];
  /** A sliced layout is still being planned. */
  pending(): boolean;
  /** Plans until `deadline` (performance.now ms); true when a layout was applied. */
  advance(deadline: number): boolean;
  lodRegistration(): CityLodRegistration;
  dispose(): void;
}

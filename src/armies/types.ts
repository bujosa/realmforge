import type * as THREE from "three";

export const armyTypes = ["footman", "knight", "siege-engine", "ship", "dragon"] as const;
export const armyStates = ["idle", "march", "attack", "charge", "defend", "rout", "retreat", "wounded", "destroyed", "victory"] as const;
export type ArmyType = typeof armyTypes[number];
export type ArmyState = typeof armyStates[number];
export type ArmyDetail = "high" | "balanced" | "low";
export type ArmyPoint = { x: number; y?: number; z: number };
export interface ArmyOptions {
  type: ArmyType;
  /** Host-supplied heraldry key; register sources before creating the batch. */
  house?: string;
  color: THREE.ColorRepresentation;
  position?: ArmyPoint;
  /** Radians; zero faces -Z. */
  heading?: number;
  scale?: number;
  presentation?: "world" | "table";
  plinth?: boolean;
  seed?: number;
  lod?: "near" | "far" | "auto";
}
export interface ArmyStateOptions {
  path?: readonly ArmyPoint[];
  duration?: number;
  transition?: number;
}
export interface ArmyBatchOptions {
  renderer?: THREE.WebGLRenderer;
  detail?: ArmyDetail;
  /** Maximum live companies of each type, across both LODs. */
  capacityPerType?: number;
}

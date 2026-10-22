import type * as THREE from "three";
export interface Point { x: number; y: number }
export interface CastlePlacement {
  kind: string; scale: number; anchor: THREE.Vector3; torches: THREE.Vector3[]; chimney?: THREE.Vector3;
  resourceDisplay?: { supply: THREE.Vector3; power: THREE.Vector3 };
}
export interface ResourceSnapshot {
  regions: { visible: boolean; region: { id: string; isBlocked: boolean }; supplyIcons: number; crownIcons: number }[];
}

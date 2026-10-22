import * as THREE from "three";

export type ControlValue = string | number | boolean;
export type Control =
  | { type: "select"; label: string; default: string; options: string[] }
  | { type: "number"; label: string; default: number; min: number; max: number; step?: number }
  | { type: "boolean"; label: string; default: boolean }
  | { type: "colour"; label: string; default: string };
export interface Story {
  id: string;
  title: string;
  category: string;
  description?: string;
  controls?: Record<string, Control>;
  build(context: StoryContext): StoryInstance;
}
export interface StoryContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  values: Record<string, ControlValue>;
}
export interface StoryInstance {
  object: THREE.Object3D;
  /** Optional asset readiness; geometry is visible through its procedural fallback while loading. */
  ready?(): boolean;
  update?(deltaSeconds: number, elapsedSeconds: number): void;
  /** Release resources owned outside the returned object (atlases, listeners, etc.). */
  dispose?(): void;
}
const stories: Story[] = [];
export function registerStories(...entries: Story[]): void {
  for (const entry of entries) {
    if (stories.some(story => story.id === entry.id)) throw new Error(`Duplicate story id ${entry.id}`);
    stories.push(entry);
  }
}
export function allStories(): readonly Story[] { return stories; }

/** Geometry/material lifecycle is owned by the gallery; builders may share resources within a story. */
export function releaseObject(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
    if (child instanceof THREE.InstancedMesh) child.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

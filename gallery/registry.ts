import type * as THREE from "three";

/** A gallery entry: one component in one configuration that can be QA'd in isolation. */
export interface Story {
  id: string;
  title: string;
  category: string;
  /** Build the object; return an optional per-frame update and dispose hook. */
  build(context: StoryContext): StoryInstance;
}

export interface StoryContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export interface StoryInstance {
  object: THREE.Object3D;
  update?(deltaSeconds: number, elapsedSeconds: number): void;
  dispose?(): void;
}

const stories: Story[] = [];

export function registerStories(...entries: Story[]): void {
  for (const entry of entries) {
    if (stories.some(story => story.id == entry.id)) throw new Error(`Duplicate story id ${entry.id}`);
    stories.push(entry);
  }
}

export function allStories(): readonly Story[] {
  return stories;
}

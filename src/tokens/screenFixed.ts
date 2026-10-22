import * as THREE from "three";
import { sizeLawFactor, StrategicKind, ViewMetrics } from "../core/SizeLaw";

/**
 * Self-updating helpers for objects that must keep a screen size or follow
 * the strategic size law without a per-frame hook in the scene. They run in
 * `onBeforeRender` (and `onBeforeShadow`), where three.js computes the
 * model-view matrix right after the callback, so the new transform is the
 * one drawn in this pass. Only installed when the World frame has k > 1.
 */

let size: THREE.Vector2 | undefined;

function viewOf(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): ViewMetrics | null {
  if (!camera || !(camera.fov > 0)) return null;
  size ??= new THREE.Vector2();
  renderer.getSize(size);
  return { fov: camera.fov, height: size.y };
}

/**
 * A non-attenuated sprite `px` CSS pixels tall (`aspect` = width / height).
 * With `sizeAttenuation: false`, three.js multiplies the sprite scale by the
 * view depth, so a scale of `px · 2·tan(fov/2) / viewportHeight` is exactly
 * `px` on screen at any distance.
 */
export function holdScreenSize(sprite: THREE.Sprite, px: number | (() => number), aspect = 1, visibleWithin?: number): void {
  const material = sprite.material;
  material.sizeAttenuation = false;
  // Screen UI never takes the World ×20 aerial fog (it would swallow it).
  material.fog = false;
  material.needsUpdate = true;
  sprite.frustumCulled = false;
  const base = material.opacity;
  sprite.onBeforeRender = (renderer, _scene, camera) => {
    const view = viewOf(renderer, camera as THREE.PerspectiveCamera);
    if (!view || !(view.height > 0)) return;
    const pixels = typeof px == "function" ? px() : px;
    const height = pixels * 2 * Math.tan(view.fov * Math.PI / 360) / view.height;
    sprite.scale.set(height * aspect, height, 1);
    if (visibleWithin != undefined) {
      const distance = camera.getWorldPosition(new THREE.Vector3()).distanceTo(sprite.getWorldPosition(new THREE.Vector3()));
      material.opacity = distance <= visibleWithin ? base : 0;
    }
    sprite.updateMatrixWorld();
  };
}

/**
 * Grows a physical-size mesh by the strategic size law around its own
 * origin (its foot on the ground). `baseScale` is the physical scale.
 * `onScaled(factor)` lets the owner move attachments (labels, banners);
 * `before()` runs first (re-seating on a changed ground).
 */
export function followSizeLaw(mesh: THREE.Mesh, kind: StrategicKind, baseScale: number, onScaled?: (factor: number) => void, before?: () => void): void {
  mesh.frustumCulled = false;
  const position = new THREE.Vector3();
  const apply = (renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void => {
    before?.();
    const view = viewOf(renderer, camera as THREE.PerspectiveCamera);
    if (!view || !(view.height > 0)) return;
    mesh.getWorldPosition(position);
    const factor = sizeLawFactor(kind, camera.getWorldPosition(new THREE.Vector3()).distanceTo(position), view);
    mesh.scale.setScalar(baseScale * factor);
    mesh.updateMatrixWorld();
    onScaled?.(factor);
  };
  mesh.onBeforeRender = (renderer, _scene, camera) => apply(renderer, camera as THREE.PerspectiveCamera);
  mesh.onBeforeShadow = (renderer, _object, camera) => apply(renderer, camera as THREE.PerspectiveCamera);
}

/** Touch screens use the larger token sizes. */
export function coarsePointer(): boolean {
  return typeof window != "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
}

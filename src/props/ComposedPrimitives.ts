import * as THREE from "three";

/** Geometry, shade multiplier, and whether it takes the instance's roof tint. */
export type Part = [THREE.BufferGeometry, number] | [THREE.BufferGeometry, number, boolean];

export const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
export const cyl = (top: number, bottom: number, h: number, segments: number, x = 0, y = 0, z = 0): THREE.BufferGeometry => new THREE.CylinderGeometry(top, bottom, h, segments).translate(x, y + h / 2, z);
export const cone = (r: number, h: number, segments: number, x = 0, y = 0, z = 0): THREE.BufferGeometry => new THREE.ConeGeometry(r, h, segments).translate(x, y + h / 2, z);

/** Timber or rope between explicit endpoints, without Euler-angle guesswork. */
export function beam(a: [number, number, number], b: [number, number, number], radius: number, segments = 5): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
  return new THREE.CylinderGeometry(radius, radius, delta.length(), segments)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()))
    .translate(...from.add(to).multiplyScalar(0.5).toArray());
}

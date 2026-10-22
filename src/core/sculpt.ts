import * as THREE from "three";

// Vertex paint survives merging and instancing, without material groups/draws.
export function paintGeometry(
  geometry: THREE.BufferGeometry,
  color: string
): THREE.BufferGeometry {
  const paint = new THREE.Color(color);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = paint.r;
    colors[i * 3 + 1] = paint.g;
    colors[i * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

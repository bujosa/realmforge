import * as THREE from "three";

// Shallow cavity shading and a shared object-space UV scale, baked once before
// instancing. Keep painted house colours and raised emblems in the same draw.
export function finishGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const colors = geometry.getAttribute("color");
  const uv = new Float32Array(positions.count * 2);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    minY = Math.min(minY, positions.getY(i));
    maxY = Math.max(maxY, positions.getY(i));
  }
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const upward = normals.getY(i);
    const height = (y - minY) / Math.max(0.01, maxY - minY);
    const occlusion = 0.78 + 0.14 * Math.min(1, height * 3) + 0.08 * Math.max(0, upward);
    colors.setXYZ(i, colors.getX(i) * occlusion, colors.getY(i) * occlusion, colors.getZ(i) * occlusion);
    // Box projection avoids stretched grain on tall towers and troop armour.
    uv[i * 2] = (Math.abs(normals.getX(i)) > 0.7 ? positions.getZ(i) : positions.getX(i)) * 3;
    uv[i * 2 + 1] = (Math.abs(upward) > 0.7 ? positions.getZ(i) : y) * 3;
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

export function bevelBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  const bevel = Math.min(width, height, depth) * 0.13;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + bevel, -height / 2 + bevel);
  shape.lineTo(width / 2 - bevel, -height / 2 + bevel);
  shape.lineTo(width / 2 - bevel, height / 2 - bevel);
  shape.lineTo(-width / 2 + bevel, height / 2 - bevel);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    steps: 1
  }).translate(0, 0, -depth / 2 + bevel);
}

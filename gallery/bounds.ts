import * as THREE from "three";

/** Include the city shader's per-instance roof pitch, which three.js CPU bounds cannot see. */
export function visualBounds(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  const result = new THREE.Box3().setFromObject(object);
  const matrix = new THREE.Matrix4(), world = new THREE.Matrix4();
  object.traverse(child => {
    if (!(child instanceof THREE.InstancedMesh)) return;
    const shape = child.geometry.getAttribute("kitShape"), kit = child.geometry.getAttribute("cityKit");
    if (!shape || !kit || !child.count) return;
    child.geometry.computeBoundingBox();
    const base = child.geometry.boundingBox;
    if (!base) return;
    let roofRise = 0;
    for (let vertex = 0; vertex < shape.count; vertex++) roofRise = Math.max(roofRise, shape.getX(vertex));
    for (let index = 0; index < child.count; index++) {
      const extra = roofRise * (kit.getY(index) - 1);
      const box = base.clone();
      box.max.y += Math.max(0, extra); box.min.y += Math.min(0, extra);
      child.getMatrixAt(index, matrix); world.multiplyMatrices(child.matrixWorld, matrix);
      result.union(box.applyMatrix4(world));
    }
  });
  return result;
}

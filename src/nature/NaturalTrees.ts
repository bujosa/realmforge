import * as THREE from "three";

type AddPart = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, color: string, shade?: number) => void;

// Closed, reusable geometry. Placement, density, bounds and lifecycle still belong
// to the landscape; no alpha cards, per-tree meshes, randomness or animation.
export function naturalTree(kind: string, foliage: string, add: AddPart): void {
  const pine = kind == "tree-pine", birch = kind == "tree-birch";
  const bark = birch ? "#b8b5a2" : "#675745";
  const branch = (a: THREE.Vector3, b: THREE.Vector3, radius: number): void => {
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radius * 0.42, radius, direction.length(), 5);
    const rotation = new THREE.Object3D();
    rotation.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    rotation.updateMatrix(); geometry.applyMatrix4(rotation.matrix);
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    add(geometry, midpoint.x, midpoint.y, midpoint.z, bark);
  };
  branch(new THREE.Vector3(), new THREE.Vector3(0.005, pine ? 0.29 : 0.215, -0.003), birch ? 0.009 : 0.012);
  const crown = (x: number, y: number, z: number, rx: number, ry: number, rz: number, seed: number): void => {
    const geometry = new THREE.SphereGeometry(1, 6, pine ? 3 : 4);
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
      const irregular = 1 + Math.sin(px * 7 + py * 4 + seed) * 0.10 + Math.cos(pz * 8 - py * 3 + seed * 2) * 0.07;
      positions.setXYZ(i, px * rx * irregular, py * ry * irregular, pz * rz * irregular);
    }
    geometry.computeVertexNormals();
    add(geometry, x, y, z, foliage, 0.82 + (Math.sin(seed * 4.7) + 1) * 0.14);
  };
  if (pine) {
    // Branch ends carry needle clusters, with daylight between each whorl.
    // The silhouette tapers without stacking solid Christmas-tree cones.
    for (let tier = 0; tier < 5; tier++) {
      const y = 0.093 + tier * 0.041, radius = 0.046 - tier * 0.008;
      for (let side = 0; side < 3; side++) {
        const angle = side * Math.PI * 2 / 3 + tier * 1.37;
        const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
        branch(new THREE.Vector3(0, y + 0.018, 0), new THREE.Vector3(x, y - 0.009, z), 0.0038 - tier * 0.0005);
        crown(x, y, z, radius * 0.86, 0.013 - tier * 0.001, radius * 0.70, tier * 3 + side);
      }
    }
    add(new THREE.ConeGeometry(0.014, 0.068, 7, 2), 0.004, 0.288, -0.002, foliage, 1.04);
  } else {
    const count = birch ? 9 : 11;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996;
      const radius = (i % 3 == 0 ? 0.018 : 0.049) * (birch ? 0.72 : 1);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius * 0.82;
      const y = (birch ? 0.19 : 0.18) + (i % 4) * (birch ? 0.025 : 0.021);
      if (i % 2 == 0) branch(new THREE.Vector3(0.003, 0.135 + i * 0.003, 0), new THREE.Vector3(x, y, z), birch ? 0.003 : 0.005);
      crown(x, y, z, birch ? 0.026 : 0.038, birch ? 0.043 : 0.029, birch ? 0.026 : 0.035, i + 23);
    }
  }
}

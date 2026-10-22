import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";

// Original study of the screen godswood, rather than a surveyed reconstruction.
// The pale heart tree and red crown survive both LODs. Its narrow ground court
// lies between Winterfell's existing inner and outer east curtains; branches
// only spread over the wall after rising above its parapet.
export function winterfellGodswood(b: CastleBuilder): void {
  const x = 0.183, z = 0.040, floor = 0.022;
  b.box(0.035, 0.002, 0.108, x, 0.021, 0.035, "#35483c", 0, 7);
  const branch = (a: number[], c: number[], radius: number): void => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...c);
    const delta = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius * 0.62, radius, delta.length(), b.detailed ? 8 : 5);
    const rotation = new THREE.Object3D();
    rotation.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    rotation.updateMatrix(); geometry.applyMatrix4(rotation.matrix);
    const center = from.add(to).multiplyScalar(0.5);
    b.add(geometry, center.x, center.y, center.z, "#cdcabc", 0, 2);
  };
  const trunk = [[x, floor, z], [x - 0.003, 0.10, z + 0.005], [x + 0.002, 0.255, z + 0.003], [x - 0.003, 0.310, z]];
  for (let i = 0; i < trunk.length - 1; i++) branch(trunk[i], trunk[i + 1], 0.009 - i * 0.0017);
  // Buttress roots reach the moss, without crossing either curtain footing.
  [[-0.010, 0.008], [0.010, 0.006], [-0.008, -0.011], [0.009, -0.012]].forEach(([dx, dz]) =>
    branch([x, floor + 0.028, z], [x + dx, floor, z + dz], 0.004));
  const crowns = [
    [-0.029, 0.320, -0.004, 0.027], [0.028, 0.323, -0.002, 0.029],
    [-0.017, 0.326, 0.022, 0.026], [0.022, 0.324, 0.021, 0.026],
    [0.001, 0.333, -0.018, 0.028]
  ];
  crowns.forEach(([dx, y, dz, radius], index) => {
    const joint = [x + dx * 0.45, 0.293 + index % 2 * 0.007, z + dz * 0.4];
    branch(trunk[2], joint, 0.0045);
    branch(joint, [x + dx, y, z + dz], 0.0035);
    const crown = new THREE.SphereGeometry(radius, b.detailed ? 12 : 8, b.detailed ? 5 : 4);
    const points = crown.getAttribute("position");
    for (let i = 0; i < points.count; i++) {
      const px = points.getX(i), py = points.getY(i), pz = points.getZ(i);
      const angle = Math.atan2(pz, px);
      const edge = 1 + 0.09 * Math.sin(angle * 5 + index) + 0.045 * Math.sin(angle * 9 - index);
      const radial = Math.min(1, Math.hypot(px, pz) / radius);
      points.setXYZ(i, px * edge, py * 0.32 + Math.sin(angle * 3 + index) * radius * 0.055 * radial, pz * edge * 0.87);
    }
    crown.computeVertexNormals();
    b.add(crown, x + dx, y, z + dz, index % 2 ? "#8a292d" : "#9f3534", index * 0.7, 7);
    if (b.detailed) {
      // Small pointed leaf sprays break up the edge, instead of pink spheres.
      const leaf = new THREE.Shape();
      leaf.moveTo(0, -0.006); leaf.lineTo(0.002, -0.001); leaf.lineTo(0.004, -0.002);
      leaf.lineTo(0.003, 0.002); leaf.lineTo(0.005, 0.003); leaf.lineTo(0.002, 0.004);
      leaf.lineTo(0, 0.008); leaf.lineTo(-0.002, 0.004); leaf.lineTo(-0.005, 0.003);
      leaf.lineTo(-0.003, 0.002); leaf.lineTo(-0.004, -0.002); leaf.lineTo(-0.002, -0.001); leaf.closePath();
      for (let i = 0; i < 12; i++) {
        const angle = i * 2.39996 + index;
        const r = radius * (i % 3 == 0 ? 0.94 : 0.74);
        const geometry = new THREE.ExtrudeGeometry(leaf, { depth: 0.0007, bevelEnabled: false });
        geometry.rotateX(-0.65 - i % 3 * 0.23).rotateZ(angle);
        b.add(geometry, x + dx + Math.sin(angle) * r, y + Math.sin(i * 1.7) * radius * 0.36,
          z + dz + Math.cos(angle) * r * 0.87, i % 3 ? "#ad3d38" : "#762529", angle, 7);
      }
    }
  });
  if (b.detailed) {
    // Dark recesses suggest the carved face; they do not glow or animate.
    [-1, 1].forEach(side => b.add(new THREE.SphereGeometry(0.002, 6, 4).scale(0.7, 1.4, 0.25),
      x - 0.001 + side * 0.0025, 0.151, z + 0.0107, "#703e39", 0, 7));
    b.add(new THREE.SphereGeometry(0.002, 6, 4).scale(0.6, 1.5, 0.25), x - 0.001, 0.139, z + 0.0108, "#653b35", 0, 7);
  }
  // A small dark pool and one northern evergreen complete the protected court.
  b.add(new THREE.CylinderGeometry(0.009, 0.009, 0.0015, b.detailed ? 18 : 10).scale(1, 1, 1.3),
    x, floor + 0.00075, 0.086, "#263d3d", 0, 4);
  branch([x + 0.002, floor, -0.013], [x + 0.002, 0.15, -0.013], 0.003);
  for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry(0.011 - i * 0.003, 0.055, b.detailed ? 8 : 5),
    x + 0.002, 0.086 + i * 0.025, -0.013, i % 2 ? "#34483c" : "#3e5142", i * 0.4, 7);
}

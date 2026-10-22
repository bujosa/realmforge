import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";

// Original procedural props, authored in world metres. These have no unit
// bases, house colours, collision, selection or gameplay identity.
export function campGeometry(kind: "hearth" | "camp" | "person"): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, color: string, fire = false): void => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    part.deleteAttribute("uv");
    paintGeometry(part, color);
    part.setAttribute("campFire", new THREE.Float32BufferAttribute(new Float32Array(part.getAttribute("position").count).fill(fire ? 1 : 0), 1));
    parts.push(part);
  };
  const log = (x: number, z: number, yaw: number): void => {
    add(new THREE.CylinderGeometry(0.003, 0.004, 0.036, 6).rotateZ(Math.PI / 2).rotateY(yaw).translate(x, 0.004, z), "#514239");
  };
  if (kind == "hearth") {
    add(new THREE.CylinderGeometry(0.026, 0.031, 0.030, 14).translate(0, -0.010, 0), "#66635d");
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      add(new THREE.SphereGeometry(0.006, 6, 4).scale(1.2, 0.65, 1).translate(Math.sin(angle) * 0.026, 0.005, Math.cos(angle) * 0.026), i % 2 ? "#92948c" : "#737d7b");
    }
    log(0, 0, 0.6); log(0, 0, -0.6);
  } else if (kind == "person") {
    add(new THREE.ConeGeometry(0.009, 0.025, 7).scale(1, 1, 0.75).translate(0, 0.023, 0), "#4a413a");
    add(new THREE.SphereGeometry(0.007, 7, 5).scale(1, 0.85, 0.9).translate(0, 0.038, 0.001), "#574d43");
    add(new THREE.SphereGeometry(0.0035, 6, 4).translate(0, 0.038, 0.006), "#a88e78");
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.0028, 0.003, 0.014, 5).translate(side * 0.0035, 0.007, 0), "#302f2e");
      add(new THREE.CylinderGeometry(0.0025, 0.003, 0.016, 5).rotateZ(side * 0.24).translate(side * 0.010, 0.025, 0), "#655448");
    }
  } else {
    // Four irregular hide shelters around an open hearth. Snow is a separate
    // shallow roof cap, rather than white paint over an entire tent.
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + 0.35;
      const x = Math.sin(angle) * 0.075, z = Math.cos(angle) * 0.075;
      const yaw = -angle + Math.PI;
      const size = i % 2 ? 0.87 : 1;
      add(new THREE.ConeGeometry(0.035 * size, 0.090 * size, 12).rotateY(yaw).translate(x, 0.018 * size, z), i % 2 ? "#81705a" : "#695746");
      add(new THREE.ConeGeometry(0.011 * size, 0.028 * size, 12).rotateY(yaw).translate(x, 0.050 * size, z), "#cbd2ce");
      for (let seam = 0; seam < 5; seam++) {
        const a = seam * Math.PI * 2 / 5;
        add(new THREE.CylinderGeometry(0.0007, 0.0009, 0.087 * size, 4).rotateZ(0.38).rotateY(a).translate(x + Math.cos(a) * 0.017 * size, 0.017 * size, z - Math.sin(a) * 0.017 * size), "#9d896e");
      }
      add(new THREE.CylinderGeometry(0.0018, 0.002, 0.081 * size, 5).translate(x, 0.033 * size, z), "#766854");
      // An inset dark doorway faces the hearth; a short branch lintel makes
      // the opening readable without copying a copyrighted model or texture.
      const dx = -Math.sin(angle), dz = -Math.cos(angle);
      add(new THREE.BoxGeometry(0.014, 0.045, 0.004).rotateY(angle).translate(x + dx * 0.024 * size, 0.002, z + dz * 0.024 * size), "#292b29");
    }
    for (let i = 0; i < 3; i++) {
      add(new THREE.ConeGeometry(0.012 - i * 0.0025, 0.031 - i * 0.003, 7).translate((i - 1) * 0.006, 0.018 + i * 0.005, 0), i == 1 ? "#ffe0a0" : "#e9a04f", true);
    }
    // Supplies and a low timber rack are scenery, never the players' resources.
    for (let i = 0; i < 3; i++) log(0.044, -0.038 + i * 0.008, 0.15);
    for (const x of [0.031, 0.056]) for (const z of [-0.040, -0.020]) add(new THREE.CylinderGeometry(0.002, 0.0025, 0.040, 5).translate(x, -0.010, z), "#514239");
    add(new THREE.SphereGeometry(0.011, 7, 5).scale(1, 1.5, 0.8).translate(-0.045, -0.008, 0.034), "#86765e");
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error("Could not assemble northern camp props");
  return geometry;
}

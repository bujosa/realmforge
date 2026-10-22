import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";

// One small neutral quadruped; variant colour comes from instanceColor.
export function livestockGeometry(): THREE.BufferGeometry {
  const parts: [THREE.BufferGeometry, string][] = [
    [new THREE.SphereGeometry(0.014, 6, 4).scale(1, 0.65, 1.35).translate(0, 0.015, 0), "#d8d0bb"],
    [new THREE.SphereGeometry(0.007, 6, 4).translate(0, 0.019, 0.019), "#c4bba6"],
    [new THREE.BoxGeometry(0.003, 0.013, 0.003).translate(-0.009, 0.006, -0.011), "#928879"],
    [new THREE.BoxGeometry(0.003, 0.013, 0.003).translate(0.009, 0.006, -0.011), "#928879"],
    [new THREE.BoxGeometry(0.003, 0.013, 0.003).translate(-0.009, 0.006, 0.012), "#928879"],
    [new THREE.BoxGeometry(0.003, 0.013, 0.003).translate(0.009, 0.006, 0.012), "#928879"]
  ];
  const colored = parts.map(([part, color]) => {
    const geometry = part.toNonIndexed();
    geometry.deleteAttribute("uv");
    part.dispose();
    return paintGeometry(geometry, color);
  });
  const merged = mergeGeometries(colored);
  colored.forEach(part => part.dispose());
  if (!merged) throw new Error("Could not assemble livestock");
  return merged;
}


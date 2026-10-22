import * as THREE from "three";
import CastleBuilder from "../castles/CastleBuilder";
import type { ComplexPlan } from "./ComplexPlan";
import { dragonstoneCarvings } from "./CrownSeatRecipes";

/** Original faceted basalt carvings. Closed low-poly wings, coiled body,
 * swept neck, long jaws and paired horns; one existing merged castle draw.
 */
export function buildDragonstoneCarvings(b: CastleBuilder, plan: ComplexPlan): void {
  const u = 1 / 50;
  for (const carving of dragonstoneCarvings(plan.structures, plan.fit)) {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number): void => { parts.push(g.translate(x, y, z)); };
    const between = (a: number[], c: number[], radius: number): void => {
      const from = new THREE.Vector3(a[0], a[1], a[2]), to = new THREE.Vector3(c[0], c[1], c[2]), direction = to.clone().sub(from);
      const g = new THREE.CylinderGeometry(radius * 0.65, radius, direction.length(), 6);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
      const mid = from.add(to).multiplyScalar(0.5); add(g, mid.x, mid.y, mid.z);
    };
    add(new THREE.SphereGeometry(1, 8, 4).scale(0.22, 0.18, 0.55), 0, 0.17, 0);
    between([0, 0.2, 0.25], [0, 0.56, 0.39], 0.14);
    between([0, 0.56, 0.39], [0, 0.67, 0.64], 0.11);
    add(new THREE.BoxGeometry(0.21, 0.13, 0.38), 0, 0.67, 0.69);
    add(new THREE.BoxGeometry(0.18, 0.06, 0.32), 0, 0.55, 0.68);
    between([0, 0.16, -0.35], [0.23, 0.16, -0.7], 0.09);
    between([0.23, 0.16, -0.7], [0.42, 0.3, -0.64], 0.045);
    for (const side of [-1, 1]) {
      // Thick, ragged wing membrane, with three ridges fanning from a shoulder.
      const outline = [[0.13, 0.25, 0.15], [0.62, 0.86, -0.08], [1.18, 0.65, -0.24],
        [0.83, 0.34, -0.2], [0.77, 0.12, -0.49], [0.45, 0.23, -0.38], [0.2, 0.1, -0.5]];
      const shape = new THREE.Shape();
      outline.forEach(([x, y], i) => i ? shape.lineTo(x * side, y) : shape.moveTo(x * side, y));
      shape.closePath();
      const wing = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
      add(wing, 0, 0, -0.2);
      for (const tip of [outline[1], outline[2], outline[4]]) between([0.13 * side, 0.25, -0.16], [tip[0] * side, tip[1], -0.16], 0.035);
      between([0.06 * side, 0.72, 0.58], [0.15 * side, 0.89, 0.45], 0.045);
    }
    for (const g of parts) {
      g.scale(carving.size * u, carving.size * u, carving.size * u);
      b.add(g, carving.x * u, (carving.y + plan.lift) * u, carving.z * u, b.palette.stone, carving.angle);
    }
  }
}

import * as THREE from "three";
import { box, cyl, cone, beam, type Part } from "./ComposedPrimitives";

// Original normalized scenery. One merged draw; at most 1,500 triangles/module.
// Details remain geometry/vertex shades so no textures or extra materials are required.
export const COMPOSED_DETAIL_TRIANGLE_BUDGET = 1500;
function ring(radius: number, tube: number, x: number, y: number, z: number, wheel = false): THREE.BufferGeometry {
  const geometry = new THREE.TorusGeometry(radius, tube, 3, 12);
  if (wheel) geometry.rotateY(Math.PI / 2);
  else geometry.rotateX(Math.PI / 2);
  return geometry.translate(x, y, z);
}
function roof(y: number, rise: number, w = 1, d = 1): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.5, 0.5, w, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6)
    .translate(0, 0.25, 0).scale(1, rise / 0.75, d / 0.866).translate(0, y, 0);
}
function framedHouse(inn: boolean): Part[] {
  const h = inn ? 0.72 : 0.62, rise = 1 - h;
  const parts: Part[] = [[box(0.92, h, 0.88), 0.88], [roof(h, rise), 1, true],
    [box(0.98, 0.05, 0.94), 0.64], [box(0.94, 0.045, 0.9, 0, h - 0.05), 0.46]];
  for (const x of [-0.43, 0, 0.43]) for (const z of [-0.448, 0.448]) parts.push([box(0.035, h, 0.025, x, 0, z), 0.43]);
  for (const side of [-1, 1]) {
    parts.push([beam([-0.39, 0.09, side * 0.45], [-0.02, h - 0.07, side * 0.45], 0.014, 4), 0.5]);
    if (inn) for (const x of [-0.24, 0.24]) {
      parts.push([box(0.16, 0.17, 0.018, x, 0.42, side * 0.45), 0.25],
        [box(0.018, 0.18, 0.025, x, 0.415, side * 0.462), 0.71],
        [box(0.17, 0.02, 0.025, x, 0.49, side * 0.462), 0.71]);
    }
  }
  const doorWidth = inn ? 0.16 : 0.44;
  parts.push([box(doorWidth, 0.38, 0.024, inn ? 0.15 : 0, 0.02, 0.453), 0.38]);
  for (let k = 0; k < (inn ? 3 : 7); k++) parts.push([box(0.007, 0.35, 0.01, (inn ? 0.09 : -0.19) + k * 0.06, 0.03, 0.469), 0.58]);
  parts.push([box(doorWidth + 0.06, 0.035, 0.035, inn ? 0.15 : 0, 0.40, 0.457), 0.52]);
  if (inn) {
    parts.push([box(0.12, 0.3, 0.13, -0.27, 0.68, -0.17), 0.7], [box(0.15, 0.04, 0.16, -0.27, 0.96, -0.17), 0.5],
      [box(0.18, 0.13, 0.04, -0.28, 0.26, 0.49), 0.65], [beam([-0.36, 0.49, 0.45], [-0.36, 0.49, 0.58], 0.014), 0.4]);
  } else {
    parts.push([box(0.01, 0.38, 0.032, 0, 0.02, 0.47), 0.5], [box(0.16, 0.09, 0.02, 0, 0.48, 0.453), 0.28]);
  }
  return parts;
}
function wheel(x: number, y: number, z: number, radius: number): Part[] {
  const parts: Part[] = [[ring(radius, 0.022, x, y, z, true), 0.43], [beam([x - 0.04, y, z], [x + 0.04, y, z], 0.045, 8), 0.65]];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    parts.push([beam([x, y, z], [x, y + Math.sin(a) * radius, z + Math.cos(a) * radius], 0.012, 4), 0.73]);
  }
  return parts;
}
export const detailedBuilders: Record<string, () => Part[]> = {
  barn: () => framedHouse(false),
  inn: () => framedHouse(true),
  "boat-small": () => {
    const parts: Part[] = [];
    const stations = [[-0.49, 0.025], [-0.31, 0.37], [0.24, 0.41], [0.49, 0.015]];
    // Four clinker courses with an open interior and raised pointed ends.
    for (let i = 0; i < stations.length - 1; i++) for (const side of [-1, 1]) for (let course = 0; course < 4; course++) {
      const [az, aw] = stations[i], [bz, bw] = stations[i + 1];
      const y = 0.10 + course * 0.13, f = 0.42 + course * 0.18;
      const a = new THREE.Vector3(side * aw * f, y, az), b = new THREE.Vector3(side * bw * f, y, bz);
      const delta = b.clone().sub(a), center = a.clone().add(b).multiplyScalar(0.5);
      parts.push([new THREE.BoxGeometry(0.026, 0.14, delta.length()).rotateY(Math.atan2(delta.x, delta.z)).translate(...center.toArray()), 0.57 + course * 0.08]);
    }
    parts.push([box(0.40, 0.06, 0.64, 0, 0.06), 0.5], [box(0.75, 0.055, 0.11, 0, 0.54, -0.16), 0.9], [box(0.77, 0.055, 0.11, 0, 0.54, 0.18), 0.9]);
    for (const z of [-0.49, 0.49]) parts.push([beam([0, 0.04, z * 0.9], [0, 0.68, z], 0.022), 0.43]);
    return parts;
  },
  cart: () => {
    const parts: Part[] = [];
    for (let n = 0; n < 6; n++) parts.push([box(0.76, 0.055, 0.115, 0, 0.38, -0.31 + n * 0.125), n % 2 ? 0.78 : 0.92]);
    for (const side of [-1, 1]) {
      parts.push(...wheel(side * 0.46, 0.28, 0, 0.25), [beam([side * 0.30, 0.38, 0.23], [side * 0.30, 0.20, 0.88], 0.025), 0.52]);
      for (let n = 0; n < 3; n++) parts.push([box(0.04, 0.07, 0.78, side * 0.38, 0.46 + n * 0.09), 0.8]);
      for (const z of [-0.34, 0.34]) parts.push([box(0.04, 0.4, 0.04, side * 0.37, 0.37, z), 0.48]);
    }
    parts.push([beam([-0.49, 0.28, 0], [0.49, 0.28, 0], 0.025), 0.4]);
    return parts;
  },
  crane: () => {
    const parts: Part[] = [[box(0.48, 0.10, 0.48), 0.7], [box(0.13, 0.76, 0.13, -0.08, 0.1), 0.58],
      [beam([-0.34, 0.12, 0], [0.30, 0.75, 0], 0.045), 0.7], [beam([-0.39, 0.89, 0], [0.49, 0.98, 0], 0.037), 0.8],
      [beam([-0.08, 0.80, 0], [0.43, 0.96, 0], 0.009, 4), 0.36], [beam([0.46, 0.95, 0], [0.46, 0.32, 0], 0.009, 4), 0.35],
      [box(0.12, 0.11, 0.22, -0.34, 0.77), 0.6]];
    parts.push([new THREE.TorusGeometry(0.055, 0.012, 3, 8, Math.PI * 1.5).translate(0.45, 0.30, 0), 0.42]);
    for (const x of [-0.25, 0.12]) parts.push([beam([x, 0.10, -0.21], [-0.08, 0.63, 0], 0.025), 0.58], [beam([x, 0.10, 0.21], [-0.08, 0.63, 0], 0.025), 0.58]);
    return parts;
  },
  well: () => {
    const parts: Part[] = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 10; i++) {
      const a = (i + row * 0.5) * Math.PI / 5;
      parts.push([new THREE.BoxGeometry(0.24, 0.11, 0.11).rotateY(a).translate(Math.sin(a) * 0.37, row * 0.115 + 0.055, Math.cos(a) * 0.37), 0.76 + ((i + row) % 3) * 0.09]);
    }
    parts.push([cyl(0.29, 0.29, 0.015, 12, 0, 0.06), 0.28, true]);
    for (const x of [-0.37, 0.37]) parts.push([box(0.055, 0.62, 0.055, x, 0.31), 0.46]);
    parts.push([roof(0.83, 0.17, 0.94, 0.68), 1, true], [beam([-0.40, 0.68, 0], [0.45, 0.68, 0], 0.027), 0.6],
      [beam([0, 0.68, 0], [0, 0.22, 0], 0.007, 4), 0.45], [cyl(0.07, 0.055, 0.09, 8, 0, 0.17), 0.55]);
    return parts;
  },
  watchtower: () => {
    const parts: Part[] = [[box(0.78, 0.78, 0.78), 0.87], [box(0.9, 0.06, 0.9, 0, 0.73), 0.72], [box(0.82, 0.035, 0.82, 0, 0.79), 0.5]];
    for (const side of [-1, 1]) {
      for (const x of [-0.33, 0, 0.33]) parts.push([box(0.19, 0.18, 0.13, x, 0.82, side * 0.385), 0.92]);
      for (const z of [-0.10, 0.19]) parts.push([box(0.13, 0.18, 0.17, side * 0.385, 0.82, z), 0.92]);
      for (const y of [0.32, 0.56]) parts.push([box(0.035, 0.13, 0.014, 0, y, side * 0.397), 0.25], [box(0.014, 0.13, 0.035, side * 0.397, y, 0), 0.25]);
      for (const x of [-0.34, 0.34]) parts.push([box(0.09, 0.74, 0.04, x, 0, side * 0.397), 0.78]);
    }
    parts.push([box(0.16, 0.26, 0.02, 0.12, 0, 0.399), 0.36]);
    return parts;
  },
  "mine-head": () => {
    const parts: Part[] = [[box(0.57, 0.025, 0.55), 0.24]];
    for (const x of [-0.33, 0.33]) for (const z of [-0.32, 0.32]) parts.push([box(0.075, 0.86, 0.075, x, 0, z), 0.55]);
    parts.push([box(0.80, 0.08, 0.77, 0, 0.83), 0.78], [beam([-0.32, 0.08, 0.34], [0.32, 0.81, 0.34], 0.022), 0.7],
      [beam([0.32, 0.08, -0.34], [-0.32, 0.81, -0.34], 0.022), 0.7], [beam([0, 0.94, 0], [0, 0.08, 0], 0.008, 4), 0.36]);
    parts.push([new THREE.TorusGeometry(0.09, 0.018, 3, 10).translate(0, 0.9, 0), 0.43]);
    for (const x of [-0.17, 0.17]) parts.push([box(0.025, 0.025, 0.9, x, 0.01, 0.03), 0.45]);
    for (let i = 0; i < 6; i++) parts.push([box(0.48, 0.03, 0.035, 0, 0, -0.38 + i * 0.15), 0.73]);
    return parts;
  },
  mill: () => {
    const parts: Part[] = [[box(0.66, 0.66, 0.76, -0.13), 0.87], [roof(0.66, 0.30, 0.72, 0.84).translate(-0.13, 0, 0), 1, true],
      [box(0.12, 0.29, 0.02, -0.22, 0, 0.39), 0.32], ...wheel(0.37, 0.34, 0, 0.30)];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      parts.push([new THREE.BoxGeometry(0.20, 0.07, 0.04).rotateX(-a).translate(0.37, 0.34 + Math.sin(a) * 0.29, Math.cos(a) * 0.29), 0.72]);
    }
    for (const x of [-0.43, 0.17]) parts.push([box(0.035, 0.65, 0.025, x, 0, 0.39), 0.5]);
    return parts;
  },
  windmill: () => {
    const parts: Part[] = [[cyl(0.22, 0.36, 0.73, 10), 0.9], [cone(0.28, 0.18, 10, 0, 0.73), 1, true], [box(0.11, 0.24, 0.02, 0, 0, 0.35), 0.3],
      [beam([0, 0.63, 0.10], [0, 0.63, 0.36], 0.045, 8), 0.45]];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.3;
      const blade: Part[] = [[box(0.024, 0.46, 0.025, 0, 0, 0), 0.43], [box(0.13, 0.30, 0.015, 0.055, 0.14), 0.91]];
      for (let k = 0; k < 4; k++) blade.push([box(0.14, 0.014, 0.025, 0.055, 0.14 + k * 0.09), 0.64]);
      for (const [g, tint] of blade) parts.push([g.rotateZ(a).translate(0, 0.58, 0.37), tint]);
    }
    return parts;
  },
};

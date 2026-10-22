import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";

export function dockGeometry(kind: "pier-timber" | "quay-stone"): THREE.BufferGeometry {
  const stone = kind == "quay-stone";
  const parts: [THREE.BufferGeometry, string][] = [];
  if (stone) parts.push([new THREE.BoxGeometry(1,0.13,1).translate(0,-0.045,0), "#635f52"]);
  else {
    // Broken plank tones and two bearers, supported by paired timber piles.
    for (let n=0;n<24;n++) parts.push([new THREE.BoxGeometry(1,0.025,0.038).translate(0,0.018,(n+0.5)/24-0.5), n%4 ? "#59452f" : "#685238"]);
    for (const side of [-1,1]) {
      parts.push([new THREE.BoxGeometry(0.12,0.06,1).translate(side*0.35,-0.02,0), "#463526"]);
      for (let n=0;n<7;n++) parts.push([new THREE.BoxGeometry(0.10,0.30,0.022).translate(side*0.39,-0.10,-0.46+n*0.15), "#403427"]);
    }
  }
  const coloured = parts.map(([part, color]) => {
    const geometry = part.toNonIndexed(); geometry.deleteAttribute("uv"); part.dispose();
    return paintGeometry(geometry, color);
  });
  const result = mergeGeometries(coloured);
  coloured.forEach(part => part.dispose());
  if (!result) throw new Error("Could not assemble dock module");
  return result;
}

export function boatGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [];
  const wood = new THREE.Color("#5a4635"), inside = new THREE.Color("#9c8868"), rim = new THREE.Color("#c3ad84");
  const triangle = (a: number[], b: number[], c: number[], color: THREE.Color): void => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], color: THREE.Color): void => {
    triangle(a, b, c, color); triangle(a, c, d, color);
  };
  const stations = [
    { z: -0.032, width: 0.002 }, { z: -0.023, width: 0.011 },
    { z: 0.018, width: 0.012 }, { z: 0.035, width: 0.0015 }
  ];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1];
    for (const side of [-1, 1]) {
      quad([side * a.width, 0.009, a.z], [side * b.width, 0.009, b.z],
        [side * b.width * 0.65, -0.002, b.z], [side * a.width * 0.65, -0.002, a.z], wood);
      quad([side * a.width * 0.75, 0.007, a.z], [side * b.width * 0.75, 0.007, b.z],
        [side * b.width * 0.65, 0.001, b.z], [side * a.width * 0.65, 0.001, a.z], inside);
    }
    quad([-a.width * 0.65, -0.002, a.z], [-b.width * 0.65, -0.002, b.z],
      [b.width * 0.65, -0.002, b.z], [a.width * 0.65, -0.002, a.z], wood);
  }
  quad([-0.010, 0.010, -0.011], [0.010, 0.010, -0.011], [0.010, 0.010, -0.006], [-0.010, 0.010, -0.006], rim);
  quad([-0.011, 0.010, 0.012], [0.011, 0.010, 0.012], [0.011, 0.010, 0.017], [-0.011, 0.010, 0.017], rim);
  for (const side of [-1, 1]) quad([side * 0.004, 0.012, 0.003], [side * 0.030, 0.008, -0.008],
    [side * 0.032, 0.008, -0.004], [side * 0.004, 0.012, 0.006], rim);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

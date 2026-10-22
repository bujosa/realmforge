import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { finishGeometry } from "../core/finish";
import { naturalTree } from "./NaturalTrees";

export function natureGeometry(kind: string, foliage = "#40563d"): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, color: string, shade = 1): void => {
    geometry.translate(x, y, z);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) {
      geometry.dispose();
    }
    paintGeometry(part, color);
    const colours = part.getAttribute("color");
    for (let i = 0; i < colours.count; i++) colours.setXYZ(i, colours.getX(i) * shade, colours.getY(i) * shade, colours.getZ(i) * shade);
    parts.push(part);
  };
  if (kind == "cliff" || kind == "mountain-rock" || kind == "river-bank") {
    const geometry = new THREE.SphereGeometry(1, 7, 4);
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const stratum = 0.91 + Math.sin(y * 18 + x * 3) * 0.09;
      positions.setXYZ(i, x * stratum, y, z * stratum);
    }
    geometry.computeVertexNormals();
    const cliff = kind == "cliff";
    geometry.scale(cliff ? 0.075 : 0.09, cliff ? 0.16 : kind == "river-bank" ? 0.018 : 0.1, cliff ? 0.035 : 0.065);
    add(geometry, 0, cliff ? 0.04 : 0.035, 0, "#ffffff");
  } else {
    naturalTree(kind, foliage, add);
  }
  const result = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!result) {
    throw new Error("Could not assemble terrain detail");
  }
  if (kind.startsWith("tree-")) {
    // Keep the original support/reservation envelope, including the root at Y=0.
    const envelope = kind == "tree-pine" ? [0.0704, 0.0820, 0.322, 0.0750, 0.0906]
      : kind == "tree-birch" ? [0.083, 0.0785, 0.312, 0.0618, 0.0588]
      : [0.101, 0.0947, 0.2935, 0.0794, 0.0764];
    const positions = result.getAttribute("position");
    const extents = [0, 0, 0, 0, 0];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      extents[0] = Math.max(extents[0], -x); extents[1] = Math.max(extents[1], x); extents[2] = Math.max(extents[2], y);
      extents[3] = Math.max(extents[3], -z); extents[4] = Math.max(extents[4], z);
    }
    const scale = Math.min(1, ...envelope.map((limit, i) => limit / Math.max(0.0001, extents[i])));
    result.scale(scale, scale, scale);
  }
  return finishGeometry(result);
}

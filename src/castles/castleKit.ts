import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { bevelBox, finishGeometry } from "../core/finish";

export type CastleKit = Map<string, THREE.BufferGeometry>;

export function castleModule(name: string, w: number, h: number, d: number, kit?: CastleKit): THREE.BufferGeometry {
  const source = kit?.get(name);
  const geometry = source ? source.clone().scale(w, h, d) : fallbackModule(name, w, h, d);
  // Repaint with the regional stone; do not multiply dark palette paint twice.
  geometry.deleteAttribute("color");
  geometry.deleteAttribute("uv");
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 2), 2));
  return geometry;
}

// Three bounded layouts per level share batches across regions. No random state
// enters gameplay; the caller selects the layout using its region seed.
export function modularCastle(stronghold: boolean, variant: number, kit?: CastleKit): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stone = "#a89e8b";
  const module = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, angle = 0, color = stone): void => {
    const source = kit?.get(name);
    const geometry = source ? source.clone().scale(w, h, d) : fallbackModule(name, w, h, d);
    geometry.rotateY(angle).translate(x, y, z);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) {
      geometry.dispose();
    }
    if (source) {
      const tint = new THREE.Color(color);
      const colors = part.getAttribute("color");
      for (let i = 0; i < colors.count; i++) {
        colors.setXYZ(i, colors.getX(i) * tint.r, colors.getY(i) * tint.g, colors.getZ(i) * tint.b);
      }
    } else {
      paintGeometry(part, color);
    }
    // Re-project after assembly, so every module uses the same masonry scale.
    part.deleteAttribute("uv");
    part.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(part.getAttribute("position").count * 2), 2));
    parts.push(part);
  };
  const width = stronghold ? 0.48 : 0.3;
  const depth = stronghold ? 0.38 : 0.24;
  module("foundation", width + 0.07, 0.035, depth + 0.07, 0, 0, 0, 0, "#807666");
  module("wall-narrow", width, 0.25, 0.045, 0, 0.025, -depth / 2);
  [-1, 1].forEach(side => {
    // Split the front curtain to leave the gate aperture visible.
    module("wall-narrow", depth, 0.25, 0.045, side * width / 2, 0.025, 0, Math.PI / 2);
    module("wall-narrow", width * 0.3, 0.25, 0.045, side * width * 0.35, 0.025, depth / 2);
    [-1, 1].forEach(end => {
      const height = (stronghold ? 0.37 : 0.32) + (variant == 1 && end < 0 ? 0.04 : 0);
      module("tower-square", 0.095, height, 0.095, side * width / 2, 0.025, end * depth / 2);
      module(variant == 2 ? "tower-square-top" : "tower-square-top-roof", 0.115, 0.085, 0.115, side * width / 2, height + 0.025, end * depth / 2, 0, variant == 2 ? stone : "#626775");
    });
  });
  module("wall-narrow-gate", 0.12, 0.285, 0.058, 0, 0.025, depth / 2);
  const keepHeight = stronghold ? 0.54 : 0.4;
  const keepWidth = stronghold ? 0.2 : 0.14;
  module("tower-square", keepWidth, keepHeight, keepWidth, variant == 1 ? -0.035 : 0, 0.025, -0.025);
  module("tower-square-top-roof", keepWidth * 1.18, 0.09, keepWidth * 1.18, variant == 1 ? -0.035 : 0, keepHeight + 0.025, -0.025, 0, "#626775");
  const result = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!result) {
    throw new Error("Could not assemble castle modules");
  }
  return finishGeometry(result);
}


function fallbackModule(name: string, width: number, height: number, depth: number): THREE.BufferGeometry {
  if (name == "tower-square-top-roof") {
    const roof = new THREE.ConeGeometry(1, height, 4);
    roof.rotateY(Math.PI / 4).scale(width / Math.SQRT2, 1, depth / Math.SQRT2).translate(0, height / 2, 0);
    return roof;
  }
  const parts: THREE.BufferGeometry[] = [];
  const block = (w: number, h: number, d: number, x: number, y: number, z: number): void => {
    parts.push(bevelBox(w, h, d).translate(x, y, z));
  };
  if (name == "wall-narrow-gate") {
    [-1, 1].forEach(side => block(width * 0.25, height, depth, side * width * 0.375, height / 2, 0));
    block(width * 0.5, height * 0.25, depth, 0, height * 0.875, 0);
  } else {
    const crenellated = name == "wall-narrow" || name == "tower-square-top";
    block(width, height * (crenellated ? 0.8 : 1), depth, 0, height * (crenellated ? 0.4 : 0.5), 0);
    if (crenellated) {
      const count = Math.max(3, Math.ceil(width / 0.055));
      for (let i = 0; i < count; i++) {
        const x = (i / (count - 1) - 0.5) * (width - 0.022);
        block(0.022, height * 0.2, depth, x, height * 0.9, 0);
      }
    }
  }
  const nonIndexed = parts.map(part => part.index ? part.toNonIndexed() : part);
  parts.forEach((part, i) => {
    if (part != nonIndexed[i]) {
      part.dispose();
    }
  });
  const result = mergeGeometries(nonIndexed);
  nonIndexed.forEach(part => part.dispose());
  if (!result) {
    throw new Error("Could not assemble procedural castle module");
  }
  return result;
}

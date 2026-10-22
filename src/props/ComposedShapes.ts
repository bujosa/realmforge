import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { DRAWABLE_VARIANTS } from "./ComposedVariants";

// Placeholder kit shapes for composed props (K2–K14 except houses). Each is
// built in a unit footprint (x, z ∈ [-0.5, 0.5], y ∈ [0, 1]) and scaled per
// instance to the item's physical w × h × d. Vertex colours are multipliers
// of the instance tint (1 = tint, < 1 darker parts such as roofs and timber).
// Original geometry, no assets. Kit owners replace them through a sink.

/** Geometry, shade multiplier, and whether it takes the instance's roof tint. */
type Part = [THREE.BufferGeometry, number] | [THREE.BufferGeometry, number, boolean];

const shade = (v: number): string => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

function merge(parts: Part[]): THREE.BufferGeometry {
  const painted = parts.map(([g, s, roof]) => {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute("uv");
    flat.deleteAttribute("normal");
    flat.computeVertexNormals();
    const count = flat.getAttribute("position").count;
    flat.setAttribute("roofPart", new THREE.Float32BufferAttribute(new Float32Array(count).fill(roof ? 1 : 0), 1));
    return paintGeometry(flat, shade(roof ? 1 : s));
  });
  const merged = mergeGeometries(painted) ?? painted[0];
  merged.computeBoundingSphere();
  return merged;
}

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (top: number, bottom: number, h: number, segments: number, x = 0, y = 0, z = 0): THREE.BufferGeometry => new THREE.CylinderGeometry(top, bottom, h, segments).translate(x, y + h / 2, z);
const cone = (r: number, h: number, segments: number, x = 0, y = 0, z = 0): THREE.BufferGeometry => new THREE.ConeGeometry(r, h, segments).translate(x, y + h / 2, z);

/** Gable house: walls to y = 1 (the item's eave height), roof of `rise` × eave above, ridge along local x. */
function gableHouse(rise: number, overhang = 0.06): Part[] {
  const roof = new THREE.CylinderGeometry(0.5, 0.5, 1 + overhang, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6);
  // The triangular prism spans y ∈ [-0.25, 0.5] and z ∈ [-0.433, 0.433]: fit it to the eave.
  roof.translate(0, 0.25, 0).scale(1, rise / 0.75, (1 + overhang) / 0.866).translate(0, 1, 0);
  return [[box(1, 1, 1), 1], [roof, 1, true], [box(0.12, 0.62, 0.02, -0.18, 0, 0.505), 0.45]];
}

const builders: Record<string, () => Part[]> = {
  "house-gable-steep": () => gableHouse(1.05),
  "house-gable-low": () => gableHouse(0.5),
  "house-turf-long": () => gableHouse(0.95, 0.02),
  "house-tall": () => [...gableHouse(0.32), [box(0.3, 0.03, 0.02, 0.15, 0.55, 0.505), 0.5]],
  barn: () => gableHouse(0.8),
  inn: () => gableHouse(0.6),
  "castle-keep": () => {
    const parts: Part[] = [[box(1, 0.82, 1), 1], [box(1.04, 0.035, 1.04, 0, 0.78), 0.92],
      [cone(0.73, 0.18, 4, 0, 0.82).rotateY(Math.PI / 4), 1, true],
      [box(0.07, 0.12, 0.012, 0, 0.01, 0.505), 0.35]];
    for (const x of [-0.43, 0.43]) for (const z of [-0.43, 0.43])
      parts.push([cyl(0.09, 0.11, 0.9, 8, x, 0, z), 1], [cone(0.12, 0.14, 8, x, 0.9, z), 1, true]);
    for (const side of [-1, 1]) {
      for (let row = 1; row < 4; row++) for (let k = 0; k < 4; k++) {
        parts.push([box(0.025, 0.045, 0.012, -0.3 + k * 0.2, 0.15 + row * 0.15, side * 0.505), 0.38],
          [box(0.012, 0.045, 0.025, side * 0.505, 0.15 + row * 0.15, -0.3 + k * 0.2), 0.38]);
      }
      for (let row = 1; row < 40; row++) parts.push([box(1, 0.0007, 0.001, 0, row * 0.02, side * 0.501), 0.84],
        [box(0.001, 0.0007, 1, side * 0.501, row * 0.02), 0.84]);
    }
    return parts;
  },
  "stilt-house": () => [[box(0.08, 0.45, 0.08, -0.4, 0, -0.4), 0.6], [box(0.08, 0.45, 0.08, 0.4, 0, -0.4), 0.6], [box(0.08, 0.45, 0.08, -0.4, 0, 0.4), 0.6], [box(0.08, 0.45, 0.08, 0.4, 0, 0.4), 0.6],
    [box(1, 0.55, 1, 0, 0.45), 1], [cone(0.75, 0.45, 4, 0, 1).rotateY(Math.PI / 4), 1, true]],
  "house-flat-dome": () => [[box(1, 0.92, 1), 1], [box(1.02, 0.1, 1.02, 0, 0.92), 1, true], [box(0.12, 0.42, 0.02, -0.2, 0, 0.505), 0.45]],
  "sept-small": () => [[cyl(0.5, 0.5, 0.55, 7), 1], [cone(0.56, 0.3, 7, 0, 0.55), 1, true], [cyl(0.05, 0.08, 0.15, 6, 0, 0.85), 0.8]],
  "sept-large": () => [[cyl(0.5, 0.5, 0.45, 7), 1], [new THREE.SphereGeometry(0.36, 10, 6).scale(1, 0.9, 1).translate(0, 0.5, 0), 1, true], [cyl(0.04, 0.06, 0.25, 6, 0, 0.75), 0.8]],
  "red-temple": () => [[cyl(0.5, 0.5, 0.55, 8), 1], [new THREE.SphereGeometry(0.4, 10, 6).scale(1, 0.95, 1).translate(0, 0.55, 0), 1, true]],
  dome: () => [[cyl(0.48, 0.5, 0.45, 12), 1], [new THREE.SphereGeometry(0.42, 12, 6).scale(1, 1.05, 1).translate(0, 0.45, 0), 1, true]],
  "drowned-arch": () => {
    const parts: Part[] = [];
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * k / 6, x = -Math.cos(a) * 0.42, y = Math.sin(a) * 0.86;
      parts.push([new THREE.BoxGeometry(0.16, 0.2, 0.9).rotateZ(Math.PI / 2 - a).translate(x, y + 0.1, 0), 0.95]);
    }
    return parts;
  },
  "tower-broken": () => [[cyl(0.44, 0.5, 0.78, 8), 1], [box(0.45, 0.22, 0.3, 0.12, 0.78, 0), 0.9]],
  watchtower: () => [[box(0.82, 0.86, 0.82), 1], [box(1, 0.1, 1, 0, 0.86), 0.85], [box(0.25, 0.06, 0.25, 0.3, 0.96, 0.3), 0.8]],
  "wall-stump": () => [[box(1, 0.75, 1), 1], [box(0.45, 0.25, 1, -0.2, 0.75), 0.9]],
  "arena-ruin": () => {
    const parts: Part[] = [];
    for (let k = 0; k < 22; k++) {
      const a = k / 24 * Math.PI * 2, h = 0.45 + ((k * 7) % 5) * 0.12;
      parts.push([new THREE.BoxGeometry(0.12, h, 0.06).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * 0.46, h / 2, Math.sin(a) * 0.46), 0.95]);
    }
    return parts;
  },
  "mine-head": () => [[box(0.12, 1, 0.12, -0.4, 0, -0.4), 0.7], [box(0.12, 1, 0.12, 0.4, 0, -0.4), 0.7], [box(0.12, 1, 0.12, -0.4, 0, 0.4), 0.7], [box(0.12, 1, 0.12, 0.4, 0, 0.4), 0.7], [box(1, 0.1, 1, 0, 0.9), 0.6]],
  spoil: () => [[cone(0.5, 1, 9), 1]],
  "standing-stone": () => [[cyl(0.32, 0.5, 1, 5), 1]],
  cairn: () => [[cone(0.5, 1, 6), 1]],
  windmill: () => [[cyl(0.32, 0.5, 0.62, 8), 1], [cone(0.38, 0.18, 8, 0, 0.62), 1, true],
    [new THREE.BoxGeometry(0.07, 0.95, 0.03).rotateZ(0.5).translate(0, 0.66, 0.4), 0.7], [new THREE.BoxGeometry(0.07, 0.95, 0.03).rotateZ(-1.07).translate(0, 0.66, 0.4), 0.7]],
  mill: () => [[box(1, 0.62, 0.86), 1], [box(1.02, 0.38, 0.6, 0, 0.62), 1, true], [cyl(0.32, 0.32, 0.1, 10).rotateX(Math.PI / 2).translate(0.2, 0.32, 0.5), 0.7]],
  fountain: () => [[cyl(0.5, 0.48, 0.16, 12), 1], [cyl(0.42, 0.42, 0.04, 12, 0, 0.16), 1, true],
    [cyl(0.07, 0.11, 0.4, 8, 0, 0.18), 1], [cyl(0.24, 0.12, 0.1, 12, 0, 0.56), 1],
    [cyl(0.015, 0.025, 0.34, 6, 0, 0.66), 1, true]],
  monument: () => [[box(1, 0.3, 1), 1], [cyl(0.18, 0.24, 0.7, 6, 0, 0.3), 0.92]],
  "beacon-timber": () => [[box(0.12, 0.85, 0.12, -0.38, 0, -0.38), 0.7], [box(0.12, 0.85, 0.12, 0.38, 0, -0.38), 0.7], [box(0.12, 0.85, 0.12, -0.38, 0, 0.38), 0.7], [box(0.12, 0.85, 0.12, 0.38, 0, 0.38), 0.7], [box(0.9, 0.15, 0.9, 0, 0.85), 0.5]],
  "beacon-stone": () => [[cyl(0.38, 0.5, 0.88, 8), 1], [cyl(0.46, 0.4, 0.12, 8, 0, 0.88), 0.6]],
  "salt-heap": () => [[cone(0.5, 1, 8), 1]],
  palisade: () => {
    const parts: Part[] = [];
    for (let k = 0; k < 8; k++) parts.push([cyl(0.04, 0.06, 0.88, 5, -0.44 + k * 0.125, 0, 0), 1], [cone(0.05, 0.12, 5, -0.44 + k * 0.125, 0.88, 0), 0.85]);
    return parts;
  },
  "wall-low": () => [[box(1, 0.86, 1), 1], [box(0.18, 0.14, 1, -0.3, 0.86), 0.92], [box(0.18, 0.14, 1, 0.1, 0.86), 0.92], [box(0.18, 0.14, 1, 0.45, 0.86), 0.92]],
  "wall-tower": () => [[box(1, 0.88, 1), 1], [box(1.08, 0.12, 1.08, 0, 0.88), 0.9]],
  hedge: () => [[box(1, 0.85, 1), 1], [box(0.96, 0.15, 0.7, 0, 0.85), 0.9]],
  // Wattle/rail fence: posts and two rails along local x (the run), thin in z.
  fence: () => [...[-0.48, -0.32, -0.16, 0, 0.16, 0.32, 0.48].map(x => [box(0.025, 1, 0.9, x), 0.75] as Part), [box(1, 0.09, 0.45, 0, 0.42), 1], [box(1, 0.09, 0.45, 0, 0.8), 1]],
  // Dry-stone yard wall: a battered run with an uneven coping (no merlons).
  "yard-wall": () => [[box(1, 0.78, 1), 1], [box(0.34, 0.2, 0.86, -0.3, 0.74), 0.9], [box(0.3, 0.16, 0.86, 0.06, 0.74), 0.95], [box(0.3, 0.22, 0.86, 0.36, 0.74), 0.88]],
  // Garden pool: a stone rim (instance tint) round still water (instance roof tint).
  pool: () => [[box(1, 0.7, 0.07, 0, 0, 0.465), 1], [box(1, 0.7, 0.07, 0, 0, -0.465), 1], [box(0.07, 0.7, 0.86, 0.465), 1], [box(0.07, 0.7, 0.86, -0.465), 1], [box(0.86, 0.52, 0.86), 1, true]],
  haystack: () => [[cyl(0.5, 0.5, 0.45, 8), 1], [cone(0.52, 0.55, 8, 0, 0.45), 0.92]],
  "vine-row": () => [[box(1, 0.9, 0.6), 1], [box(1, 0.1, 1, 0, 0.9), 0.85]],
  "olive-row": () => {
    const parts: Part[] = [];
    for (let k = 0; k < 6; k++) parts.push([new THREE.SphereGeometry(0.09, 6, 4).scale(1, 0.75, 5).translate(-0.42 + k * 0.17, 0.62, 0), 1], [cyl(0.012, 0.016, 0.45, 4, -0.42 + k * 0.17, 0, 0), 0.6]);
    return parts;
  },
  well: () => [[cyl(0.42, 0.45, 0.4, 8), 1], [box(0.06, 0.55, 0.06, -0.36, 0.4), 0.7], [box(0.06, 0.55, 0.06, 0.36, 0.4), 0.7], [box(0.9, 0.08, 0.5, 0, 0.92), 0.6]],
  awning: () => [[box(0.05, 0.85, 0.05, -0.46, 0, 0.46), 0.6], [box(0.05, 0.85, 0.05, 0.46, 0, 0.46), 0.6], [box(1, 0.04, 1, 0, 0.8).rotateX(-0.18), 1]],
  cart: () => [[box(0.9, 0.35, 0.8, 0, 0.35), 1], [cyl(0.3, 0.3, 0.06, 10).rotateZ(Math.PI / 2).translate(-0.48, 0.3, 0), 0.6], [cyl(0.3, 0.3, 0.06, 10).rotateZ(Math.PI / 2).translate(0.48, 0.3, 0), 0.6]],
  "pier-timber": () => [[box(1, 0.25, 1, 0, 0.75), 1], [box(0.15, 0.8, 0.04, -0.4, 0, -0.3), 0.6], [box(0.15, 0.8, 0.04, 0.4, 0, -0.3), 0.6], [box(0.15, 0.8, 0.04, -0.4, 0, 0.3), 0.6], [box(0.15, 0.8, 0.04, 0.4, 0, 0.3), 0.6]],
  "quay-stone": () => [[box(1, 1, 1), 1], [box(1, 0.06, 0.08, 0, 1, 0.46), 0.85]],
  crane: () => [[box(0.4, 0.8, 0.4), 0.85], [box(2.4, 0.08, 0.12, 0.9, 0.82), 0.7], [box(0.03, 0.4, 0.03, 2, 0.42), 0.5]],
  "boat-small": () => [[box(1, 0.6, 0.86, 0, 0.1), 1], [box(0.84, 0.08, 0.8, 0, 0.62), 0.6]],
  "stone-arch": () => [[box(1, 0.3, 1, 0, 0.7), 1], [box(0.12, 0.7, 1, -0.44, 0), 0.9], [box(0.12, 0.7, 1, 0.44, 0), 0.9], [box(0.1, 0.55, 1, 0, 0.15), 0.85]],
  "timber-trestle": () => [[box(1, 0.2, 1, 0, 0.8), 1], [box(0.04, 0.8, 0.9, -0.3, 0), 0.6], [box(0.04, 0.8, 0.9, 0, 0), 0.6], [box(0.04, 0.8, 0.9, 0.3, 0), 0.6]],
  "bridge-tower": () => [[box(0.9, 0.9, 0.9), 1], [box(1, 0.1, 1, 0, 0.9), 0.85]],
  "palace-gallery": () => {
    const parts: Part[] = [[box(1, 0.08, 1, 0, 0.82), 1], [box(1, 0.05, 1, 0, 0), 0.95],
      [box(1, 0.78, 0.22, 0, 0, -0.38), 1], [box(1, 0.09, 0.1, 0, 0.9, -0.44), 0.95]];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) parts.push([cyl(0.022, 0.03, 0.82, 6, -0.44 + i * 0.293, 0, side * 0.4), 1]);
      for (let i = 0; i < 3; i++) parts.push([new THREE.TorusGeometry(0.145, 0.025, 4, 8, Math.PI)
        .translate(-0.293 + i * 0.293, 0.64, side * 0.4), 1]);
    }
    for (let i = 0; i < 3; i++) parts.push([box(0.09, 0.22, 0.025, -0.293 + i * 0.293, 0.32, -0.502), 0.45]);
    return parts;
  },
  "palace-low": () => [[box(1, 0.7, 0.18, 0, 0, -0.41), 1], [box(1, 0.7, 0.18, 0, 0, 0.41), 1], [box(0.15, 0.7, 1, -0.43, 0), 1], [box(0.15, 0.7, 1, 0.43, 0), 1],
    [box(0.4, 0.04, 0.3, 0, 0), 0.55], [new THREE.SphereGeometry(0.1, 8, 4).translate(0, 0.75, -0.41), 1, true]],
  "water-gardens-palace": () => {
    // Original low marble courtyard palace: roofed rear hall, colonnades and
    // open galleries face the pools. No imported or traced architectural asset.
    const parts: Part[] = [[box(1, 0.72, 0.19, 0, 0, -0.405), 1], [box(1.02, 0.06, 0.22, 0, 0.72, -0.405), 0.94],
      [new THREE.SphereGeometry(0.09, 10, 6).scale(1, 1.3, 1).translate(0, 0.78, -0.405), 1, true]];
    for (const side of [-1, 1]) {
      parts.push([box(0.15, 0.06, 0.84, side * 0.425, 0.62), 1]);
      for (let k = 0; k < 9; k++) parts.push([cyl(0.014, 0.019, 0.62, 6, side * 0.425, 0, -0.35 + k * 0.0875), 0.96]);
    }
    parts.push([box(1, 0.06, 0.14, 0, 0.62, 0.43), 1]);
    for (let k = 0; k < 13; k++) parts.push([cyl(0.012, 0.018, 0.62, 6, -0.46 + k * 0.0767, 0, 0.43), 0.96]);
    return parts;
  },
  "sea-stack": () => [[cyl(0.32, 0.5, 1, 7), 1]],
  "rock-spur": () => [[cone(0.5, 1, 7), 1]],
  livestock: () => [[new THREE.SphereGeometry(0.5, 7, 5).scale(0.9, 0.48, 0.92).translate(0, 0.62, 0), 1], [new THREE.SphereGeometry(0.2, 6, 4).translate(0, 0.78, 0.5), 0.92],
    [box(0.16, 0.42, 0.12, -0.25, 0, -0.3), 0.7], [box(0.16, 0.42, 0.12, 0.25, 0, -0.3), 0.7], [box(0.16, 0.42, 0.12, -0.25, 0, 0.3), 0.7], [box(0.16, 0.42, 0.12, 0.25, 0, 0.3), 0.7]]
};

const cache = new Map<string, THREE.BufferGeometry>();

export function hasShape(variant: string): boolean { return variant in builders && DRAWABLE_VARIANTS.has(variant); }

/** Shared placeholder geometry for a variant (unit footprint). */
export function shape(variant: string): THREE.BufferGeometry {
  let geometry = cache.get(variant);
  if (!geometry) {
    geometry = merge((builders[variant] ?? builders.watchtower)());
    cache.set(variant, geometry);
  }
  return geometry;
}

export function disposeShapes(): void {
  cache.forEach(geometry => geometry.dispose());
  cache.clear();
}

export function triangles(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute("position").count / 3;
}

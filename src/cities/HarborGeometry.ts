import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { finishGeometry } from "../core/finish";

// Original low timber quay for port regions. Local +Z points seaward (away from
// the shore), so the landward end sits at -Z. The walkway and berth on both
// sides stay open: no slab, roof or shed hides picking or the pieces beside it.
// Pilings stand in wet footings that sink below the waterline. Stays within
// X ±0.105, Z ±0.195, Y [-0.06, 0.19] and about 1.5k triangles.
export function harborGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, color: string): void => {
    geometry.translate(x, y, z);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) { geometry.dispose(); }
    parts.push(paintGeometry(part, color));
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string): void => {
    add(new THREE.BoxGeometry(w, h, d), x, y, z, color);
  };
  // Square-section member from a to b, oriented along the segment.
  const beam = (a: [number, number, number], b: [number, number, number], width: number, color: string): void => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const length = direction.length();
    const geometry = new THREE.BoxGeometry(width, length, width);
    geometry.rotateX(Math.acos(direction.y / length)).rotateY(Math.atan2(direction.x, direction.z));
    add(geometry, (start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2, color);
  };
  // Tapered pile or post; the base flares slightly into its footing.
  const post = (x: number, z: number, bottom: number, top: number, radius: number, color: string): void => {
    add(new THREE.CylinderGeometry(radius, radius * 1.25, top - bottom, 6), x, (bottom + top) / 2, z, color);
  };
  const footing = (x: number, z: number): void => box(0.03, 0.018, 0.03, x, -0.047, z, "#4f5654");

  // Deck: ten planks across the walkway, with dark joints between them.
  for (let i = 0; i < 10; i++) {
    box(0.134, 0.016, 0.032, 0, 0.066, -0.171 + i * 0.038, i % 3 == 0 ? "#b59669" : "#94734e");
  }

  // Two rows of piles at each side, with stringers under the deck and cross ties.
  const stations = [-0.17, -0.085, 0, 0.085, 0.17];
  [-1, 1].forEach(side => {
    box(0.012, 0.02, 0.37, side * 0.058, 0.048, 0, "#624a36");
    stations.forEach(z => {
      post(side * 0.058, z, -0.05, 0.058, 0.009, "#725337");
      footing(side * 0.058, z);
    });
    // Diagonal bracing alternates direction in each bay.
    for (let i = 0; i < stations.length - 1; i++) {
      const high = i % 2 == 0 ? 0.04 : -0.02;
      const low = i % 2 == 0 ? -0.02 : 0.04;
      beam([side * 0.058, high, stations[i]], [side * 0.058, low, stations[i + 1]], 0.007, "#5a4331");
    }
  });
  [-0.17, 0, 0.17].forEach(z => box(0.128, 0.012, 0.012, 0, 0.03, z, "#6b5238"));

  // Capstan near the landward end, with its drum, cap and two lever bars.
  const capstanX = 0.032;
  const capstanZ = -0.12;
  add(new THREE.CylinderGeometry(0.02, 0.022, 0.012, 8), capstanX, 0.08, capstanZ, "#737a72");
  add(new THREE.CylinderGeometry(0.013, 0.013, 0.03, 8), capstanX, 0.101, capstanZ, "#9c8768");
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 8), capstanX, 0.119, capstanZ, "#737a72");
  box(0.05, 0.006, 0.006, capstanX, 0.1, capstanZ, "#42494a");
  box(0.006, 0.006, 0.05, capstanX, 0.1, capstanZ, "#42494a");

  // Bollards at the seaward end, one on each side of the walkway.
  [-0.042, 0.042].forEach(x => {
    post(x, 0.168, 0.074, 0.104, 0.007, "#ba9b6c");
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 8), x, 0.108, 0.168, "#c2b798");
  });

  // Coiled rope on the deck, laid flat in three rings.
  [0.08, 0.087, 0.094].forEach(y => {
    add(new THREE.TorusGeometry(0.016, 0.005, 4, 8).rotateX(Math.PI / 2), -0.035, y, 0.12, "#c9b58a");
  });

  // Small bales stacked near the landward end.
  [-0.15, -0.11].forEach((z, i) => {
    box(0.036, 0.026, 0.03, -0.04, 0.087, z, i ? "#a08a5c" : "#8c7a52");
    box(0.008, 0.028, 0.034, -0.04, 0.087, z, "#5e5440");
  });
  box(0.03, 0.02, 0.026, -0.04, 0.11, -0.15, "#9c8768");

  // Hull repair cradle on the -X edge: a bearer on two legs, with three arched
  // ribs standing on it. It reaches only to the outer bounds; the +X berth stays
  // empty.
  const cradleX = -0.08;
  box(0.014, 0.012, 0.11, cradleX, 0.06, -0.09, "#7b5b3e");
  [-0.135, -0.045].forEach(z => {
    post(cradleX, z, -0.038, 0.054, 0.005, "#725337");
    footing(cradleX, z);
  });
  [-0.125, -0.09, -0.055].forEach(z => {
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI, c = (i + 1) / 6 * Math.PI;
      beam([cradleX + Math.cos(a) * 0.014, 0.066 + Math.sin(a) * 0.014, z],
        [cradleX + Math.cos(c) * 0.014, 0.066 + Math.sin(c) * 0.014, z], 0.006, "#a58a60");
    }
  });

  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) { throw new Error("Could not build tabletop harbor"); }
  return finishGeometry(geometry);
}

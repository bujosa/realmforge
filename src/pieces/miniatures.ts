import * as THREE from "three";
import { emblemGeometry } from "../heraldry";
import { shipGeometry } from "./geometry/ships";
import { dragonSculpt } from "./geometry/DragonSculpt";
import { paintGeometry } from "./sculpt";
import { bevelBox, finishGeometry } from "./geometry/finish";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// One reusable vertex-painted sculpt per house/type, baked into a single draw.
export function miniatureGeometry(
  type: string,
  house = "",
  color = "#C8A45D",
  withoutBase = false
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    paint = color
  ): void => {
    geometry.rotateX(rx);
    geometry.rotateY(ry);
    geometry.rotateZ(rz);
    geometry.translate(x, y, z);
    // Extrusions are non-indexed; normalize primitives before merging.
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) {
      geometry.dispose();
    }
    parts.push(paintGeometry(part, paint));
  };
  const emblem = (x: number, y: number, z: number, scale: number, ry = 0): void => {
    const geometry = emblemGeometry(house);
    geometry.scale(scale, scale, scale);
    add(geometry, x, y, z, 0, ry, 0, house == "baratheon" || house == "martell" ? "#28242a" : "#ead5a0");
  };
  const crest = (y: number): void => {
    if (house == "baratheon" || house == "greyjoy") {
      [-1, 1].forEach(side => {
        add(new THREE.ConeGeometry(0.014, 0.1, 5), side * 0.038, y + 0.045, 0, 0, 0, side * -0.45, "#d8c99c");
        if (house == "baratheon") {
          add(new THREE.BoxGeometry(0.05, 0.013, 0.015), side * 0.055, y + 0.055, 0, 0, 0, side * 0.3, "#d8c99c");
        }
      });
    } else if (house == "martell") {
      add(new THREE.TorusGeometry(0.042, 0.009, 4, 10), 0, y + 0.034, 0, 0, 0, 0, "#e5ba6d");
    } else if (house == "stark" || house == "bolton") {
      const pelt = new THREE.SphereGeometry(0.07, 7, 4);
      pelt.scale(1, 0.5, 0.8);
      add(pelt, 0, y - 0.095, 0.005, 0, 0, 0, house == "stark" ? "#737a7c" : "#b57380");
    } else {
      const plume = extrude([[0, 0], [-0.04, 0.07], [0.02, 0.11], [0.06, 0.06], [0.04, 0]], 0.016);
      add(plume, -0.008, y, 0, 0, Math.PI / 2, 0, house == "targaryen" ? "#342a32" : "#e7d8ba");
    }
  };
  const profile = (points: number[][]): THREE.LatheGeometry =>
    new THREE.LatheGeometry(
      points.map(([x, y]) => new THREE.Vector2(x, y)),
      10
    );
  const extrude = (
    points: number[][],
    depth: number
  ): THREE.ExtrudeGeometry => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) =>
      i == 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
    );
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008
    });
  };
  if (!withoutBase) add(
    profile([
      [0, 0],
      [0.15, 0],
      [0.16, 0.025],
      [0.14, 0.05],
      [0, 0.05]
    ]),
    0,
    0,
    0
  );
  if (type == "ship") {
    parts.push(shipGeometry(house, color));
  } else if (type == "siege-engine") {
    add(bevelBox(0.23, 0.045, 0.34), 0, 0.14, 0, 0, 0, 0, "#785538");
    [-1, 1].forEach((side) => {
      [-1, 1].forEach((end) => {
        add(
          new THREE.CylinderGeometry(0.075, 0.075, 0.045, 10),
          side * 0.14,
          0.11,
          end * 0.12,
          0,
          0,
          Math.PI / 2,
          "#4f4d45"
        );
      });
      add(
        extrude(
          [
            [-0.11, 0],
            [0.11, 0],
            [0.015, 0.26],
            [-0.015, 0.26]
          ],
          0.03
        ),
        side * 0.08,
        0.16,
        -0.015,
        0,
        Math.PI / 2
      );
    });
    add(
      new THREE.CylinderGeometry(0.022, 0.022, 0.26, 6),
      0,
      0.38,
      0,
      0,
      0,
      Math.PI / 2
    );
    add(bevelBox(0.035, 0.52, 0.035), 0, 0.39, 0, -0.62);
    add(bevelBox(0.13, 0.075, 0.11), 0, 0.22, 0.12);
    add(new THREE.SphereGeometry(0.055, 8, 4), 0, 0.62, -0.17);
    add(new THREE.CylinderGeometry(0.009, 0.009, 0.27, 5), -0.1, 0.37, 0.12, 0, 0, 0, "#c9b582");
    add(new THREE.BoxGeometry(0.13, 0.14, 0.012), -0.045, 0.43, 0.12);
    emblem(-0.045, 0.43, 0.13, 0.09);
  } else if (type == "knight") {
    const horse = new THREE.SphereGeometry(0.14, 10, 6);
    horse.scale(0.6, 0.8, 1.3);
    add(horse, 0, 0.23, 0, 0, 0, 0, house == "stark" ? "#747778" : "#635046");
    add(bevelBox(0.14, 0.055, 0.16), 0, 0.305, 0.03);
    [-1, 1].forEach((side) => {
      [-1, 1].forEach((end) => {
        add(
          new THREE.CylinderGeometry(0.022, 0.029, 0.16, 6),
          side * 0.055,
          0.13,
          end * 0.1,
          end * 0.12
        );
      });
    });
    add(
      extrude(
        [
          [-0.07, 0],
          [0.03, 0.2],
          [0.09, 0.23],
          [0.14, 0.16],
          [0.04, 0.1],
          [0.05, 0]
        ],
        0.085
      ),
      -0.04,
      0.24,
      -0.1,
      0,
      -Math.PI / 2
    );
    add(new THREE.ConeGeometry(0.025, 0.09, 5), 0, 0.48, -0.18);
    add(
      profile([
        [0, 0],
        [0.07, 0],
        [0.045, 0.15],
        [0.06, 0.18],
        [0, 0.18]
      ]),
      0,
      0.32,
      0
    );
    add(new THREE.SphereGeometry(0.052, 8, 6), 0, 0.54, 0, 0, 0, 0, "#aeb7bd");
    add(new THREE.ConeGeometry(0.035, 0.07, 5), 0, 0.6, 0, 0, 0, 0, "#c2c9c9");
    add(bevelBox(0.055, 0.014, 0.009), 0, 0.54, 0.05, 0, 0, 0, "#33333c");
    crest(0.62);
    add(
      new THREE.CylinderGeometry(0.01, 0.014, 0.63, 6),
      0.09,
      0.39,
      -0.025,
      0,
      0,
      -0.15
    );
    add(
      extrude(
        [
          [0, 0],
          [0.09, -0.035],
          [0.02, -0.07]
        ],
        0.012
      ),
      0.12,
      0.66,
      -0.025
    );
    add(new THREE.SphereGeometry(0.065, 8, 6), -0.06, 0.44, 0);
    emblem(-0.065, 0.44, 0.069, 0.072);
    emblem(0.155, 0.625, -0.004, 0.036);
  } else if (type == "dragon") {
    // Pre-scale dragon space matches the existing footprint; its colours are baked into the sculpt.
    parts.push(dragonSculpt());
  } else {
    // Footman: flared tunic, legs, helmet, kite shield and raised spear.
    [-1, 1].forEach((side) => {
      add(
        new THREE.CylinderGeometry(0.023, 0.029, 0.13, 6),
        side * 0.04,
        0.12,
        0, 0, 0, 0, "#4d453b"
      );
      add(bevelBox(0.054, 0.04, 0.074), side * 0.04, 0.069, 0.013, 0, 0, 0, "#393b37");
    });
    add(
      profile([
        [0, 0],
        [0.095, 0],
        [0.055, 0.18],
        [0.085, 0.24],
        [0.04, 0.27],
        [0, 0.27]
      ]),
      0,
      0.16,
      0
    );
    add(new THREE.CylinderGeometry(0.068, 0.068, 0.021, 10), 0, 0.29, 0, 0, 0, 0, "#514536");
    add(bevelBox(0.073, 0.089, 0.012), 0, 0.376, 0.061, 0, 0, 0, "#7f898d");
    add(new THREE.SphereGeometry(0.06, 10, 6), 0, 0.48, 0, 0, 0, 0, "#aeb7bd");
    add(new THREE.ConeGeometry(0.05, 0.075, 8), 0, 0.53, 0, 0, 0, 0, "#c2c9c9");
    add(bevelBox(0.065, 0.013, 0.012), 0, 0.48, 0.055, 0, 0, 0, "#33333c");
    [-1, 1].forEach(side => {
      const shoulder = new THREE.SphereGeometry(0.044, 7, 4);
      shoulder.scale(1, 0.65, 1);
      add(shoulder, side * 0.077, 0.39, 0, 0, 0, 0, "#aeb7bd");
    });
    crest(0.56);
    add(
      extrude(
        [
          [-0.06, 0.065],
          [0.06, 0.065],
          [0.055, -0.03],
          [0, -0.1],
          [-0.055, -0.03]
        ],
        0.022
      ),
      -0.075,
      0.32,
      0.05,
      0,
      -0.2
    );
    emblem(-0.075, 0.32, 0.085, 0.08, -0.2);
    add(new THREE.CylinderGeometry(0.012, 0.016, 0.54, 6), 0.1, 0.34, 0, 0, 0, 0, "#775438");
    add(new THREE.ConeGeometry(0.025, 0.085, 5), 0.1, 0.64, 0, 0, 0, 0, "#c2c9c9");
  }
  const result = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!result) {
    throw new Error("Could not assemble tabletop miniature");
  }
  // Keep the 32px slot footprint while giving silhouettes enough vertical relief.
  result.scale(0.75, 1, 0.75);
  return finishGeometry(result);
}


/** World sculpts trade subpixel rigging for broad painted volumes. Both LODs
 * have the same silhouette/base; all paint and heraldry remain one house/type
 * instance, including the light rim (no extra material, texture or draw).
 */
export function worldMiniatureGeometry(type: string, house: string, color: string, detailed: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = detailed ? 12 : 6;
  const paint = worldMiniatureColor(house, color), trim = "#f4e4bc", iron = "#8e9da8", dark = "#302b2c", wood = "#62422e";
  const add = (geometry: THREE.BufferGeometry, tint: string, x = 0, y = 0, z = 0): void => {
    geometry.translate(x, y, z);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) geometry.dispose();
    part.deleteAttribute("uv"); parts.push(paintGeometry(part, tint));
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, tint = paint): void =>
    add(new THREE.BoxGeometry(w, h, d), tint, x, y, z);
  const ball = (w: number, h: number, d: number, x: number, y: number, z: number, tint = paint): void =>
    add(new THREE.SphereGeometry(1, n, detailed ? 6 : 4).scale(w, h, d), tint, x, y, z);
  const beam = (a: number[], b: number[], radius: number, tint = paint): void => {
    const delta = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), detailed ? 8 : 5);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    add(geometry, tint, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  };
  const badge = (x: number, y: number, z: number, size: number, tilt = 0): void => {
    add(emblemGeometry(house).scale(size, size, size).rotateX(tilt), house == "baratheon" || house == "martell" ? dark : trim, x, y, z);
  };
  const radius = type == "dragon" ? 0.29 : type == "ship" ? 0.29 : type == "siege-engine" ? 0.245 : type == "knight" ? 0.235 : 0.195;
  add(new THREE.CylinderGeometry(radius, radius * 1.04, 0.065, n * 2), paint, 0, 0.0325, 0);
  add(new THREE.TorusGeometry(radius * 0.98, 0.009, 4, n * 2).rotateX(Math.PI / 2), trim, 0, 0.063, 0);
  if (type == "ship") {
    // A solid clinker-shaped hull, broad coloured sail and raised house crest.
    ball(0.145, 0.09, 0.38, 0, 0.15, 0, wood);
    // Paint the existing upper gunwale as a broad house stripe; no new faces.
    box(0.24, 0.035, 0.57, 0, 0.205, 0, paint);
    beam([0, 0.17, -0.36], [0, 0.29, -0.39], 0.024, trim);
    beam([0, 0.20, 0], [0, 0.73, 0], 0.018, dark);
    const sail = new THREE.BoxGeometry(0.35, 0.32, 0.028).rotateX(-0.22);
    add(sail, paint, 0, 0.49, 0.025);
    badge(0, 0.49, 0.046, 0.19, -0.22);
    beam([-0.20, 0.66, -0.01], [0.20, 0.66, -0.01], 0.015, trim);
    for (const side of [-1, 1]) for (const z of [-0.16, 0, 0.16]) {
      ball(0.035, 0.037, 0.018, side * 0.14, 0.22, z, paint);
    }
  } else if (type == "siege-engine") {
    box(0.27, 0.07, 0.36, 0, 0.20, 0, wood);
    for (const side of [-1, 1]) {
      for (const z of [-0.13, 0.13]) add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, n).rotateZ(Math.PI / 2), iron, side * 0.16, 0.14, z);
      beam([side * 0.09, 0.21, -0.13], [side * 0.09, 0.49, 0], 0.035);
      beam([side * 0.09, 0.21, 0.13], [side * 0.09, 0.49, 0], 0.035);
    }
    beam([0, 0.29, 0.20], [0, 0.76, -0.20], 0.03, trim);
    ball(0.075, 0.055, 0.075, 0, 0.76, -0.20, dark);
    box(0.18, 0.21, 0.025, 0, 0.37, 0.14);
    badge(0, 0.38, 0.159, 0.13);
  } else if (type == "dragon") {
    ball(0.13, 0.19, 0.24, 0, 0.30, 0);
    beam([0, 0.38, -0.14], [0, 0.57, -0.27], 0.075);
    ball(0.09, 0.075, 0.13, 0, 0.59, -0.29);
    beam([0, 0.25, 0.16], [0, 0.15, 0.50], 0.04);
    for (const side of [-1, 1]) {
      beam([side * 0.08, 0.26, 0.08], [side * 0.15, 0.09, -0.01], 0.055, dark);
      const wing = new THREE.Shape();
      wing.moveTo(side * 0.08, 0.30); wing.lineTo(side * 0.63, 0.46);
      wing.lineTo(side * 0.48, 0.07); wing.lineTo(side * 0.27, 0.18); wing.lineTo(side * 0.12, 0.08); wing.closePath();
      add(new THREE.ExtrudeGeometry(wing, {depth: 0.025, bevelEnabled: false}).rotateX(-0.6), paint, 0, 0.13, 0);
      beam([side * 0.08, 0.42, -0.10], [side * 0.63, 0.52, -0.24], 0.02, trim);
    }
    badge(0, 0.37, 0.23, 0.12, -0.3);
  } else {
    const knight = type == "knight", lift = knight ? 0.26 : 0;
    if (knight) {
      ball(0.13, 0.13, 0.24, 0, 0.26, 0);
      for (const side of [-1, 1]) for (const z of [-0.15, 0.15]) beam([side * 0.08, 0.25, z], [side * 0.08, 0.09, z], 0.035, dark);
      beam([0, 0.30, -0.13], [0, 0.46, -0.23], 0.075);
      ball(0.065, 0.07, 0.11, 0, 0.47, -0.25, trim);
    } else {
      for (const side of [-1, 1]) {
        beam([side * 0.055, 0.10, 0], [side * 0.055, 0.26, 0], 0.035, dark);
        box(0.08, 0.05, 0.12, side * 0.055, 0.09, 0.02, dark);
      }
    }
    add(new THREE.CylinderGeometry(0.085, 0.125, 0.27, n), paint, 0, 0.35 + lift, 0);
    ball(0.09, 0.055, 0.075, -0.095, 0.45 + lift, 0);
    ball(0.09, 0.055, 0.075, 0.095, 0.45 + lift, 0);
    ball(0.083, 0.09, 0.083, 0, 0.58 + lift, 0, iron);
    box(0.105, 0.018, 0.015, 0, 0.59 + lift, 0.08, dark);
    add(new THREE.ConeGeometry(0.07, 0.085, n), iron, 0, 0.68 + lift, 0);
    const shield = new THREE.CylinderGeometry(0.105, 0.105, 0.025, n).rotateX(Math.PI / 2 - 0.4);
    add(shield, trim, -0.11, 0.37 + lift, 0.105);
    add(new THREE.CylinderGeometry(0.091, 0.091, 0.028, n).rotateX(Math.PI / 2 - 0.4), paint, -0.11, 0.374 + lift, 0.119);
    badge(-0.11, 0.38 + lift, 0.138, 0.115, -0.4);
    beam([0.13, 0.22 + lift, 0], [0.13, 0.76 + lift, 0], 0.018, dark);
    add(new THREE.ConeGeometry(0.035, 0.11, n), iron, 0.13, 0.80 + lift, 0);
    // A broad coloured pennant makes the standard readable from the play orbit.
    box(0.13, 0.10, 0.018, 0.20, 0.70 + lift, 0);
  }
  const result = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!result) throw new Error("Could not assemble World miniature");
  result.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(result.getAttribute("position").count * 2), 2));
  return finishGeometry(result);
}

export function worldMiniatureColor(house: string, fallback: string): string {
  const colors: Record<string, string> = { stark: "#d5dfe8", lannister: "#e62f46", baratheon: "#ffd426", greyjoy: "#68555e",
    tyrell: "#23be65", martell: "#ff872c", arryn: "#4999ed", targaryen: "#b92c43", bolton: "#ea6c99" };
  return colors[house] ?? fallback;
}

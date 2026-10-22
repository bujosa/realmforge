import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";
import { CastlePalette } from "./castleStyles";
import { approach, curtainSegment, portal, squareTower, terrace } from "./CastleArchitecture";

export interface CastleSite {
  strong: boolean;
  height: number;
  banner: [number, number, number];
  gate: [number, number, number];
  approach: [number, number, number];
  resource?: [number, number, number];
}

// Original regional studies, not claimed as unseen landmark exterior reconstructions.
// Coordinates are local scene units. The game still supplies castle/resource
// levels; this table only seats architecture, banners and actual ornaments.
export const castleSites: Record<string, CastleSite> = {
  harrenhal: { strong: false, height: 0.39, banner: [-0.065, 0.267, -0.055], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  "moat-cailin": { strong: false, height: 0.325, banner: [-0.085, 0.247, -0.025], gate: [0, 0.022, 0.105], approach: [0, 0.005, 0.15] },
  oldtown: { strong: true, height: 0.47, banner: [-0.07, 0.438, -0.065], gate: [0, 0.025, 0.155], approach: [0, 0.005, 0.205], resource: [0.25, 0.022, 0] },
  "white-harbor": { strong: false, height: 0.365, banner: [-0.055, 0.3215, -0.045], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  seagard: { strong: true, height: 0.385, banner: [-0.11, 0.3415, -0.07], gate: [0, 0.022, 0.155], approach: [0, 0.005, 0.205], resource: [0.25, 0.022, 0] },
  "flints-finger": { strong: false, height: 0.325, banner: [-0.055, 0.2815, -0.035], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  "the-reach": { strong: false, height: 0.325, banner: [-0.055, 0.2815, -0.045], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  "crackclaw-point": { strong: false, height: 0.335, banner: [0.055, 0.2915, -0.045], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  yronwood: { strong: false, height: 0.345, banner: [-0.055, 0.3015, -0.045], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  starfall: { strong: false, height: 0.375, banner: [0.065, 0.3315, -0.045], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15], resource: [0.16, 0.022, 0] },
  "the-vale-of-arryn": { strong: false, height: 0.395, banner: [-0.055, 0.3515, -0.045], gate: [0, 0.022, 0.115], approach: [0, 0.005, 0.15] },
  pentos: { strong: true, height: 0.375, banner: [-0.085, 0.3315, -0.055], gate: [0, 0.022, 0.155], approach: [0, 0.005, 0.205], resource: [0.25, 0.022, 0] },
  volantis: { strong: true, height: 0.365, banner: [0, 0.3215, -0.065], gate: [0, 0.022, 0.155], approach: [0, 0.005, 0.205] }
};

export function castleSitePalette(kind: string): Partial<CastlePalette> | undefined {
  const palettes: Record<string, Partial<CastlePalette>> = {
    harrenhal: { stone: "#70756c", trim: "#8c8d7e", roof: "#42483f" },
    "moat-cailin": { stone: "#788177", trim: "#929984", roof: "#525c4c" },
    oldtown: { stone: "#c3b99a", trim: "#d9ceb1", roof: "#62736f" },
    "white-harbor": { stone: "#b5bfbd", trim: "#d0d4c8", roof: "#5e6c71" },
    seagard: { stone: "#9c9e8d", trim: "#c4bba3", roof: "#56666c" },
    "flints-finger": { stone: "#7e8b8b", trim: "#acb3ab", roof: "#514e44" },
    "the-reach": { stone: "#c4b998", trim: "#ddd0ac", roof: "#65725a" },
    "crackclaw-point": { stone: "#8c8b7a", trim: "#b0ab91", roof: "#555b50", round: true },
    yronwood: { stone: "#b9a27e", trim: "#ddc6a0", roof: "#8a7152" },
    starfall: { stone: "#d0c6b0", trim: "#e9deca", roof: "#8e8b80" },
    "the-vale-of-arryn": { stone: "#b6bdb6", trim: "#dedbd0", roof: "#788e96" },
    pentos: { stone: "#b5a88a", trim: "#d8c6a3", roof: "#887357" },
    volantis: { stone: "#6d7569", trim: "#a2a38a", roof: "#646f58" }
  };
  return palettes[kind];
}

function ground(b: CastleBuilder, site: CastleSite): void {
  const [x, z] = site.strong ? [0.26, 0.215] : [0.173, 0.154];
  terrace(b, [[-x, -z * 0.73], [-x * 0.73, -z], [x * 0.68, -z], [x, -z * 0.60], [x, z * 0.63], [x * 0.58, z], [-x * 0.65, z], [-x, z * 0.50]], -0.09, 0.02, b.palette.stone, true);
  b.box(x * 1.65, 0.008, z * 1.55, 0, 0.016, -0.008, "#9b9481");
  // The strategic crown plaque has its own rooted stone threshold, including
  // where it projects beyond the irregular court. It is never a floating tag.
  b.box(0.108, 0.117, 0.057, 0, -0.0315, site.strong ? 0.207 : 0.155);
  const resource = site.resource;
  if (resource) {
    [-1, 1].forEach(side => b.box(0.04, 0.11, 0.05, side * resource[0], -0.033, resource[2], b.palette.stone));
  }
}

function hall(b: CastleBuilder, x: number, z: number, w: number, d: number, h: number): void {
  b.box(w, h, d, x, 0.02 + h / 2, z);
  const roof = new THREE.Shape();
  roof.moveTo(-w * 0.57, 0); roof.lineTo(w * 0.57, 0); roof.lineTo(0, 0.045); roof.closePath();
  b.add(new THREE.ExtrudeGeometry(roof, { depth: d + 0.016, bevelEnabled: false }), x, h + 0.02, z - d / 2 - 0.008, b.palette.roof, 0, 2, b.style == "north" ? 1 : 0);
  if (b.detailed) {
    [-1, 1].forEach(side => {
      for (let i = 0; i < 3; i++) b.window(x + side * w * 0.51, h * 0.62 + 0.02, z + (i - 1) * d * 0.29, side * Math.PI / 2, 0.011, 0.031);
    });
  }
}

function enclosure(b: CastleBuilder, strong: boolean, h = 0.115): void {
  const [x, z] = strong ? [0.205, 0.145] : [0.133, 0.105];
  const corners = [[-x, z], [-x, -z], [x, -z], [x, z]];
  corners.slice(0, -1).forEach((p, i) => curtainSegment(b, p, corners[i + 1], 0.02, h));
  [-1, 1].forEach(side => {
    curtainSegment(b, [side * 0.036, z], [side * x, z], 0.02, h);
    squareTower(b, side * x, -z, 0.043, 0.045, 0.02, h + 0.035);
    b.box(0.02, h + 0.026, 0.038, side * 0.035, 0.02 + (h + 0.026) / 2, z);
  });
  portal(b, 0, z + 0.01, 0.022, 0.045, h * 0.79);
  approach(b, 0, z + 0.031, strong ? 0.205 : 0.15, 0.022, 0.065);
}

function ruinedTower(b: CastleBuilder, x: number, z: number, r: number, h: number, seed: number): void {
  const count = b.detailed ? 18 : 10;
  b.add(new THREE.CylinderGeometry(r * 0.92, r * 1.12, h - 0.035, count), x, 0.02 + (h - 0.035) / 2, z);
  b.add(new THREE.TorusGeometry(r * 0.83, r * 0.18, 4, count).rotateX(-Math.PI / 2), x, h - 0.0165, z);
  // Irregular, open broken crown, not orderly intact merlons on a ruin.
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count;
    const rise = 0.014 + (Math.sin(i * 2.7 + seed) * 0.5 + 0.5) * 0.039;
    b.box(r * 0.34, rise, 0.012, x + Math.sin(a) * r * 0.82, h - 0.012 + rise / 2, z + Math.cos(a) * r * 0.82, i % 3 ? b.palette.stone : "#515b56", a);
  }
  b.box(r * 1.08, 0.008, r * 1.08, x, h - 0.026, z, "#343a37");
  if (b.detailed) {
    [-1, 1].forEach(side => b.window(x, h * 0.46, z + side * r, side > 0 ? 0 : Math.PI, 0.011, 0.033));
  }
}

function arcade(b: CastleBuilder, x: number, z: number, width: number, base: number, h: number): void {
  const count = b.detailed ? 5 : 3;
  for (let i = 0; i <= count; i++) {
    b.box(0.009, h, 0.025, x + (i / count - 0.5) * width, base + h / 2, z, b.palette.trim);
  }
  b.box(width + 0.018, 0.014, 0.035, x, base + h, z, b.palette.trim);
  b.box(width + 0.02, 0.008, 0.041, x, base - 0.003, z, b.palette.trim);
}

export function buildCastleSite(kind: string, b: CastleBuilder): number | undefined {
  const site = castleSites[kind];
  if (!site) return undefined;
  ground(b, site);
  const p = b.palette;
  if (kind == "harrenhal") {
    // Blackened, damaged masses replace the intact roofed generic river keep.
    curtainSegment(b, [-0.13, -0.09], [0.13, -0.09], 0.02, 0.12);
    curtainSegment(b, [-0.13, -0.09], [-0.13, 0.10], 0.02, 0.085);
    ruinedTower(b, -0.065, -0.055, 0.037, 0.29, 2);
    ruinedTower(b, 0.055, -0.065, 0.041, 0.345, 5);
    ruinedTower(b, 0.115, 0.055, 0.026, 0.22, 1);
    ruinedTower(b, -0.105, 0.065, 0.029, 0.185, 7);
    b.box(0.065, 0.12, 0.055, 0.008, 0.08, 0.035, "#62675e");
    portal(b, 0, 0.115, 0.022, 0.045, 0.077);
    approach(b, 0, 0.134, 0.15, 0.022, 0.065);
  } else if (kind == "moat-cailin") {
    ruinedTower(b, -0.085, -0.025, 0.033, 0.27, 3);
    ruinedTower(b, 0.080, -0.045, 0.031, 0.22, 6);
    ruinedTower(b, 0.015, 0.065, 0.027, 0.155, 9);
    b.box(0.053, 0.012, 0.25, -0.015, 0.025, 0.012, "#81836a");
    if (b.detailed) {
      for (let i = 0; i < 5; i++) b.box(0.023, 0.012 + i % 2 * 0.009, 0.019, 0.080 - i * 0.04, 0.026, 0.105, "#69765b", i * 0.24);
    }
  } else if (kind == "oldtown") {
    enclosure(b, true, 0.10);
    // Compact stepped beacon and scholarly courtyard; inferred exterior layout.
    for (let i = 0; i < 5; i++) {
      const r = 0.071 - i * 0.010;
      b.add(new THREE.CylinderGeometry(r, r + 0.007, 0.075, b.detailed ? 20 : 10), -0.07, 0.0575 + i * 0.075, -0.065);
      b.add(new THREE.CylinderGeometry(r + 0.006, r + 0.006, 0.009, b.detailed ? 20 : 10), -0.07, 0.097 + i * 0.075, -0.065, p.trim);
    }
    b.add(new THREE.CylinderGeometry(0.026, 0.029, 0.043, 12), -0.07, 0.4165, -0.065, p.trim);
    b.add(new THREE.TorusGeometry(0.025, 0.007, 4, 16).rotateX(-Math.PI / 2), -0.07, 0.445, -0.065, p.trim);
    hall(b, 0.105, -0.025, 0.08, 0.19, 0.11);
    arcade(b, 0.055, 0.07, 0.16, 0.025, 0.068);
  } else if (kind == "white-harbor") {
    enclosure(b, false, 0.105);
    squareTower(b, -0.055, -0.045, 0.077, 0.072, 0.02, 0.30);
    hall(b, 0.065, -0.018, 0.065, 0.12, 0.14);
    arcade(b, 0.025, 0.055, 0.13, 0.025, 0.062);
  } else if (kind == "seagard") {
    enclosure(b, true, 0.12);
    squareTower(b, -0.11, -0.07, 0.082, 0.085, 0.02, 0.32);
    hall(b, 0.07, -0.035, 0.12, 0.18, 0.16);
    if (b.detailed) {
      [-1, 1].forEach(side => b.box(0.012, 0.058, 0.08, -0.11 + side * 0.048, 0.28, -0.07, p.trim));
      b.add(new THREE.CylinderGeometry(0.010, 0.015, 0.024, 10), -0.11, 0.31, -0.024, "#8d795a");
    }
  } else if (kind == "flints-finger") {
    enclosure(b, false, 0.095);
    squareTower(b, -0.055, -0.035, 0.073, 0.077, 0.02, 0.26);
    hall(b, 0.055, -0.01, 0.06, 0.12, 0.11);
    [-1, 1].forEach(side => b.box(0.022, 0.07, 0.04, -0.055 + side * 0.044, 0.055, -0.035, "#6e7774"));
  } else if (kind == "the-reach") {
    enclosure(b, false, 0.095);
    squareTower(b, -0.055, -0.045, 0.073, 0.073, 0.02, 0.26);
    hall(b, 0.065, -0.035, 0.055, 0.09, 0.10);
    b.garden(0.06, 0.055, 0.08, 0.055);
  } else if (kind == "crackclaw-point") {
    enclosure(b, false, 0.12);
    squareTower(b, 0.055, -0.045, 0.073, 0.073, 0.02, 0.27);
    b.tower(-0.075, -0.035, 0.18, 0.031, 0.02, false);
    hall(b, -0.035, 0.045, 0.055, 0.075, 0.10);
  } else if (kind == "yronwood") {
    enclosure(b, false, 0.145);
    squareTower(b, -0.055, -0.045, 0.082, 0.080, 0.02, 0.28);
    b.box(0.073, 0.13, 0.12, 0.065, 0.085, -0.005);
    arcade(b, 0.062, 0.062, 0.10, 0.025, 0.064);
  } else if (kind == "starfall") {
    enclosure(b, false, 0.10);
    squareTower(b, 0.065, -0.045, 0.062, 0.066, 0.02, 0.31);
    b.box(0.078, 0.125, 0.14, -0.055, 0.0825, -0.015);
    arcade(b, -0.035, 0.075, 0.12, 0.025, 0.074);
    b.garden(0.045, 0.05, 0.045, 0.045);
  } else if (kind == "the-vale-of-arryn") {
    enclosure(b, false, 0.14);
    squareTower(b, -0.055, -0.045, 0.065, 0.070, 0.02, 0.33);
    hall(b, 0.055, -0.025, 0.065, 0.14, 0.15);
    [-1, 1].forEach(side => b.box(0.017, 0.12, 0.036, -0.055 + side * 0.041, 0.08, -0.045, p.trim));
  } else if (kind == "pentos") {
    enclosure(b, true, 0.11);
    squareTower(b, -0.085, -0.055, 0.092, 0.09, 0.02, 0.31);
    b.box(0.12, 0.13, 0.15, 0.08, 0.085, -0.035);
    b.roof(0.08, -0.035, 0.15, 0.085, 0.07);
    arcade(b, 0.055, 0.09, 0.19, 0.025, 0.07);
    b.garden(-0.07, 0.07, 0.07, 0.07);
  } else if (kind == "volantis") {
    enclosure(b, true, 0.14);
    // Dark inner-city masonry and a stepped gate, not a second Braavos bank.
    b.box(0.33, 0.115, 0.20, 0, 0.0775, -0.025, "#61665c");
    squareTower(b, 0, -0.065, 0.095, 0.085, 0.02, 0.30);
    [-1, 1].forEach(side => {
      squareTower(b, side * 0.123, -0.07, 0.065, 0.063, 0.02, 0.225);
      arcade(b, side * 0.095, 0.082, 0.105, 0.025, 0.078);
    });
  }
  return site.strong ? 0.207 : 0.155;
}

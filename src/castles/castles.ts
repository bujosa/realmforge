import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";
import { CastleKit } from "./castleKit";
import { CastleStyle } from "./castleStyles";
import { buildLandmarkCastle, landmarkCastlePalette } from "./landmarkCastles";
import { buildCastleSite, castleSites, castleSitePalette } from "./CastleSites";
import { buildCastleDetails, castleDrawbridge } from "./CastleDetails";
import { buildEyrie, buildValeSettlement } from "./CastleVale";
import { buildIronBank } from "./CastleBank";
import { buildPyke, pykePalette } from "./CastlePyke";
import { riverrunYard, sunspearYard, genericYard } from "./CastleNeighborhood";

export function castleGeometry(kind: string, style: CastleStyle, variant = 0, detailed = true, kit?: CastleKit, level = 2): THREE.BufferGeometry {
  const b = new CastleBuilder(style, detailed, kit, kind == "pyke" ? pykePalette : landmarkCastlePalette(kind) ?? castleSitePalette(kind));
  const p = b.palette;
  const strong = castleSites[kind]?.strong ?? (kind != "castle");
  const w = strong ? 0.44 : 0.26;
  const d = strong ? 0.34 : 0.22;
  // A recessed foundation skirt seals mild relief without hovering on a slab.
  const foundation = (width: number, depth: number): void => b.box(width, 0.11, depth, 0, -0.035, 0, p.stone);
  const moat = (width: number, depth: number): void => {
    [-1, 1].forEach(side => {
      b.box(width, 0.007, 0.023, 0, 0.024, side * depth / 2, "#588ca0", 0, 4);
      b.box(0.023, 0.007, depth, side * width / 2, 0.024, 0, "#588ca0", 0, 4);
    });
    b.bridge(0, depth / 2, 0.10, 0.035);
  };
  let plaqueDepth = d / 2 + 0.045;
  const landmarkDepth = buildLandmarkCastle(kind, b);
  if (landmarkDepth != undefined) {
    plaqueDepth = landmarkDepth;
  } else if (kind == "iron-bank") {
    plaqueDepth = buildIronBank(b);
  } else if (kind == "pyke") {
    plaqueDepth = buildPyke(b);
  } else if (kind == "the-eyrie") {
    plaqueDepth = buildEyrie(b);
  } else if (kind == "the-vale-of-arryn") {
    // Stays on buildValeSettlement (richer than its CastleSites study).
    plaqueDepth = buildValeSettlement(b);
  } else if (castleSites[kind]) {
    // The 13 regional CastleSites profiles (Harrenhal, Moat Cailin, Seagard...).
    plaqueDepth = buildCastleSite(kind, b) ?? plaqueDepth;
  } else if (kind == "casterly-rock") {
    b.cliff(0.30, 0.26);
    b.keep(0.17, 0.27, 0.13, -0.015, -0.03);
    b.curtain(0.29, 0.18, 0.27, false, 0.085);
    // Recessed galleries and the Lion's Mouth read as masonry in the cliff.
    b.box(0.18, 0.06, 0.036, 0, 0.19, 0.17, p.stone);
    [-2, -1, 0, 1, 2].forEach(i => b.window(i * 0.032, 0.193, 0.191, 0, 0.017, 0.04));
    b.box(0.055, 0.065, 0.011, 0, 0.023, 0.207, "#373943");
    plaqueDepth = 0.205;
  } else if (kind == "sunspear") {
    foundation(0.45, 0.34);
    b.curtain(0.36, 0.24, 0.02, false, 0.10);
    // Sandship: broad, rounded sandstone hall, dome and slender Spear Tower.
    b.add(new THREE.CylinderGeometry(0.071, 0.088, 0.20, 16).scale(1.1, 1, 0.8), 0.055, 0.12, -0.022);
    b.add(new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(0.087 * Math.cos(i * Math.PI / 16), 0.087 * Math.sin(i * Math.PI / 16))), b.detailed ? 20 : 10).scale(1, 0.82, 0.82), 0.055, 0.22, -0.022, "#b89b61", 0, 1);
    b.tower(-0.10, -0.04, 0.43, 0.021, 0.025);
    b.add(new THREE.ConeGeometry(0.024, 0.065, 10), -0.10, 0.485, -0.04, p.trim);
    b.tower(0.125, 0.01, 0.25, 0.033, 0.02);
    b.garden(0, 0.075, 0.10, 0.045);
    sunspearYard(b);
    plaqueDepth = 0.159;
  } else if (kind == "riverrun") {
    foundation(0.53, 0.46);
    const corners = [[-0.205, 0.135], [0.205, 0.135], [0, -0.20]];
    corners.forEach(([x, z], i) => {
      const [nx, nz] = corners[(i + 1) % 3];
      const a = -Math.atan2(nz - z, nx - x);
      b.tower(x, z, 0.25, 0.035, 0.02);
      b.wall((x + nx) / 2, (z + nz) / 2, Math.hypot(nx - x, nz - z), a, 0.02, 0.17);
      b.box(Math.hypot(nx - x, nz - z), 0.008, 0.023, (x + nx) / 2 * 1.11, 0.024, (z + nz) / 2 * 1.11, "#6796a5", a, 4);
    });
    b.keep(0.31, 0.02);
    b.gate(0.135, 0.02, 0.18);
    b.box(0.042, 0.034, 0.013, 0.09, 0.042, 0.16, "#343d46");
    castleDrawbridge(b);
    riverrunYard(b);
    plaqueDepth = 0.208;
  } else {
    foundation(w + 0.085, d + 0.085);
    b.curtain(w, d, 0.02, style != "stormlands", strong ? 0.17 : 0.115);
    b.keep(strong ? 0.32 : 0.245, 0.02, strong ? 0.15 : 0.105, variant ? -0.023 : 0);
    if (strong) { b.tower(0.105, -0.06, 0.31, 0.034, 0.02); }
    if (style == "riverlands") { moat(w + 0.072, d + 0.072); }
    if (style == "reach") { b.garden(w * 0.27, 0.02, 0.055, 0.07); }
    if (style == "vale") { b.tower(-w * 0.26, -0.04, strong ? 0.37 : 0.29, 0.020, 0.02); }
    genericYard(b, strong);
  }
  buildCastleDetails(kind, b);
  // Site profiles seat their own plaque root in CastleSites.ground; Pyke and
  // the Vale settlement build their own rooted toes.
  if (!castleSites[kind] && kind != "pyke" && kind != "the-vale-of-arryn") {
    b.box(0.108, 0.117, 0.057, 0, -0.0315, plaqueDepth);
  }
  b.plaque(Math.min(2, Math.max(1, level)), plaqueDepth);
  return b.finish();
}

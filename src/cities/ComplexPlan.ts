/**
 * Physical castle complexes for World ×20 (design §3, §6 P3·C2): pure plans in
 * metres. No three.js, no DOM, no game state beyond the public castle seat.
 *
 * Local frame of a plan: origin at the castle anchor (the board miniature's
 * foot), x east, z south (the miniature's gate side), y up, all in metres
 * relative to the anchor's height. The anchor always stays in an open ward,
 * so the banner, the resource ornaments and the miniature's footprint keep a
 * clear yard; the keep stands behind it (−z) and the gatehouse in front (+z).
 *
 * A plan is a function of (region id, castle kind, level, style, public
 * terrain and public slots) only: same inputs, same plan (fog-safe,
 * deterministic). It never looks at units, orders or controllers.
 */

import { CastlePalette, CastleStyle } from "../castles/castleStyles";
import { DRAGONSTONE_OUTLINE, DRAGONSTONE_PALETTE, DRAGONSTONE_STRUCTURES, dragonstoneCarvingVolumes, STORMS_END_PALETTE } from "./CrownSeatRecipes";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type RoofKind = "none" | "cone" | "pyramid" | "dome" | "gable";

export type Structure =
  | { type: "curtain"; a: Vec2; b: Vec2; h: number; t: number; ruined?: boolean }
  | { type: "tower"; x: number; z: number; r: number; h: number; round: boolean; roof: RoofKind; ruin?: "broken" | "melted" }
  | { type: "gatehouse"; x: number; z: number; angle: number; w: number; h: number; r: number; round: boolean }
  | { type: "keep"; x: number; z: number; w: number; d: number; h: number; roof: RoofKind; turrets: boolean }
  | { type: "hall"; x: number; z: number; w: number; d: number; h: number; angle: number; glass?: boolean }
  | { type: "drum"; x: number; z: number; r: number; h: number; roof: RoofKind };

/**
 * Ward dressing (detailed form only): local metres, `ground` the yard's height
 * at the prop, `angle` a three.js Y rotation, `size` the prop's length (m).
 */
export interface Prop { type: "well" | "cart" | "stable" | "yard" | "woodpile" | "tree" | "conifer" | "heart-tree" | "garden-bed"; x: number; z: number; angle: number; ground: number; size: number }

/** A structure seated on the terrain: `base` under the lowest ground sample, `top` its crown. */
export type Seated = Structure & { base: number; ground: number; top: number };

/** Camera/collision volume: axis-aligned box in local metres, from the ground up to `top`. */
export interface Volume { minX: number; maxX: number; minZ: number; maxZ: number; top: number }

/** Geography-scale landmark that is always physical (design §2.5: «≥ 28 px + aguja»). */
export type HeroPlan =
  | { kind: "hightower"; x: number; z: number; base: number; ground: number; height: number }
  | { kind: "needles"; spires: { x: number; z: number; r: number; base: number; ground: number; height: number; seed: number }[] }
  | { kind: "rock"; x: number; z: number; yaw: number; rx: number; rz: number; base: number; height: number; seed: number; seaward: number; sea: number };

export interface ComplexPlan {
  id: string;
  recipe: string;
  style: CastleStyle;
  palette?: Partial<CastlePalette>;
  /** Horizontal fit factor (1 = authored size). */
  fit: number;
  offset: Vec2;
  /** Whole complex raised onto a hero (needle top, rock summit), metres. */
  lift: number;
  structures: Seated[];
  /** Aegon's High Hill: a flat crown with a terrain-following sloping rim. */
  plateau?: { top: number; rim: Vec3[]; centre: Vec2 };
  extents: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Physical height the size law compares with the miniature (switch distance). */
  switchMetres: number;
  banner: Vec3;
  chimney?: Vec3;
  torches: Vec3[];
  /** Volumes of the switching complex (solid only while it is physical). */
  volumes: Volume[];
  /** Volumes of the always-physical hero. */
  heroVolumes: Volume[];
  hero?: HeroPlan;
  /** Courtyard dressing: well, stable, carts, woodpile, training yard, godswood (detailed form only). */
  props: Prop[];
}

/** Public terrain and reservations around one castle, in local metres. */
export interface ComplexGround {
  /** Terrain height (m) relative to the anchor. */
  height(x: number, z: number): number;
  /** Sea, lake or river at this point. */
  wet(x: number, z: number): boolean;
  /** A gameplay slot or another castle lies within `radius` metres. */
  reserved(x: number, z: number, radius: number): boolean;
  /** Inside the seat's own region (public polygon). Heroes never spill into a neighbour. */
  own?(x: number, z: number): boolean;
}

export interface ComplexSite {
  id: string;
  /** landmarkKind(): castle, stronghold, preset landmark key */
  kind: string;
  level: number;
  style: CastleStyle;
  palette?: Partial<CastlePalette>;
  /** Unit vector (local x, z) toward the seat's own harbour or nearest sea, from public slots. */
  seaward?: Vec2;
}

/** Regions whose board sculpt stays the physical form (no complex is planned). */
const NO_COMPLEX = new Set(["iron-bank"]);

function hash(text: string): number {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  return seed >>> 0;
}

function random(id: string): () => number {
  let seed = hash(id) | 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

interface StyleRule { round: boolean; towerRoof: RoofKind; keepRoof: RoofKind }

const STYLE_RULES: Record<CastleStyle, StyleRule> = {
  north: { round: false, towerRoof: "none", keepRoof: "pyramid" },
  riverlands: { round: true, towerRoof: "cone", keepRoof: "pyramid" },
  vale: { round: true, towerRoof: "cone", keepRoof: "cone" },
  westerlands: { round: false, towerRoof: "none", keepRoof: "none" },
  reach: { round: true, towerRoof: "cone", keepRoof: "cone" },
  stormlands: { round: true, towerRoof: "none", keepRoof: "none" },
  dorne: { round: false, towerRoof: "dome", keepRoof: "dome" },
  islands: { round: true, towerRoof: "cone", keepRoof: "cone" },
  crownlands: { round: false, towerRoof: "none", keepRoof: "none" },
  essos: { round: false, towerRoof: "dome", keepRoof: "dome" }
};

interface Draft {
  recipe: string;
  palette?: Partial<CastlePalette>;
  structures: Structure[];
  switchMetres: number;
  /** Fit test outline (m): the enclosure's perimeter points. */
  outline: Vec2[];
  hero?: "hightower" | "needles" | "rock";
}

/** Rectangle curtain with corner towers, optional side towers and a gatehouse on +z. */
function ward(w: number, back: number, front: number, h: number, t: number, tower: { r: number; h: number; round: boolean; roof: RoofKind }, gate: { r: number; h: number; w: number }, sides = 0): Structure[] {
  const list: Structure[] = [];
  const corners: Vec2[] = [[-w, back], [w, back], [w, front], [-w, front]];
  const gap = gate.w / 2 + gate.r * 0.9;
  // Back and both sides, split at the side towers; the front is split by the gate.
  const edges: [Vec2, Vec2][] = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[3], corners[0]]];
  edges.forEach(([a, b]) => {
    const parts = sides + 1;
    for (let i = 0; i < parts; i++) {
      const p0: Vec2 = [a[0] + (b[0] - a[0]) * i / parts, a[1] + (b[1] - a[1]) * i / parts];
      const p1: Vec2 = [a[0] + (b[0] - a[0]) * (i + 1) / parts, a[1] + (b[1] - a[1]) * (i + 1) / parts];
      list.push({ type: "curtain", a: p0, b: p1, h, t });
      if (i > 0) list.push({ type: "tower", x: p0[0], z: p0[1], r: tower.r * 0.85, h: tower.h * 0.9, round: tower.round, roof: tower.roof });
    }
  });
  list.push({ type: "curtain", a: [w, front], b: [gap, front], h, t }, { type: "curtain", a: [-gap, front], b: [-w, front], h, t });
  corners.forEach(([x, z]) => list.push({ type: "tower", x, z, r: tower.r, h: tower.h, round: tower.round, roof: tower.roof }));
  list.push({ type: "gatehouse", x: 0, z: front, angle: 0, w: gate.w, h: gate.h, r: gate.r, round: tower.round });
  return list;
}

function rectOutline(w: number, back: number, front: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    out.push([-w + 2 * w * t, back], [-w + 2 * w * t, front], [-w, back + (front - back) * t], [w, back + (front - back) * t]);
  }
  return out;
}

function ringOutline(r: number, cz = 0): Vec2[] {
  return Array.from({ length: 24 }, (_, i) => [Math.sin(i * Math.PI / 12) * r, cz + Math.cos(i * Math.PI / 12) * r] as Vec2);
}

/** Closed polygon curtain with a tower at every vertex; the gate sits on the edge crossing +z. */
function polygonWard(points: Vec2[], h: number, t: number, tower: (i: number) => { r: number; h: number; round: boolean; roof: RoofKind }, gate: { r: number; h: number; w: number }): Structure[] {
  const list: Structure[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const crossing = (a[0] <= 0) != (b[0] <= 0) && (a[1] + b[1]) / 2 > 0;
    if (crossing) {
      const t0 = a[0] / (a[0] - b[0]);
      const gz = a[1] + (b[1] - a[1]) * t0;
      const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const gap = (gate.w / 2 + gate.r * 0.9) / len;
      const ga: Vec2 = [a[0] + (b[0] - a[0]) * (t0 - gap), a[1] + (b[1] - a[1]) * (t0 - gap)];
      const gb: Vec2 = [a[0] + (b[0] - a[0]) * (t0 + gap), a[1] + (b[1] - a[1]) * (t0 + gap)];
      list.push({ type: "curtain", a, b: ga, h, t }, { type: "curtain", a: gb, b, h, t });
      list.push({ type: "gatehouse", x: 0, z: gz, angle: angle + (a[0] > b[0] ? Math.PI : 0), w: gate.w, h: gate.h, r: gate.r, round: true });
    } else {
      list.push({ type: "curtain", a, b, h, t });
    }
    const spec = tower(i);
    list.push({ type: "tower", x: a[0], z: a[1], ...spec });
  });
  return list;
}

function circle(n: number, r: number, cz: number, phase = 0, squash = 1): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + i * Math.PI * 2 / n;
    return [Math.sin(a) * r, cz + Math.cos(a) * r * squash] as Vec2;
  });
}

/** Authored recipe (metres, fit 1) for a castle seat. */
/** Original Tarly seat, shared by the Marches scenery recipe; no gameplay seat is added. */
export function hillFortStructures(): Structure[] {
  return [
    ...ward(54, -48, 44, 12, 3.5, { r: 6, h: 20, round: false, roof: "pyramid" }, { r: 6, h: 18, w: 9 }),
    { type: "keep", x: -8, z: -20, w: 27, d: 24, h: 32, roof: "pyramid", turrets: true },
    { type: "hall", x: 26, z: 8, w: 28, d: 12, h: 11, angle: Math.PI / 2 }
  ];
}

function draft(site: ComplexSite, rule: StyleRule, rand: () => number): Draft | undefined {
  const { kind, level } = site;
  const jitter = (v: number): number => v * (0.94 + rand() * 0.12);
  const roof = rule.towerRoof;
  if (kind == "kings-landing") {
    // The Red Keep on Aegon's High Hill: ~300 × 250 m, seven drum towers of
    // 60–70 m, Maegor's Holdfast, the throne-room hall and the Tower of the Hand.
    const pts = circle(7, 125, -40, Math.PI / 7, 0.86);
    const structures = polygonWard(pts, 30, 7, i => ({ r: 13, h: jitter(66), round: true, roof: i % 3 == 1 ? "cone" : "none" }), { r: 11, h: 44, w: 13 });
    structures.push(
      { type: "keep", x: 38, z: -78, w: 52, d: 52, h: 52, roof: "none", turrets: true },
      { type: "hall", x: -30, z: -50, w: 70, d: 26, h: 24, angle: 0 },
      { type: "tower", x: -78, z: -88, r: 12, h: 78, round: true, roof: "cone" },
      { type: "hall", x: 52, z: -18, w: 40, d: 14, h: 14, angle: Math.PI / 2 },
      { type: "hall", x: -60, z: 2, w: 34, d: 12, h: 12, angle: 0.3 }
    );
    return { recipe: "red-keep", structures, switchMetres: 88, outline: pts.concat(ringOutline(118, -40)) };
  }
  if (kind == "harrenhal") {
    // Five colossal towers «like melted wax» and a 30 m curtain around a vast,
    // empty ward; the Hall of a Hundred Hearths. Blackened and vitrified.
    const w = 190, back = -175, front = 135;
    const structures: Structure[] = [];
    const corners: Vec2[] = [[-w, back], [0, back - 20], [w, back], [w, front], [-w, front]];
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % corners.length];
      if (i == 3) {
        structures.push({ type: "curtain", a, b: [16, front], h: 30, t: 10 }, { type: "curtain", a: [-16, front], b, h: 30, t: 10 });
      } else structures.push({ type: "curtain", a, b, h: i == 4 ? 24 : 30, t: 10, ruined: i == 4 });
      structures.push({ type: "tower", x: a[0], z: a[1], r: jitter(20), h: jitter(98), round: true, roof: "none", ruin: "melted" });
    });
    structures.push(
      { type: "gatehouse", x: 0, z: front, angle: 0, w: 14, h: 36, r: 10, round: true },
      { type: "hall", x: 0, z: -120, w: 130, d: 32, h: 26, angle: 0 },
      { type: "hall", x: -110, z: -40, w: 60, d: 18, h: 14, angle: Math.PI / 2 }
    );
    return { recipe: "harrenhal", structures, switchMetres: 100, outline: rectOutline(w, back - 20, front) };
  }
  if (kind == "the-eyrie") {
    // The palace sits on the main needle (lifted); only towers and keep, no ward.
    const structures: Structure[] = [];
    circle(6, 21, 0, 0.3).forEach(([x, z], i) => structures.push({ type: "tower", x, z, r: 3.6, h: jitter(30 + (i % 3) * 6), round: true, roof: "cone" }));
    structures.push(
      { type: "keep", x: 0, z: -2, w: 18, d: 14, h: 28, roof: "cone", turrets: false },
      { type: "tower", x: 4, z: 6, r: 4.2, h: 44, round: true, roof: "cone" },
      { type: "hall", x: -8, z: 8, w: 16, d: 8, h: 10, angle: 0.4 }
    );
    circle(6, 21, 0, 0.3).forEach((a, i, all) => structures.push({ type: "curtain", a, b: all[(i + 1) % all.length], h: 7, t: 2.4 }));
    return { recipe: "eyrie", structures, switchMetres: 60, outline: ringOutline(26), hero: "needles" };
  }
  if (kind == "casterly-rock") {
    // Summit fortress carved into the headland (the headland itself is the hero).
    const structures = ward(56, -44, 38, 12, 4, { r: 6, h: 22, round: false, roof: "none" }, { r: 5.5, h: 18, w: 9 }, 1);
    structures.push(
      { type: "keep", x: -14, z: -26, w: 26, d: 18, h: 38, roof: "none", turrets: true },
      { type: "hall", x: 24, z: -24, w: 28, d: 12, h: 13, angle: 0 },
      { type: "tower", x: 32, z: 8, r: 6, h: 32, round: false, roof: "none" }
    );
    return { recipe: "casterly-summit", structures, switchMetres: 60, outline: rectOutline(56, -44, 38), hero: "rock" };
  }
  if (kind == "winterfell") {
    // Two curtains (outer 24 m, inner 30 m) with the moat between them, the
    // Great Keep, the Broken Tower, the First Keep, the hall and glass gardens.
    const structures = ward(132, -122, 104, 24, 6, { r: 8, h: 31, round: false, roof: "none" }, { r: 7, h: 30, w: 12 }, 1);
    structures.push(...ward(100, -94, 76, 30, 7, { r: 8.5, h: 37, round: false, roof: "pyramid" }, { r: 7.5, h: 36, w: 11 }, 1));
    structures.push(
      { type: "keep", x: -34, z: -62, w: 34, d: 26, h: 40, roof: "pyramid", turrets: true },
      { type: "tower", x: 64, z: -62, r: 8, h: 50, round: true, roof: "none", ruin: "broken" },
      { type: "drum", x: 52, z: 22, r: 11, h: 24, roof: "none" },
      { type: "hall", x: 10, z: -32, w: 52, d: 18, h: 16, angle: 0 },
      { type: "hall", x: -62, z: 30, w: 54, d: 20, h: 10, angle: 0, glass: true },
      { type: "hall", x: -66, z: -16, w: 26, d: 10, h: 9, angle: Math.PI / 2 }
    );
    return { recipe: "winterfell", structures, switchMetres: 50, outline: rectOutline(138, -128, 110) };
  }
  if (kind == "seagard") {
    // Mallister seat: square Booming Tower above a coastal ward and long hall.
    // Original metre-scale recipe; no new material, draw batch or game seat.
    const structures = ward(82, -76, 64, 14, 4,
      { r: 6, h: 20, round: false, roof: "none" },
      { r: 5, h: 19, w: 10 });
    structures.push(
      { type: "keep", x: -28, z: -36, w: 22, d: 22, h: 42, roof: "none", turrets: false },
      { type: "hall", x: 30, z: -32, w: 42, d: 16, h: 13, angle: Math.PI / 2 },
      { type: "hall", x: -40, z: 22, w: 28, d: 10, h: 8, angle: 0 }
    );
    return { recipe: "seagard", structures, switchMetres: 42, outline: rectOutline(82, -76, 64) };
  }
  if (kind == "riverrun") {
    // Triangular river castle at the confluence: drum towers with slate cones.
    const pts: Vec2[] = [[-100, 62], [0, -112], [100, 62]];
    const structures = polygonWard(pts, 16, 5, () => ({ r: 9, h: jitter(26), round: true, roof: "cone" }), { r: 7, h: 24, w: 10 });
    [[-50, -25]].forEach(([x, z]) => structures.push({ type: "tower", x, z, r: 6.5, h: 22, round: true, roof: "cone" }));
    structures.push({ type: "keep", x: 0, z: -40, w: 24, d: 22, h: 36, roof: "pyramid", turrets: true }, { type: "hall", x: -42, z: 24, w: 30, d: 12, h: 11, angle: 0.5 });
    // Lower Water Gate on the riverward side; paired slate-capped turrets.
    structures.push(
      { type: "gatehouse", x: 50, z: -25, angle: Math.PI / 3, w: 9, h: 14, r: 4, round: true },
      { type: "hall", x: 30, z: 28, w: 24, d: 10, h: 8, angle: 0 }
    );
    return { recipe: "riverrun", structures, switchMetres: 40, outline: pts.concat(ringOutline(60, -20)) };
  }
  if (kind == "dragonstone") {
    const pts = DRAGONSTONE_OUTLINE;
    const structures = polygonWard(pts, 18, 6, () => ({ r: 5, h: 25, round: true, roof: "none" }), { r: 7, h: 27, w: 11 });
    structures.push(...DRAGONSTONE_STRUCTURES);
    return { recipe: "dragonstone", palette: DRAGONSTONE_PALETTE, structures, switchMetres: 88, outline: pts };
  }
  if (kind == "storms-end") {
    // One Great Drum, enclosed by a massive curtain: no separate wall towers.
    const pts = circle(24, 66, -20);
    const structures = polygonWard(pts, 30, 18, () => ({ r: 7, h: 34, round: true, roof: "none" }), { r: 7, h: 31, w: 10 })
      .filter(s => s.type != "tower");
    structures.push({ type: "drum", x: 0, z: -26, r: 30, h: 72, roof: "none" });
    return { recipe: "storms-end", palette: STORMS_END_PALETTE, structures, switchMetres: 72, outline: ringOutline(76, -20) };
  }
  if (kind == "highgarden") {
    // Concentric rings of white walls on the hill; many slender green-capped towers.
    const structures: Structure[] = [];
    [[108, 10, 4], [84, 13, 4.5], [60, 16, 5]].forEach(([r, h, t], ring) => {
      const pts = circle(12, r, -30, ring * 0.26);
      structures.push(...polygonWard(pts, h, t, i => ({ r: 4 + ring, h: h + 10 + ring * 4, round: true, roof: i % 2 ? "cone" : "none" }), { r: 5 + ring, h: h + 8, w: 9 })
        .filter((s, i) => s.type != "tower" || i % 3 == 1));
    });
    structures.push({ type: "keep", x: 0, z: -38, w: 26, d: 24, h: 34, roof: "cone", turrets: true });
    [[-22, -60], [24, -58], [-30, -18], [30, -20]].forEach(([x, z], i) => structures.push({ type: "tower", x, z, r: 4.5, h: 40 + i * 3, round: true, roof: "cone" }));
    return { recipe: "highgarden", structures, switchMetres: 46, outline: ringOutline(112, -30) };
  }
  if (kind == "sunspear") {
    // Old Palace: the Tower of the Sun (gilded dome), the Spear Tower and the Sandship.
    const structures = ward(78, -70, 46, 12, 4, { r: 5.5, h: 18, round: false, roof: "none" }, { r: 5, h: 16, w: 9 }, 1);
    structures.push(
      { type: "drum", x: -26, z: -40, r: 20, h: 32, roof: "dome" },
      { type: "tower", x: 40, z: -46, r: 5, h: 68, round: true, roof: "cone" },
      { type: "hall", x: 18, z: -14, w: 46, d: 18, h: 14, angle: 0.2 }
    );
    return { recipe: "sunspear", structures, switchMetres: 78, outline: rectOutline(78, -70, 46) };
  }
  if (kind == "moat-cailin") {
    // Three surviving towers in the bog; the curtain is reduced to stumps.
    const pts: Vec2[] = [[-60, -40], [0, 55], [62, -36]];
    const structures: Structure[] = [];
    pts.forEach((a, i) => {
      structures.push({ type: "curtain", a, b: pts[(i + 1) % 3], h: 5, t: 6, ruined: true });
      structures.push({ type: "tower", x: a[0], z: a[1], r: 9 - i, h: [30, 22, 26][i], round: true, roof: "none", ruin: "broken" });
    });
    return { recipe: "moat-cailin", structures, switchMetres: 30, outline: pts.concat(ringOutline(55)) };
  }
  if (kind == "oldtown") {
    // The Citadel's walled courts; the the lighthouse is a separate hero on the shore.
    const structures = ward(80, -66, 52, 13, 4, { r: 6, h: 21, round: true, roof: "cone" }, { r: 5.5, h: 19, w: 9 }, 1);
    structures.push(
      { type: "keep", x: -24, z: -42, w: 26, d: 20, h: 32, roof: "cone", turrets: false },
      { type: "hall", x: 26, z: -40, w: 40, d: 14, h: 14, angle: 0 },
      { type: "hall", x: 34, z: 10, w: 30, d: 12, h: 11, angle: Math.PI / 2 },
      { type: "drum", x: -40, z: 6, r: 10, h: 16, roof: "dome" }
    );
    return { recipe: "citadel", structures, switchMetres: 40, outline: rectOutline(80, -66, 52), hero: "hightower" };
  }
  if (kind == "starfall") {
    // Original Palestone Sword silhouette: one tall pale square tower above
    // the lower riverside courts. Torrentine/island geography stays atlas-owned.
    const structures = ward(70, -62, 48, 12, 4, { r: 6, h: 20, round: false, roof: "none" }, { r: 5, h: 18, w: 9 }, 1);
    structures.push(
      { type: "tower", x: 36, z: -40, r: 8, h: 62, round: false, roof: "none" },
      { type: "keep", x: -24, z: -38, w: 30, d: 22, h: 27, roof: "none", turrets: false },
      { type: "hall", x: -32, z: 8, w: 34, d: 12, h: 10, angle: Math.PI / 2 },
      { type: "hall", x: 42, z: 14, w: 24, d: 10, h: 9, angle: 0 }
    );
    return { recipe: "palestone-sword", structures, switchMetres: 62, outline: rectOutline(70, -62, 48) };
  }
  if (kind == "yronwood") {
    // Low, broad sandstone gate fortress: square bastions and a massive keep,
    // distinct from the desert seat's slender spear and domed palace.
    const structures = ward(94, -82, 64, 19, 7, { r: 10, h: 29, round: false, roof: "none" }, { r: 8, h: 27, w: 14 }, 1);
    structures.push(
      { type: "keep", x: -24, z: -44, w: 42, d: 34, h: 40, roof: "none", turrets: true },
      { type: "tower", x: 54, z: -52, r: 9, h: 34, round: false, roof: "none" },
      { type: "hall", x: 40, z: -12, w: 38, d: 16, h: 13, angle: 0 },
      { type: "hall", x: -62, z: 18, w: 34, d: 12, h: 9, angle: Math.PI / 2 }
    );
    return { recipe: "yronwood-gate", structures, switchMetres: 44, outline: rectOutline(94, -82, 64) };
  }
  const strong = level > 1 || kind == "dragonstone" || kind == "stronghold";
  const capital = ["dragonstone", "the-vale-of-arryn", "pentos", "volantis", "seagard", "white-harbor", "yronwood", "starfall"].includes(kind);
  const round = site.palette?.round ?? rule.round;
  if (!strong) {
    const w = 52, back = -48, front = 40;
    const structures = ward(w, back, front, 11, 3.2, { r: 5.5, h: jitter(17), round, roof }, { r: 4.5, h: 15, w: 8 });
    structures.push(
      { type: "keep", x: -10, z: -34, w: 18, d: 16, h: jitter(30), roof: rule.keepRoof, turrets: false },
      { type: "hall", x: 22, z: -36, w: 24, d: 10, h: 9, angle: 0 },
      { type: "hall", x: 40, z: 6, w: 16, d: 7, h: 5, angle: Math.PI / 2 }
    );
    return { recipe: "castle", structures, switchMetres: 30, outline: rectOutline(w, back, front) };
  }
  const grow = capital ? 1.12 : 1;
  const w = 82 * grow, back = -74 * grow, front = 58 * grow;
  const structures = ward(w, back, front, 14, 4, { r: 7, h: jitter(23), round, roof }, { r: 6, h: 21, w: 10 }, 1);
  structures.push(
    { type: "keep", x: -22, z: back + 22, w: 26, d: 22, h: jitter(kind == "dragonstone" ? 46 : 42), roof: rule.keepRoof, turrets: true },
    { type: "tower", x: 46, z: back + 18, r: 6.5, h: jitter(34), round: true, roof: roof == "none" ? "none" : roof },
    { type: "hall", x: 16, z: back + 34, w: 36, d: 14, h: 12, angle: 0 },
    { type: "hall", x: -58, z: 4, w: 30, d: 10, h: 7, angle: Math.PI / 2 },
    { type: "hall", x: 56, z: 18, w: 22, d: 9, h: 6, angle: Math.PI / 2 }
  );
  return { recipe: capital ? "seat" : "stronghold", structures, switchMetres: 42, outline: rectOutline(w, back, front) };
}

function scaleStructure(s: Structure, f: number, v: number, [ox, oz]: Vec2): Structure {
  const p = (x: number, z: number): Vec2 => [x * f + ox, z * f + oz];
  switch (s.type) {
    case "curtain": return { ...s, a: p(...s.a), b: p(...s.b), h: s.h * v, t: s.t * Math.max(0.8, f) };
    case "tower": { const [x, z] = p(s.x, s.z); return { ...s, x, z, r: s.r * Math.max(0.8, f), h: s.h * v }; }
    case "gatehouse": { const [x, z] = p(s.x, s.z); return { ...s, x, z, r: s.r * Math.max(0.8, f), w: s.w * Math.max(0.8, f), h: s.h * v }; }
    case "keep": { const [x, z] = p(s.x, s.z); return { ...s, x, z, w: s.w * Math.max(0.8, f), d: s.d * Math.max(0.8, f), h: s.h * v }; }
    case "hall": { const [x, z] = p(s.x, s.z); return { ...s, x, z, w: s.w * f, d: s.d * f, h: s.h * v }; }
    case "drum": { const [x, z] = p(s.x, s.z); return { ...s, x, z, r: s.r * Math.max(0.8, f), h: s.h * v }; }
  }
}

/** Ground samples of a structure (local metres). */
export function footprintSamples(s: Structure): Vec2[] {
  const ring = (x: number, z: number, r: number): Vec2[] => [[x, z], [x + r, z], [x - r, z], [x, z + r], [x, z - r]];
  switch (s.type) {
    case "curtain": {
      const n = Math.max(1, Math.ceil(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) / 6));
      return Array.from({ length: n + 1 }, (_, i) => [s.a[0] + (s.b[0] - s.a[0]) * i / n, s.a[1] + (s.b[1] - s.a[1]) * i / n] as Vec2);
    }
    case "tower": case "drum": return ring(s.x, s.z, s.r);
    case "gatehouse": return ring(s.x, s.z, s.w / 2 + s.r);
    case "keep": case "hall": {
      const c = Math.cos(s.type == "hall" ? s.angle : 0), n = Math.sin(s.type == "hall" ? s.angle : 0);
      const out: Vec2[] = [[s.x, s.z]];
      [-1, 1].forEach(i => [-1, 1].forEach(j => out.push([s.x + c * i * s.w / 2 + n * j * s.d / 2, s.z - n * i * s.w / 2 + c * j * s.d / 2])));
      return out;
    }
  }
}

/** Curtains longer than this are split so every module follows the ground. */
export const CURTAIN_MODULE_METRES = 12;

function seat(s: Structure, ground: (x: number, z: number) => number): Seated[] {
  if (s.type == "curtain") {
    const length = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const n = Math.max(1, Math.ceil(length / CURTAIN_MODULE_METRES));
    return Array.from({ length: n }, (_, i) => {
      const a: Vec2 = [s.a[0] + (s.b[0] - s.a[0]) * i / n, s.a[1] + (s.b[1] - s.a[1]) * i / n];
      const b: Vec2 = [s.a[0] + (s.b[0] - s.a[0]) * (i + 1) / n, s.a[1] + (s.b[1] - s.a[1]) * (i + 1) / n];
      const heights = [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Vec2].map(([x, z]) => ground(x, z));
      const low = Math.min(...heights), high = Math.max(...heights);
      // Ruined stretches fall away in a deterministic rhythm.
      const h = s.ruined ? s.h * (0.35 + 0.65 * Math.abs(Math.sin(i * 2.3 + a[0] * 0.07))) : s.h;
      return { ...s, a, b, h, base: low - 3 - (high - low) * 0.2, ground: high, top: high + h };
    });
  }
  const heights = footprintSamples(s).map(([x, z]) => ground(x, z));
  const low = Math.min(...heights), high = Math.max(...heights);
  const crown = s.type == "tower" || s.type == "drum" ? s.h + (s.roof == "cone" ? s.r * 2.2 : s.roof == "dome" ? s.r : 1.6)
    : s.type == "keep" ? s.h + (s.roof == "none" ? 2 : Math.max(s.w, s.d) * 0.45) : s.type == "hall" ? s.h + s.d * 0.42 : s.h + 2;
  return [{ ...s, base: low - 3 - (high - low) * 0.25, ground: high, top: high + crown }];
}

function volumeOf(s: Seated): Volume {
  const pad = 1.5;
  switch (s.type) {
    case "curtain": return { minX: Math.min(s.a[0], s.b[0]) - s.t / 2 - pad, maxX: Math.max(s.a[0], s.b[0]) + s.t / 2 + pad,
      minZ: Math.min(s.a[1], s.b[1]) - s.t / 2 - pad, maxZ: Math.max(s.a[1], s.b[1]) + s.t / 2 + pad, top: s.top + 1.5 };
    case "tower": case "drum": return { minX: s.x - s.r - pad, maxX: s.x + s.r + pad, minZ: s.z - s.r - pad, maxZ: s.z + s.r + pad, top: s.top };
    case "gatehouse": { const e = s.w / 2 + s.r * 2 + pad; return { minX: s.x - e, maxX: s.x + e, minZ: s.z - e, maxZ: s.z + e, top: s.top }; }
    case "keep": return { minX: s.x - s.w / 2 - pad, maxX: s.x + s.w / 2 + pad, minZ: s.z - s.d / 2 - pad, maxZ: s.z + s.d / 2 + pad, top: s.top };
    case "hall": {
      const c = Math.abs(Math.cos(s.angle)), n = Math.abs(Math.sin(s.angle));
      const ex = (c * s.w + n * s.d) / 2 + pad, ez = (n * s.w + c * s.d) / 2 + pad;
      return { minX: s.x - ex, maxX: s.x + ex, minZ: s.z - ez, maxZ: s.z + ez, top: s.top };
    }
  }
}

/**
 * Authored reach of a seat's complex around its anchor (metres, fit 1, +10 %),
 * for neighbours that must keep clear of it (cities, settlements). Lifted
 * complexes (the highland palace's palace, the headland's summit) leave the anchor's ground
 * to the miniature and report nothing.
 */
export function complexReach(kind: string, level: number, style: CastleStyle): ComplexPlan["extents"] | undefined {
  if (kind == "pyke") return undefined; // Shoreline fit publishes its live extents.
  const key = `${kind}:${level}:${style}`;
  if (reaches.has(key)) return reaches.get(key);
  const base = NO_COMPLEX.has(kind) ? undefined : draft({ id: kind, kind, level, style }, STYLE_RULES[style], () => 0.5);
  let reach: ComplexPlan["extents"] | undefined;
  if (base && base.hero != "needles" && base.hero != "rock") {
    const outline = kind == "kings-landing" ? base.outline.concat(circle(32, 180, -40)) : base.outline;
    const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
    reach = { minX: Math.min(...xs) * 1.1, maxX: Math.max(...xs) * 1.1, minZ: Math.min(...zs) * 1.1, maxZ: Math.max(...zs) * 1.1 };
  }
  reaches.set(key, reach);
  return reach;
}

const reaches = new Map<string, ComplexPlan["extents"] | undefined>();

/** Search for the hero's own seat (shore for the the lighthouse, coast for the headland). */
function placeHero(kind: "hightower" | "needles" | "rock", site: ComplexSite, extents: ComplexPlan["extents"], ground: ComplexGround, rand: () => number): HeroPlan | undefined {
  const own = (x: number, z: number): boolean => !ground.own || ground.own(x, z);
  // Prefer the side facing the seat's own harbour (public slots), when known.
  const facing = (x: number, z: number): number => {
    if (!site.seaward) return 0;
    const length = Math.hypot(x, z) || 1;
    return 1 - (x * site.seaward[0] + z * site.seaward[1]) / length;
  };
  if (kind == "needles") {
    // Behind the anchor (−z), so the board miniature stands at the needle's foot.
    const spires = [[0, -120, 56, 430], [-96, -70, 34, 300], [90, -176, 30, 250], [-40, -230, 24, 210]].map(([x, z, r, height], i) => {
      const samples = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => ground.height(x + dx, z + dz));
      return { x, z, r, base: Math.min(...samples) - 10, ground: Math.max(...samples), height, seed: i + 1 };
    });
    return { kind: "needles", spires };
  }
  if (kind == "rock") {
    const headland = placeRock(extents, ground, rand);
    if (headland) return headland;
  }
  let best: { score: number; x: number; z: number; yaw: number; f: number; seaward: number } | undefined;
  const radius = kind == "hightower" ? 34 : 1;
  for (const f of kind == "rock" ? [1, 0.8, 0.62] : [1]) {
    const rx = 360 * f, rz = 200 * f;
    for (let ring = kind == "hightower" ? 260 : 120; ring <= (kind == "hightower" ? 1100 : 900); ring += 60) {
      for (let k = 0; k < 24; k++) {
        const a = k * Math.PI / 12;
        const x = Math.sin(a) * ring, z = Math.cos(a) * ring;
        // The hero never covers the castle's own ward.
        const clear = kind == "hightower" ? 40 : Math.max(rx, rz);
        if (x > extents.minX - clear && x < extents.maxX + clear && z > extents.minZ - clear && z < extents.maxZ + clear) continue;
        if (kind == "hightower") {
          const disc = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]];
          if (disc.some(([dx, dz]) => ground.wet(x + dx, z + dz)) || !own(x, z) || ground.reserved(x, z, 120)) continue;
          // Nearest open water: the the lighthouse stands on the shore of the river mouth.
          let shore = Infinity;
          for (let d = 40; d <= 360 && shore == Infinity; d += 40) {
            for (let j = 0; j < 12; j++) if (ground.wet(x + Math.sin(j * Math.PI / 6) * d, z + Math.cos(j * Math.PI / 6) * d)) { shore = d; break; }
          }
          if (shore == Infinity) continue;
          const score = shore * 2 + ring * 0.3 + facing(x, z) * 300;
          if (!best || score < best.score) best = { score, x, z, yaw: 0, f, seaward: 0 };
        } else {
          for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75]) {
            const c = Math.cos(yaw), s = Math.sin(yaw);
            let dry = 0, wet = 0, blocked = false, sx = 0, sz = 0;
            for (let i = -2; i <= 2 && !blocked; i++) for (let j = -2; j <= 2; j++) {
              if (i * i / 4 + j * j / 4 > 1.05) continue;
              const lx = i / 2 * rx, lz = j / 2 * rz;
              const px = x + c * lx + s * lz, pz = z - s * lx + c * lz;
              if (ground.reserved(px, pz, 140)) { blocked = true; break; }
              if (ground.wet(px, pz)) { wet++; sx += px - x; sz += pz - z; } else if (own(px, pz)) dry++; else { blocked = true; break; }
            }
            // A mole on the coast: mostly land, its seaward face in the water.
            if (blocked || dry < 8 || wet < 3) continue;
            const score = ring + wet * 15 + (1 - f) * 2000 + facing(x, z) * 500;
            if (!best || score < best.score) best = { score, x, z, yaw, f, seaward: Math.atan2(sx, sz) };
          }
        }
      }
    }
    if (best) break;
  }
  if (!best) return undefined;
  const { x, z, f, seaward } = best;
  const h = ground.height(x, z);
  if (kind == "hightower") {
    const rim = [[radius, 0], [-radius, 0], [0, radius], [0, -radius]].map(([dx, dz]) => ground.height(x + dx, z + dz));
    return { kind: "hightower", x, z, base: Math.min(h, ...rim) - 8, ground: Math.max(h, ...rim), height: 240 };
  }
  // The geometry's local +x points out to sea.
  return { kind: "rock", x, z, yaw: -Math.atan2(Math.cos(seaward), Math.sin(seaward)), rx: 360 * f, rz: 200 * f, base: h - 30, height: Math.max(0, h) + 300 * Math.sqrt(f),
    seed: Math.floor(rand() * 1000), seaward, sea: Math.min(0, h) };
}

/**
 * How far the headland's strata step in at height fraction t (fraction of the
 * footprint radius): a broad shoulder to ~55 % of the height, then the upper
 * beds draw in toward a summit of ~350 × 190 m (fortress, galleries, curtain).
 */
export function rockShrink(t: number): number {
  const s = Math.min(1, Math.max(0, (t - 0.55) / 0.45));
  return 0.1 * t + 0.45 * s * s * (3 - 2 * s);
}

/** The Rock's strata drift seaward as they rise (sheer to the sea, stepped toward the land): local offset along +x at t. */
export function rockDrift(rx: number, t: number): number {
  return rx * rockShrink(t) * 0.85;
}

/** Centre of the headland's summit (local metres around the castle anchor), where its fortress stands. */
export function rockSummit(hero: Extract<HeroPlan, { kind: "rock" }>): Vec2 {
  const u = rockDrift(hero.rx, 1);
  return [hero.x + u * Math.cos(hero.yaw), hero.z - u * Math.sin(hero.yaw)];
}

/** Bearing (local x east, z south) of the golden headland from the port city's castle: west-north-west. */
const ROCK_BEARING = Math.PI * 9 / 8;

/**
 * the golden headland, hand-placed (director's decision): the headland immediately
 * west / north-west of the port city's castle, its long axis running out to sea
 * from a short standoff, so the castle and the city stand at its foot. It may
 * stand in the sea (sheer sea cliffs) but never on another land region, a
 * gameplay slot, a harbour or another castle. Candidates are tried in a fixed
 * order (bearing nearest WNW, shortest standoff, largest size): deterministic.
 */
function placeRock(extents: ComplexPlan["extents"], ground: ComplexGround, rand: () => number): HeroPlan | undefined {
  const own = (x: number, z: number): boolean => !ground.own || ground.own(x, z);
  const seed = Math.floor(rand() * 1000);
  let best: { score: number; x: number; z: number; f: number; bearing: number } | undefined;
  for (const f of [1, 0.85, 0.7]) {
    const rx = 400 * f, rz = 240 * f;
    for (let step = -4; step <= 4; step++) {
      const bearing = ROCK_BEARING + step * Math.PI / 24;
      const dx = Math.cos(bearing), dz = Math.sin(bearing);
      for (const gap of [60, 100, 150, 220, 300]) {
        const score = Math.abs(step) * 120 + gap + (1 - f) * 1800;
        if (best && score >= best.score) continue;
        const x = dx * (gap + rx), z = dz * (gap + rx);
        // The castle's own ward stays clear of the headland.
        const near = Math.hypot(extents.maxX - extents.minX, extents.maxZ - extents.minZ) / 2;
        if (Math.hypot(x, z) - rx < Math.min(near, 60)) continue;
        let blocked = false;
        for (let i = -3; i <= 3 && !blocked; i++) for (let j = -3; j <= 3 && !blocked; j++) {
          if (i * i / 9 + j * j / 9 > 1.05) continue;
          const lu = i / 3 * rx, lv = j / 3 * rz;
          const px = x + lu * dx - lv * dz, pz = z + lu * dz + lv * dx;
          if (ground.reserved(px, pz, 110)) blocked = true;
          else if (!ground.wet(px, pz) && !own(px, pz)) blocked = true;
        }
        if (!blocked) best = { score, x, z, f, bearing };
      }
    }
  }
  if (!best) return undefined;
  const { x, z, f, bearing } = best;
  const rx = 400 * f, rz = 240 * f, dx = Math.cos(bearing), dz = Math.sin(bearing);
  // Seabed under the footprint (the headland's base) and the sea level (wet samples are below it).
  let low = Infinity, sea = -Infinity;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    if (i * i / 16 + j * j / 16 > 1.1) continue;
    const lu = i / 4 * rx, lv = j / 4 * rz, px = x + lu * dx - lv * dz, pz = z + lu * dz + lv * dx;
    const h = ground.height(px, pz);
    low = Math.min(low, h);
    if (ground.wet(px, pz)) sea = Math.max(sea, h);
  }
  sea = Number.isFinite(sea) ? Math.min(0, sea + 0.8) : Math.min(0, low);
  // Local +x of the headland points out to sea along the bearing: yaw = −bearing.
  return { kind: "rock", x, z, yaw: -bearing, rx, rz, base: low - 25, height: sea + 360 * Math.sqrt(f), seed, seaward: Math.atan2(dx, dz), sea };
}

/** Hero volumes, stacked so a camera beside a tapering spire is not lifted over its base. */
export function heroVolumes(hero: HeroPlan): Volume[] {
  const box = (x: number, z: number, r: number, top: number): Volume => ({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, top });
  if (hero.kind == "hightower") {
    return [[40, 0.18], [30, 0.45], [24, 0.65], [18, 0.85], [11, 1]].map(([r, t]) => box(hero.x, hero.z, r, hero.ground + hero.height * t));
  }
  if (hero.kind == "needles") {
    return hero.spires.flatMap(spire => [[1, 0.35], [0.75, 0.7], [0.5, 1]].map(([r, t]) => box(spire.x, spire.z, spire.r * r, spire.ground + spire.height * t)));
  }
  // The Rock's footprint (rotated ellipse) bounds, stacked as its strata step in.
  const c = Math.cos(hero.yaw), s = Math.sin(hero.yaw);
  const hx = Math.hypot(hero.rx * c, hero.rz * s), hz = Math.hypot(hero.rx * s, hero.rz * c);
  const at = (t: number): number => hero.sea + (hero.height - hero.sea) * t;
  // Each box spans the strata below its top; it follows their seaward drift.
  return [[0.3, 0.2], [0.6, 0.5], [1, 0.85]].map(([t, low]) => {
    const k = 1 - rockShrink(t) * 0.9, u = rockDrift(hero.rx, low), x = hero.x + u * c, z = hero.z - u * s;
    return { minX: x - hx * k, maxX: x + hx * k, minZ: z - hz * k, maxZ: z + hz * k, top: at(t) };
  });
}

/** Ground relief (m) a complex accepts across its outline and buildings before a flatter fit is preferred. */
const RELIEF_METRES = 40;

/** Plan a physical complex for one castle seat, or undefined when none fits. */
export function planComplex(site: ComplexSite, ground: ComplexGround): ComplexPlan | undefined {
  if (NO_COMPLEX.has(site.kind)) return undefined;
  if (site.kind == "pyke") {
    // Search public shoreline in stable angular/radial order. Never infer a seat
    // from ships, ownership or armies; stacks may straddle the sea by design.
    let centre: Vec2 = [0, -90], found = false;
    const bearing = Math.atan2(site.seaward?.[1] ?? 0, site.seaward?.[0] ?? -1);
    for (let r = 80; r <= 1600 && !found; r += 40) for (let i = 0; i < 24; i++) {
      const a = bearing + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!ground.wet(x, z) && (!ground.own || ground.own(x, z)) && !ground.reserved(x, z, 90) && ground.wet(x + Math.cos(a) * 45, z + Math.sin(a) * 45)) {
        centre = [x, z]; found = true; break;
      }
    }
    if (!found || ground.reserved(centre[0], centre[1], 90)) return undefined;
    const lift = ground.height(...centre) - 8;
    const extents = { minX: centre[0] - 135, maxX: centre[0] + 135, minZ: centre[1] - 60, maxZ: centre[1] + 60 };
    const volumes = [[-8, 0, 54, 52, 125], [101, -17, 30, 28, 130], [-105, 5, 33, 30, 80]].map(([x, z, rx, rz, top]) =>
      ({ minX: centre[0] + x - rx, maxX: centre[0] + x + rx, minZ: centre[1] + z - rz, maxZ: centre[1] + z + rz, top: lift + top }));
    return { id: site.id, recipe: "pyke-stacks", style: "islands", palette: site.palette, fit: 1, offset: centre, lift,
      structures: [], extents, switchMetres: 130, banner: [centre[0], lift + 134, centre[1]], torches: [], volumes, heroVolumes: [], props: [] };
  }

  const rule = STYLE_RULES[site.style];
  const rand = random(`${site.id}:${site.kind}:${site.level}`);
  const base = draft(site, rule, rand);
  if (!base) return undefined;
  const lifted = base.hero == "needles" || base.hero == "rock";
  const offsets: Vec2[] = [[0, 0], [0, 0.25], [0.25, 0], [-0.25, 0], [0, -0.25], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25],
    [0, 0.38], [0.38, 0], [-0.38, 0], [0, -0.38]];
  if (site.kind == "sunspear") {
    // The atlas anchor is on the beach. Seat the Old Palace inland, keeping
    // coastal water and gameplay reservations authoritative.
    const [sx, sz] = site.seaward ?? [1, 0];
    for (const reach of [1, 2, 3, 4]) for (const side of [0, -0.6, 0.6]) offsets.push([-sx * reach + sz * side, -sz * reach - sx * side]);
  }
  const span = (outline: Vec2[]): number => Math.max(...outline.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))));
  // Strict pass first; then a shore pass (the ruined fortress on the God's Eye, river
  // castles): curtains and some towers may stand in the shallows, keeps never.
  // On rugged ×20 ground the first fit that stays dry may straddle a ridge:
  // pass 0 takes the first candidate within RELIEF_METRES of relief, and
  // remembers the flattest valid one; pass 1 builds that one if none qualified.
  let fallback: { relief: number; key: string } | undefined;
  for (const pass of lifted ? [0] : [0, 1]) for (const shore of lifted ? [false] : [false, true]) for (const fit of lifted ? [1] : [1, 0.86, 0.74, 0.62, 0.52]) {
    if (pass == 1 && !fallback) break;
    const vertical = 0.55 + 0.45 * fit;
    for (const [dx, dz] of lifted ? [[0, 0] as Vec2] : offsets) {
      const offset: Vec2 = [dx * span(base.outline) * fit, dz * span(base.outline) * fit];
      // The anchor (the miniature's foot and the banner yard) stays inside the ward.
      if (site.kind != "sunspear" && Math.hypot(...offset) > span(base.outline) * fit * 0.45) continue;
      const outline = base.outline.map(([x, z]) => [x * fit + offset[0], z * fit + offset[1]] as Vec2);
      const structures = base.structures.map(s => scaleStructure(s, fit, vertical, offset));
      if (!lifted) {
        const wet = outline.filter(([x, z]) => ground.wet(x, z)).length;
        // Curtains may run along a shore or a moat; towers, keeps and halls stand on dry ground.
        if (wet > outline.length * (shore ? 0.4 : 0.2)) continue;
        const solid = structures.filter(s => s.type != "curtain");
        const flooded = solid.filter(s => ground.wet(...footprintSamples(s)[0]));
        if (shore ? flooded.length > solid.length * 0.3 || flooded.some(s => s.type == "keep" || s.type == "drum" || s.type == "hall") : flooded.length) continue;
        if (outline.some(([x, z]) => ground.reserved(x, z, 30))) continue;
        const key = `${shore}:${fit}:${dx}:${dz}`;
        if (pass == 1 && key != fallback?.key) continue;
        if (pass == 0) {
          // Outline, every building and the ends and middle of every curtain.
          const curtainPoints = structures.flatMap(s => s.type == "curtain" ? [s.a, s.b, [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2] as Vec2] : []);
          const heights = outline.concat(solid.map(s => footprintSamples(s)[0]), curtainPoints).map(([x, z]) => ground.height(x, z));
          const relief = Math.max(...heights) - Math.min(...heights);
          if (relief > RELIEF_METRES) { if (!fallback || relief < fallback.relief) fallback = { relief, key }; continue; }
        }
      }
      const extents = outline.reduce((e, [x, z]) => ({ minX: Math.min(e.minX, x), maxX: Math.max(e.maxX, x), minZ: Math.min(e.minZ, z), maxZ: Math.max(e.maxZ, z) }),
        { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
      const hero = base.hero ? placeHero(base.hero, site, extents, ground, rand) : undefined;
      if (base.hero && base.hero != "hightower" && !hero) return undefined;
      let lift = 0, shift: Vec2 = [0, 0];
      let seatGround = (x: number, z: number): number => ground.height(x, z);
      if (hero?.kind == "needles") {
        const main = hero.spires[0];
        lift = main.ground + main.height;
        shift = [main.x, main.z];
        seatGround = () => 0;
      } else if (hero?.kind == "rock") {
        lift = hero.height;
        shift = rockSummit(hero);
        seatGround = () => 0;
      }
      let plateau: ComplexPlan["plateau"];
      if (base.recipe == "red-keep") {
        const centre: Vec2 = [offset[0], offset[1] - 40 * fit];
        const rim = circle(32, 180 * fit, 0).map(([x, z], i) => {
          const weathered = 1 + 0.035 * Math.sin(i * 1.7);
          x *= weathered; z *= weathered;
          const px = x + centre[0], pz = z + centre[1];
          return [px, ground.height(px, pz) - 3, pz] as Vec3;
        });
        if (rim.some(([x, , z]) => ground.wet(x, z) || ground.reserved(x, z, 12))) continue;
        const top = Math.max(...outline.map(([x, z]) => ground.height(x, z)), ...rim.map(p => p[1] + 3)) + 12;
        plateau = { top, rim, centre };
        rim.forEach(([x, , z]) => {
          extents.minX = Math.min(extents.minX, x); extents.maxX = Math.max(extents.maxX, x);
          extents.minZ = Math.min(extents.minZ, z); extents.maxZ = Math.max(extents.maxZ, z);
        });
        seatGround = () => top;
      }
      const moved = shift[0] || shift[1] ? structures.map(s => scaleStructure(s, 1, 1, shift)) : structures;
      const seated = moved.flatMap(s => seat(s, (x, z) => seatGround(x - shift[0], z - shift[1])));
      const keep = seated.filter(s => s.type == "keep" || s.type == "drum").sort((a, b) => b.top - a.top)[0] ?? seated.find(s => s.type == "tower");
      // Keep the public banner clear of the Stone Drum carving.
      const flagSeat = base.recipe == "dragonstone" ? seated.filter(s => s.type == "tower").sort((a, b) => b.top - a.top)[0] ?? keep : keep;
      const banner: Vec3 = flagSeat ? [flagSeat.type == "keep" || flagSeat.type == "drum" || flagSeat.type == "tower" ? flagSeat.x : 0, lift + flagSeat.top + 0.5,
        flagSeat.type == "keep" || flagSeat.type == "drum" || flagSeat.type == "tower" ? flagSeat.z : 0] : [0, lift + 20, 0];
      const gate = seated.find(s => s.type == "gatehouse");
      const torches: Vec3[] = gate && gate.type == "gatehouse" ? [-1, 1].map(side => {
        const c = Math.cos(gate.angle), n = Math.sin(gate.angle);
        const lx = side * (gate.w / 2 + 0.8), lz = gate.r + 1.2;
        return [gate.x + c * lx + n * lz, lift + gate.ground + 5.5, gate.z - n * lx + c * lz] as Vec3;
      }) : [];
      const chimney: Vec3 | undefined = keep && keep.type == "keep" ? [keep.x - keep.w * 0.3, lift + keep.top + 2, keep.z - keep.d * 0.2] : undefined;
      const volumes = seated.map(volumeOf).map(v => ({ ...v, top: v.top + lift }));
      if (base.recipe == "dragonstone") volumes.push(...dragonstoneCarvingVolumes(seated, fit));
      if (plateau) volumes.push({ minX: plateau.centre[0] - 125 * fit, maxX: plateau.centre[0] + 125 * fit,
        minZ: plateau.centre[1] - 125 * fit, maxZ: plateau.centre[1] + 125 * fit, top: plateau.top });
      const finalExtents = shift[0] || shift[1]
        ? { minX: extents.minX + shift[0], maxX: extents.maxX + shift[0], minZ: extents.minZ + shift[1], maxZ: extents.maxZ + shift[1] }
        : extents;
      return {
        id: site.id, recipe: base.recipe, style: site.style,
        palette: base.palette ?? (site.kind == "highgarden" ? { ...site.palette, stone: "#e5e4d6", trim: "#f3eddb", roof: "#53775b" }
          : site.kind == "white-harbor" ? { ...site.palette, stone: "#e2ecff", trim: "#f2f7ff", roof: "#b5dafa" } : site.palette), fit, offset, lift,
        structures: seated, plateau, extents: finalExtents, switchMetres: base.switchMetres * vertical, banner, chimney, torches,
        volumes, heroVolumes: hero ? heroVolumes(hero) : [], hero,
        props: lifted ? [] : dressWard(base.recipe, site.level, site.style, outline, seated, plateau ? { ...ground, height: seatGround } : ground, rand)
      };
    }
  }
  return undefined;
}

/** Seats with a preset sacred grove: trees, and whether a pale heart tree (or three, the garden seat) stands in it. */
const GODSWOODS: Record<string, { trees: number; hearts: number }> = {
  winterfell: { trees: 16, hearts: 1 }, riverrun: { trees: 7, hearts: 1 }, harrenhal: { trees: 9, hearts: 1 },
  "red-keep": { trees: 6, hearts: 0 }, highgarden: { trees: 6, hearts: 3 }
};

/**
 * Modest ward dressing inside the curtains: a well, a stable along a curtain
 * with a woodpile, two carts by the gate, a training yard in strongholds and
 * seats, and the godswood where canon. Props keep off every structure, the
 * curtains' inner walk, the anchor's yard (banner, resource ornaments, the
 * miniature's footprint) and water. Deterministic (the plan's own random).
 */
function dressWard(recipe: string, level: number, style: CastleStyle, outline: Vec2[], seated: Seated[], ground: ComplexGround, rand: () => number): Prop[] {
  const hull = convexHull(outline);
  if (hull.length < 3) return [];
  const volumes = seated.map(volumeOf);
  const curtains = seated.filter((s): s is Extract<Seated, { type: "curtain" }> => s.type == "curtain");
  const edge = (x: number, z: number): number => hull.reduce((best, a, i) => {
    const b = hull[(i + 1) % hull.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz) || 1;
    // Signed distance inside the counter-clockwise hull.
    return Math.min(best, ((x - a[0]) * -dz + (z - a[1]) * dx) / length * Math.sign(hullArea(hull)));
  }, Infinity);
  const taken: { x: number; z: number; r: number }[] = [];
  const free = (x: number, z: number, r: number): boolean => edge(x, z) > r + 6 && Math.hypot(x, z) > r + 26 &&
    !volumes.some(v => x + r > v.minX - 2 && x - r < v.maxX + 2 && z + r > v.minZ - 2 && z - r < v.maxZ + 2) &&
    !taken.some(t => Math.hypot(x - t.x, z - t.z) < r + t.r + 2) && !ground.wet(x, z);
  const xs = hull.map(p => p[0]), zs = hull.map(p => p[1]);
  const x0 = Math.min(...xs), z0 = Math.min(...zs), nz = Math.floor((Math.max(...zs) - z0) / 5) + 1;
  const grid: Vec2[] = [];
  for (let x = x0; x <= Math.max(...xs); x += 5) for (let z = z0; z <= Math.max(...zs); z += 5) grid.push([x, z]);
  // Open 5 m cells (before any prop is placed): the godswood looks for a roomy corner among them.
  const open = grid.map(([x, z]) => free(x, z, 2));
  const props: Prop[] = [];
  const put = (type: Prop["type"], x: number, z: number, r: number, angle: number, size: number): void => {
    taken.push({ x, z, r });
    props.push({ type, x, z, angle, ground: ground.height(x, z), size });
  };
  const pick = (r: number, score: (x: number, z: number) => number): Vec2 | undefined => grid.filter(([x, z]) => free(x, z, r)).sort((p, q) => score(...p) - score(...q))[0];
  // Godswood first (it needs the most room): the free corner farthest from the gate yard.
  const wood = GODSWOODS[recipe];
  if (wood) {
    const room = (i: number): number => {
      let count = 0;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const j = i + dx * nz + dz; if (dx * dx + dz * dz <= 10 && open[j]) count++; }
      return count;
    };
    const centre = grid.map((p, i) => ({ p, i })).filter(({ p, i }) => open[i] && free(p[0], p[1], 14))
      .sort((a, b) => (-Math.hypot(...a.p) - room(a.i) * 3) - (-Math.hypot(...b.p) - room(b.i) * 3))[0]?.p;
    if (centre) {
      const north = style == "north" || style == "riverlands";
      for (let h = 0; h < wood.hearts; h++) {
        const a = h * 2.1 + rand(), d = wood.hearts > 1 ? 9 : 0;
        put("heart-tree", centre[0] + Math.sin(a) * d, centre[1] + Math.cos(a) * d, 5, rand() * Math.PI * 2, 9 + rand() * 3);
      }
      grid.filter(([x, z]) => Math.hypot(x - centre[0], z - centre[1]) < 30).sort((p, q) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) - Math.hypot(q[0] - centre[0], q[1] - centre[1]))
        .forEach(([x, z]) => {
          if (props.filter(p => p.type == "tree" || p.type == "conifer").length >= wood.trees) return;
          const jx = x + (rand() - 0.5) * 3, jz = z + (rand() - 0.5) * 3;
          if (free(jx, jz, 2.6)) put(north && rand() < 0.75 ? "conifer" : "tree", jx, jz, 2.6, rand() * Math.PI * 2, 10 + rand() * 7);
        });
    }
  }
  // A stable along a curtain, its woodpile beside it.
  const stableLength = level > 1 ? 26 : 18;
  const solid = seated.filter(s => s.type != "curtain").map(volumeOf);
  for (let i = 0; i < curtains.length; i += 2) {
    const wall = curtains[i];
    const dx = wall.b[0] - wall.a[0], dz = wall.b[1] - wall.a[1], length = Math.hypot(dx, dz) || 1;
    // Inward normal: toward the ward's centre.
    const mx = (wall.a[0] + wall.b[0]) / 2, mz = (wall.a[1] + wall.b[1]) / 2;
    let nx = -dz / length, nz = dx / length;
    if (nx * -mx + nz * -mz < 0) { nx = -nx; nz = -nz; }
    const x = mx + nx * (wall.t / 2 + 7), z = mz + nz * (wall.t / 2 + 7);
    const angle = -Math.atan2(dz, dx);
    const ends: Vec2[] = [[x + dx / length * stableLength / 2, z + dz / length * stableLength / 2], [x - dx / length * stableLength / 2, z - dz / length * stableLength / 2]];
    const clear = (px: number, pz: number, r: number): boolean => Math.hypot(px, pz) > r + 26 && !solid.some(v => insideVolume(v, px, pz, r)) &&
      !curtains.some(c => distanceToSegment(px, pz, c.a, c.b) < c.t / 2 + r - 0.5) && !taken.some(t => Math.hypot(px - t.x, pz - t.z) < r + t.r) && !ground.wet(px, pz);
    if (![[x, z] as Vec2, ...ends].every(([px, pz]) => clear(px, pz, 4.5))) continue;
    put("stable", x, z, stableLength / 2, angle, stableLength);
    const wx = x + dx / length * (stableLength / 2 + 6), wz = z + dz / length * (stableLength / 2 + 6);
    if (clear(wx, wz, 3)) put("woodpile", wx, wz, 3, angle, 6);
    break;
  }
  const well = pick(3, (x, z) => Math.abs(Math.hypot(x, z) - 36));
  if (well) put("well", well[0], well[1], 3, rand() * Math.PI, 3);
  if (level > 1 || recipe != "castle") {
    const yard = pick(13, (x, z) => Math.abs(Math.hypot(x, z) - 60) + rand() * 4);
    if (yard) put("yard", yard[0], yard[1], 13, 0, 22);
  }
  // Two carts in the outer yard, toward the gate (+z).
  for (let i = 0; i < 2; i++) {
    const cart = pick(3, (x, z) => Math.abs(x - (i ? 18 : -18)) + Math.abs(z - Math.max(...zs) * 0.6) + rand() * 6);
    if (cart) put("cart", cart[0], cart[1], 3, rand() * Math.PI * 2, 3.4);
  }
  if (recipe == "highgarden") {
    // Rose parterres and hedge-maze walks occupy the terraces BETWEEN the
    // three curtains. Keep every solid, the public ward, gate axis and slots
    // clear. Short modules seat independently on the actual stepped hill.
    for (const [x, z] of grid) {
      if (!free(x, z, 3) || ground.reserved(x, z, 5) || (z > -12 && Math.abs(x) < 17)) continue;
      const angle = (Math.round((x - x0) / 5) % 5 == 0) ? Math.PI / 2 : 0;
      props.push({ type: "garden-bed", x, z, angle, ground: ground.height(x, z), size: 6 });
    }
  }
  return props;
}

function insideVolume(v: Volume, x: number, z: number, r: number): boolean {
  return x + r > v.minX && x - r < v.maxX && z + r > v.minZ && z - r < v.maxZ;
}

function distanceToSegment(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / length2));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

function hullArea(points: Vec2[]): number {
  return points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
}

/** Convex hull (monotone chain) of an outline. */
function convexHull(points: Vec2[]): Vec2[] {
  const sorted = points.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Vec2[]): Vec2[] => {
    const out: Vec2[] = [];
    list.forEach(p => { while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop(); out.push(p); });
    return out;
  };
  const lower = half(sorted), upper = half(sorted.slice().reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

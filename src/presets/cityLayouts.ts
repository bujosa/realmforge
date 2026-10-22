import { CityId, Vec2 } from "../cities/settlements/types";
import { HouseKit, kitBits } from "../cities/settlements/CityKit";

// Authored, normalized city plans. One layout unit = frame.radius world units.
// Local +X faces the sea/east and +Z faces the camera side/south; the frame
// yaw fits that to the board. House, wall and street sizes are world units, so
// a smaller strategic footprint keeps the same architecture with fewer lots.
// Reference notes and observed/inferred status: realism/cities/README.md.

export type CityStyle = "crownlands" | "north";
export type HouseVariant = "kl-row" | "kl-tall" | "kl-court" | "kl-hovel" | "wf-long" | "wf-stone" | "wf-hall" | "wf-byre";
export type LandmarkKind = "great-sept" | "dragonpit" | "broken-tower" | "first-keep" | "godswood" | "glass-gardens";

/**
 * Regional house types → shared pool kits (bible §2 K1). Sizes are world
 * units before the per-lot jitter; `pitch` is ridge height / depth (gable)
 * or / width (hip); `mask` picks the kit's regional parts (CityKit.kitBits).
 */
export const houseVariants: Record<HouseVariant, { kit: HouseKit; w: number; d: number; h: number; pitch: number; mask: number }> = {
  "kl-row": { kit: "gable", w: 0.0125, d: 0.0115, h: 0.0175, pitch: 0.32, mask: kitBits.crown | kitBits.plaster },
  "kl-tall": { kit: "tall", w: 0.0112, d: 0.0108, h: 0.0225, pitch: 0.36, mask: kitBits.crown | kitBits.plaster },
  "kl-court": { kit: "court", w: 0.017, d: 0.0155, h: 0.016, pitch: 0.34, mask: kitBits.crown | kitBits.plaster },
  "kl-hovel": { kit: "gable", w: 0.0098, d: 0.009, h: 0.0092, pitch: 0.2, mask: kitBits.crown | kitBits.plaster },
  "wf-long": { kit: "gable", w: 0.022, d: 0.0105, h: 0.0085, pitch: 1.0, mask: kitBits.north },
  "wf-stone": { kit: "gable", w: 0.0125, d: 0.0105, h: 0.0105, pitch: 0.82, mask: kitBits.north },
  "wf-hall": { kit: "tall", w: 0.0155, d: 0.0125, h: 0.017, pitch: 0.62, mask: kitBits.north },
  "wf-byre": { kit: "gable", w: 0.0105, d: 0.0088, h: 0.0072, pitch: 0.7, mask: kitBits.north }
};

export interface WallRingSpec {
  id: string;
  outline: Vec2[];
  /** World height scale of the shared wall kit (1 = 0.05 world). */
  height: number;
  thickness: number;
  towerEvery: number;
  gates: { name: string; edge: number; t: number }[];
}

/**
 * Timber palisade (K2 `palisade`) laid out after the houses: one closed ring
 * per compact cluster of these outside districts' placed lots, hugging them.
 * Gates open where an authored street crosses it (CityLayout).
 */
export interface PalisadeSpec {
  name: string;
  districts: string[];
  thickness: number;
  towerEvery: number;
}

export interface DistrictSpec {
  id: string;
  name: string;
  polygon: Vec2[];
  angle: number;
  /** World lot size along/perpendicular to its street, before the gap. */
  lot: Vec2;
  gap: number;
  /** Lots per block before an alley (along) and a lane (across). */
  block: Vec2;
  lane: number;
  variants: Partial<Record<HouseVariant, number>>;
  density: number;
  /** Outside every wall ring (Winter Town, harbor) instead of inside one. */
  outside?: boolean;
  priority: number;
}

export interface StreetSpec { name: string; points: Vec2[]; width: number }

export interface LandmarkSpec {
  kind: LandmarkKind;
  /** Ordered alternatives; the first clear of exclusions is used. */
  at: Vec2[];
  yaw?: number;
  /** World radius reserved from houses and checked against exclusions. */
  reserve: number;
  height: number;
  /** Low, spread landmark (godswood): only its centre must be clear. */
  soft?: boolean;
}

export interface HillSpec { at: Vec2; radius: number; lift: number }

export interface HarborSpec {
  quay: Vec2[];
  pierEvery: number;
  pierLength: number;
  boats: number;
}

/**
 * Region-fitted plan (used when the real region polygon is known): the
 * curtain follows the land borders `inset` inside the region, quays and piers
 * line the borders that face open water, and the authored districts become
 * bands by distance from the keep. Nothing is placed outside the region.
 */
export interface RegionFitSpec {
  inset: number;
  towerEvery: number;
  /** Board compass from the region centre: 0 east, π/2 south, π west, -π/2 north. */
  gates: { name: string; bearing: number }[];
  districts: (Omit<DistrictSpec, "polygon" | "outside"> & { keep: Vec2 })[];
  /** Landmark preference: bearing from the keep and a keep-distance band (world). */
  landmarks: { kind: LandmarkKind; bearing: number; keep: Vec2; reserve: number; height: number }[];
  hill: { radius: number; lift: number };
  harbor: { pierEvery: number; pierLength: number; boats: number };
}

export interface CityLayoutSpec {
  id: CityId;
  name: string;
  style: CityStyle;
  /** Default frame: world radius and board-facing yaw. */
  radius: number;
  minRadius: number;
  yaw: number;
  /** Rotations (multiples of 45°) the board fit may try, in preference order. */
  fitYaws: number[];
  /** Where the existing castle sculpt sits in the plan. */
  keepAt: Vec2;
  rings: WallRingSpec[];
  palisade?: PalisadeSpec;
  /** Water between consecutive rings (Winterfell's moat), as offset outline. */
  moat?: { outline: Vec2[]; width: number };
  streets: StreetSpec[];
  plazas: { at: Vec2; radius: number }[];
  districts: DistrictSpec[];
  landmarks: LandmarkSpec[];
  hills: HillSpec[];
  harbor?: HarborSpec;
  regionFit?: RegionFitSpec;
  /** Option bits shared by this city's stone pieces (CityKit.kitBits). */
  stoneMask: number;
  palette: { stone: string; trim: string; wood: string; plaster: string[]; roofs: Partial<Record<HouseVariant, string[]>>; snow: number };
}

const kingsLanding: CityLayoutSpec = {
  id: "kings-landing",
  name: "King's Landing",
  style: "crownlands",
  radius: 0.48,
  minRadius: 0.3,
  // Local +X (Blackwater Bay) to the board's north-east inlet.
  yaw: Math.PI / 4,
  // The harbor must face the bay wherever the castle sculpt lands.
  fitYaws: [0, 1, -1, 2, -2, 3, -3, 4],
  // Aegon's High Hill: south-east, above the river mouth and the bay.
  keepAt: [0.5, 0.28],
  rings: [{
    id: "city",
    outline: [[-0.92, -0.3], [-0.8, -0.68], [-0.45, -0.92], [0.05, -0.95], [0.48, -0.8], [0.78, -0.48], [0.86, -0.05],
      [0.84, 0.3], [0.62, 0.62], [0.2, 0.66], [-0.3, 0.62], [-0.7, 0.42], [-0.95, 0.08]],
    height: 1, thickness: 0.012, towerEvery: 0.085,
    gates: [
      { name: "Lion Gate", edge: 12, t: 0.5 },
      { name: "Gate of the Gods", edge: 1, t: 0.5 },
      { name: "Old Gate", edge: 2, t: 0.55 },
      { name: "Dragon Gate", edge: 4, t: 0.45 },
      { name: "Iron Gate", edge: 5, t: 0.5 },
      { name: "Mud Gate", edge: 9, t: 0.2 },
      { name: "King's Gate", edge: 10, t: 0.5 }
    ]
  }],
  streets: [
    { name: "Street of the Sisters", points: [[-0.62, -0.8], [-0.58, -0.42], [-0.55, -0.08]], width: 0.011 },
    { name: "Street of Steel", points: [[0.26, 0.46], [0.36, 0.1], [0.58, -0.18], [0.82, -0.27]], width: 0.011 },
    { name: "Street of Seeds", points: [[-0.2, -0.94], [-0.12, -0.72], [-0.06, -0.6], [-0.02, -0.3], [0.1, 0.1], [0.26, 0.46]], width: 0.01 },
    { name: "Hook", points: [[0.26, 0.46], [0.36, 0.38], [0.44, 0.3]], width: 0.01 },
    { name: "Muddy Way", points: [[0.1, 0.65], [0.2, 0.52], [0.26, 0.46], [0.02, 0.24], [-0.2, -0.1]], width: 0.01 },
    { name: "Street of Flour", points: [[-0.935, -0.11], [-0.7, 0.02], [-0.55, -0.08]], width: 0.009 },
    { name: "King's Way", points: [[-0.5, 0.52], [-0.26, 0.36], [0.04, 0.26], [0.26, 0.46]], width: 0.011 },
    { name: "Dragon Way", points: [[0.63, -0.64], [0.3, -0.42], [0.05, -0.22], [-0.2, -0.1]], width: 0.01 },
    { name: "Wall Road", points: [[-0.86, -0.3], [-0.74, -0.62], [-0.43, -0.85], [0.05, -0.88], [0.45, -0.74], [0.72, -0.46]], width: 0.008 }
  ],
  plazas: [{ at: [0.26, 0.46], radius: 0.035 }, { at: [-0.2, -0.1], radius: 0.025 }],
  districts: [
    { id: "flea-bottom", name: "Flea Bottom", polygon: [[-0.42, -0.46], [0.16, -0.46], [0.26, -0.04], [-0.04, 0.16], [-0.36, 0.06]],
      angle: 0.38, lot: [0.012, 0.011], gap: 0.0016, block: [5, 2], lane: 0.006, variants: { "kl-hovel": 0.62, "kl-row": 0.38 }, density: 0.97, priority: 0.2 },
    { id: "visenya", name: "Visenya's Hill", polygon: [[-0.93, -0.34], [-0.42, -0.56], [-0.34, 0.08], [-0.72, 0.4], [-0.94, 0.08]],
      angle: -0.22, lot: [0.018, 0.017], gap: 0.0025, block: [4, 2], lane: 0.008, variants: { "kl-court": 0.42, "kl-tall": 0.26, "kl-row": 0.32 }, density: 0.9, priority: 0.5 },
    { id: "rhaenys", name: "Rhaenys's Hill", polygon: [[-0.76, -0.66], [-0.45, -0.91], [0.46, -0.8], [0.64, -0.55], [0.16, -0.47], [-0.42, -0.5]],
      angle: 0.08, lot: [0.015, 0.014], gap: 0.002, block: [5, 2], lane: 0.007, variants: { "kl-row": 0.6, "kl-tall": 0.2, "kl-hovel": 0.2 }, density: 0.92, priority: 0.35 },
    { id: "street-of-steel", name: "Street of Steel", polygon: [[0.16, -0.47], [0.64, -0.55], [0.8, -0.42], [0.85, -0.05], [0.6, 0.06], [0.3, 0.16], [0.26, -0.04]],
      angle: 0.62, lot: [0.015, 0.015], gap: 0.002, block: [4, 2], lane: 0.008, variants: { "kl-tall": 0.32, "kl-row": 0.48, "kl-court": 0.2 }, density: 0.92, priority: 0.45 },
    { id: "river-row", name: "River Row", polygon: [[-0.7, 0.41], [-0.36, 0.06], [-0.04, 0.16], [0.3, 0.16], [0.56, 0.22], [0.6, 0.6], [0.2, 0.64], [-0.3, 0.6]],
      angle: -0.06, lot: [0.015, 0.014], gap: 0.002, block: [5, 2], lane: 0.007, variants: { "kl-row": 0.58, "kl-tall": 0.22, "kl-hovel": 0.2 }, density: 0.93, priority: 0.6 },
    { id: "docks", name: "Blackwater docks", polygon: [[-0.32, 0.66], [0.62, 0.66], [0.88, 0.36], [0.98, 0.5], [0.66, 0.84], [-0.24, 0.82]],
      angle: 0.02, lot: [0.014, 0.012], gap: 0.003, block: [3, 1], lane: 0.008, variants: { "kl-hovel": 0.55, "kl-row": 0.45 }, density: 0.7, outside: true, priority: 0.55 },
    { id: "kings-gate", name: "Outside the King's Gate", polygon: [[-1.05, 0.12], [-0.74, 0.46], [-0.34, 0.66], [-0.5, 0.86], [-0.98, 0.56]],
      angle: 0.55, lot: [0.013, 0.012], gap: 0.004, block: [3, 1], lane: 0.01, variants: { "kl-hovel": 0.7, "kl-row": 0.3 }, density: 0.45, outside: true, priority: 0.1 }
  ],
  landmarks: [
    { kind: "great-sept", at: [[-0.56, -0.08], [-0.5, 0.04], [-0.64, -0.2], [-0.44, -0.24]], reserve: 0.062, height: 0.12 },
    { kind: "dragonpit", at: [[-0.06, -0.62], [0.06, -0.66], [-0.2, -0.66]], reserve: 0.056, height: 0.06 }
  ],
  hills: [
    { at: [-0.56, -0.08], radius: 0.36, lift: 0.02 },
    { at: [-0.06, -0.62], radius: 0.32, lift: 0.017 }
  ],
  harbor: { quay: [[-0.24, 0.72], [0.22, 0.75], [0.64, 0.7], [0.9, 0.42], [0.96, 0.0]], pierEvery: 0.16, pierLength: 0.05, boats: 6 },
  // On the real map the city fills its region around the Red Keep, which keeps
  // its Table anchor on Aegon's High Hill above Blackwater Bay. Gates follow
  // the book compass (inferred): Old Gate north, Lion Gate west, King's Gate
  // south; Gate of the Gods and Dragon Gate toward the north-west/north-east.
  regionFit: {
    inset: 0.022, towerEvery: 0.075,
    gates: [
      { name: "Old Gate", bearing: -Math.PI / 2 }, { name: "Lion Gate", bearing: Math.PI },
      { name: "King's Gate", bearing: Math.PI / 2 }, { name: "Gate of the Gods", bearing: -Math.PI * 0.8 },
      { name: "Dragon Gate", bearing: -Math.PI * 0.2 }, { name: "Iron Gate", bearing: Math.PI * 0.25 }
    ],
    districts: [
      { id: "aegon", name: "Aegon's High Hill", keep: [0, 0.24], angle: 0.12, lot: [0.0165, 0.0155], gap: 0.0018, block: [4, 2], lane: 0.0065,
        variants: { "kl-court": 0.34, "kl-tall": 0.16, "kl-row": 0.5 }, density: 0.94, priority: 0.6 },
      { id: "street-of-steel", name: "Street of Steel and River Row", keep: [0.24, 0.46], angle: 0.42, lot: [0.0145, 0.0135], gap: 0.0016, block: [5, 2], lane: 0.006,
        variants: { "kl-row": 0.62, "kl-tall": 0.12, "kl-court": 0.1, "kl-hovel": 0.16 }, density: 0.96, priority: 0.5 },
      { id: "flea-bottom", name: "Flea Bottom", keep: [0.46, 9], angle: -0.2, lot: [0.0125, 0.0115], gap: 0.0014, block: [5, 2], lane: 0.0055,
        variants: { "kl-hovel": 0.5, "kl-row": 0.5 }, density: 0.97, priority: 0.35 }
    ],
    landmarks: [
      { kind: "great-sept", bearing: Math.PI, keep: [0.2, 0.6], reserve: 0.058, height: 0.12 },
      { kind: "dragonpit", bearing: Math.PI / 2, keep: [0.5, 1.1], reserve: 0.05, height: 0.06 }
    ],
    hill: { radius: 0.17, lift: 0.012 },
    harbor: { pierEvery: 0.11, pierLength: 0.045, boats: 6 }
  },
  stoneMask: kitBits.stone | kitBits.crown,
  palette: {
    stone: "#c4ad8d", trim: "#dccab0", wood: "#6f5643",
    plaster: ["#e2d3b4", "#d6bf98", "#e6dcc6", "#cba57f", "#d9c3a2", "#c99a74"],
    roofs: {
      "kl-row": ["#a9573a", "#b8673f", "#94492f", "#c27b52", "#a0603f"],
      "kl-tall": ["#9c4d34", "#b0603d", "#8b4430"],
      "kl-court": ["#b46a45", "#a35a3b", "#c0794f"],
      "kl-hovel": ["#76624d", "#6a5946", "#83705a", "#8d5d43"]
    },
    snow: 0
  }
};

const inner: Vec2[] = [[-0.98, -0.66], [0.62, -0.66], [0.72, -0.56], [0.72, 0.58], [0.62, 0.68], [-0.98, 0.68], [-1.08, 0.58], [-1.08, -0.56]];
const grow = (outline: Vec2[], amount: number): Vec2[] => outline.map(([x, z]) => [x + Math.sign(x + 0.18) * amount, z + Math.sign(z) * amount]);

const winterfell: CityLayoutSpec = {
  id: "winterfell",
  name: "Winterfell",
  style: "north",
  radius: 0.6,
  minRadius: 0.36,
  yaw: 0,
  // Winter Town keeps to the Kingsroad side: never more than 45° off south.
  fitYaws: [0, 1, -1],
  // The Great Keep sculpt is the inner ward; the city adds both curtains.
  keepAt: [0, 0],
  rings: [
    { id: "inner", outline: inner, height: 1.36, thickness: 0.016, towerEvery: 0.11,
      gates: [{ name: "Inner Gate", edge: 4, t: 0.39 }, { name: "Inner Hunter's Gate", edge: 6, t: 0.5 }, { name: "Inner East Gate", edge: 2, t: 0.5 }] },
    { id: "outer", outline: grow(inner, 0.16), height: 1, thickness: 0.014, towerEvery: 0.1,
      gates: [{ name: "South Gate", edge: 4, t: 0.406 }, { name: "Hunter's Gate", edge: 6, t: 0.5 }, { name: "East Gate", edge: 2, t: 0.5 }] }
  ],
  // Winter Town's timber palisade (inferred), around the town's lots only.
  palisade: { name: "Winter Town", districts: ["winter-town", "winter-town-east"], thickness: 0.006, towerEvery: 0.16 },
  moat: { outline: grow(inner, 0.08), width: 0.032 },
  streets: [
    { name: "Kingsroad", points: [[0, 0.62], [0, 0.95], [0.03, 1.25], [0.1, 1.6], [0.12, 1.8]], width: 0.016 },
    { name: "Market Lane", points: [[-0.95, 1.18], [-0.4, 1.16], [0.03, 1.2], [0.55, 1.22], [0.95, 1.3]], width: 0.011 },
    { name: "Wolfswood Track", points: [[-1.2, 0], [-1.55, 0.05]], width: 0.01 },
    { name: "Inner ward lane", points: [[0, 0.68], [0, 0.42]], width: 0.012 }
  ],
  plazas: [{ at: [0.03, 1.2], radius: 0.045 }],
  districts: [
    { id: "winter-town", name: "Winter Town", polygon: [[-1.0, 0.97], [0.82, 0.97], [1.02, 1.5], [0.2, 1.62], [-1.12, 1.5]],
      angle: 0.03, lot: [0.026, 0.02], gap: 0.006, block: [3, 2], lane: 0.012, variants: { "wf-long": 0.38, "wf-byre": 0.24, "wf-stone": 0.22, "wf-hall": 0.16 },
      density: 0.72, outside: true, priority: 0.6 },
    { id: "winter-town-east", name: "Winter Town, east lanes", polygon: [[0.98, -0.55], [1.42, -0.42], [1.5, 0.62], [1.3, 0.98], [0.95, 0.96]],
      angle: Math.PI / 2, lot: [0.024, 0.019], gap: 0.006, block: [3, 2], lane: 0.012, variants: { "wf-long": 0.34, "wf-byre": 0.3, "wf-stone": 0.24, "wf-hall": 0.12 },
      density: 0.6, outside: true, priority: 0.4 },
    { id: "inner-ward", name: "Inner ward yards", polygon: [[-0.55, -0.64], [0.7, -0.64], [0.7, 0.66], [-0.55, 0.66]],
      angle: 0, lot: [0.022, 0.017], gap: 0.004, block: [4, 1], lane: 0.01, variants: { "wf-hall": 0.35, "wf-byre": 0.35, "wf-stone": 0.3 },
      density: 0.85, priority: 0.5 }
  ],
  landmarks: [
    { kind: "godswood", at: [[-0.8, 0], [-0.8, -0.3], [-0.8, 0.3]], reserve: 0.15, height: 0.035, soft: true },
    { kind: "broken-tower", at: [[0.6, -0.54], [0.6, 0.5], [-0.62, -0.56]], reserve: 0.03, height: 0.13 },
    { kind: "first-keep", at: [[-0.58, -0.5], [-0.58, 0.52], [0.6, 0.52]], reserve: 0.03, height: 0.07 },
    { kind: "glass-gardens", at: [[-0.6, 0.48], [0.58, 0.42], [-0.6, -0.36]], reserve: 0.04, height: 0.022 }
  ],
  hills: [],
  stoneMask: kitBits.stone | kitBits.north,
  palette: {
    stone: "#848b87", trim: "#a7aaa2", wood: "#5f4d3d",
    plaster: ["#8e918a", "#9a9a90", "#a49d8c", "#878b86", "#9c9384"],
    roofs: {
      "wf-long": ["#5c5543", "#665b46", "#4f4b3e"],
      "wf-stone": ["#4c5052", "#575a5a", "#45494b"],
      "wf-hall": ["#4f4740", "#5b5047", "#47423d"],
      "wf-byre": ["#6a6047", "#5e5a44", "#706650"]
    },
    snow: 1
  }
};

export const cityLayouts: Record<CityId, CityLayoutSpec> = { "kings-landing": kingsLanding, winterfell };

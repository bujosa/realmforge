import type { HouseFamily } from "../cities/settlements/PhysicalKit";

// World ×20 (k = 20) physical city recipes, in metres (design §2.3, §5.5;
// bible §3–§4). The recipe fixes what the hand decides — footprint radius,
// curtain, gates by compass, district character, landmarks, house count —
// and PhysicalLayout fills the real region with lots. Compass bearings are
// board compass from the keep (0 east, π/2 south, π west, −π/2 north).
// Everything is public, static map data: nothing reads units, orders or fog.
//
// Observed/inferred status per place is in README.md ("World ×20 cities").

export type PhysicalCityId = "kings-landing" | "winterfell" | "lannisport" | "oldtown" | "white-harbor" | "sunspear" | "gulltown";
export type PhysicalLandmarkKind = "great-sept" | "dragonpit" | "broken-tower" | "first-keep" | "glass-gardens" | "citadel" | "sept" | "merman"
  | "starry-sept" | "wolfs-den" | "sun-tower" | "seal-rock";

export interface CurtainRecipe {
  name: string;
  /**
   * Curtain: the city area `inset` m inside (≥ 60 m shrinks it about the
   * centre instead), or a chamfered rectangle `keep` m round the keep sculpt.
   */
  outline: { inset: number } | { keep: number };
  height: number;
  thickness: number;
  /** Curtain piece length (m). */
  piece: number;
  towerEvery: number;
  towerHeight: number;
  towerSize: number;
  gates: { name: string; bearing: number }[];
  /** Timber palisade instead of stone (Winter Town). */
  palisade?: boolean;
  /** Low drystone (Sunspear's winding walls). */
  low?: boolean;
}

export interface DistrictRecipe {
  id: string;
  name: string;
  /** Which lots belong here: keep-distance band, landmark radius, shore band or the rest. */
  rule: { keep: [number, number]; bearing?: number; spread?: number } | { castle: [number, number] } | { landmark: PhysicalLandmarkKind; radius: number } | { shore: number } | { rest: true }
    | { outside: number; max?: number; bearing?: number; spread?: number };
  /** Organic rows along a distance field (round 2); without it, a rotated lot grid. */
  flow?: FlowRecipe;
  /** Share of bare-masonry houses here (overrides the palette's). */
  masonry?: number;
  /** Lot along / across its lane (m) and the gap between houses. */
  lot: [number, number];
  gap: number;
  /** Lots per block before a lane, along and across. */
  block: [number, number];
  lane: number;
  /** Grid angle (radians, board compass) or `shore` (parallel to the nearest shore). */
  angle: number | "shore";
  /** Per-lot rotation jitter (radians) and position jitter (fraction of the gap). */
  jitter: number;
  density: number;
  families: Partial<Record<HouseFamily, number>>;
  /** Ranking bonus (lower tiers keep the best-ranked lots). */
  priority: number;
  /** Eave height range (m). */
  height: [number, number];
}

/**
 * Organic street pattern: rows follow iso-lines of the distance to water
 * (`shore`), to the castle (`keep`) or the nearer of both, bent by a seeded
 * warp (`warp` m over `wavelength` m); blocks are runs of `run` lots split by
 * alleys, a `squares` share of blocks left open.
 */
export interface FlowRecipe {
  field: "shore" | "keep" | "both";
  warp: number;
  wavelength: number;
  run: [number, number];
  squares?: number;
  /** Castle distance weight (> 1 pulls the shore rows further round the castle). */
  stretch?: number;
}

export interface LandmarkRecipe {
  kind: PhysicalLandmarkKind;
  bearing: number;
  /** Keep-distance band (m) searched, best compass match first. */
  distance: [number, number];
  /** Clear radius (m): no house, wall or other landmark inside. */
  reserve: number;
  /** Nominal CityParts geometry scale (landmark size ×). */
  scale: number;
  /** Prefer high ground (hills: Visenya's, Rhaenys's). */
  high?: boolean;
  /** Bearing and band measured from the castle instead of the city centre. */
  from?: "castle";
  /** Only when the castle has no physical complex (P3·C2) to carry it. */
  unlessComplex?: boolean;
  /** An islet in the harbour: open water `reserve` m round it, near the shore. */
  water?: boolean;
  /** On the waterfront: its edge within this many metres of the water. */
  shore?: number;
}

export interface PhysicalRecipe {
  id: PhysicalCityId;
  name: string;
  /** Region that hosts the city; Gulltown has no region of its own. */
  hosts: string[];
  /** The city centre: the castle anchor, or the best coastal ground `coast.distance` m from it. */
  centre: "keep" | { coast: [number, number] };
  /** City area: the host region inside this radius (m) of the centre. */
  radius: number;
  /** Ground kept clear round the keep sculpt beyond its footprint (m). */
  keepMargin: number;
  curtains: CurtainRecipe[];
  districts: DistrictRecipe[];
  landmarks: LandmarkRecipe[];
  /** Harbor: quays along the water-facing shore, piers every `pierEvery` m. */
  harbor?: {
    pierEvery: number; pierLength: number; quay: number;
    /** High banks (9–70 m over the sea): a quay at the foot and a stone stair every `stairs` m. */
    stairs?: number;
  };
  /** Bridges over rivers and inlets inside the city: span ≤ `span` m, ≥ `every` m apart, at most `max`. */
  bridges?: { span: number; every: number; max: number };
  /** Moat between the first two curtains (Winterfell). */
  moat?: number;
  /** Godswood beside the keep (Winterfell): trees within the inner curtain. */
  godswood?: { bearing: number; distance: number; radius: number; trees: number };
  /** House caps per tier (ranked; Balanced keeps the best). */
  houses: { high: number; balanced: number };
  /** Main streets (m wide) from each gate to the square and on to the keep. */
  street: number;
  palette: {
    plaster: string[]; roofs: Partial<Record<HouseFamily, string[]>>; stone: string; trim: string; snow: number;
    /** Share of bare-masonry houses and their wall tints (round 2). */
    masonry?: number; walls?: string[];
    /** Share of flat-roofed houses with a dome. */
    domes?: number;
    /** `gable-steep` ridge ratio range (default 0.72–0.92, the North's). */
    pitch?: [number, number];
  };
  /** Kit option bits of the curtain (CityKit.kitBits). */
  stoneMask: number;
  /** Muted coarse roofscape retained beyond the regional detail ring. */
  distantPalette?: PhysicalRecipe["palette"];
}

const E = 0, S = Math.PI / 2, W = Math.PI, N = -Math.PI / 2;

const crownPlaster = ["#e2d3b4", "#d6bf98", "#e6dcc6", "#cba57f", "#d9c3a2", "#c99a74"];
const crownRoofs = ["#a9573a", "#b8673f", "#94492f", "#c27b52", "#a0603f", "#9c4d34"];

/**
 * King's Landing (design §5.5 #1): the walled city fills its region round the
 * Red Keep on Aegon's High Hill; Great Sept on Visenya's Hill (west), the
 * ruined Dragonpit on Rhaenys's Hill (south: the keep sits on the region's
 * north border, inferred), Flea Bottom between, River Row and the Mud Gate
 * docks along Blackwater Bay. 3,000–4,500 `gable-low` houses.
 */
const kingsLanding: PhysicalRecipe = {
  id: "kings-landing", name: "King's Landing", hosts: ["kings-landing"], centre: "keep", radius: 1900, keepMargin: 30,
  curtains: [{
    name: "City walls", outline: { inset: 26 }, height: 15, thickness: 5, piece: 15, towerEvery: 75, towerHeight: 23, towerSize: 9,
    gates: [{ name: "Old Gate", bearing: N }, { name: "Lion Gate", bearing: W }, { name: "King's Gate", bearing: S }, { name: "Gate of the Gods", bearing: W - 0.6 },
      { name: "Dragon Gate", bearing: N + 0.9 }, { name: "Iron Gate", bearing: S - 0.7 }, { name: "River Gate (Mud Gate)", bearing: E }]
  }],
  districts: [
    { id: "aegon", name: "Aegon's High Hill", rule: { keep: [0, 330] }, lot: [10, 9.5], gap: 0.8, block: [5, 2], lane: 5, angle: 0.12, jitter: 0.05, density: 0.92,
      families: { court: 0.36, "tower-house": 0.18, "gable-low": 0.46 }, priority: 0.6, height: [7, 10] },
    { id: "visenya", name: "Visenya's Hill", rule: { landmark: "great-sept", radius: 330 }, lot: [10, 9.5], gap: 0.8, block: [5, 2], lane: 5, angle: -0.22, jitter: 0.06, density: 0.9,
      families: { court: 0.4, "tower-house": 0.22, "gable-low": 0.38 }, priority: 0.5, height: [7, 10] },
    { id: "river-row", name: "River Row and the Mud Gate", rule: { shore: 140 }, lot: [8.5, 8.5], gap: 0.6, block: [8, 2], lane: 4, angle: "shore", jitter: 0.06, density: 0.92,
      families: { "gable-low": 0.7, "tower-house": 0.12, court: 0.08, "turf-long": 0.1 }, priority: 0.55, height: [6, 9] },
    { id: "rhaenys", name: "Rhaenys's Hill", rule: { landmark: "dragonpit", radius: 380 }, lot: [8, 8], gap: 0.6, block: [7, 2], lane: 4.5, angle: 0.08, jitter: 0.08, density: 0.9,
      families: { "gable-low": 0.7, "tower-house": 0.14, court: 0.16 }, priority: 0.35, height: [6, 9] },
    { id: "street-of-steel", name: "Street of Steel", rule: { keep: [340, 1200], bearing: S + 0.55, spread: 0.24 },
      lot: [9, 12], gap: 1.5, block: [4, 2], lane: 6, angle: 0.12, jitter: 0.07, density: 0.88,
      flow: { field: "keep", warp: 9, wavelength: 260, run: [4, 7], squares: 0.12 }, masonry: 0.85,
      families: { hall: 0.42, "gable-low": 0.38, court: 0.15, "tower-house": 0.05 }, priority: 0.5, height: [5, 8] },
    { id: "flea-bottom", name: "Flea Bottom", rule: { rest: true }, lot: [6.5, 6.3], gap: 0.35, block: [6, 2], lane: 3, angle: 0.38, jitter: 0.3, density: 0.95,
      flow: { field: "both", warp: 28, wavelength: 220, run: [3, 7], squares: 0.035 },
      masonry: 0.18, families: { "gable-low": 0.78, "turf-long": 0.12, court: 0.06, "tower-house": 0.04 }, priority: 0.3, height: [4.5, 7] }
  ],
  landmarks: [
    { kind: "great-sept", bearing: W, distance: [380, 760], reserve: 145, scale: 18, high: true },
    { kind: "dragonpit", bearing: S, distance: [620, 1150], reserve: 155, scale: 34, high: true }
  ],
  harbor: { pierEvery: 48, pierLength: 72, quay: 12, stairs: 65 },
  houses: { high: 4500, balanced: 3600 },
  street: 9,
  palette: { plaster: crownPlaster, roofs: { "gable-low": crownRoofs, court: crownRoofs, hall: crownRoofs, "tower-house": crownRoofs, "turf-long": ["#76624d", "#6a5946", "#83705a"] },
    stone: "#c4ad8d", trim: "#dccab0", snow: 0 },
  stoneMask: 4 | 1
};

/**
 * Winterfell (#2): Winter Town (300–600 houses) south along the Kingsroad
 * inside a timber palisade. The castle itself — double granite curtain,
 * moat, Broken Tower, godswood — is the physical complex of P3·C2, whose
 * reach the town keeps clear of (complexReach). Round 2: timber and daub
 * under turf and slate, lanes curving round the castle.
 */
const winterfell: PhysicalRecipe = {
  id: "winterfell", name: "Winterfell", hosts: ["winterfell"], centre: "keep", radius: 900, keepMargin: 40,
  curtains: [
    { name: "Winter Town palisade", outline: { inset: 0 }, height: 5.5, thickness: 1, piece: 10, towerEvery: 90, towerHeight: 9, towerSize: 5, palisade: true,
      gates: [{ name: "Kingsroad Gate", bearing: S }] }
  ],
  districts: [
    { id: "winter-town", name: "Winter Town", rule: { outside: 200, max: 780, bearing: S, spread: 1.25 }, lot: [16, 11], gap: 4.5, block: [3, 2], lane: 7, angle: 0.03, jitter: 0.12, density: 0.7,
      flow: { field: "keep", warp: 26, wavelength: 220, run: [2, 4], squares: 0.1 },
      families: { "turf-long": 0.4, "gable-steep": 0.42, hall: 0.18 }, priority: 0.6, height: [4.5, 7] }
  ],
  landmarks: [],
  houses: { high: 560, balanced: 450 },
  street: 10,
  palette: { plaster: ["#6b5643", "#5e4c3b", "#76604a", "#66584a", "#7d6a55"],
    roofs: { "turf-long": ["#5a5f3d", "#63633f", "#4f5536", "#6b6a48"], "gable-steep": ["#4c5052", "#575a5a", "#45494b", "#7a6a4a"], hall: ["#4f4740", "#5b5047", "#47423d"] },
    stone: "#848b87", trim: "#a7aaa2", snow: 1, masonry: 0.22, walls: ["#8e918a", "#9a9a90", "#878b86"] },
  stoneMask: 4 | 2
};

/**
 * Lannisport (#4): 1,500–2,500 houses of golden sandstone and cream plaster
 * under muted golden-ochre tile — the richest port of the realm — on the bay below Casterly
 * Rock (the hero of P3·C2, kept clear). Rows wind along the quays; on high
 * banks the harbour gets a foot quay and stone stairs; Lannisport's sept.
 */
const lannisport: PhysicalRecipe = {
  id: "lannisport", name: "Lannisport", hosts: ["lannisport"], centre: { coast: [420, 1000] }, radius: 820, keepMargin: 60,
  curtains: [{ name: "City walls", outline: { inset: 22 }, height: 13, thickness: 4.5, piece: 15, towerEvery: 80, towerHeight: 20, towerSize: 8.5,
    gates: [{ name: "Lion's Gate", bearing: N }, { name: "Golden Gate", bearing: S }, { name: "Sunset Gate", bearing: E }] }],
  districts: [
    { id: "quays", name: "The quays", rule: { shore: 140 }, lot: [10.5, 9], gap: 0.7, block: [6, 2], lane: 5, angle: "shore", jitter: 0.06, density: 0.9,
      flow: { field: "shore", warp: 12, wavelength: 240, run: [4, 8], squares: 0.04 }, masonry: 0.4,
      families: { "gable-low": 0.55, "tower-house": 0.15, court: 0.1, hall: 0.2 }, priority: 0.6, height: [6.5, 10] },
    { id: "sept", name: "Sept quarter", rule: { landmark: "great-sept", radius: 210 }, lot: [12, 11], gap: 1.2, block: [4, 2], lane: 6, angle: 0.2, jitter: 0.05, density: 0.9,
      flow: { field: "both", warp: 14, wavelength: 260, run: [3, 5], squares: 0.12 }, masonry: 0.75,
      families: { court: 0.5, "tower-house": 0.3, "gable-low": 0.2 }, priority: 0.5, height: [8, 11] },
    { id: "town", name: "Lannisport", rule: { rest: true }, lot: [10, 9], gap: 0.7, block: [5, 2], lane: 4.5, angle: -0.3, jitter: 0.1, density: 0.92,
      flow: { field: "both", warp: 26, wavelength: 320, run: [3, 7], squares: 0.05 },
      families: { "gable-low": 0.62, court: 0.18, "tower-house": 0.2 }, priority: 0.4, height: [6.5, 10] }
  ],
  landmarks: [{ kind: "great-sept", bearing: S, distance: [120, 420], reserve: 56, scale: 9.5, high: true }],
  harbor: { pierEvery: 52, pierLength: 62, quay: 10, stairs: 90 },
  bridges: { span: 90, every: 240, max: 3 },
  houses: { high: 2500, balanced: 2000 },
  street: 9,
  palette: { plaster: ["#e3cfa8", "#d9bf93", "#e8d7b6", "#dcc39b"],
    roofs: { "gable-low": ["#9c8054", "#ac925f", "#8f744e", "#b39b6e", "#a0885c"], court: ["#9c8054", "#b39b6e", "#8f744e"], "tower-house": ["#8f744e", "#a0885c"], hall: ["#87714f", "#9a835e"] },
    stone: "#c9a56e", trim: "#e0c79a", snow: 0, masonry: 0.5, walls: ["#c8a46c", "#d2b07a", "#bd9861", "#c79f6a", "#d8b886"] },
  stoneMask: 4 | 1
};

/**
 * Oldtown (#9): the oldest city — grey stone and slate, not crown terracotta.
 * Streets wind along the Honeywine and the shore, bridged where the river
 * runs through; the Citadel quarter of scholarly halls and courts round the
 * castle complex (P3·C2's Citadel courts) with the Citadel's domed halls
 * beside it; the Starry Sept on the high ground. The Hightower (C2's hero on
 * Battle Isle) is kept clear by PhysicalWorld.
 */
const oldtown: PhysicalRecipe = {
  id: "oldtown", name: "Oldtown", hosts: ["oldtown"], centre: { coast: [300, 760] }, radius: 700, keepMargin: 40,
  curtains: [{ name: "City walls", outline: { inset: 24 }, height: 14, thickness: 5, piece: 15, towerEvery: 80, towerHeight: 22, towerSize: 9,
    gates: [{ name: "Honeywine Gate", bearing: N }, { name: "Reach Gate", bearing: E }, { name: "Sea Gate", bearing: S }] }],
  districts: [
    { id: "citadel", name: "The Citadel", rule: { castle: [0, 340] }, lot: [15, 12], gap: 1.6, block: [3, 2], lane: 6, angle: 0.15, jitter: 0.03, density: 0.92,
      flow: { field: "keep", warp: 10, wavelength: 260, run: [3, 5], squares: 0.1 }, masonry: 1,
      families: { hall: 0.45, court: 0.4, "tower-house": 0.15 }, priority: 0.6, height: [8, 12] },
    { id: "harbor", name: "The Honeywine and the harbour", rule: { shore: 120 }, lot: [9.5, 9], gap: 0.7, block: [5, 2], lane: 4.5, angle: "shore", jitter: 0.08, density: 0.9,
      flow: { field: "shore", warp: 14, wavelength: 220, run: [4, 8], squares: 0.05 },
      families: { "gable-steep": 0.62, "tower-house": 0.2, court: 0.1, hall: 0.08 }, priority: 0.55, height: [6, 10] },
    { id: "town", name: "Oldtown", rule: { rest: true }, lot: [9.5, 9], gap: 0.6, block: [5, 2], lane: 4, angle: -0.15, jitter: 0.12, density: 0.92,
      flow: { field: "both", warp: 30, wavelength: 300, run: [3, 7], squares: 0.06 },
      families: { "gable-steep": 0.6, "tower-house": 0.22, court: 0.12, hall: 0.06 }, priority: 0.4, height: [6, 10] }
  ],
  landmarks: [
    { kind: "citadel", bearing: 0, from: "castle", distance: [130, 330], reserve: 62, scale: 9 },
    { kind: "starry-sept", bearing: E, distance: [180, 560], reserve: 66, scale: 13, high: true }
  ],
  harbor: { pierEvery: 50, pierLength: 56, quay: 10, stairs: 140 },
  bridges: { span: 110, every: 190, max: 6 },
  houses: { high: 3000, balanced: 2400 },
  street: 9,
  palette: { plaster: ["#d9d3c4", "#cfc8b6", "#e0dbcf"],
    roofs: { "gable-steep": ["#59626a", "#646c73", "#525a61", "#6d757b", "#76705f"], court: ["#646c73", "#59626a", "#6a6d69"], "tower-house": ["#59626a", "#4e555b"], hall: ["#5d646a", "#686e72"] },
    stone: "#a9a69c", trim: "#c4c0b4", snow: 0, masonry: 0.8, walls: ["#a7a398", "#b3aea1", "#9c998f", "#bdb7a8", "#a19d92"], pitch: [0.48, 0.62] },
  stoneMask: 4 | 2
};

/**
 * White Harbor (#15): whitewashed houses with grey-green slate in terraces
 * rising from the White Knife estuary; Merman's Court and its statue, the
 * town sept, the old Wolf's Den by the water and Seal Rock in the bay.
 */
const whiteHarbor: PhysicalRecipe = {
  id: "white-harbor", name: "White Harbor", hosts: ["white-harbor"], centre: { coast: [260, 640] }, radius: 560, keepMargin: 55,
  curtains: [{ name: "White walls", outline: { inset: 20 }, height: 12, thickness: 4.5, piece: 15, towerEvery: 75, towerHeight: 19, towerSize: 8.5,
    gates: [{ name: "Seal Gate", bearing: S }, { name: "North Gate", bearing: N }, { name: "Wolf Gate", bearing: W }] }],
  districts: [
    { id: "quays", name: "Seal Rock quays", rule: { shore: 120 }, lot: [10, 8.5], gap: 0.7, block: [6, 2], lane: 5, angle: "shore", jitter: 0.06, density: 0.88,
      flow: { field: "shore", warp: 10, wavelength: 240, run: [4, 8], squares: 0.04 },
      families: { "gable-steep": 0.68, "tower-house": 0.12, hall: 0.2 }, priority: 0.55, height: [6, 9] },
    { id: "merman", name: "Merman's Court", rule: { landmark: "merman", radius: 120 }, lot: [11, 10], gap: 1, block: [4, 2], lane: 5, angle: 0.1, jitter: 0.04, density: 0.88,
      families: { hall: 0.4, "gable-steep": 0.6 }, priority: 0.5, height: [7, 10] },
    { id: "town", name: "White Harbor", rule: { rest: true }, lot: [10, 9], gap: 0.7, block: [5, 2], lane: 5, angle: 0.25, jitter: 0.08, density: 0.9,
      flow: { field: "shore", warp: 18, wavelength: 280, run: [4, 7], squares: 0.05 },
      families: { "gable-steep": 0.8, hall: 0.12, "tower-house": 0.08 }, priority: 0.4, height: [6, 9] }
  ],
  landmarks: [
    { kind: "merman", bearing: S, distance: [60, 300], reserve: 22, scale: 10 },
    { kind: "sept", bearing: W, distance: [120, 420], reserve: 40, scale: 6.5 },
    { kind: "wolfs-den", bearing: E, distance: [140, 560], reserve: 48, scale: 10, shore: 40 },
    { kind: "seal-rock", bearing: S, distance: [120, 900], reserve: 42, scale: 10, water: true }
  ],
  harbor: { pierEvery: 60, pierLength: 44, quay: 9, stairs: 140 },
  // The White Knife runs through the town: long stone bridges on piers.
  bridges: { span: 170, every: 260, max: 3 },
  houses: { high: 1800, balanced: 1450 },
  street: 8,
  palette: { plaster: ["#f2f7ff", "#edf4ff", "#f8fbff", "#e7f0fa"], roofs: { "gable-steep": ["#b5dafa", "#c1e1ff", "#b2d5f5", "#c5e3ff", "#bbdcfa"], hall: ["#b5dafa", "#c1e1ff"], "tower-house": ["#b2d5f5", "#c5e3ff"] },
    stone: "#e2ecff", trim: "#f2f7ff", snow: 1, masonry: 0.04, walls: ["#e7f0fa", "#f2f7ff"] },
  distantPalette: { plaster: ["#eceae3", "#e4e2da", "#f1efe8", "#dcdad2"], roofs: { "gable-steep": ["#566a63", "#5f716a", "#4d5f59", "#6a7a73", "#52625d"], hall: ["#4d5f59", "#566a63"], "tower-house": ["#4d5f59", "#5f716a"] },
    stone: "#d9d6cc", trim: "#ecebe4", snow: 1, masonry: 0.12, walls: ["#b9b8b0", "#c5c3bb"] },
  stoneMask: 4 | 2
};

/**
 * Sunspear (#8): the Shadow City — adobe houses with flat roofs, a few domes
 * — packed in winding lanes under the Old Palace's walls, inside the winding
 * walls by the sea. The Tower of the Sun's gilded dome is the castle's (C2);
 * the city draws it only when that complex is absent.
 */
const sunspear: PhysicalRecipe = {
  id: "sunspear", name: "Sunspear", hosts: ["sunspear"], centre: { coast: [80, 560] }, radius: 980, keepMargin: 45,
  curtains: [
    { name: "Winding wall", outline: { inset: 16 }, height: 7, thickness: 3, piece: 12, towerEvery: 110, towerHeight: 11, towerSize: 6, low: true,
      gates: [{ name: "Threefold Gate", bearing: N }, { name: "Sea Gate", bearing: E }] },
    { name: "Winding wall (middle)", outline: { inset: 150 }, height: 6, thickness: 3, piece: 12, towerEvery: 140, towerHeight: 9, towerSize: 5.5, low: true,
      gates: [{ name: "Middle Gate", bearing: N }] },
    // Third winding curtain: the existing planner seats each run, omits water
    // and preserves city approaches and the physical Old Palace reserve.
    { name: "Winding wall (inner)", outline: { inset: 280 }, height: 11, thickness: 4, piece: 12, towerEvery: 110, towerHeight: 17, towerSize: 7, low: true,
      gates: [{ name: "Inner Gate", bearing: N }] }
  ],
  districts: [
    { id: "shore", name: "Shore market", rule: { shore: 90 }, lot: [10, 9], gap: 1, block: [4, 2], lane: 5, angle: "shore", jitter: 0.1, density: 0.85,
      flow: { field: "shore", warp: 12, wavelength: 200, run: [3, 6], squares: 0.08 },
      families: { "flat-dome": 1 }, priority: 0.5, height: [5, 7] },
    { id: "shadow-city", name: "The Shadow City", rule: { rest: true }, lot: [7.6, 7.2], gap: 0.4, block: [5, 2], lane: 2.6, angle: 0.4, jitter: 0.24, density: 0.96,
      flow: { field: "keep", warp: 24, wavelength: 240, run: [4, 8], squares: 0.04 },
      families: { "flat-dome": 0.82, court: 0.18 }, priority: 0.4, height: [4.5, 10] }
  ],
  landmarks: [
    // The Water Gardens belong outside this city, on the Salt Shore. No
    // validated low coastal site fits: omit rather than carve the Shadow City.
    { kind: "sun-tower", bearing: 0.3, from: "castle", distance: [60, 520], reserve: 42, scale: 10, unlessComplex: true }
  ],
  harbor: { pierEvery: 75, pierLength: 42, quay: 8, stairs: 140 },
  houses: { high: 1900, balanced: 1500 },
  street: 7,
  palette: { plaster: ["#dcbf92", "#d2b080", "#e6cfa6", "#c99f6f", "#e0c49a", "#d7b98c"], roofs: { "flat-dome": ["#d8c09a", "#cfb38a", "#e2cda8", "#c4a57c"] },
    stone: "#d2ad7e", trim: "#ead3a8", snow: 0, domes: 0.30 },
  stoneMask: 4 | 1
};

/** Gulltown (bible §4.4, inferred): the Vale's port on the Bite, 1,000–1,500 white stone houses with blue slate inside walls. */
const gulltown: PhysicalRecipe = {
  id: "gulltown", name: "Gulltown", hosts: ["the-vale-of-arryn", "the-eyrie"], centre: { coast: [900, 2200] }, radius: 480, keepMargin: 60,
  curtains: [{ name: "City walls", outline: { inset: 20 }, height: 12, thickness: 4.5, piece: 15, towerEvery: 75, towerHeight: 18, towerSize: 8,
    gates: [{ name: "High Road Gate", bearing: W }, { name: "Sea Gate", bearing: E }] }],
  districts: [
    { id: "harbor", name: "Gulltown harbor", rule: { shore: 130 }, lot: [10, 8.5], gap: 0.7, block: [6, 2], lane: 5, angle: "shore", jitter: 0.06, density: 0.86,
      families: { "gable-steep": 0.75, "tower-house": 0.1, hall: 0.15 }, priority: 0.55, height: [6, 9] },
    { id: "town", name: "Gulltown", rule: { rest: true }, lot: [10, 9], gap: 0.7, block: [5, 2], lane: 5, angle: -0.2, jitter: 0.1, density: 0.9,
      families: { "gable-steep": 0.8, hall: 0.2 }, priority: 0.4, height: [6, 9] }
  ],
  landmarks: [{ kind: "sept", bearing: W, distance: [80, 360], reserve: 40, scale: 6.5 }],
  harbor: { pierEvery: 60, pierLength: 42, quay: 9 },
  houses: { high: 1400, balanced: 1100 },
  street: 8,
  palette: { plaster: ["#e0e4df", "#d5dad4", "#e8eae4", "#cfd3cc"], roofs: { "gable-steep": ["#788f9e", "#6d8392", "#829aa8", "#62788a"], hall: ["#6d8392", "#62788a"], "tower-house": ["#788f9e"] },
    stone: "#e0e4df", trim: "#f5ecda", snow: 0 },
  stoneMask: 4 | 1
};

export const physicalRecipes: PhysicalRecipe[] = [kingsLanding, winterfell, lannisport, oldtown, whiteHarbor, sunspear, gulltown];

/** The recipe a region hosts (the first host present on this map wins for Gulltown). */
export function physicalRecipesFor(regionIds: Set<string>): { recipe: PhysicalRecipe; host: string }[] {
  return physicalRecipes.flatMap(recipe => {
    const host = recipe.hosts.find(id => regionIds.has(id));
    return host ? [{ recipe, host }] : [];
  });
}

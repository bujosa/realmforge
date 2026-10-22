// Rendering recipes only. These never add a unit, change its strength or choose
// a house. Greyjoy's dark cloth, raised prow and shield line follow Belshaw's
// season-six Ironborn production study. Other regional fittings are original
// design inferences, not claims about a canonical HBO fleet specification.
//
// Three hull classes are kept distinct without changing the slot envelope:
// merchant (deep, short, square sail), galleon (raised stern cabin, foresail)
// and lateen (long, low, raked sail). Greyjoy is a longship: a long narrow hull,
// a black carved prow and an oar row. Hull length only changes keel station
// spacing; freeboard only changes topside height.
export interface ShipProfile {
  beam: number;
  sternBeam: number;
  hullLength: number;
  freeboard: number;
  bow: number;
  stern: number;
  wood: string[];
  rail: string;
  seam: string;
  deck: string[];
  cloth: string[];
  crest: string;
  sailWidth: number;
  sailTop: number;
  sailFoot: number;
  edgeWidth: number;
  crestSize: number;
  lateen: boolean;
  foredeckRise: number;
  ironRibs: boolean;
  carvedProw: boolean;
  oars: boolean;
  shieldCount: number;
  quarterdeck: number;
  cabin: boolean;
  foreSail: boolean;
}

const common: ShipProfile = {
  beam: 1, sternBeam: 1, hullLength: 1, freeboard: 1, bow: 0.265, stern: 0.242,
  wood: ["#392b24", "#57402f", "#715039", "#806044", "#624732"],
  rail: "#b29160", seam: "#ad8855", deck: ["#a68559", "#b09263"],
  cloth: ["#d7caab", "#e7dab9"], crest: "#44372b",
  sailWidth: 0.292, sailTop: 0.53, sailFoot: 0.285, edgeWidth: 0.125, crestSize: 0.112, lateen: false,
  foredeckRise: 0, ironRibs: false, carvedProw: false, oars: false,
  shieldCount: 3, quarterdeck: 0.023, cabin: false, foreSail: false
};

const profiles: Record<string, Partial<ShipProfile>> = {
  greyjoy: {
    beam: 0.80, sternBeam: 0.92, hullLength: 1.04, freeboard: 0.88, bow: 0.345, stern: 0.264,
    wood: ["#252829", "#343635", "#424441", "#53534a", "#383b38"],
    rail: "#737668", seam: "#63665b", deck: ["#686a58", "#7a7a63"],
    cloth: ["#34373b", "#383b3f"], crest: "#d9b76a",
    sailWidth: 0.318, sailTop: 0.55, sailFoot: 0.265, edgeWidth: 0.07, crestSize: 0.126, shieldCount: 5,
    foredeckRise: 0.035, ironRibs: true, carvedProw: true, oars: true, quarterdeck: 0.038
  },
  baratheon: {
    beam: 1.10, sternBeam: 1.12, hullLength: 0.96, freeboard: 1.18, bow: 0.283, stern: 0.264,
    cloth: ["#c8a14e", "#dbb65e"], crest: "#292b28",
    rail: "#bca169", quarterdeck: 0.047, cabin: true, foreSail: true
  },
  lannister: {
    beam: 1.06, sternBeam: 1.14, hullLength: 1.0, freeboard: 1.14, bow: 0.268, stern: 0.272,
    wood: ["#352826", "#533a2e", "#6d4935", "#835c40", "#5c3a2d"],
    cloth: ["#843f39", "#a24c41"], crest: "#e8cc85", rail: "#c4a56b",
    quarterdeck: 0.054, cabin: true
  },
  stark: {
    beam: 0.94, hullLength: 0.94, freeboard: 1.12, bow: 0.272, stern: 0.245,
    wood: ["#303332", "#454843", "#5c5d51", "#727260", "#4c5049"],
    cloth: ["#c4c9c3", "#dce0d5"], crest: "#424d53", rail: "#9a9981",
    sailWidth: 0.27, sailTop: 0.515, shieldCount: 2
  },
  tyrell: {
    beam: 1.02, sternBeam: 1.08, hullLength: 0.98, freeboard: 1.08, bow: 0.267, stern: 0.253,
    cloth: ["#4e7054", "#648563"], crest: "#e7d399", rail: "#c5ab71",
    sailWidth: 0.30, quarterdeck: 0.032
  },
  martell: {
    beam: 0.90, sternBeam: 0.94, hullLength: 1.04, freeboard: 0.94, bow: 0.277, stern: 0.246,
    cloth: ["#b86d44", "#d28b54"], crest: "#392d27", rail: "#bda06c",
    sailWidth: 0.31, sailTop: 0.55, lateen: true, shieldCount: 2
  },
  arryn: {
    beam: 0.92, sternBeam: 1.02, hullLength: 1.02, freeboard: 1.0, bow: 0.275, stern: 0.255,
    cloth: ["#7295aa", "#86aabd"], crest: "#ece9d9", rail: "#b7b6a1",
    sailWidth: 0.256, sailTop: 0.548, sailFoot: 0.28, quarterdeck: 0.030
  },
  targaryen: {
    beam: 1.03, sternBeam: 1.06, hullLength: 1.04, freeboard: 1.04, bow: 0.291, stern: 0.261,
    wood: ["#29272b", "#3a3335", "#4c3e3d", "#635044", "#3b3436"],
    cloth: ["#343036", "#45393e"], crest: "#d4776b", rail: "#9e8974",
    sailWidth: 0.305, sailFoot: 0.278, quarterdeck: 0.039, foreSail: true
  }
};

export function shipProfile(house: string, color: string): ShipProfile {
  // Bolton is a compatibility alias only. The game currently retains the Stark
  // id when its ADWD name changes; do not guess that identity from paint.
  const profile = profiles[house == "bolton" ? "stark" : house];
  return { ...common, crest: color, ...profile };
}

import type { CastleStyle } from "../castles/castleStyles";

export const styleRegions: Record<CastleStyle, string[]> = {
  north: ["winterfell", "castle-black", "karhold", "white-harbor", "widows-watch", "moat-cailin", "greywater-watch", "flints-finger", "the-stony-shore"],
  riverlands: ["riverrun", "seagard", "the-twins", "harrenhal", "stoney-sept"],
  vale: ["the-eyrie", "the-vale-of-arryn", "the-fingers", "the-mountains-of-the-moon"],
  westerlands: ["casterly-rock", "lannisport", "searoad-marches"],
  reach: ["highgarden", "oldtown", "the-reach", "the-arbor", "dornish-marches", "three-towers"],
  stormlands: ["storms-end", "kingswood"],
  dorne: ["sunspear", "yronwood", "starfall", "salt-shore", "the-boneway", "princes-pass"],
  islands: ["pyke"],
  crownlands: ["kings-landing", "dragonstone", "crackclaw-point", "blackwater"],
  essos: []
};

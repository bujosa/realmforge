import { styleRegions as regions } from "../presets/styleRegions";
export type CastleStyle = "north" | "riverlands" | "vale" | "westerlands" | "reach" | "stormlands" | "dorne" | "islands" | "crownlands" | "essos";

export interface CastlePalette {
  stone: string;
  trim: string;
  roof: string;
  wood: string;
  round: boolean;
}

export const castlePalettes: Record<CastleStyle, CastlePalette> = {
  north: { stone: "#909da4", trim: "#bdc4c5", roof: "#594a40", wood: "#73604b", round: true },
  riverlands: { stone: "#9caaa4", trim: "#c9c6b3", roof: "#45545e", wood: "#796347", round: true },
  vale: { stone: "#e0e4df", trim: "#f5ecda", roof: "#788f9e", wood: "#817164", round: true },
  westerlands: { stone: "#b77866", trim: "#dab775", roof: "#773c3d", wood: "#82614b", round: false },
  reach: { stone: "#c9c4aa", trim: "#e2d8bd", roof: "#506553", wood: "#796348", round: true },
  stormlands: { stone: "#58636e", trim: "#8e9a9d", roof: "#414851", wood: "#6a5547", round: true },
  dorne: { stone: "#d7ad7c", trim: "#f2d6a4", roof: "#b8794e", wood: "#917044", round: true },
  islands: { stone: "#717e87", trim: "#a0a6a1", roof: "#454d54", wood: "#796348", round: true },
  crownlands: { stone: "#b77766", trim: "#ddb5a0", roof: "#744a50", wood: "#7c604b", round: false },
  essos: { stone: "#c1bcac", trim: "#e1d8bd", roof: "#718c89", wood: "#8c7155", round: false }
};

// Geography stays independent of the current controller. New expansion regions
// deliberately fall back to Essosi masonry rather than a house's home style.
// Only region ids that exist in westeros*.json. Orphans harlaw/orkmont/
// the-trident/the-golden-tooth/the-rainwood were removed (bible §6.3).


export function castleStyle(regionId: string): CastleStyle {
  return (Object.keys(regions) as CastleStyle[]).find(style => regions[style].includes(regionId)) ?? "essos";
}

export function castleVariant(regionId: string): number {
  let seed = 2166136261;
  for (let i = 0; i < regionId.length; i++) {
    seed = Math.imul(seed ^ regionId.charCodeAt(i), 16777619);
  }
  return (seed >>> 0) % 2;
}

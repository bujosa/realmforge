import type { DragonPalette } from "../dragons/types";

const HOUSE_PALETTES: Record<string, DragonPalette> = {
  // Dragon demo palette: near-black
  // scales with a warm red undertone, blood-red membranes, bronze belly.
  targaryen: {
    scales: "#211a1c",
    membrane: "#7e2229",
    bone: "#9a8670",
    horn: "#cdb994",
    eye: "#f0b54a",
    belly: "#5e3b32"
  },
  baratheon: {
    scales: "#3a3830",
    membrane: "#6b5a28",
    bone: "#c8b890",
    horn: "#d4c098",
    eye: "#d4a83a",
    belly: "#524a38"
  },
  stark: {
    scales: "#3a4248",
    membrane: "#5a6870",
    bone: "#b8b0a0",
    horn: "#c8c0b0",
    eye: "#8ab0c8",
    belly: "#4a5458"
  },
  lannister: {
    scales: "#5a3028",
    membrane: "#a04030",
    bone: "#d0b888",
    horn: "#e0c898",
    eye: "#e8c040",
    belly: "#6a4038"
  },
  greyjoy: {
    scales: "#2a3034",
    membrane: "#3a5858",
    bone: "#a09078",
    horn: "#b0a088",
    eye: "#60a0a8",
    belly: "#384044"
  },
  tyrell: {
    scales: "#2a4030",
    membrane: "#4a7848",
    bone: "#c0b088",
    horn: "#d0c098",
    eye: "#a0c848",
    belly: "#3a5040"
  },
  martell: {
    scales: "#5a3830",
    membrane: "#c06030",
    bone: "#d0b888",
    horn: "#e0c898",
    eye: "#e88830",
    belly: "#6a4840"
  },
  arryn: {
    scales: "#3a4450",
    membrane: "#5880a0",
    bone: "#c0b8a8",
    horn: "#d0c8b8",
    eye: "#70a8d0",
    belly: "#485868"
  },
  bolton: {
    scales: "#3a2828",
    membrane: "#703038",
    bone: "#b8a088",
    horn: "#c8b098",
    eye: "#c84848",
    belly: "#4a3030"
  }
};

const DEFAULT_PALETTE: DragonPalette = {
  scales: "#3e4145",
  membrane: "#893d4b",
  bone: "#c8b18a",
  horn: "#d8c4a0",
  eye: "#edbd5a",
  belly: "#62545a"
};

export function demoDragonPalette(house: string): DragonPalette {
  return HOUSE_PALETTES[house] ?? DEFAULT_PALETTE;
}

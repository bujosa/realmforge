import type { DragonPalette } from "./types";
/** Neutral defaults; inject a palette through CreateDragonOptions. */
export function dragonPalette(_identity?: string): DragonPalette { return {scales:"#3e4145",membrane:"#893d4b",bone:"#c8b18a",horn:"#d8c4a0",eye:"#edbd5a",belly:"#62545a"}; }

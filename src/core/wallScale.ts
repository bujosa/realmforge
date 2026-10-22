import { SceneFrame } from "./SceneFrame";

/** Lore height of the Wall (700 ft). At ×20, crest rise is frame.m(this). */
export const WALL_HEIGHT_METRES = 213;
/** Unscaled wall mesh crown height. placeWall divides crest rise by this. */
export const WALL_HEIGHT_REF = 1.58;
/** Board-scale crest above the highest ground under the Wall (k = 1). */
const BOARD_WALL_CREST_RISE = 1.05;
/** Live crest rise. syncWallFrame raises it to frame.m(213) under ×20. */
export let WALL_CREST_RISE = BOARD_WALL_CREST_RISE;
/** Watch fort instance scale. Tiny at the Wall's southern foot. */
export const WATCH_CASTLE_SCALE = 0.85;

/** True when the World opted into ×20 via frame.k or `?worldScale=20`. */
function worldScaleActive(frame: SceneFrame): boolean {
  if (frame.k > 1) return true;
  if (typeof location === "undefined") return false;
  return /(?:^|[?&])worldScale=20(?:&|$)/.test(location.search);
}

/** Mesh crown used as the heightScale divisor. Always the authored mesh. */
export function wallHeightRef(_frame?: SceneFrame): number {
  return WALL_HEIGHT_REF;
}

/** Crest rise for the active frame. Physical 213 m when World ×20 is on. */
export function wallCrestRise(frame: SceneFrame): number {
  return worldScaleActive(frame) ? frame.m(WALL_HEIGHT_METRES) : BOARD_WALL_CREST_RISE;
}

/** Watch fort scale. Unchanged so Castle Black stays tiny vs 213 m. */
export function watchCastleScale(_frame?: SceneFrame): number {
  return WATCH_CASTLE_SCALE;
}

/** Ice-wall base depth (instance Z). ~75 m under ×20; board thickness otherwise. */
export function wallBaseDepth(frame: SceneFrame): number {
  return worldScaleActive(frame) ? frame.m(75) : 1;
}

/**
 * Sync the live WALL_CREST_RISE binding to `frame`. Call from
 * TabletopLandscape.setWorld (integrator) and from WorldNorth on mount/dispose
 * so placeWall's existing `+ WALL_CREST_RISE` / `/ WALL_HEIGHT_REF` math yields
 * 4.26 u with `?worldScale=20` and the v3 crest without the flag. Only World
 * should call this with a live frame; Table stays on BOARD_WALL_CREST_RISE.
 */
export function syncWallFrame(frame: SceneFrame | null | undefined): void {
  WALL_CREST_RISE = frame ? wallCrestRise(frame) : BOARD_WALL_CREST_RISE;
}

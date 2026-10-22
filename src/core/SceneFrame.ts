/**
 * Scene coordinate frame shared by the Table and the immersive World.
 *
 * Three kinds of size live in the 3D scene (docs/v3-world-scale-design.md):
 * - map-space: board pixels (region sizes, distances, terrain extents). They
 *   scale with the land factor `k` and go through `len()` / `point()`.
 * - object-space: physical metres (castles, soldiers, ships, trees). They are
 *   independent of `k` and go through `m()`.
 * - screen-space: CSS pixels (tokens, labels, minimum banner sizes). They go
 *   through `ui()` with the camera distance.
 *
 * Table always uses k = 1. World uses k = 1, or 20 with the detailed-map
 * preference (an explicit `?worldScale` takes priority). At k = 1, 100 board px = 1 scene unit, which is the
 * convention every subsystem hard-coded before this module existed.
 */

export interface BoardPoint { x: number; y: number }

export interface SceneFrame {
  readonly k: number;              // land scale factor: Table 1; World 1, or 20 behind ?worldScale=20 (P2)
  readonly metresPerUnit: number;  // 50 (objects stay physical)
  readonly mapWidth: number; readonly mapHeight: number;
  len(boardPx: number): number;    // board px length → scene units  (= boardPx * k / 100)
  boardLen(units: number): number; // inverse
  point(p: BoardPoint): { x: number; z: number };   // centred: ((p.x - mapWidth/2) * k / 100, (p.y - mapHeight/2) * k / 100)
  boardPoint(x: number, z: number): BoardPoint;     // inverse
  m(metres: number): number;       // physical metres → scene units (= metres / metresPerUnit), independent of k
  ui(px: number, distance: number, fovYDeg: number, viewportH: number): number; // screen px → world size at distance
}

/** Board pixels per scene unit at k = 1. The only place this number may live. */
export const BOARD_PX_PER_UNIT = 100;
/** Physical metres per scene unit. Fixed for every frame (objects stay physical). */
export const METRES_PER_UNIT = 50;

/**
 * Size in world units covered by `px` screen pixels at `distance` from a
 * perspective camera with vertical FOV `fovYDeg` and a viewport `viewportH`
 * pixels tall. Independent of `k`.
 */
export function screenPxToWorld(px: number, distance: number, fovYDeg: number, viewportH: number): number {
  if (!(viewportH > 0)) return 0;
  const visibleHeight = 2 * Math.max(0, distance) * Math.tan(fovYDeg * Math.PI / 360);
  return px * visibleHeight / viewportH;
}

/**
 * Map-space length authored in k = 1 scene units (camera offsets, framing
 * extents, board margins) → scene units of `frame`. Equal to `len(units * 100)`
 * but exact at k = 1, so pre-frame literals keep their bit pattern.
 */
export function mapUnits(frame: SceneFrame, units: number): number {
  return units * frame.k;
}

class LinearSceneFrame implements SceneFrame {
  readonly metresPerUnit = METRES_PER_UNIT;
  // Divide by px-per-unit (not multiply by its reciprocal) so k = 1 is
  // bit-identical to the historical `/ 100` conversions.
  private readonly pxPerUnit: number;
  private readonly halfWidth: number;
  private readonly halfHeight: number;

  constructor(readonly k: number, readonly mapWidth: number, readonly mapHeight: number) {
    if (!(k > 0) || !Number.isFinite(k)) throw new RangeError(`SceneFrame: invalid k ${k}`);
    this.pxPerUnit = BOARD_PX_PER_UNIT / k;
    this.halfWidth = mapWidth / 2;
    this.halfHeight = mapHeight / 2;
  }

  len(boardPx: number): number {
    return boardPx / this.pxPerUnit;
  }

  boardLen(units: number): number {
    return units * this.pxPerUnit;
  }

  point(p: BoardPoint): { x: number; z: number } {
    return {
      x: (p.x - this.halfWidth) / this.pxPerUnit,
      z: (p.y - this.halfHeight) / this.pxPerUnit
    };
  }

  boardPoint(x: number, z: number): BoardPoint {
    return {
      x: x * this.pxPerUnit + this.halfWidth,
      y: z * this.pxPerUnit + this.halfHeight
    };
  }

  m(metres: number): number {
    return metres / METRES_PER_UNIT;
  }

  ui(px: number, distance: number, fovYDeg: number, viewportH: number): number {
    return screenPxToWorld(px, distance, fovYDeg, viewportH);
  }
}

/** Table frame: board scale forever (k = 1). */
export function tableFrame(mapWidth: number, mapHeight: number): SceneFrame {
  return new LinearSceneFrame(1, mapWidth, mapHeight);
}


export function worldFrame(mapWidth: number, mapHeight: number, k = 20): SceneFrame { return new LinearSceneFrame(k, mapWidth, mapHeight); }

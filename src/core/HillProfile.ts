/** Public terrain relief; all coordinates and heights use the caller's units. */
export interface TerrainHill { x: number; z: number; top: number; radius: number; crown: number }

/** Flat crown, irregular weathered shoulder, tangent to the surrounding ground. */
export function hillHeight(hills: readonly TerrainHill[], x: number, z: number, ground: number): number {
  let height = ground;
  for (const hill of hills) {
    const dx = x - hill.x, dz = z - hill.z, angle = Math.atan2(dz, dx);
    const radius = hill.radius * (1 + 0.065 * Math.sin(angle * 3 + 0.7) + 0.035 * Math.sin(angle * 5));
    const t = Math.max(0, Math.min(1, (Math.hypot(dx, dz) - hill.crown) / (radius - hill.crown)));
    const blend = 1 - t * t * (3 - 2 * t);
    height = Math.max(height, ground + Math.max(0, hill.top - ground) * blend);
  }
  return height;
}

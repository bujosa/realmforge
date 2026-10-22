import type { BoardPoint, SceneFrame } from "../core/SceneFrame";

/** Public strength law. Missing/invalid strength retains the agreed 48 m fallback. */
export function dragonWingspan(strength?: number): number {
  return strength == undefined || !Number.isFinite(strength) || strength < 0 ? 48 : 36 + 6 * Math.min(5, strength);
}

export function dragonSeed(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function insidePolygon(points: readonly BoardPoint[], p: BoardPoint): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonClearance(points: readonly BoardPoint[], p: BoardPoint): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-12, dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

export interface DragonPatrolPlan {
  center: { x: number; z: number };
  radius: number;
  phase: number;
  /** False for degenerate polygons: safely remain perched. */
  canFly: boolean;
}

/** An inscribed disk is safe even for concave regions. No camera or game model. */
export function planDragonPatrol(points: readonly BoardPoint[], slot: BoardPoint, frame: SceneFrame, key: string): DragonPatrolPlan {
  let best = slot, reach = insidePolygon(points, slot) ? polygonClearance(points, slot) : 0;
  if (points.length >= 3) {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    // Bounded, deterministic search done only when a public dragon changes region.
    for (let x = 1; x < 12; x++) for (let y = 1; y < 12; y++) {
      const p = { x: minX + (maxX - minX) * x / 12, y: minY + (maxY - minY) * y / 12 };
      if (!insidePolygon(points, p)) continue;
      const distance = polygonClearance(points, p);
      if (distance > reach) { best = p; reach = distance; }
    }
  }
  // Prefer the army's reserved clearing over the geographic centre (which can
  // be forest). The lair is 100 m to its flank; never move outside the polygon.
  const phase = dragonSeed(`MoD:${key}:dragon:P4-1`) / 4294967296 * Math.PI * 2;
  const flank = frame.boardLen(frame.m(100) * Math.min(1, frame.k / 20));
  for (let i = 0; i < 8; i++) {
    const angle = phase + i * Math.PI / 4, p = { x: slot.x + Math.cos(angle) * flank, y: slot.y + Math.sin(angle) * flank };
    if (!insidePolygon(points, p)) continue;
    const distance = polygonClearance(points, p);
    if (distance < flank * 0.6) continue;
    best = p; reach = distance; break;
  }
  const radius = Math.min(frame.m(260) * Math.min(1, frame.k / 20), frame.len(reach) * 0.65);
  return { center: frame.point(best), radius, phase, canFly: reach > 0 && radius > frame.m(1) * Math.min(1, frame.k / 20) };
}

export interface PatrolSample { x: number; z: number; heading: number; altitude: number; airborne: number }

/** Local-clock 25–35 m/s loops, interrupted by a gentle landing and perch. */
export function sampleDragonPatrol(plan: DragonPatrolPlan, seconds: number, tier: "high" | "balanced", reduced: boolean, frame: SceneFrame): PatrolSample {
  const cycle = tier == "high" ? 108 : 76, flying = tier == "high" ? 84 : 28;
  const t = ((seconds % cycle) + cycle) % cycle;
  const smooth = (v: number): number => { const k = Math.min(1, Math.max(0, v)); return k * k * (3 - 2 * k); };
  const airborne = reduced || !plan.canFly ? 0 : t < flying ? 1 : t < flying + 8 ? 1 - smooth((t - flying) / 8) : t > cycle - 8 ? smooth((t - cycle + 8) / 8) : 0;
  const speed = Math.min(frame.m(30) * Math.min(1, frame.k / 20), plan.radius * 0.2);
  const angle = plan.phase + seconds * speed / Math.max(0.001, plan.radius);
  // Orbit shrinks into the same clear central perch as it descends.
  const radius = plan.radius * airborne;
  return { x: plan.center.x + Math.cos(angle) * radius, z: plan.center.z + Math.sin(angle) * radius,
    heading: -angle, altitude: (200 + 35 * Math.sin(angle * 0.7)) * airborne, airborne };
}

/** Growth interpolates only when the caller supplies a fresh public beat. */
export class DragonGrowth {
  value = 48;
  private from = 48;
  private target = 48;
  private elapsed = 1200;
  set(strength: number | undefined, animate: boolean): boolean {
    const target = dragonWingspan(strength);
    if (target == this.target) return false;
    this.from = this.value; this.target = target; this.elapsed = animate ? 0 : 1200;
    if (!animate) this.value = target;
    return true;
  }
  update(dt: number): number {
    this.elapsed = Math.min(1200, this.elapsed + Math.max(0, dt));
    const t = this.elapsed / 1200;
    return this.value = this.from + (this.target - this.from) * t * t * (3 - 2 * t);
  }
}

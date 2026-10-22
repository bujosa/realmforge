import { CityExclusion, CityMagnify, Vec2 } from "./types";
import { SceneFrame, tableFrame } from "../../core/SceneFrame";

// Small deterministic 2D helpers for layout. XZ plane, no Three objects.

export function seeded(text: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  // mulberry32: stable across browsers, no Math.random.
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inside(polygon: Vec2[], x: number, z: number): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > z) != (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) result = !result;
  }
  return result;
}

export function segmentDistance(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(1e-9, dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function polylineDistance(x: number, z: number, points: Vec2[], closed = false): number {
  let best = Infinity;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) best = Math.min(best, segmentDistance(x, z, points[i], points[(i + 1) % points.length]));
  return best;
}

/** Signed clearance from a circle of `radius` at (x,z) to the shape (<0 overlaps). */
export function exclusionClearance(shape: CityExclusion, x: number, z: number, radius: number): number {
  if (shape.kind == "circle") return Math.hypot(x - shape.x, z - shape.z) - shape.radius - radius;
  const angle = shape.angle ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = x - shape.x, dz = z - shape.z;
  const lx = Math.abs(dx * cos - dz * sin) - shape.halfWidth, lz = Math.abs(dx * sin + dz * cos) - shape.halfDepth;
  const outside = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  return (outside > 0 ? outside : Math.max(lx, lz)) - radius;
}

export const defaultHalo = 0.02;
export const defaultClearHeight = 0.03;

/** "blocked": nothing; "low": only below the exclusion's clear height; "free". */
export function exclusionState(shapes: CityExclusion[], x: number, z: number, radius: number, height: number): "blocked" | "low" | "free" {
  let state: "blocked" | "low" | "free" = "free";
  for (const shape of shapes) {
    const clearance = exclusionClearance(shape, x, z, radius);
    if (clearance < 0) return "blocked";
    if (clearance < (shape.halo ?? defaultHalo) && height > (shape.clearHeight ?? defaultClearHeight)) state = "low";
  }
  return state;
}

/** Board-pixel slot rectangle → world exclusion (frame: map; castlePlacement contract). */
export function boardRect(point: { x: number; y: number }, halfWidth: number, halfHeight: number, mapWidth: number, mapHeight: number,
  extra: { halo?: number; clearHeight?: number } = {}, frame: SceneFrame = tableFrame(mapWidth, mapHeight)): CityExclusion {
  const scene = frame.point(point); // frame: map
  return { kind: "rect", x: scene.x, z: scene.z, halfWidth: frame.len(halfWidth), halfDepth: frame.len(halfHeight), ...extra };
}

export function polygonArea(points: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, az] = points[i], [bx, bz] = points[(i + 1) % points.length];
    area += ax * bz - bx * az;
  }
  return area / 2;
}

/** Drops near-duplicate and near-collinear vertices (region polygons carry both). */
export function simplifyPolygon(points: Vec2[], minEdge: number, tolerance: number): Vec2[] {
  let result = points.filter((point, i) => i == 0 || Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) >= minEdge);
  for (let changed = true; changed && result.length > 4;) {
    changed = false;
    for (let i = 0; i < result.length && result.length > 4; i++) {
      const previous = result[(i + result.length - 1) % result.length], next = result[(i + 1) % result.length];
      const short = Math.hypot(result[i][0] - previous[0], result[i][1] - previous[1]) < minEdge;
      if (short || segmentDistance(result[i][0], result[i][1], previous, next) < tolerance) { result = result.filter((_, j) => j != i); changed = true; }
    }
  }
  return result;
}

/** Miter offset toward the inside (limited at sharp corners). Same vertex order. */
export function insetPolygon(points: Vec2[], distance: number): Vec2[] {
  const n = points.length, sign = polygonArea(points) > 0 ? 1 : -1;
  const normals = points.map((a, i) => {
    const b = points[(i + 1) % n], length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / length * sign, (b[0] - a[0]) / length * sign] as Vec2;
  });
  return points.map((point, i) => {
    const a = normals[(i + n - 1) % n], b = normals[i];
    const bisector: Vec2 = [a[0] + b[0], a[1] + b[1]], length = Math.hypot(...bisector);
    if (length < 1e-6) return [point[0] + b[0] * distance, point[1] + b[1] * distance];
    const cos = (bisector[0] * b[0] + bisector[1] * b[1]) / length;
    const miter = Math.min(distance / Math.max(cos, 1e-3), distance * 2.5);
    return [point[0] + bisector[0] / length * miter, point[1] + bisector[1] / length * miter];
  });
}

/** Convex hull (monotone chain), counter-clockwise in X/Z. */
export function convexHull(points: Vec2[]): Vec2[] {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Vec2[]): Vec2[] => {
    const result: Vec2[] = [];
    list.forEach(point => {
      while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    });
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.slice().reverse())];
}

/** World ×20: a world XZ point in a magnified city's plan space (identity without `magnify`). */
export function toPlan(magnify: CityMagnify | undefined, x: number, z: number): Vec2 {
  if (!magnify) return [x, z];
  const { origin, factor } = magnify;
  return [origin.x + (x - origin.x) / factor, origin.z + (z - origin.z) / factor];
}

/** A world exclusion in plan space: centre mapped, every length and height divided. */
export function exclusionToPlan(magnify: CityMagnify | undefined, shape: CityExclusion): CityExclusion {
  if (!magnify) return shape;
  const [x, z] = toPlan(magnify, shape.x, shape.z), f = magnify.factor;
  const extra = { halo: shape.halo == undefined ? undefined : shape.halo / f, clearHeight: shape.clearHeight == undefined ? undefined : shape.clearHeight / f };
  return shape.kind == "circle" ? { ...shape, x, z, radius: shape.radius / f, ...extra } : { ...shape, x, z, halfWidth: shape.halfWidth / f, halfDepth: shape.halfDepth / f, ...extra };
}

/**
 * Sutherland–Hodgman: `subject` clipped by a convex counter-clockwise or
 * clockwise `clip` polygon. Used to bound a World ×20 city to a physical
 * radius inside its region.
 */
export function clipConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
  const sign = polygonArea(clip) > 0 ? 1 : -1;
  let output = subject;
  for (let i = 0; i < clip.length && output.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const side = (p: Vec2): number => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = output;
    output = [];
    input.forEach((current, j) => {
      const previous = input[(j + input.length - 1) % input.length];
      const sc = side(current), sp = side(previous);
      const cross = (): Vec2 => { const t = sp / (sp - sc); return [previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t]; };
      if (sc >= 0) { if (sp < 0) output.push(cross()); output.push(current); } else if (sp >= 0) output.push(cross());
    });
  }
  return output;
}

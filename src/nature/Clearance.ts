import type { BoardPoint, SceneFrame } from "../core/SceneFrame";

type Clearance = (point: BoardPoint, radiusM: number) => boolean;
const providers = new WeakMap<SceneFrame, Clearance>();
const reduced = new WeakMap<SceneFrame, () => boolean>();
const pauses = new WeakMap<SceneFrame, () => boolean>();
const listeners = new WeakMap<SceneFrame, Set<() => void>>();
/** Public physical footprints shared by all K11 builders in this World,
 * including C6's Haunted Forest. Never shared between scenes or k = 1. */
export function setFloraClearance(frame: SceneFrame, provider?: Clearance, paused?: () => boolean, reducedMotion?: () => boolean): void {
  if (frame.k !== 20) return;
  if (provider) providers.set(frame, provider); else providers.delete(frame);
  if (reducedMotion) reduced.set(frame, reducedMotion); else reduced.delete(frame);
  if (paused) pauses.set(frame, paused); else pauses.delete(frame);
  listeners.get(frame)?.forEach(invalidate => invalidate());
}
export function floraPhysicalClearance(frame: SceneFrame, point: BoardPoint, radiusM: number): boolean {
  return frame.k === 20 && (providers.get(frame)?.(point, radiusM) ?? false);
}
export function watchFloraClearance(frame: SceneFrame, invalidate: () => void): () => void {
  if (frame.k !== 20) return () => undefined;
  let set = listeners.get(frame);
  if (!set) { set = new Set(); listeners.set(frame, set); }
  set.add(invalidate);
  return () => set?.delete(invalidate);
}

export function floraPaused(frame: SceneFrame): boolean { return frame.k === 20 && (pauses.get(frame)?.() ?? false); }
export function floraReducedMotion(frame: SceneFrame): boolean { return frame.k === 20 && (reduced.get(frame)?.() ?? false); }

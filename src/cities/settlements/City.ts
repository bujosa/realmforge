import * as THREE from "three";
import AssetMaterials from "../../materials/AssetMaterials";
import KitPool, { KitInstance, KitLod } from "../../core/KitPool";
import { cityKitVariants } from "./CityKit";
import { CityPlan, defaultFrame, planCity, planCitySteps, Placement, tierCaps } from "./CityLayout";
import { keepGeometry, landmarkGeometry, silhouetteGeometry } from "./CityParts";
import { cityLayouts } from "../../presets/cityLayouts";
import { CityDetail, CityExclusion, CityFrame, CityGate, CityHandle, CityId, CityLodRegistration, CityOptions, CityStats, CityTier } from "./types";

const levels: CityDetail[] = ["far", "mid", "near"];

const triangles = (geometry?: THREE.BufferGeometry): number => geometry ? geometry.getAttribute("position").count / 3 : 0;

/** One shared pool per World scene: every city adds instances, not draws. */
export function createCityPool(tier: CityTier, assets?: AssetMaterials): KitPool {
  return new KitPool(cityKitVariants, tier == "high", assets);
}

/**
 * Builds a walled capital around the existing castle sculpt. Static public
 * scenery: no game state, no picking, no per-frame work. Its kit instances
 * and its merged static geometry live in `options.pool` (shared by every
 * place; the caller flushes it) or in a private pool under `root`.
 * Standalone draw calls: far 1; mid/near one per kit variant plus one.
 */
export function buildCity(id: CityId, options: CityOptions & { pool?: KitPool }): CityHandle {
  const spec = cityLayouts[id];
  const planFrame = defaultFrame(spec, options);
  // World ×20: plan space → world (identity without `magnify`).
  const magnify = options.magnify && options.magnify.factor > 1 ? options.magnify : undefined;
  const factor = magnify?.factor ?? 1, origin = magnify?.origin ?? { x: 0, z: 0 };
  const toWorld = (x: number, z: number): { x: number; z: number } => magnify
    ? { x: origin.x + (x - origin.x) * factor, z: origin.z + (z - origin.z) * factor } : { x, z };
  const frame: CityFrame = magnify ? { center: toWorld(planFrame.center.x, planFrame.center.z), radius: planFrame.radius * factor, yaw: planFrame.yaw } : planFrame;
  const caps = tierCaps[options.tier];
  const settings: CityOptions = { ...options, exclusions: [...(options.exclusions ?? [])] };
  const root = new THREE.Group();
  root.name = `City: ${spec.name}`;
  const own = !options.pool;
  const pool = options.pool ?? createCityPool(options.tier, options.assets);
  if (own) root.add(pool.group);
  const place = `city:${id}`;
  const snow = spec.palette.snow;
  let plan: CityPlan = { frame: planFrame, houses: [], walls: [], towers: [], gates: [], landmarks: [], trees: [], moat: [], bridges: [], quays: [], piers: [], boats: [], candidates: 0 };
  // World ×20: the layout being planned in slices (see advance).
  let job: Generator<void, CityPlan, void> | undefined;
  let lists: Record<KitLod, Map<string, KitInstance[]>> = { mid: new Map(), near: new Map() };
  let statics: Record<CityDetail, THREE.BufferGeometry | undefined> = { far: undefined, mid: undefined, near: undefined };
  let current: CityDetail = options.detail ?? "far";
  let shown = true;
  let disposed = false;

  const instance = (p: Placement): KitInstance => {
    const at = toWorld(p.x + planFrame.center.x, p.z + planFrame.center.z);
    return {
      x: at.x, y: p.y * factor, z: at.z, yaw: p.yaw, sx: p.sx * factor, sy: p.sy * factor, sz: p.sz * factor,
      depth: p.depth, wall: p.wall, roof: p.roof, mask: p.mask, pitch: p.pitch, snow
    };
  };

  // Low never builds the near kit: crenellations and wall walks stay off.
  const effective = (level: CityDetail): CityDetail => level == "near" && options.tier == "low" ? "mid" : level;
  const lodOf = (level: CityDetail): KitLod | undefined => { const resolved = effective(level); return resolved == "far" ? undefined : resolved; };

  /** Local (frame-centred) static geometry → world space for the shared layer. */
  const placed = (geometry?: THREE.BufferGeometry): THREE.BufferGeometry | undefined => {
    const result = geometry?.translate(planFrame.center.x, 0, planFrame.center.z);
    return magnify ? result?.translate(-origin.x, 0, -origin.z).scale(factor, factor, factor).translate(origin.x, 0, origin.z) : result;
  };

  function rebuild(): void {
    if (options.sliced) { job = planCitySteps(spec, planFrame, { ...settings, exclusions: [...(settings.exclusions ?? [])] }); return; }
    plan = planCity(spec, planFrame, settings);
    commit();
  }

  function commit(): void {
    const near = new Map<string, KitInstance[]>(), mid = new Map<string, KitInstance[]>();
    const push = (map: Map<string, KitInstance[]>, key: string, value: KitInstance): void => { const list = map.get(key); if (list) list.push(value); else map.set(key, [value]); };
    ([["wall", plan.walls], ["tower", plan.towers], ["gate", plan.gates]] as [string, Placement[]][]).forEach(([key, list]) => list.forEach(p => {
      const value = instance(p);
      push(near, key, value); push(mid, key, value);
    }));
    // The mid level thins the ranked list evenly to `caps.mid`, so every
    // district keeps its density instead of the lowest-ranked emptying.
    const share = Math.min(1, caps.mid / Math.max(1, plan.houses.length));
    plan.houses.forEach((house, rank) => {
      const value = instance(house);
      push(near, `house-${house.kit}`, value);
      if (Math.floor((rank + 1) * share) > Math.floor(rank * share)) push(mid, `house-${house.kit}`, value);
    });
    lists = { near, mid };
    levels.forEach(level => statics[level]?.dispose());
    const exclusions = settings.exclusions ?? [];
    statics = {
      far: placed(silhouetteGeometry(spec, plan, exclusions, caps.farBlocks, keepGeometry(plan, id, false))),
      mid: placed(landmarkGeometry(spec, plan, false, keepGeometry(plan, id, false))),
      near: options.tier == "low" ? undefined : placed(landmarkGeometry(spec, plan, true, keepGeometry(plan, id, true)))
    };
    pool.setPlace(place, lists, shown ? lodOf(current) : undefined, shown ? statics[effective(current)] : undefined);
    if (own) pool.flush();
  }

  function apply(): void {
    pool.setDetail(place, shown ? lodOf(current) : undefined, shown ? statics[effective(current)] : undefined);
    if (own) pool.flush();
  }

  /** Standalone cost of a level (as if no other place shared the pool). */
  function stats(level = current): CityStats {
    const resolved = effective(level);
    const lod = lodOf(level);
    const houses = lod ? Array.from(lists[lod].entries()).filter(([key]) => key.startsWith("house-")).reduce((sum, [, list]) => sum + list.length, 0) : 0;
    let tris = triangles(statics[resolved]), draws = statics[resolved] ? 1 : 0, instances = 0;
    if (lod) lists[lod].forEach((list, key) => {
      if (!list.length) return;
      draws++;
      instances += list.length;
      tris += pool.triangles(`${key}:${lod}`) * list.length;
    });
    return { detail: level, triangles: Math.round(tris), drawCalls: draws, instances, houses };
  }

  rebuild();

  return {
    id, root, frame,
    setDetail(level: CityDetail): void { if (disposed || level == current) return; current = level; apply(); },
    detail: () => current,
    setVisible(visible: boolean): void { if (disposed || visible == shown) return; shown = visible; apply(); },
    visible: () => shown,
    setExclusions(exclusions: CityExclusion[]): void {
      if (disposed) return;
      settings.exclusions = [...exclusions];
      rebuild();
    },
    setSeason(dusk: boolean, winter: boolean, full: boolean): void { pool.setSeason(dusk, winter, full); },
    stats,
    pending: () => !!job,
    advance(deadline: number): boolean {
      if (disposed || !job) return false;
      do {
        const next = job.next();
        if (next.done) { job = undefined; plan = next.value; commit(); return true; }
      } while (performance.now() < deadline);
      return false;
    },
    gates(): CityGate[] {
      return plan.gates.map(gate => {
        const at = toWorld(gate.x + planFrame.center.x, gate.z + planFrame.center.z);
        return { name: gate.name, position: new THREE.Vector3(at.x, gate.y * factor, at.z), outward: gate.outward };
      });
    },
    lodRegistration(): CityLodRegistration {
      const costs = levels.map(level => stats(level));
      const ground = plan.walls.length ? plan.walls.reduce((sum, wall) => sum + wall.y, 0) / plan.walls.length * factor : 0;
      return {
        id: place,
        center: { x: frame.center.x, y: ground, z: frame.center.z },
        radius: frame.radius * 1.35,
        // Projected sphere diameter in px. Near is meant for one city at a time.
        levels: costs.map((cost, i) => ({ minPixels: [0, 180, 560][i], drawCalls: cost.drawCalls, triangles: cost.triangles })),
        priority: 2,
        apply(level: number): void {
          shown = level >= 0;
          if (level >= 0) current = levels[Math.min(2, level)];
          apply();
        }
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      job = undefined;
      root.parent?.remove(root);
      pool.removePlace(place);
      if (own) pool.dispose();
      levels.forEach(level => statics[level]?.dispose());
      root.clear();
    }
  };
}

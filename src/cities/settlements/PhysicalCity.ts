import { hillHeight, TerrainHill } from "../../core/HillProfile";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import CastleBuilder from "../../castles/CastleBuilder";
import KitPool, { KitFade, KitInstance, KitLevel, KitLists } from "../../core/KitPool";
import { gateSpan, kitBits, palisadeHeight, towerHeight, towerSize, wallHeight, wallLength, wallThickness } from "./CityKit";
import { landmarkPart, staticGeometry, treePart } from "./CityParts";
import { roofTileBit } from "./PhysicalMaterial";
import { blockInstance, houseLotInstance } from "./PhysicalKit";
import { PhysicalPlan, planPhysicalCity, PlannedHouse, PlannedPiece } from "./PhysicalLayout";
import { PhysicalRecipe } from "../../presets/physicalCities";
import { inside } from "./plane";
import { CityTier, Vec2 } from "./types";

// World ×20 physical city (k = 20 only): plans in slices, then hands the
// shared kit pool one place per 250 m cell. Each cell is drawn at its own
// level by camera distance — near (full kit), mid (simplified kit) or far
// (roof-only roofscape tiles) — so a walk through the capital draws the
// street at full detail and the rest of the city as simplified houses and
// rows of roofs, with the same handful of pool draws. Static public scenery:
// no picking; formations only hide the houses they stand on.

/** Physical metres per scene unit. */
const M = 50;
/** LOD cell edge (m). */
const CELL = 250;

/**
 * Roofscape tile edges (m), fine (far ring) and coarse (beyond), and curtain
 * pieces merged per far block (fine / coarse), per tier: Balanced trades
 * ridge density for the far ceiling (design §4.1: 25 k).
 */
const ROOFSCAPE: Record<"high" | "balanced", { fine: number; coarse: number; fineRun: number; run: number }> = {
  high: { fine: 40, coarse: 80, fineRun: 1, run: 4 },
  balanced: { fine: 56, coarse: 110, fineRun: 3, run: 6 }
};

/**
 * Ring radii (m) per tier: near (full kit) / mid (simplified) / far (fine
 * roofscape tiles); beyond `far` the coarse tiles; beyond `hide` nothing
 * (the tiles fade out over the last 30 %). Triangle cap for near+mid
 * (design §4.1 kits).
 */
export const physicalRings: Record<"high" | "balanced", { near: number; mid: number; far: number; hide: number; triangles: number }> = {
  high: { near: 300, mid: 1400, far: 3500, hide: 20000, triangles: 220000 },
  balanced: { near: 150, mid: 800, far: 2400, hide: 12000, triangles: 95000 }
};

export interface PhysicalCityOptions {
  mountHills?(hills: readonly TerrainHill[]): () => void;
  recipe: PhysicalRecipe;
  host: string;
  tier: CityTier;
  pool: KitPool;
  /** Host region polygon, scene XZ. */
  boundary: Vec2[];
  /** Castle sculpt (scene): anchor and footprint half extents. */
  castle?: { x: number; z: number; hw: number; hd: number };
  /** Permanent clear discs (scene): unit slots, other castles. */
  reserves: { x: number; z: number; r: number }[];
  /** P3·C2 data for the host castle: hero discs to keep clear (scene) and whether a physical complex stands. */
  complex?: (force: boolean) => { discs: { x: number; z: number; r: number }[]; complex: boolean; hill?: TerrainHill } | undefined;
  /** Absolute terrain height (scene units) at scene XZ, and the rendered grids. */
  heightAt(x: number, z: number): number;
  groundAt?(x: number, z: number): number[];
  water(x: number, z: number): boolean;
  /** Signed physical metres to the terrain clip's ocean shoreline. */
  shore?(x: number, z: number): number;
  /** Unique across a live replacement and the outgoing city. */
  placePrefix?: string;
}

interface Entry { instance: KitInstance; variant: string; x: number; z: number; r: number; ground?: number; far?: KitInstance; house?: PlannedHouse; piece?: PlannedPiece }

interface Cell {
  key: string;
  place: string;
  box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  entries: Entry[];
  level?: KitLevel;
  /** Far level drawn as the coarse roofscape (one block per 50 m tile). */
  coarse: boolean;
  /** Pool lists with fine and coarse far blocks. */
  lists?: { fine: KitLists; coarse: KitLists };
  /** Triangles of the drawn lists per level (for the budget governor). */
  cost: Record<KitLevel, number>;
  transition?: { place: string; until: number };
}

export interface PhysicalCityStats { id: string; houses: number; candidates: number; cells: Record<string, number>; triangles: number; pending: boolean }

export default class PhysicalCity {
  readonly id: string;
  /** Scene origin of the plan (keep or coastal centre); set once planned. */
  origin?: { x: number; z: number };
  plan?: PhysicalPlan;
  private removeHills?: () => void;
  private job?: Generator<void, void, void>;
  private reseatJob?: Generator<void, void, void>;
  private cells = new Map<string, Cell>();
  private shown = true;
  private hidden = new Set<Entry>();
  private exclusions: { x: number; z: number; r: number }[] = [];
  private staticGeometry?: THREE.BufferGeometry;
  /** Far static layer: landmarks at mid detail, KL pier decks; no piles or trees. */
  private staticFar?: THREE.BufferGeometry;
  private staticOn = false;
  private staticNear = true;
  private staticTransition?: { until: number };
  private disposed = false;
  /** Next house the stale check samples. */
  private staleCursor = 0;
  private houseSeats: Entry[] = [];
  /** Hero discs of the host castle (scene), kept clear by the plan and the centre search. */
  private heroes: { x: number; z: number; r: number }[] = [];
  private cityFade?: KitFade;
  private cityFadeUntil = 0;

  constructor(private options: PhysicalCityOptions) {
    this.id = options.recipe.id;
    this.job = this.build();
  }

  pending(): boolean { return !!this.job; }
  workPending(): boolean { return !!this.job || !!this.reseatJob; }

  /**
   * The ground moved under the city after it was planned (late terrain
   * stamps): of the next 96 houses (a cursor walks the whole plan over
   * successive checks), 3 whose sampled ground differs from the ground used
   * for their seats by more than 2.5 m (plus a quarter of the eave), or one
   * by more than 8 m. Cheap (96 height samples).
   */
  stale(): boolean {
    const plan = this.plan, origin = this.origin;
    if (!plan || !origin || this.job || this.reseatJob || !this.houseSeats.length) return false;
    let off = 0, far = false;
    for (let k = 0; k < Math.min(96, this.houseSeats.length); k++) {
      const entry = this.houseSeats[this.staleCursor++ % this.houseSeats.length], h = entry.house as PlannedHouse;
      const delta = Math.abs(this.options.heightAt(entry.x, entry.z) * M - (entry.ground ?? h.y));
      if (delta > 2.5 + h.h * 0.25) off++;
      if (delta > 8 + h.h * 0.25) far = true;
    }
    return off >= 3 || far;
  }

  /** Plans/commits until `deadline` (performance.now ms); true once the city is ready. */
  advance(deadline: number): boolean {
    if (this.disposed) return false;
    const job = this.job ?? this.reseatJob;
    if (!job) return false;
    do {
      if (job.next().done) {
        if (job == this.job) this.job = undefined;
        else this.reseatJob = undefined;
        return true;
      }
    } while (performance.now() < deadline);
    return false;
  }

  /** Move already-planned seats onto a revised heightfield without removing the city. */
  reseat(): void { if (this.plan && !this.workPending()) this.reseatJob = this.reseatSteps(); }

  /** Set a GPU-timed cross-fade for every cell and the merged static layer. */
  setCityFade(fade: KitFade): void {
    this.cityFade = fade;
    this.cityFadeUntil = fade[2] + 250;
    this.cells.forEach(cell => {
      this.options.pool.setFade(cell.place, fade, true);
      if (cell.transition) this.options.pool.setFade(cell.transition.place, fade, true);
    });
    this.options.pool.setFade(this.staticPlace(), fade, true);
    if (this.staticTransition) this.options.pool.setFade(this.staticOutPlace(), fade, true);
  }

  visible(): boolean { return this.shown; }

  setVisible(visible: boolean): void {
    if (visible == this.shown) return;
    this.shown = visible;
    if (!visible) {
      this.cells.forEach(cell => {
        cell.level = undefined;
        this.options.pool.setDetail(cell.place, undefined, undefined);
        if (cell.transition) { this.options.pool.removePlace(cell.transition.place); cell.transition = undefined; }
      });
      this.setStatic(false);
      this.options.pool.removePlace(this.staticOutPlace());
      this.staticTransition = undefined;
    }
  }

  /** Visible formations (scene discs): the houses and pieces under them are hidden, nothing re-plans. */
  setExclusions(discs: { x: number; z: number; r: number }[]): void {
    this.exclusions = discs;
    if (!this.plan) return;
    const hidden = new Set<Entry>();
    this.cells.forEach(cell => cell.entries.forEach(entry => {
      if (discs.some(d => Math.hypot(d.x - entry.x, d.z - entry.z) < d.r + entry.r)) hidden.add(entry);
    }));
    const changed = new Set<Cell>();
    this.cells.forEach(cell => cell.entries.forEach(entry => { if (hidden.has(entry) != this.hidden.has(entry)) changed.add(cell); }));
    this.hidden = hidden;
    changed.forEach(cell => this.publish(cell));
  }

  /**
   * Per rendered frame: each cell's level from the eye distance, with 15 %
   * hysteresis, shrinking the rings ×0.8 while near+mid exceed the tier's
   * triangle cap. Returns true when a level changed.
   */
  update(camera: THREE.PerspectiveCamera, rings: { near: number; mid: number; far: number; hide: number; triangles: number }, now = performance.now()): boolean {
    if (!this.shown || this.job || this.disposed) return false;
    const eye = camera.position;
    let changed = false;
    this.cells.forEach(cell => {
      if (cell.transition && now >= cell.transition.until) {
        this.options.pool.removePlace(cell.transition.place);
        cell.transition = undefined;
        this.options.pool.setFade(cell.place, undefined);
        changed = true;
      }
    });
    if (this.staticTransition && now >= this.staticTransition.until) {
      this.options.pool.removePlace(this.staticOutPlace());
      this.options.pool.setFade(this.staticPlace(), undefined);
      this.staticTransition = undefined;
      changed = true;
    }
    const distances = new Map<Cell, number>();
    this.cells.forEach(cell => {
      const b = cell.box;
      const dx = Math.max(0, b.minX - eye.x, eye.x - b.maxX), dy = Math.max(0, b.minY - eye.y, eye.y - b.maxY), dz = Math.max(0, b.minZ - eye.z, eye.z - b.maxZ);
      distances.set(cell, Math.hypot(dx, dy, dz) * M);
    });
    let near = rings.near;
    // A representative 8 m house below six pixels resolves as a roof tile.
    const focalPx = Math.max(1, window.innerHeight) / (2 * Math.tan(camera.fov * Math.PI / 360));
    let mid = Math.min(rings.mid, 8 * focalPx / 6);
    const pick = (cell: Cell, distance: number): KitLevel | undefined => {
      const keep = (level: KitLevel): number => cell.level == level ? 1.15 : 1;
      if (distance > rings.hide * keep("far")) return undefined;
      return distance < near * keep("near") ? "near" : distance < mid * keep("mid") ? "mid" : "far";
    };
    let levels = new Map<Cell, KitLevel | undefined>();
    for (let attempt = 0; attempt < 6; attempt++) {
      levels = new Map();
      let triangles = 0;
      distances.forEach((distance, cell) => {
        const level = pick(cell, distance);
        levels.set(cell, level);
        if (level == "near" || level == "mid") triangles += cell.cost[level];
      });
      if (triangles <= rings.triangles) break;
      near *= 0.8; mid *= 0.8;
    }
    levels.forEach((level, cell) => {
      const distance = distances.get(cell) ?? 0;
      const coarse = level == "far" && distance > rings.far * (cell.coarse ? 1 / 1.15 : 1);
      if (level == cell.level && coarse == cell.coarse) return;
      if (cell.transition || (cell.level && now < this.cityFadeUntil)) return;
      // Keep the old level visible until the replacement owns its dithered pixels.
      if (cell.level && cell.lists && !cell.transition) {
        const outgoing = `${cell.place}:out`;
        this.options.pool.setPlace(outgoing, cell.coarse ? cell.lists.coarse : cell.lists.fine, cell.level, undefined);
        this.options.pool.setFade(outgoing, [1, 0, now, -250]);
        if (this.cityFade) this.options.pool.setFade(outgoing, this.cityFade, true);
        cell.transition = { place: outgoing, until: now + 250 };
      }
      if (coarse != cell.coarse && cell.lists) {
        cell.coarse = coarse;
        cell.level = level;
        this.options.pool.setPlace(cell.place, coarse ? cell.lists.coarse : cell.lists.fine, level, undefined);
      } else {
        cell.level = level;
        this.options.pool.setDetail(cell.place, level, undefined);
      }
      if (cell.transition) this.options.pool.setFade(cell.place, [0, 1, now, 250]);
      changed = true;
    });
    const anyShown = Array.from(this.cells.values()).some(cell => cell.level);
    const close = Array.from(this.cells.values()).some(cell => cell.level == "near" || cell.level == "mid");
    if (anyShown != this.staticOn || (anyShown && close != this.staticNear && !this.staticTransition)) {
      if (anyShown && this.staticOn && close != this.staticNear) {
        const old = this.staticNear ? this.staticGeometry : this.staticFar ?? this.staticGeometry;
        if (old) {
          this.options.pool.setPlace(this.staticOutPlace(), {}, undefined, old);
          this.options.pool.setFade(this.staticOutPlace(), [1, 0, now, -250]);
          if (this.cityFade) this.options.pool.setFade(this.staticOutPlace(), this.cityFade, true);
          this.staticTransition = { until: now + 250 };
        }
      }
      this.staticNear = close;
      this.setStatic(anyShown);
      if (this.staticTransition) this.options.pool.setFade(this.staticPlace(), [0, 1, now, 250]);
      changed = true;
    }
    return changed;
  }

  stats(): PhysicalCityStats {
    const cells: Record<string, number> = { near: 0, mid: 0, far: 0, hidden: 0 };
    let triangles = 0;
    this.cells.forEach(cell => {
      cells[cell.level ?? "hidden"]++;
      if (cell.level) triangles += cell.cost[cell.level];
    });
    return { id: this.id, houses: this.plan?.houses.length ?? 0, candidates: this.plan?.candidates ?? 0, cells, triangles, pending: !!this.job };
  }

  /** City gates (scene XZ just outside the threshold) for road endpoints. */
  gates(): { name: string; x: number; z: number }[] {
    const origin = this.origin;
    if (!origin || !this.plan) return [];
    return this.plan.gates.map(gate => ({ name: gate.name, x: origin.x + gate.x / M, z: origin.z + gate.z / M }));
  }

  /** The city area (scene XZ polygon) the composer leaves to the city. */
  area(): Vec2[] {
    const origin = this.origin;
    return origin && this.plan ? this.plan.area.map(([x, z]) => [origin.x + x / M, origin.z + z / M] as Vec2) : [];
  }

  dispose(): void {
    if (this.disposed) return;
    this.removeHills?.();
    this.disposed = true;
    this.job = undefined;
    this.reseatJob = undefined;
    this.cells.forEach(cell => this.options.pool.removePlace(cell.place));
    this.cells.forEach(cell => { if (cell.transition) this.options.pool.removePlace(cell.transition.place); });
    this.options.pool.removePlace(this.staticPlace());
    this.options.pool.removePlace(this.staticOutPlace());
    this.staticGeometry?.dispose();
    this.staticFar?.dispose();
    this.cells.clear();
    this.houseSeats = [];
  }

  private prefix(): string { return this.options.placePrefix ?? `pcity:${this.id}`; }
  private staticPlace(): string { return `${this.prefix()}:static`; }
  private staticOutPlace(): string { return `${this.prefix()}:static:out`; }

  private setStatic(on: boolean): void {
    const geometry = this.staticNear ? this.staticGeometry : this.staticFar ?? this.staticGeometry;
    this.staticOn = on && this.shown && !!geometry;
    if (this.staticOn) {
      this.options.pool.setPlace(this.staticPlace(), {}, undefined, geometry);
      if (this.cityFade && performance.now() < this.cityFadeUntil) this.options.pool.setFade(this.staticPlace(), this.cityFade, true);
    }
    else this.options.pool.removePlace(this.staticPlace());
  }

  /** Re-lists one cell for the pool (hidden entries dropped, far roofscape regrouped). */
  private publish(cell: Cell): void {
    const near = new Map<string, KitInstance[]>(), walls: KitInstance[] = [], coarseWalls: KitInstance[] = [];
    const push = (key: string, value: KitInstance): void => { const list = near.get(key); if (list) list.push(value); else near.set(key, [value]); };
    // Far roofscape: roof-only tiles over the visible houses of each fine
    // (far ring) or coarse patch (ROOFSCAPE); curtain pieces stay blocks,
    // merged `run` pieces at a time when coarse; towers and gates as they are.
    const fine = new Map<string, Entry[]>(), coarse = new Map<string, Entry[]>(), runs = new Map<string, Entry[]>();
    const { fine: fineEdge, coarse: coarseEdge, fineRun, run } = ROOFSCAPE[this.options.tier == "high" ? "high" : "balanced"];
    const group = (map: Map<string, Entry[]>, key: string, entry: Entry): void => { const list = map.get(key); if (list) list.push(entry); else map.set(key, [entry]); };
    cell.entries.forEach(entry => {
      if (this.hidden.has(entry)) return;
      push(entry.variant, entry.instance);
      if (entry.far) {
        if (entry.piece?.run) group(runs, entry.piece.run, entry); else { walls.push(entry.far); coarseWalls.push(entry.far); }
        return;
      }
      group(fine, `${Math.floor(entry.x * M / fineEdge)}:${Math.floor(entry.z * M / fineEdge)}`, entry);
      group(coarse, `${Math.floor(entry.x * M / coarseEdge)}:${Math.floor(entry.z * M / coarseEdge)}`, entry);
    });
    runs.forEach(list => {
      for (let i = 0; i < list.length; i += fineRun) walls.push(fineRun == 1 ? list[i].far as KitInstance : wallRun(list.slice(i, i + fineRun)));
      for (let i = 0; i < list.length; i += run) coarseWalls.push(wallRun(list.slice(i, i + run)));
    });
    const tiles = (map: Map<string, Entry[]>, fill: number): KitInstance[] => Array.from(map.values(), list => roofTile(list, fill, fill == 0.9));
    const lists: KitLists = { near, mid: near, far: new Map([["block", walls], ["roofs", tiles(fine, 0.94)]]) };
    cell.lists = { fine: lists, coarse: { near, mid: near, far: new Map([["block", coarseWalls], ["roofs", tiles(coarse, 0.9)]]) } };
    const tris = (level: KitLevel): number => {
      let sum = 0;
      lists[level]?.forEach((list, key) => { if (list.length) sum += this.options.pool.triangles(key.includes(":") ? key : `${key}:${level}`) * list.length; });
      return sum;
    };
    cell.cost = { near: tris("near"), mid: tris("mid"), far: tris("far") };
    this.options.pool.setPlace(cell.place, cell.coarse ? cell.lists.coarse : lists, this.shown ? cell.level : undefined, undefined);
    if (this.cityFade && performance.now() < this.cityFadeUntil) this.options.pool.setFade(cell.place, this.cityFade, true);
  }

  private *build(): Generator<void, void, void> {
    const o = this.options, recipe = o.recipe;
    // P3·C2's seat data; a hero seat waits (≤ 240 slices) for the live plan, then plans it here.
    let c2 = o.complex?.(false);
    for (let wait = 0; o.complex && !c2; wait++) { yield; c2 = o.complex(wait >= 240); }
    this.heroes = c2?.discs ?? [];
    yield;
    // ---- City centre: the keep, or the best coastal ground near it.
    let origin = o.castle && recipe.centre == "keep" ? { x: o.castle.x, z: o.castle.z } : undefined;
    if (!origin) origin = yield* this.coastalCentre();
    if (!origin) return;
    this.origin = origin;
    const at = origin;
    const local = (x: number, z: number): Vec2 => [(x - at.x) * M, (z - at.z) * M];
    const scene = (x: number, z: number): Vec2 => [at.x + x / M, at.z + z / M];
    const keepHill = c2?.hill;
    const plan = yield* planPhysicalCity({
      recipe, tier: o.tier,
      hills: keepHill ? [keepHill].map(h => ({ ...h, x: (h.x - at.x) * M, z: (h.z - at.z) * M, top: h.top * M, radius: h.radius * M, crown: h.crown * M })) : [],
      boundary: o.boundary.map(([x, z]) => local(x, z)),
      keep: o.castle ? { x: (o.castle.x - at.x) * M, z: (o.castle.z - at.z) * M, hw: o.castle.hw * M, hd: o.castle.hd * M } : undefined,
      height: (x, z) => { const [sx, sz] = scene(x, z); return o.heightAt(sx, sz) * M; },
      ground: o.groundAt ? (x, z) => { const [sx, sz] = scene(x, z); return (o.groundAt?.(sx, sz) ?? []).map(y => y * M); } : undefined,
      water: (x, z) => { const [sx, sz] = scene(x, z); return o.water(sx, sz); },
      shore: o.shore ? (x, z) => { const [sx, sz] = scene(x, z); return o.shore?.(sx, sz) ?? 0; } : undefined,
      reserves: [...o.reserves, ...this.heroes].map(r => { const [x, z] = local(r.x, r.z); return { x, z, r: r.r * M }; }),
      complex: !!c2?.complex
    });
    if (this.disposed) return;
    this.plan = plan;
    this.mountHills();
    yield;
    // ---- Instances into 250 m cells.
    const cellOf = (x: number, z: number): Cell => {
      const key = `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;
      let cell = this.cells.get(key);
      if (!cell) {
        cell = { key, place: `${this.prefix()}:${key}`, entries: [], cost: { near: 0, mid: 0, far: 0 }, coarse: false,
          box: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity } };
        this.cells.set(key, cell);
      }
      return cell;
    };
    const grow = (cell: Cell, x: number, z: number, r: number, y0: number, y1: number): void => {
      const b = cell.box;
      b.minX = Math.min(b.minX, x - r); b.maxX = Math.max(b.maxX, x + r); b.minZ = Math.min(b.minZ, z - r); b.maxZ = Math.max(b.maxZ, z + r);
      b.minY = Math.min(b.minY, y0); b.maxY = Math.max(b.maxY, y1);
    };
    const snow = recipe.palette.snow;
    let slice = performance.now();
    for (let index = 0; index < plan.houses.length; index++) {
      const house = plan.houses[index];
      const [x, z] = scene(house.x, house.z);
      const lot = houseLotInstance({ x, y: house.y / M, z, yaw: house.yaw, w: house.w, d: house.d, h: house.h, family: house.family, foundation: house.foundation,
        wall: house.wall, roof: house.roof, snow, ridge: house.ridge, dome: house.dome, finish: house.finish });
      const cell = cellOf(house.x, house.z);
      const r = Math.hypot(house.w, house.d) / 2 / M;
      const entry: Entry = { instance: lot.instance, variant: lot.variant, x, z, r, house, ground: o.heightAt(x, z) * M };
      cell.entries.push(entry);
      this.houseSeats.push(entry);
      grow(cell, x, z, r, house.y / M, (house.y + house.h + lot.ridgeM) / M);
      if ((index & 63) == 63 && performance.now() - slice > 2.5) { yield; slice = performance.now(); }
    }
    yield;
    const capRoof = rgbOf(recipe.id == "winterfell" ? "#4e5354" : recipe.palette.stone);
    const roofscape = rgbOf(Object.values((recipe.distantPalette ?? recipe.palette).roofs).flat()[0] ?? recipe.palette.stone);
    plan.pieces.forEach(piece => {
      const [x, z] = scene(piece.x, piece.z);
      const instance = pieceInstance(piece, x, z, piece.palisade ? kitBits.palisade : recipe.stoneMask, capRoof, snow);
      const cell = cellOf(piece.x, piece.z);
      const r = Math.max(piece.length, piece.thickness) / 2 / M;
      const far = blockInstance(x, piece.y / M, z, piece.yaw, piece.length, piece.palisade ? 0.8 : piece.thickness, piece.height * (piece.palisade ? 0.8 : 1), 0, piece.foundation, piece.wall, capRoof, snow);
      // Thin bright curtains converge toward the roofscape palette at distance.
      far.wall = roofscape;
      far.roof = roofscape;
      cell.entries.push({ instance, variant: piece.kind, x, z, r, far, piece, ground: o.heightAt(x, z) * M });
      grow(cell, x, z, r, piece.y / M, (piece.y + piece.height) / M);
    });
    for (const cell of this.cells.values()) { this.publish(cell); yield; }
    // ---- Static layer: landmarks, godswood, harbor, moat (one merged geometry).
    this.staticGeometry = yield* this.staticLayer(plan, scene, true);
    this.staticFar = yield* this.staticLayer(plan, scene, false);
    if (this.exclusions.length) this.setExclusions(this.exclusions);
  }

  private mountHills(): void {
    this.removeHills?.();
    const origin = this.origin;
    if (!origin || !this.plan?.hills) return;
    this.removeHills = this.options.mountHills?.(this.plan.hills.filter(h => this.plan?.landmarks.some(l => l.x == h.x && l.z == h.z)).map(h => ({
      x: origin.x + h.x / M, z: origin.z + h.z / M, top: h.top / M, crown: h.crown / M, radius: h.radius / M
    })));
  }

  private *reseatSteps(): Generator<void, void, void> {
    const plan = this.plan, origin = this.origin;
    if (!plan || !origin) return;
    const ground = (x: number, z: number): number => this.options.heightAt(origin.x + x / M, origin.z + z / M) * M;
    // Each cell remains drawn while its old seats are updated; publishing a
    // cell replaces only its matrices, never the city or its place in the pool.
    for (const cell of this.cells.values()) {
      for (const entry of cell.entries) {
        const seat = entry.house ?? entry.piece;
        if (!seat) continue;
        const nextGround = ground(seat.x, seat.z);
        const previousGround = entry.ground ?? seat.y;
        const delta = hillHeight(plan.hills ?? [], seat.x, seat.z, nextGround) - hillHeight(plan.hills ?? [], seat.x, seat.z, previousGround);
        entry.ground = nextGround;
        if (Math.abs(delta) < 0.05) continue;
        seat.y += delta;
        entry.instance.y += delta / M;
        if (entry.far) entry.far.y += delta / M;
      }
      const base = cell.entries.map(entry => entry.instance.y);
      if (base.length) { cell.box.minY = Math.min(...base); cell.box.maxY = Math.max(...base) + 1; }
      this.publish(cell);
      yield;
    }
    for (const landmark of plan.landmarks) {
      // KL crowns stay fixed while terrain LOD changes their surrounding slopes.
      if (this.options.recipe.id != "kings-landing") landmark.y = ground(landmark.x, landmark.z);
    }
    this.mountHills();
    for (const tree of plan.trees) tree.y = ground(tree.x, tree.z);
    const scene = (x: number, z: number): Vec2 => [origin.x + x / M, origin.z + z / M];
    const near = yield* this.staticLayer(plan, scene, true);
    const far = yield* this.staticLayer(plan, scene, false);
    if (this.disposed) { near?.dispose(); far?.dispose(); return; }
    const oldNear = this.staticGeometry, oldFar = this.staticFar;
    this.staticGeometry = near;
    this.staticFar = far;
    this.setStatic(this.staticOn);
    oldNear?.dispose(); oldFar?.dispose();
    this.staleCursor = 0;
  }

  /** Coastal centre (the port city, the old city, …): land-rich ground by the water, `coast` metres from the castle. */
  private *coastalCentre(): Generator<void, { x: number; z: number } | undefined, void> {
    const o = this.options, recipe = o.recipe;
    if (recipe.centre == "keep") return o.castle ? { x: o.castle.x, z: o.castle.z } : undefined;
    const [d0, d1] = recipe.centre.coast;
    const xs = o.boundary.map(p => p[0]), zs = o.boundary.map(p => p[1]);
    const anchor = o.castle ?? { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
    const step = 80 / M, disc = recipe.radius * 0.7 / M;
    // Sea surface: the lowest height over water around the castle (the
    // sampler keeps the sea datum offshore).
    let sea = Infinity;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step * 2) for (let z = Math.min(...zs); z <= Math.max(...zs); z += step * 2) if (o.water(x, z)) sea = Math.min(sea, o.heightAt(x, z));
    if (!Number.isFinite(sea)) sea = 0;
    yield;
    let best: { x: number; z: number; score: number } | undefined;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += step) {
        const distance = Math.hypot(x - anchor.x, z - anchor.z) * M;
        if (distance < d0 || distance > d1 || !inside(o.boundary, x, z) || o.water(x, z) || this.heroes.some(d => Math.hypot(x - d.x, z - d.z) < d.r)) continue;
        let land = 0, low = 0, total = 0, shore = false;
        for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) {
          const px = x + u * disc / 3, pz = z + v * disc / 3;
          if (u * u + v * v > 9) continue;
          total++;
          const dry = inside(o.boundary, px, pz) && !o.water(px, pz) && !this.heroes.some(d => Math.hypot(px - d.x, pz - d.z) < d.r);
          if (dry) { land++; if ((o.heightAt(px, pz) - sea) * M < 45) low++; }
          else if (u * u + v * v <= 2 && o.water(px, pz)) shore = true;
        }
        // Low, wide, dry ground by the water: a harbor town, not a cliff top.
        const score = (low * 0.6 + land * 0.4) / total + (shore ? 0.3 : 0) - Math.abs(distance - (d0 + d1) / 2) / 4000;
        if (!best || score > best.score) best = { x, z, score };
      }
      yield;
    }
    return best ? { x: best.x, z: best.z } : undefined;
  }

  private *staticLayer(plan: PhysicalPlan, scene: (x: number, z: number) => Vec2, near: boolean): Generator<void, THREE.BufferGeometry | undefined, void> {
    const recipe = this.options.recipe, style = recipe.id == "winterfell" || recipe.id == "white-harbor" ? "north" : "crownlands";
    const parts: THREE.BufferGeometry[] = [];
    for (const l of plan.landmarks) {
      const s = l.scale;
      const geometry = landmarkPart(l.kind, style, l.foundation / M / s, near, recipe.id == "kings-landing");
      scaleUv(geometry, s);
      const [x, z] = scene(l.x, l.z);
      parts.push(geometry.scale(s, s, s).rotateY(l.yaw).translate(x, l.y / M, z));
      yield;
    }
    if (near) plan.trees.forEach((t, i) => {
      const s = 10, geometry = treePart(style, t.h / M / s, t.kind, true, i);
      scaleUv(geometry, s);
      const [x, z] = scene(t.x, t.z);
      parts.push(geometry.scale(s, s, s).translate(x, t.y / M, z));
    });
    const strips = (list: PhysicalPlan["quays"], add: (b: CastleBuilder, s: PhysicalPlan["quays"][0], x: number, z: number) => void): void => {
      if (!list.length) return;
      const b = new CastleBuilder(style, false);
      list.forEach(s => { const [x, z] = scene(s.x, s.z); add(b, s, x, z); });
      parts.push(b.finish());
    };
    const trim = recipe.palette.trim;
    strips(plan.quays, (b, s, x, z) => b.add(new THREE.BoxGeometry(s.length / M, s.depth / M, s.width / M), x, (s.y - s.depth / 2) / M, z, trim, s.yaw));
    yield;
    yield;
    if (near || recipe.id == "kings-landing") strips(plan.piers, (b, s, x, z) => {
      b.add(new THREE.BoxGeometry(s.width / M, 0.8 / M, s.length / M), x, s.y / M, z, "#7a5f45", s.yaw, 2);
      // Piles under the deck.
      if (near) [-0.4, 0, 0.4].forEach(t => [-1, 1].forEach(side => b.add(new THREE.CylinderGeometry(0.25 / M, 0.25 / M, s.depth / M, 5),
        x + Math.sin(s.yaw) * t * s.length / M + Math.cos(s.yaw) * side * s.width * 0.42 / M, (s.y - s.depth / 2) / M, z + Math.cos(s.yaw) * t * s.length / M - Math.sin(s.yaw) * side * s.width * 0.42 / M, "#5c4634", 0, 2)));
    });
    yield;
    strips(plan.moat, (b, s, x, z) => {
      b.add(new THREE.BoxGeometry(s.length / M, 0.4 / M, s.width / M), x, s.y / M, z, "#3a5f6a", s.yaw, 4);
      [-1, 1].forEach(side => b.add(new THREE.BoxGeometry(s.length / M, (s.depth + 2.4) / M, 1.6 / M), x + Math.sin(s.yaw) * side * (s.width / 2 + 0.8) / M, (s.y + 1.2 - (s.depth + 2.4) / 2) / M,
        z + Math.cos(s.yaw) * side * (s.width / 2 + 0.8) / M, "#5d6461", s.yaw));
    });
    yield;
    // Bridges: a stone deck with parapets on piers every ~22 m (moat bridges: one solid span).
    strips(plan.bridges, (b, s, x, z) => {
      const along: Vec2 = [Math.sin(s.yaw), Math.cos(s.yaw)], across: Vec2 = [along[1], -along[0]], stone = recipe.palette.stone;
      b.add(new THREE.BoxGeometry(s.width / M, 1.4 / M, s.length / M), x, (s.y - 0.7) / M, z, recipe.palette.trim, s.yaw);
      [-1, 1].forEach(side => b.add(new THREE.BoxGeometry(0.6 / M, 1.1 / M, s.length / M), x + across[0] * side * (s.width / 2 - 0.3) / M, (s.y + 0.55) / M, z + across[1] * side * (s.width / 2 - 0.3) / M, stone, s.yaw));
      const piers = Math.max(0, Math.round(s.length / 22) - 1);
      if (!piers) { b.add(new THREE.BoxGeometry(s.width / M, s.depth / M, s.length / M), x, (s.y - 1.4 - s.depth / 2) / M, z, stone, s.yaw); return; }
      for (let k = 1; k <= piers; k++) {
        const t = (k / (piers + 1) - 0.5) * s.length;
        b.add(new THREE.BoxGeometry((s.width + 1.6) / M, s.depth / M, 3.2 / M), x + along[0] * t / M, (s.y - 1.4 - s.depth / 2) / M, z + along[1] * t / M, stone, s.yaw);
      }
    });
    yield;
    // The market square: worn flags and a fountain at the hub (near layer only).
    if (near) strips(plan.paving, (b, s, x, z) => b.add(new THREE.BoxGeometry(s.length / M, s.depth / M, s.width / M), x, (s.y - s.depth / 2) / M, z, trim, s.yaw));
    if (near && plan.paving.length) {
      // The fountain stands on the flag nearest the hub.
      const b = new CastleBuilder(style, false), [hx, hz] = plan.hub ?? [plan.paving[0].x, plan.paving[0].z];
      const centre = plan.paving.reduce((best, p) => Math.hypot(p.x - hx, p.z - hz) < Math.hypot(best.x - hx, best.z - hz) ? p : best, plan.paving[0]);
      const [fx, fz] = scene(centre.x, centre.z);
      b.add(new THREE.CylinderGeometry(3.4 / M, 3.6 / M, 0.9 / M, 14), fx, (centre.y + 0.45) / M, fz, recipe.palette.stone);
      b.add(new THREE.CylinderGeometry(2.9 / M, 2.9 / M, 0.12 / M, 14), fx, (centre.y + 0.86) / M, fz, "#4f6f78", 0, 3);
      b.add(new THREE.CylinderGeometry(0.5 / M, 0.7 / M, 2.4 / M, 8), fx, (centre.y + 1.6) / M, fz, recipe.palette.stone);
      parts.push(b.finish());
    }
    yield;
    // Harbour stairs on high banks: stepped stone flights down to the foot quay.
    if (near && plan.stairs.length) {
      const b = new CastleBuilder(style, false);
      plan.stairs.forEach(st => {
        const steps = Math.max(4, Math.min(40, Math.round(st.top - st.bottom))), along: Vec2 = [Math.sin(st.yaw), Math.cos(st.yaw)], [cx, cz] = scene(st.x, st.z);
        for (let k = 0; k < steps; k++) {
          const tread = st.top - (k + 0.5) * (st.top - st.bottom) / steps, foot = st.bottom - 4, t = -st.length / 2 + (k + 0.5) * st.length / steps;
          b.add(new THREE.BoxGeometry(st.width / M, (tread - foot) / M, st.length / steps / M), cx + along[0] * t / M, (tread + foot) / 2 / M, cz + along[1] * t / M, trim, st.yaw);
        }
      });
      parts.push(b.finish());
    }
    yield;
    if (!parts.length) return undefined;
    const merged = mergeGeometries(parts);
    parts.forEach(part => { if (part != merged) part.dispose(); });
    return merged ? staticGeometry(merged) : undefined;
  }
}

/** One coarse far block along consecutive curtain pieces of a run. */
function wallRun(list: Entry[]): KitInstance {
  const first = list[0].piece as PlannedPiece, last = list[list.length - 1].piece as PlannedPiece;
  const x = (list[0].x + list[list.length - 1].x) / 2, z = (list[0].z + list[list.length - 1].z) / 2;
  const length = Math.hypot(list[0].x - list[list.length - 1].x, list[0].z - list[list.length - 1].z) * M + first.length;
  const y = list.reduce((sum, e) => sum + (e.piece as PlannedPiece).y, 0) / list.length;
  const low = Math.min(...list.map(e => (e.piece as PlannedPiece).y - (e.piece as PlannedPiece).foundation));
  return blockInstance(x, y / M, z, first.yaw, length, first.palisade ? 0.8 : first.thickness, first.height * (first.palisade ? 0.8 : 1), 0, y - low, first.wall, last.wall, list[0].instance.snow);
}

function rgbOf(hex: string): [number, number, number] { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

function scaleUv(geometry: THREE.BufferGeometry, s: number): void {
  const uv = geometry.getAttribute("uv") as unknown as { count: number; getX(i: number): number; getY(i: number): number; setXY(i: number, x: number, y: number): void } | undefined;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
}

/** Curtain piece → its nominal K2 kit instance, scaled to metres. */
function pieceInstance(p: PlannedPiece, x: number, z: number, mask: number, capRoof: [number, number, number], snow: number): KitInstance {
  let sx: number, sy: number, sz: number;
  if (p.kind == "wall") {
    sx = p.length / M / wallLength;
    sy = p.height / M / (p.palisade ? wallHeight * palisadeHeight : wallHeight);
    sz = p.palisade ? 2.5 : p.thickness / M / wallThickness;
  } else if (p.kind == "tower") {
    sx = sz = p.length / M / (p.palisade ? 0.015 : towerSize);
    sy = p.height / M / (p.palisade ? wallHeight * 0.95 : towerHeight);
  } else {
    sx = p.length / M / gateSpan;
    sy = p.height / M / (p.palisade ? wallHeight : towerHeight * 1.04);
    sz = p.palisade ? 2.5 : p.thickness / M / (wallThickness + 0.008);
  }
  return { x, y: p.y / M, z, yaw: p.yaw, sx, sy, sz, depth: p.foundation / M / sy, wall: p.wall, roof: capRoof, mask, pitch: 1, snow };
}

/**
 * One roof-only roofscape tile over a patch of houses: their dominant ridge
 * axis (axial mean of the yaws), extents along it, mean eave and ridge
 * (flat for Dornish roofs), the middle house's tints; `fill` shrinks the
 * footprint so the lanes between patches still read.
 */
function roofTile(list: Entry[], fill: number, distant = false): KitInstance {
  let sin = 0, cos = 0;
  list.forEach(entry => { const yaw = (entry.house as PlannedHouse).yaw * 2; sin += Math.sin(yaw); cos += Math.cos(yaw); });
  const yaw = Math.atan2(sin, cos) / 2, c = Math.cos(yaw), s = Math.sin(yaw);
  let minA = Infinity, maxA = -Infinity, minC = Infinity, maxC = -Infinity, base = 0, height = 0, ridge = 0, low = Infinity;
  list.forEach(entry => {
    const h = entry.house as PlannedHouse;
    // Local X = (cos yaw, −sin yaw), local Z = (sin yaw, cos yaw), in metres.
    const a = entry.x * M * c - entry.z * M * s, cc = entry.x * M * s + entry.z * M * c, r = Math.max(h.w, h.d) / 2;
    minA = Math.min(minA, a - r); maxA = Math.max(maxA, a + r); minC = Math.min(minC, cc - r); maxC = Math.max(maxC, cc + r);
    base += h.y; height += h.h; low = Math.min(low, h.y - h.foundation);
    ridge += h.family == "flat-dome" ? 0 : h.ridge * Math.min(h.w, h.d);
  });
  const n = list.length;
  base /= n; height /= n; ridge /= n;
  const middle = list[Math.floor(n / 2)].house as PlannedHouse;
  const a = (minA + maxA) / 2, cc = (minC + maxC) / 2;
  const x = (a * c + cc * s) / M, z = (-a * s + cc * c) / M;
  const lengthA = Math.max(8, (maxA - minA) * fill), lengthC = Math.max(8, (maxC - minC) * fill);
  // Four ridges across the tile: each ridge no steeper than its own span allows.
  const instance = blockInstance(x, base / M, z, yaw, lengthA, lengthC, height, Math.min(ridge, lengthC / 4 * 0.6), base - low, distant ? middle.distantWall ?? middle.wall : middle.wall, distant ? middle.distantRoof ?? middle.roof : middle.roof, list[0].instance.snow);
  instance.mask = roofTileBit;
  return instance;
}

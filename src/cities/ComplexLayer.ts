import * as THREE from "three";
import type { Point } from "../core/contracts";
import { METRES_PER_UNIT, SceneFrame } from "../core/SceneFrame";
import RepresentationLod, { Representation } from "../core/RepresentationLod";
import { criticalDistance, StrategicKind, ViewMetrics } from "../core/SizeLaw";
import AssetMaterials from "../materials/AssetMaterials";
import { CastlePalette, CastleStyle } from "../castles/castleStyles";
import ComplexMaterial, { addFadeAttribute, FADE_ATTRIBUTE, HeroMaterial } from "./ComplexMaterial";
import { beaconPoint, complexGeometry, heroGeometry } from "./ComplexGeometry";
import { ComplexGround, ComplexPlan, planComplex, Volume } from "./ComplexPlan";
import IronIslandDressing from "./IronIslandDressing";
import { IronSeatPlan, planIronIslandSeats } from "./IronIslandSeats";

/** One live castle seat the layer may replace with its physical complex. */
export interface ComplexSource {
  id: string;
  kind: string;
  level: number;
  style: CastleStyle;
  palette?: Partial<CastlePalette>;
  strategic: StrategicKind;
  anchor: THREE.Vector3;
  /** Unit vector (local x, z) toward the seat's harbour or nearest sea (public slots). */
  seaward?: [number, number];
}

/** Public world queries in board pixels / scene units (fog-independent). */
export interface ComplexWorld {
  frame: SceneFrame;
  heightAt(point: Point): number;
  wetAt(point: Point): boolean;
  /** A gameplay slot, harbour or another castle within `radius` board px. */
  reservedAt(point: Point, radius: number, self: string): boolean;
  /** Inside the seat's own region polygon. */
  ownAt?(point: Point, self: string): boolean;
  /**
   * The streamed ×20 terrain has arrived (its sampler is attached). Until then
   * nothing is planned: a plan made on the provisional board-scale field would
   * differ from one made after, and plans are kept (determinism across loads).
   */
  ready?(): boolean;
}

/** Form of one castle this frame, for the miniature and its banner. */
export interface ComplexForm {
  form: Representation;
  /** Dither coverage of `form` (1 solid). */
  alpha: number;
  /** Banner seat on the physical keep (scene units), while physical. */
  banner?: THREE.Vector3;
  plan?: ComplexPlan;
}

export type ComplexTier = "high" | "balanced";

interface Built { mesh: THREE.InstancedMesh; geometry: THREE.BufferGeometry }

type Lod = "simple" | "detailed" | "hero" | "hero-detailed" | "scenery";

interface Entry {
  source: ComplexSource;
  signature: string;
  /** undefined: not planned yet; null: no complex fits (the miniature stays). */
  plan?: ComplexPlan | null;
  simple?: Built;
  detailed?: Built;
  scenery?: Built;
  sceneryPlan?: IronSeatPlan;
  dressing?: IronIslandDressing;
  hero?: THREE.Mesh;
  /** Detailed hero form, shown within HERO_DETAIL metres; `hero` is the far form. */
  heroDetail?: THREE.Mesh;
  fire?: THREE.Mesh;
  job?: { lod: Lod; steps: Generator<void, THREE.BufferGeometry | undefined, void> };
  lod: "simple" | "detailed";
  lastNear: number;
  form: ComplexForm;
}

const LIMITS: Record<ComplexTier, { physical: number; detail: number; detailed: number; shadows: boolean; budgetMs: number }> = {
  // detail: metres under which the detailed form is used; detailed: max detailed complexes kept.
  high: { physical: 4, detail: 700, detailed: 4, shadows: true, budgetMs: 5 },
  balanced: { physical: 3, detail: 380, detailed: 2, shadows: false, budgetMs: 4 }
};

/** Metres under which a hero (needles, Rock, Hightower) uses its detailed form. */
const HERO_DETAIL = 4000;

/** Kinds whose hero (needles, Rock, Hightower) is geography: always physical. */
const HERO_KINDS = new Set(["the-eyrie", "casterly-rock", "oldtown"]);

/**
 * World ×20 physical castle complexes (P3·C2). Owned by TabletopLandscape and
 * created only when the World frame has k > 1. Each castle seat gets a
 * deterministic plan (ComplexPlan) on first approach, a sliced geometry build
 * (≤ budgetMs per frame), and a board ↔ physical switch with hysteresis and a
 * 250 ms dithered cross-fade (RepresentationLod). Heroes that are geography
 * (the Eyrie's needles, Casterly Rock, the Hightower) are always physical.
 */
export default class ComplexLayer {
  readonly group = new THREE.Group();
  readonly material: ComplexMaterial;
  /** Heroes (the Rock, the needles, the Hightower): castle surfaces plus faceted rock. */
  private heroMaterial: HeroMaterial;
  private entries = new Map<string, Entry>();
  private lod = new RepresentationLod();
  private tier: ComplexTier = "high";
  private active = true;
  private fireMaterial = new THREE.MeshBasicMaterial({ color: "#ffb35c", toneMapped: false });
  private fireGeometry = new THREE.SphereGeometry(1, 10, 8);
  private world?: ComplexWorld;
  private forms = new Map<string, ComplexForm>();
  /** A caster was toggled this frame: the owner refreshes the shadow map. */
  shadowsChanged = false;

  constructor(parent: THREE.Object3D, assets?: AssetMaterials) {
    this.material = new ComplexMaterial(assets);
    this.heroMaterial = new HeroMaterial(assets);
    this.group.name = "castle-complexes";
    parent.add(this.group);
  }

  setTier(tier: ComplexTier): void {
    if (tier == this.tier) return;
    this.tier = tier;
    this.entries.forEach(entry => this.release(entry, true));
  }

  setActive(active: boolean): void {
    this.active = active;
    this.group.visible = active;
  }

  setSeason(dusk: boolean, winter: boolean, full: boolean): void {
    this.material.setSeason(dusk, winter, full);
    this.heroMaterial.setSeason(dusk, winter, full);
  }

  /** Castle seats after a landscape update. A moved or re-seated seat is re-planned lazily. */
  sync(sources: ComplexSource[], world: ComplexWorld): void {
    this.world = world;
    const seen = new Set<string>();
    sources.forEach(source => {
      seen.add(source.id);
      const signature = `${source.kind}:${source.level}:${source.anchor.x.toFixed(4)}:${source.anchor.y.toFixed(3)}:${source.anchor.z.toFixed(4)}`;
      const entry = this.entries.get(source.id);
      if (entry && entry.signature == signature) { entry.source = source; return; }
      if (entry) this.drop(entry);
      this.entries.set(source.id, { source, signature, lod: "simple", lastNear: 0, form: { form: "board", alpha: 1 } });
    });
    this.entries.forEach((entry, id) => { if (!seen.has(id)) { this.drop(entry); this.entries.delete(id); } });
  }

  /** Physical complexes' ground in local metres around a seat (public terrain only). */
  private ground(source: ComplexSource, world: ComplexWorld): ComplexGround {
    const frame = world.frame, m = 1 / METRES_PER_UNIT;
    const at = (x: number, z: number): Point => frame.boardPoint(source.anchor.x + x * m, source.anchor.z + z * m);
    return {
      height: (x, z) => (world.heightAt(at(x, z)) - source.anchor.y) * METRES_PER_UNIT,
      wet: (x, z) => world.wetAt(at(x, z)),
      reserved: (x, z, radius) => world.reservedAt(at(x, z), frame.boardLen(frame.m(radius)), source.id),
      own: world.ownAt ? (x, z) => !!world.ownAt?.(at(x, z), source.id) : undefined
    };
  }

  /** Switch distance (scene units): the complex's own height at the kind's P_c. */
  private switchDistance(entry: Entry, view: ViewMetrics): number {
    const plan = entry.plan;
    return plan ? criticalDistance(entry.source.strategic, view, plan.switchMetres / METRES_PER_UNIT) : 0;
  }

  /**
   * Plans, builds and fades complexes for this camera. Returns the form of
   * every seat (board for seats without a built complex). True in `animating`
   * while a build or a fade is still running.
   */
  render(camera: THREE.PerspectiveCamera, view: ViewMetrics, now: number, reducedMotion: boolean): { forms: Map<string, ComplexForm>; animating: boolean } {
    this.forms.clear();
    this.shadowsChanged = false;
    if (!this.active || !this.world) return { forms: this.forms, animating: false };
    const world = this.world;
    const limits = LIMITS[this.tier];
    const deadline = performance.now() + limits.budgetMs;
    let animating = false;
    this.lod.beginFrame();
    const ranked = Array.from(this.entries.values()).map(entry => ({ entry, distance: camera.position.distanceTo(entry.source.anchor) }))
      .sort((a, b) => a.distance - b.distance);
    // Plan at most one seat per frame: heroes first (seen from the map band), then by distance.
    const pending = (world.ready?.() ?? true) && ranked.find(({ entry, distance }) => entry.plan === undefined &&
      (HERO_KINDS.has(entry.source.kind) || distance < criticalDistance(entry.source.strategic, view, 120 / METRES_PER_UNIT) * 2.5));
    if (pending) {
      pending.entry.plan = planComplex({ id: pending.entry.source.id, kind: pending.entry.source.kind, level: pending.entry.source.level,
        style: pending.entry.source.style, palette: pending.entry.source.palette, seaward: pending.entry.source.seaward }, this.ground(pending.entry.source, world)) ?? null;
      if (pending.entry.source.kind == "pyke" && world.frame.k == 20) {
        const anchor = world.frame.boardPoint(pending.entry.source.anchor.x, pending.entry.source.anchor.z);
        pending.entry.sceneryPlan = planIronIslandSeats(anchor, this.ground(pending.entry.source, world));
      }
      animating = true;
    }
    let physical = 0;
    ranked.forEach(({ entry, distance }) => {
      const plan = entry.plan;
      if (!plan) { entry.form = { form: "board", alpha: 1 }; this.forms.set(entry.source.id, entry.form); return; }
      const dc = this.switchDistance(entry, view);
      const metres = distance * METRES_PER_UNIT;
      if (distance < dc * 2.2) entry.lastNear = now;
      // Hero geometry (always physical) is built as soon as the plan exists.
      if (plan.hero && !entry.hero && !entry.job) entry.job = { lod: "hero", steps: heroGeometry(plan, false) };
      const wantDetail = metres < limits.detail * (entry.lod == "detailed" ? 1.15 : 1);
      if (!entry.job && distance < dc * 1.6 && !entry.simple) entry.job = { lod: "simple", steps: complexGeometry(plan, false) };
      else if (!entry.job && wantDetail && entry.simple && !entry.detailed) entry.job = { lod: "detailed", steps: complexGeometry(plan, true) };
      else if (!entry.job && plan.hero && entry.hero && !entry.heroDetail && metres < HERO_DETAIL) entry.job = { lod: "hero-detailed", steps: heroGeometry(plan, true) };
      if (!entry.job && entry.sceneryPlan && !entry.scenery && metres < 2800) entry.job = { lod: "scenery", steps: complexGeometry(entry.sceneryPlan, true) };
      if (entry.sceneryPlan && metres < 2800 && !entry.dressing) {
        entry.dressing = new IronIslandDressing(this.ground(entry.source, world), 3.1 - entry.source.anchor.y * METRES_PER_UNIT, entry.sceneryPlan, this.material);
        entry.dressing.group.position.copy(entry.source.anchor);
        this.group.add(entry.dressing.group);
      }
      if (entry.dressing) {
        entry.dressing.group.visible = metres < 3000;
        entry.dressing.advance(deadline);
        animating = animating || !entry.dressing.ready;
      }
      if (entry.job) {
        animating = true;
        while (performance.now() < deadline) {
          const step = entry.job.steps.next();
          if (step.done) { this.attach(entry, entry.job.lod, step.value); entry.job = undefined; break; }
        }
      }
      entry.lod = wantDetail && entry.detailed ? "detailed" : "simple";
      // Board ↔ physical with hysteresis; beyond the cap the seat stays a miniature.
      const ready = !!entry.simple;
      const allowed = ready && physical < limits.physical;
      const state = ready ? this.lod.update(entry.source.id, allowed ? distance : Infinity, dc, now, reducedMotion) : { form: "board" as Representation, alpha: 1, fading: false };
      if (state.form == "physical") physical++;
      animating = animating || state.fading;
      const anchor = entry.source.anchor, m = 1 / METRES_PER_UNIT;
      entry.form = {
        form: state.form, alpha: state.alpha, plan,
        banner: state.form == "physical" ? new THREE.Vector3(anchor.x + plan.banner[0] * m, anchor.y + plan.banner[1] * m, anchor.z + plan.banner[2] * m) : undefined
      };
      this.show(entry, state.form == "physical" ? state.alpha : 0);
      if (entry.scenery) entry.scenery.mesh.visible = metres < 3000;
      // Shadow casters stay near the eye (design §4.1: casters limited): the
      // local band for complexes, 3 km for heroes. Toggling never recompiles.
      const casts = limits.shadows && metres < 600;
      [entry.simple?.mesh, entry.detailed?.mesh, entry.scenery?.mesh].forEach(mesh => { if (mesh && mesh.castShadow != casts) { mesh.castShadow = casts; this.shadowsChanged = true; } });
      if (entry.hero) {
        // Far form beyond HERO_DETAIL (×1.15 hysteresis), detailed form inside.
        const near = !!entry.heroDetail && metres < HERO_DETAIL * (entry.heroDetail.visible ? 1.15 : 1);
        entry.hero.visible = !near;
        if (entry.heroDetail) entry.heroDetail.visible = near;
        const heroCasts = limits.shadows && metres < 1500;
        [entry.hero, entry.heroDetail].forEach(mesh => { if (mesh && mesh.castShadow != (heroCasts && mesh.visible)) { mesh.castShadow = heroCasts && mesh.visible; this.shadowsChanged = true; } });
      }
      this.forms.set(entry.source.id, entry.form);
    });
    // Keep memory bounded: the farthest detailed complexes fall back to the simple form.
    const detailed = ranked.filter(({ entry }) => entry.detailed);
    detailed.slice(limits.detailed).forEach(({ entry }) => this.release(entry, false));
    ranked.forEach(({ entry }) => { if (entry.simple && now - entry.lastNear > 20000 && entry.form.form == "board") this.release(entry, true); });
    return { forms: this.forms, animating };
  }

  private attach(entry: Entry, lod: Lod, geometry: THREE.BufferGeometry | undefined): void {
    if (!geometry) return;
    if (lod == "hero" || lod == "hero-detailed") {
      const detail = lod == "hero-detailed";
      const old = detail ? entry.heroDetail : entry.hero;
      if (old) { this.group.remove(old); old.geometry.dispose(); }
      const mesh = new THREE.Mesh(geometry, this.heroMaterial);
      mesh.position.copy(entry.source.anchor);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.name = `hero:${entry.source.id}`;
      this.group.add(mesh);
      mesh.visible = !detail;
      if (detail) entry.heroDetail = mesh; else entry.hero = mesh;
      const hero = entry.plan?.hero;
      if (hero?.kind == "hightower" && !entry.fire) {
        // The beacon burns on the Hightower: public, static, no light.
        const [x, y, z] = beaconPoint(hero);
        const m = 1 / METRES_PER_UNIT;
        const fire = new THREE.Mesh(this.fireGeometry, this.fireMaterial);
        fire.position.set(entry.source.anchor.x + x * m, entry.source.anchor.y + y * m, entry.source.anchor.z + z * m);
        fire.scale.set(4.5 * m, 6.5 * m, 4.5 * m);
        this.group.add(fire);
        entry.fire = fire;
      }
      return;
    }
    addFadeAttribute(geometry, 1);
    const mesh = new THREE.InstancedMesh(geometry, this.material, 1);
    mesh.position.copy(entry.source.anchor);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.name = lod == "scenery" ? `realm-scenery:${entry.source.id}` : `complex:${entry.source.id}:${lod}`;
    if (lod == "scenery") mesh.raycast = () => undefined;
    else mesh.userData.region = entry.source.id;
    this.group.add(mesh);
    entry[lod as "simple" | "detailed" | "scenery"] = { mesh, geometry };
  }

  private show(entry: Entry, coverage: number): void {
    const visible = coverage > 0.001;
    [entry.simple, entry.detailed].forEach(built => {
      if (!built) return;
      const on = visible && (built == entry.detailed ? entry.lod == "detailed" : entry.lod == "simple" || !entry.detailed);
      if (built.mesh.visible != on) built.mesh.visible = on;
      if (!on) return;
      const fade = built.geometry.getAttribute(FADE_ATTRIBUTE) as unknown as THREE.InstancedBufferAttribute;
      if (Math.abs(fade.getX(0) - coverage) > 1e-3) { fade.setX(0, coverage); fade.needsUpdate = true; }
    });
  }

  /** Highest physical surface (scene y) over a board point: walls, towers, keeps and heroes. */
  floorAt(point: Point): number {
    const world = this.world;
    if (!world || !this.active) return -Infinity;
    const scene = world.frame.point(point);
    let floor = -Infinity;
    this.entries.forEach(entry => {
      const plan = entry.plan;
      // Only built forms are solid: a planned but undrawn complex never lifts the camera.
      if (!plan || !(entry.simple || entry.hero)) return;
      const lx = (scene.x - entry.source.anchor.x) * METRES_PER_UNIT, lz = (scene.z - entry.source.anchor.z) * METRES_PER_UNIT;
      const reach = 1200;
      if (Math.abs(lx) > reach || Math.abs(lz) > reach) return;
      const inside = (volume: Volume): void => {
        if (lx >= volume.minX && lx <= volume.maxX && lz >= volume.minZ && lz <= volume.maxZ) floor = Math.max(floor, entry.source.anchor.y + volume.top / METRES_PER_UNIT);
      };
      if (entry.hero) plan.heroVolumes.forEach(inside);
      if (entry.form.form == "physical") plan.volumes.forEach(inside);
    });
    return floor;
  }

  /** Region id of a physical complex or hero under the ray. */
  pick(raycaster: THREE.Raycaster): string | undefined {
    if (!this.active) return undefined;
    const meshes: THREE.Object3D[] = [];
    this.entries.forEach(entry => [entry.simple?.mesh, entry.detailed?.mesh, entry.hero, entry.heroDetail].forEach(mesh => { if (mesh?.visible) meshes.push(mesh); }));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return undefined;
    const name = hit.object.name;
    return name.split(":")[1];
  }

  /** Plan of a seat (tests, diagnostics, integration). */
  planOf(id: string): ComplexPlan | null | undefined {
    return this.entries.get(id)?.plan;
  }

  private release(entry: Entry, all: boolean): void {
    const drop = (built?: Built): undefined => {
      if (built) { this.group.remove(built.mesh); built.mesh.dispose(); built.geometry.dispose(); }
      return undefined;
    };
    if (entry.job && !entry.job.lod.startsWith("hero") && (all || entry.job.lod != "scenery")) entry.job = undefined;
    entry.detailed = drop(entry.detailed);
    if (all) { entry.simple = drop(entry.simple); entry.scenery = drop(entry.scenery); entry.dressing?.dispose(); entry.dressing = undefined; }
    entry.lod = "simple";
  }

  private drop(entry: Entry): void {
    this.release(entry, true);
    entry.job = undefined;
    [entry.hero, entry.heroDetail].forEach(mesh => { if (mesh) { this.group.remove(mesh); mesh.geometry.dispose(); } });
    entry.hero = entry.heroDetail = undefined;
    if (entry.fire) { this.group.remove(entry.fire); entry.fire = undefined; }
  }

  dispose(): void {
    this.entries.forEach(entry => this.drop(entry));
    this.entries.clear();
    this.group.parent?.remove(this.group);
    this.material.dispose();
    this.heroMaterial.dispose();
    this.fireMaterial.dispose();
    this.fireGeometry.dispose();
  }
}

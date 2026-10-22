import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import AssetMaterials from "../materials/AssetMaterials";
import CityMaterial from "../cities/settlements/CityMaterial";

// Global kit pool (docs/v3-realm-bible.md §1.4, §6.1): ONE InstancedMesh per
// kit variant and level of detail, shared by every place on the map. A place
// contributes instances (with per-instance tints, option mask, roof pitch and
// snow), never draws. Everything static (far silhouettes, merged landmarks,
// quays) is merged into a single mesh for all places. Draw calls therefore
// grow with the number of distinct variants on screen, not with places:
// two cities at mid distance cost the same as one.
//
// World ×20 (P3) adds, without changing k = 1:
// - a third level, "far" (the instanced roofscape `block`), next to near/mid;
// - explicit batch keys: a list key "variant:level" draws that batch whatever
//   the place's level (a far cell keeps its curtain in "wall:mid"); a bare
//   "variant" key means "variant:<the place's level>", as before;
// - the physical house API for the composer (C1) and the cities, in metres:
//   `houseLotInstance` (cities/PhysicalKit; types re-exported here) turns a
//   `HouseLot` into one instance per level. Share the World ×20 pool through
//   `WorldCities.kitPool()` and add each cell as a place:
//     pool.setPlace(`village:${cell}`, lists, level, undefined); pool.flush();
//   Draws stay per variant; see realism/cities/README.md ("World ×20").

/** Physical cities need one fewer vertex slot; k=1 retains its original attributes. */
function packPhysicalSurface(geometry: THREE.BufferGeometry): void {
  const surface = geometry.getAttribute("castleSurface"), skirt = geometry.getAttribute("castleSkirt");
  if (!skirt) return;
  const packed = new Float32Array(surface.count * 4);
  for (let i = 0; i < surface.count; i++) packed.set([surface.getX(i), surface.getY(i), surface.getZ(i), skirt.getX(i)], i * 4);
  geometry.setAttribute("castleSurface", new THREE.Float32BufferAttribute(packed, 4));
  geometry.deleteAttribute("castleSkirt");
}

export type KitLod = "near" | "mid";
/** Levels a place can be drawn at (k = 1 places only use near/mid + static). */
export type KitLevel = KitLod | "far";
/** Coverage from/to, start (ms), signed duration (negative = complementary outgoing pixels). */
export type KitFade = [number, number, number, number];
const SOLID: KitFade = [1, 1, 0, 1];
const BufferAttribute = (THREE as unknown as { BufferAttribute: new (array: Float32Array, itemSize: number) => THREE.InstancedBufferAttribute }).BufferAttribute;

export type Rgb = [number, number, number];

/** World-absolute instance. `mask` selects optional parts (see CityKit). */
export interface KitInstance {
  x: number; y: number; z: number;
  yaw: number;
  sx: number; sy: number; sz: number;
  /** Foundation skirt depth in instance-local units (castle shader contract). */
  depth: number;
  wall: Rgb;
  roof: Rgb;
  mask: number;
  /** Roof height multiplier over the variant's nominal ridge (1 = as built). */
  pitch: number;
  /** Winter snow on up-facing roofs, 0–1. */
  snow: number;
}

export interface KitVariant {
  build(lod: KitLevel): THREE.BufferGeometry;
  /** Casts shadows on High (walls, towers, gates); houses never do. */
  shadow: boolean;
}

/** Per level: list key ("variant" or "variant:level") → instances. */
export type KitLists = Partial<Record<KitLevel, Map<string, KitInstance[]>>>;

interface Batch {
  geometry: THREE.BufferGeometry;
  mesh?: THREE.InstancedMesh;
  capacity: number;
  arrays?: { depth: Float32Array; wall: Float32Array; roof: Float32Array; kit: Float32Array };
  attributes: THREE.InstancedBufferAttribute[];
  count: number;
  triangles: number;
}

interface Place {
  lod?: KitLevel;
  /** Per level: batch key ("variant:level") → what this place contributes. */
  lists: Partial<Record<KitLevel, Map<string, KitInstance[]>>>;
  /** World-absolute static geometry for the current detail (owned by the place). */
  merged?: THREE.BufferGeometry;
  fade?: KitFade;
}

export interface KitPoolStats { drawCalls: number; triangles: number; instances: number; variants: string[] }

/** Batch key of a list key at `level` (explicit "variant:level" keys win). */
function batchKey(key: string, level: KitLevel): string { return key.includes(":") ? key : `${key}:${level}`; }

export default class KitPool {
  readonly group = new THREE.Group();
  readonly material: CityMaterial;
  private batches = new Map<string, Batch>();
  private places = new Map<string, Place>();
  private dirty = new Set<string>();
  private staticDirty = false;
  private staticMesh?: THREE.Mesh;
  private disposed = false;

  /** `material`: World ×20 passes its own CityMaterial subclass (cities/PhysicalMaterial). */
  constructor(private variants: Record<string, KitVariant>, private shadows: boolean, assets?: AssetMaterials, material?: CityMaterial) {
    this.group.name = "Kit pool";
    this.material = material ?? new CityMaterial(assets);
  }

  /** Variant names this pool can draw. */
  has(variant: string): boolean { return variant in this.variants; }

  /**
   * Replaces what a place contributes. `lists` hold its instances per level
   * (near/mid, and far for World ×20 cells); only the place's current level
   * is drawn.
   */
  setPlace(id: string, lists: KitLists, lod: KitLevel | undefined, merged: THREE.BufferGeometry | undefined): void {
    const previous = this.places.get(id);
    this.touch(previous);
    const normal: Place["lists"] = {};
    (Object.keys(lists) as KitLevel[]).forEach(level => {
      const map = new Map<string, KitInstance[]>();
      lists[level]?.forEach((list, key) => {
        const batch = batchKey(key, level), existing = map.get(batch);
        map.set(batch, existing ? existing.concat(list) : list);
      });
      normal[level] = map;
    });
    this.places.set(id, { lod, lists: normal, merged, fade: previous?.fade });
    this.touch(this.places.get(id));
    if (previous?.merged || merged) this.staticDirty = true;
  }

  /** Switches a place's level (undefined = far: static layer only). */
  setDetail(id: string, lod: KitLevel | undefined, merged: THREE.BufferGeometry | undefined): void {
    const place = this.places.get(id);
    if (!place) return;
    if (place.lod != lod) { this.touch(place); place.lod = lod; this.touch(place); }
    if (place.merged != merged) { place.merged = merged; this.staticDirty = true; }
  }

  /** Physical pools only: GPU-timed dither, uploaded once at each transition boundary. */
  setFade(id: string, fade: KitFade | undefined, _city = false): void {
    const place = this.places.get(id);
    if (!place || !(this.material as CityMaterial & { kitDither?: boolean }).kitDither) return;
    place.fade = fade;
    this.touch(place);
    if (place.merged) this.staticDirty = true;
  }

  removePlace(id: string): void {
    const place = this.places.get(id);
    if (!place) return;
    this.touch(place);
    this.places.delete(id);
    if (place.merged) this.staticDirty = true;
  }

  /** Triangles of one instance of `variant:lod` (builds the geometry if needed). */
  triangles(key: string): number { return this.batch(key).triangles; }

  /** Applies pending changes; returns true when anything drawn changed. */
  flush(): boolean {
    if (this.disposed) return false;
    const changed = this.dirty.size > 0 || this.staticDirty;
    this.dirty.forEach(key => this.fill(key));
    this.dirty.clear();
    if (this.staticDirty) this.mergeStatic();
    this.staticDirty = false;
    return changed;
  }

  setSeason(dusk: boolean, winter: boolean, full: boolean): void { this.material.setSeason(dusk, winter, full); }

  stats(): KitPoolStats {
    let drawCalls = 0, triangles = 0, instances = 0;
    const variants: string[] = [];
    this.batches.forEach((batch, key) => {
      if (!batch.mesh?.visible || !batch.count) return;
      drawCalls++; instances += batch.count; triangles += batch.triangles * batch.count; variants.push(key);
    });
    if (this.staticMesh?.visible) { drawCalls++; triangles += this.staticMesh.geometry.getAttribute("position").count / 3; variants.push("static"); }
    return { drawCalls, triangles: Math.round(triangles), instances, variants };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.parent?.remove(this.group);
    this.batches.forEach(batch => { batch.mesh?.dispose(); batch.geometry.dispose(); });
    this.batches.clear();
    this.staticMesh?.geometry.dispose();
    this.group.clear();
    this.places.clear();
    this.material.dispose();
  }

  private touch(place?: Place): void {
    if (!place?.lod) return;
    place.lists[place.lod]?.forEach((_, key) => this.dirty.add(key));
  }

  private batch(key: string): Batch {
    let batch = this.batches.get(key);
    if (!batch) {
      const [variant, lod] = key.split(":") as [string, KitLevel];
      const geometry = this.variants[variant].build(lod);
      if ((this.material as CityMaterial & { kitDither?: boolean }).kitDither) packPhysicalSurface(geometry);
      batch = { geometry, capacity: 0, attributes: [], count: 0, triangles: geometry.getAttribute("position").count / 3 };
      this.batches.set(key, batch);
    }
    return batch;
  }

  /** Concatenates every place's instances for one batch ("variant:level"). */
  private fill(key: string): void {
    const variant = key.split(":")[0];
    const list: KitInstance[] = [], fades: KitFade[] = [];
    const dither = !!(this.material as CityMaterial & { kitDither?: boolean }).kitDither;
    this.places.forEach(place => {
      const own = place.lod ? place.lists[place.lod]?.get(key) : undefined;
      if (own) {
        list.push(...own);
        if (dither) own.forEach(() => fades.push(place.fade ?? SOLID));
      }
    });
    const batch = this.batch(key);
    if (!batch.mesh || batch.capacity < list.length) {
      if (batch.mesh) {
        // Release the outgoing instance buffers; the geometry re-uploads on use.
        this.group.remove(batch.mesh);
        batch.mesh.dispose();
        batch.geometry.dispose();
      }
      batch.capacity = Math.max(16, Math.ceil(list.length * 1.25));
      const arrays = {
        depth: new Float32Array(batch.capacity * (dither ? 4 : 1)), wall: new Float32Array(batch.capacity * 3),
        roof: new Float32Array(batch.capacity * 3), kit: new Float32Array(batch.capacity * 3),
      };
      batch.arrays = arrays;
      batch.attributes = [
        new THREE.InstancedBufferAttribute(arrays.depth, dither ? 4 : 1), new THREE.InstancedBufferAttribute(arrays.wall, 3),
        new THREE.InstancedBufferAttribute(arrays.roof, 3), new THREE.InstancedBufferAttribute(arrays.kit, 3)
      ];
      ["instanceCastleDepth", "cityWall", "cityRoof", "cityKit"].forEach((name, i) => batch.geometry.setAttribute(name, batch.attributes[i]));
      const mesh = new THREE.InstancedMesh(batch.geometry, this.material, batch.capacity);
      mesh.name = `Kit ${key}`;
      mesh.castShadow = this.shadows && this.variants[variant].shadow;
      mesh.receiveShadow = true;
      mesh.raycast = () => undefined;
      batch.mesh = mesh;
      this.group.add(mesh);
    }
    const mesh = batch.mesh, arrays = batch.arrays;
    if (!arrays) return;
    // The app's three typings omit InstancedBufferAttribute.array.
    const matrices = (mesh.instanceMatrix as unknown as { array: Float32Array }).array;
    list.forEach((p, i) => {
      writeMatrix(matrices, i * 16, p);
      if (dither) {
        const fade = fades[i];
        arrays.depth.set([p.depth, fade[0], fade[1], Math.sign(fade[3]) * fade[2]], i * 4);
      } else arrays.depth[i] = p.depth;
      arrays.wall.set(p.wall, i * 3);
      arrays.roof.set(p.roof, i * 3);
      arrays.kit[i * 3] = p.mask; arrays.kit[i * 3 + 1] = p.pitch; arrays.kit[i * 3 + 2] = p.snow;
    });
    batch.count = list.length;
    mesh.count = list.length;
    mesh.visible = list.length > 0;
    mesh.instanceMatrix.needsUpdate = true;
    batch.attributes.forEach(attribute => { attribute.needsUpdate = true; });
    // Instances span several places: recompute culling bounds from them.
    mesh.boundingSphere = null;
  }

  /** Far silhouettes, landmarks and harbor strips of every place: one draw. */
  private mergeStatic(): void {
    if (this.staticMesh) { this.group.remove(this.staticMesh); this.staticMesh.geometry.dispose(); this.staticMesh = undefined; }
    const parts: THREE.BufferGeometry[] = [];
    this.places.forEach(place => {
      if (!place.merged) return;
      if (!(this.material as CityMaterial & { kitDither?: boolean }).kitDither) { parts.push(place.merged); return; }
      const part = place.merged.clone(), count = part.getAttribute("position").count;
      packPhysicalSurface(part);
      const old = part.getAttribute("instanceCastleDepth") as unknown as { getX(i: number): number } | undefined;
      const fade = place.fade ?? SOLID, depth = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) depth.set([old?.getX(i) ?? 0, fade[0], fade[1], Math.sign(fade[3]) * fade[2]], i * 4);
      part.setAttribute("instanceCastleDepth", new BufferAttribute(depth, 4));
      parts.push(part);
    });
    if (!parts.length) return;
    const geometry = parts.length == 1 ? parts[0].clone() : mergeGeometries(parts);
    if ((this.material as CityMaterial & { kitDither?: boolean }).kitDither) parts.forEach(part => { if (part != geometry) part.dispose(); });
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = "Kit pool static layer";
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = true;
    mesh.raycast = () => undefined;
    this.staticMesh = mesh;
    this.group.add(mesh);
  }
}

/**
 * Instance matrix of a yaw-only instance, written in place. The arithmetic is
 * Object3D.updateMatrix's (Euler XYZ (0, yaw, 0) → quaternion → compose), term
 * for term, so the stored float32 values are those setMatrixAt wrote before.
 */
function writeMatrix(target: Float32Array, offset: number, p: KitInstance): void {
  const half = p.yaw / 2;
  const c1 = 1, c2 = Math.cos(half), c3 = 1, s1 = 0, s2 = Math.sin(half), s3 = 0;
  const x = s1 * c2 * c3 + c1 * s2 * s3, y = c1 * s2 * c3 - s1 * c2 * s3, z = c1 * c2 * s3 + s1 * s2 * c3, w = c1 * c2 * c3 - s1 * s2 * s3;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  target[offset] = (1 - (yy + zz)) * p.sx;
  target[offset + 1] = (xy + wz) * p.sx;
  target[offset + 2] = (xz - wy) * p.sx;
  target[offset + 3] = 0;
  target[offset + 4] = (xy - wz) * p.sy;
  target[offset + 5] = (1 - (xx + zz)) * p.sy;
  target[offset + 6] = (yz + wx) * p.sy;
  target[offset + 7] = 0;
  target[offset + 8] = (xz + wy) * p.sz;
  target[offset + 9] = (yz - wx) * p.sz;
  target[offset + 10] = (1 - (xx + yy)) * p.sz;
  target[offset + 11] = 0;
  target[offset + 12] = p.x;
  target[offset + 13] = p.y;
  target[offset + 14] = p.z;
  target[offset + 15] = 1;
}

// Type-only: the functions live in cities/PhysicalKit (a runtime re-export
// here would close the import cycle pool → PhysicalKit → CityKit → pool).
export type { HouseFamily, HouseLot, HouseLotInstance } from "../cities/settlements/PhysicalKit";

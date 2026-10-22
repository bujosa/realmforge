import * as THREE from "three";
import { CastleKit } from "../castles/castleKit";
import { loadManifest, loadModelLoader } from "./assets/loaders";

type Surface = "wood" | "paper" | "stone" | "metal";
interface Binding {
  material: THREE.MeshStandardMaterial;
  surface: Surface;
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  normalScale: THREE.Vector2;
}

// One lifecycle owner per scene; procedural originals stay available throughout
// loading, failed requests and quality changes. No global GPU resource cache.
export default class AssetMaterials {
  private bindings: Binding[] = [];
  private textures = new Map<Surface, { color?: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture }>();
  private kit: CastleKit | undefined;
  private enabled = false;
  private started = false;
  private preparingMaps = false;
  private mapPreparation?: Promise<void>;
  private disposed = false;
  private frame: number | null = null;
  private timer: number | null = null;

  constructor(private changed: () => void, private installKit: (kit?: CastleKit) => void) {}

  register(material: THREE.MeshStandardMaterial, surface: Surface): void {
    this.bindings.push({
      material,
      surface,
      map: material.map,
      normalMap: material.normalMap,
      roughnessMap: material.roughnessMap,
      normalScale: new THREE.Vector2(material.normalScale.x, material.normalScale.y)
    });
    this.apply();
  }

  /** Includes materials of lazy castle/LOD batches that have no mesh yet. */
  warmupMaterials(): THREE.Material[] { return this.bindings.map(binding => binding.material); }

  // True while loaded CC0 maps are applied to a surface, so other surface detail stays out.
  hasMaps(surface: Surface): boolean {
    return this.enabled && this.textures.has(surface);
  }

  setQuality(high: boolean): void {
    this.enabled = high;
    this.apply();
    this.installKit(high ? this.kit : undefined);
    if (!high) {
      this.cancelScheduled();
    }
  }

  /** Material maps may warm under the opening cover; model parsing still
   * starts only after an actual paint, as it did before shader prewarming. */
  prepare(): void {
    if (!this.enabled || this.disposed || this.mapPreparation) return;
    this.preparingMaps = true;
    this.mapPreparation = this.loadSurfaces();
  }

  programsReady(): boolean { return !this.preparingMaps; }

  afterPaint(): void {
    if (!this.enabled || this.started || this.disposed || this.frame != null || this.timer != null) {
      return;
    }
    // A second RAF and a task boundary let the procedural board paint first.
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.timer = window.setTimeout(() => {
        this.timer = null;
        if (this.enabled && !this.disposed) {
          this.started = true;
          void this.load();
        }
      }, 120);
    });
  }

  private async loadSurfaces(): Promise<void> {
    try {
      const manifest = await loadManifest();
      if (this.disposed || !this.enabled) {
        this.started = false;
        return;
      }
      const loadTexture = (url: string, color = false, repeat = 1): Promise<THREE.Texture> => new Promise((resolve, reject) => {
        const pending = new THREE.TextureLoader().load(url, texture => {
          texture.colorSpace = color ? THREE.SRGBColorSpace : "";
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.x = repeat;
          texture.repeat.y = repeat == 2 ? 3 : repeat;
          texture.anisotropy = 8;
          resolve(texture);
        }, undefined, error => {
          pending.dispose();
          reject(error);
        });
      });
      const surfaces: Surface[] = ["wood", "paper", "stone", "metal"];
      await Promise.all(surfaces.map(async surface => {
        if (this.textures.has(surface)) {
          return;
        }
        const urls = manifest.surfaces[surface];
        const colorUrl = "color" in urls ? urls.color : undefined;
        const repeat = surface == "wood" ? 2 : surface == "paper" ? 18 : 1;
        // Settle all requests so partial failures also release their textures.
        const results = await Promise.all([
          colorUrl ? loadTexture(colorUrl, true, repeat).catch(() => undefined) : Promise.resolve(undefined),
          loadTexture(urls.normal, false, repeat).catch(() => undefined),
          loadTexture(urls.roughness, false, repeat).catch(() => undefined)
        ]);
        const [color, normal, roughness] = results;
        if (this.disposed || !normal || !roughness || (colorUrl && !color)) {
          results.forEach(texture => texture?.dispose());
          return;
        }
        this.textures.set(surface, { color, normal, roughness });
        this.apply();
        this.changed();
      }));
    } catch (_error) {
      // The scene keeps its procedural surfaces when optional maps fail.
    } finally {
      this.preparingMaps = false;
      if (!this.enabled) this.mapPreparation = undefined;
    }
  }

  private async load(): Promise<void> {
    try {
      this.prepare();
      await this.mapPreparation;
      const manifest = await loadManifest();
      if (this.disposed || !this.enabled) {
        this.started = false;
        return;
      }
      const loader = await loadModelLoader();
      if (this.disposed || !this.enabled) {
        this.started = false;
        return;
      }
      const gltf = await loader.loadAsync(manifest.castle);
      const kit: CastleKit = new Map();
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          if (!this.disposed) {
            const transformed = object.geometry.clone().applyMatrix4(object.matrixWorld);
            const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
            if (geometry != transformed) {
              transformed.dispose();
            }
            // Meshopt uses normalized integer attributes. Expand once before
            // mixing with Float32 procedural modules; instances still share it.
            ["position", "normal", "color", "uv"].forEach(name => {
              const attribute = geometry.getAttribute(name);
              const size = name == "uv" ? 2 : 3;
              const values = new Float32Array(attribute.count * size);
              for (let i = 0; i < attribute.count; i++) {
                values[i * size] = attribute.getX(i);
                values[i * size + 1] = attribute.getY(i);
                if (size == 3) {
                  values[i * size + 2] = attribute.getZ(i);
                }
              }
              geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
            });
            kit.set(object.name, geometry);
          }
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      if (!this.disposed) {
        this.kit = kit;
        this.installKit(this.enabled ? kit : undefined);
        this.changed();
      }
    } catch (_error) {
      // Optional fidelity never replaces the functioning board with an error UI.
    }
  }

  private apply(): void {
    this.bindings.forEach(binding => {
      const maps = this.enabled ? this.textures.get(binding.surface) : undefined;
      const material = binding.material;
      material.map = maps?.color ?? binding.map;
      material.normalMap = maps?.normal ?? binding.normalMap;
      material.roughnessMap = maps?.roughness ?? binding.roughnessMap;
      material.normalScale.x = maps ? binding.surface == "paper" ? 0.055 : binding.surface == "metal" ? 0.09 : binding.surface == "wood" ? 0.12 : 0.22 : binding.normalScale.x;
      material.normalScale.y = maps ? material.normalScale.x : binding.normalScale.y;
      material.needsUpdate = true;
    });
  }

  private cancelScheduled(): void {
    if (this.frame != null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    if (this.timer != null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.enabled = false;
    this.cancelScheduled();
    this.apply();
    this.bindings = [];
    this.textures.forEach(maps => {
      maps.color?.dispose();
      maps.normal.dispose();
      maps.roughness.dispose();
    });
    this.textures.clear();
    this.kit?.forEach(geometry => geometry.dispose());
    this.kit?.clear();
  }
}

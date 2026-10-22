import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import basisScript from "three/examples/jsm/libs/basis/basis_transcoder.js?url";
import basisWasm from "three/examples/jsm/libs/basis/basis_transcoder.wasm?url";
import terrainAlbedo from "./assets/world/terrain-albedo.ktx2?url";
import terrainNormal from "./assets/world/terrain-normal.ktx2?url";
import terrainRoughness from "./assets/world/terrain-roughness.ktx2?url";
import castleAlbedo from "./assets/world/castle-albedo.ktx2?url";
import castleNormal from "./assets/world/castle-normal.ktx2?url";
import castleRoughness from "./assets/world/castle-roughness.ktx2?url";

export const terrainLayers = ["Leafy grass", "Sparse grass", "Farm furrows", "Dirt", "Coast sand", "Rock face"] as const;
export const masonryLayers = ["Castle wall slates", "Clay roof tiles"] as const;
export interface SurfaceArraySet { albedo: THREE.CompressedArrayTexture; normal: THREE.CompressedArrayTexture; roughness: THREE.CompressedArrayTexture }
/** Scene-owned, self-contained CC0 array loader. No game singleton, CDN or static path. */
export class SurfaceArrays {
  private loader: KTX2Loader;
  private textures = new Set<THREE.Texture>();
  private disposed = false;
  constructor(renderer: THREE.WebGLRenderer) {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => url.endsWith("basis_transcoder.js") ? basisScript : url.endsWith("basis_transcoder.wasm") ? basisWasm : url);
    this.loader = new KTX2Loader(manager).setTranscoderPath("realmforge-basis/").setWorkerLimit(1).detectSupport(renderer);
  }
  async load(kind: "terrain" | "masonry" = "terrain"): Promise<SurfaceArraySet> {
    const urls = kind === "terrain" ? [terrainAlbedo,terrainNormal,terrainRoughness] : [castleAlbedo,castleNormal,castleRoughness];
    const textures = await Promise.all(urls.map(async url => {
      const texture = await this.loader.loadAsync(url);
      if (this.disposed) { texture.dispose(); throw new Error("SurfaceArrays was disposed while loading"); }
      this.textures.add(texture);
      if (!(texture instanceof THREE.CompressedArrayTexture) || texture.image.depth !== (kind === "terrain" ? 6 : 2)) throw new Error("Unexpected surface array layout");
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
      return texture;
    }));
    return { albedo:textures[0],normal:textures[1],roughness:textures[2] };
  }
  dispose(): void { this.disposed = true; this.loader.dispose(); this.textures.forEach(texture => texture.dispose()); this.textures.clear(); }
}
/** Single-layer inspection material; production splat snippets are in SurfaceShader.ts. */
export function surfaceArrayMaterial(surfaces: SurfaceArraySet, layer: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color:"white",roughness:0.9,side:THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms,{ rfAlbedo:{value:surfaces.albedo},rfNormal:{value:surfaces.normal},rfRoughness:{value:surfaces.roughness},rfLayer:{value:layer} });
    shader.vertexShader = "varying vec2 rfUv;\n"+shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nrfUv=uv*3.0;");
    shader.fragmentShader = "uniform highp sampler2DArray rfAlbedo;\nuniform highp sampler2DArray rfNormal;\nuniform highp sampler2DArray rfRoughness;\nuniform float rfLayer;\nvarying vec2 rfUv;\n"+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.rgb *= texture(rfAlbedo,vec3(rfUv,rfLayer)).rgb;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=texture(rfRoughness,vec3(rfUv,rfLayer)).r;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\nvec3 rfDetail=texture(rfNormal,vec3(rfUv,rfLayer)).xyz*2.0-1.0;\nnormal=normalize(normal+vec3(rfDetail.xy*0.18,0.0));");
  };
  material.customProgramCacheKey = () => "rf-surface-array-v1";
  return material;
}

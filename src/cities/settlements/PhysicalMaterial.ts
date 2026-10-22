import * as THREE from "three";
import AssetMaterials from "../../materials/AssetMaterials";
import CityMaterial from "./CityMaterial";

/** Option bit of the far roofscape tiles (no kit part carries it): they fade out with distance. */
export const roofTileBit = 128;

/**
 * World ×20 (k = 20) city material: CityMaterial plus a screen-door fade of
 * the far roofscape tiles (instances with `roofTileBit`) between
 * `fade.x` and `fade.y` scene units from the eye, so the roofscape thins into
 * the haze instead of popping off at the hide ring. Only the physical kit
 * pool uses it; k = 1 pools keep CityMaterial (unchanged program).
 */
export default class PhysicalMaterial extends CityMaterial {
  readonly kitDither = true;
  readonly fade = { value: new THREE.Vector2(1e6, 2e6) };
  readonly clock = { value: 0 };

  constructor(assets?: AssetMaterials) {
    super(assets);
    const city = this.onBeforeCompile;
    this.onBeforeCompile = (shader, renderer) => {
      city(shader, renderer);
      shader.uniforms.physFade = this.fade;
      shader.uniforms.physClock = this.clock;
      // Reuse the existing depth attribute's spare components: WebGL2 on this
      // Mac has no free vertex attribute slots for another instanced vec4.
      shader.vertexShader = shader.vertexShader
        .replace("attribute vec3 castleSurface;", "attribute vec4 castleSurface;")
        .replace("attribute float castleSkirt;", "")
        .replace("vCastleSurface = castleSurface;", "vCastleSurface = castleSurface.xyz;")
        .replace("castleSkirt * instanceCastleDepth;", "castleSurface.w * instanceCastleDepth;")
        .replace("attribute float instanceCastleDepth;", "attribute vec4 instanceCastleDepth;")
        .replace("castleSurface.w * instanceCastleDepth;", "castleSurface.w * instanceCastleDepth.x;");
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        uniform vec2 physFade;
        varying float vPhysFade;
        varying vec3 vKitFade;`)
        .replace("#include <project_vertex>", `vPhysFade = 1.0;
          vKitFade = instanceCastleDepth.yzw;
          #ifdef USE_INSTANCING
            if ((int(cityKit.x + 0.5) & ${roofTileBit}) != 0) {
              vec4 physCentre = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
              vPhysFade = 1.0 - smoothstep(physFade.x, physFade.y, distance(physCentre.xyz, cameraPosition));
            }
          #endif
          #include <project_vertex>`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        uniform float physClock;
        varying float vPhysFade;
        varying vec3 vKitFade;
        float kitCoverage(vec3 f) {
          float t = clamp((physClock - abs(f.z)) / 250.0, 0.0, 1.0);
          return mix(f.x, f.y, t);
        }`)
        .replace("void main() {", `void main() {
          float hash = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float coverage = min(vPhysFade, kitCoverage(vKitFade));
          if (vKitFade.z < 0.0) { if (hash < 1.0 - coverage) discard; }
          else if (hash >= coverage) discard;`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          // Specular AA: steep normal variation inside one pixel broadens the lobe.
          float normalVariance = min(1.0, length(fwidth(normalize(normal))) * 0.35);
          roughnessFactor = min(1.0, sqrt(roughnessFactor * roughnessFactor + normalVariance));`);
    };
    const baseKey = this.customProgramCacheKey;
    this.customProgramCacheKey = () => `city-surfaces-v2-physical-4:${baseKey()}`;
  }

  /** Fade band of the roofscape tiles, scene units. */
  setFade(from: number, to: number): void { this.fade.value.set(from, to); }
  setClock(now: number): void { this.clock.value = now; }
}

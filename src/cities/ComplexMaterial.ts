import * as THREE from "three";
import AssetMaterials from "../materials/AssetMaterials";
import CastleMaterial from "../materials/CastleMaterial";

/** Per-instance dither coverage of a castle form (1 solid, 0 gone). */
export const FADE_ATTRIBUTE = "instanceCastleFade";

/** Adds the per-instance fade attribute (all 1) to an instanced castle geometry. */
export function addFadeAttribute(geometry: THREE.BufferGeometry, capacity: number): THREE.InstancedBufferAttribute {
  const existing = geometry.getAttribute(FADE_ATTRIBUTE) as unknown as THREE.InstancedBufferAttribute | undefined;
  if (existing && existing.count >= capacity) return existing;
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(FADE_ATTRIBUTE, fade);
  return fade;
}

/**
 * World ×20 castle material: the shared castle surfaces plus a screen-door
 * dither per instance (design §2.5 «Fundido»: alphaHash-like, no sorting).
 * Board miniatures and physical complexes cross-fade through it in 250 ms.
 * Every geometry drawn with it must carry `instanceCastleFade`
 * (`addFadeAttribute`); k = 1 never constructs it.
 */
export default class ComplexMaterial extends CastleMaterial {
  constructor(assets?: AssetMaterials) {
    super(assets);
    const castle = this.onBeforeCompile;
    this.onBeforeCompile = (shader, renderer) => {
      castle.call(this, shader, renderer);
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        attribute float ${FADE_ATTRIBUTE};
        varying float vCastleFade;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vCastleFade = ${FADE_ATTRIBUTE};`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        varying float vCastleFade;`)
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
          if (vCastleFade < 0.999) {
            // Interleaved gradient noise: a stable screen-door pattern per pixel.
            float castleDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (castleDither >= vCastleFade) discard;
          }`);
    };
    this.customProgramCacheKey = () => "castle-surfaces-v6-fade1";
  }
}

/**
 * World ×20 hero material (the Rock, the Eyrie's needles, the Hightower): the
 * shared castle surfaces plus tag 8, faceted rock with bedding planes, broken
 * vertical joints and lichen blotches in metres (uv = metres along the face,
 * metres up), each faded by its screen footprint so nothing shimmers at range.
 * Heroes are plain meshes (no dither). k = 1 never constructs it.
 */
export class HeroMaterial extends CastleMaterial {
  constructor(assets?: AssetMaterials) {
    super(assets);
    const castle = this.onBeforeCompile;
    this.onBeforeCompile = (shader, renderer) => {
      castle.call(this, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        // Sine-free hash (Hoskins): stable for metre coordinates in the thousands.
        float heroHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        float heroNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(heroHash(i), heroHash(i + vec2(1.0, 0.0)), f.x), mix(heroHash(i + vec2(0.0, 1.0)), heroHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`)
        // Rock carries metre uvs: no masonry albedo map on it.
        .replace("#include <map_fragment>", `if (vCastleSurface.x < 7.5) {
          #include <map_fragment>
          }`)
        .replace("#include <color_fragment>", `#include <color_fragment>
          if (vCastleSurface.x > 7.5 && vCastleSurface.x < 8.5) {
            vec2 rockP = vCastleUv;
            // Bedding planes of uneven thickness, wavering, only some of them marked.
            float rockBed = rockP.y / 3.1 + heroNoise(rockP * vec2(0.01, 0.03)) * 2.0 + sin(rockP.x * 0.021) * 0.5;
            float rockBedId = floor(rockBed);
            float rockBedLine = smoothstep(0.86, 1.0, abs(sin(rockBed * 3.14159))) * step(0.35, heroHash(vec2(rockBedId, 3.0))) * (1.0 - smoothstep(0.15, 0.5, fwidth(rockBed)));
            // Sparse joints: a 9 m cell of a bed holds one at a random place, or none.
            float rockCell = rockP.x / 9.0 + heroHash(vec2(rockBedId, 7.0)) * 9.0, rockCellId = floor(rockCell);
            float rockJointX = abs(fract(rockCell) - 0.2 - 0.6 * heroHash(vec2(rockCellId, rockBedId)));
            float rockCellPix = fwidth(rockCell);
            float rockJointLine = (1.0 - smoothstep(0.015, 0.015 + rockCellPix * 1.5, rockJointX)) * step(0.55, heroHash(vec2(rockCellId + 17.0, rockBedId))) * (1.0 - smoothstep(0.06, 0.2, rockCellPix));
            // Rain stains down the faces, lichen blotches, and a broad tone that holds at range.
            float rockStain = smoothstep(0.55, 0.9, heroNoise(vec2(rockP.x * 0.07, rockP.y * 0.006))) * (1.0 - smoothstep(0.3, 1.0, fwidth(rockP.x * 0.07)));
            float rockSpot = smoothstep(0.6, 0.9, heroNoise(rockP * 0.06 + 3.0)) * (1.0 - smoothstep(0.3, 1.0, fwidth(rockP.x * 0.06)));
            float rockBroad = heroNoise(rockP * 0.017 + 7.0);
            diffuseColor.rgb *= (1.0 - rockBedLine * 0.12) * (1.0 - rockJointLine * 0.22) * (1.0 - rockStain * 0.12) * (0.9 + rockBroad * 0.18);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.94, 0.8), rockSpot * 0.5);
          }`);
    };
    this.customProgramCacheKey = () => "castle-surfaces-v6-hero4";
  }
}

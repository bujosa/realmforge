import * as THREE from "three";
import type { DragonPalette, DragonTier } from "./types";

export interface DragonUniforms {
  /** 0 … 1 fire-breath pulse: throat/mouth glow. */
  fire: { value: number };
  /** Wing fold (rig pose) so the leathery dorsal face is chosen per pose. */
  fold: { value: number };
  eye: { value: THREE.Color };
  membrane: { value: THREE.Color };
  dorsal: { value: THREE.Color };
}

export function createDragonUniforms(palette: DragonPalette): DragonUniforms {
  return {
    fire: { value: 0 },
    fold: { value: 1 },
    eye: { value: new THREE.Color(palette.eye) },
    membrane: { value: new THREE.Color(palette.membrane) },
    // Wing tops are leathery and close to the scales; undersides carry the red.
    dorsal: { value: new THREE.Color(palette.scales).multiplyScalar(1.9).lerp(new THREE.Color(palette.membrane), 0.14) }
  };
}

/**
 * Skinned MeshStandardMaterial with procedural surface detail (no textures):
 * - skin: staggered overlapping scales (colour + derivative bump), transverse
 *   belly plates; detail fades out when a scale is under ~2 px so distant
 *   board views stay calm and alias-free;
 * - membrane: radiating veins and back-lit transmission from the scene's
 *   directional lights, so wings glow warm against the sun;
 * - horn/claw: smoother, glossier keratin bands;
 * - eye and mouth: subtle emissive glow (mouth only while breathing fire).
 * The material's own emissive stays free for the scene's selection highlight.
 * High adds the bump; Balanced keeps colour detail only.
 */
export function createDragonMaterial(uniforms: DragonUniforms, tier: Exclude<DragonTier, "low">): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.06,
    side: THREE.DoubleSide,
    transparent: false
  });
  material.defines = { DRAGON_BUMP: tier == "high" ? 1 : 0 };

  material.onBeforeCompile = shader => {
    shader.uniforms.dragonFire = uniforms.fire;
    shader.uniforms.dragonFold = uniforms.fold;
    shader.uniforms.dragonEye = uniforms.eye;
    shader.uniforms.dragonWingColor = uniforms.membrane;
    shader.uniforms.dragonDorsal = uniforms.dorsal;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec4 dragonSurface;
uniform float dragonFold;
varying vec4 vDragonSurface;
varying float vDragonDorsal;`
      )
      .replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>
vDragonSurface = dragonSurface;
// Dorsal = the membrane face looking up in flight, outward (and up, where
// the folded membrane drapes over the flank) when folded.
vec3 dragonRef = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(sign(transformed.x), 0.75, 0.0), dragonFold));
vDragonDorsal = dot(objectNormal, dragonRef);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec4 vDragonSurface;
varying float vDragonDorsal;
uniform float dragonFire;
uniform float dragonFold;
uniform vec3 dragonEye;
uniform vec3 dragonWingColor;
uniform vec3 dragonDorsal;
float dragonHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float dragonKind = vDragonSurface.z;
float dragonSkin = 1.0 - step(0.5, dragonKind);
float dragonMembrane = step(0.5, dragonKind) * (1.0 - step(1.5, dragonKind));
float dragonHorn = step(1.5, dragonKind) * (1.0 - step(2.5, dragonKind));
float dragonBelly = clamp(dragonKind / 0.4, 0.0, 1.0) * dragonSkin;
vec2 suvRaw = vDragonSurface.xy;
// Scale size varies over the body: big keeled scutes in the rows along the
// spine (dorsal >= 0.72), finer scales on the flanks and limbs.
float dragonScute = step(0.72, vDragonSurface.w) * dragonSkin;
vec2 suv = suvRaw * mix(1.3, 0.5, dragonScute);
// Staggered scales overlapping toward the tail.
float scaleRow = floor(suv.x);
vec2 cell = vec2(fract(suv.x), fract(suv.y * 0.85 + 0.5 * mod(scaleRow, 2.0)));
vec2 cellId = vec2(scaleRow, floor(suv.y * 0.85 + 0.5 * mod(scaleRow, 2.0)));
float scaleR = mix(length((cell - vec2(0.62, 0.5)) * vec2(1.0, 1.25)), max(abs(cell.x - 0.55) * 1.2, abs(cell.y - 0.5) * 1.35), dragonScute);
float scaleDome = smoothstep(0.72, 0.05, scaleR);
float scaleGroove = smoothstep(0.42, 0.66, scaleR);
// Belly: transverse plates.
float plate = fract(suvRaw.x * 0.42);
float plateGroove = smoothstep(0.82, 0.97, plate) + (1.0 - smoothstep(0.0, 0.06, plate));
vec2 fw = fwidth(suv);
float dragonDetail = 1.0 - smoothstep(0.18, 0.42, max(fw.x, fw.y));
float scaleTint = 0.92 + 0.16 * dragonHash(cellId);
// Scutes: deeper seams and a raised keel down their middle.
float keel = dragonScute * (1.0 - smoothstep(0.0, 0.14, abs(cell.y - 0.5))) * smoothstep(0.1, 0.5, cell.x);
vec3 skinMod = vec3(mix(1.0, mix(0.86, 0.74, dragonScute), scaleGroove) * (0.97 + 0.08 * scaleDome + 0.1 * keel) * scaleTint);
vec3 bellyMod = vec3(mix(1.0, 0.8, clamp(plateGroove, 0.0, 1.0)) * (0.97 + 0.06 * (1.0 - plate)));
vec3 detailMod = mix(skinMod, bellyMod, dragonBelly);
diffuseColor.rgb *= mix(vec3(1.0), detailMod, dragonSkin * dragonDetail);
// Membrane veins radiate from the wrist; finer cross-veins near the edge.
float vein = 1.0 - smoothstep(0.0, 0.07, abs(fract(suvRaw.y * 3.0) - 0.5) - 0.38);
float crossVein = 1.0 - smoothstep(0.0, 0.05, abs(fract(suvRaw.x * 7.0 + suvRaw.y * 0.6) - 0.5) - 0.44);
float membraneDetail = 1.0 - smoothstep(0.5, 1.2, fwidth(suvRaw.y * 3.0));
diffuseColor.rgb *= 1.0 - dragonMembrane * membraneDetail * (vein * 0.28 + crossVein * 0.1 * suvRaw.x);
// Horn bands.
diffuseColor.rgb *= 1.0 - dragonHorn * 0.12 * smoothstep(0.6, 1.0, sin(suvRaw.x * 2.2) * 0.5 + 0.5);
float dragonBumpH = dragonSkin * dragonDetail * mix(scaleDome * 0.8 - scaleGroove * mix(0.6, 0.9, dragonScute) + keel * 0.5, -plateGroove * 0.5, dragonBelly);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.4, dragonSkin * dragonDetail * scaleDome * 0.7);
roughnessFactor = mix(roughnessFactor, 0.82, dragonMembrane);
roughnessFactor = mix(roughnessFactor, 0.38, dragonHorn);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  float dorsalView = step(0.0, faceDirection * vDragonDorsal) * dragonMembrane;
  float shadeKeep = clamp(dot(diffuseColor.rgb, vec3(0.6)) / max(0.05, dot(dragonWingColor, vec3(0.6))), 0.4, 1.3);
  diffuseColor.rgb = mix(diffuseColor.rgb, dragonDorsal * shadeKeep, dorsalView * 0.85);
  // The inner face of a folded wing sits in its own shadow.
  diffuseColor.rgb *= 1.0 - 0.5 * dragonFold * dragonMembrane * (1.0 - dorsalView);
}
#if DRAGON_BUMP == 1
{
  // Derivative bump (perturbNormalArb) from the procedural scale height.
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  float hx = dFdx(dragonBumpH) * 0.0016;
  float hy = dFdy(dragonBumpH) * 0.0016;
  vec3 r1 = cross(dpdy, normal);
  vec3 r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1) * faceDirection;
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  normal = normalize(abs(det) * normal - grad);
}
#endif`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float dragonEyeMask = step(2.5, dragonKind) * (1.0 - step(3.5, dragonKind));
float dragonMouthMask = step(3.5, dragonKind);
totalEmissiveRadiance += dragonEye * dragonEyeMask * 0.55;
totalEmissiveRadiance += vec3(1.0, 0.42, 0.08) * dragonMouthMask * dragonFire * 2.2;`
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  // Thin-membrane transmission: light arriving on the far side shines through.
  vec3 dragonTrans = vec3(0.0);
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    vec3 L = directionalLights[i].direction;
    float through = saturate(-dot(normal, L));
    float forward = pow(saturate(dot(normalize(-vViewPosition), -L) * 0.5 + 0.5), 3.0);
    dragonTrans += directionalLights[i].color * through * (0.35 + 0.65 * forward);
  }
  vec3 transTint = dragonWingColor * vec3(1.45, 0.95, 0.7);
  // A folded wing is several layers thick: little light gets through.
  reflectedLight.directDiffuse += dragonMembrane * dragonTrans * transTint * 0.5 * (1.0 - 0.85 * dragonFold);
}
#endif`
      );
  };

  material.customProgramCacheKey = () => `v3-dragon-skinned-v5-${tier}`;
  return material;
}

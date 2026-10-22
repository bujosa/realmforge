import * as THREE from "three";
import { waveGLSL, waveGLSLFiltered } from "./waves";

export const worldWaterOffset = 0.006;

// Today's table-profile shader constants, stored raw (no sRGB decode) so the
// Natural theme reproduces vec3(0.055, 0.38, 0.36) / vec3(0.012, 0.085, 0.13).
export const naturalWaterShallow = new THREE.Color(0).setRGB(0.055, 0.38, 0.36, THREE.LinearSRGBColorSpace);
export const naturalWaterDeep = new THREE.Color(0).setRGB(0.012, 0.085, 0.13, THREE.LinearSRGBColorSpace);

export interface WaterShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

export interface WaterMaterial extends THREE.MeshStandardMaterial {
  onBeforeCompile: (shader: WaterShader, renderer: THREE.WebGLRenderer) => void;
  customProgramCacheKey: () => string;
}

export interface WaterUniforms {
  waterField: { value: THREE.Texture };
  waterTime: { value: number };
  waterAmplitude: { value: number };
  waterStorm: { value: number };
  waterWinter: { value: number };
  waterDetail: { value: number };
  waterSubmerged: { value: number };
  waterSize: { value: THREE.Vector2 };
  waterBoardUnit: { value: number }; // frame: map — one board pixel in scene units
  waterShallow: { value: THREE.Color };
  waterDeep: { value: THREE.Color };
}

/** Inject raw linear shader colors; no game theme dependency. */
export function applyWaterColors(uniforms: WaterUniforms, colors?: { shallow: string; deep: string }): void {
  if (colors) {
    uniforms.waterShallow.value.setStyle(colors.shallow, THREE.LinearSRGBColorSpace);
    uniforms.waterDeep.value.setStyle(colors.deep, THREE.LinearSRGBColorSpace);
  } else {
    uniforms.waterShallow.value.copy(naturalWaterShallow);
    uniforms.waterDeep.value.copy(naturalWaterDeep);
  }
}

// frame: map — bake the frame factor as a shader literal to preserve the
// existing constant folding at k=1. The frame is fixed for this material.
const fieldGLSL = (boardUnit: number): string => `
  uniform sampler2D waterField;
  uniform float waterTime;
  uniform float waterAmplitude;
  uniform float waterStorm;
  uniform float waterWinter;
  uniform float waterDetail;
  uniform float waterSubmerged;
  uniform vec2 waterSize;
  uniform vec3 waterShallow;
  uniform vec3 waterDeep;
  float coastDistance(vec4 field) { return (field.r * 255.0 - 128.0) * ${boardUnit}; }
  float edgeIce(vec4 field) {
    return field.a * waterWinter * (1.0 - smoothstep(0.04, 0.28, coastDistance(field)));
  }
  float waveShelter(vec4 field) {
    return smoothstep(0.015, 0.16, coastDistance(field)) * (1.0 - field.b * 0.92) * (1.0 - edgeIce(field) * 0.85);
  }
`;

// World only. An approximation of WorldSeabed.depthAt in map units, not an exact
// copy: it omits WorldSeabed's ripple and uses the optical coast field, not its
// chamfer distance. Shore foam and colour follow the same general shelf shape.
const worldGLSL = `
  float seabedDepth(float d) { return 0.065 + 1.08 * d * d / (d + 0.28); }
`;

const detailGLSL = `
  float waterNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec4 h = fract(sin(vec4(dot(i, vec2(127.1, 311.7)), dot(i + vec2(1,0), vec2(127.1, 311.7)), dot(i + vec2(0,1), vec2(127.1, 311.7)), dot(i + vec2(1,1), vec2(127.1, 311.7)))) * 43758.5453);
    return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
  }
  float waterRipple(vec2 p) {
    vec2 drift = vec2(waterTime * 0.07, -waterTime * 0.045);
    #ifdef WATER_WORLD
      // Coherent wind-aligned ripples. The printed Table keeps its finer grain;
      // stretching the World detail avoids a glittering crosshatch at close zoom.
      vec2 wind = vec2(dot(p, vec2(0.94, 0.342)), dot(p, vec2(-0.342, 0.94)));
      return waterNoise(wind * vec2(7.0, 18.0) + drift) * 0.7
        + waterNoise(wind * vec2(12.0, 31.0) - drift * 0.8) * 0.3;
    #else
    return waterNoise(p * 18.0 + drift) * 0.65 + waterNoise(p * 31.0 - drift * 1.4) * 0.35;
    #endif
  }
  float waterCaustic(vec2 p) {
    vec2 q = p * 21.0;
    q += vec2(sin(q.y * 0.31 + waterTime * 0.25), cos(q.x * 0.27 - waterTime * 0.2)) * 1.5;
    float lattice = sin(q.x + sin(q.y)) * sin(q.y - sin(q.x));
    float ridge = 1.0 - abs(lattice);
    float aa = max(fwidth(ridge), 0.04);
    return smoothstep(0.87 - aa, 0.87 + aa, ridge);
  }
`;

export function surfaceMaterial(uniforms: WaterUniforms, full: boolean, profile: "table" | "world" = "table", transmission = false): WaterMaterial {
  const parameters = {
    color: "#347c86",
    roughness: 0.26,
    metalness: 0,
    transparent: !transmission,
    opacity: transmission ? 1 : full ? 0.48 : 0.32,
    depthWrite: false
  };
  const material = (transmission ? new THREE.MeshPhysicalMaterial({
    ...parameters, transmission: 0.96, thickness: 0.16, ior: 1.333,
    attenuationColor: "#78d7cd", attenuationDistance: 1.8
  }) : new THREE.MeshStandardMaterial(parameters)) as WaterMaterial;
  if (profile == "world") material.side = THREE.DoubleSide;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const define = (full ? "#define WATER_FULL\n" : "") + (profile == "world" ? "#define WATER_WORLD\n" : "");
    shader.vertexShader = define + fieldGLSL(uniforms.waterBoardUnit.value) + waveGLSL + "varying vec2 waterUv;\nvarying vec2 waterPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      waterUv = vec2(uv.x, 1.0 - uv.y);
      waterPosition = position.xz;
      vec4 field = texture2D(waterField, waterUv);
      transformed.y += waterWaves(position.xz, waterTime).x * waterAmplitude * waveShelter(field);
    `);
    const worldPrefix = profile == "world" ? waveGLSLFiltered + worldGLSL : "";
    shader.fragmentShader = define + fieldGLSL(uniforms.waterBoardUnit.value) + waveGLSL + worldPrefix + detailGLSL + "varying vec2 waterUv;\nvarying vec2 waterPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      vec4 field = texture2D(waterField, waterUv);
      if (field.g < 0.008) discard;
      float distance = max(0.0, coastDistance(field));
      float shelter = waveShelter(field);
      float ice = edgeIce(field);
      float depth = smoothstep(0.03, 0.95, distance);
      vec3 shallow = waterShallow;
      vec3 deep = waterDeep;
      #ifdef WATER_WORLD
        // Clear coastal water keeps the existing physical transmission path.
        // Colour depth follows the same bathymetry curve as the seabed mesh.
        float opticalDepth = seabedDepth(distance);
        depth = smoothstep(0.10, 1.55, opticalDepth);
        // A single bathymetric ramp is used by both the transparent and the
        // physical water. Theme colours remain relative to the Table palette.
        shallow = vec3(0.032, 0.29, 0.35) * waterShallow / vec3(0.055, 0.38, 0.36);
        vec3 middle = vec3(0.016, 0.15, 0.23) * waterDeep / vec3(0.012, 0.085, 0.13);
        deep = vec3(0.006, 0.045, 0.12) * waterDeep / vec3(0.012, 0.085, 0.13);
        diffuseColor.rgb = mix(mix(shallow, middle, smoothstep(0.10, 0.62, opticalDepth)),
          deep, smoothstep(0.58, 1.75, opticalDepth));
      #endif
      #ifndef WATER_WORLD
        diffuseColor.rgb = mix(shallow, deep, depth);
      #endif
      diffuseColor.rgb *= 1.0 - waterStorm * 0.32;
      diffuseColor.a *= field.g * mix(0.82, 1.15, depth);
      float foamNoise = waterNoise(waterPosition * 32.0 + waterTime * 0.09);
      #ifdef WATER_WORLD
        float foamFootprint = max(length(dFdx(waterPosition * 32.0)), length(dFdy(waterPosition * 32.0)));
        foamNoise = mix(foamNoise, 0.5, smoothstep(0.35, 0.85, foamFootprint));
      #endif
      float wash = 0.026 + sin(waterTime * 0.55 + foamNoise * 5.0) * 0.012;
      float foam = (1.0 - smoothstep(wash, wash + 0.045, distance)) * smoothstep(0.0, 0.02, distance);
      foam *= smoothstep(0.28, 0.72, foamNoise) * (1.0 - field.b * 0.8);
      #ifdef WATER_WORLD
        // Footprint-filtered slope and crest terms, computed once for the normal,
        // roughness and whitecap patches. waterAmplitude × shelter matches the vertex.
        float worldVariance = 0.0;
        float worldCurvature = 0.0;
        float worldRemoved = 0.0;
        vec2 worldSlope = waterSlopeFiltered(waterPosition, waterTime, dFdx(waterPosition), dFdy(waterPosition), waterAmplitude * shelter, worldVariance, worldCurvature, worldRemoved);
        // The miniature's long bobbing waves are useful near a fleet, but read
        // as continent-sized stripes from the atlas camera. At that scale their
        // slope energy belongs in roughness, rather than resolved wave normals.
        float worldResolved = 1.0 - smoothstep(0.004, 0.025, length(fwidth(waterPosition)));
        // Slow world-space wind patches soften the distant sheen without a
        // second clock, screen-space texture or repeating wave grid.
        float windPatch = waterNoise(waterPosition * 0.34 + vec2(waterTime * 0.006, -waterTime * 0.004)) * 0.65
          + waterNoise(waterPosition * 1.73 + vec2(-waterTime * 0.012, waterTime * 0.009)) * 0.35;
        // A broken front travels landward along the public coast-distance
        // field, then leaves a softer wash. No displaced shore or extra draw.
        // Fronts crowd together nearer the shore. Breaking fades where the
        // bathymetry deepens. This is stylised, not a surf simulation.
        float bedDepth = seabedDepth(distance);
        float coastGrain = waterNoise(waterPosition * 5.0);
        float surfPhase = distance * 48.0 * mix(1.35, 1.0, smoothstep(0.0, 0.25, distance)) + waterTime * 0.85 + coastGrain * 1.8;
        float surfAA = clamp(fwidth(surfPhase), 0.06, 0.65);
        float breaker = smoothstep(0.76 - surfAA, 0.98 + surfAA, sin(surfPhase));
        float surfZone = smoothstep(0.005, 0.025, distance) * (1.0 - smoothstep(0.10, 0.30, distance));
        float backwash = (1.0 - smoothstep(0.018, 0.065, distance)) * smoothstep(0.0, 0.012, distance);
        float breakup = smoothstep(0.38, 0.72, foamNoise);
        float shoal = 1.0 - smoothstep(0.07, 0.16, bedDepth);
        // The public signed coast field also makes a fine, derivative-filtered
        // wash. Its width grows with the pixel footprint, so it cannot flicker
        // when the camera crosses an ocean ring or the atlas zooms out.
        float shoreWidth = max(0.011, fwidth(distance) * 1.5);
        float shoreRibbon = smoothstep(0.0, shoreWidth, distance)
          * (1.0 - smoothstep(shoreWidth, shoreWidth + 0.035, distance));
        float shoreBreakup = 0.58 + 0.42 * waterNoise(waterPosition * 5.0 + vec2(waterTime * 0.025, 0.0));
        foam = (breaker * surfZone * breakup * 0.70 + backwash * breakup * 0.18
          + shoreRibbon * shoreBreakup * 0.62) * shoal;
        foam *= 1.0 - smoothstep(0.06, 0.22, length(fwidth(waterPosition)));
        foam *= (1.0 - field.b * 0.92) * (1.0 - ice) * (1.0 - waterSubmerged);
      #endif
      #ifdef WATER_WORLD
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.94, 0.91), foam * 0.72);
      #else
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.83, 0.78), foam * 0.5);
      #endif
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.48, 0.68, 0.73), ice * 0.65);
      diffuseColor.a += (foam * 0.14 + ice * 0.18) * field.g;
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
      #include <roughnessmap_fragment>
      roughnessFactor = mix(0.24, 0.48, waterStorm) + field.b * 0.04 + ice * 0.16;
      #ifdef WATER_WORLD
        roughnessFactor = mix(0.22, 0.44, waterStorm) + field.b * 0.05 + ice * 0.12 + foam * 0.32;
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
      #include <normal_fragment_maps>
      #ifdef WATER_WORLD
        vec2 slope = worldSlope;
      #else
        vec3 wave = waterWaves(waterPosition, waterTime);
        vec2 slope = wave.yz * waterAmplitude * shelter;
      #endif
      #ifdef WATER_FULL
        float ripple = waterRipple(waterPosition);
        vec2 detail = vec2(waterRipple(waterPosition + vec2(0.015, 0.0)) - ripple, waterRipple(waterPosition + vec2(0.0, 0.015)) - ripple);
        // Fade subpixel ripples at fit distance instead of shimmering stripes.
        float rippleDetail = 1.0 - smoothstep(0.015, 0.12, length(fwidth(waterPosition)));
        #ifdef WATER_WORLD
          rippleDetail *= worldResolved;
          slope += detail * mix(0.16, 0.30, waterStorm) * shelter * waterDetail * rippleDetail;
        #else
          slope += detail * mix(0.38, 0.62, waterStorm) * shelter * waterDetail * rippleDetail;
        #endif
      #endif
      normal = normalize(mat3(viewMatrix) * vec3(-slope.x, 1.0, -slope.y));
      #ifdef WATER_WORLD
        normal *= gl_FrontFacing ? 1.0 : -1.0;
        // Slope energy that the wave filter removed, the slope change across this
        // pixel, and the ripple energy that rippleDetail fades out. Converted to GGX
        // roughness as r' = (r^4 + σ²)^(1/4), capped so storms stay readable.
        vec2 slopeDx = dFdx(slope);
        vec2 slopeDy = dFdy(slope);
        float rippleEnergy = 0.0;
        #ifdef WATER_FULL
          // Energy of the ripple slope removed by rippleDetail. Not a simulation.
          float rippleAmplitude = mix(0.16, 0.30, waterStorm) * shelter * waterDetail;
          rippleEnergy = (1.0 - rippleDetail * rippleDetail) * 8.8e-3 * rippleAmplitude * rippleAmplitude;
        #endif
        // An artistic wind proxy, not a simulated regional weather report.
        // Cox–Munk-style total slope variance is split over the two axes before
        // conversion to an isotropic GGX roughness. Only unresolved deep-water
        // detail contributes; ports, ice and the submerged view remain calm.
        float windSpeed = mix(3.0, 9.0, windPatch) + waterStorm * 4.0;
        float windVariance = 0.5 * (0.003 + 0.00512 * windSpeed);
        windVariance *= (1.0 - worldResolved * worldResolved) * shelter * shelter * depth * (1.0 - ice) * (1.0 - waterSubmerged);
        float unresolved = worldVariance + 0.5 * (dot(slopeDx, slopeDx) + dot(slopeDy, slopeDy)) + rippleEnergy + windVariance;
        unresolved = min(unresolved, mix(0.02, 0.05, depth));
        roughnessFactor = max(roughnessFactor, sqrt(sqrt(pow(roughnessFactor, 4.0) + unresolved)));
      #endif
      // Schlick water Fresnel; Standard's BRDF also applies it to sun, candle
      // and PMREM specular. Keep the original printed floor at normal incidence.
      // World alpha reads a half-smoothed normal so sparkle does not toggle opacity.
      // nonPerturbedNormal is face-corrected, so back faces smooth toward the surface.
      #ifdef WATER_WORLD
        vec3 fresnelNormal = normalize(mix(normal, nonPerturbedNormal, 0.45));
      #else
        vec3 fresnelNormal = normal;
      #endif
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(fresnelNormal, normalize(vViewPosition))), 5.0);
      #ifdef WATER_WORLD
        float absorption = 1.0 - 0.52 * exp(-seabedDepth(distance) / 0.34);
        diffuseColor.a = min(0.96, absorption + fresnel * 0.42 + foam * 0.2 + ice * 0.3) * field.g;
        if (waterSubmerged > 0.5) {
          diffuseColor.rgb = mix(vec3(0.18,0.42,0.43), diffuseColor.rgb, 0.35);
          diffuseColor.a = (0.24 + fresnel * 0.45) * field.g;
        }
        #ifdef USE_TRANSMISSION
          diffuseColor.a = 1.0;
        #endif
      #else
        diffuseColor.a = min(0.62 * field.g, diffuseColor.a + fresnel * 0.2 * field.g);
      #endif
    `);
    if (profile == "world" && transmission) {
      // Foam scatters light instead of refracting the seabed like clear water.
      // The same depth/clarity proxy as Balanced absorbs the deep floor while
      // leaving coastal refraction and the submerged view available.
      // Keep Three's installed transmission/refraction path and its one target.
      // The repository's narrow Three declaration omits this runtime export.
      const chunks = (THREE as unknown as { ShaderChunk: { transmission_fragment: string } }).ShaderChunk;
      shader.fragmentShader = shader.fragmentShader.replace("#include <transmission_fragment>", chunks.transmission_fragment
        .replace("material.transmission = transmission;", "material.transmission = transmission * mix(exp(-seabedDepth(distance) / 0.68), 1.0, waterSubmerged) * (1.0 - clamp(foam * 1.35 + ice * 0.7, 0.0, 0.94));")
        .replace("material.thickness = thickness;", "material.thickness = thickness * mix(0.5, 3.5, depth);"));
    }
  };
  material.customProgramCacheKey = () => `tabletop-water-v10:${full}:${profile}:${transmission}`;
  return material;
}

// Composes with the existing paper finish and regional frost, without another
// floor draw. Dispose restores the previous hooks after weather restores ours.
export function attachCaustics(map: THREE.Mesh, uniforms: WaterUniforms, enabled: () => boolean): () => void {
  const material = map.material as WaterMaterial;
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    // Cached Table/World programs share this material's current uniform set.
    Object.assign(shader.uniforms, uniforms);
    if (!enabled()) {
      return;
    }
    shader.fragmentShader = fieldGLSL(uniforms.waterBoardUnit.value) + detailGLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      #ifdef USE_MAP
        if (waterDetail > 0.5) {
          vec4 field = texture2D(waterField, vec2(vMapUv.x, 1.0 - vMapUv.y));
          float shallow = (1.0 - smoothstep(0.08, 0.6, coastDistance(field))) * step(0.0, coastDistance(field));
          float caustic = waterCaustic(vMapUv * waterSize);
          diffuseColor.rgb += vec3(0.065, 0.10, 0.075) * caustic * shallow * field.g * (1.0 - edgeIce(field)) * (1.0 - waterStorm * 0.85);
        }
      #endif
    `);
  };
  material.customProgramCacheKey = () => previousKey.call(material) + `:water-caustics-v1:${enabled()}`;
  material.needsUpdate = true;
  return (): void => {
    material.onBeforeCompile = previousCompile;
    material.customProgramCacheKey = previousKey;
    material.needsUpdate = true;
  };
}

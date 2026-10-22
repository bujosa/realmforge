// Board coordinates are map units in Three, with 100 printed-map pixels per unit.
// Generate GLSL from the same coefficients sampled by the ships: no drifting
// second animation, and no accumulation of offsets between frames.
const waves = [
  { x: 0.94, z: 0.342, frequency: 5.4, speed: 0.72, amplitude: 0.0035 },
  { x: -0.6, z: 0.8, frequency: 9.3, speed: 1.05, amplitude: 0.0019 },
  { x: 0.28, z: -0.96, frequency: 13.7, speed: 1.38, amplitude: 0.0012 },
  { x: 0.8, z: 0.6, frequency: 21, speed: 1.74, amplitude: 0.0006 }
];

export const waveSpectrum = waves;

export const waveGLSL = `
  vec3 waterWaves(vec2 p, float time) {
    vec3 result = vec3(0.0);
    ${waves.map((wave, i) => `
      ${i >= 2 ? "#ifdef WATER_FULL" : ""}
      {
        vec2 k = vec2(${wave.x.toFixed(3)}, ${wave.z.toFixed(3)}) * ${wave.frequency.toFixed(3)};
        float phase = dot(p, k) - time * ${wave.speed.toFixed(3)};
        result += ${wave.amplitude.toFixed(4)} * vec3(sin(phase), cos(phase) * k);
      }
      ${i >= 2 ? "#endif" : ""}
    `).join("\n")}
    return result;
  }
`;

// World fragment only. The same four waves as waterWaves, each faded by its own
// footprint. dpdx and dpdy are the screen-pixel steps of the wave position. A
// wave's footprint is the larger pixel step measured along its own direction k̂,
// in map units, so waves running along the short pixel axis are not over-filtered.
// A wave fades as its crests approach two pixels per cycle (0.35 to 0.7 cycles per
// pixel). amp is waterAmplitude × shelter, the product that scales the vertex.
// variance is the slope energy the fade removed (both axes, scaled by amp).
// curvature is the crest term Σ w·a·|k|²·sin φ per unit amplitude, so whitecap
// thresholds do not depend on storm or tier amplitude. removedCurvature is the
// matching Σ(1−w²)·½·(a·|k|²)² per unit amplitude², the unresolved crest energy.
export const waveGLSLFiltered = `
  vec2 waterSlopeFiltered(vec2 p, float time, vec2 dpdx, vec2 dpdy, float amp, out float variance, out float curvature, out float removedCurvature) {
    vec2 slope = vec2(0.0);
    variance = 0.0;
    curvature = 0.0;
    removedCurvature = 0.0;
    ${waves.map((wave, i) => `
      ${i >= 2 ? "#ifdef WATER_FULL" : ""}
      {
        vec2 k = vec2(${wave.x.toFixed(3)}, ${wave.z.toFixed(3)}) * ${wave.frequency.toFixed(3)};
        float phase = dot(p, k) - time * ${wave.speed.toFixed(3)};
        vec2 khat = normalize(vec2(${wave.x.toFixed(3)}, ${wave.z.toFixed(3)}));
        float fp = max(abs(dot(khat, dpdx)), abs(dot(khat, dpdy)));
        float pass = 1.0 - smoothstep(0.35, 0.7, fp * ${wave.frequency.toFixed(3)} * 0.15915494);
        // At continental scale these miniature bobbing waves represent
        // unresolved sea state. Transfer their energy to roughness below.
        pass *= 1.0 - smoothstep(0.004, 0.025, max(length(dpdx), length(dpdy)));
        float height = ${wave.amplitude.toFixed(4)} * amp;
        float crest = ${wave.amplitude.toFixed(4)} * dot(k, k);
        slope += pass * height * cos(phase) * k;
        variance += (1.0 - pass * pass) * 0.5 * height * height * dot(k, k);
        curvature += pass * crest * sin(phase);
        removedCurvature += (1.0 - pass * pass) * 0.5 * crest * crest;
      }
      ${i >= 2 ? "#endif" : ""}
    `).join("\n")}
    return slope;
  }
`;

export function waveHeight(x: number, z: number, time: number, full: boolean): number {
  let height = 0;
  for (let i = 0; i < (full ? waves.length : 2); i++) {
    const wave = waves[i];
    height += wave.amplitude * Math.sin((x * wave.x + z * wave.z) * wave.frequency - time * wave.speed);
  }
  return height;
}

export function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

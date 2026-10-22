import * as THREE from "three";
type QualityTier = "high" | "balanced" | "low";

export interface VfxOptions { tier: QualityTier; reducedMotion: boolean }
export interface VfxStats { capacity: number; activeParticles: number; drawCalls: number; triangles: number }
export interface VfxHandle<P> {
  object: THREE.Object3D;
  play(params: P): void;
  update(dtMs: number): void;
  setPaused(paused: boolean): void;
  dispose(): void;
  stats(): VfxStats;
}

export interface Particle {
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration?: THREE.Vector3;
  color: THREE.Color;
  delay: number;
  lifetime: number;
  size: number;
  endSize?: number;
  alpha: number;
  arc?: number;
  angle?: number;
  spin?: number;
  aspect?: number;
  /** 0 soft disc, 1 streak, 2 cloth, 3 ground decal, 4 flame. */
  shape?: number;
}

/** One instanced quad batch per family. No textures, lights or AudioContext. */
export function createInstancedVfx<P>(
  options: VfxOptions,
  limits: { high: number; balanced: number },
  emit: (params: P, capacity: number) => Particle[],
): VfxHandle<P> | null {
  const capacity = options.reducedMotion || options.tier === "low" ? 0 : limits[options.tier];
  if (!capacity) return null;

  const geometry = new THREE.PlaneGeometry(1, 1);
  const positions = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity * 2);
  const colors = new Float32Array(capacity * 3);
  const alphas = new Float32Array(capacity);
  const angles = new Float32Array(capacity);
  const shapes = new Float32Array(capacity);
  function attribute(name: string, array: Float32Array, itemSize: number): THREE.InstancedBufferAttribute {
    const value = new THREE.InstancedBufferAttribute(array, itemSize);
    (value as THREE.InstancedBufferAttribute & { setUsage(usage: number): void }).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, value);
    return value;
  }
  const dynamic = [
    attribute("iPosition", positions, 3), attribute("iSize", sizes, 2),
    attribute("iColor", colors, 3), attribute("iAlpha", alphas, 1),
    attribute("iAngle", angles, 1), attribute("iShape", shapes, 1),
  ];
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 iPosition;
      attribute vec2 iSize;
      attribute vec3 iColor;
      attribute float iAlpha;
      attribute float iAngle;
      attribute float iShape;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vShape;
      void main() {
        vUv = uv; vColor = iColor; vAlpha = iAlpha; vShape = iShape;
        vec2 p = position.xy * iSize;
        float c = cos(iAngle), s = sin(iAngle);
        p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        vec4 center = viewMatrix * vec4(iPosition, 1.0);
        if (iShape > 2.5 && iShape < 3.5) {
          vec3 ground = vec3(p.x, 0.0, p.y);
          center = viewMatrix * vec4(iPosition + ground, 1.0);
        } else {
          center.xy += p;
        }
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vShape;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float mask = 1.0 - smoothstep(0.48, 1.0, r);
        if (vShape > 0.5 && vShape < 1.5) mask = (1.0 - smoothstep(0.12, 0.8, abs(p.x))) * (1.0 - smoothstep(0.45, 1.0, abs(p.y)));
        if (vShape > 1.5 && vShape < 2.5) mask = (1.0 - smoothstep(0.80, 1.0, max(abs(p.x), abs(p.y)))) * (0.85 + 0.15 * sin(p.x * 8.0));
        if (vShape > 2.5 && vShape < 3.5) mask = smoothstep(0.95, 0.25, r) * (0.72 + 0.28 * sin(atan(p.y, p.x) * 9.0));
        if (vShape > 3.5) mask = (1.0 - smoothstep(0.55, 1.0, abs(p.x))) * (1.0 - smoothstep(0.55, 1.0, p.y)) * smoothstep(-1.0, 0.5, p.y);
        if (mask * vAlpha < 0.005) discard;
        gl_FragColor = vec4(vColor, mask * vAlpha);
      }
    `,
  });
  const object = new THREE.InstancedMesh(geometry, material, capacity);
  object.count = 0;
  object.frustumCulled = false;
  object.renderOrder = 12;
  object.visible = false;
  let particles: Particle[] = [];
  let clock = 0;
  let paused = false;
  let disposed = false;
  let active = 0;
  const clear = (): void => {
    particles = []; clock = 0; active = 0;
    object.count = 0; object.visible = false;
  };
  // A hidden tab drops the current beat. Returning to it cannot replay history.
  const onVisibility = (): void => { if (document.hidden) clear(); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  return {
    object,
    play(params) {
      if (disposed || (typeof document !== "undefined" && document.hidden)) return;
      particles = emit(params, capacity).slice(0, capacity);
      clock = 0;
      this.update(0);
    },
    update(dtMs) {
      if (disposed || paused) return;
      if (typeof document !== "undefined" && document.hidden) { clear(); return; }
      clock += Math.max(0, Math.min(dtMs, 250));
      let visible = 0;
      for (const particle of particles) {
        const age = clock - particle.delay;
        if (age < 0 || age >= particle.lifetime) continue;
        const t = age / particle.lifetime;
        const seconds = age / 1000;
        const offset = visible * 3;
        positions[offset] = particle.origin.x + particle.velocity.x * seconds + (particle.acceleration?.x || 0) * seconds * seconds * 0.5;
        positions[offset + 1] = particle.origin.y + particle.velocity.y * seconds + (particle.acceleration?.y || 0) * seconds * seconds * 0.5 + (particle.arc || 0) * Math.sin(Math.PI * t);
        positions[offset + 2] = particle.origin.z + particle.velocity.z * seconds + (particle.acceleration?.z || 0) * seconds * seconds * 0.5;
        const size = particle.size + ((particle.endSize ?? particle.size) - particle.size) * t;
        sizes[visible * 2] = size * (particle.aspect || 1);
        sizes[visible * 2 + 1] = size;
        colors[offset] = particle.color.r; colors[offset + 1] = particle.color.g; colors[offset + 2] = particle.color.b;
        alphas[visible] = particle.alpha * Math.sin(Math.PI * Math.min(1, (t + 0.08) / 1.08));
        angles[visible] = (particle.angle || 0) + (particle.spin || 0) * seconds;
        shapes[visible] = particle.shape || 0;
        visible++;
      }
      active = visible;
      object.count = visible;
      object.visible = visible > 0;
      if (visible) dynamic.forEach(value => { value.needsUpdate = true; });
      if (particles.length && particles.every(p => clock >= p.delay + p.lifetime)) clear();
    },
    setPaused(value) { paused = value; },
    dispose() {
      if (disposed) return;
      disposed = true; clear();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      object.parent?.remove(object);
      object.dispose(); geometry.dispose(); material.dispose();
    },
    stats() { return { capacity, activeParticles: active, drawCalls: active ? 1 : 0, triangles: active * 2 }; },
  };
}

import * as THREE from "three";
import { createInstancedVfx, Particle, VfxHandle, VfxOptions } from "../effects/InstancedVfx";

export interface DragonFireCue { from: THREE.Vector3; to: THREE.Vector3; width?: number }
export interface DragonFireHandle extends VfxHandle<DragonFireCue> { follow(origin: THREE.Vector3): void }

/** A 45 m sloping cone, hot core and cooler embers; one draw, no audio/lights. */
export function createDragonFire(options: VfxOptions): DragonFireHandle | null {
  const base = createInstancedVfx<DragonFireCue>(options, { high: 256, balanced: 80 }, ({ from, to, width = 0.36 }, count) => {
    const delta = to.clone().sub(from);
    const axis = new THREE.Vector3(-delta.z, 0, delta.x).normalize();
    const rnd = (i: number, salt: number): number => {
      const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    return Array.from({ length: count }, (_, i): Particle => {
      const t = rnd(i, 1), side = (rnd(i, 2) - 0.5) * width * t;
      const ember = i % 7 == 0;
      return { origin: from.clone().addScaledVector(delta, t * 0.35).addScaledVector(axis, side * 0.3),
        velocity: delta.clone().multiplyScalar(1.2 + rnd(i, 3) * 0.5).addScaledVector(axis, side),
        color: new THREE.Color(ember ? "#f6bc58" : i % 3 == 0 ? "#fff0ad" : "#ef6026"),
        delay: i % 32 * 24, lifetime: 520 + rnd(i, 4) * 280,
        size: ember ? 0.022 : 0.045, endSize: ember ? 0.008 : 0.12,
        alpha: ember ? 0.9 : 0.76, shape: ember ? 1 : 4, aspect: ember ? 0.25 : 1 };
    });
  });
  if (!base) return null;
  const mesh = base.object as THREE.InstancedMesh;
  const material = mesh.material as THREE.ShaderMaterial & { fragmentShader: string };
  material.fragmentShader = `
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vShape;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float noise = sin(p.x * 17.0 + p.y * 29.0) * sin(p.y * 19.0 - p.x * 11.0);
      float r = length(vec2(p.x, p.y * 0.85));
      float mask = (1.0 - smoothstep(0.15, 1.0, r + noise * 0.08));
      if (vShape < 1.5) mask *= 1.0 - smoothstep(0.1, 0.8, abs(p.x));
      float alpha = mask * vAlpha * (0.86 + noise * 0.14);
      if (alpha < 0.005) discard;
      vec3 hot = mix(vec3(1.0, 0.88, 0.5), vColor, smoothstep(0.0, 0.8, r));
      gl_FragColor = vec4(hot, alpha);
    }`;
  material.needsUpdate = true;
  const reference = new THREE.Vector3(), offset = new THREE.Vector3(), applied = new THREE.Vector3();
  let paused = false, disposed = false;
  const translate = (): void => {
    const attr = mesh.geometry.getAttribute("iPosition");
    const dx = offset.x - applied.x, dy = offset.y - applied.y, dz = offset.z - applied.z;
    const count = base.stats().activeParticles;
    for (let i = 0; i < count; i++) attr.setXYZ(i, attr.getX(i) + dx, attr.getY(i) + dy, attr.getZ(i) + dz);
    applied.copy(offset); attr.needsUpdate = true;
  };
  return {
    object: base.object,
    play(cue) { if (paused || disposed) return; reference.copy(cue.from); offset.set(0, 0, 0); applied.set(0, 0, 0); base.play(cue); },
    follow(origin) { if (paused || disposed) return; offset.copy(origin).sub(reference); translate(); },
    update(dt) {
      if (paused || disposed) return;
      // Consume the same presentation delta as the pass. At 1.6 s every
      // particle has expired, so a slow frame never leaves an old jet behind.
      let remaining = Math.min(1600, Math.max(0, dt));
      do { const step = Math.min(250, remaining); base.update(step); remaining -= step; } while (remaining > 0);
      applied.set(0, 0, 0); translate();
    },
    setPaused(value) { paused = value; base.setPaused(value); },
    stats() { return base.stats(); },
    dispose() { disposed = true; base.dispose(); }
  };
}

/** One terrain-conforming batch, at most three scars. Cleared at next round. */
export class DragonScorch {
  readonly object: THREE.Mesh;
  private geometry = new THREE.BufferGeometry();
  private material = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; void main() {
      float noise = sin(vUv.x * 79.0) * sin(vUv.y * 29.0 + vUv.x * 53.0);
      float edge = min(vUv.y, 1.0 - vUv.y) + noise * 0.035;
      float alpha = smoothstep(0.0, 0.24, edge) * smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x) * 0.42;
      if (alpha < 0.005) discard; gl_FragColor = vec4(0.12, 0.085, 0.055, alpha);
    }` });
  private scars: { from: THREE.Vector3; to: THREE.Vector3; width: number }[] = [];
  constructor(private ground: (x: number, z: number) => number) {
    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.name = "dragon-scorch";
    this.object.visible = false;
    this.object.renderOrder = 1;
  }
  add(from: THREE.Vector3, to: THREE.Vector3, width: number): void {
    this.scars.push({ from: from.clone(), to: to.clone(), width });
    this.scars = this.scars.slice(-3);
    const positions: number[] = [], uvs: number[] = [];
    this.scars.forEach(scar => {
      const axis = new THREE.Vector3(-(scar.to.z - scar.from.z), 0, scar.to.x - scar.from.x).normalize();
      const point = (t: number, side: number): number[] => {
        const x = scar.from.x + (scar.to.x - scar.from.x) * t + axis.x * side * scar.width;
        const z = scar.from.z + (scar.to.z - scar.from.z) * t + axis.z * side * scar.width;
        return [x, this.ground(x, z) + 0.008, z];
      };
      for (let i = 0; i < 16; i++) {
        const t = i / 16, u = (i + 1) / 16;
        const a = point(t, -0.45), b = point(t, 0.45), c = point(u, -0.45), d = point(u, 0.45);
        positions.push(...a, ...b, ...c, ...b, ...d, ...c);
        uvs.push(t, 0, t, 1, u, 0, t, 1, u, 1, u, 0);
      }
    });
    this.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    this.geometry.computeVertexNormals(); this.geometry.computeBoundingSphere();
    this.object.visible = true;
  }
  clear(): void { this.scars = []; this.object.visible = false; }
  stats(): { scars: number; drawCalls: number; triangles: number } {
    return { scars: this.scars.length, drawCalls: this.object.visible ? 1 : 0, triangles: this.scars.length * 32 };
  }
  dispose(): void { this.clear(); this.object.parent?.remove(this.object); this.geometry.dispose(); this.material.dispose(); }
}

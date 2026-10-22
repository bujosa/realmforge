import { SceneFrame } from "../core/SceneFrame";
import * as THREE from "three";
export interface WakeField { texture: THREE.Texture; frame: SceneFrame }

interface Wake {
  x: number;
  z: number;
  angle: number;
  started: number;
}

interface Track {
  x: number;
  z: number;
  angle: number;
  stamped: number;
  wakes: Wake[];
}

// A bounded shared instanced draw, clipped by the same sea/readability mask.
// Tracks are presentation-only and removed when their public pieces disappear.
export default class ShipWakes {
  private geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private material: THREE.ShaderMaterial;
  private mesh: THREE.InstancedMesh;
  private object = new THREE.Object3D();
  private color = new THREE.Color("#ffffff");
  private tracks = new Map<string, Track>();
  private time = { value: 0 };

  constructor(private scene: THREE.Object3D, field: WakeField, mapWidth: number, mapHeight: number, private surface: (x: number, z: number) => number, frame: SceneFrame = field.frame) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        wakeTime: this.time,
        wakeField: { value: field.texture },
        wakeSize: { value: new THREE.Vector2(frame.len(mapWidth), frame.len(mapHeight)) }
      },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 wakeUv;
        varying vec2 wakePosition;
        varying float strength;
        void main() {
          wakeUv = uv;
          strength = 0.0;
          #ifdef USE_INSTANCING_COLOR
            strength = instanceColor.r;
          #endif
          vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
          wakePosition = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float wakeTime;
        uniform sampler2D wakeField;
        uniform vec2 wakeSize;
        varying vec2 wakeUv;
        varying vec2 wakePosition;
        varying float strength;
        void main() {
          vec4 field = texture2D(wakeField, wakePosition / wakeSize + 0.5);
          float t = wakeUv.y;
          float x = abs(wakeUv.x - 0.5);
          float feather = max(fwidth(x), 0.018);
          float arms = 1.0 - smoothstep(0.035, 0.035 + feather, abs(x - (0.08 + t * 0.32)));
          float bubbles = 0.55 + 0.45 * sin(t * 47.0 + x * 63.0 - wakeTime * 0.9);
          float fade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.45, 1.0, t));
          float alpha = arms * bubbles * fade * strength * field.g * (1.0 - field.b * 0.65);
          gl_FragColor = vec4(vec3(0.72, 0.87, 0.84), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 256);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.count = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  retain(ids: Set<string>): void {
    this.tracks.forEach((_track, id) => {
      if (!ids.has(id)) {
        this.tracks.delete(id);
      }
    });
  }

  begin(now: number, enabled: boolean): void {
    this.time.value = now / 1000;
    this.mesh.count = 0;
    this.mesh.visible = enabled;
    if (!enabled) {
      this.tracks.clear();
    }
  }

  ship(id: string, x: number, z: number, moving: boolean, now: number): void {
    if (!this.mesh.visible) {
      return;
    }
    let track = this.tracks.get(id);
    if (!track) {
      track = { x, z, angle: 0, stamped: now, wakes: [] };
      this.tracks.set(id, track);
    }
    const dx = x - track.x;
    const dz = z - track.z;
    if (Math.hypot(dx, dz) > 0.002 && moving) {
      track.angle = Math.atan2(dx, dz);
      if (now - track.stamped > 100) {
        track.wakes.push({ x, z, angle: track.angle, started: now });
        if (track.wakes.length > 18) {
          track.wakes.shift();
        }
        track.stamped = now;
      }
    }
    track.x = x;
    track.z = z;
    // Quiet lapping at a stationary hull; the long foam trail requires motion.
    this.place(x - Math.sin(track.angle) * 0.27, z - Math.cos(track.angle) * 0.27, track.angle, moving ? 0.55 : 0.32, moving ? 0.3 : 0.09);
    track.wakes = track.wakes.filter(wake => now - wake.started < 1900);
    track.wakes.forEach(wake => {
      const life = (now - wake.started) / 1900;
      this.place(wake.x, wake.z, wake.angle, 0.45 + life * 0.3, (1 - life) * 0.18);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  private place(x: number, z: number, angle: number, length: number, opacity: number): void {
    if (this.mesh.count >= 256) {
      return;
    }
    this.object.position.set(x, this.surface(x, z) + 0.003, z);
    this.object.rotation.y = angle;
    this.object.scale.set(length * 0.7, 1, length);
    this.object.updateMatrix();
    this.mesh.setMatrixAt(this.mesh.count, this.object.matrix);
    this.color.r = this.color.g = this.color.b = opacity;
    this.mesh.setColorAt(this.mesh.count++, this.color);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.tracks.clear();
  }
}

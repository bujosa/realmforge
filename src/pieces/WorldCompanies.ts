import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SigilAtlas, sigilIdentity } from "../heraldry";
import { finishGeometry } from "./geometry/finish";
import { paintGeometry } from "./sculpt";
import { worldMiniatureColor } from "./miniatures";

const houses = ["stark", "lannister", "baratheon", "greyjoy", "tyrell", "martell", "arryn", "targaryen", "bolton", "neutral"];

/** A company is one reusable sculpt, not six scene nodes or six animation jobs.
 * Neutral vertex paint and a paint mask keep steel/skin/wood independent of the
 * instance's house colour. Both LODs stay inside the previous sculpt's envelope.
 */
export function companyGeometry(type: string, detailed: boolean): THREE.BufferGeometry {
  const Cylinder = THREE.CylinderGeometry as unknown as { new(top: number, bottom: number, height: number, sides: number, segments: number, open: boolean): THREE.BufferGeometry };
  const Box = THREE.BoxGeometry as unknown as { new(w: number, h: number, d: number, segments: number): THREE.BufferGeometry };
  const parts: THREE.BufferGeometry[] = [], sides = detailed ? 8 : 4;
  const iron = "#9aa5ac", dark = "#302b2c", wood = "#62422e", trim = "#ead6ac", skin = "#b68b70";
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, tint = "#ffffff", paint = 1, flex = 0, badge = false): void => {
    const uv = g.getAttribute("uv");
    const positions = g.getAttribute("position");
    let left = Infinity, right = -Infinity;
    if (flex > 0) for (let i = 0; i < positions.count; i++) { left = Math.min(left, positions.getX(i)); right = Math.max(right, positions.getX(i)); }
    const marks = new Float32Array(positions.count * 4);
    for (let i = 0; i < marks.length / 4; i++) {
      marks[i * 4] = paint; marks[i * 4 + 1] = flex > 0 ? (positions.getX(i) - left) / Math.max(0.001, right - left) : flex;
      marks[i * 4 + 2] = badge && uv ? uv.getX(i) : -1;
      marks[i * 4 + 3] = badge && uv ? uv.getY(i) : -1;
    }
    g.setAttribute("army", new THREE.Float32BufferAttribute(marks, 4));
    g.translate(x, y, z);
    const p = g.index ? g.toNonIndexed() : g;
    if (p != g) g.dispose();
    p.deleteAttribute("uv"); parts.push(paintGeometry(p, tint));
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, tint?: string, paint = 1, flex = 0): void =>
    add(new THREE.BoxGeometry(w, h, d), x, y, z, tint, paint, flex);
  const ball = (w: number, h: number, d: number, x: number, y: number, z: number, tint: string, paint = 0, flex = 0): void =>
    add((detailed ? new THREE.SphereGeometry(1, 8, 4) : new THREE.OctahedronGeometry(1)).scale(w, h, d), x, y, z, tint, paint, flex);
  const beam = (a: number[], b: number[], r: number, tint: string, paint = 0, flex = 0): void => {
    const delta = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = new Cylinder(r, r, delta.length(), detailed ? 6 : 3, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    add(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, tint, paint, flex);
  };
  const crest = (w: number, h: number, x: number, y: number, z: number, flex = 0, thickness = 0.008): void => {
    // A solid shield/cloth sits beneath both atlas faces; this isn't a standee.
    add(new THREE.PlaneGeometry(w, h, detailed ? 4 : 1), x, y, z, "#ffffff", 1, flex, true);
    add(new THREE.PlaneGeometry(w, h, detailed ? 4 : 1).rotateY(Math.PI), x, y, z - thickness, "#ffffff", 1, flex, true);
  };
  const standard = (x: number, z: number, top: number): void => {
    beam([x - 0.06, 0.07, z], [x - 0.06, top, z], 0.006, wood);
    const g = new Box(0.15, 0.18, 0.007, detailed ? 6 : 2);
    add(g, x + 0.012, top - 0.11, z, "#ffffff", 1, 1);
    crest(0.125, 0.15, x + 0.012, top - 0.11, z + 0.005, 1);
    add(new THREE.ConeGeometry(0.012, 0.025, sides), x - 0.06, top + 0.012, z, trim, 0);
  };
  const soldier = (x: number, z: number, scale = 1, lift = 0, bearer = false, shift = false): void => {
    const before = parts.length, flex = shift ? -1 : 0;
    for (const side of [-1, 1]) {
      beam([side * 0.018, 0.02, 0], [side * 0.018, 0.13, 0], 0.012, dark, 0, flex);
      if (detailed) box(0.025, 0.018, 0.04, side * 0.018, 0.02, 0.009, dark, 0, flex);
    }
    add(new Cylinder(0.032, 0.043, 0.135, sides, 1, true), 0, 0.175, 0, "#ffffff", 1, flex);
    ball(0.032, 0.035, 0.029, 0, 0.28, 0, skin, 0, flex);
    add(new THREE.ConeGeometry(0.036, 0.06, sides), 0, 0.307, 0, iron, 0, flex);
    if (detailed) {
      box(0.047, 0.009, 0.01, 0, 0.288, 0.026, dark, 0, flex);
      beam([-0.035, 0.23, 0], [-0.052, 0.18, 0.02], 0.012, iron, 0, flex);
      beam([0.035, 0.23, 0], [0.048, 0.17, 0], 0.012, iron, 0, flex);
      box(0.067, 0.012, 0.056, 0, 0.16, 0, dark, 0, flex);
    }
    box(0.062, 0.09, 0.012, -0.033, 0.178, 0.038, trim, 0, flex);
    if (detailed) box(0.052, 0.077, 0.014, -0.033, 0.178, 0.04, "#ffffff", 1, flex);
    crest(0.049, 0.07, -0.033, 0.178, 0.049, flex);
    if (!bearer) {
      beam([0.046, 0.08, 0], [0.046, 0.43, 0], 0.0045, wood, 0, flex);
      add(new THREE.ConeGeometry(0.012, 0.042, sides), 0.046, 0.45, 0, iron, 0, flex);
    }
    for (let i = before; i < parts.length; i++) parts[i].scale(scale, scale, scale).translate(x, 0.066 + lift, z);
  };
  const radius = type == "ship" ? 0.29 : type == "siege-engine" ? 0.245 : type == "knight" ? 0.235 : 0.195;
  add(new THREE.CylinderGeometry(radius, radius * 1.04, 0.065, detailed ? 24 : 12), 0, 0.0325, 0);
  // Flat annulus rather than a torus: same light rim, fewer subpixel triangles.
  add(new THREE.RingGeometry(radius * 0.94, radius, detailed ? 24 : 12).rotateX(-Math.PI / 2), 0, 0.066, 0, trim, 0);
  if (type == "footman") {
    for (const z of [-0.072, 0.072]) for (const x of [-0.108, 0, 0.108]) soldier(x, z, 1, 0, x == 0 && z < 0, x < 0 && z > 0);
    standard(0, -0.075, 0.83);
  } else if (type == "knight") {
    for (const [x, z] of [[-0.108, 0.07], [0.108, 0.07], [0, -0.125]]) {
      ball(0.044, 0.065, 0.10, x, 0.215, z, wood);
      box(0.088, 0.025, 0.10, x, 0.263, z, "#ffffff");
      for (const side of [-1, 1]) for (const end of [-1, 1]) beam([x + side * 0.032, 0.20, z + end * 0.065], [x + side * 0.032, 0.078, z + end * 0.067], 0.011, dark);
      beam([x, 0.22, z - 0.062], [x, 0.32, z - 0.10], 0.027, wood);
      ball(0.026, 0.032, 0.046, x, 0.332, z - 0.11, wood);
      if (detailed) {
        for (const side of [-1, 1]) add(new THREE.ConeGeometry(0.008, 0.03, 4), x + side * 0.015, 0.365, z - 0.10, dark, 0);
        beam([x, 0.23, z + 0.08], [x, 0.13, z + 0.13], 0.009, dark);
      }
      soldier(x, z, 0.84, 0.22, true);
      beam([x + 0.045, 0.28, z], [x + 0.045, 0.91, z], 0.0045, wood);
      add(new THREE.ConeGeometry(0.012, 0.04, sides), x + 0.045, 0.93, z, iron, 0);
    }
    standard(0, -0.125, 1.09);
  } else if (type == "siege-engine") {
    box(0.19, 0.045, 0.27, 0, 0.15, 0, wood, 0);
    for (const side of [-1, 1]) {
      for (const z of [-0.09, 0.09]) add(new THREE.CylinderGeometry(0.055, 0.055, 0.028, sides).rotateZ(Math.PI / 2), side * 0.11, 0.12, z, dark, 0);
      for (const z of [-0.10, 0.10]) beam([side * 0.065, 0.17, z], [side * 0.065, 0.40, 0], 0.018, wood);
      soldier(side * 0.17, 0.015, 0.69, 0, true);
    }
    beam([-0.10, 0.40, 0], [0.10, 0.40, 0], 0.013, iron);
    beam([0, 0.21, 0.16], [0, 0.76, -0.20], 0.016, wood);
    box(0.09, 0.09, 0.09, 0, 0.27, 0.12, dark, 0);
    ball(0.05, 0.055, 0.05, 0, 0.76, -0.20, dark);
    if (detailed) beam([0, 0.76, -0.20], [0, 0.51, -0.24], 0.003, trim);
    box(0.10, 0.13, 0.012, 0, 0.31, 0.09);
    crest(0.085, 0.11, 0, 0.31, 0.098);
  } else if (type == "ship") {
    ball(0.145, 0.09, 0.38, 0, 0.15, 0, wood);
    box(0.24, 0.035, 0.57, 0, 0.205, 0);
    box(0.17, 0.012, 0.49, 0, 0.226, 0, wood, 0);
    beam([0, 0.17, -0.36], [0, 0.29, -0.39], 0.02, trim);
    beam([0, 0.20, 0], [0, 0.73, 0], 0.012, dark);
    add(new Box(0.35, 0.32, 0.014, detailed ? 6 : 2), 0, 0.49, 0.025, "#ffffff", 1, 1);
    crest(0.30, 0.27, 0, 0.49, 0.034, 1, 0.018);
    beam([-0.20, 0.66, 0.025], [0.20, 0.66, 0.025], 0.01, trim);
    for (const side of [-1, 1]) for (const z of [-0.20, -0.07, 0.07, 0.20]) {
      beam([side * 0.09, 0.235, z], [side * 0.198, 0.18, z + 0.045], 0.005, trim);
      if (detailed || Math.abs(z) > 0.15) {
        ball(0.014, 0.021, 0.018, side * 0.06, 0.257, z, "#ffffff", 1);
        ball(0.012, 0.012, 0.012, side * 0.06, 0.29, z, skin);
      }
    }
  }
  const result = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  if (!result) throw new Error("Could not assemble World company");
  // finishGeometry owns cavity paint and UVs; the army attribute preserves the
  // separate local badge coordinates when that common finish replaces UVs.
  return finishGeometry(result);
}

/** Scene-owned atlas, materials and one GPU clock. No per-soldier CPU work. */
export default class WorldCompanies {
  private atlas = new SigilAtlas();
  private time = { value: 0 };
  private life = { value: 0 };
  private identitySwap = { value: 0 };
  private until = 0;
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private tints = new WeakMap<THREE.Material, THREE.Color>();

  material(house: string, color: string): THREE.MeshStandardMaterial {
    const key = house + color;
    let material = this.materials.get(key);
    if (material) return material;
    const tint = new THREE.Color(worldMiniatureColor(house, color));
    material = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.78, metalness: 0,
      emissive: "#ffffff", emissiveIntensity: 0, toneMapped: false, transparent: true });
    Object.assign(material, { fog: false });
    this.tints.set(material, tint);
    const palette = houses.slice(0, -1).map((h, i) => {
      const c = new THREE.Color(worldMiniatureColor(h, "#C8A45D"));
      return `if (distance(vArmyTint, vec3(${c.r.toFixed(7)},${c.g.toFixed(7)},${c.b.toFixed(7)})) < 0.001) index = ${i.toFixed(1)};`;
    }).join("\n");
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { armyTint: { value: tint }, armyAtlas: { value: this.atlas.texture }, armyTime: this.time, armyLife: this.life, armyIdentitySwap: this.identitySwap });
      shader.vertexShader = `attribute vec4 army; uniform vec3 armyTint; uniform float armyTime; uniform float armyLife;
        varying vec3 vArmyTint; varying vec2 vArmyBadge; varying float vArmyPaint;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>", `#include <color_vertex>
        vColor.rgb = color.rgb; vArmyTint = armyTint;
        #ifdef USE_INSTANCING_COLOR
          vArmyTint = instanceColor;
        #endif
        vArmyBadge = army.zw; vArmyPaint = army.x;`);
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 armyOrigin = modelMatrix[3].xyz;
        #ifdef USE_INSTANCING
          armyOrigin += instanceMatrix[3].xyz;
        #endif
        float phase = dot(armyOrigin.xz, vec2(13.0, 7.0));
        float wave = sin(armyTime * 2.4 + phase + position.x * 22.0 + position.y * 9.0);
        if (army.y > 0.0) transformed.z += wave * 0.006 * armyLife * army.y;
        if (army.y < -0.5) transformed.x += sin(armyTime * 1.7 + phase) * 0.003 * armyLife * smoothstep(0.1, 0.4, position.y);`);
      shader.fragmentShader = `uniform sampler2D armyAtlas; uniform float armyIdentitySwap;
        varying vec3 vArmyTint; varying vec2 vArmyBadge; varying float vArmyPaint;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(1.0), vArmyTint, vArmyPaint);
        if (vArmyBadge.x >= 0.0 && vArmyBadge.y >= 0.0) {
          float index = 9.0;
          ${palette}
          if (index < 0.5 && armyIdentitySwap > 0.5) index = 8.0;
          vec2 tile = vec2(mod(index, 4.0), 3.0 - floor(index / 4.0));
          float mark = texture2D(armyAtlas, (tile + vec2(0.0625) + vArmyBadge * 0.875) / 4.0).a;
          vec3 ink = index == 2.0 || index == 5.0 ? vec3(0.025, 0.022, 0.025) : vec3(0.82, 0.70, 0.43);
          diffuseColor.rgb = mix(diffuseColor.rgb, ink, mark);
        }`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance *= vArmyTint * vArmyPaint;`);
    };
    material.customProgramCacheKey = () => "world-company-v1";
    this.materials.set(key, material);
    return material;
  }

  tintFor(material: THREE.Material): THREE.Color | undefined { return this.tints.get(material); }

  get batchMaterial(): THREE.MeshStandardMaterial { return this.material("", "#ffffff"); }
  warmupMaterials(): THREE.Material[] { return [...this.materials.values(), this.batchMaterial]; }

  /** Called only after a new viewer-public movement/combat/event, never mount/seek. */
  cue(clock: number): void { this.until = clock + 4000; }

  render(clock: number, enabled: boolean, reduced: boolean, paused: boolean, emission: number): boolean {
    this.identitySwap.value = sigilIdentity("stark") == "bolton" ? 1 : 0;
    this.materials.forEach(m => { m.emissiveIntensity = emission; });
    if (reduced || !enabled) { this.life.value = 0; this.until = 0; return false; }
    this.time.value = clock / 1000;
    this.life.value = Math.min(1, Math.max(0, this.until - clock) / 500);
    return !paused && clock < this.until;
  }

  dispose(): void { this.materials.forEach(m => m.dispose()); this.materials.clear(); this.atlas.dispose(); this.until = 0; }
}

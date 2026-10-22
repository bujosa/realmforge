import * as THREE from "three";
import { type Control } from "./registry";
import { castlePalettes, type CastleStyle } from "../src/castles/castleStyles";
import CastleMaterial from "../src/materials/CastleMaterial";
import { HeroMaterial } from "../src/cities/ComplexMaterial";
import { complexGeometry, heroGeometry } from "../src/cities/ComplexGeometry";
import { planComplex, type ComplexGround } from "../src/cities/ComplexPlan";
export const styles = Object.keys(castlePalettes) as CastleStyle[];
export const detail: Control = { type: "boolean", label: "Detailed geometry", default: true };
export const styleControl = (style: string): Control => ({ type: "select", label: "Architecture", default: style, options: styles });
export const mesh = (geometry: THREE.BufferGeometry, castle = false): THREE.Mesh => new THREE.Mesh(geometry, castle ? new CastleMaterial() : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
export function finish<T>(steps: Generator<void, T, void>): T { let step = steps.next(); while (!step.done) step = steps.next(); return step.value; }
export function groundFor(kind: string): ComplexGround {
  // Island recipe expects sea-level stacks. All other seats use a deterministic flat QA site.
  return { height: () => kind === "pyke" ? 3.1 : 0, wet: (x, z) => kind === "pyke" && (z > 130 || x > 200), reserved: () => false, own: () => true };
}
export function seatObject(kind: string, style: CastleStyle, detailed: boolean, seed = 1): THREE.Group {
  const plan = planComplex({ id: `${kind}-${seed}`, kind, level: 2, style, seaward: [0, 1] }, groundFor(kind));
  if (!plan) throw new Error(`No QA plan for ${kind}`);
  const group = new THREE.Group();
  const geometry = finish(complexGeometry(plan, detailed));
  group.add(mesh(geometry, true));
  const hero = finish(heroGeometry(plan, detailed));
  if (hero) group.add(new THREE.Mesh(hero, new HeroMaterial()));
  return group;
}

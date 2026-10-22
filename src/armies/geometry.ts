import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ArmyDetail, ArmyType } from "./types";

type V = [number, number, number];
export const PART = { body: 0, leftLeg: 1, rightLeg: 2, weapon: 3, shield: 4, cloth: 5, head: 6, tail: 7, arm: 8, oar: 9, leftWing: 10, rightWing: 11, dust: 12, plinth: 13 } as const;
const steel = "#697d88", leather = "#352c28", wood = "#715138", skin = "#bf9677", linen = "#e9dfbf";

/** One merged, vertex-painted company. Part pivots and soldier roots survive merging. */
export function armyGeometry(type: ArmyType, detail: ArmyDetail, far = false): THREE.BufferGeometry {
  const high = detail === "high" && !far;
  const low = detail === "low" || far;
  const sides = high ? 6 : 4;
  const parts: THREE.BufferGeometry[] = [];
  let root: V = [0, 0, 0], personScale = 1, phase = 0, shade = 1;
  const add = (g: THREE.BufferGeometry, tint = "#ffffff", paint = 0, id: number = PART.body, pivot: V = [0, 0, 0], badge = false): void => {
    const geometry = g.index ? g.toNonIndexed() : g;
    if (geometry !== g) g.dispose();
    const pos = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
    const count = pos.count, colors = new Float32Array(count * 3), army = new Float32Array(count * 4), pivots = new Float32Array(count * 3), people = new Float32Array(count * 4);
    const color = new THREE.Color(tint).multiplyScalar(shade);
    for (let i = 0; i < count; i++) {
      colors.set([color.r, color.g, color.b], i * 3);
      army.set([id, paint, badge && uv ? uv.getX(i) : -1, badge && uv ? uv.getY(i) : -1], i * 4);
      pivots.set([pivot[0] * personScale + root[0], pivot[1] * personScale + root[1], pivot[2] * personScale + root[2]], i * 3);
      people.set([root[0], root[1], root[2], phase], i * 4);
    }
    geometry.scale(personScale, personScale, personScale).translate(...root);
    geometry.deleteAttribute("uv");
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("army", new THREE.BufferAttribute(army, 4));
    geometry.setAttribute("pivot", new THREE.BufferAttribute(pivots, 3));
    geometry.setAttribute("soldier", new THREE.BufferAttribute(people, 4));
    parts.push(geometry);
  };
  const box = (size: V, at: V, tint = wood, paint = 0, id: number = PART.body, pivot: V = at): void => add(new THREE.BoxGeometry(...size).translate(...at), tint, paint, id, pivot);
  const ball = (size: V, at: V, tint = steel, paint = 0, id: number = PART.body, pivot: V = at): void => {
    const g = low ? new THREE.OctahedronGeometry(1) : new THREE.SphereGeometry(1, high ? 8 : 6, high ? 4 : 3);
    add(g.scale(...size).translate(...at), tint, paint, id, pivot);
  };
  const beam = (a: V, b: V, r: number, tint = wood, paint = 0, id: number = PART.body, pivot: V = a): void => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = new THREE.CylinderGeometry(r * 0.85, r, d.length(), sides, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    add(g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tint, paint, id, pivot);
  };
  const cone = (r: number, h: number, at: V, tint = steel, paint = 0): void => add(new THREE.ConeGeometry(r, h, sides).translate(...at), tint, paint);
  const cloth = (w: number, h: number, at: V, id: number = PART.cloth, pivot: V = at): void => {
    // Double-sided shader mirrors the UV on the reverse: both sides carry the sigil.
    add(new THREE.PlaneGeometry(w, h, high ? 6 : 3, high ? 3 : 1).translate(...at), "#ffffff", 1, id, pivot, true);
  };
  const shield = (at: V): void => {
    const outline = new THREE.Shape();
    outline.moveTo(-0.064, 0.08); outline.lineTo(0.064, 0.08); outline.lineTo(0.056, -0.028); outline.lineTo(0, -0.098); outline.lineTo(-0.056, -0.028); outline.closePath();
    const outer = new THREE.ShapeGeometry(outline);
    // A convex heater shield, rather than a rectangular block.
    const p = outer.getAttribute("position"), u = outer.getAttribute("uv");
    for (let i = 0; i < p.count; i++) { u.setXY(i, (p.getX(i) + 0.064) / 0.128, (p.getY(i) + 0.098) / 0.178); p.setZ(i, 0.014 * (1 - Math.abs(p.getX(i)) / 0.064)); }
    add(outer.clone().scale(1.24, 1.18, 1).translate(at[0], at[1], at[2] + 0.004), "#ffffff", 2, PART.shield, at);
    add(outer.rotateY(Math.PI).translate(...at), "#ffffff", 1, PART.shield, at, true);
  };
  const standard = (at: V, top: number): void => {
    beam(at, [at[0], top, at[2]], 0.008, wood);
    cone(0.018, 0.045, [at[0], top + 0.015, at[2]], "#ffffff", 2);
    cloth(0.52, 0.45, [at[0] + 0.265, top - 0.245, at[2]], PART.cloth, [at[0], top - 0.19, at[2]]);
  };
  const person = (at: V, index: number, bearer = false, captain = false, mounted = false, size = 1): void => {
    root = at; phase = index * 2.39996;
    const rand = Math.sin(index * 73.13 + 42.91) * 43758.5453 % 1;
    personScale = size; shade = 0.96 + Math.abs(rand) * 0.08;
    const hip = mounted ? 0.15 : 0.215;
    const top = mounted ? 0.38 : 0.445;
    for (const side of [-1, 1]) {
      const id = side < 0 ? PART.leftLeg : PART.rightLeg;
      const start: V = [side * 0.029, hip, 0];
      const knee: V = [side * (mounted ? 0.075 : 0.03), mounted ? 0.075 : 0.115, mounted ? 0.01 : -0.006];
      const foot: V = [knee[0], mounted ? 0.015 : 0.026, 0.006];
      beam(start, knee, 0.021, leather, 0, id, start);
      if (!low) beam(knee, foot, 0.016, steel, 0, id, start);
      else beam(knee, foot, 0.013, leather, 0, id, start);
      if (high) box([0.032, 0.029, 0.068], [foot[0], foot[1] - 0.01, foot[2] - 0.016], leather, 0, id, start);
    }
    add(new THREE.CylinderGeometry(0.049, 0.069, 0.185, sides, 1, true).scale(1, 1, 0.78).translate(0, hip + 0.065, 0), "#ffffff", 1);
    // A broad surcoat, including the shoulders, reads as cloth from overhead.
    box([0.127, 0.018, 0.094], [0, hip + 0.141, 0], "#ffffff", 2);
    box([0.102, 0.024, 0.079], [0, hip + 0.15, 0], "#ffffff", 1);
    box([0.133, 0.012, 0.101], [0, hip - 0.025, 0], "#ffffff", 2);
    if (!low) {
      box([0.112, 0.017, 0.07], [0, hip + 0.04, 0], leather);
      box([0.019, 0.022, 0.075], [0, hip + 0.04, -0.002], "#ffffff", 2);
    }
    beam([-0.053, hip + 0.125, 0], [-0.079, hip + 0.055, -0.015], 0.019, steel);
    beam([0.053, hip + 0.125, 0], [0.079, hip + 0.065, -0.02], 0.018, steel, 0, PART.weapon, [0.064, hip + 0.1, 0]);
    ball([0.034, 0.038, 0.031], [0, top - 0.01, 0], skin, 0, PART.head, [0, top - 0.035, 0]);
    add(new THREE.SphereGeometry(0.038, sides, 3, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, top, 0), steel, 0, PART.head, [0, top - 0.035, 0]);
    if (!low) {
      box([0.071, 0.011, 0.013], [0, top - 0.002, -0.028], "#ffffff", 2, PART.head, [0, top - 0.035, 0]);
      box([0.009, 0.033, 0.012], [0, top - 0.02, -0.03], steel, 0, PART.head, [0, top - 0.035, 0]);
    }
    shield([-0.073, hip + 0.065, -0.048]);
    if (captain) {
      cone(0.024, 0.08, [0, top + 0.065, 0], "#ffffff", 2);
      cloth(0.095, 0.19, [0, hip + 0.055, 0.052], PART.body);
    }
    if (!bearer) {
      const p: V = [0.081, hip + 0.1, 0];
      const end = mounted ? top + 0.49 : top + 0.22;
      beam([0.081, 0.065, 0], [0.081, end, 0], 0.0055, wood, 0, PART.weapon, p);
      add(new THREE.ConeGeometry(0.014, 0.065, sides).translate(0.081, end + 0.027, 0), steel, 0, PART.weapon, p);
      if (mounted) cloth(0.15, 0.085, [0.16, end - 0.065, 0], PART.weapon, p);
    }
    root = [0, 0, 0]; personScale = 1; shade = 1;
  };
  if (type === "footman") {
    // Nine distinct, seven-head-tall soldiers in three ranks. Captain leads; bearer sits in the rear rank.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      person([(col - 1) * 0.26, 0, (row - 1) * 0.29], i, i === 7, i === 1);
    }
    standard([0.075, 0, 0.29], 0.94);
  } else if (type === "knight") {
    for (let i = 0; i < (low ? 3 : 4); i++) {
      const x = (i % 2 - 0.5) * 0.48, z = (Math.floor(i / 2) - 0.5) * 0.65;
      root = [x, 0, z]; phase = i * 2.4;
      const coat = ["#6a4531", "#9b7960", "#4b3830", "#b0a38c"][i];
      ball([0.108, 0.135, 0.24], [0, 0.34, 0], coat);
      // Long sloping neck and projecting muzzle make cavalry readable from above.
      beam([0, 0.36, -0.16], [0, 0.58, -0.26], 0.065, coat, 0, PART.head, [0, 0.39, -0.17]);
      ball([0.052, 0.066, 0.1], [0, 0.57, -0.31], coat, 0, PART.head, [0, 0.39, -0.17]);
      for (const s of [-1, 1]) {
        add(new THREE.ConeGeometry(0.017, 0.07, 4).translate(s * 0.034, 0.65, -0.28), coat, 0, PART.head, [0, 0.39, -0.17]);
        for (const end of [-1, 1]) {
          const p: V = [s * 0.075, 0.31, end * 0.155];
          const id = (s * end > 0) ? PART.leftLeg : PART.rightLeg;
          beam(p, [s * 0.076, 0.16, end * 0.17], 0.022, coat, 0, id, p);
          beam([s * 0.076, 0.16, end * 0.17], [s * 0.077, 0.035, end * 0.18], 0.015, leather, 0, id, p);
          if (high) box([0.035, 0.035, 0.06], [s * 0.077, 0.023, end * 0.18 - 0.012], leather, 0, id, p);
        }
        // Caparison drapes over the flanks; contrasting hem remains visible on dark houses.
        box([0.016, 0.21, 0.34], [s * 0.106, 0.32, 0.045], "#ffffff", 1);
        box([0.020, 0.017, 0.35], [s * 0.106, 0.225, 0.045], "#ffffff", 2);
      }
      beam([0, 0.43, -0.2], [0, 0.58, -0.27], 0.018, leather, 0, PART.head, [0, 0.39, -0.17]);
      beam([0, 0.36, 0.2], [0, 0.12, 0.34], 0.024, leather, 0, PART.tail, [0, 0.36, 0.2]);
      box([0.22, 0.025, 0.33], [0, 0.451, 0.045], "#ffffff", 1);
      box([0.15, 0.035, 0.16], [0, 0.478, 0.025], leather);
      root = [0, 0, 0];
      person([x, 0.43, z], i, i === 2, i === 0, true, 0.9);
      if (i === 2) standard([x + 0.08, 0.48, z], 1.38);
    }
  } else if (type === "siege-engine") {
    for (const s of [-1, 1]) {
      box([0.06, 0.07, 0.87], [s * 0.23, 0.095, 0]);
      for (const z of [-0.32, 0.32]) {
        add(new THREE.CylinderGeometry(0.092, 0.092, 0.04, high ? 10 : 6).rotateZ(Math.PI / 2).translate(s * 0.29, 0.095, z), wood);
        beam([s * 0.23, 0.13, z], [s * 0.18, 0.68, 0], 0.028);
      }
    }
    beam([-0.27, 0.68, 0], [0.27, 0.68, 0], 0.033, steel);
    const pivot: V = [0, 0.68, 0];
    beam([0, 0.42, 0.24], [0, 1.02, -0.62], 0.029, wood, 0, PART.arm, pivot);
    box([0.22, 0.22, 0.18], [0, 0.37, 0.27], "#77726a", 0, PART.arm, pivot);
    beam([0, 1.02, -0.62], [0, 0.62, -0.73], 0.008, linen, 0, PART.arm, pivot);
    ball([0.06, 0.055, 0.07], [0, 0.62, -0.73], "#5d5952", 0, PART.arm, pivot);
    ball([0.045, 0.045, 0.045], [0, 0.62, -0.73], "#5d5952", 0, 14, pivot);
    for (let i = 0; i < 3; i++) person([i === 2 ? 0 : (i ? 0.48 : -0.48), 0, i === 2 ? 0.5 : 0.03], i, true, i === 2, false, 0.83);
    cloth(0.22, 0.23, [0, 0.31, 0.39], PART.body);
  } else if (type === "ship") {
    // Lofted, pointed hull with deck and raised bow/stern. No oval toy base.
    const stations = [[-0.78, 0.025], [-0.57, 0.17], [0, 0.23], [0.54, 0.18], [0.72, 0.045]];
    const positions: number[] = [];
    for (let i = 0; i < stations.length - 1; i++) for (const side of [-1, 1]) {
      const [za, wa] = stations[i], [zb, wb] = stations[i + 1];
      const a: V = [side * wa, 0.28, za], b: V = [side * wb, 0.28, zb], c: V = [side * wa * 0.6, 0.08, za], d: V = [side * wb * 0.6, 0.08, zb];
      [a, b, c, b, d, c].forEach(v => positions.push(...v));
      beam([side * wa, 0.265, za], [side * wb, 0.265, zb], 0.022, "#ffffff", 1);
      beam([side * wa, 0.3, za], [side * wb, 0.3, zb], 0.012, "#ffffff", 2);
    }
    const hull = new THREE.BufferGeometry(); hull.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); hull.computeVertexNormals(); add(hull, wood);
    box([0.33, 0.032, 1.14], [0, 0.245, 0]);
    beam([0, 0.25, -0.7], [0, 0.44, -0.79], 0.03, "#ffffff", 2);
    cone(0.045, 0.12, [0, 0.48, -0.79], "#ffffff", 2);
    beam([0, 0.25, 0], [0, 1.28, 0], 0.018);
    beam([-0.4, 1.19, 0], [0.4, 1.19, 0], 0.014);
    cloth(0.78, 0.65, [0, 0.85, 0.015]);
    for (const s of [-1, 1]) {
      if (!low) beam([0, 1.23, 0], [s * 0.19, 0.28, 0.5], 0.004, linen);
      for (let i = 0; i < (low ? 4 : 6); i++) {
        const z = (i - (low ? 1.5 : 2.5)) * (low ? 0.23 : 0.17), p: V = [s * 0.17, 0.27, z];
        beam(p, [s * 0.58, 0.12, z + 0.13], 0.011, linen, 0, PART.oar, p);
        box([0.07, 0.012, 0.13], [s * 0.57, 0.12, z + 0.13], wood, 0, PART.oar, p);
      }
    }
    for (let i = 0; i < 3; i++) person([(i % 2 - 0.5) * 0.16, 0.265, i === 2 ? 0.41 : -0.35], i, true, i === 2, false, 0.58);
    beam([0, 0.28, 0.59], [0, 0.57, 0.61], 0.01, steel);
    box([0.065, 0.085, 0.065], [0, 0.56, 0.61], "#ffd18a");
  } else {
    // Same wyvern silhouette as the current sculpt: two hind legs, arched neck,
    // scalloped membranes and a long tapered tail. Rebuilt at the company budget.
    ball([0.19, 0.2, 0.32], [0, 0.36, 0.02], "#66636a");
    beam([0, 0.4, -0.18], [0, 0.67, -0.44], 0.105, "#66636a", 0, PART.head, [0, 0.4, -0.18]);
    ball([0.095, 0.085, 0.17], [0, 0.67, -0.52], "#66636a", 0, PART.head, [0, 0.4, -0.18]);
    for (const s of [-1, 1]) {
      beam([s * 0.13, 0.29, 0.1], [s * 0.2, 0.08, -0.03], 0.065, "#66636a", 0, s < 0 ? PART.leftLeg : PART.rightLeg, [s * 0.13, 0.29, 0.1]);
      box([0.12, 0.03, 0.18], [s * 0.2, 0.03, -0.07], "#cabb9b");
      beam([s * 0.065, 0.73, -0.45], [s * 0.12, 0.84, -0.35], 0.02, "#d2c29f", 0, PART.head, [0, 0.4, -0.18]);
      ball([0.018, 0.015, 0.018], [s * 0.085, 0.7, -0.59], "#efc366", 0, PART.head, [0, 0.4, -0.18]);
      const pivot: V = [s * 0.13, 0.48, -0.05], id = s < 0 ? PART.leftWing : PART.rightWing;
      const outline: V[] = [pivot, [s * 0.42, 0.72, -0.28], [s * 0.82, 0.66, -0.2], [s * 1.02, 0.54, 0.05], [s * 0.72, 0.44, 0.01], [s * 0.85, 0.4, 0.32], [s * 0.55, 0.35, 0.19], [s * 0.56, 0.27, 0.52], [s * 0.25, 0.28, 0.3], [s * 0.14, 0.3, 0.2]];
      const shape = new THREE.BufferGeometry(), p: number[] = [];
      for (let i = 1; i < outline.length - 1; i++) p.push(...outline[0], ...outline[i], ...outline[i + 1]);
      shape.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); shape.computeVertexNormals(); add(shape, "#ffffff", 1, id, pivot);
      for (const i of [1, 2, 3, 5, 7]) beam(pivot, outline[i], 0.012, "#c3b18f", 0, id, pivot);
    }
    const tail: V = [0, 0.32, 0.25];
    beam(tail, [0.1, 0.18, 0.61], 0.06, "#66636a", 0, PART.tail, tail);
    beam([0.1, 0.18, 0.61], [0.27, 0.08, 0.88], 0.029, "#66636a", 0, PART.tail, tail);
    for (let i = 0; i < 6; i++) cone(0.033, 0.09, [0, 0.56 - i * 0.03, -0.18 + i * 0.1], "#d2c29f");
  }
  root = [0, 0, 0]; personScale = 1; phase = 0;
  const radius = type === "dragon" ? 0.82 : type === "ship" ? 0.7 : type === "knight" ? 0.64 : 0.55;
  add(new THREE.CylinderGeometry(radius, radius * 1.03, 0.055, low ? 12 : 24).translate(0, -0.027, 0), "#4d4842", 0, PART.plinth);
  if (type !== "ship" && type !== "dragon") for (let i = 0; i < 4; i++) {
    phase = i * 1.7;
    add(new THREE.PlaneGeometry(0.12, 0.12).rotateX(-Math.PI / 2).translate((i % 2 - 0.5) * 0.5, 0.015, (Math.floor(i / 2) - 0.5) * 0.5), "#b8a484", 0, PART.dust);
  }
  const merged = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  if (!merged) throw new Error(`Could not assemble ${type}`);
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

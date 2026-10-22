import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { emblemGeometry } from "../heraldry/index";
import { finishGeometry } from "../core/finish";

export function castleBanner(house: string, color: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, tint: string): void => {
    const part = g.index ? g.toNonIndexed() : g;
    if (part != g) { g.dispose(); }
    part.deleteAttribute("uv");
    part.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(part.getAttribute("position").count * 2), 2));
    parts.push(paintGeometry(part, tint));
  };
  add(new THREE.CylinderGeometry(0.004, 0.006, 0.15, 6).translate(0, 0.075, 0), "#bfb099");
  const flag = new THREE.Shape();
  flag.moveTo(0.005, 0.062); flag.lineTo(0.10, 0.058); flag.lineTo(0.087, 0.10); flag.lineTo(0.10, 0.145); flag.lineTo(0.005, 0.145); flag.closePath();
  add(new THREE.ExtrudeGeometry(flag, { depth: 0.003, bevelEnabled: false }), color);
  [-1, 1].forEach(side => {
    const crest = emblemGeometry(house).scale(0.04, 0.04, 0.025);
    if (side < 0) { crest.rotateY(Math.PI); }
    crest.translate(0.047, 0.104, side > 0 ? 0.004 : -0.001);
    add(crest, "#f5e2b9");
  });
  const result = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!result) { throw new Error("Could not assemble castle banner"); }
  return finishGeometry(result);
}

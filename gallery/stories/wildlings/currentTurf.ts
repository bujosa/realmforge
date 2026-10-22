// Extracted verbatim from frozen d594e1c1 WorldWildlings.turfGeometry, with unit callback replaced by 1/50.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../../../src/core/sculpt";
export function currentTurfGeometry(): THREE.BufferGeometry {
    // Original turf-long hut, physical metres (object space): sod walls, a
    // low turf roof and a dark door. Not a unit base; no figures.
    const u = 1 / 50;
    const parts: THREE.BufferGeometry[] = [];
    const add = (geometry: THREE.BufferGeometry, color: string): void => {
      const part = geometry.index ? geometry.toNonIndexed() : geometry;
      if (part != geometry) geometry.dispose();
      part.scale(u, u, u);
      part.deleteAttribute("uv");
      paintGeometry(part, color);
      part.setAttribute("campFire", new THREE.Float32BufferAttribute(new Float32Array(part.getAttribute("position").count), 1));
      parts.push(part);
    };
    add(new THREE.BoxGeometry(10, 2.4, 5).translate(0, 0.9, 0), "#4d4234");
    const roof = new THREE.BufferGeometry(), l = 5.4, w = 3, y = 2.1, r = 2.2;
    roof.setAttribute("position", new THREE.Float32BufferAttribute([
      -l, y, -w, l, y + r, 0, l, y, -w, -l, y, -w, -l, y + r, 0, l, y + r, 0,
      -l, y, w, l, y, w, l, y + r, 0, -l, y, w, l, y + r, 0, -l, y + r, 0,
      -l, y, -w, -l, y, w, -l, y + r, 0, l, y, -w, l, y + r, 0, l, y, w
    ], 3));
    roof.computeVertexNormals();
    add(roof, "#5b583c");
    add(new THREE.BoxGeometry(0.2, 1.7, 1.1).translate(5.02, 0.85, 0), "#211d19");
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    if (!geometry) throw new Error("Could not assemble turf-long shelter");
    return geometry;
  }


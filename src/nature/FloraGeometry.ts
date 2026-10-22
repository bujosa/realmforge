import { builderShouldYield } from "../core/BuildBudget";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { FloraSpecies, floraHash } from "./FloraPlacement";

const foliage: Record<FloraSpecies, string> = {
  pine: "#486052", birch: "#778369", oak: "#586b4e", cypress: "#435a47", olive: "#7c8466",
  palm: "#667955", willow: "#788568", orchard: "#78835d", weirwood: "#94635e", reed: "#8a8a62"
};
/** Original closed, vertex-painted K11 sculpts. Unit height; no textures/alpha overdraw. */
export function floraGeometry(species: FloraSpecies, near: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, colour: string): void => {
    g.translate(x, y, z);
    const part = g.index ? g.toNonIndexed() : g;
    if (part != g) g.dispose();
    parts.push(paintGeometry(part, colour));
  };
  const branch = (a: THREE.Vector3, b: THREE.Vector3, radius: number, colour: string): void => {
    const v = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(radius * 0.38, radius, v.length(), near ? 7 : 4, near ? 4 : 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const part = g.index ? g.toNonIndexed() : g;
    if (part != g) g.dispose();
    paintGeometry(part, colour);
    const pos = part.getAttribute("position"), colors = part.getAttribute("color");
    for (let i = 0; i < pos.count; i++) {
      // Warm longitudinal bark ridges; vertex colour survives the global pool.
      const stripe = 0.82 + 0.18 * Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 9 + pos.getY(i) * 3);
      colors.setXYZ(i, colors.getX(i) * stripe, colors.getY(i) * stripe, colors.getZ(i) * stripe * 0.93);
    }
    part.translate(mid.x, mid.y, mid.z); parts.push(part);
  };
  const crown = (x: number, y: number, z: number, rx: number, ry: number, rz: number, shade: number): void => {
    const g = new THREE.SphereGeometry(1, !near && species == "pine" ? 4 : 6, near ? 4 : species == "pine" ? 2 : 3);
    g.scale(rx, ry, rz);
    const colour = new THREE.Color(foliage[species]).multiplyScalar(shade);
    add(g, x, y, z, `#${colour.getHexString()}`);
  };
  const bark = species == "weirwood" ? "#d6d3c4" : species == "birch" ? "#b2b5a3" : "#876c4c";
  if (species == "reed") {
    const blades = near ? 7 : 3;
    for (let i = 0; i < blades; i++) {
      const a = i * 2.4, r = i * 0.035;
      const g = new THREE.ConeGeometry(0.038, 0.65 + (i % 3) * 0.15, 3);
      g.rotateZ(Math.sin(a) * 0.16);
      add(g, Math.cos(a) * r, 0.45, Math.sin(a) * r, foliage.reed);
    }
  } else if (species == "palm") {
    branch(new THREE.Vector3(), new THREE.Vector3(0.05, 0.82, 0), 0.026, bark);
    for (let i = 0; i < (near ? 8 : 4); i++) {
      const a = i * Math.PI * 2 / (near ? 8 : 4);
      // Solid ridged fronds, with a drooping tip; no translucent cards.
      const r = 0.3;
      const positions = [0.05, 0.83, 0, Math.cos(a) * r, 0.95, Math.sin(a) * r,
        Math.cos(a + 0.16) * r * 0.7, 0.83, Math.sin(a + 0.16) * r * 0.7,
        Math.cos(a) * r * 1.35, 0.7, Math.sin(a) * r * 1.35];
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex([0, 1, 2, 1, 3, 2, 2, 1, 0, 2, 3, 1]); g.computeVertexNormals();
      add(g, 0, 0, 0, foliage.palm);
    }
  } else if (species == "pine") {
    branch(new THREE.Vector3(), new THREE.Vector3(0.01, 0.94, -0.01), 0.025, bark);
    const tiers = near ? 5 : 2;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, a = i * 2.4;
      crown(Math.cos(a) * 0.035, 0.3 + t * 0.63, Math.sin(a) * 0.035,
        0.22 - t * 0.17, near ? 0.12 : 0.2, 0.19 - t * 0.14, 0.9 + t * 0.15);
    }
  } else if (species == "cypress") {
    branch(new THREE.Vector3(), new THREE.Vector3(0, 0.9, 0), 0.025, bark);
    const tiers = near ? 3 : 1;
    for (let i = 0; i < tiers; i++) {
      const cy = tiers == 1 ? 0.62 : 0.42 + i * 0.19;
      const radius = 0.1 - i * 0.013;
      const g = new THREE.ConeGeometry(radius, tiers == 1 ? 0.76 : 0.38, near ? 7 : 5);
      add(g, Math.sin(i * 3) * 0.018, cy, Math.cos(i * 2) * 0.015, foliage[species]);
    }
  } else {
    const low = species == "olive" || species == "orchard";
    const trunk = species == "willow" ? 0.5 : low ? 0.45 : 0.65;
    branch(new THREE.Vector3(), new THREE.Vector3(0.02, trunk, -0.01), low ? 0.024 : 0.015, bark);
    const count = near ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const a = i * 2.4, spread = near ? 0.1 + i % 2 * 0.04 : 0;
      const x = Math.cos(a) * spread, z = Math.sin(a) * spread;
      if (near) branch(new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(x, 0.7, z), 0.009, bark);
      crown(x, species == "willow" ? 0.64 : 0.71 + Math.sin(i * 4.1) * 0.045, z,
        species == "birch" ? 0.16 : low ? 0.34 : 0.27,
        species == "willow" ? 0.36 : 0.26, species == "birch" ? 0.17 : 0.28, 0.87 + i % 3 * 0.08);
    }
  }
  parts.forEach(g => g.deleteAttribute("uv"));
  const result = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  if (!result) throw new Error("K11 flora geometry failed");
  const positions = result.getAttribute("position"), colours = result.getAttribute("color");
  for (let i = 0; i < positions.count; i++) {
    const ao = 0.76 + Math.min(1, Math.max(0, positions.getY(i))) * 0.24;
    colours.setXYZ(i, colours.getX(i) * ao, colours.getY(i) * ao, colours.getZ(i) * ao);
  }
  result.computeBoundingSphere();
  return result;
}
/** A shallow, rounded canopy shell, never a vertical crossed card (32 triangles).
 * Per-crown normals in the shared atlas supply the small-scale crown relief.
 */
export function floraGroupGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(2, 2, 4, 4).rotateX(-Math.PI / 2);
  const positions = g.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setXYZ(i, x, 0.12 + Math.max(0, 1 - (x * x + z * z) * 0.6) * 0.88, z);
  }
  g.computeVertexNormals();
  return paintGeometry(g, "#ffffff");
}
/** 3 crossed, tapered blades + a low closed shrub in the same High-only draw. */
export function floraGrassGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3, x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.22;
    positions.push(-x, 0, -z, x, 0, z, x * 0.4, 0.7 + i * 0.1, z * 0.4);
  }
  const a = [-0.28, 0, -0.15], b = [0.28, 0, -0.15], c = [0, 0, 0.3], top = [0.04, 0.32, 0];
  positions.push(...a, ...b, ...top, ...b, ...c, ...top, ...c, ...a, ...top, ...a, ...c, ...b);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return paintGeometry(g, "#8b9069");
}

/** Mid-distance geometry; the far canopy retains its cheaper rounded shell. */
export function floraImpostorGeometry(): THREE.BufferGeometry {
  // Mid-distance copses have real silhouettes instead of a single broad shell.
  // Five low-poly trees share the existing instance draw (180 triangles).
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.39996, radius = i ? 0.55 : 0;
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const h = 0.72 + floraHash(239, i, 0) * 0.38;
    const crown = new THREE.SphereGeometry(1, 6, 3);
    crown.scale(0.31, h * 0.55, 0.28); crown.translate(x, h * 0.68, z);
    parts.push(paintGeometry(crown.toNonIndexed(), i % 2 ? "#90af50" : "#779c3e")); crown.dispose();
    const trunk = new THREE.CylinderGeometry(0.018, 0.03, h * 0.6, 3, 1);
    trunk.translate(x, h * 0.3, z);
    parts.push(paintGeometry(trunk.toNonIndexed(), "#67502f")); trunk.dispose();
  }
  const result = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach(part => part.dispose());
  return result;
}

/** Original overhead crown atlas. Alpha cuts only the ragged outer forest edge;
 * the spaces between crowns are opaque forest-floor green, never tan grass.
 * Diffuse is neutral so each realm supplies its own foliage tint. Normal map is
 * tangent-space and follows the real scene sun rather than baking a camera light.
 */
export function* floraCanopyTextureSteps(): Generator<void, { colour: THREE.CanvasTexture; normal: THREE.CanvasTexture } | undefined, unknown> {
  if (typeof document == "undefined") return undefined;
  const size = 512, canvas = document.createElement("canvas"), normalCanvas = document.createElement("canvas");
  canvas.width = canvas.height = normalCanvas.width = normalCanvas.height = size;
  const c = canvas.getContext("2d"), n = normalCanvas.getContext("2d"); if (!c || !n) return undefined;
  const diffuse = c.createImageData(size, size), normals = n.createImageData(size, size);
  const crowns: { x: number; y: number; r: number; tone: number }[] = [];
  // A random canopy, not orchard rows. All variation is seeded and repeatable.
  for (let i = 0; i < 110; i++) {
    const x = 24 + floraHash(7919, i, 0) * 464, y = 24 + floraHash(7919, i, 1) * 464;
    if (Math.hypot(x - 256, y - 256) > 231) continue;
    crowns.push({ x, y, r: 23 + floraHash(7919, i, 2) * 24, tone: 0.87 + floraHash(7919, i, 3) * 0.19 });
  }
  // Bucket crown bounds: avoid scanning the entire atlas for every pixel.
  const bins = Array.from({ length: 256 }, () => [] as typeof crowns);
  for (const crown of crowns) {
    for (let z = Math.max(0, Math.floor((crown.y - crown.r) / 32)); z <= Math.min(15, Math.floor((crown.y + crown.r) / 32)); z++) {
      for (let x = Math.max(0, Math.floor((crown.x - crown.r) / 32)); x <= Math.min(15, Math.floor((crown.x + crown.r) / 32)); x++) bins[z * 16 + x].push(crown);
    }
  }
  for (let y = 0; y < size; y++) {
    if (builderShouldYield()) yield;
    for (let x = 0; x < size; x++) {
    let height = -1, nx = 0, ny = 0, nz = 1, tone = 0.6;
    const radius = Math.hypot(x - 256, y - 256), angle = Math.atan2(y - 256, x - 256);
    const rim = 233 + 9 * Math.sin(angle * 7) + 6 * Math.cos(angle * 11);
    for (const crown of bins[(y >> 5) * 16 + (x >> 5)]) {
      const dx = (x - crown.x) / crown.r, dy = (y - crown.y) / crown.r, r2 = dx * dx + dy * dy;
      if (r2 >= 1) continue;
      const h = Math.sqrt(1 - r2);
      if (h <= height) continue;
      height = h; nx = dx * 0.75; ny = -dy * 0.75; nz = Math.sqrt(1 - nx * nx - ny * ny);
      // Mild cavity AO, not baked directional light: the sun lights the normals.
      const fleck = Math.sin(x * 1.71 + y * 0.39) * Math.sin(y * 1.13 - x * 0.47);
      tone = crown.tone * (0.78 + h * 0.22) + fleck * 0.025;
    }
    const alpha = (radius < rim && (height > -1 || radius < rim - 36)) ? 255 : 0, i = (y * size + x) * 4;
    const value = Math.min(255, Math.round(tone * 255));
    diffuse.data[i] = value; diffuse.data[i + 1] = value; diffuse.data[i + 2] = value; diffuse.data[i + 3] = alpha;
    normals.data[i] = Math.round((nx * 0.5 + 0.5) * 255); normals.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    normals.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); normals.data[i + 3] = 255;
  }
  }
  c.putImageData(diffuse, 0, 0); n.putImageData(normals, 0, 0);
  const colour = new THREE.CanvasTexture(canvas), normal = new THREE.CanvasTexture(normalCanvas);
  colour.colorSpace = THREE.SRGBColorSpace;
  return { colour, normal };
}
export function floraCanopyTextures(): { colour: THREE.CanvasTexture; normal: THREE.CanvasTexture } | undefined {
  const job = floraCanopyTextureSteps();
  for (;;) { const step = job.next(); if (step.done) return step.value; }
}
/** Compatibility for clients that only need the diffuse atlas. */
export function floraImpostorTexture(): THREE.CanvasTexture | undefined {
  const textures = floraCanopyTextures(); textures?.normal.dispose(); return textures?.colour;
}

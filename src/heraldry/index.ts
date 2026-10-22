import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sigilIdentity, sigilSource } from "./sources";
import { simplify } from "./simplify";

export { SigilAtlas } from "./SigilAtlas";
export { sigilIdentity } from "./sources";

interface Sigil {
  shapes: THREE.Shape[];
  artwork: Path2D;
  geometry?: THREE.BufferGeometry;
  x: number;
  y: number;
  scale: number;
}
const cache = new Map<string, Sigil>();
// Measured costs of the replaced silhouettes. Keep every baked instance at or
// below its previous cost, while the canvas/atlas retains the detailed contour.
const triangleBudget: Record<string, number> = {
  neutral: 36, stark: 36, lannister: 96, baratheon: 92, greyjoy: 140, tyrell: 240,
  // Bolton also fits Stark's smaller legacy budget when swapped into that seat.
  martell: 128, arryn: 44, targaryen: 100, bolton: 36
};

function sigil(house: string, canonical = false): Sigil {
  const identity = canonical ? house : sigilIdentity(house);
  const cached = cache.get(identity);
  if (cached) return cached;
  const svg = new SVGLoader().parse(sigilSource(identity));
  const shapes = svg.paths.filter(path => (path.userData?.style as { fill?: string }).fill != "none" && (path.userData?.style as { fillOpacity?: number }).fillOpacity != 0)
    .reduce<THREE.Shape[]>((all, path) => all.concat(path.toShapes()), []);
  const points = shapes.reduce<THREE.Vector2[]>((all, shape) => all.concat(shape.getPoints(2)), []);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const artwork = new Path2D();
  shapes.forEach(shape => {
    [shape.getPoints(12), ...shape.holes.map(hole => hole.getPoints(12))].forEach(contour => {
      contour.forEach((p, i) => i ? artwork.lineTo(p.x, p.y) : artwork.moveTo(p.x, p.y));
      artwork.closePath();
    });
  });
  const result = { shapes, artwork, x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: (identity == "neutral" ? 0.6 : 1.2) / Math.max(maxX - minX, maxY - minY) };
  cache.set(identity, result);
  return result;
}

function outline(points: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((p, i) => i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y));
  shape.closePath();
  return shape;
}

// Return an owned copy: existing sculpt callers transform, merge and dispose it.
// Parsing/triangulation happen once per actual identity; instances share the
// resulting baked house/type batch rather than allocating per miniature.
export function emblemGeometry(house: string): THREE.BufferGeometry {
  const source = sigil(house);
  if (!source.geometry) {
    let tolerance = 0.002, lower = 0, upper = 0, refinements = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      const parts = source.shapes.map(shape => {
        const normalized = (points: THREE.Vector2[]): THREE.Vector2[] => simplify(points.map(p => new THREE.Vector2((p.x - source.x) * source.scale, (source.y - p.y) * source.scale)), tolerance);
        const flat = outline(normalized(shape.getPoints(2))) as THREE.Shape;
        flat.holes = shape.holes.map(hole => outline(normalized(hole.getPoints(2))) as THREE.Shape);
        const raised = new THREE.ExtrudeGeometry(flat, { depth: 0.035, bevelEnabled: false, steps: 1 });
        // Each consumer mounts the crest on an opaque shield, cloth or banner.
        // Retain its raised front cap; buried backs and subpixel vertical walls
        // add no readable detail. The reverse of cloth has its own facing crest.
        const positions = raised.getAttribute("position"), normals = raised.getAttribute("normal");
        const front: number[] = [];
        for (let i = 0; i < positions.count; i += 3) {
          if (normals.getZ(i) < 0.5) continue;
          for (let j = i; j < i + 3; j++) front.push(positions.getX(j), positions.getY(j), positions.getZ(j));
        }
        raised.dispose();
        const cap = new THREE.BufferGeometry();
        cap.setAttribute("position", new THREE.Float32BufferAttribute(front, 3));
        cap.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(front.length / 3 * 2), 2));
        cap.computeVertexNormals();
        return cap;
      });
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      if (!geometry) throw new Error(`Could not build ${house} SVG emblem`);
      if (geometry.getAttribute("position").count / 3 <= triangleBudget[sigilIdentity(house)]) {
        source.geometry?.dispose();
        source.geometry = geometry;
        upper = tolerance;
        if (!lower || refinements++ >= 8) break;
      } else {
        geometry.dispose();
        lower = tolerance;
        if (upper && refinements++ >= 8) break;
      }
      tolerance = upper ? (lower + upper) / 2 : tolerance * 1.3;
    }
    if (!source.geometry) throw new Error(`SVG emblem exceeds triangle budget: ${house}`);
  }
  return source.geometry.clone();
}

// Full SVG contours for canvas labels/atlas: no mesh projection or loss of detail.
export function paintSigil(context: CanvasRenderingContext2D, house: string, x: number, y: number, size: number, color: string, canonical = false): void {
  const source = sigil(house, canonical);
  context.save();
  context.translate(x, y);
  context.scale(size * source.scale / 1.2, size * source.scale / 1.2);
  context.translate(-source.x, -source.y);
  context.fillStyle = color;
  context.fill(source.artwork, "evenodd");
  context.restore();
}

// Templates live for this module's lifetime. Call on app teardown/hot replacement;
// already-issued geometry copies remain owned by their scene's normal disposal.
export function disposeHeraldry(): void {
  cache.forEach(source => source.geometry?.dispose());
  cache.clear();
}

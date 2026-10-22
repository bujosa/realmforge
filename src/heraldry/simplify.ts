import { Vector2 } from "three";

// Closed-contour Ramer–Douglas–Peucker. Compare against the original contour,
// rather than repeatedly deleting neighbours and accumulating silhouette drift.
export function simplify(points: Vector2[], tolerance: number): Vector2[] {
  const ring = points.slice();
  if (ring.length > 1 && Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y) < 0.00001) ring.pop();
  if (ring.length <= 3) return ring;
  const distance = (p: Vector2, a: Vector2, b: Vector2): number => {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  const line = (input: Vector2[]): Vector2[] => {
    const keep = new Set([0, input.length - 1]);
    const stack = [[0, input.length - 1]];
    while (stack.length) {
      const [start, end] = stack.pop() as number[];
      let farthest = -1, error = tolerance;
      for (let i = start + 1; i < end; i++) {
        const d = distance(input[i], input[start], input[end]);
        if (d > error) { error = d; farthest = i; }
      }
      if (farthest >= 0) { keep.add(farthest); stack.push([start, farthest], [farthest, end]); }
    }
    return input.filter((_point, i) => keep.has(i));
  };
  let split = 1;
  for (let i = 2; i < ring.length; i++) {
    if (Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y) > Math.hypot(ring[split].x - ring[0].x, ring[split].y - ring[0].y)) split = i;
  }
  const result = line(ring.slice(0, split + 1)).slice(0, -1)
    .concat(line(ring.slice(split).concat(ring[0])).slice(0, -1));
  return result.length >= 3 ? result : [ring[0], ring[split], ring[(split + 1) % ring.length]];
}

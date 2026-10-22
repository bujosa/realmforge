/**
 * Screen-space separation of fixed-size tokens (docs/v3-world-scale-design.md
 * §2.5: "las fichas no se solapan: empuje en pantalla de ≤ 24 px").
 *
 * Deterministic relaxation: a few passes push overlapping discs apart along
 * the line between their centres (a fixed direction for coincident ones);
 * each disc's total push is clamped to `maxPush`. Input order defines the
 * tie-break, so a static camera always gives the same layout.
 */

export interface TokenDisc { x: number; y: number; r: number; dx: number; dy: number }

export const SEPARATION_GAP = 2;
const PASSES = 4;

export function separate(discs: TokenDisc[], maxPush: number, gap = SEPARATION_GAP): void {
  const n = discs.length;
  if (n < 2) return;
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const a = discs[i];
      for (let j = i + 1; j < n; j++) {
        const b = discs[j];
        let vx = (b.x + b.dx) - (a.x + a.dx), vy = (b.y + b.dy) - (a.y + a.dy);
        const want = a.r + b.r + gap;
        if (Math.abs(vx) >= want || Math.abs(vy) >= want) continue;
        let length = Math.hypot(vx, vy);
        if (length >= want) continue;
        if (length < 1e-6) {
          // Coincident: split along a fixed diagonal, earlier disc up-left.
          vx = 1; vy = 0.5; length = Math.hypot(vx, vy);
        }
        const push = (want - length) / 2;
        const ux = vx / length, uy = vy / length;
        a.dx -= ux * push; a.dy -= uy * push;
        b.dx += ux * push; b.dy += uy * push;
        clamp(a, maxPush); clamp(b, maxPush);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function clamp(disc: TokenDisc, maxPush: number): void {
  const length = Math.hypot(disc.dx, disc.dy);
  if (length > maxPush) {
    disc.dx *= maxPush / length;
    disc.dy *= maxPush / length;
  }
}

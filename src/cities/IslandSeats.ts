import { REFERENCE, SITES, PADS } from "../presets/islandSites";
/** Original, public static castle recipes. The base/FFC pilot uses the live R1
 * anchor as its reference; other variants await atlas-owned shoreline seating.
 * Every footprint is dry, inside the island fortress and outside all public token/layout pads.
 * No game state, ownership, orders, figures or banners enter this module. */
import type { ComplexGround, ComplexPlan, Seated, Structure } from "./ComplexPlan";


function shapes(count: number, radius: number): Structure[] {
  const out: Structure[] = [];
  const ring = Array.from({ length: count }, (_, i): [number, number] => [Math.cos(i * Math.PI * 2 / count) * radius, Math.sin(i * Math.PI * 2 / count) * radius]);
  ring.forEach(([x, z], i) => out.push({ type: "tower", x, z, r: count == 10 && i == 0 ? 7 : 4 + i % 3,
    h: count == 10 ? 16 + i * 7 % 19 : 18 + i * 5, round: i % 3 != 0, roof: i % 3 == 1 ? "cone" : i % 3 == 2 ? "pyramid" : "none" }));
  if (count == 10) {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      if (i == 2) {
        out.push({ type: "curtain", a, b: [5, a[1]], h: 7, t: 2.8 }, { type: "curtain", a: [-5, b[1]], b, h: 7, t: 2.8 });
      } else out.push({ type: "curtain", a, b, h: 7, t: 2.8 });
    });
    out.push({ type: "hall", x: 0, z: 0, w: 25, d: 15, h: 10, angle: 0 },
      { type: "gatehouse", x: 0, z: ring[2][1], w: 5, h: 9, r: 2.2, angle: 0, round: false });
  } else {
    out.push({ type: "keep", x: 0, z: 4, w: count == 3 ? 22 : 13, d: count == 3 ? 17 : 10, h: count == 3 ? 20 : 11, roof: "pyramid", turrets: count == 3 });
  }
  return out;
}

export interface IronSeatPlan extends ComplexPlan { seats: { id: string; x: number; z: number }[] }

/** One merged scenery plan, deliberately without pick/camera volumes. */
export function planIslandSeats(anchor: { x: number; y: number }, ground: ComplexGround): IronSeatPlan | undefined {
  // A different public castle anchor means a different variant/shoreline fit:
  // omit rather than guess. The intake supplies all four variant transforms.
  if (Math.hypot(anchor.x - REFERENCE[0], anchor.y - REFERENCE[1]) > 0.1) return undefined;
  const structures: Seated[] = [];
  const seats: { id: string; x: number; z: number }[] = [];
  const occupied: { x: number; z: number; r: number }[] = [];
  const safe = (x: number, z: number, radius: number): boolean => {
    const bx = anchor.x + x / 10, by = anchor.y + z / 10;
    return !ground.wet(x, z) && (!ground.own || ground.own(x, z)) && !ground.reserved(x, z, radius) &&
      !PADS.some(p => Math.abs(bx - p.x) * 10 < p.hx + radius && Math.abs(by - p.y) * 10 < p.hz + radius);
  };
  for (const site of SITES) {
    const offsets: [number, number][] = [[0, 0]];
    if (site.towers < 3) {
      for (const d of [20, 40, 60, 80]) offsets.push([-d, 0], [0, -d], [d, 0], [0, d]);
      for (const d of [20, 40]) offsets.push([-d, -d], [-d, d], [d, -d], [d, d]);
    }
    for (const [dx, dz] of offsets) {
      const ox = (site.point[0] - anchor.x) * 10 + dx, oz = (site.point[1] - anchor.y) * 10 + dz;
      const radius = site.radius + 15;
      if (occupied.some(p => Math.hypot(ox-p.x, oz-p.z) < radius+p.r+4)) continue;
      const seated: Seated[] = [];
      const drafts = shapes(site.towers, site.radius);
      for (const s of drafts) {
        const cx = s.type == "curtain" ? (s.a[0] + s.b[0]) / 2 : s.x;
        const cz = s.type == "curtain" ? (s.a[1] + s.b[1]) / 2 : s.z;
        const hx = s.type == "curtain" ? Math.abs(s.a[0] - s.b[0]) / 2 + s.t : (s.type == "tower" || s.type == "drum") ? s.r * 1.25 : s.type == "gatehouse" ? s.w / 2 + s.r * 2 : s.w / 2;
        const hz = s.type == "curtain" ? Math.abs(s.a[1] - s.b[1]) / 2 + s.t : (s.type == "tower" || s.type == "drum") ? s.r * 1.25 : s.type == "gatehouse" ? s.r * 2 : s.d / 2;
        const points = [[cx, cz], [cx-hx, cz-hz], [cx+hx, cz-hz], [cx-hx, cz+hz], [cx+hx, cz+hz]];
        if (points.some(([x, z]) => !safe(ox + x, oz + z, 2))) continue;
        const heights = points.map(([x, z]) => ground.height(ox + x, oz + z));
        const low = Math.min(...heights), high = Math.max(...heights);
        if (!Number.isFinite(low + high) || high - low > 8) continue;
        const moved = s.type == "curtain" ? { ...s, a: [ox+s.a[0], oz+s.a[1]] as [number, number], b: [ox+s.b[0], oz+s.b[1]] as [number, number] }
          : { ...s, x: ox+s.x, z: oz+s.z };
        seated.push({ ...moved, base: low - 1, ground: high, top: high + s.h } as Seated);
      }
      // A seat is atomic: never publish missing towers, a clipped hall or a gap.
      if (seated.length != drafts.length) continue;
      structures.push(...seated);
      seats.push({ id: site.id, x: ox, z: oz });
      occupied.push({ x: ox, z: oz, r: radius });
      break;
    }
  }
  if (!structures.length) return undefined;
  return { id: "iron-island-seats", recipe: "iron-island-seats", style: "islands", palette: { stone: "#717e87", trim: "#a0a6a1", roof: "#454d54" },
    fit: 1, offset: [0,0], lift: 0, structures, seats, extents: { minX: -1300, maxX: 100, minZ: -700, maxZ: 700 },
    switchMetres: 35, banner: [0,0,0], torches: [], props: [], volumes: [], heroVolumes: [] };
}

/** Isolated island seat recipe, independent of any map position or reserved board pad. */
export function planIslandSeat(id: string, towers: number, radius: number, ground: ComplexGround): ComplexPlan {
  const structures: Seated[] = shapes(towers, radius).map(s => {
    const x = s.type === "curtain" ? (s.a[0] + s.b[0]) / 2 : s.x;
    const z = s.type === "curtain" ? (s.a[1] + s.b[1]) / 2 : s.z;
    const y = ground.height(x, z);
    return { ...s, base: y, ground: y, top: y + s.h };
  });
  return { id, recipe: id, style: "islands", fit: 1, offset: [0, 0], lift: 0, structures,
    extents: { minX: -radius - 30, maxX: radius + 30, minZ: -radius - 30, maxZ: radius + 30 },
    switchMetres: 35, banner: [0, 0, 0], torches: [], props: [], volumes: [], heroVolumes: [] };
}

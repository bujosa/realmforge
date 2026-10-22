/** Original static Iron Islands art. No fleet state or player colours: these
 * are public shipyard hulls, furled museum-like harbour craft and stonework.
 * The base/FFC fit follows the existing coast; it never creates terrain/water. */
import * as THREE from "three";
import CastleBuilder from "../castles/CastleBuilder";
import { ComplexGround } from "./ComplexPlan";
import { addFadeAttribute } from "./ComplexMaterial";
import type { IronSeatPlan } from "./IslandSeats";

const U = 1 / 50;
interface Pose { x: number; y: number; z: number; yaw: number; sx?: number; sy?: number; sz?: number }
interface Shore { x: number; z: number; inland: number; y: number }

function box(b: CastleBuilder, w: number, h: number, d: number, x: number, y: number, z: number, color: string, tag = 2): void {
  b.add(new THREE.BoxGeometry(w * U, h * U, d * U), x * U, y * U, z * U, color, 0, tag);
}
function beam(b: CastleBuilder, a: number[], c: number[], radius: number, color: string): void {
  const from = new THREE.Vector3(...a).multiplyScalar(U), to = new THREE.Vector3(...c).multiplyScalar(U);
  const delta = to.clone().sub(from);
  const g = new THREE.CylinderGeometry(radius * U, radius * U, delta.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
  const mid = from.add(to).multiplyScalar(0.5);
  b.add(g, mid.x, mid.y, mid.z, color, 0, 2);
}

/** Clinker-built open hull: 13 stations, raised ends, five overlapping strakes,
 * exposed ribs, thwarts, a keel and an original curling kraken/dragon prow. */
function longship(anchored: boolean): THREE.BufferGeometry {
  const b = new CastleBuilder("islands", false);
  const width = (z: number): number => 2.6 * Math.pow(Math.max(0.012, 1 - (z / 14) ** 2), 0.65);
  const rise = (z: number): number => 0.3 + 1.3 * (Math.abs(z) / 14) ** 4;
  const section = (z: number, side: number, t: number): number[] => [side * width(z) * Math.sin(t * Math.PI / 2), rise(z) + 2.4 * t, z];
  const skin = (a: number[], c: number[], d: number[], e: number[]): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...c, ...d, ...a, ...d, ...e].map(v => v * U), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    g.computeVertexNormals();
    return g;
  };
  for (let j = 0; j < 12; j++) {
    const z = -14 + j * 28 / 12, next = z + 28 / 12;
    beam(b, [0, rise(z), z], [0, rise(next), next], 0.19, "#292723");
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
      const t = k / 5, upper = (k + 1) / 5;
      const a = section(z, side, t), c = section(next, side, t), d = section(next, side, upper), e = section(z, side, upper);
      // Both faces are explicit; the shared castle material remains front-sided.
      b.add(skin(a, c, d, e), 0, 0, 0, k % 2 ? "#625144" : "#493c32", 0, 2);
      b.add(skin(e, d, c, a), 0, 0, 0, "#776554", 0, 2);
      beam(b, e, d, 0.075, "#302e2b");
      if (j > 0 && j < 12) beam(b, a.map((v, i) => i == 0 ? v * 0.95 : v + (i == 1 ? 0.08 : 0)), e.map((v, i) => i == 0 ? v * 0.95 : v + (i == 1 ? 0.08 : 0)), 0.11, "#9b8870");
    }
    if (j > 1 && j < 11 && j % 2 == 0) box(b, width(z) * 1.85, 0.18, 0.65, 0, rise(z) + 1.6, z, "#8a7b67");
  }
  for (const side of [-1, 1]) {
    const points = [[0, 3.2, side * 13.7], [0, 5, side * 14.3], [0, 6.4, side * 13.8], [0, 6.7, side * 12.9], [0, 6.1, side * 12.4]];
    for (let i = 1; i < points.length; i++) beam(b, points[i-1], points[i], 0.23, "#55534b");
    box(b, 0.38, 0.16, 0.45, 0, 6.35, side * 12.55, "#b39a58");
  }
  if (anchored) {
    beam(b, [0, 1, 0], [0, 13, 0], 0.19, "#655b4d");
    beam(b, [-4.7, 11.1, 0], [4.7, 11.1, 0], 0.16, "#6e6250");
    // A tightly furled sail, alternating dark and ochre cloth, never deployed.
    for (let i = 0; i < 10; i++) box(b, 0.88, 0.55 + i % 3 * 0.08, 0.65, (i - 4.5) * 0.88, 10.8, 0, i % 2 ? "#b09a65" : "#353938", 4);
    for (const side of [-1, 1]) beam(b, [0, 12.5, 0], [0, 2.8, side * 11], 0.045, "#9c927b");
    beam(b, [0, 3.5, 13], [0, -1, 20], 0.055, "#8a8170");
  } else {
    for (const z of [-8, 7]) box(b, 6, 0.55, 1, 0, 0.15, z, "#817562");
  }
  return b.finish();
}

/** Black cloth with an original gold eight-armed kraken relief on both faces. */
function banner(): THREE.BufferGeometry {
  const b = new CastleBuilder("islands", false);
  beam(b, [0, 0, 0], [0, 10, 0], 0.12, "#8a8170");
  box(b, 3.9, 5.2, 0.1, 1.85, 7, 0, "#252c2d", 4);
  for (const side of [-1, 1]) {
    b.add(new THREE.SphereGeometry(0.5 * U, 8, 6).scale(1, 1.4, 0.22), 1.85 * U, 8 * U, side * 0.1 * U, "#bd9f55", 0, 4);
    for (let i = 0; i < 8; i++) {
      const x = 1.85 + (i - 3.5) * 0.16;
      beam(b, [x, 7.9, side * 0.12], [1.85 + (i - 3.5) * 0.35, 6.6 - i % 2 * 0.4, side * 0.12], 0.075, "#bd9f55");
      beam(b, [1.85 + (i - 3.5) * 0.35, 6.6 - i % 2 * 0.4, side * 0.12], [1.85 + (i - 3.5) * 0.4, 6.9 - i % 2 * 0.3, side * 0.12], 0.065, "#bd9f55");
    }
  }
  return b.finish();
}

function shrine(): THREE.BufferGeometry {
  const b = new CastleBuilder("islands", false);
  for (const side of [-1, 1]) {
    const p = [[side * 5, 0, 0], [side * 4.6, 4, 0], [side * 3, 8, 0], [0, 10, 0]];
    for (let i = 1; i < p.length; i++) beam(b, p[i-1], p[i], 0.45 - i * 0.05, "#8a8170");
    for (let j = 0; j < 4; j++) beam(b, [side * (4.6 - j * 0.7), 3 + j * 1.5, 0], [side * (6.5 - j), 4.8 + j * 1.5, 0.3], 0.15, "#a09c8e");
  }
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    b.add(new THREE.SphereGeometry(U, 7, 4).scale(1.1, 0.6 + i % 3 * 0.4, 0.8), Math.cos(a) * 7 * U, 0.4 * U, Math.sin(a) * 5 * U, i % 2 ? "#42484a" : "#70777a", a, 5);
  }
  box(b, 2.8, 1.2, 1.8, 0, 0.6, 0, "#32383a", 5);
  box(b, 0.7, 0.12, 0.7, 0, 1.25, 0, "#b69b5e", 4);
  return b.finish();
}

/** Bounded, sliced construction under ComplexLayer's existing frame deadline.
 * All batches share its material; every mesh disables raycast. */
export default class IslandDressing {
  readonly group = new THREE.Group();
  readonly sites: Record<string, Pose[]> = {};
  private steps: Generator<void, void, void>;
  ready = false;

  constructor(private ground: ComplexGround, private sea: number, private seats: IronSeatPlan, private material: THREE.Material) {
    this.group.name = "iron-islands-static-dressing";
    this.steps = this.build();
  }

  advance(deadline: number): void {
    while (!this.ready && performance.now() < deadline) this.ready = !!this.steps.next().done;
  }

  private batch(id: string, geometry: THREE.BufferGeometry, poses: Pose[]): void {
    this.sites[id] = poses;
    if (!poses.length) { geometry.dispose(); return; }
    addFadeAttribute(geometry, poses.length);
    const mesh = new THREE.InstancedMesh(geometry, this.material, poses.length);
    const dummy = new THREE.Object3D();
    poses.forEach((p, i) => {
      dummy.position.set(p.x * U, p.y * U, p.z * U);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `iron-static:${id}`;
    mesh.raycast = () => undefined;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private clear(x: number, z: number, r: number, dry: boolean, halfZ = r, halfX = r): boolean {
    const g = this.ground;
    return !g.reserved(x, z, r) && (!dry || !g.own || g.own(x, z)) &&
      [[0, 0], [-halfX, -halfZ], [halfX, -halfZ], [-halfX, halfZ], [halfX, halfZ]].every(([dx, dz]) => g.wet(x + dx, z + dz) != dry) &&
      !this.seats.seats.some(p => Math.hypot(p.x - x, p.z - z) < 65 + r);
  }

  private *build(): Generator<void, void, void> {
    const g = this.ground, west: Shore[] = [], east: Shore[] = [];
    // Find the existing island's first/last dry sample per transect. Bisection
    // reads the same public wet mask used by the native complex planner.
    for (let z = -580; z <= 540; z += 24) {
      const dry: number[] = [];
      for (let x = -1450; x <= 220; x += 20) if (!g.wet(x, z) && (!g.own || g.own(x, z))) dry.push(x);
      for (const [out, x, sign] of [[west, dry[0], 1], [east, dry[dry.length - 1], -1]] as [Shore[], number, number][]) {
        if (!Number.isFinite(x) || !g.wet(x - sign * 20, z)) continue;
        let a = x - sign * 20, b = x;
        for (let j = 0; j < 8; j++) { const mid = (a + b) / 2; if (g.wet(mid, z)) a = mid; else b = mid; }
        out.push({ x: b, z, inland: sign, y: g.height(b + sign * 4, z) });
      }
      yield;
    }
    // A compact shipyard north of the native quay, below Blacktyde's
    // protected footprint. Seven-metre cradle centres leave one metre clear
    // between six-metre timber supports; hull beams themselves are 5.2 m.
    const hulls: Pose[] = [];
    for (let i = 0; i < 9; i++) {
      const z = -412 + i * 7;
      const before = east.filter(p => p.z <= z).pop(), after = east.find(p => p.z >= z);
      if (!before || !after) continue;
      const t = (z-before.z) / Math.max(1,after.z-before.z);
      const edge = before.x + (after.x-before.x) * t;
      for (const inland of [24, 22, 26, 20, 28]) {
        const x = edge-inland;
        if (!this.clear(x,z,15,true,4)) continue;
        const heights = [g.height(x-13,z),g.height(x+13,z),g.height(x,z-3.3),g.height(x,z+3.3)];
        if (Math.max(...heights)-Math.min(...heights) > 4 || Math.max(...heights) > this.sea+18) continue;
        hulls.push({ x, y: Math.max(...heights)+0.25, z, yaw: Math.PI/2 });
        break;
      }
    }
    this.batch("beached-longships", longship(false), hulls);
    yield;
    const anchored: Pose[] = [];
    // The western coast borders Ironman's Bay, outside the eastern port area.
    for (const p of west) {
      if (p.z < -450 || p.z > -130) continue;
      const x = p.x - 65, z = p.z;
      if (!this.clear(x, z, 20, false) || anchored.some(a => Math.hypot(a.x-x, a.z-z) < 55)) continue;
      anchored.push({ x, y: this.sea - 0.75, z, yaw: 0.12 + anchored.length * 0.09 });
      if (anchored.length == 4) break;
    }
    this.batch("anchored-longships", longship(true), anchored);
    yield;
    const stacks: Pose[] = [], rocks: Pose[] = [], kelp: Pose[] = [], foam: Pose[] = [], shingle: Pose[] = [], heather: Pose[] = [];
    for (const [coast, western] of [[west, true], [east, false]] as [Shore[], boolean][]) for (let i = 0; i < coast.length; i++) {
      const p = coast[i];
      const offshore = p.x - p.inland * (14 + i % 3 * 8);
      if (western && i % 3 == 0 && this.clear(offshore, p.z, 10, false)) stacks.push({ x: offshore, y: this.sea - 6, z: p.z, yaw: i * 1.7, sx: 7 + i % 4 * 2, sy: 20 + i % 5 * 7, sz: 6 + i % 3 * 2 });
      for (let j = 0; j < 5; j++) {
        const x = p.x + p.inland * (4 + j * 4), z = p.z + (j - 2) * 4;
        if (this.clear(x, z, 2, true)) {
          const y = g.height(x, z);
          (western ? rocks : shingle).push({ x, y: y + 0.12, z, yaw: i+j, sx: western ? 3+j%2*2 : 0.45, sy: western ? 2+j%3*1.5 : 0.12, sz: western ? 3 : 0.65 });
          if (j == 4) heather.push({ x, y: y + 0.1, z: z+3, yaw: i, sx: 2, sy: 0.3, sz: 2 });
        }
        const wx = p.x - p.inland * (3 + j * 1.5), wz = p.z + (j - 2) * 4;
        if (this.clear(wx, wz, 1, false)) {
          kelp.push({ x: wx, y: this.sea + 0.1, z: wz, yaw: i+j, sx: 1.5, sy: 0.15, sz: 3 });
          foam.push({ x: wx - p.inland * 3, y: this.sea + 0.16, z: wz, yaw: i*0.7, sx: 0.9, sy: 0.12, sz: 2 });
        }
      }
      yield;
    }
    const pebble = (color: string): THREE.BufferGeometry => {
      const b = new CastleBuilder("islands", false);
      b.add(new THREE.SphereGeometry(U, 7, 4), 0, 0, 0, color, 0, 5);
      return b.finish();
    };
    const rock = new CastleBuilder("islands", false);
    rock.add(new THREE.CylinderGeometry(0.45 * U, U, U, 6, 2).translate(0, U / 2, 0), 0, 0, 0, "#343c40", 0, 5);
    this.batch("west-basalt-stacks", rock.finish(), stacks);
    this.batch("broken-basalt", pebble("#40464a"), rocks);
    this.batch("east-grey-shingle", pebble("#858681"), shingle);
    this.batch("brown-heather", pebble("#6e5b50"), heather);
    this.batch("tidal-kelp", pebble("#3d4a3a"), kelp);
    this.batch("broken-foam", pebble("#d4dedb"), foam);
    yield;
    const shrines: Pose[] = [];
    const shrineCandidates: { pose: Pose; relief: number; distance: number }[] = [];
    for (const h of hulls) for (const dx of [-8, -20, -32, -44, -60]) for (const dz of [-20, 20, -40, 40, -60, 60]) {
      const x = h.x + dx, z = h.z + dz;
      if (!this.clear(x, z, 9, true) || hulls.some(p => Math.abs(p.x-x) < 24 && Math.abs(p.z-z) < 12)) continue;
      const heights = [[0,0],[-6,0],[6,0],[0,-5],[0,5]].map(([a,b]) => g.height(x+a,z+b));
      const relief = Math.max(...heights)-Math.min(...heights);
      if (relief > 3 || !Number.isFinite(relief)) continue;
      shrineCandidates.push({ pose: { x, y: Math.min(...heights)-0.1, z, yaw: Math.PI/2 }, relief, distance: Math.hypot(x+480,z+290) });
    }
    shrineCandidates.sort((a,b) => a.relief-b.relief || a.distance-b.distance);
    if (shrineCandidates.length) shrines.push(shrineCandidates[0].pose);
    this.batch("drowned-god-shrine", shrine(), shrines);
    const flags: Pose[] = this.seats.seats.map(p => {
      const towers = this.seats.structures.filter(s => s.type == "tower" && Math.hypot(s.x-p.x,s.z-p.z) < 50);
      const tower = towers.sort((a,b) => b.top-a.top)[0];
      return tower && tower.type == "tower" ? { x: tower.x, y: tower.top + (tower.roof == "none" ? 0.05 : tower.r * (tower.roof == "cone" ? 2.1 : 0.9) + 2.5), z: tower.z, yaw: 0 } : undefined;
    }).filter((p): p is Pose => !!p);
    this.batch("static-kraken-banners", banner(), flags);
  }

  dispose(): void {
    this.steps.return();
    this.group.children.forEach(child => {
      const mesh = child as THREE.InstancedMesh;
      mesh.geometry.dispose();
      mesh.dispose();
    });
    this.group.clear();
    this.group.parent?.remove(this.group);
  }
}

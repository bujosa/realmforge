import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { bevelBox, finishGeometry } from "../core/finish";
import { CastleKit, castleModule } from "./castleKit";
import { CastlePalette, CastleStyle, castlePalettes } from "./castleStyles";

// One merged, vertex-painted draw. Surface tags select masonry, roof, wood and
// emissive windows in the shared PBR material; no draw per window or kit piece.
export default class CastleBuilder {
  private parts: THREE.BufferGeometry[] = [];
  readonly palette: CastlePalette;
  readonly windows: [number, number, number][] = [];

  constructor(readonly style: CastleStyle, readonly detailed: boolean, private kit?: CastleKit, palette?: Partial<CastlePalette>) {
    this.palette = { ...castlePalettes[style], ...palette };
  }

  add(g: THREE.BufferGeometry, x: number, y: number, z: number, color = this.palette.stone, angle = 0, surface = 0, snow = 0): void {
    g.rotateY(angle).translate(x, y, z);
    const part = g.index ? g.toNonIndexed() : g;
    if (part != g) { g.dispose(); }
    paintGeometry(part, color);
    const positions = part.getAttribute("position");
    const colors = part.getAttribute("color");
    const count = positions.count;
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < count; i++) { low = Math.min(low, positions.getY(i)); high = Math.max(high, positions.getY(i)); }
    const tags = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Contact darkening is baked per part, before the overall cavity pass.
      // Stone variation is deterministic and does not add a texture or draw.
      if (surface == 0) {
        const contact = 0.87 + 0.13 * Math.min(1, (positions.getY(i) - low) / Math.max(0.005, high - low) * 4);
        const grain = 0.98 + 0.02 * Math.sin(positions.getX(i) * 137 + positions.getZ(i) * 89);
        colors.setXYZ(i, colors.getX(i) * contact * grain, colors.getY(i) * contact * grain, colors.getZ(i) * contact * grain);
      }
      tags[i * 3] = surface;
      tags[i * 3 + 1] = surface == 3 ? 1 : 0;
      tags[i * 3 + 2] = snow * Math.max(0, part.getAttribute("normal").getY(i));
    }
    part.setAttribute("castleSurface", new THREE.Float32BufferAttribute(tags, 3));
    this.parts.push(part);
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color = this.palette.stone, angle = 0, surface = 0): void {
    this.add(this.detailed && Math.min(w, h, d) > 0.018 ? bevelBox(w, h, d) : new THREE.BoxGeometry(w, h, d), x, y, z, color, angle, surface);
  }

  module(name: string, w: number, h: number, d: number, x: number, y: number, z: number, angle = 0): void {
    this.add(castleModule(name, w, h, d, this.detailed ? this.kit : undefined), x, y, z, this.palette.stone, angle);
  }

  roof(x: number, z: number, y: number, r: number, h: number, square = false): void {
    if (this.style == "dorne" || this.style == "essos") {
      this.add(new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(r * Math.cos(i * Math.PI / 16), h * Math.sin(i * Math.PI / 16))), this.detailed ? 24 : 10), x, y, z, this.palette.roof, 0, 1);
      this.add(new THREE.ConeGeometry(0.009, 0.045, 6), x, y + h + 0.02, z, this.palette.trim);
    } else {
      this.add(new THREE.ConeGeometry(r, h, square ? 4 : this.detailed ? 24 : 10), x, y + h / 2, z, this.palette.roof, square ? Math.PI / 4 : 0, this.style == "north" ? 2 : 1, this.style == "north" ? 1 : 0);
      if (this.detailed) {
        this.add(new THREE.CylinderGeometry(r * 0.99, r * 1.04, 0.012, square ? 4 : 16), x, y + 0.006, z, this.palette.wood, square ? Math.PI / 4 : 0, 2);
      }
    }
  }

  window(x: number, y: number, z: number, angle = 0, w = 0.016, h = 0.037): void {
    if (!this.detailed) { return; }
    this.arch(w + 0.01, h + 0.009, 0.008, x, y, z, this.palette.trim, angle);
    // A dark inner reveal and a smaller pane give the opening visible depth.
    this.arch(w + 0.002, h + 0.002, 0.01, x, y, z, "#343940", angle);
    this.arch(w, h, 0.012, x, y, z, "#494540", angle, 3);
    this.box(w + 0.014, 0.004, 0.018, x, y - h / 2 - 0.002, z, this.palette.trim, angle);
    this.windows.push([x, y, z]);
  }

  private arch(w: number, h: number, depth: number, x: number, y: number, z: number, color: string, angle = 0, surface = 0): void {
    const shape = new THREE.Shape();
    const radius = w / 2;
    shape.moveTo(-radius, -h / 2);
    shape.lineTo(radius, -h / 2);
    shape.lineTo(radius, h / 2 - radius);
    for (let i = 1; i <= 6; i++) {
      const arc = i / 6 * Math.PI;
      shape.lineTo(Math.cos(arc) * radius, h / 2 - radius + Math.sin(arc) * radius);
    }
    shape.closePath();
    this.add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), x, y, z, color, angle, surface);
  }

  tower(x: number, z: number, h: number, r: number, base = 0, roof = true): void {
    const round = this.palette.round;
    if (round) {
      this.add(new THREE.CylinderGeometry(r, r * 1.08, h, this.detailed ? 24 : 10), x, base + h / 2, z);
      this.add(new THREE.CylinderGeometry(r * 1.16, r * 1.06, 0.02, this.detailed ? 24 : 10), x, base + h - 0.014, z, this.palette.trim);
      if (this.detailed) {
        this.add(new THREE.CylinderGeometry(r * 1.10, r * 1.12, 0.012, 16), x, base + 0.014, z, this.palette.trim);
        this.add(new THREE.CylinderGeometry(r * 1.035, r * 1.04, 0.008, 16), x, base + h * 0.43, z, this.palette.trim);
      }
    } else {
      this.module("tower-square", r * 2, h, r * 2, x, base, z);
      this.box(r * 2.2, 0.017, r * 2.2, x, base + h - 0.014, z, this.palette.trim);
    }
    if (roof) {
      this.roof(x, z, base + h, r * (round ? 1.22 : 1.6), this.style == "vale" ? 0.14 : 0.075, !round);
    } else {
      const count = round ? 8 : 4;
      for (let i = 0; i < count; i++) {
        const a = i * Math.PI * 2 / count + (round ? 0 : Math.PI / 4);
        this.box(0.026, 0.031, 0.026, x + Math.cos(a) * r, base + h + 0.016, z + Math.sin(a) * r, this.palette.trim, -a);
      }
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      this.window(x + Math.sin(a) * (r + 0.004), base + h * 0.65, z + Math.cos(a) * (r + 0.004), a);
    }
  }

  wall(x: number, z: number, length: number, angle: number, base = 0, h = 0.15): void {
    this.module("wall-narrow", length, h, this.style == "stormlands" ? 0.055 : 0.035, x, base, z, angle);
    if (this.detailed) {
      this.box(length, 0.012, 0.041, x, base + h * 0.7, z, this.palette.trim, angle);
      for (let i = 0; i < 3; i++) {
        const along = (i - 1) * length * 0.28;
        const offset = (this.style == "stormlands" ? 0.055 : 0.035) / 2 + 0.006;
        [-1, 1].forEach(side => this.window(
          x + Math.cos(angle) * along + Math.sin(angle) * offset * side,
          base + h * 0.46,
          z - Math.sin(angle) * along + Math.cos(angle) * offset * side,
          angle,
          0.008,
          0.03
        ));
      }
    }
  }

  gate(z: number, base = 0, h = 0.2): void {
    this.module("wall-narrow-gate", 0.085, h, 0.052, 0, base, z);
    [-1, 1].forEach(side => this.tower(side * 0.059, z, h + 0.036, 0.032, base, false));
    if (this.detailed) {
      [-1, 1].forEach(side => {
        this.box(0.006, 0.065, 0.006, side * 0.057, base + 0.10, z + 0.047, this.palette.wood, 0, 2);
        this.add(new THREE.CylinderGeometry(0.013, 0.008, 0.012, 8), side * 0.057, base + 0.136, z + 0.047, "#635a49");
      });
    }
    this.arch(0.047, h * 0.64, 0.012, 0, base + h * 0.32, z + 0.024, "#31353a");
    this.arch(0.034, h * 0.6, 0.014, 0, base + h * 0.3, z + 0.027, this.palette.wood, 0, 2);
    if (this.detailed) {
      for (let i = -2; i <= 2; i++) { this.box(0.003, h * 0.52, 0.004, i * 0.006, base + h * 0.26, z + 0.036, "#292d31"); }
      [0.16, 0.4].forEach(rise => this.box(0.031, 0.005, 0.004, 0, base + h * rise, z + 0.044, "#5d6160"));
      [-1, 1].forEach(side => this.add(new THREE.TorusGeometry(0.004, 0.0013, 4, 8), side * 0.008, base + h * 0.28, z + 0.048, "#b5a27b"));
      this.box(0.044, 0.008, 0.075, 0, base + 0.008, z + 0.042, this.palette.wood, 0, 2);
    }
  }

  curtain(w: number, d: number, base = 0, roof = true, h = 0.15): void {
    this.wall(0, -d / 2, w, 0, base, h);
    [-1, 1].forEach(side => {
      this.wall(side * w / 2, 0, d, Math.PI / 2, base, h);
      this.wall(side * w * 0.34, d / 2, w * 0.32, 0, base, h);
      [-1, 1].forEach(end => this.tower(side * w / 2, end * d / 2, h + 0.065, 0.037, base, roof));
    });
    this.gate(d / 2, base, h + 0.02);
  }

  keep(h: number, base = 0, w = 0.135, x = 0, z = -0.025): void {
    this.box(w, h, w * 0.85, x, base + h / 2, z);
    this.roof(x, z, base + h, w * 0.82, 0.095, true);
    for (let side = 0; side < 4; side++) {
      const a = side * Math.PI / 2;
      [-1, 1].forEach(i => {
        const px = x + Math.sin(a) * (w / 2 + 0.004) + Math.cos(a) * i * w * 0.23;
        const pz = z + Math.cos(a) * (w * 0.425 + 0.004) - Math.sin(a) * i * w * 0.23;
        this.window(px, base + h * 0.64, pz, a);
      });
      if (this.detailed) { this.box(w * 1.05, 0.012, 0.018, x + Math.sin(a) * w * 0.5, base + h * 0.28, z + Math.cos(a) * w * 0.425, this.palette.trim, a); }
    }
    if (this.detailed) { this.box(0.022, 0.085, 0.027, x - w * 0.3, base + h + 0.065, z - w * 0.2, this.palette.stone); }
  }

  cliff(h: number, r: number, x = 0, z = 0, color?: string): void {
    const cliff = new THREE.CylinderGeometry(r * 0.68, r, h, this.detailed ? 28 : 12, this.detailed ? 8 : 3);
    const positions = cliff.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
      const angle = Math.atan2(pz, px), rise = py / h + 0.5;
      const strata = 1 + Math.sin(angle * 3 + rise * 8) * 0.065 + Math.sin(angle * 7 - rise * 14) * 0.035 + Math.sin(rise * 43) * 0.025;
      positions.setXYZ(i, px * strata, py + Math.sin(angle * 4) * r * 0.024, pz * strata * 0.8);
    }
    cliff.computeVertexNormals();
    this.add(cliff, x, h / 2 - 0.04, z, color ?? (this.style == "westerlands" ? "#9a8a72" : "#79858a"), 0, 5);
    if (this.detailed) {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        this.add(new THREE.SphereGeometry(r * 0.22, 10, 7).scale(1, 1.8, 0.8), x + Math.cos(a) * r * 0.74, h * 0.13 - 0.04, z + Math.sin(a) * r * 0.61, color ?? "#737f81", a, 5);
      }
    }
  }

  bridge(x: number, z: number, length: number, base: number, rope = false): void {
    this.box(length, 0.014, 0.041, x, base, z, this.palette.wood, 0, 2);
    if (!this.detailed) { return; }
    for (let i = 0; i < 10; i++) {
      const px = x + (i / 9 - 0.5) * length;
      this.box(0.003, 0.004, 0.046, px, base + 0.009, z, this.palette.trim);
      [-1, 1].forEach(side => {
        if (i % 3 == 0) { this.box(0.005, 0.046, 0.005, px, base + 0.028, z + side * 0.027, this.palette.wood, 0, 2); }
        this.box(length / 9 + 0.002, 0.004, 0.004, px, base + 0.05 - (rope ? Math.sin(i / 9 * Math.PI) * 0.024 : 0), z + side * 0.027, this.palette.wood, 0, 2);
      });
    }
  }

  garden(x: number, z: number, w: number, d: number, base = 0.026): void {
    this.box(w, 0.009, d, x, base, z, "#4f7055");
    if (!this.detailed) { return; }
    this.box(w * 0.85, 0.005, 0.009, x, base + 0.009, z, "#d5c49c");
    for (let i = 0; i < 6; i++) {
      const px = x + (i % 3 - 1) * w * 0.28;
      const pz = z + (i < 3 ? -1 : 1) * d * 0.28;
      this.add(new THREE.SphereGeometry(0.012, 6, 4), px, base + 0.019, pz, "#68845b");
      this.add(new THREE.SphereGeometry(0.005, 5, 3), px, base + 0.029, pz, i % 2 ? "#d9b697" : "#bd7583");
    }
  }

  plaque(level: number, depth: number): void {
    this.box(0.105, 0.011, 0.055, 0, 0.032, depth, "#62584b");
    const shape = new THREE.Shape();
    const outline = level == 1
      ? [[-0.015, -0.016], [-0.015, 0.016], [-0.005, 0.016], [-0.005, 0.007], [0.005, 0.007], [0.005, 0.016], [0.015, 0.016], [0.015, -0.016]]
      : [[-0.032, -0.016], [-0.032, 0.016], [-0.023, 0.016], [-0.023, 0.008], [-0.014, 0.008], [-0.014, 0.016], [-0.005, 0.016], [-0.005, 0], [0.005, 0], [0.005, 0.016], [0.014, 0.016], [0.014, 0.008], [0.023, 0.008], [0.023, 0.016], [0.032, 0.016], [0.032, -0.016]];
    outline.forEach(([x, y], i) => i == 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
    shape.closePath();
    this.add(new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: false }).rotateX(-Math.PI / 2), 0, 0.039, depth, "#dfc07d");
  }

  finish(): THREE.BufferGeometry {
    const geometry = mergeGeometries(this.parts);
    this.parts.forEach(part => part.dispose());
    if (!geometry) { throw new Error("Could not assemble castle"); }
    const result = finishGeometry(geometry);
    result.computeBoundingBox();
    return result;
  }
}

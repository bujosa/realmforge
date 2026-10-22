import * as THREE from "three";
import CastleBuilder from "./CastleBuilder";

// Authored construction details stay in the castle's single merged geometry.
// Distant LODs keep only structural masses; no window/rope mesh has a material.
export function castleRopeBridge(b: CastleBuilder, x: number, length: number, base: number): void {
  const count = b.detailed ? 14 : 5;
  const sag = (t: number): number => Math.sin(t * Math.PI) * 0.014;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    b.box(length / count + 0.001, 0.009, 0.039, x + (t - 0.5) * length, base - sag(t), 0, b.palette.wood, 0, 2);
  }
  [-1, 1].forEach(side => {
    const segments = b.detailed ? 10 : 4;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments, t1 = (i + 1) / segments;
      const x0 = x + (t0 - 0.5) * length, x1 = x + (t1 - 0.5) * length;
      const y0 = base + 0.043 - sag(t0), y1 = base + 0.043 - sag(t1);
      b.add(new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0) + 0.001, 0.003, 0.003).rotateZ(Math.atan2(y1 - y0, x1 - x0)), (x0 + x1) / 2, (y0 + y1) / 2, side * 0.025, "#9b8d72", 0, 2);
      if (b.detailed || i % 2 == 0) b.box(0.003, 0.047, 0.003, x0, base + 0.020 - sag(t0), side * 0.025, b.palette.wood, 0, 2);
    }
    [-1, 1].forEach(end => b.box(0.006, 0.055, 0.006, x + end * length / 2, base + 0.023, side * 0.025, b.palette.wood, 0, 2));
  });
}

export function castleDrawbridge(b: CastleBuilder): void {
  // Gate faces local +Z. The old generic bridge ran across it along X.
  b.box(0.055, 0.014, 0.083, 0, 0.030, 0.188, b.palette.wood, 0, 2);
  [-1, 1].forEach(side => {
    b.box(0.012, 0.123, 0.025, side * 0.023, -0.0285, 0.219);
    b.box(0.004, 0.032, 0.078, side * 0.027, 0.052, 0.188, b.palette.wood, 0, 2);
  });
  if (b.detailed) {
    for (let i = 0; i < 9; i++) b.box(0.058, 0.003, 0.002, 0, 0.0385, 0.153 + i * 0.0085, "#a09476", 0, 2);
    [-1, 1].forEach(side => {
      const chain = new THREE.BoxGeometry(0.0025, 0.12, 0.0025).rotateX(-0.49);
      b.add(chain, side * 0.027, 0.096, 0.18, "#514e43", 0, 2);
    });
  }
}

export function buildWatchCastleDetails(b: CastleBuilder): void {
  // Castle Black is existing neutral scenery, not an added castle resource.
  // Timber yard and lift frame at the foot of the Wall.
  b.box(0.07, 0.08, 0.07, -0.065, 0.06, -0.04, "#686e68");
  b.roof(-0.065, -0.04, 0.10, 0.055, 0.055, true);
  [-1, 1].forEach(side => {
    b.box(0.008, 0.20, 0.009, 0.065 + side * 0.028, 0.115, -0.063, b.palette.wood, 0, 2);
    b.box(0.009, 0.032, 0.13, side * 0.099, 0.083, 0.012, b.palette.wood, 0, 2);
  });
  b.box(0.066, 0.009, 0.038, 0.065, 0.215, -0.063, b.palette.wood, 0, 2);
  b.box(0.048, 0.009, 0.035, 0.065, 0.065, -0.063, b.palette.wood, 0, 2);
  // No switchback stair: free-standing on this fort's posts it read as
  // scaffolding, and fixed to the Wall's face it read as a crooked pole
  // above the crest from the southern cameras (realism review B+D).
  if (b.detailed) {
    for (let i = 0; i < 5; i++) {
      b.box(0.008, 0.065, 0.008, -0.099, 0.047, -0.042 + i * 0.027, b.palette.wood, 0, 2);
      b.box(0.058, 0.004, 0.006, 0.065, 0.087 + i * 0.026, -0.064, "#878475", 0, 2);
    }
    b.window(-0.031, 0.064, -0.041, Math.PI / 2, 0.012, 0.023);
  }
}

export function buildCastleDetails(kind: string, b: CastleBuilder): void {
  const p = b.palette;
  if (kind == "riverrun") {
    // Paired conical gate towers and projecting stone corbels observed in
    // Belshaw's S6 gatehouse concept; overall footprint/layout remains inferred.
    [-1, 1].forEach(side => {
      b.roof(side * 0.059, 0.135, 0.269, 0.041, 0.077);
      if (b.detailed) {
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 4;
          b.box(0.008, 0.014, 0.012, side * 0.059 + Math.sin(a) * 0.033, 0.165, 0.135 + Math.cos(a) * 0.033, p.trim, a);
        }
      }
    });
  } else if (kind == "winterfell" && b.detailed) {
    // Timber braces carry the covered walks instead of a detached roof strip.
    [-1, 1].forEach(side => {
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.067;
        b.add(new THREE.BoxGeometry(0.006, 0.038, 0.006).rotateZ(0.55), x, 0.128, side * 0.178, p.wood, 0, 2);
      }
    });
    b.box(0.026, 0.006, 0.10, 0.01, 0.030, 0.115, "#8d8670");
  } else if (kind == "kings-landing" && b.detailed) {
    // Give the principal palace a finished back and side façades for orbiting.
    for (let i = 0; i < 3; i++) {
      b.window(0.055, 0.18 + i * 0.045, -0.137, Math.PI, 0.018, 0.032);
      [-1, 1].forEach(side => b.window(0.055 + side * 0.077, 0.18 + i * 0.045, -0.075, side * Math.PI / 2, 0.016, 0.032));
    }
    [-1, 1].forEach(side => {
      for (let i = 0; i < 4; i++) b.box(0.009, 0.057, 0.025, -0.04 + i * 0.06, 0.105, side > 0 ? 0.067 : -0.18, p.trim);
    });
  } else if (kind == "dragonstone" && b.detailed) {
    [-1, 1].forEach(side => {
      // Stone fins have battered feet seated on the terrace below.
      for (let i = 0; i < 3; i++) b.box(0.027, 0.037, 0.056, side * (0.073 + i * 0.033), 0.130, -0.076 + i * 0.033, p.stone, side * 0.15);
      b.window(side * 0.139, 0.245, -0.025, side * Math.PI / 2, 0.010, 0.044);
    });
  } else if (kind == "highgarden" && b.detailed) {
    for (let i = 0; i < 5; i++) {
      const x = -0.10 + i * 0.052;
      b.box(0.019, 0.10, 0.038, x, 0.128, -0.18, p.stone);
      b.box(0.026, 0.009, 0.043, x, 0.182, -0.18, p.trim);
    }
    b.box(0.032, 0.007, 0.114, 0.018, 0.086, 0.016, "#b4a482");
  } else if (kind == "storms-end" && b.detailed) {
    // Restrained projecting courses and battered court buttresses; no new
    // rows of invented large windows in the otherwise heavy solid drum.
    [0.19, 0.29, 0.385].forEach(y => b.add(new THREE.TorusGeometry(0.121 - (y - 0.19) * 0.016, 0.0025, 4, 40).rotateX(-Math.PI / 2), 0, y, -0.044, p.trim));
    for (let i = 0; i < 9; i++) {
      const a = 0.55 + i * (Math.PI * 2 - 1.1) / 8;
      b.box(0.017, 0.066, 0.039, Math.sin(a) * 0.178, 0.067, Math.cos(a) * 0.178, p.stone, a);
    }
  } else if (kind == "casterly-rock" && b.detailed) {
    [-1, 1].forEach(side => {
      for (let i = 0; i < 3; i++) {
        const z = -0.10 + i * 0.077;
        b.box(0.031, 0.10, 0.024, side * 0.145, 0.28, z, p.stone);
        b.window(side * 0.165, 0.295, z, side * Math.PI / 2, 0.011, 0.034);
      }
    });
  } else if (kind == "sunspear" && b.detailed) {
    // Garden-facing colonnade. the desert seat's unseen exterior remains an original
    // interpretation; Water Gardens references do not establish its full plan.
    for (let i = 0; i < 5; i++) {
      b.box(0.008, 0.074, 0.024, -0.077 + i * 0.038, 0.060, 0.068, p.trim);
    }
    b.box(0.18, 0.014, 0.035, 0, 0.104, 0.068, p.trim);
    b.box(0.18, 0.008, 0.039, 0, 0.023, 0.068, p.trim);
  } else if (kind == "the-eyrie" && b.detailed) {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.037;
      b.box(0.006, 0.064, 0.015, x, 0.354, 0.066, p.trim);
    }
    b.box(0.172, 0.011, 0.024, 0, 0.391, 0.066, p.trim);
  } else if (kind == "iron-bank" && b.detailed) {
    // Rear nave bays and buttress feet finish the building away from its door.
    for (let i = 0; i < 4; i++) {
      const x = -0.117 + i * 0.078;
      b.box(0.023, 0.135, 0.036, x, 0.1075, -0.171, "#afb4a7");
      b.window(x, 0.167, -0.159, Math.PI, 0.021, 0.059);
    }
  }
}

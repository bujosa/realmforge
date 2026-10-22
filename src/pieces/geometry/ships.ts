import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { emblemGeometry } from "../../heraldry";
import { paintGeometry } from "../sculpt";
import { bevelBox } from "./finish";
import { shipProfile } from "./ShipProfiles";

// Original ship study: a long clinker hull, sheer deck and tensioned square sail.
// Every plank, rope and crest is baked into the existing house/type batch. The
// same bounded geometry serves every quality; WorldScale still owns its size.
export function shipGeometry(house: string, color: string): THREE.BufferGeometry {
  const profile = shipProfile(house, color);
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, paint: string): void => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) geometry.dispose();
    part.deleteAttribute("uv");
    parts.push(paintGeometry(part, paint));
  };
  const beam = (a: number[], b: number[], radius: number, paint: string): void => {
    const direction = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    if (length < 0.00001) return;
    // Open four-sided spars: their tiny end caps are buried in deck/cloth or
    // neighbouring joints. Eight triangles per rope, rather than sixteen.
    const vertices: number[] = [];
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2, next = (i + 1) * Math.PI / 2;
      const a = [Math.cos(angle) * radius, -length / 2, Math.sin(angle) * radius];
      const b = [a[0], length / 2, a[2]];
      const c = [Math.cos(next) * radius, length / 2, Math.sin(next) * radius];
      const d = [c[0], -length / 2, c[2]];
      vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    geometry.rotateX(Math.acos(direction.y / length)).rotateY(Math.atan2(direction.x, direction.z));
    geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    add(geometry, paint);
  };
  const face = (a: number[], b: number[], c: number[], d: number[], paint: string): void => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    geometry.computeVertexNormals();
    add(geometry, paint);
  };
  const triangle = (a: number[], b: number[], c: number[], paint: string): void => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    geometry.computeVertexNormals();
    add(geometry, paint);
  };
  // Hull length stretches the keel stations. The mast and sail retain their
  // placement; the carved stem and bowsprit extend the individual silhouette.
  const L = profile.hullLength;
  const stations = [-0.315, -0.27, -0.20, -0.10, 0, 0.11, 0.21, 0.27, 0.305].map(z => z * L);
  const widths = [0.003, 0.047, 0.083, 0.101, 0.105, 0.098, 0.075, 0.042, 0.003]
    .map((width, i) => width * profile.beam * (i > 5 ? profile.sternBeam : 1));
  // Freeboard scales the topsides above the keel; freeboard 1 is the original sheer.
  const sheer = (z: number): number => 0.064 + (0.114 + Math.pow(Math.abs(z) / 0.315, 3) * 0.043) * profile.freeboard
    + profile.foredeckRise * Math.pow(Math.max(0, (-z - 0.10) / 0.215), 2);
  const section = (i: number, course: number, side: number): number[] => {
    const t = course / 5;
    // A narrow keel flares into a round bilge, then slightly tucked topsides.
    const flare = [0.07, 0.48, 0.79, 0.97, 1.02, 1][course];
    return [side * widths[i] * flare, 0.064 + (sheer(stations[i]) - 0.064) * t, stations[i]];
  };
  for (let i = 0; i < stations.length - 1; i++) {
    [-1, 1].forEach(side => {
      for (let course = 0; course < 5; course++) {
        const a = section(i, course, side), b = section(i + 1, course, side);
        const c = section(i + 1, course + 1, side), d = section(i, course + 1, side);
        const paint = profile.wood[course];
        if (side < 0) face(a, b, c, d, paint); else face(a, d, c, b, paint);
        if (course > 1) beam(d, c, 0.0016, profile.seam);
      }
      beam(section(i, 5, side), section(i + 1, 5, side), profile.ironRibs ? 0.008 : 0.006, profile.rail);
      const a = section(i, 4, side), b = section(i + 1, 4, side);
      a[1] += 0.005; b[1] += 0.005;
      beam(a, b, 0.004, color);
    });
    const z0 = stations[i], z1 = stations[i + 1];
    // Each deck strip follows the hull's sheer. The seams sit above the deck,
    // rather than disappearing under the old flat extruded lid.
    for (let plank = 0; plank < 6; plank++) {
      const x0 = plank / 3 - 1, x1 = (plank + 1) / 3 - 1;
      face([x0 * widths[i], sheer(z0) - 0.004, z0], [x0 * widths[i + 1], sheer(z1) - 0.004, z1],
        [x1 * widths[i + 1], sheer(z1) - 0.004, z1], [x1 * widths[i], sheer(z0) - 0.004, z0],
        profile.deck[plank % 2]);
      if (plank > 0) beam([x0 * widths[i], sheer(z0) - 0.002, z0], [x0 * widths[i + 1], sheer(z1) - 0.002, z1], 0.0009, "#574333");
    }
  }
  // Raised stem, sternpost and rudder: the bow points toward local -Z.
  beam([0, 0.086, -0.30 * L], [0, profile.bow, -0.333 * L], 0.009, profile.carvedProw ? profile.wood[0] : profile.rail);
  beam([0, 0.102, 0.295 * L], [0, profile.stern, 0.307 * L], 0.008, profile.rail);
  add(bevelBox(0.012, 0.10, 0.035).translate(0, 0.105, 0.306 * L), "#513a2b");
  beam([0, sheer(0.30 * L) + 0.025, 0.30 * L], [0, sheer(0.20 * L) + 0.025, 0.20 * L], 0.004, "#604630");
  if (profile.carvedProw) {
    // The black prow curls back over the stem as a short carved scroll: three
    // tapered spars, no extra material. Its tip stays above the waterline.
    const top = profile.bow;
    beam([0, top, -0.333 * L], [0, top + 0.040, -0.352 * L], 0.0075, profile.wood[0]);
    beam([0, top + 0.040, -0.352 * L], [0, top + 0.058, -0.340 * L], 0.0065, profile.wood[0]);
    beam([0, top + 0.058, -0.340 * L], [0, top + 0.046, -0.324 * L], 0.0055, profile.wood[0]);
  }
  const aftDeck = sheer(0.214) - 0.004 + profile.quarterdeck;
  add(bevelBox(0.105 * profile.beam, profile.quarterdeck, 0.084).translate(0, aftDeck - profile.quarterdeck / 2, 0.214), profile.deck[0]);
  [-1, 1].forEach(side => {
    beam([side * 0.05 * profile.beam, aftDeck, 0.175], [side * 0.044 * profile.beam, aftDeck, 0.254], 0.003, profile.rail);
  });
  if (profile.cabin) {
    // A small enclosed stern and open gallery distinguish command galleys.
    // Windows are painted apertures; no emissive material or extra draw.
    add(bevelBox(0.083 * profile.beam, 0.041, 0.055).translate(0, aftDeck + 0.020, 0.222), profile.wood[3]);
    add(bevelBox(0.096 * profile.beam, 0.007, 0.066).translate(0, aftDeck + 0.044, 0.222), profile.rail);
    [-1, 1].forEach(side => {
      [-1, 0, 1].forEach(i => add(new THREE.BoxGeometry(0.002, 0.012, 0.008).translate(side * 0.043 * profile.beam, aftDeck + 0.021, 0.222 + i * 0.015), "#302c28"));
      beam([side * 0.045 * profile.beam, aftDeck + 0.048, 0.185], [side * 0.045 * profile.beam, aftDeck + 0.066, 0.185], 0.003, profile.rail);
    });
    beam([-0.045 * profile.beam, aftDeck + 0.066, 0.185], [0.045 * profile.beam, aftDeck + 0.066, 0.185], 0.003, profile.rail);
  }
  [-0.153, 0.112].forEach(z => add(bevelBox(0.148 * profile.beam, 0.011, 0.018).translate(0, sheer(z) + 0.002, z), "#b39361"));
  add(bevelBox(0.061, 0.012, 0.065).translate(0, sheer(0.078) + 0.002, 0.078), "#4c3a2c");
  for (let i = -1; i <= 1; i++) beam([-0.028, sheer(0.078 + i * 0.017) + 0.010, 0.078 + i * 0.017], [0.028, sheer(0.078 + i * 0.017) + 0.010, 0.078 + i * 0.017], 0.002, "#ae8f60");
  [-1, 1].forEach(side => {
    for (let i = 2; i <= 6; i++) {
      const z = stations[i], x = side * widths[i];
      beam([x, sheer(z), z], [x, sheer(z) + 0.028, z], 0.003, profile.wood[3]);
      if (i < 6) beam([x, sheer(z) + 0.028, z], [side * widths[i + 1], sheer(stations[i + 1]) + 0.028, stations[i + 1]], 0.003, profile.rail);
      if (profile.ironRibs) {
        // An Ironborn study, not a new armour statistic: closed bulwarks and
        // broad dark ribs make the raider read heavily built at equal scale.
        beam(section(i, 2, side), section(i, 5, side), 0.0045, profile.rail);
        if (i < 6) {
          const nextZ = stations[i + 1], nextX = side * widths[i + 1];
          const a = [x, sheer(z), z], b = [nextX, sheer(nextZ), nextZ];
          const c = [nextX, sheer(nextZ) + 0.022, nextZ], d = [x, sheer(z) + 0.022, z];
          face(a, b, c, d, profile.wood[4]); face(d, c, b, a, profile.wood[4]);
        }
      }
    }
    // Shields ride the rail; a lower freeboard lowers their line with it.
    const shieldY = 0.173 + (profile.freeboard - 1) * 0.114;
    Array.from({ length: profile.shieldCount }, (_, i) => -0.125 + i * 0.25 / Math.max(1, profile.shieldCount - 1)).forEach(z => {
      const x = side * (Math.abs(z) > 0.10 ? 0.096 : 0.107) * profile.beam;
      add(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 8).rotateZ(Math.PI / 2).translate(x, shieldY, z), color);
      add(new THREE.SphereGeometry(0.005, 5, 3).translate(x + side * 0.004, shieldY, z), "#c4ac79");
    });
  });
  if (profile.oars) {
    // A longship's oar row: nine ports a side, with reach and blade size that
    // alternate so the crew reads as working, not as one repeated stamp. Blades
    // dip toward the water beside the hull.
    [-1, 1].forEach(side => {
      for (let oar = 0; oar < 9; oar++) {
        const station = 2 + oar / 2, i = Math.floor(station), t = station - i;
        const aPort = section(i, 3, side), bPort = section(Math.min(7, i + 1), 3, side);
        const port = aPort.map((value, axis) => value + (bPort[axis] - value) * t), z = port[2];
        const reach = 0.150 + (oar % 2) * 0.008, drop = 0.030 + (oar % 2) * 0.004;
        const hand = [side * reach, port[1] - drop, z];
        beam([port[0] - side * 0.012, port[1], z], hand, 0.0026, "#a99065");
        const blade = 0.026 + (oar % 2) * 0.006;
        const a = [hand[0], hand[1], z - 0.007], b = [hand[0], hand[1], z + 0.007];
        const c = [hand[0], hand[1] - blade, z + 0.007], d = [hand[0], hand[1] - blade, z - 0.007];
        face(a, b, c, d, "#4c3a2c"); face(d, c, b, a, "#4c3a2c");
      }
    });
  }

  const mastZ = -0.035;
  const mastFoot = sheer(mastZ) - 0.005;
  beam([0, mastFoot, mastZ], [0, 0.607, mastZ], 0.008, "#60442e");
  add(new THREE.CylinderGeometry(0.017, 0.018, 0.016, 6).translate(0, mastFoot + 0.008, mastZ), "#897047");
  beam([0, 0.583, mastZ], [0, sheer(-0.31 * L) + 0.014, -0.31 * L], 0.0018, "#c0ad83");
  beam([0, 0.583, mastZ], [0, sheer(0.28) + 0.027, 0.28], 0.0018, "#c0ad83");
  [-1, 1].forEach(side => {
    [-0.07, 0.085].forEach(z => beam([0, 0.572, mastZ], [side * 0.10 * profile.beam, sheer(z) + 0.004, z], 0.0016, "#bca981"));
  });

  const sailAngle = -0.38;
  // Keep the same eight columns; a narrower painted edge gives Greyjoy more
  // dark canvas without enlarging the unit or adding tessellation.
  const sailU = (column: number): number => column == 0 ? 0 : column == 8 ? 1
    : profile.edgeWidth + (column - 1) * (1 - 2 * profile.edgeWidth) / 6;
  const rotate = ([x, y, z]: number[]): number[] => [x * Math.cos(sailAngle) + z * Math.sin(sailAngle), y, z * Math.cos(sailAngle) - x * Math.sin(sailAngle) + mastZ];
  const sailPoint = (u: number, v: number): number[] => [
    (u - 0.5) * (profile.lateen ? profile.sailWidth * (1 - v) : profile.sailWidth - 0.052 * v) - (profile.lateen ? v * 0.06 : 0),
    profile.sailFoot + (profile.sailTop - profile.sailFoot) * v + Math.sin(u * Math.PI) * (1 - v) * 0.018,
    0.014 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.057
  ];
  const clothFace = (uvs: number[][], paint: string, side: number): void => {
    const vertices: number[] = [], normals: number[] = [];
    uvs.forEach(([u, v]) => {
      const p = sailPoint(u, v), du = sailPoint(u + 0.001, Math.min(0.999, v)), dv = sailPoint(u, Math.min(0.999, v) + 0.001);
      const origin = sailPoint(u, Math.min(0.999, v));
      const ux = du[0] - origin[0], uy = du[1] - origin[1], uz = du[2] - origin[2];
      const vx = dv[0] - origin[0], vy = dv[1] - origin[1], vz = dv[2] - origin[2];
      const nx = (uy * vz - uz * vy) * side, ny = (uz * vx - ux * vz) * side, nz = (ux * vy - uy * vx) * side;
      const length = Math.hypot(nx, ny, nz) || 1;
      vertices.push(...rotate(p));
      normals.push((nx * Math.cos(sailAngle) + nz * Math.sin(sailAngle)) / length, ny / length,
        (nz * Math.cos(sailAngle) - nx * Math.sin(sailAngle)) / length);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    add(geometry, paint);
  };
  for (let column = 0; column < 8; column++) {
    for (let row = 0; row < 5; row++) {
      const a = [sailU(column), row / 5], b = [sailU(column + 1), row / 5];
      const c = [sailU(column + 1), (row + 1) / 5], d = [sailU(column), (row + 1) / 5];
      // House paint stays on the edging as well as the hull, flag and shields.
      const paint = column == 0 || column == 7 ? color : profile.cloth[column % 2];
      const front = profile.lateen && row == 4 ? [a, b, c] : [a, b, c, a, c, d];
      clothFace(front, paint, 1); clothFace([...front].reverse(), paint, -1);
      if (column > 0) beam(rotate(sailPoint(sailU(column), row / 5)), rotate(sailPoint(sailU(column), (row + 1) / 5)), 0.0008, profile.cloth[0]);
    }
  }
  if (profile.lateen) {
    beam(rotate(sailPoint(0, 0)), rotate(sailPoint(0.5, 1)), 0.005, profile.wood[3]);
    beam(rotate(sailPoint(1, 0)), rotate(sailPoint(0.5, 1)), 0.0015, "#bcab86");
  } else {
    const yard = (profile.sailWidth - 0.052) / 2 + 0.02;
    beam(rotate([-yard, profile.sailTop + 0.007, 0.014]), rotate([yard, profile.sailTop + 0.007, 0.014]), 0.005, profile.wood[3]);
  }
  for (let i = 0; i < 8; i++) {
    beam(rotate(sailPoint(sailU(i), 0)), rotate(sailPoint(sailU(i + 1), 0)), 0.0014, "#bcab86");
  }
  [-1, 1].forEach(side => {
    beam(rotate(sailPoint(side < 0 ? 0 : 1, 0)), [side * 0.092 * profile.beam, 0.19, 0.13], 0.0018, "#bcab86");
    // Drape the existing raised emblem over the actual cloth. A flat badge at
    // a fixed Z visibly floated off the sail when seen from the quarter.
    const badge = sailPoint(0.5, profile.lateen ? 0.38 : 0.52);
    const emblem = emblemGeometry(house).scale(profile.lateen ? 0.078 : profile.crestSize, profile.lateen ? 0.078 : profile.crestSize, 0.07);
    const positions = emblem.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = badge[0] + positions.getX(i) * side, y = badge[1] + positions.getY(i);
      let v = (y - profile.sailFoot) / (profile.sailTop - profile.sailFoot), u = 0.5;
      for (let fit = 0; fit < 3; fit++) {
        const width = profile.lateen ? profile.sailWidth * (1 - v) : profile.sailWidth - 0.052 * v;
        u = (x + (profile.lateen ? v * 0.06 : 0)) / width + 0.5;
        v -= (sailPoint(u, v)[1] - y) / (profile.sailTop - profile.sailFoot);
      }
      positions.setXYZ(i, x, y, sailPoint(u, v)[2] + side * (0.002 + positions.getZ(i)));
    }
    emblem.computeVertexNormals();
    emblem.rotateY(sailAngle).translate(0, 0, mastZ);
    add(emblem, profile.crest);
  });
  if (profile.foreSail) {
    // A compact fore staysail changes the silhouette without an additional rig
    // or animation owner. It stays inside the original local -Z bow envelope.
    const a = [-0.012, 0.259, -0.285], b = [-0.012, 0.464, -0.145], c = [-0.012, 0.268, -0.075];
    triangle(a, b, c, profile.cloth[0]); triangle(c, b, a, profile.cloth[1]);
    beam(a, b, 0.0015, "#bcab86"); beam(b, c, 0.0015, "#bcab86");
    beam([0, sheer(-0.153) - 0.005, -0.153], [0, 0.478, -0.153], 0.004, profile.wood[3]);
    // The bowsprit starts inside the foredeck and extends the galleon silhouette.
    beam([0, sheer(-0.262) - 0.004, -0.262], [0, 0.222, -0.36 * L], 0.0026, profile.wood[3]);
  }
  const flag = new THREE.Shape();
  flag.moveTo(0, 0); flag.lineTo(0.115, -0.012); flag.lineTo(0.087, 0.014); flag.lineTo(0.115, 0.038); flag.lineTo(0, 0.038); flag.closePath();
  add(new THREE.ExtrudeGeometry(flag, { depth: 0.004, bevelEnabled: false }).translate(0, 0.577, mastZ), color);
  if (house == "greyjoy") {
    add(emblemGeometry(house).scale(0.055, 0.055, 0.055).rotateY(Math.PI).translate(0, profile.bow - 0.018, -0.328 * L), profile.crest);
    [-1, 1].forEach(side => {
      beam([0, 0.223, -0.306 * L], [side * 0.018, 0.254, -0.33 * L], 0.003, profile.wood[0]);
      beam([side * 0.018, 0.254, -0.33 * L], [side * 0.014, 0.278, -0.323 * L], 0.002, profile.wood[0]);
    });
  }
  if (house == "targaryen") {
    add(emblemGeometry(house).scale(0.045, 0.045, 0.045).rotateY(Math.PI).translate(0, profile.bow - 0.012, -0.329 * L), profile.crest);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error("Could not assemble ship");
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 2), 2));
  return geometry;
}

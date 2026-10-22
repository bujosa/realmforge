import * as THREE from "three";

/**
 * Procedural wyvern skeleton shared by mesh.ts (bind weights) and the runtime
 * pose solver. Joint positions are in design units (head +Z, up +Y, ground at
 * y=0); the mesh is scaled by MODEL_SCALE so the dragon keeps the footprint of
 * the phase-1 figure. Bones are a flat list under the mesh and receive
 * model-space transforms from our own forward kinematics, so skinning stays a
 * single SkinnedMesh draw with ~30 bones and no mixer/clip machinery.
 */
export const MODEL_SCALE = 0.78;

export const BONE = {
  hips: 0,
  chest: 1,
  neck0: 2,
  neck1: 3,
  neck2: 4,
  head: 5,
  jaw: 6,
  tail0: 7,
  tail1: 8,
  tail2: 9,
  tail3: 10,
  tail4: 11
} as const;

/** Right side is 0 (+X), left side is 1 (-X). */
export type Side = 0 | 1;
export const SIDES: readonly Side[] = [0, 1];
export const FINGERS = 4;
export const BONE_COUNT = 12 + 2 * 3 + 2 * (2 + FINGERS) + 2 + 2;

/** Grounded crouch: the hips sink this far (design units) and the legs fold to keep the feet planted. */
export const GROUND_DROP = 0.086;
/** Grounded crouch pitch (rad, nose down) so the chest settles close to the ground. */
const CROUCH_PITCH = 0.05;

export function sideSign(side: Side): number {
  return side == 0 ? 1 : -1;
}

/** k: 0 thigh, 1 shin, 2 foot. */
export function legBone(side: Side, k: number): number {
  return 12 + side * 3 + k;
}

/** k: 0 humerus, 1 forearm, 2.. fingers (leading to trailing). */
export function wingBone(side: Side, k: number): number {
  return 18 + side * (2 + FINGERS) + k;
}

/** Wrist thumb claw: the forefoot of the wyvern stance. */
export function thumbBone(side: Side): number {
  return 18 + 2 * (2 + FINGERS) + side;
}

/**
 * Flank anchor of the plagiopatagium's trailing edge (child of the hips).
 * Identity in flight; when folded it turns and gathers (scales down) the
 * membrane so it drapes on the flank instead of tenting.
 */
export function drapeBone(side: Side): number {
  return 18 + 2 * (2 + FINGERS) + 2 + side;
}

type V3 = readonly [number, number, number];

const SPINE: readonly { joint: V3; parent: number }[] = [
  { joint: [0, 0.205, -0.11], parent: -1 }, // hips (root)
  { joint: [0, 0.235, 0.05], parent: BONE.hips }, // chest / shoulders
  { joint: [0, 0.27, 0.145], parent: BONE.chest },
  { joint: [0, 0.315, 0.205], parent: BONE.neck0 },
  { joint: [0, 0.355, 0.255], parent: BONE.neck1 },
  { joint: [0, 0.385, 0.31], parent: BONE.neck2 }, // skull base
  { joint: [0, 0.372, 0.325], parent: BONE.head }, // jaw hinge
  { joint: [0, 0.185, -0.2], parent: BONE.hips },
  { joint: [0, 0.155, -0.31], parent: BONE.tail0 },
  { joint: [0, 0.12, -0.42], parent: BONE.tail1 },
  { joint: [0, 0.09, -0.52], parent: BONE.tail2 },
  { joint: [0, 0.07, -0.61], parent: BONE.tail3 }
];

/** Right-side joints; mirrored for the left. */
export const LEG: { hip: V3; knee: V3; ankle: V3; ball: V3 } = {
  hip: [0.05, 0.19, -0.115],
  knee: [0.074, 0.115, -0.052],
  ankle: [0.068, 0.04, -0.128],
  ball: [0.068, 0.009, -0.088]
};

export const WING: { shoulder: V3; elbow: V3; wrist: V3; tips: readonly V3[]; hip: V3 } = {
  shoulder: [0.045, 0.275, 0.085],
  elbow: [0.2, 0.3, 0.02],
  wrist: [0.535, 0.31, 0.155],
  tips: [
    [0.83, 0.29, 0.03],
    [0.79, 0.28, -0.16],
    [0.63, 0.27, -0.33],
    [0.42, 0.26, -0.38]
  ],
  /** Trailing membrane root on the flank, in front of the hind leg. */
  hip: [0.05, 0.22, -0.2]
};

export const SNOUT: V3 = [0, 0.372, 0.445];
export const TAIL_TIP: V3 = [0, 0.06, -0.7];

export function joint(v: V3, side: Side = 0): THREE.Vector3 {
  return new THREE.Vector3(v[0] * sideSign(side), v[1], v[2]);
}

export function spineJoint(bone: number): THREE.Vector3 {
  return joint(SPINE[bone].joint);
}

/** Rest pivot of every bone, in BONE_COUNT order. */
export function restPivots(): THREE.Vector3[] {
  const pivots: THREE.Vector3[] = SPINE.map(entry => joint(entry.joint));
  for (const side of SIDES) {
    pivots.push(joint(LEG.hip, side), joint(LEG.knee, side), joint(LEG.ankle, side));
  }
  for (const side of SIDES) {
    pivots.push(joint(WING.shoulder, side), joint(WING.elbow, side));
    for (let f = 0; f < FINGERS; f++) pivots.push(joint(WING.wrist, side));
  }
  for (const side of SIDES) pivots.push(joint(WING.wrist, side));
  for (const side of SIDES) pivots.push(joint(WING.hip, side));
  return pivots;
}

/** Continuous pose controls written by motion.ts every frame. */
export interface DragonPose {
  /** 0 spread (flight) … 1 wyvern fold, wrists on the ground. */
  fold: number;
  flapPhase: number;
  /** 0 … 1 stroke amplitude (0 while gliding). */
  flapAmp: number;
  /** Takeoff/landing flare: wings forward and high, legs reaching. */
  flare: number;
  legTuck: number;
  /** 0 grounded S-neck … 1 flight-stretched neck, raised tail. */
  airborne: number;
  neckYaw: number;
  neckPitch: number;
  tailYaw: number;
  tailPitch: number;
  /** Grounded sideways tail curl, keeps the footprint compact. */
  tailCurl: number;
  /** 0 standing/flying … 1 resting crouch: hips low, legs folded, neck in an S, tail on the ground. */
  crouch: number;
  breath: number;
  jaw: number;
  bodyPitch: number;
  time: number;
}

export function createPose(): DragonPose {
  return {
    fold: 1,
    flapPhase: 0,
    flapAmp: 0,
    flare: 0,
    legTuck: 0,
    airborne: 0,
    neckYaw: 0,
    neckPitch: 0,
    tailYaw: 0,
    tailPitch: 0,
    tailCurl: 1,
    crouch: 1,
    breath: 0,
    jaw: 0,
    bodyPitch: 0,
    time: 0
  };
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Rotation taking the rest frame (direction + up hint) onto a target frame. */
function aimFramed(restDir: THREE.Vector3, restUp: THREE.Vector3, dir: THREE.Vector3, up: THREE.Vector3): THREE.Quaternion {
  const frame = (d: THREE.Vector3, u: THREE.Vector3): THREE.Quaternion => {
    const x = d.clone().normalize();
    const y = u.clone().addScaledVector(x, -u.dot(x)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  };
  return frame(dir, up).multiply(frame(restDir, restUp).invert());
}

/** Rotation about X that turns rest offset `from` toward `to` (both in the YZ plane). */
function pitchBetween(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(from.y, from.z) - Math.atan2(to.y, to.z);
}

/** Model-space transform of the chest in the full resting crouch. */
function crouchedChest(): { rot: THREE.Quaternion; pos: THREE.Vector3 } {
  const rot = new THREE.Quaternion().setFromAxisAngle(X, CROUCH_PITCH);
  const hips = spineJoint(BONE.hips).add(new THREE.Vector3(0, -GROUND_DROP, 0));
  const pos = spineJoint(BONE.chest).sub(spineJoint(BONE.hips)).applyQuaternion(rot).add(hips);
  return { rot, pos };
}

interface WingFold {
  humerus: THREE.Quaternion;
  forearm: THREE.Quaternion;
  fingers: THREE.Quaternion[];
  thumb: THREE.Quaternion;
  drape: THREE.Quaternion;
  drapeScale: THREE.Vector3;
  /** Fan-closing yaw per finger toward the trailing finger (right-side sign). */
  fan: number[];
}

/**
 * Resting wyvern fold, solved once in ground space and stored chest-local.
 * The wrist knuckles are planted ahead of the chest like forefeet; the
 * forearm climbs back at ~45° to an elbow tucked against the flank just above
 * the back; the four fingers fan back from the wrist along the flank (leading
 * finger along the forearm, trailing finger near the haunch), alternating in
 * and out so the membranes between them pleat. The wing's upper face (rest
 * +Y) turns outward, so the leathery dorsal side is the one players see.
 */
function solveFold(side: Side): WingFold {
  const s = sideSign(side);
  const chest = crouchedChest();
  const toChest = chest.rot.clone().invert();
  const chestRest = spineJoint(BONE.chest);
  // Ground-space target → chest-local rest frame.
  const local = (v: THREE.Vector3): THREE.Vector3 => v.clone().sub(chest.pos).applyQuaternion(toChest).add(chestRest);
  const localDir = (v: THREE.Vector3): THREE.Vector3 => v.clone().applyQuaternion(toChest);
  const restUp = new THREE.Vector3(0, 1, 0);
  const S = joint(WING.shoulder, side);
  const E = joint(WING.elbow, side);
  const W = joint(WING.wrist, side);
  const outward = (lift: number): THREE.Vector3 => localDir(new THREE.Vector3(s, lift, 0));

  const elbowTarget = local(new THREE.Vector3(0.092 * s, 0.22, -0.074));
  const humerus = aimFramed(E.clone().sub(S), restUp, elbowTarget.sub(S), outward(0.35));
  const foldedE = S.clone().add(E.clone().sub(S).applyQuaternion(humerus));
  const wristTarget = local(new THREE.Vector3(0.14 * s, 0.046, 0.2));
  const forearm = aimFramed(W.clone().sub(E), restUp, wristTarget.clone().sub(foldedE), outward(0.2));
  const foldedW = foldedE.clone().add(W.clone().sub(E).applyQuaternion(forearm));

  // Finger elevations above the ground (leading → trailing) and pleat
  // offsets. Folding the hand back in its own plane puts the trailing finger
  // next to the forearm and the leading finger lowest, so the membranes stay
  // ordered (no crossing sheets) and the plagiopatagium fills the gap between
  // forearm and trailing finger.
  const rise = [0.08, 0.13, 0.18, 0.22];
  const pleat = [0.03, -0.03, 0, -0.06];
  const fingers: THREE.Quaternion[] = [];
  const fan: number[] = [];
  const angle = (v: THREE.Vector3): number => Math.atan2(v.x, v.z);
  const trailing = joint(WING.tips[FINGERS - 1]).sub(joint(WING.wrist));
  for (let f = 0; f < FINGERS; f++) {
    const tip = joint(WING.tips[f], side);
    const dir = localDir(new THREE.Vector3((pleat[f] - 0.11) * s, Math.sin(rise[f]), -Math.cos(rise[f])));
    fingers.push(aimFramed(tip.clone().sub(W), restUp, dir, outward(0.3)));
    fan.push(angle(trailing) - angle(joint(WING.tips[f]).sub(joint(WING.wrist))));
  }
  // Drape: gather the flank→trailing-finger edge so it reaches the folded tip.
  const H = joint(WING.hip, side);
  const restEdge = joint(WING.tips[FINGERS - 1], side).sub(H);
  const foldedTip = joint(WING.tips[FINGERS - 1], side).sub(W).applyQuaternion(fingers[FINGERS - 1]).add(foldedW);
  const edge = foldedTip.sub(H);
  const sy = 0.5;
  const sz = 0.55;
  const sx = Math.sqrt(Math.max(1e-4, edge.lengthSq() - (restEdge.y * sy) ** 2 - (restEdge.z * sz) ** 2)) / Math.abs(restEdge.x);
  const drapeScale = new THREE.Vector3(Math.min(1, sx), sy, sz);
  const gathered = restEdge.clone().multiply(drapeScale);
  const drape = new THREE.Quaternion().setFromUnitVectors(gathered.normalize(), edge.normalize());
  // Thumb claw points forward and down onto the ground.
  const thumbRest = new THREE.Vector3(-0.25 * s, -0.35, 1);
  const thumb = aimFramed(thumbRest, restUp, localDir(new THREE.Vector3(0.18 * s, -0.42, 1)), localDir(new THREE.Vector3(0, 1, 0.3)));
  return { humerus, forearm, fingers, thumb, drape, drapeScale, fan };
}

/** Thigh/shin/foot pitches (rad) that keep the feet planted in the full crouch. */
function solveCrouchLeg(): [number, number, number] {
  const hipsAngle = CROUCH_PITCH;
  const hipsRest = spineJoint(BONE.hips);
  const hipsPos = hipsRest.clone().add(new THREE.Vector3(0, -GROUND_DROP, 0));
  const rot = new THREE.Quaternion().setFromAxisAngle(X, hipsAngle);
  const hip = joint(LEG.hip).sub(hipsRest).applyQuaternion(rot).add(hipsPos);
  const thigh = joint(LEG.knee).sub(joint(LEG.hip)).setX(0);
  const shin = joint(LEG.ankle).sub(joint(LEG.knee)).setX(0);
  // Ankle a little forward of rest, under the haunch.
  const target = joint(LEG.ankle).add(new THREE.Vector3(0, 0.004, 0.018));
  const d = target.clone().sub(hip).setX(0);
  const l1 = thigh.length();
  const l2 = shin.length();
  const dist = Math.min(l1 + l2 - 1e-4, d.length());
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
  // Two solutions: keep the one with the knee forward.
  const base = Math.atan2(d.y, d.z);
  const k1 = new THREE.Vector3(0, Math.sin(base + a), Math.cos(base + a));
  const k2 = new THREE.Vector3(0, Math.sin(base - a), Math.cos(base - a));
  const kneeDir = k1.z > k2.z ? k1 : k2;
  const knee = hip.clone().setX(0).addScaledVector(kneeDir, l1);
  const shinDir = target.clone().setX(0).sub(knee);
  const thighModel = pitchBetween(thigh, kneeDir);
  const shinModel = pitchBetween(shin, shinDir);
  return [thighModel - hipsAngle, shinModel - thighModel, -shinModel];
}

/**
 * Pose solver: writes model-space transforms into the flat bone list.
 * Allocation-free per frame.
 */
export class DragonRig {
  readonly bones: THREE.Bone[] = [];
  private readonly rest = restPivots();
  private readonly folds = SIDES.map(solveFold);
  private readonly crouchLeg = solveCrouchLeg();
  /** Extra tail pitch per segment that lays the crouched tail along the ground. */
  private readonly groundTail = [0, 0, 0, 0, 0];
  private readonly model: THREE.Quaternion[] = [];
  private readonly pos: THREE.Vector3[] = [];
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly flight = new THREE.Quaternion();
  private readonly tip = joint(TAIL_TIP);
  private readonly probe = new THREE.Vector3();

  constructor() {
    for (let i = 0; i < BONE_COUNT; i++) {
      const bone = new THREE.Bone();
      bone.name = `dragon-bone-${i}`;
      bone.position.copy(this.rest[i]);
      this.bones.push(bone);
      this.model.push(new THREE.Quaternion());
      this.pos.push(this.rest[i].clone());
    }
    this.solveGroundTail();
  }

  /**
   * Bisect each tail segment's pitch so the next joint rests at the tail's
   * own radius above the ground (rump slopes down, the rest lies flat).
   */
  private solveGroundTail(): void {
    const heights = [0.05, 0.026, 0.017, 0.011, 0.007];
    const pose = createPose();
    for (let i = 0; i < 5; i++) {
      let lo = -1.2;
      let hi = 1.2;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        this.groundTail[i] = mid;
        this.apply(pose);
        const y = i < 4 ? this.pos[BONE.tail0 + i + 1].y : this.attached(BONE.tail4, this.tip, this.probe).y;
        // The tail points back (-Z): positive pitch raises it.
        if (y > heights[i]) hi = mid;
        else lo = mid;
      }
    }
    // Leave the bones at rest: the mesh binds its inverse matrices to them.
    for (let i = 0; i < BONE_COUNT; i++) {
      this.bones[i].position.copy(this.rest[i]);
      this.bones[i].quaternion.identity();
      this.bones[i].scale.set(1, 1, 1);
    }
  }

  private local(out: THREE.Quaternion, ax: THREE.Vector3, a: number, bx?: THREE.Vector3, b?: number): THREE.Quaternion {
    out.setFromAxisAngle(ax, a);
    if (bx && b) out.multiply(this.q2.setFromAxisAngle(bx, b));
    return out;
  }

  /** Child pivot follows its parent's model transform (rigid offset). */
  private chain(bone: number, parent: number, localRot: THREE.Quaternion): void {
    this.model[bone].copy(this.model[parent]).multiply(localRot);
    this.pos[bone]
      .copy(this.rest[bone])
      .sub(this.rest[parent])
      .applyQuaternion(this.model[parent])
      .add(this.pos[parent]);
  }

  apply(p: DragonPose): void {
    const q = this.q;
    const crouch = p.crouch;
    // The S-neck and grounded tail belong to the resting crouch only.
    const rest = crouch * (1 - p.airborne);
    // Spine root and front chain.
    this.model[BONE.hips].setFromAxisAngle(X, -p.bodyPitch + crouch * CROUCH_PITCH);
    this.pos[BONE.hips].copy(this.rest[BONE.hips]);
    this.pos[BONE.hips].y -= crouch * GROUND_DROP;
    this.chain(BONE.chest, BONE.hips, this.local(q, X, -p.airborne * 0.06));
    const yaw = p.neckYaw;
    this.chain(BONE.neck0, BONE.chest, this.local(q, X, p.airborne * 0.62 - p.neckPitch * 0.3 - rest * 0.3, Y, yaw * 0.25));
    this.chain(BONE.neck1, BONE.neck0, this.local(q, X, p.airborne * 0.12 - p.neckPitch * 0.3 - rest * 0.08, Y, yaw * 0.3));
    this.chain(BONE.neck2, BONE.neck1, this.local(q, X, -p.airborne * 0.34 - p.neckPitch * 0.25 + rest * 0.2, Y, yaw * 0.3));
    this.chain(BONE.head, BONE.neck2, this.local(q, X, -p.airborne * 0.3 + p.neckPitch * 0.4 + rest * 0.24, Y, yaw * 0.35));
    this.chain(BONE.jaw, BONE.head, this.local(q, X, p.jaw * 0.5));
    // Tail: grounded curl to one side, raised and straight in flight, swaying.
    let parent: number = BONE.hips;
    for (let i = 0; i < 5; i++) {
      const bone = BONE.tail0 + i;
      const wave = Math.sin(p.time * 1.3 - i * 0.7) * 0.05 * (0.4 + i * 0.2);
      const curl = p.tailCurl * (0.12 + i * 0.07);
      const lift = -p.airborne * (i == 0 ? 0.32 : 0.06) + p.tailPitch * (0.2 + i * 0.06) * (1 - rest * 0.8) + rest * this.groundTail[i];
      this.chain(bone, parent, this.local(q, Y, curl + wave + p.tailYaw * (0.15 + i * 0.07), X, lift));
      parent = bone;
    }
    // Hind legs.
    for (const side of SIDES) {
      const tuck = p.legTuck;
      const reach = p.flare * (1 - tuck);
      const [c0, c1, c2] = this.crouchLeg;
      this.chain(legBone(side, 0), BONE.hips, this.local(q, X, tuck * 1.05 - reach * 0.45 + crouch * c0));
      this.chain(legBone(side, 1), legBone(side, 0), this.local(q, X, tuck * 0.45 + reach * 0.2 + crouch * c1));
      this.chain(legBone(side, 2), legBone(side, 1), this.local(q, X, tuck * 0.95 - reach * 0.3 + crouch * c2));
    }
    // Wings: flight stroke (hinged chain with outward lag) blended to the fold.
    const amp = p.flapAmp;
    const phi = p.flapPhase;
    const upstroke = Math.max(0, Math.cos(phi));
    const tuck = amp * upstroke * upstroke * 0.75;
    const dihedral = 0.1 * (1 - amp) + p.flare * 0.55;
    for (const side of SIDES) {
      const s = sideSign(side);
      const fold = this.folds[side];
      const elev = dihedral + amp * 0.95 * Math.sin(phi);
      const sweep = amp * 0.22 * Math.cos(phi) + p.flare * 0.4;
      const humerus = wingBone(side, 0);
      this.local(this.flight, Z, s * elev, Y, -s * sweep);
      q.copy(this.flight).slerp(fold.humerus, p.fold);
      this.chain(humerus, BONE.chest, q);
      const forearm = wingBone(side, 1);
      this.local(this.flight, Z, s * amp * 0.38 * Math.sin(phi - 0.7), Y, -s * tuck * 0.7);
      // Fold quaternions are chest-local; express them relative to the humerus chain.
      this.flightRelative(this.flight, fold.forearm, fold.humerus, p.fold);
      this.chain(forearm, humerus, this.flight);
      for (let f = 0; f < FINGERS; f++) {
        const bone = wingBone(side, 2 + f);
        const lift = s * (amp * 0.5 * Math.sin(phi - 1.3) - p.flare * 0.2 * (f / (FINGERS - 1)));
        const close = tuck * 0.6 + p.flare * 0.08;
        this.local(this.flight, Z, lift, Y, s * (tuck * 0.55 + close * fold.fan[f]));
        this.flightRelative(this.flight, fold.fingers[f], fold.forearm, p.fold);
        this.chain(bone, forearm, this.flight);
      }
      this.flight.identity();
      this.flightRelative(this.flight, fold.thumb, fold.forearm, p.fold);
      this.chain(thumbBone(side), forearm, this.flight);
      this.chain(drapeBone(side), BONE.hips, q.identity().slerp(fold.drape, p.fold));
    }
    for (let i = 0; i < BONE_COUNT; i++) {
      this.bones[i].position.copy(this.pos[i]);
      this.bones[i].quaternion.copy(this.model[i]);
    }
    for (const side of SIDES) {
      const k = this.folds[side].drapeScale;
      this.bones[drapeBone(side)].scale.set(1 + (k.x - 1) * p.fold, 1 + (k.y - 1) * p.fold, 1 + (k.z - 1) * p.fold);
    }
    const chest = 1 + p.breath * 0.035;
    this.bones[BONE.chest].scale.set(chest, 1 + p.breath * 0.02, 1);
  }

  /**
   * Blend a flight-local rotation with the fold, where fold rotations are
   * chest-local: local = inverse(parentFold) * childFold.
   */
  private flightRelative(flight: THREE.Quaternion, childFold: THREE.Quaternion, parentFold: THREE.Quaternion, t: number): void {
    this.q2.copy(parentFold).invert().multiply(childFold);
    flight.slerp(this.q2, t);
  }

  /** Model-space position of a rest point rigidly attached to a bone. */
  attached(bone: number, restPoint: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(restPoint).sub(this.rest[bone]).applyQuaternion(this.model[bone]).add(this.pos[bone]);
  }

  /** Current forward direction of a bone's rest +Z axis. */
  forward(bone: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(Z).applyQuaternion(this.model[bone]);
  }
}

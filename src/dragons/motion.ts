import * as THREE from "three";
import type { DragonFlightState } from "./types";
import { createPose, DragonPose } from "./rig";

/** Critically-damped spring used for neck / tail follow-through. */
export class Spring2 {
  readonly value = new THREE.Vector2(0, 0);
  readonly velocity = new THREE.Vector2(0, 0);

  step(targetX: number, targetY: number, dt: number, stiffness = 28, damping = 8): void {
    const ax = (targetX - this.value.x) * stiffness - this.velocity.x * damping;
    const ay = (targetY - this.value.y) * stiffness - this.velocity.y * damping;
    this.velocity.x += ax * dt;
    this.velocity.y += ay * dt;
    this.value.x += this.velocity.x * dt;
    this.value.y += this.velocity.y * dt;
  }
}

export interface FlightSample {
  position: THREE.Vector3;
  heading: number;
  bank: number;
  state: DragonFlightState;
  turnRate: number;
  /** Articulated pose for rig.ts (shared object, mutated every sample). */
  pose: DragonPose;
}

interface PatrolConfig {
  center: THREE.Vector3;
  radius: number;
  altitude: number;
  angle: number;
}

interface TransitConfig {
  from: THREE.Vector3;
  to: THREE.Vector3;
  durationMs: number;
  elapsedMs: number;
  after: "patrol" | "land" | "hover";
  landPos?: THREE.Vector3;
}

function noise(t: number): number {
  return Math.sin(t * 0.73) * 0.15 + Math.sin(t * 1.31 + 1.7) * 0.08 + Math.sin(t * 2.11 + 0.4) * 0.04;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Exponential approach, frame-rate independent. */
function approach(value: number, target: number, rate: number, dt: number): number {
  return value + (target - value) * (1 - Math.exp(-rate * dt));
}

interface PoseTargets {
  fold: number;
  crouch: number;
  legTuck: number;
  airborne: number;
  flare: number;
  amp: number;
  rate: number;
  pitch: number;
}

let seedCounter = 0;

export class DragonFlightController {
  state: DragonFlightState = "grounded";
  readonly position = new THREE.Vector3(0, 0, 0);
  heading = 0;
  bank = 0;
  readonly pose = createPose();
  private time = 0;
  private phase = 0;
  private readonly seed = (seedCounter++ % 7) * 1.37 + hash(seedCounter) * 5;
  private patrol: PatrolConfig | null = null;
  private transit: TransitConfig | null = null;
  private readonly neck = new Spring2();
  private readonly tail = new Spring2();
  private prevHeading = 0;
  private takeoffElapsed = 0;
  private landElapsed = 0;
  private landTarget: THREE.Vector3 | null = null;
  private hoverCenter: THREE.Vector3 | null = null;
  private readonly targets: PoseTargets = { fold: 1, crouch: 1, legTuck: 0, airborne: 0, flare: 0, amp: 0, rate: 0, pitch: 0 };

  get neckValue(): THREE.Vector2 {
    return this.neck.value;
  }

  get tailValue(): THREE.Vector2 {
    return this.tail.value;
  }

  get flapPhase(): number {
    return this.phase;
  }

  place(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.state = "grounded";
    this.patrol = null;
    this.transit = null;
  }

  /** External region-safe trajectories own position; this controller owns pose. */
  articulate(airborne: boolean): void {
    this.patrol = null; this.transit = null;
    this.state = airborne ? "patrol" : "grounded";
  }

  patrolTo(center: THREE.Vector3, radius: number, altitude: number): void {
    const angle = Math.atan2(this.position.z - center.z, this.position.x - center.x);
    this.patrol = {
      center: center.clone(),
      radius: Math.max(0.05, radius),
      altitude,
      angle: isFinite(angle) ? angle : 0
    };
    if (this.state == "grounded") {
      this.state = "takeoff";
      this.takeoffElapsed = 0;
    } else if (this.state != "takeoff" && this.state != "landing" && this.state != "transit") {
      this.state = "patrol";
    }
  }

  flyTo(pos: THREE.Vector3, durationMs: number): void {
    const duration = Math.max(120, durationMs);
    // Explicit move events supersede regional patrol until patrol() is called again.
    this.patrol = null;
    this.transit = {
      from: this.position.clone(),
      to: pos.clone(),
      durationMs: duration,
      elapsedMs: 0,
      after: "land",
      landPos: pos.clone()
    };
    // A public move's duration includes lift-off and touchdown, like its marker.
    this.state = "transit";
    this.hoverCenter = pos.clone();
  }

  landAt(pos: THREE.Vector3): void {
    this.landTarget = pos.clone();
    if (this.state == "grounded") {
      this.position.copy(pos);
      return;
    }
    this.transit = {
      from: this.position.clone(),
      to: new THREE.Vector3(pos.x, pos.y + 0.35, pos.z),
      durationMs: 1400,
      elapsedMs: 0,
      after: "land",
      landPos: pos.clone()
    };
    this.state = "transit";
  }

  sample(dtMs: number, reducedMotion: boolean): FlightSample {
    const dt = Math.min(0.05, Math.max(0, dtMs / 1000));
    this.time += dt;

    if (reducedMotion) {
      return this.idleSample(dt);
    }

    if (this.state == "takeoff") {
      this.takeoffElapsed += dt;
      const baseY = this.patrol
        ? this.patrol.altitude
        : this.transit
          ? this.transit.to.y
          : this.position.y + 0.4;
      this.position.y += (baseY - this.position.y) * Math.min(1, dt * 2.2);
      if (this.takeoffElapsed >= 1.1) {
        this.state = this.transit ? "transit" : this.patrol ? "patrol" : "hover";
      }
    } else if (this.state == "patrol" && this.patrol) {
      this.advancePatrol(dt);
    } else if (this.state == "transit" && this.transit) {
      // Route duration follows the same presentation clock as its piece; only
      // spring integration is clamped on slow frames.
      this.advanceTransit(Math.max(0, Number.isFinite(dtMs) ? dtMs : 0) / 1000);
    } else if (this.state == "hover") {
      this.advanceHover(dt);
    } else if (this.state == "landing") {
      this.advanceLanding(dt);
    }

    const turnRate = this.headingDelta(dt);
    this.bank += ((-turnRate * 0.45) - this.bank) * Math.min(1, dt * 4);
    this.bank = Math.max(-0.7, Math.min(0.7, this.bank));

    this.chooseTargets();
    this.integratePose(dt, turnRate);
    return {
      position: this.position,
      heading: this.heading,
      bank: this.bank,
      state: this.state,
      turnRate,
      pose: this.pose
    };
  }

  /** Glide phases: long flapping bouts broken by held-wing glides. */
  private glide(): number {
    return smoothstep(0.3, 0.75, 0.5 + 0.5 * Math.sin(this.time * 0.55 + this.seed));
  }

  private chooseTargets(): void {
    const t = this.targets;
    const cruise = (): void => {
      const glide = this.glide();
      t.fold = 0;
      t.crouch = 0;
      t.legTuck = 1;
      t.airborne = 1;
      t.flare = 0;
      t.amp = 1 - glide * 0.94;
      t.rate = 7.2;
      t.pitch = 0.04 - glide * 0.06;
    };
    switch (this.state) {
      case "grounded": {
        // Occasional wing shuffle: a short partial unfold and settle.
        const cycle = (this.time + this.seed * 3) % 13;
        const shuffle = cycle < 1.8 ? Math.sin((Math.PI * cycle) / 1.8) : 0;
        t.fold = 1 - shuffle * 0.22;
        t.crouch = 1;
        t.legTuck = 0;
        t.airborne = 0;
        t.flare = 0;
        t.amp = shuffle * 0.18;
        t.rate = 5;
        t.pitch = 0;
        break;
      }
      case "takeoff": {
        const e = this.takeoffElapsed;
        t.fold = 0;
        // Spring up out of the crouch while the wings open.
        t.crouch = 1 - smoothstep(0, 0.3, e);
        t.legTuck = smoothstep(0.35, 0.8, e);
        t.airborne = smoothstep(0, 0.6, e);
        t.flare = 1 - smoothstep(0.15, 0.6, e);
        t.amp = 1;
        t.rate = 10.5;
        t.pitch = 0.28 * (1 - smoothstep(0.3, 1.1, e));
        break;
      }
      case "transit": {
        const transit = this.transit;
        const elapsed = transit ? transit.elapsedMs / 1000 : 0;
        const remaining = transit ? Math.max(0, (transit.durationMs - transit.elapsedMs) / 1000) : 0;
        const total = elapsed + remaining;
        // Lift-off and touchdown windows scale down for short public moves.
        const lift = Math.min(0.55, total * 0.22);
        const touch = Math.min(0.6, total * 0.25);
        cruise();
        if (elapsed < lift) {
          const k = elapsed / Math.max(0.01, lift);
          t.fold = k < 0.15 ? 1 : 0;
          t.crouch = 1 - smoothstep(0, 0.45, k);
          t.legTuck = 0;
          t.flare = 0.9;
          t.amp = 1;
          t.rate = 10.5;
          t.pitch = 0.26;
        } else if (remaining < touch) {
          const k = 1 - remaining / Math.max(0.01, touch);
          t.legTuck = 0;
          t.flare = 1;
          t.amp = 1 - smoothstep(0.75, 1, k) * 0.8;
          t.rate = 9.5;
          t.pitch = 0.34 * (1 - smoothstep(0.8, 1, k));
          t.fold = k > 0.82 ? 1 : 0;
          t.crouch = smoothstep(0.7, 1, k);
        }
        break;
      }
      case "hover":
        t.fold = 0;
        t.crouch = 0;
        t.legTuck = 0.4;
        t.airborne = 0.8;
        t.flare = 0.35;
        t.amp = 0.95;
        t.rate = 9;
        t.pitch = 0.18;
        break;
      case "landing": {
        const k = smoothstep(0, 1.2, this.landElapsed);
        t.fold = k > 0.85 ? 1 : 0;
        t.crouch = smoothstep(0.7, 1, k);
        t.legTuck = 0;
        t.airborne = 1 - k;
        t.flare = 1;
        t.amp = 1 - k * 0.8;
        t.rate = 9.5;
        t.pitch = 0.32 * (1 - k);
        break;
      }
      default:
        cruise();
    }
  }

  private integratePose(dt: number, turnRate: number): void {
    const t = this.targets;
    const p = this.pose;
    const grounded = this.state == "grounded";
    // Folding is quick (the wing snaps shut), unfolding a touch slower.
    p.fold = approach(p.fold, t.fold, t.fold > p.fold ? 9 : 7, dt);
    p.crouch = approach(p.crouch, t.crouch, 7, dt);
    p.legTuck = approach(p.legTuck, t.legTuck, 5, dt);
    p.airborne = approach(p.airborne, t.airborne, 4, dt);
    p.flare = approach(p.flare, t.flare, 6, dt);
    p.flapAmp = approach(p.flapAmp, t.amp, 4, dt);
    p.bodyPitch = approach(p.bodyPitch, t.pitch, 4, dt);
    p.tailCurl = 1 - p.airborne;
    // Keep stroking while the amplitude is meaningful; a glide holds the wings.
    this.phase += dt * t.rate * (0.3 + 0.7 * Math.min(1, p.flapAmp * 1.4));
    p.flapPhase = this.phase;
    p.time = this.time;

    let neckX: number;
    let neckY: number;
    if (grounded) {
      // Look around now and then; lower the head while resting.
      const k = Math.floor((this.time + this.seed * 2) / 4.5);
      neckX = (hash(k + this.seed) - 0.5) * 1.1;
      neckY = (hash(k * 1.7 + 3 + this.seed) - 0.5) * 0.5;
    } else {
      neckX = -turnRate * 0.8 + Math.sin(this.time * 1.7) * 0.04;
      neckY = Math.sin(this.phase * 0.5) * 0.08 * p.flapAmp;
    }
    const tailX = grounded ? Math.sin(this.time * 0.6 + this.seed) * 0.3 : turnRate * 1.1;
    const tailY = grounded ? Math.sin(this.time * 0.9) * 0.1 : -Math.sin(this.phase - 0.8) * 0.18 * p.flapAmp;
    this.neck.step(neckX, neckY, dt, grounded ? 6 : 28, grounded ? 4.5 : 8);
    this.tail.step(tailX, tailY, dt, grounded ? 5 : 20, grounded ? 4 : 7);
    p.neckYaw = this.neck.value.x;
    p.neckPitch = this.neck.value.y;
    p.tailYaw = this.tail.value.x;
    p.tailPitch = this.tail.value.y;
    p.breath = 0.5 + 0.5 * Math.sin(this.time * (grounded ? 1.6 : 3.2));
    const pant = (this.time + this.seed * 5) % 9;
    p.jaw = grounded && pant < 1.4 ? Math.sin((Math.PI * pant) / 1.4) * 0.18 : 0;
  }

  private idleSample(dt: number): FlightSample {
    // Reduced motion: slow grounded idle only (breathing, a gentle head drift).
    const p = this.pose;
    this.phase += dt * 0.45;
    this.neck.step(Math.sin(this.time * 0.25) * 0.12, Math.sin(this.time * 0.3) * 0.05, dt, 6, 5);
    this.tail.step(Math.sin(this.time * 0.2 + 1) * 0.1, 0, dt, 5, 4);
    this.bank *= Math.max(0, 1 - dt * 3);
    this.state = "grounded";
    this.transit = null;
    p.fold = 1;
    p.crouch = 1;
    p.flapAmp = 0;
    p.flare = 0;
    p.legTuck = 0;
    p.airborne = 0;
    p.tailCurl = 1;
    p.bodyPitch = 0;
    p.jaw = 0;
    p.neckYaw = this.neck.value.x;
    p.neckPitch = this.neck.value.y;
    p.tailYaw = this.tail.value.x;
    p.tailPitch = 0;
    p.breath = 0.5 + 0.5 * Math.sin(this.time * 0.8);
    p.flapPhase = this.phase;
    p.time = this.time * 0.3;
    return {
      position: this.position,
      heading: this.heading,
      bank: this.bank,
      state: "grounded",
      turnRate: 0,
      pose: p
    };
  }

  private advancePatrol(dt: number): void {
    if (!this.patrol) return;
    const speed = 0.55 / Math.max(0.2, this.patrol.radius);
    this.patrol.angle += dt * speed * (1 - this.glide() * 0.2);
    const n = noise(this.time);
    const r = this.patrol.radius * (1 + n * 0.35);
    const x = this.patrol.center.x + Math.cos(this.patrol.angle) * r;
    const z = this.patrol.center.z + Math.sin(this.patrol.angle) * r;
    // Climb while flapping, sink gently while gliding.
    const y = this.patrol.altitude + Math.sin(this.time * 1.1) * 0.04 + n * 0.04 - this.glide() * 0.05;
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    this.position.set(x, y, z);
    if (Math.hypot(dx, dz) > 0.00001) {
      this.heading = Math.atan2(dx, dz);
    }
  }

  private advanceTransit(dt: number): void {
    if (!this.transit) return;
    this.transit.elapsedMs += dt * 1000;
    const u = Math.min(1, this.transit.elapsedMs / this.transit.durationMs);
    const ease = u * u * (3 - 2 * u);
    const from = this.transit.from;
    const to = this.transit.to;
    const lift = Math.sin(ease * Math.PI) * 0.45;
    this.position.set(
      from.x + (to.x - from.x) * ease,
      from.y + (to.y - from.y) * ease + lift,
      from.z + (to.z - from.z) * ease
    );
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (Math.hypot(dx, dz) > 0.00001) {
      this.heading = Math.atan2(dx, dz);
    }
    if (u >= 1) {
      const after = this.transit.after;
      const landPos = this.transit.landPos;
      this.transit = null;
      if (after == "land" && landPos) {
        this.place(landPos);
      } else if (after == "patrol" && this.patrol) {
        this.state = "patrol";
      } else {
        this.state = "hover";
        this.hoverCenter = this.position.clone();
      }
    }
  }

  private advanceHover(dt: number): void {
    const c = this.hoverCenter ?? this.position;
    this.position.x += (c.x - this.position.x) * Math.min(1, dt * 2);
    this.position.z += (c.z - this.position.z) * Math.min(1, dt * 2);
    this.position.y = c.y + Math.sin(this.time * 2.2) * 0.05;
    if (this.patrol) {
      // Resume patrol after a short hover if one was configured.
      this.state = "patrol";
    }
  }

  private advanceLanding(dt: number): void {
    this.landElapsed += dt;
    const target = this.landTarget ?? this.position;
    const u = smoothstep(0, 1.2, this.landElapsed);
    this.position.x += (target.x - this.position.x) * Math.min(1, dt * 3);
    this.position.z += (target.z - this.position.z) * Math.min(1, dt * 3);
    this.position.y += (target.y - this.position.y) * Math.min(1, dt * 2.5);
    if (u >= 1) {
      this.position.copy(target);
      this.state = "grounded";
      this.landTarget = null;
      this.patrol = null;
    }
  }

  private headingDelta(dt: number): number {
    let delta = this.heading - this.prevHeading;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.prevHeading = this.heading;
    return dt > 0 ? delta / dt : 0;
  }
}

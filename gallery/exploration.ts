import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { WalkSurfaceIndex } from "./collision";
import type { StoryInstance } from "./registry";

export type NavigationMode = "orbit" | "fly" | "walk";
/** Gallery-owned navigation. Metres match SceneFrame (50 m per unit). */
export class Exploration {
  mode: NavigationMode = "orbit";
  speed = 1;
  private story: StoryInstance | null = null;
  private keys = new Set<string>();
  private pointers = new Map<number, THREE.Vector2>();
  private ray = new THREE.Raycaster();
  private yaw = 0;
  private pitch = 0;
  private eye = 1.8 / 50;
  private radius = 0.35 / 50;
  private flight?: { from: THREE.Vector3; to: THREE.Vector3; pivot: THREE.Vector3; time: number };
  private surfaces?: WalkSurfaceIndex;
  private lastPinch = 0;
  private horizontal = new THREE.Vector3();
  private sideways = new THREE.Vector3();
  private mobile = new THREE.Vector2();
  constructor(private camera: THREE.PerspectiveCamera, private orbit: OrbitControls, private canvas: HTMLCanvasElement, private changed: (mode: NavigationMode) => void) {
    canvas.tabIndex = 0;
    addEventListener("keydown", event => {
      if ((event.target as HTMLElement)?.closest("input,select,textarea,button") || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      // E enters exploration from orbit; once exploring, E is ascend.
      if (key === "e" && this.mode === "orbit") this.changed("fly");
      else if (key === "g") this.changed(this.mode === "walk" ? "orbit" : "walk");
      else if (key === "escape") this.changed("orbit");
      if (["w","a","s","d","q","e","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key)) { this.keys.add(key); if (this.mode !== "orbit") event.preventDefault(); }
    });
    addEventListener("keyup", event => this.keys.delete(event.key.toLowerCase()));
    addEventListener("blur", () => { this.keys.clear(); this.pointers.clear(); this.mobile.set(0,0); });
    canvas.addEventListener("pointerdown", event => {
      if (this.mode === "orbit") return;
      canvas.focus({ preventScroll: true }); if (event.isTrusted) canvas.setPointerCapture(event.pointerId);
      this.flight = undefined; this.pointers.set(event.pointerId, new THREE.Vector2(event.clientX,event.clientY)); this.lastPinch = 0;
    });
    canvas.addEventListener("pointermove", event => {
      const previous = this.pointers.get(event.pointerId); if (!previous || this.mode === "orbit") return;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      previous.set(event.clientX,event.clientY);
      if (this.pointers.size > 1) {
        const [a,b] = [...this.pointers.values()]; const pinch = a.distanceTo(b);
        if (this.lastPinch) this.speed = THREE.MathUtils.clamp(this.speed * (pinch / this.lastPinch),0.02,100);
        this.lastPinch = pinch;
        this.move(-dx * this.speed * 0.002, dy * this.speed * 0.002, 0);
      } else { this.yaw -= dx * 0.004; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004,-1.5,1.5); this.look(); }
    });
    const release = (event: PointerEvent) => { this.pointers.delete(event.pointerId); this.lastPinch = 0; };
    canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", event => { if (this.mode !== "orbit") { event.preventDefault(); this.speed = THREE.MathUtils.clamp(this.speed * Math.exp(-event.deltaY * 0.002),0.02,100); } }, { passive: false });
    canvas.addEventListener("dblclick", event => {
      if (!this.story) return;
      const rect = canvas.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1),camera);
      this.ray.far = camera.far;
      const hit = this.ray.intersectObject(this.story.object,true).find(hit => hit.object instanceof THREE.Mesh && !hit.object.userData.nonSolid);
      if (!hit) return;
      const to = hit.point.clone();
      if (this.mode === "walk") to.y += this.eye;
      else { const away = camera.position.clone().sub(hit.point).normalize(); to.addScaledVector(away,this.eye*3); }
      this.flight = { from: camera.position.clone(), to, pivot: hit.point.clone(), time: 0 };
      this.orbit.target.copy(hit.point);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach(button => {
      const stop = () => this.mobile.set(0,0);
      button.addEventListener("pointerdown", event => { event.preventDefault(); if (event.isTrusted) button.setPointerCapture(event.pointerId); const [x,y] = button.dataset.move!.split(",").map(Number); this.mobile.set(x,y); });
      button.addEventListener("pointerup", stop); button.addEventListener("pointercancel", stop); button.addEventListener("lostpointercapture", stop);
    });
  }
  bind(story: StoryInstance): void {
    this.mode = "orbit"; this.orbit.enabled = true;
    this.story = story; this.flight = undefined; this.keys.clear(); this.mobile.set(0,0); this.surfaces = undefined;
    story.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(story.object);
    this.speed = Math.max(0.08,box.getSize(new THREE.Vector3()).length()*0.12);
    this.eye = (story.navigation?.metresPerUnit ?? 50) ** -1 * 1.8;
    this.radius = this.eye * 0.2;
  }
  setMode(mode: NavigationMode, enter = true): void {
    const previous = this.mode; this.mode = mode; this.orbit.enabled = mode === "orbit"; this.keys.clear(); this.pointers.clear(); this.flight = undefined;
    if (previous !== "orbit" && mode === "orbit") {
      const forward = this.camera.getWorldDirection(new THREE.Vector3()); this.orbit.target.copy(this.camera.position).addScaledVector(forward,Math.max(this.eye*3,this.speed));
    }
    if (mode === "walk" && !this.surfaces && this.story) this.surfaces = new WalkSurfaceIndex(this.story.object, this.eye*15);
    if (enter && mode === "walk" && previous !== "walk") {
      const start = this.story?.navigation?.walkStart;
      if (start) { this.camera.position.fromArray(start.position); this.camera.lookAt(new THREE.Vector3().fromArray(start.target)); }
      else { this.camera.position.copy(this.orbit.target); this.camera.position.y = this.floor(this.camera.position,Infinity) + this.eye; }
      this.speed = this.eye * (3/1.8);
    }
    const angles = new THREE.Euler().setFromQuaternion(this.camera.quaternion,"YXZ"); this.yaw = angles.y; this.pitch = angles.x;
    this.camera.near = Math.min(0.001,this.eye/12); this.camera.updateProjectionMatrix();
    this.canvas.style.cursor = mode === "orbit" ? "grab" : "crosshair";
  }
  private look(): void { this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch,this.yaw,0,"YXZ")); }
  private floor(position: THREE.Vector3, maxRise = 0.012): number {
    const top = Number.isFinite(maxRise) ? position.y - this.eye + maxRise : this.camera.far;
    this.ray.set(new THREE.Vector3(position.x,top,position.z),new THREE.Vector3(0,-1,0)); this.ray.far = Number.isFinite(maxRise) ? this.eye*10 : this.camera.far*2;
    const hits = this.ray.intersectObjects(this.surfaces?.near(position) ?? [],false);
    const floor = hits.find(hit => hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y > 0.5);
    return floor?.point.y ?? 0;
  }
  private move(side: number, forward: number, vertical: number): void {
    this.horizontal.set(-Math.sin(this.yaw),0,-Math.cos(this.yaw)); this.sideways.set(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    const delta = this.horizontal.clone().multiplyScalar(forward).addScaledVector(this.sideways,side);
    if (this.mode === "fly") {
      const direction = this.camera.getWorldDirection(new THREE.Vector3());
      this.camera.position.addScaledVector(direction,forward).addScaledVector(this.sideways,side);
      this.camera.position.y += vertical; return;
    }
    // Substeps plus axis sliding keep fast motion from tunnelling through thin walls.
    const steps = Math.max(1,Math.ceil(delta.length()/(this.radius*0.75)));
    delta.divideScalar(steps);
    for (let i=0;i<steps;i++) for (const axis of ["x","z"] as const) {
      if (!delta[axis]) continue;
      const direction = new THREE.Vector3(); direction[axis] = Math.sign(delta[axis]);
      this.ray.set(this.camera.position.clone().add(new THREE.Vector3(0,-this.eye*0.35,0)),direction); this.ray.far = this.radius+Math.abs(delta[axis]);
      const wall = this.ray.intersectObjects(this.surfaces?.near(this.camera.position) ?? [],false)[0];
      if (!wall) {
        const next = this.camera.position.clone(); next[axis] += delta[axis]; const floor = this.floor(next);
        // A missing floor is a scene edge, not a cliff to fall off.
        if (Math.abs(floor - (next.y-this.eye)) < this.eye*2) { next.y = floor+this.eye; this.camera.position.copy(next); }
      }
    }
  }
  update(dt: number): void {
    // OrbitControls permits street-level distances; keep the near plane below the inspection gap.
    const near = Math.max(0.00001, Math.min(0.001, this.camera.position.distanceTo(this.orbit.target) / 1000));
    if (this.camera.near !== near) { this.camera.near = near; this.camera.updateProjectionMatrix(); }
    if (this.flight) {
      const flight = this.flight; flight.time = Math.min(1,flight.time+dt/0.85); const t = flight.time*flight.time*(3-2*flight.time);
      this.camera.position.lerpVectors(flight.from,flight.to,t);
      if (flight.time === 1) { this.flight = undefined; const angles = new THREE.Euler().setFromQuaternion(this.camera.quaternion,"YXZ"); this.yaw = angles.y; this.pitch = angles.x; }
      if (this.mode === "orbit") this.camera.lookAt(flight.pivot);
      return;
    }
    if (this.mode === "orbit") { this.orbit.update(); return; }
    const key = (...names: string[]) => names.some(name => this.keys.has(name)) ? 1 : 0;
    const side = key("d","arrowright")-key("a","arrowleft")+this.mobile.x;
    const forward = key("w","arrowup")-key("s","arrowdown")+this.mobile.y;
    const norm = Math.max(1,Math.hypot(side,forward)); const speed = this.speed*dt*(this.keys.has("shift") ? 4 : 1);
    if (side || forward || key("q","e")) this.move(side/norm*speed,forward/norm*speed,(key("e")-key("q"))*speed);
    this.look();
  }
  state(): Record<string, unknown> { return { mode:this.mode, speed:this.speed, eyeHeight:this.eye, near:this.camera.near, far:this.camera.far, position:this.camera.position.toArray(), direction:this.camera.getWorldDirection(new THREE.Vector3()).toArray() }; }
}

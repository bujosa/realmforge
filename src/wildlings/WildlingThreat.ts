import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { threatCameraPath, threatSteps } from "./choreography";
import { particleFragment, particleVertex, skyFragment, skyVertex, waveFragment } from "./shaders";
import type { CameraKeyframe, ThreatBeat, ThreatBudget, ThreatOptions, ThreatState, ThreatStep } from "./types";

const random = (i: number): number => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (t: number): number => t * t * (3 - 2 * t);
const normalize = (n: number): number => Number.isFinite(n) ? Math.round(THREE.MathUtils.clamp(n, 0, 12) / 2) * 2 : 0;

/** Public-information-only presentation. No camera, audio, timers, lights, DOM, or game state. */
export class WildlingThreat {
  readonly object = new THREE.Group();
  readonly quality;
  private disposed = false;
  private reduced = false;
  private target = 0;
  private visual = 0;
  private from = 0;
  private transition = 1.6;
  private time = 0;
  private beat: ThreatBeat | null = null;
  private steps: ThreatStep[] = [];
  private stepIndex = 0;
  private stepTime = 0;
  private beatTime = 0;
  private caption = "";
  private path: readonly CameraKeyframe[] = [];
  private pendingReset = false;
  private readonly uniforms = {
    strength: { value: 0 }, clock: { value: 0 }, attack: { value: 0 },
    flare: { value: 0 }, motion: { value: 1 }, span: { value: 1 },
    wave: { value: 0 }, reduced: { value: 0 },
  };
  private readonly rim: THREE.MeshBasicMaterial;
  readonly budget: Readonly<ThreatBudget>;

  constructor(private readonly options: ThreatOptions) {
    const r = options.region;
    const nums = [r.minX, r.maxX, r.northZ, r.wallZ, r.wallHeight];
    if (!nums.every(Number.isFinite) || r.maxX <= r.minX || r.wallZ <= r.northZ || r.wallHeight <= 0 || r.beacons.length > 16) throw new Error("Invalid threat region");
    if (r.beacons.some(p => ![p.x,p.z,p.y ?? 0].every(Number.isFinite))) throw new Error("Invalid beacon anchor");
    this.quality = options.quality ?? "high";
    this.reducedMotion = options.reducedMotion ?? false;
    this.object.name = "Public northern threat";
    const span = r.maxX - r.minX, depth = r.wallZ - r.northZ, x = (r.minX + r.maxX) / 2;
    const ground = this.ground(x, r.wallZ);
    this.uniforms.span.value = span;
    const material = (vertexShader: string, fragmentShader: string, transparent = false): THREE.ShaderMaterial => new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader, transparent, depthWrite: !transparent,
      side: THREE.DoubleSide, forceSinglePass: true, toneMapped: true,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 1.2, 32, 2), material(skyVertex, skyFragment));
    sky.position.set(x, ground + span * .6, r.northZ - depth * .13);
    sky.name = "Storm front and burning horizon"; sky.renderOrder = -1;
    this.object.add(sky);

    const anchors: number[] = [], data: number[] = [], extents: number[] = [];
    const add = (px: number, py: number, pz: number, kind: number, seed: number, onset: number, w: number, h: number): void => {
      anchors.push(px,py,pz); data.push(kind,seed,onset,0); extents.push(w,h);
    };
    const fires = this.quality === "high" ? 84 : 40, snow = this.quality === "high" ? 320 : 100;
    for (let i = 0; i < fires; i++) {
      const px = r.minX + span * (.03 + random(i * 3) * .94);
      const pz = r.northZ + depth * (.04 + random(i * 3 + 1) * .81);
      const g = this.ground(px,pz), size = span * (.018 + random(i * 3 + 2) * .025);
      const onset = i < 2 ? -.9 : 2.5 + (i - 2) / (fires - 3) * 9.2;
      add(px,g + size * .65,pz,0,random(i),onset,size,size*2.2);
      add(px + size*.18,g + size*3.6,pz,1,random(i),onset,size*3.2,size*8.5);
    }
    for (let i = 0; i < snow; i++) {
      const px = r.minX + random(i * 7 + 2) * span;
      const pz = r.northZ + random(i * 7 + 4) * depth * 1.2;
      add(px,this.ground(px,pz) + span * (.08 + random(i * 7 + 3) * .4),pz,2,random(i * 7),8,span*.007,span*.015);
    }
    for (const [i,p] of r.beacons.entries()) add(p.x,p.y ?? this.ground(p.x,p.z)+r.wallHeight,p.z,3,i,8,span*.095,span*.095);
    const plane = new THREE.PlaneGeometry(1,1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(plane.index!.clone());
    geometry.setAttribute("position",plane.getAttribute("position").clone());
    geometry.setAttribute("uv",plane.getAttribute("uv").clone()); plane.dispose();
    geometry.setAttribute("anchor",new THREE.InstancedBufferAttribute(new Float32Array(anchors),3));
    geometry.setAttribute("data",new THREE.InstancedBufferAttribute(new Float32Array(data),4));
    geometry.setAttribute("extent",new THREE.InstancedBufferAttribute(new Float32Array(extents),2));
    geometry.instanceCount = anchors.length/3;
    const particles = new THREE.Mesh(geometry,material(particleVertex,particleFragment,true));
    particles.name = "Instanced fires, smoke, snow and beacons"; particles.renderOrder = 2;
    this.object.add(particles);
    const parts: THREE.BufferGeometry[] = [];
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const px = r.minX + span * (i + .5) / segments;
      parts.push(new THREE.BoxGeometry(span/segments+.002,span*.003,span*.012).translate(px,this.ground(px,r.wallZ)+r.wallHeight+.025,r.wallZ));
    }
    const rimGeometry = mergeGeometries(parts)!; parts.forEach(p=>p.dispose());
    this.rim = new THREE.MeshBasicMaterial({color: "#9bd9f1",transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false});
    const rim = new THREE.Mesh(rimGeometry,this.rim); rim.name = "Wall rim glow"; this.object.add(rim);
    const waveGeometry = new THREE.PlaneGeometry(span,depth*1.2,1,16).rotateX(-Math.PI/2);
    const wavePositions = waveGeometry.getAttribute("position");
    for (let i=0;i<wavePositions.count;i++) {
      const south = wavePositions.getZ(i)+depth*.38;
      // Crest the Wall, then descend toward southern ground instead of passing through the ice.
      wavePositions.setY(i,Math.max(.08,r.wallHeight*(1-south/(depth*.98))));
    }
    const wave = new THREE.Mesh(waveGeometry,material(skyVertex,waveFragment,true));
    wave.position.set(x,ground,r.wallZ+depth*.38);
    wave.name="Public outcome cold wave"; wave.renderOrder=3; this.object.add(wave);
    this.object.traverse(child=>{child.frustumCulled=false;});
    this.object.userData.visualBounds = new THREE.Box3(new THREE.Vector3(r.minX,ground,r.northZ),new THREE.Vector3(r.maxX,ground+span*.6,r.wallZ));
    this.budget = Object.freeze({draws:4,triangles:32*2*2+geometry.instanceCount*2+segments*12+waveGeometry.index!.count/3,particles:geometry.instanceCount,quality:this.quality});
  }
  private ground(x: number,z: number): number {
    const value=this.options.groundHeight(x,z);
    if (!Number.isFinite(value)) throw new Error("groundHeight must return a finite height");
    return value;
  }
  get reducedMotion(): boolean { return this.reduced; }
  set reducedMotion(value: boolean) {
    this.reduced = value; this.uniforms.motion.value = value ? 0 : 1; this.uniforms.reduced.value = value ? 1 : 0;
    if (value && this.path.length) { this.path=[]; this.options.onCameraPath?.([]); }
  }
  get state(): ThreatState {
    return {strength:this.target,visualStrength:this.visual,imminent:this.target===12,beat:this.beat,step:this.steps[this.stepIndex]?.id??null,stepTime:this.stepTime,beatTime:this.beatTime,caption:this.caption,cameraPath:this.path};
  }
  /** Initial snapshots may snap. Subsequent transitions use a 1.6 second crossfade, including interruptions. */
  setStrength(value: number, {animate=true}: {animate?:boolean} = {}): void {
    if (this.disposed) return;
    const n=normalize(value);
    if(n===this.target && animate) return;
    this.from=this.visual; this.target=n; this.transition=animate?0:1.6;
    if(!animate) this.visual=n;
    this.uniforms.strength.value=this.visual;
  }
  play(beat: ThreatBeat): void {
    if(this.disposed) return;
    this.beat=beat; this.steps=threatSteps(beat,this.target); this.stepIndex=0; this.stepTime=0; this.beatTime=0;
    this.uniforms.attack.value=0; this.uniforms.flare.value=0; this.uniforms.wave.value=0;
    this.path=this.reduced?[]:threatCameraPath(beat,this.options.region,this.ground((this.options.region.minX+this.options.region.maxX)/2,this.options.region.wallZ));
    this.options.onCameraPath?.(this.path);
    // This is a presentation reset after an explicit public Watch victory. The host reconciles its next snapshot.
    this.pendingReset=beat==="nights-watch-victory";
    if(this.pendingReset) this.setStrength(0);
    this.enter();
  }
  private enter(): void {
    const step=this.steps[this.stepIndex];
    if(!step){this.finish();return;}
    this.caption=step.caption; this.options.onCaption?.(this.caption); this.options.onStep?.(step);
    if(step.cue) this.options.onCue?.(step.cue);
    if(step.reveal) this.options.onReveal?.(step.reveal);
    if(step.id==="breach") this.options.onHighlightRegions?.();
  }
  /** Skip one choreography step. `all` cancels remaining hooks/cues and settles the outcome. */
  skip(scope: "step"|"all" = "step"): void {
    if(this.disposed||!this.beat) return;
    if(scope==="all"){this.finish();return;}
    this.beatTime+=Math.max(0,(this.steps[this.stepIndex]?.duration??0)-this.stepTime);
    this.stepTime=0;this.stepIndex++;this.enter();
  }
  private finish(): void {
    if(this.pendingReset) this.setStrength(0,{animate:false});
    this.pendingReset=false;this.beat=null;this.steps=[];this.stepIndex=0;this.stepTime=0;this.path=[];
    this.caption="";this.uniforms.attack.value=0;this.uniforms.flare.value=0;this.uniforms.wave.value=0;
    this.options.onCaption?.("");this.options.onStep?.(null);this.options.onCameraPath?.([]);
    this.options.onCue?.("settle");
  }
  update(dt: number): void {
    if(this.disposed||!Number.isFinite(dt)||dt<0) return;
    if(!this.reduced) this.time+=dt;
    this.uniforms.clock.value=this.time;
    this.transition=Math.min(1.6,this.transition+dt);
    this.visual=THREE.MathUtils.lerp(this.from,this.target,smooth(this.transition/1.6));
    this.uniforms.strength.value=this.visual;
    this.rim.opacity=THREE.MathUtils.smoothstep(this.visual,6.5,10)*.5;
    if(!this.beat) return;
    this.beatTime+=dt;this.stepTime+=dt;
    if(this.beat==="attack") this.uniforms.attack.value=smooth(Math.min(1,this.beatTime/1.2));
    if(this.beat==="nights-watch-victory") {this.uniforms.flare.value=Math.sin(Math.min(1,this.beatTime/3)*Math.PI);this.rim.opacity=Math.max(this.rim.opacity,this.uniforms.flare.value*.85);}
    if(this.beat==="wildling-victory") this.uniforms.wave.value=Math.min(1,this.beatTime/3);
    while(this.beat && this.stepTime >= this.steps[this.stepIndex].duration) {
      this.stepTime-=this.steps[this.stepIndex].duration;this.stepIndex++;this.enter();
    }
  }
  /** Compile and draw every fixed material, including dormant outcome effects, without moving the live group. */
  warmup(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    if(this.disposed) return;
    const scene=new THREE.Scene();scene.add(this.object.clone(true));
    const target=new THREE.WebGLRenderTarget(8,8), previous=renderer.getRenderTarget();
    const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
    try {renderer.compile(scene,camera);renderer.setRenderTarget(target);renderer.render(scene,camera);}
    finally {renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);target.dispose();scene.clear();}
  }
  dispose(): void {
    if(this.disposed) return;
    this.disposed=true;this.object.removeFromParent();
    this.options.onCameraPath?.([]);this.options.onCaption?.("");this.options.onStep?.(null);
    this.object.traverse(child=>{const mesh=child as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());});
    this.object.clear();this.steps=[];this.path=[];this.beat=null;this.caption="";this.stepTime=0;this.beatTime=0;this.pendingReset=false;
  }
}

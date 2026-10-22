import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { threatCameraPath, threatSteps } from "./choreography";
import { particleFragment, particleVertex, skyFragment, skyVertex, waveFragment, groundFragment } from "./shaders";
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
    flare: { value: 0 }, motion: { value: 1 }, span: { value: 1 }, depth: { value: 1 },
    wave: { value: 0 }, reduced: { value: 0 }, watch: { value: 0 }, retreat: { value: 0 },
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
    this.uniforms.span.value = span;this.uniforms.depth.value=depth;
    const material = (vertexShader: string, fragmentShader: string, transparent = false): THREE.ShaderMaterial => new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader, transparent, depthWrite: !transparent,
      side: THREE.DoubleSide, forceSinglePass: true, toneMapped: true,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 1.2, 32, 2), material(skyVertex, skyFragment));
    sky.position.set(x, ground + span * .6, r.northZ - depth * .13);
    sky.name = "Storm front and burning horizon"; sky.renderOrder = -1;
    this.object.add(sky);

    const layers = [0, 1].map(() => ({ anchors: [] as number[], data: [] as number[], extents: [] as number[] }));
    const add = (px: number, py: number, pz: number, kind: number, seed: number, onset: number, w: number, h: number, beacon = 0): void => {
      const layer = layers[kind === 1 || kind === 2 || kind === 7 ? 0 : 1];
      layer.anchors.push(px,py,pz); layer.data.push(kind,seed,onset,beacon); layer.extents.push(w,h);
    };
    const fires = this.quality === "high" ? 112 : 56, snow = this.quality === "high" ? 220 : 80;
    for (let i = 0; i < fires; i++) {
      // Authored camp clusters and branching fire lines, never an enemy count.
      const cluster = i % 11, row = Math.floor(i / 11);
      const cx = r.minX + span * (.08 + cluster / 10 * .84);
      const cz = r.northZ + depth * (.18 + random(cluster + 91) * .47);
      const px = cx + (random(i * 3) - .5) * span * .10;
      const pz = Math.min(r.wallZ - depth * .12, cz + row * depth * .022 + (random(i * 3 + 1) - .5) * depth * .07);
      const g = this.ground(px,pz), size = span * (.012 + random(i * 3 + 2) * .019);
      const onset = i < 2 ? -.9 : 2.5 + (i - 2) / (fires - 3) * 8.6;
      const seed = random(i + 7);
      add(px,g + size * .7,pz,0,seed,onset,size,size*2.7);
      add(px,g + size * .25,pz,5,seed,onset,size*3.8,size*3.8);
      add(px,g + .045,pz,4,seed,onset,size*5,size*4.5);
      for (let puff=0;puff<(this.quality === "high" ? 4 : 3);puff++) {
        const rise=size*(1.7+puff*1.8);
        add(px+rise*.28,g+rise,pz,1,seed+puff*.21,onset,size*(2.4+puff*.8),size*(2.8+puff*.6));
      }
      for(let ember=0;ember<(this.quality === "high" ? 5 : 2);ember++)
        add(px,g+size,pz,6,seed+ember*.17,onset,size*.13,size*.28);
    }
    for (let i = 0; i < snow; i++) {
      const px = r.minX + random(i * 7 + 2) * span;
      const pz = r.northZ + random(i * 7 + 4) * depth * 1.2;
      add(px,this.ground(px,pz) + span * (.08 + random(i * 7 + 3) * .4),pz,2,random(i * 7),8,span*.005,span*.014);
    }
    for (const [i,p] of r.beacons.entries()) {
      const y=p.y ?? this.ground(p.x,p.z)+r.wallHeight+.15;
      add(p.x,y+span*.044,p.z,3,i*.31,8,span*.065,span*.15);
      add(p.x,y+span*.04,p.z,5,i*.31,7.2,span*.20,span*.23,1);
      for(let j=0;j<8;j++) add(p.x,y,p.z,6,random(j+i*19),7.2,span*.003,span*.007);
    }
    // Temporary torch ribbons exist exclusively during the public attack vignette.
    for(let i=0;i<(this.quality === "high" ? 64 : 32);i++) {
      const px=r.minX+span*(.07+random(i+501)*.86),pz=r.wallZ-depth*(.18+random(i+701)*.16);
      add(px,this.ground(px,pz)+span*.026,pz,8,random(i+801),0,span*.009,span*.033);
    }
    // A moving vertical blizzard curtain complements the frost on the southern ground.
    for(let i=0;i<22;i++) add(r.minX+span*(i+.5)/22,ground+r.wallHeight*.5,r.wallZ,7,random(i+901),0,span*.10,r.wallHeight*1.3);
    let particleCount=0;
    for(const [index,layer] of layers.entries()) {
      const plane = new THREE.PlaneGeometry(1,1);
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setIndex(plane.index!.clone());
      geometry.setAttribute("position",plane.getAttribute("position").clone());
      geometry.setAttribute("uv",plane.getAttribute("uv").clone()); plane.dispose();
      geometry.setAttribute("anchor",new THREE.InstancedBufferAttribute(new Float32Array(layer.anchors),3));
      geometry.setAttribute("data",new THREE.InstancedBufferAttribute(new Float32Array(layer.data),4));
      geometry.setAttribute("extent",new THREE.InstancedBufferAttribute(new Float32Array(layer.extents),2));
      geometry.instanceCount = layer.anchors.length/3;particleCount+=geometry.instanceCount;
      const mat=material(particleVertex,particleFragment,true);
      if(index===1) mat.blending=THREE.AdditiveBlending;
      const particles = new THREE.Mesh(geometry,mat);
      particles.name = index===0 ? "Wind-driven billowing smoke, snow and blizzard" : "Layered flames, emissive halos, ground pools, sparks and attack torchlines";
      particles.renderOrder=index===0?2:3;
      this.object.add(particles);
    }
    const gradeGeometry=new THREE.PlaneGeometry(span,depth,40,40).rotateX(-Math.PI/2).translate(x,0,(r.northZ+r.wallZ)/2);
    const gp=gradeGeometry.getAttribute("position");
    for(let i=0;i<gp.count;i++)gp.setY(i,this.ground(gp.getX(i),gp.getZ(i))+.025);
    const grade=new THREE.Mesh(gradeGeometry,material(skyVertex,groundFragment,true));
    grade.name="Northern dusk on the snow";grade.renderOrder=1;this.object.add(grade);
    const parts: THREE.BufferGeometry[] = [];
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const px = r.minX + span * (i + .5) / segments;
      parts.push(new THREE.BoxGeometry(span/segments+.002,span*.003,span*.025).translate(px,this.ground(px,r.wallZ)+r.wallHeight+.025,r.wallZ));
    }
    const rimGeometry = mergeGeometries(parts)!; parts.forEach(p=>p.dispose());
    this.rim = new THREE.MeshBasicMaterial({color: "#ffbc72",transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false});
    this.rim.onBeforeCompile=shader=>{
      shader.vertexShader="varying float rimX;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nrimX=position.x;");
      const pools=r.beacons.map(p=>`exp(-pow((rimX-(${p.x.toFixed(6)}))/${(span*.065).toFixed(6)},2.))`).join("+")||"0.";
      shader.fragmentShader="varying float rimX;\n"+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>\ndiffuseColor.a*=clamp(.08+${pools},0.,1.);`);
    };
    this.rim.customProgramCacheKey=()=>"wildling-local-beacon-rim-v2"+JSON.stringify([span,r.beacons]);
    const rim = new THREE.Mesh(rimGeometry,this.rim); rim.name = "Wall rim glow"; this.object.add(rim);
    const waveGeometry = new THREE.PlaneGeometry(span,depth*.9,32,32).rotateX(-Math.PI/2);
    const wavePositions = waveGeometry.getAttribute("position");
    for (let i=0;i<wavePositions.count;i++) {
      const south = wavePositions.getZ(i)+depth*.45;
      // Crest the Wall, then descend toward southern ground instead of passing through the ice.
      wavePositions.setY(i,this.ground(x+wavePositions.getX(i),r.wallZ+south)-ground+.06+r.wallHeight*Math.exp(-Math.max(0,south)*1.5));
    }
    const wave = new THREE.Mesh(waveGeometry,material(skyVertex,waveFragment,true));
    wave.position.set(x,ground,r.wallZ+depth*.45);
    wave.name="Public outcome cold wave"; wave.renderOrder=3; this.object.add(wave);
    this.object.traverse(child=>{child.frustumCulled=false;});
    this.object.userData.visualBounds = new THREE.Box3(new THREE.Vector3(r.minX,ground,r.northZ),new THREE.Vector3(r.maxX,ground+span*.6,r.wallZ));
    this.budget = Object.freeze({draws:6,triangles:32*2*2+particleCount*2+40*40*2+segments*12+waveGeometry.index!.count/3,particles:particleCount,quality:this.quality});
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
    this.uniforms.attack.value=0; this.uniforms.flare.value=0; this.uniforms.wave.value=0;this.uniforms.watch.value=0;this.uniforms.retreat.value=0;
    this.path=this.reduced?[]:threatCameraPath(beat,this.options.region,this.ground((this.options.region.minX+this.options.region.maxX)/2,this.options.region.wallZ));
    this.options.onCameraPath?.(this.path);
    // This is a presentation reset after an explicit public Watch victory. The host reconciles its next snapshot.
    this.pendingReset=beat==="nights-watch-victory";
    this.uniforms.watch.value=this.pendingReset?1:0;
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
    this.caption="";this.uniforms.attack.value=0;this.uniforms.flare.value=0;this.uniforms.wave.value=0;this.uniforms.watch.value=0;this.uniforms.retreat.value=0;
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
    this.rim.opacity=THREE.MathUtils.smoothstep(this.visual,6.5,10)*.75;
    if(!this.beat) return;
    this.beatTime+=dt;this.stepTime+=dt;
    if(this.beat==="attack") this.uniforms.attack.value=smooth(Math.min(1,this.beatTime/1.2));
    if(this.beat==="nights-watch-victory") {this.uniforms.retreat.value=Math.min(1,this.beatTime/3);this.uniforms.flare.value=Math.sin(Math.min(1,this.beatTime/3)*Math.PI);this.rim.opacity=Math.max(this.rim.opacity,this.uniforms.flare.value*.85);}
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

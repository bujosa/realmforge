import * as THREE from "three";
import { registerStories, type StoryContext, type StoryInstance } from "../../registry";
import { WildlingThreat, type ThreatBeat, type ThreatQuality, type ThreatCue } from "../../../src/wildlings";
import { northPatch, region, groundHeight } from "./patch";
import { currentCamps } from "./current";

const styleText=`
.rf-wild #story-overlay{inset:18px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none}
.rf-wild #story-overlay>*{pointer-events:auto}.rf-wild #stats,.rf-wild .stage-hint{display:none}
.wild-heading{align-self:flex-start;max-width:100%;color:#edf2ee;text-shadow:0 2px 12px #000}
.wild-heading small{font:9px system-ui;letter-spacing:.24em;color:#bad6e0}.wild-heading h2{font:26px/1.15 Georgia;margin:7px 0}
.wild-heading p{font:11px system-ui;margin:6px 0;color:#d7e0e2}.wild-heading [data-caption]{min-height:20px;color:#f2c891;font:15px Georgia}
.wild-controls{align-self:flex-start;max-width:100%;padding:12px;background:#12212be8;border:1px solid #7296a24d;border-radius:7px;backdrop-filter:blur(9px);color:#e4ecee}
.wild-track{display:flex;gap:10px;align-items:center;font:11px system-ui}.wild-track input{width:170px;max-width:48vw;accent-color:#eea45d}
.wild-controls .wild-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.wild-controls button{font:10px system-ui;padding:7px 9px;background:#273c47;border-color:#58717e;color:#f5e6c9}
.wild-controls [data-log]{display:block;font:9px system-ui;color:#bbced5;margin-top:8px;min-height:12px}
.rf-wild #story-hud{bottom:170px;right:18px;max-width:none;font:9px/1.6 ui-monospace,monospace;color:#bcd0d9;white-space:pre-line;text-align:right;text-shadow:0 1px 5px #000}
@media(max-width:760px){.rf-wild #story-overlay{inset:12px}.wild-heading h2{font-size:22px}.wild-heading p{font-size:10px}.wild-heading [data-caption]{font-size:14px;max-width:300px}.wild-controls{padding:9px;width:100%}.wild-track input{width:160px}.wild-controls button{padding:7px 8px;font-size:10px}.rf-wild #story-hud{bottom:168px;font-size:8px;right:12px}}
`;
function button(parent:HTMLElement,title:string,run:()=>void):void{const b=document.createElement("button");b.textContent=title;b.addEventListener("click",run);parent.append(b);}
function build(ctx:StoryContext,mode:"track"|"threshold"|"attack"|"current"):StoryInstance{
  const object=northPatch();
  const style=document.createElement("style");style.textContent=styleText;document.head.append(style);document.body.classList.add("rf-wild");
  const heading=document.createElement("div");heading.className="wild-heading";
  heading.innerHTML=`<small>BEYOND THE WALL</small><h2></h2><p></p><div data-caption role="status" aria-live="polite"></div>`;
  const panel=document.createElement("div");panel.className="wild-controls";
  panel.innerHTML=`<label class="wild-track">Threat <input type="range" aria-label="Public threat strength" min="0" max="12" step="2"><output></output></label><div class="wild-actions"></div><span data-log aria-live="polite">Public strength points · illustrative fires</span>`;
  ctx.overlay.append(heading,panel);
  const slider=panel.querySelector("input")!,out=panel.querySelector("output")!,actions=panel.querySelector<HTMLElement>(".wild-actions")!,log=panel.querySelector<HTMLElement>("[data-log]")!;
  let disposed=false,ready=false,first=true,frameCount=0,warmPrograms=0,paused=false;
  const events:{type:string;value:string;time:number}[]=[];
  const quality=String(ctx.values.quality??"high") as ThreatQuality;
  const caption=heading.querySelector<HTMLElement>("[data-caption]")!;
  const record=(type:string,value:string):void=>{events.push({type,value,time:performance.now()});log.textContent=`${type}: ${value}`;};
  const onCue=(cue:ThreatCue):void=>record("Cue",cue);
  const threat=new WildlingThreat({region,groundHeight,quality,reducedMotion:Boolean(ctx.values.reducedMotion)||matchMedia("(prefers-reduced-motion: reduce)").matches,
    onCue,onCaption:text=>{caption.textContent=text;},onReveal:kind=>record("Public reveal slot",kind),onHighlightRegions:()=>record("Public outcome","Highlight affected house regions"),
  });
  const initial=Number(ctx.values.strength??(mode==="threshold"?6:mode==="track"?0:12));
  threat.setStrength(initial,{animate:false});
  if(mode!=="current")object.add(threat.object);
  let current=mode==="current"?currentCamps(initial):null;if(current)object.add(current.object);
  let view=String(ctx.values.camera??"World");
  const originalBeforeRender=ctx.scene.onBeforeRender,oldBackground=ctx.scene.background,oldFog=ctx.scene.fog;
  const ground=ctx.scene.children.find(c=>c instanceof THREE.Mesh&&c.geometry.type==="PlaneGeometry");
  const groundWasVisible=ground?.visible??true;
  const grid=ctx.scene.children.find(c=>c instanceof THREE.GridHelper),gridWasVisible=grid?.visible??true;
  const lights=ctx.scene.children.filter((c):c is THREE.Light=>c instanceof THREE.Light).map(light=>({light,intensity:light.intensity,color:light.color.clone()}));
  const nightLight=new THREE.Color("#6587b2");
  const target=new THREE.Vector3();
  const cameraView=():void=>{
    if(view==="Free orbit")return;
    const aspect=ctx.camera.aspect;
    ctx.camera.fov=38;ctx.camera.near=.02;ctx.camera.far=300;
    if(view==="Wall"){
      ctx.camera.position.set(2.5,7.1,9.8);target.set(0,4,-12);
      if(aspect<.9){ctx.camera.position.set(1.5,8.4,16);target.set(0,4,-9);}
    }else{
      // Same 38-degree lens as the game's World renderer; fit this synthetic northern patch.
      const distance=aspect<.9?62:43;
      ctx.camera.position.set(distance*.12,distance*.58,distance*.72-8);target.set(0,1,-10);
    }
    const state=threat.state,path=state.cameraPath;
    if(path.length&&state.beat){
      const t=state.beatTime;
      let i=0;while(i<path.length-2&&t>path[i+1].time)i++;
      const a=path[i],b=path[Math.min(path.length-1,i+1)],u=THREE.MathUtils.clamp((t-a.time)/Math.max(.001,b.time-a.time),0,1),s=u*u*(3-2*u);
      const pos=new THREE.Vector3().fromArray(a.position).lerp(new THREE.Vector3().fromArray(b.position),s);
      // Phone keeps the entire Wall readable while preserving the authored direction.
      if(aspect<.9){pos.x*=.5;pos.y+=4;pos.z+=10;}
      ctx.camera.position.copy(pos);target.fromArray(a.target).lerp(new THREE.Vector3().fromArray(b.target),s);
    }
    ctx.camera.lookAt(target);ctx.camera.updateProjectionMatrix();ctx.camera.updateMatrixWorld(true);
  };
  ctx.scene.onBeforeRender=(...args)=>{originalBeforeRender.apply(ctx.scene,args);cameraView();};
  let lastTarget=-1;
  function sync():void{
    const state=threat.state;
    if(state.strength===lastTarget)return;
    lastTarget=state.strength;
    ctx.values.strength=state.strength;
    const initialControl=document.querySelector<HTMLInputElement>('[aria-label="Initial strength"]');
    if(initialControl)initialControl.value=String(state.strength);
    heading.querySelector("h2")!.textContent=`${state.strength} / 12 · ${state.imminent?"Imminent":state.strength>=8?"The North darkens":state.strength>=4?"Fires in the forest":"A quiet North"}`;
    heading.querySelector("p")!.textContent=mode==="current"?"Current game reference · 0–8 lit hearths":"Public threat · embers, fire, smoke and storm";
    slider.value=String(state.strength);out.textContent=String(state.strength);
  }
  const play=(beat:ThreatBeat):void=>{threat.play(beat);sync();};
  const setStrength=(n:number,animate=true):void=>{
    threat.setStrength(n,{animate});
    if(current){object.remove(current.object);current.dispose();disposeGeometry(current.object);current=currentCamps(n);object.add(current.object);}
    sync();
  };
  slider.value=String(initial);slider.addEventListener("input",()=>{const before=threat.state.strength;setStrength(Number(slider.value));if(mode==="threshold"&&before!==threat.state.strength)play("threshold");});
  if(mode!=="current"){
  button(actions,"Threshold",()=>play("threshold"));button(actions,"Attack",()=>play("attack"));
  button(actions,"Watch holds",()=>play("nights-watch-victory"));button(actions,"Wildlings prevail",()=>play("wildling-victory"));
  button(actions,"Skip step",()=>threat.skip());button(actions,"Skip all",()=>threat.skip("all"));
  }
  sync();
  const samples:number[]=[],cpu:number[]=[];let previous=performance.now();
  const beforeBackground=new THREE.Color("#142530"),afterBackground=new THREE.Color("#060e19"),activeBackground=new THREE.Color();
  const metric=():Record<string,unknown>=>{
    const frames=[...samples].sort((a,b)=>a-b),updates=[...cpu].sort((a,b)=>a-b),gl=ctx.renderer.getContext(),debug=gl.getExtension("WEBGL_debug_renderer_info");
    const host=(window as unknown as {__realmforge?:{metrics:()=>{frameP50:number;frameP95:number;samples:number}}}).__realmforge?.metrics();
    return {...threat.budget,programs:ctx.renderer.info.programs?.length??0,warmPrograms,latePrograms:Math.max(0,(ctx.renderer.info.programs?.length??0)-warmPrograms),samples:frames.length,
      frameP50:host?.frameP50??0,frameP95:host?.frameP95??0,callbackP50:frames[Math.floor(frames.length*.5)]??0,callbackP95:frames[Math.floor(frames.length*.95)]??0,updateP95:updates[Math.floor(updates.length*.95)]??0,
      sceneDraws:ctx.renderer.info.render.calls,sceneTriangles:ctx.renderer.info.render.triangles,webglError:gl.getError(),hardware:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):"unavailable"};
  };
  const qa={setView:(value:string)=>{view=value;ctx.values.camera=value;const input=document.querySelector<HTMLSelectElement>('[aria-label="Camera view"]');if(input)input.value=value;},threat,camera:ctx.camera,renderer:ctx.renderer,scene:ctx.scene,events,setStrength,play:(beat:ThreatBeat)=>{paused=false;play(beat);},pause:(value:boolean)=>{paused=value;},
    step:(dt:number)=>{threat.update(dt);sync();},get ready(){return ready;},resetMetrics:()=>{samples.length=0;cpu.length=0;previous=performance.now();(window as unknown as {__realmforge?:{resetMetrics:()=>void}}).__realmforge?.resetMetrics();},metrics:metric,
    measurePresenter:()=>{
      const scene=new THREE.Scene();scene.add(threat.object.clone(true));const prev=ctx.renderer.getRenderTarget(),target=new THREE.WebGLRenderTarget(8,8);
      try{ctx.renderer.setRenderTarget(target);ctx.renderer.render(scene,ctx.camera);return {draws:ctx.renderer.info.render.calls,triangles:ctx.renderer.info.render.triangles,programs:ctx.renderer.info.programs?.length??0};}
      finally{ctx.renderer.setRenderTarget(prev);target.dispose();scene.clear();}
    },
  };
  (window as unknown as {__wildlingQA:unknown}).__wildlingQA=qa;
  return {object,ready:()=>true,update(dt,time){
    if(disposed)return;
    if(ground)ground.visible=false;if(grid)grid.visible=false;ctx.scene.fog=null;
    const start=performance.now(),interval=start-previous;previous=start;
    if(first){first=false;threat.warmup(ctx.renderer,ctx.camera);ctx.renderer.compile(ctx.scene,ctx.camera);}
    if(!paused)threat.update(dt);
    current?.update(threat.reducedMotion?0:time,ctx.camera);
    // Gallery adapter grades existing illumination; the presenter never creates lights.
    const dusk=THREE.MathUtils.smoothstep(threat.state.visualStrength,3,12);
    object.userData.setMood(threat.state.visualStrength);
    for(const {light,intensity,color} of lights){
      light.intensity=intensity*THREE.MathUtils.lerp(.48,.09,dusk);
      light.color.copy(color).lerp(nightLight,.35+dusk*.5);
    }
    ctx.scene.background=activeBackground.copy(beforeBackground).lerp(afterBackground,threat.state.visualStrength/12);
    if(frameCount++===3){ready=true;warmPrograms=ctx.renderer.info.programs?.length??0;}
    if(ready){samples.push(interval);cpu.push(performance.now()-start);if(samples.length>1200){samples.shift();cpu.shift();}}
    const hudText=mode==="current"?"CURRENT · PRODUCTION d594e1c1":`${quality.toUpperCase()} · ${threat.budget.draws} effect draws\n${threat.reducedMotion?"REDUCED MOTION":"PUBLIC INFORMATION ONLY"}`;
    if(ctx.hud.textContent!==hudText)ctx.hud.textContent=hudText;
    sync();
  },dispose(){disposed=true;ctx.scene.onBeforeRender=originalBeforeRender;ctx.scene.background=oldBackground;ctx.scene.fog=oldFog;
    for(const {light,intensity,color} of lights){light.intensity=intensity;light.color.copy(color);}
    if(ground)ground.visible=groundWasVisible;if(grid)grid.visible=gridWasVisible;current?.dispose();threat.dispose();style.remove();document.body.classList.remove("rf-wild");delete(window as unknown as {__wildlingQA?:unknown}).__wildlingQA;
  }};
}
function disposeGeometry(group:THREE.Group):void{
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  group.traverse(c=>{if(c instanceof THREE.Mesh){geometry.add(c.geometry);(Array.isArray(c.material)?c.material:[c.material]).forEach(m=>materials.add(m));if(c instanceof THREE.InstancedMesh)c.dispose();}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
for(const [mode,title,description] of [
  ["track","Threat track · the burning North","Scrub the public track in steps of two. Smooth transitions, a fixed 38° World lens, and a close Wall view."],
  ["threshold","Threshold · a warning from the Wall","Raise the strength or play the 2.5 second warning. Reduced motion keeps the caption and crossfade."],
  ["attack","Attack · three horns, two outcomes","Play the attack, then an already-public outcome. Reveal slots are hooks; no cards, bids or secret information are generated."],
  ["current","Current game · illustrative camps","Frozen d594e1c1 geometry and turf shelters on the same North patch. Synthetic placement replaces the production terrain sampler."],
] as const)registerStories({id:`wildlings/${mode}`,title,category:"Wildlings",description,controls:{
  strength:{type:"number",label:"Initial strength",default:mode==="track"?0:mode==="threshold"?6:12,min:0,max:12,step:2},
  quality:{type:"select",label:"Quality",default:"high",options:["high","balanced"]},
  reducedMotion:{type:"boolean",label:"Reduced motion",default:false},
  camera:{type:"select",label:"Camera view",default:"World",options:["World","Wall","Free orbit"]},
},build:ctx=>build(ctx,mode)});

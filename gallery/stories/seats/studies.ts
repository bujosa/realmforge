import * as THREE from "three";
import { registerStories, releaseObject, type StoryContext, type StoryInstance } from "../../registry";
import { createSeatStudy, seatCamera, seatNotes, type SeatKind, type SeatPose, type SeatVariant } from "../../../src/seats";
import { seatObject } from "../../story-kit";
import { namedSeats } from "../../../src/presets/demo";
import { castleStyle } from "../../../src/castles/castleStyles";
import { directions } from "../../../src/lookdev/directions";

function study(ctx:StoryContext,kind:SeatKind):StoryInstance {
  const {scene,camera,renderer,values,overlay,hud}=ctx,notes=seatNotes[kind];
  const variant=String(values.variant)[0] as SeatVariant,seat=createSeatStudy(kind,variant);
  if(values.reference){
    // Existing demo data selects the extracted production recipe; no game names enter the study API.
    const recipe=namedSeats[{capital:1,island:2,north:0}[kind]];
    const reference=seatObject(recipe,castleStyle(recipe),true);
    // Release the unmounted proposed content through the gallery's normal lifecycle helper.
    releaseObject(seat.object);seat.object.clear();
    reference.position.set(kind==="capital"?7:0,0,kind==="capital"?-1:0);seat.object.add(reference);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:kind==="north"?"#b5beb2":"#87956b",roughness:1}));ground.position.y=-.015;seat.object.add(ground);
  }
  let pose=String(values.pose) as SeatPose,orbitStart:number|undefined,ready=false,dead=false,released=false;
  const previous={background:scene.background,fog:scene.fog,exposure:renderer.toneMappingExposure,shadow:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,fov:camera.fov,near:camera.near,far:camera.far,onBeforeRender:scene.onBeforeRender};
  const lights=scene.children.filter(o=>o instanceof THREE.Light),visibility=lights.map(o=>o.visible);lights.forEach(o=>o.visible=false);
  const hidden=scene.children.filter(o=>o instanceof THREE.GridHelper||(o instanceof THREE.Mesh&&o.geometry instanceof THREE.PlaneGeometry)),hiddenVisibility=hidden.map(o=>o.visible);
  const d=directions.B,sun=new THREE.DirectionalLight(d.sun,kind==="north"?2.2:d.sunPower);sun.position.set(-22,35,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:100});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;
  seat.object.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  seat.object.add(sun,sun.target,new THREE.HemisphereLight(d.sky,"#555645",kind==="island"?(variant==="B"?2.5:1.9):1.15));
  const style=document.createElement("style");style.textContent=`.seat-panel{background:#142327e8;border:1px solid #d1c4a447;padding:16px 19px;max-width:400px;color:#e8e6d9}.seat-panel small{font:9px system-ui;letter-spacing:.18em;color:#bdaf8c}.seat-panel h2{font:26px/1.1 Georgia,serif;margin:9px 0}.seat-panel p{font:11px/1.5 system-ui;margin:6px 0;color:#becbc5}.seat-panel button{font:11px system-ui;padding:8px 12px;margin-top:8px;background:#304249}.seat-hud{font:10px/1.5 system-ui;white-space:pre-line;background:#142327dd;padding:10px 13px;color:#e6e5d6}#stage:has(.seat-panel) .stage-hint{display:none}@media(max-width:760px){.seat-panel{max-width:270px;padding:10px 12px}.seat-panel h2{font-size:20px}.seat-panel p{font-size:10px}#story-hud:has(.seat-hud){bottom:12px;max-width:80%}}`;
  const panel=document.createElement("div");panel.className="seat-panel";const kicker=document.createElement("small");kicker.textContent=values.reference?"EXTRACTED GAME RECIPE / MATCHED CAMERA":"REALMFORGE / SEAT STUDIES / LOOK B";const title=document.createElement("h2");title.textContent=notes.title;const p=document.createElement("p");p.textContent=notes.iconic;const button=document.createElement("button");button.textContent="Play 20 s orbit";button.onclick=()=>{released=false;pose="Regional";orbitStart=performance.now()/1000;};const free=document.createElement("button");free.textContent="Release camera";free.style.marginLeft="8px";free.onclick=()=>{
    orbitStart=undefined;released=true;
    const select=document.querySelector<HTMLSelectElement>('[aria-label="Navigation mode"]');
    if(select)for(const mode of ["orbit","fly"]){select.value=mode;select.dispatchEvent(new Event("change",{bubbles:true}));}
    free.textContent="Camera released · WASD";
  };panel.append(kicker,title,p,button,free);overlay.append(style,panel);
  const note=document.createElement("div");note.className="seat-hud";hud.append(note);
  const apply=()=>{if(released)return;seatCamera(camera,kind,pose,seat.focus,orbitStart===undefined?undefined:Math.min(20,performance.now()/1000-orbitStart));};
  scene.onBeforeRender=function(...args){previous.onBeforeRender.apply(this,args);apply();};
  const api={setPose:(value:SeatPose)=>{released=false;pose=value;orbitStart=undefined;},startOrbit:()=>{released=false;pose="Regional";orbitStart=performance.now()/1000;},stats:()=>({kind,variant,pose,ready,metresPerUnit:50,camera:camera.position.toArray(),textureBytes:0,shadowBytes:2048*2048*8})};
  Object.assign(window,{__seats:api});
  queueMicrotask(()=>{if(dead)return;const select=document.querySelector<HTMLSelectElement>('[aria-label="Navigation mode"]');if(select){select.value="fly";select.dispatchEvent(new Event("change",{bubbles:true}));}});
  let compileStarted=false;
  return {object:seat.object,navigation:{metresPerUnit:50},ready:()=>ready,update:()=>{
    hidden.forEach(o=>o.visible=false);scene.background=new THREE.Color(kind==="north"?"#a0b2b7":d.sky);scene.fog=new THREE.FogExp2(kind==="north"?"#bac7c8":d.horizon,.00168);renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;apply();
    if(!compileStarted){compileStarted=true;void renderer.compileAsync(scene,camera).then(()=>{if(!dead)ready=true;}).catch(console.error);}
    if(orbitStart!==undefined&&performance.now()/1000-orbitStart>=20)orbitStart=undefined;
    const s=renderer.info.render;note.textContent=`${notes.variants[variant==="A"?0:1]} · ${pose}\n${s.calls} draws · ${(s.triangles/1000).toFixed(0)}k triangles\n50 m/unit · 38° FOV · original procedural architecture`;
  },dispose:()=>{dead=true;scene.onBeforeRender=previous.onBeforeRender;lights.forEach((o,i)=>o.visible=visibility[i]);hidden.forEach((o,i)=>o.visible=hiddenVisibility[i]);scene.background=previous.background;scene.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.enabled=previous.shadow;renderer.shadowMap.type=previous.shadowType;sun.shadow.dispose();camera.fov=previous.fov;camera.near=previous.near;camera.far=previous.far;camera.updateProjectionMatrix();delete (window as unknown as {__seats?:unknown}).__seats;}};
}
for(const kind of ["capital","island","north"] as const)registerStories({id:`seats/${kind}`,title:seatNotes[kind].title,category:"Seat studies",description:seatNotes[kind].iconic,controls:{reference:{type:"boolean",label:"Extracted game reference",default:false},variant:{type:"select",label:"Seat variant",default:seatNotes[kind].variants[1],options:seatNotes[kind].variants},pose:{type:"select",label:"Camera preset",default:"Regional",options:["Overview","Regional","Close"]}},build:ctx=>study(ctx,kind)});

import * as THREE from "three";
import { registerStories, type StoryContext, type StoryInstance } from "../../registry";
import { createLandscape, applyPose, directions, skyMaterial, type Look, type Pose, type Quality } from "../../../src/lookdev";

function build(ctx:StoryContext):StoryInstance {
  const {scene,camera,renderer,values,overlay,hud}=ctx;
  const look=String(values.direction).slice(0,1) as Look,quality=String(values.quality) as Quality,d=directions[look];
  let pose=String(values.pose) as Pose,flightStart:number|undefined,manualFrames=0,ready=false,dead=false;
  const landscape=createLandscape(renderer,{look,quality});
  const old={background:scene.background,fog:scene.fog,exposure:renderer.toneMappingExposure,tone:renderer.toneMapping,shadow:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,cameraFov:camera.fov,cameraNear:camera.near,cameraFar:camera.far};
  const lights=scene.children.filter(c=>c instanceof THREE.Light) as THREE.Light[],visible=lights.map(l=>l.visible);lights.forEach(l=>l.visible=false);
  const hidden=scene.children.filter(c=>c instanceof THREE.GridHelper || (c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry));
  const wasVisible=hidden.map(c=>c.visible);
  const sun=new THREE.DirectionalLight(d.sun,d.sunPower);sun.position.set(-35,45,22);sun.castShadow=quality==="High";
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-65;sun.shadow.camera.right=75;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.far=160;sun.shadow.normalBias=.055;sun.shadow.bias=-.0005;
  const hemisphere=new THREE.HemisphereLight(d.sky,"#55533b",d.ambient);
  const fill=new THREE.DirectionalLight("#b8d0dc",.38);fill.position.set(40,9,-40);
  landscape.object.add(sun,hemisphere,fill,sun.target);
  // The sky is scene-owned so it cannot distort gallery content bounds or navigation speed.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(850,24,12),skyMaterial(d));sky.frustumCulled=false;scene.add(sky);
  const style=document.createElement("style");style.textContent=`
  .lookdev-panel{padding:15px 18px;background:#101c21d9;border:1px solid #d7c8a238;border-radius:4px;max-width:430px;backdrop-filter:blur(12px);color:#f1ead9}
  .lookdev-panel small{font:9px system-ui;letter-spacing:.17em;color:#c8b888}.lookdev-panel h2{font:25px/1.2 Georgia,serif;margin:7px 0}.lookdev-panel p{font:11px/1.5 system-ui;margin:4px 0;color:#c2ceca}
  .lookdev-panel button{font-size:10px;margin-top:9px;padding:7px 11px;background:#22343b}.lookdev-note{font:10px/1.5 system-ui;background:#15252bd9;border:1px solid #ddd3a333;padding:10px 13px;color:#dce3d5}
  #stage:has(.lookdev-panel) .stage-hint{display:none}#story-overlay:has(.lookdev-panel){top:20px}
  @media(max-width:760px){.lookdev-panel{padding:10px 12px;max-width:310px}.lookdev-panel h2{font-size:20px}.lookdev-panel p{font-size:10px}.lookdev-note{font-size:9px}#story-hud:has(.lookdev-note){max-width:75%;bottom:15px}}
  `;
  const panel=document.createElement("div");panel.className="lookdev-panel";
  panel.innerHTML=`<small>REALMFORGE · LANDSCAPE ATELIER / ${look}</small><h2>${d.name}</h2><p>${d.subtitle}</p><p>Westeros & Essos · one light, one living landscape</p>`;
  const flight=document.createElement("button");flight.textContent="Play 30 s flight";flight.onclick=()=>{flightStart=performance.now()/1000;flight.textContent="Restart flight";};
  const syncFlightOrientation=():void=>{
    if(dead)return;const control=document.querySelector<HTMLSelectElement>('[aria-label="Navigation mode"]');
    if(control)for(const mode of ["orbit","fly"]){control.value=mode;control.dispatchEvent(new Event("change",{bubbles:true}));}
  };
  const free=document.createElement("button");free.textContent="Release camera";free.style.marginLeft="8px";free.onclick=()=>{pose="Free flight";flightStart=undefined;manualFrames=4;syncFlightOrientation();free.textContent="Camera released · WASD";};
  panel.append(flight,free);overlay.append(style,panel);
  const note=document.createElement("div");note.className="lookdev-note";note.textContent=`${quality} · ${pose}\nOriginal landscape · CC0 surface detail`;note.style.whiteSpace="pre-line";hud.append(note);
  // Gallery currently has no camera-preset hook; use its public navigation control.
  // A story-local adapter switches to flight after the gallery's initial framing.
  queueMicrotask(()=>{if(dead)return;const select=document.querySelector<HTMLSelectElement>('[aria-label="Navigation mode"]');if(select){select.value="fly";select.dispatchEvent(new Event("change",{bubbles:true}));}});
  const compiled=landscape.ready.then(async()=>{
    if(dead)return;landscape.tick(0,camera);
    await renderer.compileAsync(scene,camera);
    if(dead)return;
    // Prewarm hidden LOD shadow variants with one instance, including cutout depth.
    const batches:{mesh:THREE.InstancedMesh;count:number}[]=[];
    landscape.object.traverse(o=>{if(o instanceof THREE.InstancedMesh){batches.push({mesh:o,count:o.count});o.count=Math.max(1,o.count);}});
    const target=new THREE.WebGLRenderTarget(16,16),previous=renderer.getRenderTarget();
    try{renderer.setRenderTarget(target);renderer.render(scene,camera);}
    finally{renderer.setRenderTarget(previous);target.dispose();batches.forEach(({mesh,count})=>mesh.count=count);}
    if(!dead)ready=true;
  });
  // Errors remain visible to QA rather than silently declaring missing arrays ready.
  void compiled.catch(error=>{if(dead)return;note.textContent=`Surface preparation failed: ${String(error)}`;console.error(error);});
  const oldBeforeRender=scene.onBeforeRender;
  scene.onBeforeRender=function(...args){
    oldBeforeRender.apply(this,args);
    if(pose!=="Free flight"||flightStart!==undefined||manualFrames<=3){
      applyPose(camera,pose==="Free flight"?"Regional":pose,flightStart===undefined?undefined:Math.min(30,performance.now()/1000-flightStart));
      camera.updateMatrixWorld(true);if(pose==="Free flight"&&manualFrames===3)queueMicrotask(syncFlightOrientation);
    }
  };
  let lastHUD=0;
  const api={
    setPose:(p:Pose)=>{pose=p;flightStart=undefined;manualFrames=0;},
    startFlight:()=>{flightStart=performance.now()/1000;},
    stats:()=>({look,quality,pose,ready,textureMemory:landscape.textureMemory(),camera:{position:camera.position.toArray(),fov:camera.fov},shadowDepthBytes:quality==="High"?1024*1024*4:0,shadowMapBytes:quality==="High"?1024*1024*8:0}),
  };
  Object.assign(window,{__lookdev:api});
  return {object:landscape.object,ready:()=>ready,navigation:{metresPerUnit:50},update:(_dt,t)=>{
    hidden.forEach(c=>c.visible=false);scene.background=new THREE.Color(d.sky);scene.fog=new THREE.FogExp2(d.horizon,d.fog);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=d.exposure;renderer.shadowMap.enabled=quality==="High";renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    if(flightStart!==undefined){const seconds=performance.now()/1000-flightStart;applyPose(camera,pose,seconds);if(seconds>=30){flightStart=undefined;pose="Essos";}}
    else if(pose!=="Free flight")applyPose(camera,pose);
    else if(manualFrames++<3)applyPose(camera,"Regional");
    sky.position.copy(camera.position);landscape.tick(t,camera);
    if(t-lastHUD>.5){lastHUD=t;const info=renderer.info.render;note.textContent=`${quality} · ${pose}\n${info.calls} draws · ${(info.triangles/1000).toFixed(0)}k triangles · ${(landscape.textureMemory().bytes/1048576).toFixed(1)} MiB textures`;}
  },dispose:()=>{
    dead=true;scene.onBeforeRender=oldBeforeRender;landscape.dispose();scene.remove(sky);sky.geometry.dispose();sky.material.dispose();sun.shadow.dispose();
    lights.forEach((l,i)=>l.visible=visible[i]);hidden.forEach((c,i)=>c.visible=wasVisible[i]);scene.background=old.background;scene.fog=old.fog;renderer.toneMappingExposure=old.exposure;renderer.toneMapping=old.tone;renderer.shadowMap.enabled=old.shadow;renderer.shadowMap.type=old.shadowType;camera.fov=old.cameraFov;camera.near=old.cameraNear;camera.far=old.cameraFar;camera.updateProjectionMatrix();
    if((window as unknown as {__lookdev?:unknown}).__lookdev===api)delete (window as unknown as {__lookdev?:unknown}).__lookdev;
  }};
}
registerStories({id:"lookdev/landscape",title:"Three ways to a living world",category:"Look development",description:"A synthetic Westeros sampler and an equally detailed Essos harbor. Compare three complete directions at the measured World x20 camera inclination, then approach a castle or fly over the strait. No HBO art. All surface photography is existing CC0; vegetation, sky and settlements are procedural.",controls:{
  direction:{type:"select",label:"Art direction",default:"B · Grounded realism",options:["A · Painterly realism","B · Grounded realism","C · Series mood"]},
  quality:{type:"select",label:"Quality",default:"High",options:["High","Balanced"]},
  pose:{type:"select",label:"Camera preset",default:"World x20",options:["World x20","Regional","Close","Essos","Free flight"]},
},build});

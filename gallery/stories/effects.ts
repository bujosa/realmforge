import ShipWakes from "../../src/effects/ShipWakes";
import { worldFrame } from "../../src/core/SceneFrame";
import { boatGeometry } from "../../src/props/HarborProps";
import * as THREE from "three";
import { registerStories } from "../registry";
import * as effects from "../../src/effects/presets";
import { createDragonFire, DragonScorch } from "../../src/dragons/fire";
import type { VfxHandle } from "../../src/effects/InstancedVfx";
const presets=[['charge-dust',effects.createChargeDust],['melee-sparks',effects.createMeleeSparks],['arrow-volley',effects.createArrowVolley],['banner-fall',effects.createBannerFall],['siege-smoke',effects.createSiegeSmoke],['ship-ram',effects.createShipRam],['retreat-dust',effects.createRetreatDust],['fire-burst',effects.createDragonFire],['dragon-breath',createDragonFire]] as const;
for(const [id,create] of presets)registerStories({id:`props/vfx-${id}`,title:`${id.split('-').join(' ')} · animated effect`,category:"Props",description:"Original texture-free production particle effect. Replays a synthetic public cue every two seconds; the host supplies resolved events and presentation deltas.",build(){
  const object=new THREE.Group();
  object.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-1,-0.1,-0.5),new THREE.Vector3(1.5,1.2,0.5));
  const vfx=create({tier:"balanced",reducedMotion:false}) as VfxHandle<effects.PointCue & effects.PathCue & effects.SiegeCue & effects.ShipCue>;
  object.add(vfx.object);let clock=2;
  return {object,update(dt){clock+=dt;if(clock>=2){clock=0;vfx.play({origin:new THREE.Vector3(),from:new THREE.Vector3(-0.6,0.15,0),to:new THREE.Vector3(0.6,0.15,0),burning:true,sinking:false});}vfx.update(dt*1000);},dispose:()=>vfx.dispose()};
}});
registerStories({id:"props/dragon-scorch",title:"Dragon scorch · terrain decal",category:"Props",build(){const scorch=new DragonScorch(()=>0);scorch.add(new THREE.Vector3(-0.5,0,0),new THREE.Vector3(0.5,0,0),0.2);return {object:scorch.object,dispose:()=>scorch.dispose()};}});
registerStories({id:"props/ship-wakes",title:"Ship wakes · bounded foam trails",category:"Props",build(){
  const object=new THREE.Group();object.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-1,-0.04,-1),new THREE.Vector3(1,0.1,1));
  const texture=new THREE.DataTexture(new Uint8Array([255,255,0,0]),1,1);texture.needsUpdate=true;
  const frame=worldFrame(100,100,1),wakes=new ShipWakes(object,{texture,frame},100,100,()=>0);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:"#336879"}));water.position.y=-0.003;object.add(water);
  const boat=new THREE.Mesh(boatGeometry(),new THREE.MeshStandardMaterial({vertexColors:true}));boat.scale.setScalar(3);object.add(boat);
  return {object,update(_dt,time){const x=Math.sin(time)*0.5,z=Math.cos(time)*0.5;boat.position.set(x,0,z);boat.rotation.y=time+Math.PI/2;wakes.begin(time*1000,true);wakes.ship('demo',x,z,true,time*1000);},dispose:()=>{wakes.dispose();texture.dispose();}};
}});

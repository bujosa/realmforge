import * as THREE from "three";
import { registerStories } from "../../registry";
import { createDragon } from "../../../src/dragons/createDragon";
import { demoDragonPalette } from "../../../src/presets/dragonPalettes";
registerStories({id:"pieces/living-dragon",title:"Living dragon · skeletal flight",category:"Dragons",description:"Standalone original production dragon rig, membrane shader and flight controller. Palette is injected from optional demo data. Separate from the army prototype.",controls:{motion:{type:"boolean",label:"Flight motion",default:true},tier:{type:"select",label:"Dragon quality",default:"balanced",options:["high","balanced"]}},build({values}){
  const dragon=createDragon({house:"neutral",palette:demoDragonPalette("neutral"),tier:values.tier as "high"|"balanced",reducedMotion:false})!;
  // A world-aligned study envelope includes extended wings and the patrol path.
  const span = Number(dragon.object.userData.wingspan), radius = values.motion ? 0.4 : 0;
  const object = new THREE.Group(); object.add(dragon.object);
  object.userData.visualBounds = new THREE.Box3(
    new THREE.Vector3(-span * 0.6 - radius, -span * 0.25, -span * 0.6 - radius),
    new THREE.Vector3(span * 0.6 + radius, span * 0.5 + (values.motion ? 0.6 : 0), span * 0.6 + radius));
  if(values.motion)dragon.patrol(new THREE.Vector3(),0.4,0.6);
  return {object,update:dt=>dragon.update(dt*1000),dispose:()=>dragon.dispose()};
}});

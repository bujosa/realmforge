import * as THREE from "three";
import { registerStories } from "../registry";
import { floraGeometry,floraGrassGeometry,floraGroupGeometry,floraImpostorGeometry,floraCanopyTextures } from "../../src/nature/FloraGeometry";
import type { FloraSpecies } from "../../src/nature/FloraPlacement";
import bridgeGeometry from "../../src/props/BridgeGeometry";
import { campGeometry } from "../../src/props/CampGeometry";
import { createDragon } from "../../src/dragons/createDragon";
import { demoDragonPalette } from "../../src/presets/dragonPalettes";
import TokenLayer from "../../src/tokens/TokenLayer";
import { titleCase } from "../../src/presets/demo";
const material=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85,side:THREE.DoubleSide});
for(const species of ["pine","birch","oak","cypress","olive","palm","willow","orchard","weirwood","reed"] as FloraSpecies[]) registerStories({
  id:`nature/flora-${species}`,title:`${titleCase(species)} · physical flora`,category:"Nature",description:"Original production flora sculpt, normalized to unit height; hosts set physical metre height. Both near and far variants are inspectable.",controls:{near:{type:"boolean",label:"Near detail",default:true}},build:({values})=>({object:new THREE.Mesh(floraGeometry(species,Boolean(values.near)),material())}),
});
for (const [id,build] of [["grass",floraGrassGeometry],["canopy-group",floraGroupGeometry],["copse-impostor",floraImpostorGeometry]] as const) registerStories({id:`nature/${id}`,title:titleCase(id),category:"Nature",build:()=>({object:new THREE.Mesh(build(),material())})});
registerStories({id:"materials/canopy-atlas",title:"Forest canopy · procedural atlas",category:"Materials",build(){ const textures=floraCanopyTextures();const m=new THREE.MeshStandardMaterial({color:"#72905b",map:textures?.colour,normalMap:textures?.normal,alphaTest:0.35,side:THREE.DoubleSide});return {object:new THREE.Mesh(new THREE.PlaneGeometry(1,1),m),dispose:()=>{textures?.colour.dispose();textures?.normal.dispose();}}; }});
registerStories({id:"props/stone-bridge",title:"Stone bridge · arched crossing",category:"Props",controls:{physical:{type:"boolean",label:"Physical bridge",default:true}},build:({values})=>({object:new THREE.Mesh(bridgeGeometry(1.6,1.1,[[0,0,0],[0,0,0]],Boolean(values.physical)),material())})});
for(const kind of ["hearth","camp","person"] as const)registerStories({id:`props/${kind}`,title:titleCase(kind),category:"Props",build:()=>({object:new THREE.Mesh(campGeometry(kind),material())})});
registerStories({id:"pieces/living-dragon",title:"Living dragon · skeletal flight",category:"Pieces",description:"Standalone original production dragon rig, membrane shader and flight controller. Palette is injected from optional demo data. Separate from the army prototype.",controls:{motion:{type:"boolean",label:"Flight motion",default:true},tier:{type:"select",label:"Dragon quality",default:"balanced",options:["high","balanced"]}},build({values}){
  const dragon=createDragon({house:"neutral",palette:demoDragonPalette("neutral"),tier:values.tier as "high"|"balanced",reducedMotion:false})!;
  if(values.motion)dragon.patrol(new THREE.Vector3(),0.4,0.6);
  return {object:dragon.object,update:dt=>dragon.update(dt*1000),dispose:()=>dragon.dispose()};
}});
registerStories({id:"props/strategic-tokens",title:"Tokens · injected order & power faces",category:"Props",description:"Production screen-space token layer with original neutral demo faces. No game order artwork is bundled; inject your own textures. The host feeds public token inputs and owns source textures.",build({camera,renderer}){
  const layer=new TokenLayer(),object=new THREE.Group();object.add(layer.group);
  object.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-1,-0.04,-0.3),new THREE.Vector3(1,0.25,0.3));
  const pedestal=new THREE.Mesh(new THREE.BoxGeometry(2,0.04,0.6),new THREE.MeshStandardMaterial({color:"#596858"}));pedestal.position.y=-0.02;object.add(pedestal);
  const kinds=["order","power","garrison","loyalty"] as const;
  const faces=kinds.map((kind,i)=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=128;const ctx=canvas.getContext("2d")!;ctx.fillStyle=["#886840","#b09247","#5b7277","#7c5c58"][i];ctx.fillRect(0,0,128,128);ctx.fillStyle="#f5ead2";ctx.font="bold 58px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(kind[0].toUpperCase(),64,68);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;});
  return {object,update(){camera.updateMatrixWorld();layer.begin();kinds.forEach((kind,i)=>layer.add({id:kind,kind,position:new THREE.Vector3(-0.75+i*0.5,0,0),face:faces[i],color:"#d3bf85",opacity:1,scale:1,flip:1,highlight:null,pickable:true}));const size=renderer.getSize(new THREE.Vector2());layer.end(camera,size.x,size.y,2);},dispose:()=>{layer.dispose();faces.forEach(face=>face.dispose());}};
}});

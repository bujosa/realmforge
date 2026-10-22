import * as THREE from "three";
import { registerStories } from "../../registry";

import TokenLayer from "../../../src/tokens/TokenLayer";
registerStories({id:"props/strategic-tokens",title:"Tokens · injected order & power faces",category:"Tokens",description:"Production screen-space token layer with original neutral demo faces. No game order artwork is bundled; inject your own textures. The host feeds public token inputs and owns source textures.",build({camera,renderer}){
  const layer=new TokenLayer(),object=new THREE.Group();object.add(layer.group);
  object.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-1,-0.04,-0.3),new THREE.Vector3(1,0.25,0.3));
  const pedestal=new THREE.Mesh(new THREE.BoxGeometry(2,0.04,0.6),new THREE.MeshStandardMaterial({color:"#596858"}));pedestal.position.y=-0.02;object.add(pedestal);
  const kinds=["order","power","garrison","loyalty"] as const;
  const faces=kinds.map((kind,i)=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=128;const ctx=canvas.getContext("2d")!;ctx.fillStyle=["#886840","#b09247","#5b7277","#7c5c58"][i];ctx.fillRect(0,0,128,128);ctx.fillStyle="#f5ead2";ctx.font="bold 58px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(kind[0].toUpperCase(),64,68);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;});
  return {object,update(){camera.updateMatrixWorld();layer.begin();kinds.forEach((kind,i)=>layer.add({id:kind,kind,position:new THREE.Vector3(-0.75+i*0.5,0,0),face:faces[i],color:"#d3bf85",opacity:1,scale:1,flip:1,highlight:null,pickable:true}));const size=renderer.getSize(new THREE.Vector2());layer.end(camera,size.x,size.y,2);},dispose:()=>{layer.dispose();faces.forEach(face=>face.dispose());}};
}});

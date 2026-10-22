import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import IceWallMaterial from "../../../src/materials/IceWallMaterial";
import { naturalTree } from "../../../src/nature/NaturalTrees";
import { modularCastle } from "../../../src/castles/castleKit";
import { paintGeometry } from "../../../src/core/sculpt";
import type { ThreatRegion } from "../../../src/wildlings";

export const region: ThreatRegion = {minX:-12,maxX:12,northZ:-24,wallZ:0,wallHeight:4.26,beacons:[{x:-10,z:0},{x:0,z:0},{x:10,z:0}]};
export const groundHeight = (x:number,z:number):number => .10+Math.sin(x*.24)*Math.sin(z*.19)*.10+Math.max(0,-z-13)*.025;
const hash=(n:number):number=>{const x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
const merge=(parts:THREE.BufferGeometry[]):THREE.BufferGeometry=>{const result=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return result;};

export function northPatch(): THREE.Group {
  const group=new THREE.Group();group.name="Gallery North patch (synthetic public terrain)";
  group.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-14,0,-26),new THREE.Vector3(14,12,7));
  const terrain=new THREE.PlaneGeometry(30,37,64,64).rotateX(-Math.PI/2).translate(0,0,-10.5);
  const pos=terrain.getAttribute("position"),colors:number[]=[];
  const tone=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,groundHeight(x,z));
    tone.set(z<-.5?"#718a93":"#aebfc7");tone.multiplyScalar(.84+hash(i)*.20);colors.push(tone.r,tone.g,tone.b);
  }
  terrain.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  group.add(new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0})));
  const iceGeometry=new THREE.BoxGeometry(24,4.26,.86,120,24,1).translate(0,2.23,0);
  const ip=iceGeometry.getAttribute("position"),iceColors:number[]=[];
  const pale=new THREE.Color("#d4e9ed"),blue=new THREE.Color("#7baac4"),iceTone=new THREE.Color();
  for(let i=0;i<ip.count;i++){
    const x=ip.getX(i),y=ip.getY(i),z=ip.getZ(i);
    ip.setZ(i,z+Math.sign(z)*(.024*Math.sin(x*7.1)+.018*Math.sin(x*19.4+y*.4)));
    iceTone.copy(blue).lerp(pale,THREE.MathUtils.clamp(y/4.26*.65+.12*Math.sin(y*13.+Math.sin(x*3.)*.2),0,1));
    iceColors.push(iceTone.r,iceTone.g,iceTone.b);
  }
  iceGeometry.setAttribute("color",new THREE.Float32BufferAttribute(iceColors,3));iceGeometry.computeVertexNormals();
  const ice=new THREE.Mesh(iceGeometry,new IceWallMaterial());ice.name="Library layered ice material · 213 m Wall";group.add(ice);
  const treeParts:THREE.BufferGeometry[]=[];
  naturalTree("tree-pine","#344e50",(geometry,x,y,z,color,shade=1)=>{
    geometry.translate(x,y,z);paintGeometry(geometry,color);const c=geometry.getAttribute("color");for(let i=0;i<c.count;i++)c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);
    geometry.deleteAttribute("uv");treeParts.push(geometry.index?geometry.toNonIndexed():geometry);if(geometry.index)geometry.dispose();
  });
  const trees=new THREE.InstancedMesh(merge(treeParts),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),360);
  const dummy=new THREE.Object3D();
  for(let i=0;i<360;i++){
    const x=-13+hash(i*3+1)*26,z=-1.8-hash(i*3+2)*23;
    dummy.position.set(x,groundHeight(x,z),z);dummy.rotation.set(0,hash(i*3+3)*Math.PI*2,0);dummy.scale.setScalar(3.1+hash(i*5)*1.8);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);
  }
  group.add(trees);
  const fortGeo=modularCastle(false,0).scale(2.4,2.4,2.4);
  const forts=new THREE.InstancedMesh(fortGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),3);
  [-10,0,10].forEach((x,i)=>{dummy.position.set(x,groundHeight(x,1),1.05);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();forts.setMatrixAt(i,dummy.matrix);});group.add(forts);
  // Distant rock silhouettes are static terrain, not inferred enemy units.
  const mountains:THREE.BufferGeometry[]=[];
  for(let i=0;i<18;i++){
    const h=1.5+hash(i)*3;
    mountains.push(new THREE.ConeGeometry(1.5+hash(i+3),h,5).translate(-17+i*2,h/2,-25.4));
  }
  group.add(new THREE.Mesh(merge(mountains),new THREE.MeshStandardMaterial({color:"#293f4c",roughness:1})));
  return group;
}

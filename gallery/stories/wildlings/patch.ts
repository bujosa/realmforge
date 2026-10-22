import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WallIceMaterial, wallGeometry, watchFortGeometry } from "../../../src/cities/WallArt";
import { wallPath } from "../../../src/cities/WallProfile";
import { WALL_HEIGHT_METRES } from "../../../src/core/wallScale";
import { METRES_PER_UNIT } from "../../../src/core/SceneFrame";
import { natureGeometry } from "../../../src/nature/nature";
import { naturalTree } from "../../../src/nature/NaturalTrees";
import { paintGeometry } from "../../../src/core/sculpt";
import type { ThreatRegion } from "../../../src/wildlings";

export const region: ThreatRegion = {minX:-12,maxX:12,northZ:-24,wallZ:0,wallHeight:WALL_HEIGHT_METRES / METRES_PER_UNIT,beacons:[{x:-10,z:0},{x:0,z:0},{x:10,z:0}]};
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
  const edges=[{a:{x:region.minX,z:0},b:{x:region.maxX,z:0}}];
  const path=wallPath(edges,region.wallHeight,groundHeight);
  const iceGeometry=wallGeometry(path,groundHeight,new THREE.Vector3());
  const ice=new THREE.Mesh(iceGeometry,new WallIceMaterial());
  const mood={value:0},oldCompile=ice.material.onBeforeCompile;
  ice.material.onBeforeCompile=(shader,renderer)=>{
    oldCompile.call(ice.material,shader,renderer);shader.uniforms.northernMood=mood;
    shader.fragmentShader="uniform float northernMood;\n"+shader.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
      float beaconPool=exp(-pow((wallLocal.x/50.+10.)/1.3,2.))+exp(-pow(wallLocal.x/50./1.3,2.))+exp(-pow((wallLocal.x/50.-10.)/1.3,2.));
      float crestLight=smoothstep(.62,1.,vWallCoord.y)*beaconPool*northernMood;
      totalEmissiveRadiance+=vec3(.006,.018,.034)+vec3(.55,.13,.014)*crestLight;`);
  };
  ice.material.customProgramCacheKey=()=>"gallery-northern-wall-v2";
  group.userData.setMood=(strength:number):void=>{mood.value=THREE.MathUtils.smoothstep(strength,6,9);};
  ice.name="Library fluted, stratified ice with cornice and parapets · 213 m Wall";group.add(ice);
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
  const forts:THREE.BufferGeometry[]=[];
  [-10,0,10].forEach((x,i)=>{
    const z=1.12,foot=groundHeight(x,z);
    forts.push(watchFortGeometry(i===1,WALL_HEIGHT_METRES,{ground:(lx,lz)=>(groundHeight(x+lx/METRES_PER_UNIT,z+lz/METRES_PER_UNIT)-foot)*METRES_PER_UNIT},true).translate(x,foot,z));
  });
  const fortMesh=new THREE.Mesh(merge(forts),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}));
  fortMesh.name="Shadow Tower · Castle Black stairs and winch · Eastwatch";group.add(fortMesh);
  const mountains:THREE.BufferGeometry[]=[];
  for(let i=0;i<26;i++){
    const h=1.8+hash(i)*3.8;
    mountains.push(natureGeometry("mountain-rock").scale(22+hash(i+3)*20,h*9,28).rotateY(hash(i+29)*2).translate(-18+i*1.5,h*.22,-25.8-hash(i+41)*2));
  }
  group.add(new THREE.Mesh(merge(mountains),new THREE.MeshStandardMaterial({color:"#33495a",vertexColors:true,roughness:1})));
  return group;
}

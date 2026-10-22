import * as THREE from "three";
import { wildlingGeometry } from "./currentGeometry";
import { currentTurfGeometry } from "./currentTurf";
import { groundHeight } from "./patch";

/** Production x20 visual vocabulary: eight public hearths, turf huts, smoke quads; no additional threat sky. */
export function currentCamps(strength:number):{object:THREE.Group;update:(time:number,camera:THREE.Camera)=>void;dispose:()=>void}{
  const object=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});
  const fireTime={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.campTime=fireTime;
    shader.vertexShader="attribute float campFire; varying float vCampFire;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvCampFire=campFire;");
    shader.fragmentShader="uniform float campTime;varying float vCampFire;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.8,.47,.07)*vCampFire*(.94+.06*sin(campTime*5.));");
  };
  material.customProgramCacheKey=()=>"frozen-current-wildling-reference";
  const hearths=new THREE.InstancedMesh(wildlingGeometry("hearth"),material,12);
  const camps=new THREE.InstancedMesh(wildlingGeometry("camp"),material,8);
  const turf=new THREE.InstancedMesh(currentTurfGeometry(),material,96);
  const canvas=document.createElement("canvas");canvas.width=canvas.height=64;const c=canvas.getContext("2d")!;
  const gradient=c.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,"rgba(166,172,174,.46)");gradient.addColorStop(.45,"rgba(151,159,162,.24)");gradient.addColorStop(1,"rgba(151,159,162,0)");c.fillStyle=gradient;c.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);
  const smoke=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.65}),24);
  const dummy=new THREE.Object3D(),sites=Array.from({length:12},(_,i)=>({x:-9+(i%4)*6,z:-5-Math.floor(i/4)*6}));
  turf.count=0;
  sites.forEach((site,i)=>{
    dummy.position.set(site.x,groundHeight(site.x,site.z),site.z);dummy.scale.setScalar(1);dummy.updateMatrix();hearths.setMatrixAt(i,dummy.matrix);
    const huts=5+i%4;
    for(let j=0;j<huts;j++){
      const a=j/huts*Math.PI*2,x=site.x+Math.cos(a)*.45,z=site.z+Math.sin(a)*.45;
      dummy.position.set(x,groundHeight(x,z)-.01,z);dummy.rotation.y=a;dummy.scale.setScalar(1);dummy.updateMatrix();turf.setMatrixAt(turf.count++,dummy.matrix);
    }
  });
  const lit=Math.round(Math.max(0,Math.min(12,strength))*8/12);camps.count=lit;
  sites.slice(0,lit).forEach((site,i)=>{dummy.position.set(site.x,groundHeight(site.x,site.z),site.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1.6);dummy.updateMatrix();camps.setMatrixAt(i,dummy.matrix);});
  object.add(hearths,camps,turf,smoke);
  return {object,update(time,camera){fireTime.value=time;smoke.count=0;sites.slice(0,lit).forEach((site,i)=>{for(let j=0;j<3;j++){
    const t=(time*.18+j/3+i*.13)%1;dummy.position.set(site.x+Math.sin(t*3+i)*.018*t*4,groundHeight(site.x,site.z)+(.035+t*.21)*4,site.z);
    dummy.quaternion.copy(camera.quaternion);dummy.scale.setScalar((.035+t*.065)*4);dummy.updateMatrix();smoke.setMatrixAt(smoke.count++,dummy.matrix);
  }});smoke.instanceMatrix.needsUpdate=true;},dispose(){texture.dispose();}};
}

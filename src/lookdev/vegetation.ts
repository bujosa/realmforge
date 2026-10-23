import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paintGeometry } from "../core/sculpt";
import { floraCanopyTextures, floraGroupGeometry } from "../nature/FloraGeometry";
import { type Direction, heightAt, hash, noise, riverX } from "./directions";

type Tree = {x:number;z:number;h:number;pine:boolean;scale:number};
function treeGeometry(pine:boolean,detail:boolean,cards=false):THREE.BufferGeometry {
  const pieces:THREE.BufferGeometry[]=[];
  const add=(g:THREE.BufferGeometry,c:string):void=>{const p=g.index?g.toNonIndexed():g;if(p!==g)g.dispose();p.setAttribute("ldLeaf",new THREE.Float32BufferAttribute(new Float32Array(p.getAttribute("position").count).fill(c==="#625441"?0:1),1));pieces.push(paintGeometry(p,c));};
  const trunk=new THREE.CylinderGeometry(.008,.026,pine?1.05:.65,5);trunk.translate(0,pine?.525:.325,0);add(trunk,"#625441");
  if(pine) {
    for(let tier=0;tier<(detail?7:4);tier++) {
      const t=tier/(detail?7:4),radius=.29*(1-t)+.025;
      const g=new THREE.ConeGeometry(radius,detail?.27:.38,detail?9:6,1,true);
      const p=g.getAttribute("position");for(let i=0;i<p.count;i++){const y=p.getY(i);p.setY(i,y+Math.sin(i*2.31+tier)*.018);}
      g.rotateY(tier*1.69);g.translate(Math.sin(tier*4.7)*.012,.25+t*.8,0);g.computeVertexNormals();add(g,tier%2?"#718367":"#63785b");
    }
  } else {
    for(let i=0;i<(cards?32:detail?9:5);i++) {
      const a=i*2.39996,r=i===0?0:detail?.12+hash(i,2)*.12:.15;
      const x=Math.cos(a)*r,z=Math.sin(a)*r,y=.62+hash(i,3)*.25;
      const g=cards ? new THREE.PlaneGeometry(2,2) : new THREE.SphereGeometry(1,detail?6:5,3);
      g.scale(cards?.32:detail?.16+hash(i,4)*.08:.25,cards?.29:detail?.15:.24,cards?1:detail?.17:.23);if(cards){g.rotateY(a);g.rotateX((hash(i,17)-.5)*1.8);}
      const p=g.getAttribute("position");for(let k=0;k<p.count;k++)p.setY(k,p.getY(k)*(1+Math.sin(k*2.3+i)*.19));g.translate(x,y,z);g.computeVertexNormals();
      add(g,["#89926a","#71845b","#9a9d72"][i%3]);
      if(detail && i%3===0){const b=new THREE.CylinderGeometry(.005,.012,.38,4);b.rotateZ(-Math.cos(a)*.45);b.rotateX(Math.sin(a)*.45);b.translate(x*.5,.48,z*.5);add(b,"#625441");}
    }
  }
  const result=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());return result;
}
export function vegetation(d:Direction,high:boolean):{object:THREE.Group;update:(camera:THREE.Camera)=>void;dispose:()=>void;textureBytes:number} {
  const object=new THREE.Group(),trees:Tree[]=[];
  const clusters=[[-26,-6,10,11],[-12,-16,9,12],[1,-24,9,12],[-30,12,9,9],[4,8,7,7],[-17,0,9,9],[57,-12,10,8]];
  for(let i=0;i<(high?4500:2800);i++){
    const c=clusters[i%clusters.length],a=hash(i,6)*Math.PI*2,r=Math.sqrt(hash(i,7));
    const x=c[0]+Math.cos(a)*c[2]*r,z=c[1]+Math.sin(a)*c[3]*r;
    const h=heightAt(x,z);if(h<.9||h>6.7||Math.abs(x-riverX(z))<1.35||Math.hypot(x+12,z-7)<5||Math.hypot(x+8,z-16)<6.4)continue;
    if(noise(x*.38,z*.38)<.24)continue;
    trees.push({x,z,h,pine:z< -8&&x<26,scale:.6+hash(i,9)*.65});
  }
  const disposers:(()=>void)[]=[];
  const leafCanvas=document.createElement("canvas");leafCanvas.width=leafCanvas.height=128;
  const c=leafCanvas.getContext("2d")!;
  for(let i=0;i<155;i++){
    const a=hash(i,20)*6.283,r=Math.sqrt(hash(i,21))*.46,x=64+Math.cos(a)*r*128,y=64+Math.sin(a)*r*128;
    c.save();c.translate(x,y);c.rotate(a);const tone=110+Math.round(hash(i,22)*100);c.fillStyle=`rgb(${tone},${tone+12},${tone-20})`;c.beginPath();c.ellipse(0,0,3+hash(i,23)*3,1.5+hash(i,24)*2,0,0,Math.PI*2);c.fill();c.restore();
  }
  const leaves=new THREE.CanvasTexture(leafCanvas);leaves.colorSpace=THREE.SRGBColorSpace;disposers.push(()=>leaves.dispose());
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,color:new THREE.Color(d.foliage).lerp(new THREE.Color("#ffffff"),.30),roughness:.97,side:THREE.DoubleSide});
  // Per-vertex ambient occlusion keeps trunks rooted and the crown edge luminous.
  mat.onBeforeCompile=s=>{s.vertexShader="attribute float ldLeaf;varying float ldTreeY,ldLeafFlag;varying vec2 ldLeafUv;\n"+s.vertexShader;s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nldTreeY=position.y;ldLeafFlag=ldLeaf;ldLeafUv=uv;");s.fragmentShader="varying float ldTreeY,ldLeafFlag;varying vec2 ldLeafUv;uniform sampler2D ldLeaves;uniform float ldCutout;\n"+s.fragmentShader;s.uniforms.ldLeaves={value:leaves};s.uniforms.ldCutout={value:0};s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nif(ldCutout>.5&&ldLeafFlag>.5){vec4 leaf=texture2D(ldLeaves,ldLeafUv);if(leaf.a<.42)discard;diffuseColor.rgb*=leaf.rgb*3.0;}\ndiffuseColor.rgb*=.61+.39*smoothstep(.0,.9,ldTreeY);");};
  const cardMat=mat.clone();cardMat.color.set("#d2dbc0");cardMat.emissive.set("#27331c");cardMat.emissiveIntensity=.22;cardMat.onBeforeCompile=s=>{mat.onBeforeCompile(s,undefined as unknown as THREE.WebGLRenderer);s.uniforms.ldCutout.value=1;};cardMat.customProgramCacheKey=()=>"lookdev-leaves-cutout-v1";

  disposers.push(()=>cardMat.dispose());
  const batches:{mesh:THREE.InstancedMesh;data:Tree[];detail:boolean}[]=[];
  for(const pine of [true,false])for(const detail of [true,false]){
    const cards=detail&&!pine&&d.photo>.5;const data=trees.filter(t=>t.pine===pine),g=treeGeometry(pine,detail,cards),mesh=new THREE.InstancedMesh(g,cards?cardMat:mat,data.length);
    if(cards){
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
      depth.onBeforeCompile=s=>{
        s.uniforms.ldLeaves={value:leaves};
        s.vertexShader="attribute float ldLeaf;varying float ldLeafFlag;varying vec2 ldLeafUv;\n"+s.vertexShader;
        s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nldLeafFlag=ldLeaf;ldLeafUv=uv;");
        s.fragmentShader="uniform sampler2D ldLeaves;varying float ldLeafFlag;varying vec2 ldLeafUv;\n"+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace("#include <clipping_planes_fragment>","#include <clipping_planes_fragment>\nif(ldLeafFlag>.5&&texture2D(ldLeaves,ldLeafUv).a<.42)discard;");
      };depth.customProgramCacheKey=()=>"lookdev-leaf-depth-v1";mesh.customDepthMaterial=depth;disposers.push(()=>depth.dispose());
    }
    mesh.setColorAt(0,new THREE.Color("white"));mesh.castShadow=high;mesh.receiveShadow=true;mesh.frustumCulled=false;object.add(mesh);batches.push({mesh,data,detail});
  }
  const atlas=floraCanopyTextures();
  if(atlas){
    const shellMat=new THREE.MeshStandardMaterial({map:atlas.colour,normalMap:atlas.normal,normalScale:new THREE.Vector2(.65,.65),color:d.foliage,alphaTest:.5,side:THREE.DoubleSide,roughness:1});
    const shellTrees=trees.filter(t=>!t.pine);
    const shell=new THREE.InstancedMesh(floraGroupGeometry(),shellMat,shellTrees.length);
    if(d.grounding)shell.setColorAt(0,new THREE.Color("white"));
    shell.receiveShadow=true;shell.frustumCulled=false;object.add(shell);
    object.userData.canopy={mesh:shell,trees:shellTrees};
    disposers.push(()=>{atlas.colour.dispose();atlas.normal.dispose();});
  }
  const transform=new THREE.Object3D(),last=new THREE.Vector3(Infinity,0,0);
  const update=(camera:THREE.Camera):void=>{
    if(last.distanceToSquared(camera.position)<.05)return;last.copy(camera.position);
    const canopy=object.userData.canopy as {mesh:THREE.InstancedMesh;trees:Tree[]}|undefined;
    if(canopy){let count=0;for(const t of canopy.trees){
      if(Math.hypot(t.x-camera.position.x,t.h-camera.position.y,t.z-camera.position.z)<=60)continue;
      transform.position.set(t.x,t.h+t.scale*.52,t.z);transform.rotation.set(0,hash(t.x,t.z)*6.28,0);transform.scale.set(t.scale*.43*(d.grounding?.crownWidth??1),t.scale*.3,t.scale*.43*(d.grounding?.crownWidth??1));transform.updateMatrix();canopy.mesh.setMatrixAt(count,transform.matrix);
      if(d.grounding){const shade=THREE.MathUtils.lerp(...d.grounding.crownShade,noise(t.x*.8,t.z*.8));canopy.mesh.setColorAt(count,new THREE.Color(shade,shade,shade*.95));}
      count++;
    }canopy.mesh.count=count;canopy.mesh.instanceMatrix.needsUpdate=true;if(canopy.mesh.instanceColor)canopy.mesh.instanceColor.needsUpdate=true;}
    for(const {mesh,data,detail} of batches){
      let packed=0;data.forEach((t,i)=>{
        const distance=Math.hypot(t.x-camera.position.x,t.h-camera.position.y,t.z-camera.position.z);
        const near=high&&distance<18;if(near!==detail||(!t.pine&&distance>60))return;
        transform.position.set(t.x,t.h-.03,t.z);transform.rotation.set(0,hash(i,8)*Math.PI*2,0);
        transform.scale.set(t.scale*(d.grounding?.crownWidth??1),t.scale*(t.x>26?.72:1),t.scale*(d.grounding?.crownWidth??1));transform.updateMatrix();mesh.setMatrixAt(packed,transform.matrix);
        const tint=d.grounding?THREE.MathUtils.lerp(...d.grounding.crownShade,noise(t.x*.8,t.z*.8)):.80+hash(i,11)*.32;mesh.setColorAt(packed++,new THREE.Color(tint,tint,tint*.95));
      });mesh.count=packed;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;
    }
  };
  return {object,update,dispose:()=>disposers.forEach(f=>f()),textureBytes:(atlas?512*512*4*2*4/3:0)+128*128*4*4/3};
}

import * as THREE from "three";
import { SurfaceArrays } from "../materials/SurfaceArrays";
import { directions, type Look, type Pose, type Quality } from "./directions";
import { landscapeGeometry, seaMaterial, skyMaterial, terrainMaterial } from "./surfaces";
import { vegetation } from "./vegetation";
import { settlements } from "./settlements";

export interface LandscapeOptions { look:Look; quality:Quality }
export interface Landscape {
  object:THREE.Group; ready:Promise<void>; tick:(seconds:number,camera:THREE.Camera)=>void;
  dispose:()=>void; textureMemory:()=>{bytes:number;format:string};
}
/** Portable scene content. Gallery controls/camera are deliberately kept in the story adapter. */
export function createLandscape(renderer:THREE.WebGLRenderer,options:LandscapeOptions):Landscape {
  const object=new THREE.Group(),d=directions[options.look],high=options.quality==="High";
  const arrays=new SurfaceArrays(renderer);let disposed=false,textureBytes=0,format="loading";
  const fallback=new THREE.MeshStandardMaterial({color:d.grass,roughness:1});
  const ground=new THREE.Mesh(landscapeGeometry(high),fallback);ground.receiveShadow=true;object.add(ground);object.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-64,-3,-70),new THREE.Vector3(80,16,58));
  const sea=seaMaterial(d);const water=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600).rotateX(-Math.PI/2),sea.material);water.position.y=0;object.add(water);
  const forest=vegetation(d,high),sites=settlements(high);object.add(forest.object,sites);
  const ready=arrays.load().then(surfaces=>{
    if(disposed)return;
    fallback.dispose();ground.material=terrainMaterial(d,surfaces);
    // Shared stone grain breaks up toy-like solid walls without adding a draw or texture.
    sites.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const m=o.material;if(!(m instanceof THREE.MeshStandardMaterial)||!m.vertexColors)return;
      m.onBeforeCompile=s=>{
        s.uniforms.ldStone={value:surfaces.albedo};s.uniforms.ldPhoto={value:d.photo};
        s.vertexShader="varying vec3 ldSiteP;\n"+s.vertexShader;s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nldSiteP=position;");
        s.fragmentShader="varying vec3 ldSiteP;uniform highp sampler2DArray ldStone;uniform float ldPhoto;\n"+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec3 grain=texture(ldStone,vec3((ldSiteP.xy+ldSiteP.zy)*2.0,5.0)).rgb;float grit=dot(grain,vec3(.2126,.7152,.0722));diffuseColor.rgb*=mix(1.0,clamp(.64+grit*2.0,.65,1.35),ldPhoto*.75);");
      };m.customProgramCacheKey=()=>"lookdev-site-stone-v1";
    });
    const textures=[surfaces.albedo,surfaces.normal,surfaces.roughness];
    textureBytes=textures.reduce((sum,t)=>sum+t.mipmaps.reduce((total,mip)=>total+mip.data.byteLength,0),0)+forest.textureBytes;
    format=`${surfaces.albedo.image.width}×${surfaces.albedo.image.height}×${surfaces.albedo.image.depth} compressed array; GPU format ${surfaces.albedo.format}; mip payload + RGBA canopy mip estimate`;
  });
  return {object,ready,tick:(seconds,camera)=>{sea.time.value=seconds;forest.update(camera);},textureMemory:()=>({bytes:textureBytes,format}),dispose:()=>{disposed=true;arrays.dispose();forest.dispose();}};
}
/** Measured game x20 view direction from r6-armies/r3, translated to this synthetic site. */
export function applyPose(camera:THREE.PerspectiveCamera,pose:Pose,flightSeconds?:number):void {
  let target=new THREE.Vector3(5,0,-3),offset=new THREE.Vector3(0,134.50025294153435,38.67615919471956);
  if(pose==="Regional"){target.set(-12,2,-3);offset.set(11.5,34.5,30.36);}
  if(pose==="Close"){target.set(-12,2.6,7);offset.set(3.1,7.7,9.0);}
  if(pose==="Essos"){target.set(47,2.0,5);offset.set(9,16,21);}
  if(flightSeconds!==undefined){
    const keys=[{target:[-17,5,-26],offset:[3,21,24]},{target:[-12,2,7],offset:[8,13,16]},{target:[-8,2,16],offset:[4,9,12]},{target:[22,0,12],offset:[1,17,26]},{target:[47,2,5],offset:[7,11,17]},{target:[57,3,-9],offset:[8,19,23]}];
    const t=Math.min(.999999,Math.max(0,flightSeconds/30))*(keys.length-1),i=Math.floor(t),f=THREE.MathUtils.smoothstep(t-i,0,1);
    target.fromArray(keys[i].target).lerp(new THREE.Vector3().fromArray(keys[i+1].target),f);
    offset.fromArray(keys[i].offset).lerp(new THREE.Vector3().fromArray(keys[i+1].offset),f);
  }
  // Same vertical FOV as the game; portrait keeps the target visible without cropping a castle.
  camera.fov=38;const portrait=camera.aspect<.8 ? Math.min(1.8,.8/camera.aspect):1;
  camera.position.copy(target).addScaledVector(offset,portrait);camera.near=.05;camera.far=1800;camera.updateProjectionMatrix();camera.lookAt(target);
}
export { directions, skyMaterial };
export type { Look, Quality, Pose };

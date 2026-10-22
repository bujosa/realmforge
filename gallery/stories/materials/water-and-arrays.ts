import { waterEnvironment } from "../../../src/materials/WaterEnvironment";
import SurfaceFinish from "../../../src/materials/SurfaceFinish";
import * as THREE from "three";
import { oceanRings } from "../../../src/materials/OceanGeometry";
import { SurfaceArrays, surfaceArrayMaterial, terrainLayers, masonryLayers } from "../../../src/materials/SurfaceArrays";
import { registerStories } from "../../registry";
import { waterStudy } from "../../waterStudy";
for (const kind of ["terrain","masonry"] as const) for (const [layer,title] of (kind === "terrain" ? terrainLayers : masonryLayers).entries()) registerStories({
  id:`materials/${kind}-${layer}`,title:`CC0 ${title}`,category:"Materials",description:"Original production Poly Haven CC0 texture array, with bundled Basis transcoder. Standalone single-layer swatch; source splat shader is also included.",
  build({renderer}) {
    const assets = new SurfaceArrays(renderer); let ready = false,disposed = false;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5,40,24),new THREE.MeshStandardMaterial({color:"#83906a"}));
    void assets.load(kind).then(surfaces => { if (!disposed) { mesh.material.dispose(); mesh.material = surfaceArrayMaterial(surfaces,layer); ready = true; } }).catch(error => { if (!disposed) console.error("Surface array could not load",error); });
    return { object:mesh,ready:()=>ready,dispose:()=>{disposed=true;assets.dispose();} };
  },
});
registerStories({ id:"materials/animated-water",title:"Water · production waves & Fresnel",category:"Materials",build(){ const water=waterStudy(3,3); return {object:water.mesh,update:(_dt,time)=>water.update(time),dispose:water.dispose}; } });
registerStories({id:"materials/ocean-rings",title:"Ocean · adaptive concentric mesh",category:"Materials",description:"Original continuous ocean-ring topology, with the wireframe visible for inspection. Hosts centre and scale the surface around the camera.",
  build(){const rings=oceanRings({spacing:0.04,cells:16,levels:5});return {object:new THREE.Mesh(rings.geometry,new THREE.MeshStandardMaterial({color:"#7eb2b8",wireframe:true,side:THREE.DoubleSide}))};}
});
registerStories({id:"materials/water-environment",title:"Water · procedural radiance",category:"Materials",build({renderer}){const env=waterEnvironment(renderer,true);const material=new THREE.MeshStandardMaterial({color:"#a4cbd1",metalness:0.75,roughness:0.18,envMap:env.texture});return {object:new THREE.Mesh(new THREE.SphereGeometry(0.5,40,24),material),dispose:()=>env.dispose()};}});
registerStories({id:"materials/procedural-finish",title:"Wood & paper · procedural fallback",category:"Materials",build(){const object=new THREE.Group();const wood=new THREE.Mesh(new THREE.BoxGeometry(1,0.08,1),new THREE.MeshStandardMaterial({color:"#8b6844"}));const paper=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.01,0.8),new THREE.MeshStandardMaterial({color:"#c9b78e"}));paper.position.y=0.05;object.add(wood,paper);const finish=new SurfaceFinish(wood,paper);return {object,dispose:()=>finish.dispose()};}});

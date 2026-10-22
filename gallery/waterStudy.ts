import * as THREE from "three";
import { naturalWaterDeep, naturalWaterShallow, surfaceMaterial, type WaterUniforms } from "../src/materials/WaterMaterial";
/** Synthetic optical field replaces game-map coastline atlas, preserving the water shader. */
export function waterStudy(width: number, depth: number): { mesh: THREE.Mesh; update: (time: number) => void; dispose: () => void } {
  const field = new THREE.DataTexture(new Uint8Array([255,255,0,0]),1,1); field.needsUpdate = true;
  const uniforms: WaterUniforms = {
    waterField:{value:field},waterTime:{value:0},waterAmplitude:{value:1},waterStorm:{value:0},waterWinter:{value:0},waterDetail:{value:1},waterSubmerged:{value:0},waterSize:{value:new THREE.Vector2(width,depth)},waterBoardUnit:{value:0.2},waterShallow:{value:naturalWaterShallow.clone()},waterDeep:{value:naturalWaterDeep.clone()},
  };
  const geometry = new THREE.PlaneGeometry(width,depth,60,40); geometry.rotateX(-Math.PI/2);
  const mesh = new THREE.Mesh(geometry,surfaceMaterial(uniforms,true,"world")); mesh.userData.nonSolid = true;
  return { mesh,update: time => { uniforms.waterTime.value = time; },dispose: () => field.dispose() };
}

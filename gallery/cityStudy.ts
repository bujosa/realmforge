import * as THREE from "three";
import PhysicalCity from "../src/cities/settlements/PhysicalCity";
import PhysicalMaterial from "../src/cities/settlements/PhysicalMaterial";
import { physicalKitVariants } from "../src/cities/settlements/PhysicalKit";
import { physicalRecipes } from "../src/presets/physicalCities";
import KitPool from "../src/core/KitPool";
import type { StoryInstance } from "./registry";

/** Stable synthetic site: same recipe and dimensions, no map/streaming dependency. */
export function cityStudy(id: string, lod = "mid", tier: "high" | "balanced" = "balanced", streets = false): StoryInstance {
  const recipe = physicalRecipes.find(recipe => recipe.id === id);
  if (!recipe) throw new Error(`Unknown city recipe ${id}`);
  const material = new PhysicalMaterial();
  const pool = new KitPool(physicalKitVariants, false, undefined, material);
  const radius = recipe.radius / 50;
  const coastDistance = recipe.centre === "keep" ? 0 : recipe.centre.coast[1] / 50;
  const regionRadius = radius + coastDistance;
  const boundary: [number, number][] = [[-regionRadius, -regionRadius], [regionRadius, -regionRadius], [regionRadius, regionRadius], [-regionRadius, regionRadius]];
  const coastal = recipe.id !== "winterfell";
  const shore = radius * 0.65 + (recipe.centre === "keep" ? 0 : recipe.centre.coast[0] / 50);
  const city = new PhysicalCity({ recipe, host: recipe.hosts[0], tier, pool, boundary, reserves: [],
    castle: { x: 0, z: 0, hw: 0.3, hd: 0.3 },
    heightAt: () => 0, water: (_x, z) => coastal && z > shore,
    shore: (_x, z) => coastal ? (shore - z) * 50 : 10000,
  });
  const deadline = performance.now() + 15000;
  while (city.pending()) { city.advance(performance.now() + 10); if (performance.now() > deadline) { city.dispose(); pool.dispose(); throw new Error(`City build exceeded 15 s: ${id}`); } }
  // Fix the requested detail for the study instead of coupling it to the gallery eye.
  const rings = { near: lod === "near" ? 1e8 : 0, mid: lod === "far" ? 0 : 1e8, far: 1e8, hide: 1e9, triangles: 1e9 };
  const studyCamera = new THREE.PerspectiveCamera(35); studyCamera.position.set(0, 1, 0);
  city.update(studyCamera, rings, performance.now()); pool.flush();
  // Prefer a production street with nearby house fronts, away from the castle reserve.
  let walkStart: NonNullable<StoryInstance["navigation"]>["walkStart"];
  let score = Infinity;
  const plan = city.plan, origin = city.origin ?? { x: 0, z: 0 };
  if (plan) for (const street of plan.streets) for (let i=1;i<street.points.length;i++) {
    const a=street.points[i-1], b=street.points[i], length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if (length < 25) continue;
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    if (Math.hypot(origin.x+x/50,origin.z+z/50)<4) continue;
    const nearest=plan.houses.reduce((best,house)=>Math.min(best,Math.hypot(house.x-x,house.z-z)),Infinity);
    if (nearest<score && nearest>street.width/2) {
      score=nearest;
      walkStart={position:[origin.x+x/50,0.036,origin.z+z/50],target:[origin.x+(x+(b[0]-a[0])/length*50)/50,0.036,origin.z+(z+(b[1]-a[1])/length*50)/50]};
    }
  }
  if (streets && plan) {
    const vertices:number[]=[];
    for(const street of plan.streets) for(let i=1;i<street.points.length;i++) {
      const a=street.points[i-1],b=street.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]); if(!length)continue;
      const dx=(b[1]-a[1])/length*street.width/2,dz=-(b[0]-a[0])/length*street.width/2;
      const point=(x:number,z:number)=>[origin.x+x/50,0.001,origin.z+z/50];
      vertices.push(...point(a[0]-dx,a[1]-dz),...point(b[0]-dx,b[1]-dz),...point(b[0]+dx,b[1]+dz),...point(a[0]-dx,a[1]-dz),...point(b[0]+dx,b[1]+dz),...point(a[0]+dx,a[1]+dz));
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const road=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:"#a99a7b",roughness:1,side:THREE.DoubleSide}));pool.group.add(road);
  }
  return { object: pool.group, navigation: { metresPerUnit:50, walkStart }, update: () => { material.setClock(performance.now()); }, dispose: () => { city.dispose(); pool.dispose(); } };
}

import * as THREE from "three";
import { registerStories } from "../registry";
import { shape } from "../../src/props/ComposedShapes";
import { DRAWABLE_VARIANTS } from "../../src/props/ComposedVariants";
import { titleCase } from "../../src/presets/demo";
for(const variant of DRAWABLE_VARIANTS) registerStories({
  id:`props/composed-${variant}`,title:`${titleCase(variant)} · composer module`,category:"Props",description:"Original production composer fallback shape. Normalized footprint and height; host scales by physical w × h × d. This placeholder is intentionally retained beside the higher-detail kit so every source module can be inspected.",
  build:()=>({object:new THREE.Mesh(shape(variant).clone(),new THREE.MeshStandardMaterial({vertexColors:true,color:"#aeaa8c",roughness:0.9,side:THREE.DoubleSide}))}),
});

import * as THREE from "three";
import { registerStories } from "../../registry";
import { floraGeometry, floraGrassGeometry, floraGroupGeometry, floraImpostorGeometry } from "../../../src/nature/FloraGeometry";
import type { FloraSpecies } from "../../../src/nature/FloraPlacement";
import { titleCase } from "../../../src/presets/demo";
const material=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85,side:THREE.DoubleSide});
for(const species of ["pine","birch","oak","cypress","olive","palm","willow","orchard","weirwood","reed"] as FloraSpecies[]) registerStories({
  id:`nature/flora-${species}`,title:`${titleCase(species)} · physical flora`,category:"Nature",description:"Original production flora sculpt, normalized to unit height; hosts set physical metre height. Both near and far variants are inspectable.",controls:{near:{type:"boolean",label:"Near detail",default:true}},build:({values})=>({object:new THREE.Mesh(floraGeometry(species,Boolean(values.near)),material())}),
});
for (const [id,build] of [["grass",floraGrassGeometry],["canopy-group",floraGroupGeometry],["copse-impostor",floraImpostorGeometry]] as const) registerStories({id:`nature/${id}`,title:titleCase(id),category:"Nature",build:()=>({object:new THREE.Mesh(build(),material())})});

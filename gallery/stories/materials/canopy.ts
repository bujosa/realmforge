import * as THREE from "three";
import { registerStories } from "../../registry";
import { floraCanopyTextures } from "../../../src/nature/FloraGeometry";

registerStories({id:"materials/canopy-atlas",title:"Forest canopy · procedural atlas",category:"Materials",build(){ const textures=floraCanopyTextures();const m=new THREE.MeshStandardMaterial({color:"#72905b",map:textures?.colour,normalMap:textures?.normal,alphaTest:0.35,side:THREE.DoubleSide});return {object:new THREE.Mesh(new THREE.PlaneGeometry(1,1),m),dispose:()=>{textures?.colour.dispose();textures?.normal.dispose();}}; }});

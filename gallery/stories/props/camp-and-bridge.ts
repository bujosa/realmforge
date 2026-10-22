import * as THREE from "three";
import { registerStories } from "../../registry";

import bridgeGeometry from "../../../src/props/BridgeGeometry";
import { campGeometry } from "../../../src/props/CampGeometry";
import { titleCase } from "../../../src/presets/demo";
const material=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85,side:THREE.DoubleSide});
registerStories({id:"props/stone-bridge",title:"Stone bridge · arched crossing",category:"Props",controls:{physical:{type:"boolean",label:"Physical bridge",default:true}},build:({values})=>({object:new THREE.Mesh(bridgeGeometry(1.6,1.1,[[0,0,0],[0,0,0]],Boolean(values.physical)),material())})});
for(const kind of ["hearth","camp","person"] as const)registerStories({id:`props/${kind}`,title:titleCase(kind),category:"Props",build:()=>({object:new THREE.Mesh(campGeometry(kind),material())})});

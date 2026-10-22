import * as THREE from "three";
import { dockGeometry, boatGeometry } from "../../../src/props/HarborProps";
import { registerStories } from "../../registry";
for (const kind of ["pier-timber","quay-stone","skiff"] as const) registerStories({ id:`props/${kind}`,title:kind === "skiff" ? "Coastal fishing skiff" : kind === "pier-timber" ? "Timber pier" : "Stone quay",category:"Props",build:()=>({object:new THREE.Mesh(kind === "skiff" ? boatGeometry() : dockGeometry(kind),new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85,side:THREE.DoubleSide}))}) });

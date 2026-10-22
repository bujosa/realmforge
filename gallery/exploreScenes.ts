import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cityStudy } from "./cityStudy";
import { seatObject } from "./stories/kit";
import { castleGeometry } from "../src/castles/castles";
import { castleStyle } from "../src/castles/castleStyles";
import { physicalRecipes } from "../src/presets/physicalCities";
import { natureGeometry } from "../src/nature/nature";
import { floraGeometry } from "../src/nature/FloraGeometry";
import { livestockGeometry } from "../src/nature/livestock";
import { castleSettlementGeometry } from "../src/cities/CastleSettlement";
import { boatGeometry, dockGeometry } from "../src/props/HarborProps";
import { resourceGeometry } from "../src/props/ResourceProps";
import bridgeGeometry from "../src/props/BridgeGeometry";
import { campGeometry } from "../src/props/CampGeometry";
import CastleMaterial from "../src/materials/CastleMaterial";
import CastleLife from "../src/castles/CastleLife";
import { waterStudy } from "./waterStudy";
import type { StoryInstance } from "./registry";
import { visualBounds } from "./bounds";

const surface = () => new THREE.MeshStandardMaterial({ vertexColors:true,roughness:0.88,side:THREE.DoubleSide });
function mesh(geometry: THREE.BufferGeometry): THREE.Mesh { return new THREE.Mesh(geometry,surface()); }
function instances(group: THREE.Group, geometry: THREE.BufferGeometry, points: [number,number,number,number][]): void {
  const batch = new THREE.InstancedMesh(geometry,surface(),points.length); const transform = new THREE.Object3D();
  points.forEach(([x,y,z,scale],i)=>{transform.position.set(x,y,z);transform.scale.setScalar(scale);transform.rotation.y=i*2.39996;transform.updateMatrix();batch.setMatrixAt(i,transform.matrix);});
  batch.computeBoundingSphere(); group.add(batch);
}
function patch(group: THREE.Group, width: number, depth: number, colour: string, z=0): void {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(width,0.14,depth),new THREE.MeshStandardMaterial({color:colour,roughness:1}));
  ground.position.set(0,-0.07,z);group.add(ground);
}
function streetVillage(group: THREE.Group, x: number, z: number, count=12): void {
  const parts: THREE.BufferGeometry[] = [];
  for(let i=0;i<count;i++) {
    const house = castleSettlementGeometry("village-house",true); house.scale(0.8,0.8,0.8);
    house.rotateY(i%2 ? -Math.PI/2 : Math.PI/2); house.translate(x+(i%2 ? 0.22 : -0.22),0,z-Math.floor(i/2)*0.36);parts.push(house);
  }
  const merged = mergeGeometries(parts); parts.forEach(g=>g.dispose());
  if (merged) group.add(new THREE.Mesh(merged,new CastleMaterial()));
  const lane=new THREE.Mesh(new THREE.PlaneGeometry(0.19,count*0.18+0.4),new THREE.MeshStandardMaterial({color:"#ab9874",roughness:1}));lane.rotation.x=-Math.PI/2;lane.position.set(x,0.0005,z-count*0.09+0.2);group.add(lane);
}
/** Gallery scene adapter: original production geometry, synthetic public site and dressing. */
export function exploreSeat(id: string, camera: THREE.PerspectiveCamera, detailed=true, lifeEnabled=true): StoryInstance {
  const object=new THREE.Group(), disposers:(()=>void)[]=[], updates:((dt:number,t:number)=>void)[]=[];
  const recipe=physicalRecipes.find(recipe=>recipe.id===id);
  let radius=5,shore=4;
  let cityNavigation: StoryInstance["navigation"];
  if (recipe) {
    const city=cityStudy(id,detailed ? "near" : "mid","balanced",true);cityNavigation=city.navigation;object.add(city.object);disposers.push(()=>city.dispose?.());updates.push((dt,t)=>city.update?.(dt,t));
    radius=recipe.radius/50;shore=radius*0.65+(recipe.centre==="keep"?0:recipe.centre.coast[0]/50);
  }
  const castleKind=id==="lannisport" ? "casterly-rock" : id==="gulltown" ? "the-eyrie" : id;
  const seat = castleKind === "iron-bank" ? new THREE.Group() : seatObject(castleKind,castleStyle(castleKind),detailed);
  if (castleKind === "iron-bank") seat.add(new THREE.Mesh(castleGeometry(castleKind,castleStyle(castleKind),0,detailed),new CastleMaterial()));
  object.add(seat);
  const seatBox=visualBounds(seat);radius=Math.max(radius,seatBox.getSize(new THREE.Vector3()).length()*0.65);
  if (!recipe) shore=radius*0.78;
  const coastal=id!=="winterfell" && !["riverrun","harrenhal","highgarden","moat-cailin","the-eyrie","the-reach","the-vale-of-arryn","yronwood"].includes(id);
  const size=radius*2.5+5;
  patch(object,size,coastal ? size/2+shore : size,id==="sunspear" || id==="pentos" ? "#b49b70" : id==="winterfell" ? "#a4b0a0" : "#718160",coastal ? (shore-size/2)/2 : 0);
  if (coastal) {
    const water=waterStudy(size,size*0.7);water.mesh.position.set(0,-0.025,shore+size*0.35);object.add(water.mesh);disposers.push(water.dispose);updates.push((_dt,t)=>water.update(t));
    const quays=3; for(let i=0;i<quays;i++) {
      const dock=mesh(dockGeometry("pier-timber"));dock.scale.set(0.09,0.25,0.9);dock.position.set(-0.5+i*0.45,-0.02,shore+0.38);object.add(dock);
      const boat=mesh(boatGeometry());boat.position.set(-0.4+i*0.45,-0.022,shore+0.7);object.add(boat);
    }
  }
  // A small inhabited approach provides an immediately discoverable walkable lane.
  const villageX=recipe ? -radius*0.87 : -radius*0.52, villageZ=-radius*0.6;
  streetVillage(object,villageX,villageZ,16);
  const trees:[number,number,number,number][]=[],sheep:[number,number,number,number][]=[];
  for(let i=0;i<70;i++) {
    const angle=i*2.39996;const r=radius*1.1+(i%7)*0.13;const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    if (!coastal || z<shore-0.2) trees.push([x,0,z,0.2+(i%4)*0.035]);
  }
  instances(object,floraGeometry(id==="sunspear" || id==="pentos" ? "palm" : id==="winterfell" ? "pine" : "oak",detailed),trees);
  for(let i=0;i<9;i++) sheep.push([villageX-0.9+(i%3)*0.1,0,villageZ-Math.floor(i/3)*0.13,1]);
  instances(object,livestockGeometry(),sheep);
  const barrels:[number,number,number,number][]=[];for(let i=0;i<10;i++)barrels.push([villageX+0.3,0,villageZ-i*0.25,0.2]);instances(object,resourceGeometry("barrel"),barrels);
  const person=mesh(campGeometry("person"));person.position.set(villageX+0.07,0,villageZ-0.3);object.add(person);
  const life=new CastleLife(object);disposers.push(()=>life.dispose());
  if(lifeEnabled)life.update([{kind:"stronghold",anchor:new THREE.Vector3(villageX,0,villageZ),scale:0.8,torches:[new THREE.Vector3(villageX-0.12,0.11,villageZ),new THREE.Vector3(villageX+0.12,0.11,villageZ)],chimney:new THREE.Vector3(villageX-0.22,0.23,villageZ-0.4)}],true,true);
  return { object,navigation:cityNavigation?.walkStart ? cityNavigation : {metresPerUnit:50,walkStart:{position:[villageX,0.036,villageZ+0.28],target:[villageX,0.04,villageZ-2]}},update:(dt,t)=>{updates.forEach(update=>update(dt,t));life.render(t*1000,false,camera);},dispose:()=>disposers.forEach(dispose=>dispose()) };
}

/** Synthetic sampler: production relative sizes, no claim to reproduce a geographic map. */
export function exploreSampler(camera: THREE.PerspectiveCamera): StoryInstance {
  const object=new THREE.Group();
  // Continuous slope and meandering river; the lower-right quarter opens onto the sea.
  const height=(x:number,z:number):number=> {
    if(z>7)return -0.5;
    const river=Math.abs(x-1.5*Math.sin(z*0.3));if(river<0.45)return -0.16;
    return Math.max(0,2.7*Math.exp(-((x+7)**2+(z+8)**2)/16)+1.8*Math.exp(-((x-8)**2+(z+9)**2)/9)-0.1);
  };
  const geometry=new THREE.PlaneGeometry(28,28,100,100);geometry.rotateX(-Math.PI/2);
  const position=geometry.getAttribute("position"),colors:number[]=[];
  for(let i=0;i<position.count;i++) {const x=position.getX(i),z=position.getZ(i),h=height(x,z);position.setY(i,h);const color=new THREE.Color(h>1.6?"#a7a69c":h>0.3?"#727c60":z>6.4?"#bdab7d":"#718862");color.multiplyScalar(0.93+Math.sin(x*7+z*5)*0.04);colors.push(color.r,color.g,color.b);}
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();object.add(mesh(geometry));
  const water=waterStudy(28,28);water.mesh.position.y=-0.045;object.add(water.mesh);
  const seats=[{id:"winterfell",x:-6,z:-2},{id:"highgarden",x:7,z:1},{id:"dragonstone",x:8,z:6},{id:"riverrun",x:-3,z:4}];
  for(const {id,x,z} of seats) {const seat=seatObject(id,castleStyle(id),false);seat.position.set(x,height(x,z),z);object.add(seat);}
  streetVillage(object,-4,1.5,20);
  const bridge=mesh(bridgeGeometry(1.6,1.1,[[0,0,0],[0,0,0]],true));bridge.position.set(0,0,0);object.add(bridge);
  const trees:[number,number,number,number][]=[];
  for(let i=0;i<230;i++) {const x=-12+((i*37)%239)/10,z=-12+((i*61)%181)/10;if(Math.abs(x-1.5*Math.sin(z*0.3))<0.8 || seats.some(s=>Math.hypot(s.x-x,s.z-z)<2) || Math.hypot(x+4,z)<2.5)continue;trees.push([x,height(x,z),z,0.2+i%6*0.035]);}
  instances(object,floraGeometry("pine",false),trees);
  instances(object,livestockGeometry(),Array.from({length:15},(_,i)=>[-5.1+i%5*0.1,0,1-i*0.03,1] as [number,number,number,number]));
  const cliffs=mesh(natureGeometry("cliff"));cliffs.scale.set(3,2,3);cliffs.position.set(10,0,6.8);object.add(cliffs);
  const life=new CastleLife(object);life.update([{kind:"village-house",anchor:new THREE.Vector3(-4,0,1.5),scale:1,torches:[new THREE.Vector3(-4.12,0.1,1.5)],chimney:new THREE.Vector3(-4.22,0.23,1.1)}],true,true);
  return {object,navigation:{walkStart:{position:[-4,0.036,1.78],target:[-4,0.04,-1]}},update:(_dt,t)=>{water.update(t);life.render(t*1000,false,camera);},dispose:()=>{water.dispose();life.dispose();}};
}

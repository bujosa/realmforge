import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { castleGeometry } from "../castles/castles";
import { castleSettlementGeometry } from "../cities/CastleSettlement";
import { paintGeometry } from "../core/sculpt";
import { heightAt, hash } from "./directions";

/** Reuses the sampler's production castle/home pieces; neutral city additions are original. */
export function settlements(high:boolean):THREE.Group {
  const group=new THREE.Group();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91});
  const add=(g:THREE.BufferGeometry,x:number,z:number,s:number):void=>{g.scale(s,s,s);g.translate(x,heightAt(x,z),z);const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;group.add(m);};
  add(castleGeometry("winterfell","north",0,high),-12,7,7.0);
  add(castleGeometry("riverrun","riverlands",0,high),-7,-12,4.0);
  const homes:THREE.BufferGeometry[]=[];
  for(let i=0;i<100;i++) {
    const row=Math.floor(i/10),col=i%10,x=-11.5+col*.76+hash(i,2)*.33+Math.sin(row*.7)*.3,z=13+row*.68+hash(i,8)*.22;
    const g=castleSettlementGeometry("village-house",high);g.scale(5.0,5.0,5.0);g.rotateY(i%2?Math.PI:0);g.translate(x,heightAt(x,z),z);homes.push(g);
  }
  const merged=mergeGeometries(homes);homes.forEach(g=>g.dispose());if(merged){const m=new THREE.Mesh(merged,material);m.castShadow=true;m.receiveShadow=true;group.add(m);}
  // Harbor city: warm plaster, terracotta roofs, courtyards and a domed civic quarter.
  const parts:THREE.BufferGeometry[]=[];
  const part=(g:THREE.BufferGeometry,c:string,x:number,y:number,z:number):void=>{
    const p=g.index?g.toNonIndexed():g;if(p!==g)g.dispose();p.deleteAttribute("uv");paintGeometry(p,c);p.translate(x,y,z);parts.push(p);
  };
  for(let i=0;i<180;i++){
    const a=i*2.39996,r=Math.sqrt(i/180)*6.0,x=47+Math.cos(a)*r,z=5+Math.sin(a)*r;
    if(Math.abs(x-47)<.5||Math.abs(z-5)<.4)continue;
    const base=heightAt(x,z),h=.35+hash(i,5)*.65,w=.38+hash(i,3)*.24;
    part(new THREE.BoxGeometry(w,h,w*.88),i%3?"#c9bd9a":"#d8cba8",x,base+h*.5,z);
    if(i%4)part(new THREE.ConeGeometry(w*.83,.28,4).rotateY(Math.PI/4),"#9a674b",x,base+h+.14,z);
    else part(new THREE.SphereGeometry(w*.48,high?12:8,high?6:4,0,Math.PI*2,0,Math.PI/2),"#7b9991",x,base+h,z);
  }
  for(const [x,z] of [[46,4],[48,4],[46,6],[48,6]]){
    const h=heightAt(x,z);part(new THREE.CylinderGeometry(.16,.2,2.5,8),"#c7bfa6",x,h+1.25,z);part(new THREE.ConeGeometry(.24,.6,8),"#668b85",x,h+2.8,z);
  }
  part(new THREE.BoxGeometry(1.4,1.4,1.8),"#d0c5a6",47,2.45,5);
  part(new THREE.SphereGeometry(.74,16,8,0,Math.PI*2,0,Math.PI/2),"#7e9e93",47,3.15,5);
  const city=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const cityMesh=new THREE.Mesh(city,material);cityMesh.castShadow=true;cityMesh.receiveShadow=true;group.add(cityMesh);
  // Contoured lanes and quays meet the ground; no floating display plinths.
  const roads:THREE.BufferGeometry[]=[];
  const lane=(x1:number,z1:number,x2:number,z2:number,width:number):void=>{
    const steps=40,verts:number[]=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps,x=THREE.MathUtils.lerp(x1,x2,t),z=THREE.MathUtils.lerp(z1,z2,t),a=Math.atan2(z2-z1,x2-x1)+Math.PI/2;
      for(const side of [-1,1]){const px=x+Math.cos(a)*width*side,pz=z+Math.sin(a)*width*side;verts.push(px,heightAt(px,pz)+.023,pz);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));const indices:number[]=[];
    for(let i=0;i<steps;i++){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}g.setIndex(indices);g.computeVertexNormals();roads.push(g);
  };
  lane(-12,9,-8,15,.15);lane(-7.8,12,-7.8,21,.17);lane(40,5,53,5,.21);lane(47,-1,47,11,.2);
  const lanes=mergeGeometries(roads)!;roads.forEach(g=>g.dispose());group.add(new THREE.Mesh(lanes,new THREE.MeshStandardMaterial({color:"#a89a75",roughness:1,side:THREE.DoubleSide})));
  return group;
}

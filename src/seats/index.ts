import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { shipGeometry } from "../pieces/geometry/ships";
import { noise, hash } from "../lookdev/directions";

export type SeatKind = "capital" | "island" | "north";
export type SeatVariant = "A" | "B";
export type SeatPose = "Overview" | "Regional" | "Close";
export const seatNotes: Record<SeatKind, {title:string; iconic:string; variants:[string,string]}> = {
  capital:{title:"Capital of the Three Hills",iconic:"Three unequal crowns: a red royal citadel above the bay, seven spires around a luminous dome, and an open, ruined dome. Roofs climb the land between them.",variants:["A · Steep crown city","B · Harbour metropolis"]},
  island:{title:"Dragon-carved Island Keep",iconic:"An inhabited basalt precipice. A massive stone drum, crouching winged carvings and unequal needle towers merge into the volcanic island.",variants:["A · Dragon towers","B · Carved dragon ridge"]},
  north:{title:"Granite Seat of the North",iconic:"Two granite wall lines separated by a moat, a broken tower, glass gardens and a pale tree within a dark grove. Snow reveals the battlements.",variants:["A · Winter enclosure","B · Long northern ward"]},
};
type Part = {p:THREE.Vector3;s:THREE.Vector3;q:THREE.Quaternion;c:THREE.Color};
/** All study coordinates are in 50 metre units, independent of the host's world scaling. */
export function createSeatStudy(kind:SeatKind,variant:SeatVariant="B"):{object:THREE.Group;heightAt:(x:number,z:number)=>number;focus:THREE.Vector3} {
  const root=new THREE.Group(),b=variant==="B",north=kind==="north",island=kind==="island";
  const buckets=new Map<string,{geometry:THREE.BufferGeometry;parts:Part[]}>();
  const geometries:Record<string,THREE.BufferGeometry>={
    ring:new THREE.CylinderGeometry(1,1,1,32,1,true),sphere:new THREE.SphereGeometry(1,12,8),basalt:new THREE.CylinderGeometry(.85,1,1,6),
    box:new THREE.BoxGeometry(1,1,1),drum:new THREE.CylinderGeometry(1,1,1,20),cone:new THREE.ConeGeometry(1,1,12),
    dome:new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),rock:new THREE.IcosahedronGeometry(1,1),
    tail:new THREE.TorusGeometry(1,.14,6,24,Math.PI*1.65).rotateX(Math.PI/2),
    crown:new THREE.TorusGeometry(1,.09,5,32).rotateX(Math.PI/2),
  };
  const roofShape=new THREE.Shape();roofShape.moveTo(-.5,0);roofShape.lineTo(0,1);roofShape.lineTo(.5,0);roofShape.closePath();
  geometries.roof=new THREE.ExtrudeGeometry(roofShape,{depth:1,bevelEnabled:false}).translate(0,0,-.5);
  const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.lineTo(.45,1);wingShape.lineTo(1.6,.72);wingShape.lineTo(1.12,.35);wingShape.lineTo(.82,.14);wingShape.closePath();
  geometries.wing=new THREE.ExtrudeGeometry(wingShape,{depth:.13,bevelEnabled:false});
  geometries.wingLeft=geometries.wing.clone().rotateY(Math.PI);
  const stone=island?"#28363b":north?"#858e8b":"#bd9d7b",roof=north?"#c9d2ce":island?"#242f34":"#92523b";
  function part(shape:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,angle=0):void {
    const key=shape;let batch=buckets.get(key);if(!batch){batch={geometry:geometries[shape],parts:[]};buckets.set(key,batch);}
    batch.parts.push({p:new THREE.Vector3(x,y,z),s:new THREE.Vector3(w,h,d),q:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),c:new THREE.Color(color)});
  }
  const peak=(x:number,z:number,cx:number,cz:number,r:number,h:number)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/r);
  const heightAt=(x:number,z:number):number=>{
    if(island){const r=Math.hypot(x*.92,z*1.12),a=Math.atan2(z,x),edge=8.3+Math.sin(a*3)*.85+Math.cos(a*7)*.4;const cove=peak(x,z,6.5,5,3,2.6);return THREE.MathUtils.lerp(-1,3.7+noise(x*.7,z*.7)*.5+peak(x,z,-4,-5,7,b?5.8:4.6)+peak(x,z,3,-4,8,1.9),1-THREE.MathUtils.smoothstep(r+cove,edge-.8,edge+.5));}
    if(north){
      const stretch=b?1.25:1;
      const outer=Math.abs(x)<7.35&&z> -7.35*.7&&z<7.35*.7*stretch;
      const inner=Math.abs(x)<5.82&&z> -5.82*.7&&z<5.82*.7*stretch;
      if(outer&&!inner&&!(Math.abs(x)<.45&&z>0))return .16;
      return .42+noise(x*.13,z*.13)*.42+peak(x,z,-18,-24,110,2);
    }
    const shore=16-z+Math.sin(x*.25)*.7-Math.max(0,x-7)*.8+(b?Math.sin(x*.72)*.48+Math.sin(x*.13+1)*1.1:0);
    let h=.45+peak(x,z,7,-1,b?17:12,b?5.4:6.8)+peak(x,z,-6,-5,b?17:12,b?3.7:4.7)+peak(x,z,-4,7,b?14:10,b?3:3.8)+noise(x*.45,z*.45)*.16;
    // A steep coastal escarpment puts the royal crown directly above the bay.
    h=THREE.MathUtils.lerp(-.7,h,1-THREE.MathUtils.smoothstep(x,b?10+Math.sin(z*.6)*.7:10.1,b?11.2+Math.sin(z*.6)*.7:11.2));
    h=THREE.MathUtils.lerp(-.65,h,THREE.MathUtils.smoothstep(shore,0,2));
    // A river mouth feeds the bay beside the western city wall.
    const river=Math.abs(x-(-17+Math.sin(z*.19)*1.4));
    return Math.min(h,THREE.MathUtils.lerp(-.4,h,THREE.MathUtils.smoothstep(river,1.2,2.3)));
  };
  const terrain=new THREE.PlaneGeometry(150,150,b?270:230,b?270:230).rotateX(-Math.PI/2),pos=terrain.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=heightAt(x,z);pos.setY(i,y);
    const c=new THREE.Color(island?(y>2?"#343e3c":"#202c2d"):north?(noise(x*.3,z*.3)>.55?"#d6ded7":"#96a89c"):y>4?"#7f8770":y>1?"#697c4e":"#8a956c");
    if(b&&north){
      const slope=Math.hypot(heightAt(x+.2,z)-heightAt(x-.2,z),heightAt(x,z+.2)-heightAt(x,z-.2))/.4;
      const snow=THREE.MathUtils.smoothstep(.40+noise(x*.055,z*.055)*.35+y*.035-slope*.45,.38,.78);
      c.set("#809389").lerp(new THREE.Color("#e0e5df"),snow);
      c.multiplyScalar(.94+noise(x*.18,z*.18)*.08);
    }else c.multiplyScalar(.82+noise(x*1.6,z*1.6)*.27);
    colors.push(c.r,c.g,c.b);
  }
  terrain.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  const groundMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});root.add(new THREE.Mesh(terrain,groundMat));
  // World-space mineral grain and mortar bands; no downloaded textures or shader permutations on motion.
  const material=new THREE.MeshStandardMaterial({color:"white",roughness:b&&island?.56:.92,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader="varying vec3 seatWorld;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
      vec4 seatP=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      seatP=instanceMatrix*seatP;
      #endif
      seatWorld=(modelMatrix*seatP).xyz;`);
    shader.fragmentShader="varying vec3 seatWorld;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      float grit=fract(sin(dot(floor(seatWorld*140.0),vec3(17.3,41.1,91.7)))*43758.54);
      float mortar=smoothstep(.025,.08,fract(seatWorld.y*16.0));
      float erosion=sin(seatWorld.x*33.0+sin(seatWorld.z*21.0))*sin(seatWorld.y*29.0+seatWorld.z*13.0);
      diffuseColor.rgb*=mix(.89,1.09,grit)*mix(.90,1.0,mortar)*(1.0+erosion*.055);`);
  };material.customProgramCacheKey=()=>"seat-mineral-v2";
  function block(x:number,y:number,z:number,w:number,h:number,d:number,c=stone,a=0){part("box",x,y+h/2,z,w,h,d,c,a);}
  function merlons(x:number,z:number,y:number,r:number,c=stone){for(let i=0;i<12;i++){const a=i*Math.PI/6;block(x+Math.cos(a)*r,y,z+Math.sin(a)*r,.12,.18,.13,c,a);}}
  function tower(x:number,z:number,y:number,r:number,h:number,c=stone,cap=true){
    if(b){const foot=Math.min(y,...[0,1,2,3,4,5,6,7].map(i=>heightAt(x+Math.cos(i*Math.PI/4)*r,z+Math.sin(i*Math.PI/4)*r)))-.06;h+=y-foot;y=foot;}
    part("drum",x,y+h/2,z,r,h,r,c);part("drum",x,y+h-.15,z,r*1.12,.25,r*1.12,c);merlons(x,z,y+h,r,c);if(cap)part("cone",x,y+h+.34,z,r*1.1,.72,r*1.1,roof);if(north)part("drum",x,y+h+.01,z,r*1.09,.035,r*1.09,"#e0e5de");for(let i=0;i<3;i++)block(x,y+.4+i*h/3,z+r+.008,.055,.19,.015,"#293335");}
  function wall(points:number[][],h:number,w:number,c=stone){
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],[xx,zz]=points[(i+1)%points.length],len=Math.hypot(xx-x,zz-z),a=Math.atan2(xx-x,zz-z),count=Math.ceil(len/.32);
      // Short stepped sections follow the rendered hill instead of bridging a flat foundation.
      for(let j=0;j<count;j++){const f=(j+.5)/count,px=x+(xx-x)*f,pz=z+(zz-z)*f,y=heightAt(px,pz);
        if(b&&((kind==="capital"&&((Math.abs(px)<.43&&pz>13.3)||(Math.abs(px+14)<.2&&Math.abs(pz)<.45)))||(north&&Math.abs(px)<.45&&pz>3)))continue;
        block(px,y-.12,pz,w,h+.12,len/count+.025,c,a);block(px,y+h,pz,w*1.15,.18,.16,north?"#e0e6df":c,a);}
      tower(x,z,heightAt(x,z),w*1.65,h+.5,c,false);
    }
  }
  // Continuous fitted ribbons share one geometry, including their joins on steep slopes.
  const paving:number[]=[],pavingColors:number[]=[];
  function route(points:number[][],width:number,color:string,raised=.035){
    const c=new THREE.Color(color);
    for(let i=0;i<points.length-1;i++){
      const [x,z]=points[i],[xx,zz]=points[i+1],length=Math.hypot(xx-x,zz-z),n=Math.max(1,Math.ceil(length/.12));
      const dx=(zz-z)/length*width/2,dz=-(xx-x)/length*width/2;
      for(let j=0;j<n;j++){
        const a=[x+(xx-x)*j/n,z+(zz-z)*j/n],bb=[x+(xx-x)*(j+1)/n,z+(zz-z)*(j+1)/n];
        const v=[[a[0]+dx,a[1]+dz],[bb[0]+dx,bb[1]+dz],[bb[0]-dx,bb[1]-dz],[a[0]-dx,a[1]-dz]];
        if(kind==="capital"&&v.some(([px,pz])=>heightAt(px,pz)<.04))continue;
        for(const k of [0,1,2,0,2,3]){const [px,pz]=v[k];paving.push(px,heightAt(px,pz)+raised,pz);pavingColors.push(c.r,c.g,c.b);}
      }
    }
  }
  const streets:number[][][]=[],squares=[[-1,2],[3,8],[-9,0]];
  if(b&&kind==="capital"){
    for(const [cx,cz] of [[7,-1],[-6,-5],[-4,7]])for(const r of [2.4,3.6,4.8]){
      const ring=Array.from({length:100},(_,i)=>{const a=i/99*Math.PI*2;return [cx+Math.cos(a)*r,cz+Math.sin(a)*r*.87];}).filter(([x,z])=>x<9.7&&Math.abs(z)<12.5);
      streets.push(ring);route(ring,.17,"#b4aa8c");
    }
    for(const path of [[[0,14],[0,9],[-1,2],[-2,-2],[-6,-5]],[[7,-1],[4,1],[-1,2],[-9,0],[-14,0]],[[-4,7],[-1,6],[0,9],[3,8],[6,11],[5,15]]]){streets.push(path);route(path,.32,"#bdb192");}
  }
  function nearStreet(x:number,z:number){return streets.some(path=>path.some((p,i)=>{
    if(!i)return false;const a=path[i-1],dx=p[0]-a[0],dz=p[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<.24;
  }))||squares.some(([xx,zz])=>Math.abs(x-xx)<.8&&Math.abs(z-zz)<.65);}
  function home(x:number,z:number,s=1,c=stone){const y=heightAt(x,z);if(b&&!north&&y<.08)return;const h=(.16+hash(x,z)*.22)*s,w=.22*s,d=.42*s,a=Math.floor(hash(z,x)*4)*Math.PI/2;block(x,y,z,w,h,d,c,a);part("roof",x,y+h,z,w*1.2,.18*s,d*1.14,roof,a);block(x+.08*s,y+h,z,.05*s,.25*s,.05*s,c,a);
    if(b&&north){
      part("roof",x,y+h+.035,z,w*1.21,.18*s,d*1.15,"#e6e9e1",a);
      if(hash(x+2,z)>.72)for(let j=0;j<4;j++)part("sphere",x+.08*s+j*.045,y+h+.27+j*.13,z+j*.018,.04+j*.018,.10,.04+j*.018,["#909c98","#a0aca6","#afbab3","#bdc7bf"][j]);
    }
  }
  function grove(x:number,z:number,count:number,snow=false){for(let i=0;i<count;i++){const a=hash(i,17)*Math.PI*2,r=Math.sqrt(hash(i,11))*3.3,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,y=heightAt(xx,zz),h=.4+hash(i,2)*.65;if(b&&!north&&y<.08)continue;block(xx,y,zz,.07,h,.07,"#625c49");part("cone",xx,y+h*.82,zz,.28,h,.28,snow?"#5b6b60":"#344b34");}}
  if(kind==="capital"){
    const outline=b?[[-14,-7],[-10,-12],[-2,-13],[6,-10],[10,-5],[10,4],[8,11],[2,14],[-8,13],[-14,6]]:[[-12,-7],[-7,-11],[0,-10],[7,-7],[10,-3],[10,3],[4,10],[-3,12],[-10,8],[-13,1]];wall(outline,.7,.22);
    for(let ix=-25;ix<=25;ix++)for(let iz=-23;iz<=23;iz++){const x=ix*.49+(hash(ix,iz)-.5)*.35,z=iz*.49+(hash(iz,ix)-.5)*.3;if((b&&nearStreet(x,z))||(x*x/(b?164:133)+z*z/(b?145:107))>1||Math.abs(x)<.35||Math.abs(z-2)<.3||[[7,-1,2.1],[-6,-5,1.8],[-4,7,2.0]].some(([px,pz,r])=>Math.hypot(x-px,z-pz)<r))continue;home(x,z,.8+hash(ix,iz)*.6,["#b9aa8d","#a99475","#c4b394"][Math.floor(hash(ix+9,iz)*3)]);}
    const cy=heightAt(7,-1);
    // Individual foundations embed into the crown; there is no broad display plinth.
    const royal=[[4.8,-3],[8.7,-3.5],[9.4,1],[5,1.2]];wall(royal,1.15,.22,b?"#a85740":"#a66d54");
    block(7,cy-1.1,-1,1.65,3.2,1.7,b?"#a95c43":"#ae755c");block(7,cy+2.1,-1,1.8,.18,1.85,"#c18e71");
    for(const [x,z,h]of [[6,-2,2.8],[8,-2,3.3],[8,0,2.65],[6,0,2.3]])tower(x,z,heightAt(x,z)-.12,.3,h,b?"#a25840":"#ab7058");
    if(b){
      for(let j=0;j<3;j++)for(let i=0;i<4;i++){
        const x=6.42+i*.37,yy=cy-.25+j*.7;block(x,yy,-.137,.09,.28,.025,"#34302b");block(x-.025,yy-.035,-.12,.14,.04,.04,"#c39270");
      }
      for(const x of [6.22,7.78])block(x,cy-.8,-.10,.18,2.65,.25,"#995039");
      block(7,cy+1.12,-.1,1.72,.08,.15,"#bd805c");
    }
    for(let i=0;i<5;i++)block(6.35+i*.32,cy+2.3,-.13,.13,.22,.15,"#b98267");
    const sy=heightAt(-6,-5)-.7;part("drum",-6,sy+.35,-5,1.35,1.4,1.35,"#d1c6ac");part("dome",-6,sy+.7,-5,1.4,1.4,1.4,"#c3bba4");
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;tower(-6+Math.cos(a)*1.6,-5+Math.sin(a)*1.6,heightAt(-6+Math.cos(a)*1.6,-5+Math.sin(a)*1.6)-.1,.15,1.7,"#d9cdb4");}
    const py=heightAt(-4,7)-.7;part(b?"ring":"drum",-4,py+.4,7,1.7,1.5,1.7,"#877d65");part("crown",-4,py+.84,7,1.7,1,1.7,"#8c826e");
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const rib=new THREE.TorusGeometry(1.65,.055,4,20,b?(i%3===0?.55:1.1):Math.PI*.5);rib.rotateY(a);rib.translate(-4,py+.8,7);root.add(new THREE.Mesh(rib,new THREE.MeshStandardMaterial({color:"#95876f",roughness:1})));}
    for(let i=0;i<(b?13:8);i++){const x=-10+i*1.4;block(x,.05,16.1,.55,.22,2.6,"#b5ab92");for(let j=0;j<5;j++)block(x-.2,.02,15+j*.5,.08,.35,.08,"#6a5c42");part("rock",x+.45,.13,17.4,.13,.15,.58,"#76644b");}
    // Harbour warehouses and sloping approach streets connect city to waterline.
    for(let i=0;i<(b?100:42);i++){const x=-10+hash(i,61)*17,z=12+hash(i,62)*3.4;if(heightAt(x,z)>0)home(x,z,1.1,"#99958a");}
    for(const [cx,cz] of [[7,-1],[-6,-5],[-4,7]])for(let i=0;i<35;i++){const a=i*.28,r=2.2+i*.10,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(x<10&&Math.abs(z)<12)block(x,heightAt(x,z)+.025,z,.23,.035,.42,"#b1a58b",-a);}
    // Gates are dark openings, with side towers and a lintel above the road.
    for(const [x,z] of [[0,b?13.8:12],[-14,0]]){block(x,heightAt(x,z),z,.38,.65,.24,"#343b34");tower(x-.45,z,heightAt(x,z),.22,1.1);tower(x+.45,z,heightAt(x,z),.22,1.1);}
    if(b){
      for(const [x,z] of squares){route([[x-.8,z],[x+.8,z]],1.25,"#b6a789");for(let i=0;i<6;i++){const xx=x-.65+i*.25;block(xx,heightAt(xx,z+.45),z+.45,.18,.15,.2,"#7b6246");part("roof",xx,heightAt(xx,z+.45)+.18,z+.45,.24,.09,.26,i%2?"#ac7857":"#c3b18b");}}
      route([[0,14],[0,18],[2,23],[3,31]],.48,"#ae9d7f");route([[-14,0],[-18,0],[-21,-4],[-29,-6]],.46,"#ae9d7f");
      block(-17,.35,0,3.7,.15,.62,"#aa9f88");for(const x of [-18.4,-15.6])block(x,-.4,0,.2,.8,.65,"#8c8b77");
      for(let i=0;i<36;i++){const x=-27+(i%6)*1.7,z=4+Math.floor(i/6)*2;route([[x,z],[x+1.3,z]],1.55,i%3?"#929468":"#a7a16d");}
      for(let i=0;i<65;i++){const x=-23+(i%9)*.85,z=-8-Math.floor(i/9)*.8,y=heightAt(x,z);if(y<.08)continue;block(x,y,z,.06,.3,.06,"#6c6247");part("sphere",x,y+.38,z,.26,.27,.26,"#526b3d");}
      // Reuse the library hull/sail construction with a neutral fallback profile and no house identifier.
      const ships=shipGeometry("merchant","#ad9671"),shipMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8}),fleet=new THREE.InstancedMesh(ships,shipMat,7),m=new THREE.Matrix4();
      for(let i=0;i<7;i++){m.compose(new THREE.Vector3(-9+i*2.7,.03,17.9+(i%2)*.45),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.2+(i%2)*.4),new THREE.Vector3(1.5,1.5,1.5));fleet.setMatrixAt(i,m);}fleet.computeBoundingSphere();root.add(fleet);
      for(let i=0;i<70;i++){const z=-5+i*.12,x=10.6+Math.sin(z*.6)*.7,y=heightAt(x-.2,z);part("rock",x,y*.55,z,.28,Math.max(.2,y*.5),.25,i%3?"#817c68":"#a3967c");}
    }
    grove(-21,-11,80);grove(19,-12,60);
  }else if(island){
    const y=heightAt(0,0);wall([[-4,-3],[2,-4.5],[4,-1],[3,3],[-3,3.3]],1.2,.28);
    tower(-1,-1.6,y,1.12,2.65,stone,false);tower(2.4,-2.3,y,.35,b?4.7:3.8);tower(-3,-1.8,y,.32,3.25);tower(2.9,1.6,y,.29,2.8);
    block(-2,y,1,1,1.1,3,stone,.15);part("roof",-2,y+1.1,1,1.1,.65,3.15,roof,.15);
    if(b){
      geometries.neck=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,.5,.2),new THREE.Vector3(0,.95,.65),new THREE.Vector3(0,1.65,.7),new THREE.Vector3(0,1.95,1.15)]),24,.22,10,false);
      // A folded wing is a curved membrane between arched fingers and a scalloped trailing edge.
      const verts:number[]=[],indices:number[]=[];
      for(let u=0;u<=20;u++)for(let v=0;v<=12;v++){
        const t=u/20,f=v/12,x=.20+Math.sin(t*Math.PI*.75)*1.75,top=.65+Math.sin(t*Math.PI)*1.22,z=-.15-t*1.65;
        verts.push(.20+(x-.20)*f,.5+(top-.5)*f+Math.sin(f*Math.PI)*.23,z*f+.4*(1-f)+Math.sin(t*Math.PI*4)*.13*f*f);
      }
      for(let u=0;u<20;u++)for(let v=0;v<12;v++){const k=u*13+v;indices.push(k,k+13,k+1,k+1,k+13,k+14);}
      geometries.foldedWing=new THREE.BufferGeometry();geometries.foldedWing.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geometries.foldedWing.setIndex(indices);geometries.foldedWing.computeVertexNormals();
      geometries.foldedWingLeft=geometries.foldedWing.clone().scale(-1,1,1);
      const fingers:THREE.BufferGeometry[]=[];
      for(const t of [.05,.25,.48,.72,1]){
        const points=Array.from({length:9},(_,j)=>{const f=j/8;return new THREE.Vector3(.20+Math.sin(t*Math.PI*.75)*1.75*f,.5+(.15+Math.sin(t*Math.PI)*1.22)*f+Math.sin(f*Math.PI)*.23+.018,(-.15-t*1.65)*f+.4*(1-f)+Math.sin(t*Math.PI*4)*.13*f*f);});
        fingers.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.032,5,false));
      }
      geometries.wingFingers=mergeGeometries(fingers)!;fingers.forEach(g=>g.dispose());geometries.wingFingersLeft=geometries.wingFingers.clone().scale(-1,1,1);
      geometries.foreleg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.4,.45,.4),new THREE.Vector3(.74,.25,.9),new THREE.Vector3(.70,-.12,1.35)]),12,.13,7,false);
      geometries.forelegLeft=geometries.foreleg.clone().scale(-1,1,1);
    }
    function dragon(cx:number,cz:number,yy:number,s:number,angle=0){
      const place=(shape:string,x:number,h:number,z:number,w:number,t:number,d:number,c:string)=>{const px=cx+(x*Math.cos(angle)+z*Math.sin(angle))*s,pz=cz+(-x*Math.sin(angle)+z*Math.cos(angle))*s;part(shape,px,yy+h*s,pz,w*s,t*s,d*s,c,angle);};
      place("rock",0,.45,0,.65,.48,1.2,"#35464b");
      place("tail",-.2,.1,-.2,1.05,.8,1.2,"#35464b");
      if(b)place("neck",0,0,0,1,1,1,"#566467");
      else place("rock",0,.95,.85,.26,.7,.32,"#43545a");
      place("sphere",0,b?1.94:1.5,b?1.33:1.15,.30,.24,.48,"#627074");
      place("box",0,b?1.77:1.35,b?1.64:1.48,.39,.10,.44,"#29373b");
      for(const sign of [-1,1]){
        place(b?(sign<0?"foldedWingLeft":"foldedWing"):(sign<0?"wingLeft":"wing"),b?0:sign*.2,b?0:.45,b?0:-.2,b?1:1.3,b?1:1.2,b?1:1.2,b?"#627477":"#52676c");
        if(b){
          place(sign<0?"wingFingersLeft":"wingFingers",0,0,0,1,1,1,"#899592");
          place(sign<0?"forelegLeft":"foreleg",0,0,0,1,1,1,"#596a6c");
          place("sphere",sign*.19,2.04,1.67,.035,.025,.045,"#1c2d2f");
        }
        if(b)for(let j=0;j<3;j++){
          place("sphere",sign*(.53+j*.12),-.16,1.4,.045,.14,.25,"#88928b");
          place("cone",sign*(.52+j*.12),-.23,1.57,.05,.20,.06,"#9aa39b");
        }
        place("cone",sign*.22,b?2.25:1.85,b?1.05:1,.075,.55,.075,"#9aa7a2");
        place("rock",sign*.57,.14,.65,.2,.16,.5,"#42565b");
        place("box",sign*.24,b?2:1.52,b?1.57:1.5,.06,.045,.04,"#d5b57d");
      }
      for(let j=0;j<5;j++)place("cone",0,.85,-.8+j*.28,.12,.35,.12,"#7a8988");
    }
    if(!b){dragon(-1,-1.6,y+2.65,1.3);dragon(2.9,1.6,heightAt(2.9,1.6)+2.8,.9,.4);dragon(-3,2.4,heightAt(-3,2.4)+1.2,1.1,-.4);}
    else {dragon(-3.8,3.7,3.1,2.3,-.38);dragon(3.4,3.3,3.0,2.2,.38);dragon(2.4,-2.3,y+4.7,.42,.3);dragon(-3,-1.8,y+3.25,.4,-.4);}
    // Columnar basalt organs form a continuous wet cliff, with broken tops.
    for(let i=0;i<230;i++){const a=i/230*Math.PI*2,r=7.7+Math.sin(a*3)*.8+Math.cos(a*7)*.4,x=Math.cos(a)*r,z=Math.sin(a)*r/1.1,h=3.1+hash(i,4)*1.1;part(b?"basalt":"drum",x+(b?(hash(i,19)-.5)*.3:0),h/2-.15,z,b?.15+hash(i,18)*.15:.23,h,.23,i%3?"#39484a":"#586467",a);}
    for(let i=0;i<35;i++){const x=-5+i*.25,z=-4+Math.sin(i*.6)*.5;part("rock",x,heightAt(x,z),z,.4,1+hash(i,9)*1.4,.65,"#29393d");}
    for(let i=0;i<(b?125:210);i++){const a=i/(b?125:210)*Math.PI*2,r=8.55+Math.sin(a*3)*.85+Math.cos(a*7)*.4;part("rock",Math.cos(a)*r,.045,Math.sin(a)*r/1.1,b?.10:.18,.025,b?.20:.4,i%3?"#abc5c4":"#e1e5d9",-a);}
    // An eroded black-sand cove and the low harbour landing.
    for(let i=0;i<25;i++){const x=6+(hash(i,7)-.5)*1.6,z=5+(hash(i,9)-.5)*1.5;part("rock",x,.035,z,.25,.06,.3,"#292f2d");}
    if(b){
      const climb=[[7,7.1],[6.4,6.3],[5.6,5.8],[4.8,5],[5.8,4.3],[4.6,3.6],[3.2,3.1],[2.6,2.8]];
      route(climb,.34,"#a0a193",.10);
      for(let j=0;j<climb.length-1;j++){
        const [x,z]=climb[j],[xx,zz]=climb[j+1],steps=Math.ceil(Math.hypot(xx-x,zz-z)/.11);
        for(let i=0;i<=steps;i++){const t=i/steps,px=x+(xx-x)*t,pz=z+(zz-z)*t;block(px,heightAt(px,pz)+.1,pz,.38,.045,.075,"#92998f",Math.atan2(xx-x,zz-z));}
      }
      // Break the waterline into several bands, rather than a single white necklace.
      for(let i=0;i<180;i++){const a=i/180*Math.PI*2,r=8.7+Math.sin(a*3)*.85+Math.cos(a*7)*.4+hash(i,44)*.5;part("sphere",Math.cos(a)*r,.03,Math.sin(a)*r/1.1,.08+hash(i,22)*.13,.014,.08,"#6b9399",a);}
    }else for(let i=0;i<28;i++){const x=3+i*.13,z=5+i*.06;block(x,heightAt(x,z)+.02,z,.6,.12,.18,"#7b7c70",-.5);}
    block(7,-.1,6,1,.25,2.3,"#71766b");
  }else{
    const stretch=b?1.25:1,points=(r:number)=>[[-r,-r*.7],[r,-r*.7],[r,r*.7*stretch],[-r,r*.7*stretch]];
    wall(points(7.6),.72,.28);wall(points(5.5),1.65,.32);
    // Continuous moat ring between the curtain walls, with an earth causeway at the gate.
    const shape=new THREE.Shape();const outer=points(7.3).map(([x,z])=>[x,-z]);shape.moveTo(...outer[0] as [number,number]);outer.slice(1).forEach(p=>shape.lineTo(p[0],p[1]));shape.closePath();const hole=new THREE.Path();const inner=points(5.85).map(([x,z])=>[x,-z]).reverse();hole.moveTo(inner[0][0],inner[0][1]);inner.slice(1).forEach(p=>hole.lineTo(p[0],p[1]));hole.closePath();shape.holes.push(hole);const moat=new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:"#3e747e",roughness:.26,metalness:.15}));moat.position.y=.48;root.add(moat);
    const y=heightAt(0,0);block(-1.7,y,-1.3,2,2.5,2);part("roof",-1.7,y+2.5,-1.3,2.2,.9,2.2,roof);tower(1,-2,y,.5,3.35);tower(-3,2,y,.45,b?2.15:1.55,stone,false);for(let i=0;i<5;i++)part("rock",-3+(hash(i,7)-.5)*.8,y+(b?2.25:1.65),2+(hash(i,8)-.5)*.8,.17,.23,.15,stone);
    block(-1,y,2,2.2,.75,1.5);part("roof",-1,y+.75,2,2.4,.6,1.7,roof);
    grove(3,-.7,150);
    // White tree: branching structure and open, wine-red leaf clumps instead of a conical token.
    function branch(a:number[],c:number[],r:number){const start=new THREE.Vector3(...a as [number,number,number]),end=new THREE.Vector3(...c as [number,number,number]),v=end.clone().sub(start),g=new THREE.CylinderGeometry(r*.45,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray() as [number,number,number]);root.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:"#e0dfd0",roughness:1})));}
    branch([3,y,-.5],[3,y+.85,-.5],.045);for(let i=0;i<9;i++){const a=i*2.4,xx=3+Math.cos(a)*.4,zz=-.5+Math.sin(a)*.4;branch([3,y+.3,-.5],[xx,y+.75+hash(i,5)*.25,zz],.025);part("rock",xx,y+(b?1.55:1.25),zz,b?.40:.24,b?.25:.16,b?.38:.22,"#8f3c39");}
    const glazing=new THREE.MeshStandardMaterial({color:b?"#a9c6bc":"#e9c879",emissive:b?"#bf974d":"#c67b2c",emissiveIntensity:.8,roughness:.22,metalness:.15,transparent:true,opacity:.86});
    for(let i=0;i<3;i++){block(1+i*.65,y,3,.55,.4,1.2,"#93aaa0");const glass=new THREE.Mesh(geometries.roof,glazing);glass.position.set(1+i*.65,y+.4,3);glass.scale.set(b?.67:.6,b?.60:.35,b?1.6:1.3);root.add(glass);if(!b)for(let j=0;j<6;j++)block(.74+i*.65,y+.43,2.4+j*.23,.035,.3,.025,"#5b6a64");}
    if(b){
      const frames:THREE.BufferGeometry[]=[];
      for(let i=0;i<3;i++)for(let j=0;j<7;j++){
        const x=1+i*.65,z=2.24+j*1.52/6;
        for(const sign of [-1,1]){
          frames.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x+sign*.335,y+.4,z),new THREE.Vector3(x,y+1,z)),1,.017,4,false));
          frames.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x+sign*.335,y+.05,z),new THREE.Vector3(x+sign*.335,y+.4,z)),1,.017,4,false));
        }
      }
      geometries.gardenFrame=mergeGeometries(frames)!;frames.forEach(g=>g.dispose());part("gardenFrame",0,0,0,1,1,1,"#576d65");
    }
    block(0,.8,5.9*stretch,.8,.28,3.2,"#998f79");tower(-.5,4*stretch,y,.3,1.8);tower(.5,4*stretch,y,.3,1.8);
    for(let ix=-10;ix<=10;ix++)for(let iz=0;iz<(b?9:5);iz++){const x=ix*.7,z=7.6+iz*.8;if(Math.abs(x)<.7||iz===2)continue;home(x,z,.85,"#7c8882");}
    // A dark road, market cross-street and warm awnings break the white foreground.
    for(let i=0;i<65;i++){const z=5.5+i*.38;block(0,heightAt(0,z)+.015,z,.8,.035,.42,"#7a827b");}
    for(let i=0;i<16;i++){const x=(i%8-3.5)*.83,z=9.25+Math.floor(i/8)*1.2;block(x,heightAt(x,z),z,.43,.24,.32,"#6b5845");part("roof",x,heightAt(x,z)+.3,z,.55,.16,.45,i%2?"#ab8060":"#898c67");}
    for(let i=0;i<30;i++){const x=-18+(i%6)*1.4,z=7+Math.floor(i/6)*2;block(x,heightAt(x,z)+.02,z,1.1,.025,1.5,i%2?"#9ca99a":"#b4c0ad");}
    if(b){
      for(let j=0;j<9;j++)route([[-7,7.6+j*.8],[7,7.6+j*.8]],.18,"#929c92");
      route([[-7,9.2],[7,9.2]],.42,"#8a9389");
      part("roof",-1.7,y+2.54,-1.3,2.22,.9,2.22,"#e0e5de");part("roof",-1,y+.79,2,2.42,.6,1.72,"#e0e5de");
    }
    grove(-15,0,160,true);grove(15,2,160,true);
    grove(-11,-12,110,true);grove(12,-10,100,true);
  }
  if(paving.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(paving,3));g.setAttribute("color",new THREE.Float32BufferAttribute(pavingColors,3));g.computeVertexNormals();const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});root.add(new THREE.Mesh(g,m));}
  const matrix=new THREE.Matrix4();for(const {geometry,parts}of buckets.values()){const mesh=new THREE.InstancedMesh(geometry,material,parts.length);parts.forEach((p,i)=>{matrix.compose(p.p,p.q,p.s);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,p.c);});mesh.computeBoundingSphere();root.add(mesh);}
  for(const [key,g]of Object.entries(geometries))if(!buckets.has(key)&&!(north&&key==="roof"))g.dispose();
  if(!north){const sea=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:"#2c606c",roughness:.38,metalness:.18}));sea.position.y=.01;const waterMaterial=sea.material;waterMaterial.onBeforeCompile=shader=>{shader.vertexShader="varying vec3 seatWater;\n"+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nseatWater=position;");shader.fragmentShader="varying vec3 seatWater;\n"+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nfloat ripple=sin(seatWater.x*21.0+sin(seatWater.z*9.0))*sin(seatWater.z*39.0+seatWater.x*3.0);diffuseColor.rgb*=.95+ripple*.045;");};root.add(sea);}
  root.userData.visualBounds=new THREE.Box3(new THREE.Vector3(-20,-1,-19),new THREE.Vector3(20,11,21));
  return {object:root,heightAt,focus:kind==="capital"?new THREE.Vector3(7,heightAt(7,-1)+1,-1):new THREE.Vector3(0,heightAt(0,0)+1,0)};
}
/** 38° game FOV, measured overview inclination. Regional/close distances are 2 km/600 m. */
export function seatCamera(camera:THREE.PerspectiveCamera,kind:SeatKind,pose:SeatPose,focus:THREE.Vector3,orbitSeconds?:number):void {
  const target=pose==="Close"?focus.clone():new THREE.Vector3(0,kind==="island"?3:1,0);
  const direction=pose==="Overview"?new THREE.Vector3(0,134.50025,38.67616).normalize():new THREE.Vector3(.8,.85,1.25).normalize();
  if(orbitSeconds!==undefined)direction.applyAxisAngle(new THREE.Vector3(0,1,0),orbitSeconds*Math.PI/10);
  const distance=pose==="Overview"?108:pose==="Regional"?40:12;
  // Preserve vertical FOV and optical distance on mobile; the study is intentionally not auto-fitted.
  camera.fov=38;camera.near=.04;camera.far=1800;camera.position.copy(target).addScaledVector(direction,distance);camera.updateProjectionMatrix();camera.lookAt(target);camera.updateMatrixWorld(true);
}

import * as THREE from "three";
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
export function createSeatStudy(kind:SeatKind,variant:SeatVariant="A"):{object:THREE.Group;heightAt:(x:number,z:number)=>number;focus:THREE.Vector3} {
  const root=new THREE.Group(),b=variant==="B",north=kind==="north",island=kind==="island";
  const buckets=new Map<string,{geometry:THREE.BufferGeometry;parts:Part[]}>();
  const geometries:Record<string,THREE.BufferGeometry>={
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
    const shore=16-z+Math.sin(x*.25)*.7-Math.max(0,x-7)*.8;
    let h=.45+peak(x,z,7,-1,b?17:12,b?5.4:6.8)+peak(x,z,-6,-5,b?17:12,b?3.7:4.7)+peak(x,z,-4,7,b?14:10,b?3:3.8)+noise(x*.45,z*.45)*.16;
    // A steep coastal escarpment puts the royal crown directly above the bay.
    h=THREE.MathUtils.lerp(-.7,h,1-THREE.MathUtils.smoothstep(x,10.1,11.2));
    h=THREE.MathUtils.lerp(-.65,h,THREE.MathUtils.smoothstep(shore,0,2));
    // A river mouth feeds the bay beside the western city wall.
    const river=Math.abs(x-(-17+Math.sin(z*.19)*1.4));
    return Math.min(h,THREE.MathUtils.lerp(-.4,h,THREE.MathUtils.smoothstep(river,1.2,2.3)));
  };
  const terrain=new THREE.PlaneGeometry(150,150,230,230).rotateX(-Math.PI/2),pos=terrain.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),y=heightAt(x,z);pos.setY(i,y);const c=new THREE.Color(island?(y>2?"#343e3c":"#202c2d"):north?(noise(x*.3,z*.3)>.55?"#d6ded7":"#96a89c"):y>4?"#7f8770":y>1?"#697c4e":"#8a956c");c.multiplyScalar(.82+noise(x*1.6,z*1.6)*.27);colors.push(c.r,c.g,c.b);}
  terrain.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  const groundMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});root.add(new THREE.Mesh(terrain,groundMat));
  // World-space mineral grain and mortar bands; no downloaded textures or shader permutations on motion.
  const material=new THREE.MeshStandardMaterial({color:"white",roughness:.92});
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
      diffuseColor.rgb*=mix(.84,1.12,grit)*mix(.83,1.0,mortar);`);
  };material.customProgramCacheKey=()=>"seat-mineral-v1";
  function block(x:number,y:number,z:number,w:number,h:number,d:number,c=stone,a=0){part("box",x,y+h/2,z,w,h,d,c,a);}
  function merlons(x:number,z:number,y:number,r:number,c=stone){for(let i=0;i<12;i++){const a=i*Math.PI/6;block(x+Math.cos(a)*r,y,z+Math.sin(a)*r,.12,.18,.13,c,a);}}
  function tower(x:number,z:number,y:number,r:number,h:number,c=stone,cap=true){part("drum",x,y+h/2,z,r,h,r,c);part("drum",x,y+h-.15,z,r*1.12,.25,r*1.12,c);merlons(x,z,y+h,r,c);if(cap)part("cone",x,y+h+.34,z,r*1.1,.72,r*1.1,roof);if(north)part("drum",x,y+h+.01,z,r*1.09,.035,r*1.09,"#e0e5de");for(let i=0;i<3;i++)block(x,y+.4+i*h/3,z+r+.008,.055,.19,.015,"#293335");}
  function wall(points:number[][],h:number,w:number,c=stone){
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],[xx,zz]=points[(i+1)%points.length],len=Math.hypot(xx-x,zz-z),a=Math.atan2(xx-x,zz-z),count=Math.ceil(len/.32);
      // Short stepped sections follow the rendered hill instead of bridging a flat foundation.
      for(let j=0;j<count;j++){const f=(j+.5)/count,px=x+(xx-x)*f,pz=z+(zz-z)*f,y=heightAt(px,pz);block(px,y-.12,pz,w,h+.12,len/count+.025,c,a);block(px,y+h,pz,w*1.15,.18,.16,north?"#e0e6df":c,a);}
      tower(x,z,heightAt(x,z),w*1.65,h+.5,c,false);
    }
  }
  function home(x:number,z:number,s=1,c=stone){const y=heightAt(x,z),h=(.16+hash(x,z)*.22)*s,w=.22*s,d=.42*s,a=Math.floor(hash(z,x)*4)*Math.PI/2;block(x,y,z,w,h,d,c,a);part("roof",x,y+h,z,w*1.2,.18*s,d*1.14,roof,a);block(x+.08*s,y+h,z,.05*s,.25*s,.05*s,c,a);}
  function grove(x:number,z:number,count:number,snow=false){for(let i=0;i<count;i++){const a=hash(i,17)*Math.PI*2,r=Math.sqrt(hash(i,11))*3.3,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,y=heightAt(xx,zz),h=.4+hash(i,2)*.65;block(xx,y,zz,.07,h,.07,"#625c49");part("cone",xx,y+h*.82,zz,.28,h,.28,snow?"#5b6b60":"#344b34");}}
  if(kind==="capital"){
    const outline=b?[[-14,-7],[-10,-12],[-2,-13],[6,-10],[10,-5],[10,4],[8,11],[2,14],[-8,13],[-14,6]]:[[-12,-7],[-7,-11],[0,-10],[7,-7],[10,-3],[10,3],[4,10],[-3,12],[-10,8],[-13,1]];wall(outline,.7,.22);
    for(let ix=-25;ix<=25;ix++)for(let iz=-23;iz<=23;iz++){const x=ix*.49+(hash(ix,iz)-.5)*.35,z=iz*.49+(hash(iz,ix)-.5)*.3;if((x*x/(b?164:133)+z*z/(b?145:107))>1||Math.abs(x)<.35||Math.abs(z-2)<.3||[[7,-1,2.1],[-6,-5,1.8],[-4,7,2.0]].some(([px,pz,r])=>Math.hypot(x-px,z-pz)<r))continue;home(x,z,.8+hash(ix,iz)*.6,["#b9aa8d","#a99475","#c4b394"][Math.floor(hash(ix+9,iz)*3)]);}
    const cy=heightAt(7,-1);
    // Individual foundations embed into the crown; there is no broad display plinth.
    const royal=[[4.8,-3],[8.7,-3.5],[9.4,1],[5,1.2]];wall(royal,1.15,.22,"#a66d54");
    block(7,cy-1.1,-1,1.65,3.2,1.7,"#ae755c");block(7,cy+2.1,-1,1.8,.18,1.85,"#c18e71");
    for(const [x,z,h]of [[6,-2,2.8],[8,-2,3.3],[8,0,2.65],[6,0,2.3]])tower(x,z,heightAt(x,z)-.12,.3,h,"#ab7058");
    for(let i=0;i<5;i++)block(6.35+i*.32,cy+2.3,-.13,.13,.22,.15,"#b98267");
    const sy=heightAt(-6,-5)-.7;part("drum",-6,sy+.35,-5,1.35,1.4,1.35,"#d1c6ac");part("dome",-6,sy+.7,-5,1.4,1.4,1.4,"#c3bba4");
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;tower(-6+Math.cos(a)*1.6,-5+Math.sin(a)*1.6,heightAt(-6+Math.cos(a)*1.6,-5+Math.sin(a)*1.6)-.1,.15,1.7,"#d9cdb4");}
    const py=heightAt(-4,7)-.7;part("drum",-4,py+.4,7,1.7,1.5,1.7,"#877d65");part("crown",-4,py+.84,7,1.7,1,1.7,"#8c826e");
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const rib=new THREE.TorusGeometry(1.65,.055,4,20,Math.PI*.5);rib.rotateY(a);rib.translate(-4,py+.8,7);root.add(new THREE.Mesh(rib,new THREE.MeshStandardMaterial({color:"#95876f",roughness:1})));}
    for(let i=0;i<(b?13:8);i++){const x=-10+i*1.4;block(x,.05,16.1,.55,.22,2.6,"#b5ab92");for(let j=0;j<5;j++)block(x-.2,.02,15+j*.5,.08,.35,.08,"#6a5c42");part("rock",x+.45,.13,17.4,.13,.15,.58,"#76644b");}
    // Harbour warehouses and sloping approach streets connect city to waterline.
    for(let i=0;i<(b?100:42);i++){const x=-10+hash(i,61)*17,z=12+hash(i,62)*3.4;if(heightAt(x,z)>0)home(x,z,1.1,"#99958a");}
    for(const [cx,cz] of [[7,-1],[-6,-5],[-4,7]])for(let i=0;i<35;i++){const a=i*.28,r=2.2+i*.10,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(x<10&&Math.abs(z)<12)block(x,heightAt(x,z)+.025,z,.23,.035,.42,"#b1a58b",-a);}
    // Gates are dark openings, with side towers and a lintel above the road.
    for(const [x,z] of [[0,12],[-14,0]]){block(x,heightAt(x,z),z,.38,.65,.24,"#343b34");tower(x-.45,z,heightAt(x,z),.22,1.1);tower(x+.45,z,heightAt(x,z),.22,1.1);}
    grove(-21,-11,80);grove(19,-12,60);
  }else if(island){
    const y=heightAt(0,0);wall([[-4,-3],[2,-4.5],[4,-1],[3,3],[-3,3.3]],1.2,.28);
    tower(-1,-1.6,y,1.12,2.65,stone,false);tower(2.4,-2.3,y,.35,b?4.7:3.8);tower(-3,-1.8,y,.32,3.25);tower(2.9,1.6,y,.29,2.8);
    block(-2,y,1,1,1.1,3,stone,.15);part("roof",-2,y+1.1,1,1.1,.65,3.15,roof,.15);
    function dragon(cx:number,cz:number,yy:number,s:number,angle=0){
      const place=(shape:string,x:number,h:number,z:number,w:number,t:number,d:number,c:string)=>{const px=cx+(x*Math.cos(angle)+z*Math.sin(angle))*s,pz=cz+(-x*Math.sin(angle)+z*Math.cos(angle))*s;part(shape,px,yy+h*s,pz,w*s,t*s,d*s,c,angle);};
      place("rock",0,.45,0,.65,.48,1.2,"#35464b");
      place("tail",-.2,.1,-.2,1.05,.8,1.2,"#35464b");
      place("rock",0,.95,.85,.26,.7,.32,"#43545a");
      place("rock",0,1.5,1.15,.29,.25,.5,"#4b5e63");
      place("box",0,1.35,1.48,.42,.12,.45,"#243036");
      for(const sign of [-1,1]){
        place(sign<0?"wingLeft":"wing",sign*.2,.45,-.2,1.3,1.2,1.2,"#52676c");
        place("cone",sign*.22,1.85,1,.075,.55,.075,"#9aa7a2");
        place("rock",sign*.57,.14,.65,.2,.16,.5,"#42565b");
        place("box",sign*.24,1.52,1.5,.06,.045,.04,"#d5b57d");
      }
      for(let j=0;j<5;j++)place("cone",0,.85,-.8+j*.28,.12,.35,.12,"#7a8988");
    }
    if(!b){dragon(-1,-1.6,y+2.65,1.3);dragon(2.9,1.6,heightAt(2.9,1.6)+2.8,.9,.4);dragon(-3,2.4,heightAt(-3,2.4)+1.2,1.1,-.4);}
    else {dragon(-4,1.8,2.8,2.3,-.4);dragon(3,1.2,2.5,2.2,.4);}
    // Columnar basalt organs form a continuous wet cliff, with broken tops.
    for(let i=0;i<230;i++){const a=i/230*Math.PI*2,r=7.7+Math.sin(a*3)*.8+Math.cos(a*7)*.4,x=Math.cos(a)*r,z=Math.sin(a)*r/1.1,h=3.1+hash(i,4)*1.1;part("drum",x,h/2-.15,z,.23,h,.23,i%3?"#303d40":"#485559",a);}
    for(let i=0;i<35;i++){const x=-5+i*.25,z=-4+Math.sin(i*.6)*.5;part("rock",x,heightAt(x,z),z,.4,1+hash(i,9)*1.4,.65,"#29393d");}
    for(let i=0;i<210;i++){const a=i/210*Math.PI*2,r=8.55+Math.sin(a*3)*.85+Math.cos(a*7)*.4;part("rock",Math.cos(a)*r,.045,Math.sin(a)*r/1.1,.18,.025,.4,i%3?"#abc5c4":"#e1e5d9",-a);}
    // An eroded black-sand cove and the low harbour landing.
    for(let i=0;i<25;i++){const x=6+(hash(i,7)-.5)*1.6,z=5+(hash(i,9)-.5)*1.5;part("rock",x,.035,z,.25,.06,.3,"#292f2d");}
    for(let i=0;i<28;i++){const x=3+i*.13,z=5+i*.06;block(x,heightAt(x,z)+.02,z,.6,.12,.18,"#7b7c70",-.5);}
    block(7,-.1,6,1,.25,2.3,"#71766b");
  }else{
    const stretch=b?1.25:1,points=(r:number)=>[[-r,-r*.7],[r,-r*.7],[r,r*.7*stretch],[-r,r*.7*stretch]];
    wall(points(7.6),.72,.28);wall(points(5.5),1.65,.32);
    // Continuous moat ring between the curtain walls, with an earth causeway at the gate.
    const shape=new THREE.Shape();const outer=points(7.3).map(([x,z])=>[x,-z]);shape.moveTo(...outer[0] as [number,number]);outer.slice(1).forEach(p=>shape.lineTo(p[0],p[1]));shape.closePath();const hole=new THREE.Path();const inner=points(5.85).map(([x,z])=>[x,-z]).reverse();hole.moveTo(inner[0][0],inner[0][1]);inner.slice(1).forEach(p=>hole.lineTo(p[0],p[1]));hole.closePath();shape.holes.push(hole);const moat=new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:"#3e747e",roughness:.26,metalness:.15}));moat.position.y=.48;root.add(moat);
    const y=heightAt(0,0);block(-1.7,y,-1.3,2,2.5,2);part("roof",-1.7,y+2.5,-1.3,2.2,.9,2.2,roof);tower(1,-2,y,.5,3.35);tower(-3,2,y,.45,1.55,stone,false);for(let i=0;i<5;i++)part("rock",-3+(hash(i,7)-.5)*.8,y+1.65,2+(hash(i,8)-.5)*.8,.17,.23,.15,stone);
    block(-1,y,2,2.2,.75,1.5);part("roof",-1,y+.75,2,2.4,.6,1.7,roof);
    grove(3,-.7,150);
    // White tree: branching structure and open, wine-red leaf clumps instead of a conical token.
    function branch(a:number[],c:number[],r:number){const start=new THREE.Vector3(...a as [number,number,number]),end=new THREE.Vector3(...c as [number,number,number]),v=end.clone().sub(start),g=new THREE.CylinderGeometry(r*.45,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray() as [number,number,number]);root.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:"#e0dfd0",roughness:1})));}
    branch([3,y,-.5],[3,y+.85,-.5],.045);for(let i=0;i<9;i++){const a=i*2.4,xx=3+Math.cos(a)*.4,zz=-.5+Math.sin(a)*.4;branch([3,y+.3,-.5],[xx,y+.75+hash(i,5)*.25,zz],.025);part("rock",xx,y+1.25,zz,.24,.16,.22,"#7b4545");}
    const glazing=new THREE.MeshStandardMaterial({color:"#e9c879",emissive:"#c67b2c",emissiveIntensity:.8,roughness:.22,metalness:.15,transparent:true,opacity:.86});
    for(let i=0;i<3;i++){block(1+i*.65,y,3,.55,.4,1.2,"#93aaa0");const glass=new THREE.Mesh(geometries.roof,glazing);glass.position.set(1+i*.65,y+.4,3);glass.scale.set(.6,.35,1.3);root.add(glass);for(let j=0;j<6;j++)block(.74+i*.65,y+.43,2.4+j*.23,.035,.3,.025,"#5b6a64");}
    block(0,.8,5.9*stretch,.8,.28,3.2,"#998f79");tower(-.5,4*stretch,y,.3,1.8);tower(.5,4*stretch,y,.3,1.8);
    for(let ix=-10;ix<=10;ix++)for(let iz=0;iz<(b?9:5);iz++){const x=ix*.7,z=7.6+iz*.8;if(Math.abs(x)<.7||iz===2)continue;home(x,z,.85,"#7c8882");}
    // A dark road, market cross-street and warm awnings break the white foreground.
    for(let i=0;i<65;i++){const z=5.5+i*.38;block(0,heightAt(0,z)+.015,z,.8,.035,.42,"#7a827b");}
    for(let i=0;i<16;i++){const x=(i%8-3.5)*.83,z=9.25+Math.floor(i/8)*1.2;block(x,heightAt(x,z),z,.43,.24,.32,"#6b5845");part("roof",x,heightAt(x,z)+.3,z,.55,.16,.45,i%2?"#ab8060":"#898c67");}
    for(let i=0;i<30;i++){const x=-18+(i%6)*1.4,z=7+Math.floor(i/6)*2;block(x,heightAt(x,z)+.02,z,1.1,.025,1.5,i%2?"#9ca99a":"#b4c0ad");}
    grove(-15,0,160,true);grove(15,2,160,true);
    grove(-11,-12,110,true);grove(12,-10,100,true);
  }
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

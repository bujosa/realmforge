import * as THREE from "three";
import type { SurfaceArraySet } from "../materials/SurfaceArrays";
import { type Direction, geographyGLSL, heightAt } from "./directions";

export function landscapeGeometry(high:boolean):THREE.BufferGeometry {
  const g=new THREE.PlaneGeometry(224,160,high?384:224,high?320:190).rotateX(-Math.PI/2);
  g.translate(8,0,-6);
  const p=g.getAttribute("position");for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));
  g.computeVertexNormals();return g;
}
export function terrainMaterial(d:Direction, surfaces:SurfaceArraySet):THREE.MeshStandardMaterial {
  const m=new THREE.MeshStandardMaterial({roughness:0.94});
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{
      ldAlbedo:{value:surfaces.albedo},ldNormal:{value:surfaces.normal},ldRough:{value:surfaces.roughness},
      ldGrass:{value:new THREE.Color(d.grass)},ldNorth:{value:new THREE.Color(d.north)},ldDry:{value:new THREE.Color(d.dry)},
      ldRock:{value:new THREE.Color(d.rock)},ldSand:{value:new THREE.Color(d.sand)},ldSnow:{value:new THREE.Color(d.snow)},ldPhoto:{value:d.photo},ldMood:{value:d.name==="Series mood"?1:0},
    });
    s.vertexShader="varying vec3 ldP;varying vec3 ldN;\n"+s.vertexShader;
    s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nldP=position;ldN=normal;");
    s.fragmentShader=`varying vec3 ldP;varying vec3 ldN;uniform highp sampler2DArray ldAlbedo;uniform highp sampler2DArray ldNormal;uniform highp sampler2DArray ldRough;
    uniform vec3 ldGrass,ldNorth,ldDry,ldRock,ldSand,ldSnow;uniform float ldPhoto,ldMood;
    ${geographyGLSL}\n`+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec2 p=ldP.xz;float slope=1.0-ldN.y;float n=ldNoise(p*.22),fine=ldNoise(p*2.8);
      float north=1.0-smoothstep(-30.0,0.0,p.y);float east=smoothstep(26.0,40.0,p.x);
      vec3 grass=mix(ldGrass,ldNorth,north*.86);grass=mix(grass,ldDry,east*.64);
      float rock=smoothstep(.12,.43,slope);rock=max(rock,smoothstep(4.6,8.0,ldP.y)*.78);
      float sand=(1.0-smoothstep(.15,1.4,ldP.y))*(1.0-rock);
      float snow=smoothstep(8.0+n*2.5,11.4+n*2.5,ldP.y)*(1.0-smoothstep(.25,.65,slope));
      snow=max(snow,ldMood*north*smoothstep(2.7,6.5,ldP.y)*.72);
      float field=0.0,rows=0.0;vec3 fieldColour=ldDry;
      if(p.x> -24.0&&p.x< -11.0&&p.y>10.0&&p.y<22.0){
        vec2 parcel=floor((p-vec2(-24,10))/vec2(3.2,3.8));vec2 edge=fract((p-vec2(-24,10))/vec2(3.2,3.8));
        field=smoothstep(.025,.065,min(min(edge.x,1.0-edge.x),min(edge.y,1.0-edge.y)))*(1.0-rock);
        fieldColour=mix(ldDry,ldGrass,ldHash(parcel)*.7);rows=sin(p.x*43.0+p.y*.8)*.045;
      }
      float vineyard=step(44.0,p.x)*step(p.x,59.0)*step(14.0,p.y)*step(p.y,23.0);
      grass=mix(grass,ldDry*.8,vineyard*.35);grass*=1.0-vineyard*(.5+.5*sin(p.x*14.0))*.15;
      float layer=rock>.45?5.0:sand>.45?4.0:field>.45?2.0:n>.55?1.0:0.0;
      vec3 planes=pow(abs(ldN),vec3(6.0));planes/=max(dot(planes,vec3(1)),.001);
      vec3 tex=mix(texture(ldAlbedo,vec3(p*.75,0.0)).rgb,texture(ldAlbedo,vec3(p*.75,1.0)).rgb,smoothstep(.25,.75,n));
      tex=mix(tex,texture(ldAlbedo,vec3(p*.75,2.0)).rgb,field);tex=mix(tex,texture(ldAlbedo,vec3(p*.75,4.0)).rgb,sand);
      tex=mix(tex,texture(ldAlbedo,vec3(p*.75,5.0)).rgb,rock);
      if(rock>.99)tex=texture(ldAlbedo,vec3(ldP.yz*.65,5.0)).rgb*planes.x+texture(ldAlbedo,vec3(ldP.xy*.65,5.0)).rgb*planes.z+tex*planes.y;
      float luminance=dot(tex,vec3(.2126,.7152,.0722));
      vec3 base=mix(grass,fieldColour+rows,field*.78);base=mix(base,ldRock,rock);base=mix(base,ldSand*mix(.70,1.0,smoothstep(.0,.65,ldP.y)),sand);base=mix(base,ldSnow,snow);
      base*=.85+n*.27+(fine-.5)*.10;
      base*=1.0-ldMood*smoothstep(.4,.72,ldNoise(p*.055))*.16;
      base*=mix(1.0,clamp(.68+luminance*1.5,.67,1.35),ldPhoto*(1.0-snow));
      // Valleys retain cool ambient occlusion while sunlit ridges stay legible.
      base*=.88+.12*ldN.y;
      diffuseColor.rgb*=base;
    `);
    s.fragmentShader=s.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      roughnessFactor=mix(.96,texture(ldRough,vec3(ldP.xz*.75,layer)).r,ldPhoto*.65);
      roughnessFactor=clamp(roughnessFactor,.7,1.0);
      roughnessFactor=mix(roughnessFactor,.38,sand*(1.0-smoothstep(.02,.55,ldP.y)));
    `);
    s.fragmentShader=s.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      vec2 detail=texture(ldNormal,vec3(ldP.xz*.75,layer)).xy*2.0-1.0;
      normal=normalize(normal+vec3(detail.x,detail.y,0.0)*ldPhoto*.17*(1.0-snow));
    `);
  };
  m.customProgramCacheKey=()=>"lookdev-terrain-v1";return m;
}
export function seaMaterial(d:Direction):{material:THREE.MeshStandardMaterial;time:{value:number}} {
  const time={value:0};const m=new THREE.MeshStandardMaterial({color:d.sea,roughness:.28,metalness:.12});
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{ldTime:time,ldDeep:{value:new THREE.Color(d.sea)},ldShallow:{value:new THREE.Color(d.shallow)}});
    s.vertexShader="varying vec3 ldWaterP;\n"+s.vertexShader;
    s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nldWaterP=position;");
    s.fragmentShader=`uniform float ldTime;uniform vec3 ldDeep,ldShallow;varying vec3 ldWaterP;${geographyGLSL}\n`+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec2 p=ldWaterP.xz;float ground=ldHeight(p);float depth=max(0.0,-ground);
      float shallow=exp(-depth*1.65);vec3 water=mix(ldDeep,ldShallow,shallow*.85);
      float ripple=sin(p.x*1.8+p.y*.6+ldTime*.9)+.4*sin(p.y*3.1-p.x*.9-ldTime*.7);
      float foam=(1.0-smoothstep(.04,.38,depth))*smoothstep(-.01,.07,depth);
      float wash=.5+.5*sin(depth*35.0-ldTime*2.2+ldNoise(p*3.0)*3.0);
      water=mix(water,vec3(.72,.82,.77),foam*(.30+.55*wash));
      water+=ripple*.003;diffuseColor.rgb=water;
    `);
    s.fragmentShader=s.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      float wave=sin(ldWaterP.x*3.7+ldWaterP.z*1.4+ldTime*.85);
      float crosswave=cos(ldWaterP.z*4.2-ldWaterP.x*.8+ldTime*.67);
      normal=normalize(normal+vec3(wave*.085,crosswave*.055,0.0));
    `);
  };
  m.customProgramCacheKey=()=>"lookdev-sea-v1";return {material:m,time};
}
export function skyMaterial(d:Direction):THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{zenith:{value:new THREE.Color(d.sky)},horizon:{value:new THREE.Color(d.horizon)},drama:{value:d.name==="Series mood"?1:.25}},vertexShader:`varying vec3 ldDirection;void main(){ldDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec3 ldDirection;uniform vec3 zenith,horizon;uniform float drama;${geographyGLSL}
    void main(){vec3 dir=normalize(ldDirection);float h=clamp(dir.y,0.0,1.0);vec3 c=mix(horizon,zenith,pow(h,.45));vec2 p=dir.xz/max(.12,dir.y)*2.0;float cloud=ldNoise(p*1.2)*.55+ldNoise(p*3.8)*.3+ldNoise(p*10.0)*.15;c=mix(c,vec3(.42,.48,.49),smoothstep(.47,.74,cloud)*drama*.45);gl_FragColor=vec4(c,1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(";#include",";\n#include")});
}

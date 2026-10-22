import * as THREE from "three";

export interface ArmyUniforms {
  time: { value: number };
  motion: { value: number };
  atlas: { value: THREE.Texture };
}

const declarations = /* glsl */ `
attribute vec4 army;
attribute vec3 pivot;
attribute vec4 soldier;
attribute vec4 poseA;
attribute vec4 poseB;
attribute vec4 meta;
attribute vec4 params;
uniform float armyTime;
uniform float armyMotion;
varying vec3 vArmyTint;
varying vec3 vArmyTrim;
varying vec4 vArmyMark;
varying vec4 vArmyLife;
mat3 turnX(float a) { float c=cos(a),s=sin(a); return mat3(1.,0.,0.,0.,c,s,0.,-s,c); }
mat3 turnY(float a) { float c=cos(a),s=sin(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
mat3 turnZ(float a) { float c=cos(a),s=sin(a); return mat3(c,s,0.,-s,c,0.,0.,0.,1.); }
void armyPose(inout vec3 p, inout vec3 n) {
  float march=poseA.x, attack=poseA.y, charge=poseA.z, defend=poseA.w;
  float rout=poseB.x, wound=max(poseB.y,meta.z), death=poseB.z, victory=poseB.w;
  float gait=march+charge+rout;
  float seed=soldier.w+meta.y*0.71;
  float t=armyTime;
  float cycle=t*7.+seed;
  // Blend fixed-frequency cycles rather than multiplying time by a changing
  // transition weight (which would jump phase after long-running sessions).
  float stride=mix(sin(cycle),sin(t*12.+seed),charge);
  stride=mix(stride,sin(t*11.+seed),rout)*armyMotion;
  float hurt=step(0.46,fract(sin(seed*13.1)*437.5))*wound;
  float part=army.x;
  float angle=0.; mat3 r=mat3(1.);
  if (part==1. || part==2.) {
    angle=stride*gait*(part==1.?0.55:-0.55);
    r=turnX(angle);
  }
  if (part==3.) {
    angle=-(attack*1.25+charge*1.5)+victory*0.62+defend*0.23;
    angle+=sin(cycle)*attack*0.09*armyMotion;
    r=turnX(angle);
  }
  if (part==4.) r=turnX(-defend*0.9-attack*0.16);
  if (part==6.) r=turnY(sin(t*1.6+seed)*0.065*armyMotion)*(turnX(sin(t*1.1+seed)*0.025*armyMotion));
  if (part==7.) r=turnY(sin(t*2.5+seed)*0.3*armyMotion);
  if (part==8.) r=turnX(attack*(-0.35+sin(t*3.)*1.25*armyMotion));
  if (part==9.) r=turnY(sin(t*5.+seed*0.05)*(march+charge)*0.32*armyMotion)*turnZ(cos(t*5.)*(march+charge)*0.15*armyMotion);
  if (part==10. || part==11.) r=turnZ((part==10.?1.:-1.)*(sin(t*2.6)*0.08*armyMotion+attack*0.32+victory*0.24));
  p=pivot+r*(p-pivot); n=r*n;
  if (part==3.) p.y+=victory*.10;
  if (part==4.) p.y+=defend*.06;
  if (part==14.) {
    float shot=fract(t*.7);
    if(attack<.1 || shot<.35) p=vec3(0.,-.1,0.);
    else { float flight=(shot-.35)/.65; p.y+=sin(flight*3.14159)*1.4; p.z-=flight*2.8; }
  }
  if (part==5.) {
    float flex=clamp(abs(position.x-pivot.x)*4.,0.1,1.);
    p.z+=sin(t*3.2+position.x*11.+position.y*4.+meta.y)*0.035*flex*armyMotion;
    p.y-=rout*0.17*flex+wound*0.12*flex;
    n=normalize(n+vec3(0.,0.,sin(t*3.2+position.x*11.)*0.16*armyMotion));
  }
  // Shared deterministic variation plus distinct person phase, with anchored soles.
  float variation=1.+(fract(sin(seed*91.7)*43758.5)-0.5)*0.08;
  if (part<8.) p=soldier.xyz+(p-soldier.xyz)*variation;
  if (part<12.) {
    vec3 center=soldier.xyz;
    mat3 fall=turnX(hurt*1.22+death*params.y*1.6);
    p=center+fall*(p-center); n=fall*n;
    p.y-=hurt*0.06;
    float breath=sin(t*2.+seed)*0.004*armyMotion;
    p.y+=breath*smoothstep(0.05,0.4,p.y)*(1.-death);
    p.y+=abs(stride)*gait*0.018;
    p.z-=attack*0.055;
  }
  if (params.z>0.5) {
    mat3 roll=turnZ(sin(t*1.3+meta.y)*0.025*armyMotion+death*params.y*0.65);
    p=roll*p; n=roll*n; p.y+=sin(t*1.8+meta.y)*0.012*armyMotion;
  }
  if (part==12.) {
    float dust=fract(t*1.2+seed);
    p.x+=sin(seed)*dust*0.2; p.z+=dust*0.25;
    p.y+=dust*0.05;
    p=soldier.xyz+(p-soldier.xyz)*(gait*armyMotion*(1.-death));
  }
  if (part==13.) {
    if (params.x<0.5) p=vec3(0.,-0.02,0.);
  } else p.y+=params.x*0.055;
  p.y-=death*params.y*(params.z>0.5?0.8:0.16);
}
`;

export function armyMaterial(uniforms: ArmyUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.79, metalness: 0.12, side: THREE.DoubleSide });
  material.forceSinglePass = true;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { armyTime: uniforms.time, armyMotion: uniforms.motion, armyAtlas: uniforms.atlas });
    shader.vertexShader = declarations + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `vec3 objectNormal=vec3(normal); vec3 armyPosition=position; armyPose(armyPosition,objectNormal);`);
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed=armyPosition;");
    shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>", /* glsl */ `
      vColor.rgb=color.rgb;
      vArmyTint=instanceColor;
      float luminance=dot(instanceColor,vec3(.2126,.7152,.0722));
      vArmyTrim=luminance<0.08?vec3(.78,.61,.31):luminance>0.65?vec3(.21,.24,.28):vec3(.7,.66,.51);
      vArmyMark=vec4(army.zw,army.y,meta.x);
      vArmyLife=vec4(poseB.z*params.y,max(poseB.y,meta.z),army.x,meta.w);
    `);
    shader.fragmentShader = /* glsl */ `
      uniform sampler2D armyAtlas;
      varying vec3 vArmyTint;
      varying vec3 vArmyTrim;
      varying vec4 vArmyMark;
      varying vec4 vArmyLife;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", /* glsl */ `
      #include <color_fragment>
      float paint=vArmyMark.z;
      // Preserve saturated cloth under the gallery's high-intensity key light.
      diffuseColor.rgb*=paint>1.5?vArmyTrim:mix(vec3(1.),vArmyTint,paint);
      if(paint>.5 && paint<1.5) diffuseColor.rgb*=.76;
      if(vArmyMark.x>=0.) {
        vec2 uv=vArmyMark.xy;
        if(!gl_FrontFacing) uv.x=1.-uv.x;
        float tile=vArmyMark.w;
        vec2 cell=vec2(mod(tile,8.),7.-floor(tile/8.));
        float mark=texture2D(armyAtlas,(cell+vec2(.06)+uv*.88)/8.).a;
        float lum=dot(vArmyTint,vec3(.2126,.7152,.0722));
        vec3 ink=lum>0.35?vec3(.035,.045,.055):vec3(.94,.79,.46);
        diffuseColor.rgb=mix(diffuseColor.rgb,ink,mark);
        float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
        float hem=1.-smoothstep(.035,.055,edge);
        diffuseColor.rgb=mix(diffuseColor.rgb,vArmyTrim,hem);
        if(vArmyLife.y>.1 && vArmyLife.z==5. && uv.x>.68 && uv.y<.20+sin(uv.x*47.)*.09) discard;
      }
      float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      if(noise<vArmyLife.x) discard;
      if(vArmyLife.z==12.) { if(noise>.22) discard; }
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", /* glsl */ `
      #include <emissivemap_fragment>
      if(vArmyMark.z>.5 && vArmyMark.z<1.5) totalEmissiveRadiance+=vArmyTint*.12;
      float rim=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.5);
      totalEmissiveRadiance+=vArmyTrim*rim*.11*(vArmyMark.z>.5?1.:.3);
    `);
  };
  material.customProgramCacheKey = () => "realmforge-army-v2-r2";
  return material;
}

export function contactMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 meta; attribute vec4 params; attribute vec4 poseB;
      varying vec2 vUv; varying vec3 vTint; varying float vSelect; varying float vDeath;
      void main() { vUv=uv; vTint=instanceColor; vSelect=meta.w; vDeath=poseB.z*params.y;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vTint; varying float vSelect; varying float vDeath;
      void main(){ float r=length((vUv-.5)*2.);
        float shadow=exp(-r*r*5.5)*.32;
        float ring=(1.-smoothstep(.014,.027,abs(r-.85)))*(.22+vSelect*.65);
        vec3 trim=dot(vTint,vec3(.2126,.7152,.0722))<.08?vec3(.65,.49,.23):vTint;
        gl_FragColor=vec4(mix(vec3(.06,.05,.04),trim,ring),max(shadow,ring)*(1.-vDeath));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

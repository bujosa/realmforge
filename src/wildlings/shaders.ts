export const skyVertex = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const skyFragment = `
precision highp float;
uniform float strength; uniform float clock; uniform float attack;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){
 vec2 skyUV=vUv*vec2(1.,1.8461538);
 float s=strength/12.; float storm=smoothstep(6.,12.,strength);
 float cloud=noise(vec2(skyUV.x*12.+clock*.025,skyUV.y*9.))+noise(vec2(skyUV.x*27.-clock*.02,skyUV.y*17.))*.4;
 vec3 top=mix(vec3(.055,.13,.21),vec3(.008,.018,.045),storm);
 vec3 col=mix(vec3(.18,.27,.32),top,smoothstep(0.,.9,skyUV.y));
 col*=.66+cloud*.32;
 col*=mix(1.,.38,storm*(1.-smoothstep(0.,.45,skyUV.y)));
 float fire=exp(-skyUV.y*10.)*(.6+.4*noise(vec2(skyUV.x*30.,clock*.1)));
 col+=vec3(1.5,.12,.009)*fire*(s*s*.9+attack*.12);
 float curtain=sin(skyUV.x*24.+sin(skyUV.x*11.+clock*.035)*2.2)*.035+.55;
 float aurora=exp(-abs(skyUV.y-curtain)*35.)*smoothstep(.15,.35,skyUV.y)*(1.-smoothstep(.68,.95,skyUV.y));
 col+=vec3(.025,.3,.24)*aurora*storm*(.3+cloud*.3);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const particleVertex = `
attribute vec3 anchor; attribute vec4 data; attribute vec2 extent;
uniform float clock; uniform float motion; uniform float span; uniform float strength;
varying vec2 vUv; varying vec4 vData;
void main(){
 vUv=uv;vData=data;
 vec3 p=anchor;
 if(data.x>1.5&&data.x<2.5){
  float cycle=fract(clock*.13+data.y);
  p.x+=cycle*span*.2*motion;p.y-=cycle*span*.28*motion;
 }
 if(data.x>.5&&data.x<1.5){p.x+=sin(clock*.18+data.y*18.)*extent.x*.12*motion;}
 vec4 center=modelViewMatrix*vec4(p,1.);
 vec2 size=extent;
 if(data.x<.5){size*=mix(.18,1.,smoothstep(0.,10.,strength));}
 center.xy+=position.xy*size;
 gl_Position=projectionMatrix*center;
}`;
export const particleFragment = `
precision highp float;
uniform float strength; uniform float clock; uniform float attack; uniform float flare; uniform float motion;
varying vec2 vUv; varying vec4 vData;
void main(){
 vec2 p=vUv*2.-1.;float kind=vData.x;
 float lit=smoothstep(vData.z-.8,vData.z+.8,strength);
 vec3 col=vec3(1.);float a=0.;
 if(kind<.5){
  float flick=1.+motion*.10*sin(clock*5.+vData.y*19.);
  float taper=(1.-vUv.y*.68)*(1.+motion*.12*sin(vUv.y*19.+clock*3.+vData.y*12.));
  float flame=exp(-pow(p.x/(taper*.68),2.)*3.-pow((p.y+.18)*1.6,2.));
  float glow=exp(-dot(p,p)*3.8);
  col=mix(vec3(1.2,.055,.003),vec3(2.2,.65,.06),flame);
  a=(flame*.96+glow*.35)*lit*flick*(1.+attack*.15);
 }else if(kind<1.5){
  float shape=exp(-pow(p.x*(1.5+vUv.y*.6)+sin(vUv.y*13.+vData.y*12.+clock*.18*motion)*.19,2.)*3.);
  a=shape*smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.38,1.,vUv.y))*.39*lit*smoothstep(0.,4.,strength);
  col=mix(vec3(.012,.019,.028),vec3(.055,.068,.08),vUv.y);
 }else if(kind<2.5){
  lit=smoothstep(6.7,12.,strength);
  a=exp(-pow(p.x+p.y*.48,2.)*100.-p.y*p.y*5.)*lit*.65;
  col=vec3(.78,.9,1.);
 }else{
  lit=smoothstep(6.4,8.1,strength);
  float glow=exp(-dot(p,p)*5.5);
  a=glow*max(lit,flare)*(.65+flare*.35);
  col=mix(vec3(1.6,.55,.10),vec3(2.5,1.5,.45),flare);
 }
 gl_FragColor=vec4(col,clamp(a,0.,.94));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const waveFragment = `varying vec2 vUv;uniform float wave;uniform float reduced;
void main(){
 float front=1.-wave;
 float band=exp(-pow((vUv.y-front)*14.,2.));
 float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.88,1.,vUv.x));
 float fade=sin(wave*3.14159265);
 gl_FragColor=vec4(.39,.72,.9,mix(band,.4,reduced)*edge*fade*.60);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

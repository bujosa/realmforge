export const skyVertex = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
`;
export const skyFragment = `
precision highp float;
uniform float strength; uniform float clock; uniform float attack;
varying vec2 vUv;
${noise}
void main(){
 vec2 skyUV=vUv*vec2(1.,1.8461538);
 float s=strength/12.,storm=smoothstep(4.,12.,strength);
 float cloud=noise(vec2(skyUV.x*18.-clock*.014,skyUV.y*12.))+noise(vec2(skyUV.x*43.-clock*.02,skyUV.y*26.))*.4;
 vec3 top=mix(vec3(.045,.09,.15),vec3(.002,.005,.015),storm);
 vec3 col=mix(vec3(.13,.19,.24),top,smoothstep(0.,.8,skyUV.y));
 col*=.46+cloud*.32;
 float fire=exp(-skyUV.y*13.)*(.4+.6*noise(vec2(skyUV.x*65.-clock*.04,clock*.17)));
 col+=vec3(1.6,.16,.009)*fire*(s*s+attack*.14);
 // Low, connected, wind-sheared smoke pall, lit only along its underside.
 float pall=exp(-pow((skyUV.y-.13-cloud*.065)*13.,2.))*smoothstep(7.,12.,strength);
 col=mix(col,vec3(.013,.012,.018)+vec3(.15,.025,.003)*exp(-skyUV.y*12.),pall*.86);
 float curtain=sin(skyUV.x*24.+sin(skyUV.x*11.+clock*.035)*2.2)*.035+.55;
 float aurora=exp(-abs(skyUV.y-curtain)*35.)*smoothstep(.15,.35,skyUV.y)*(1.-smoothstep(.68,.95,skyUV.y));
 col+=vec3(.014,.12,.115)*aurora*storm*(.3+cloud*.3);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const groundFragment = `varying vec2 vUv;uniform float strength;
void main(){float dusk=smoothstep(3.,12.,strength);gl_FragColor=vec4(.009,.025,.045,dusk*.80);}`;
export const particleVertex = `
attribute vec3 anchor; attribute vec4 data; attribute vec2 extent;
uniform float clock; uniform float motion; uniform float span; uniform float depth; uniform float strength;uniform float attack;uniform float wave;
varying vec2 vUv; varying vec4 vData;
void main(){
 vUv=uv;vData=data;vec3 p=anchor;vec2 size=extent;
 if(data.x>1.5&&data.x<2.5){float cycle=fract(clock*.19+data.y);p.x+=cycle*span*.25*motion;p.y-=cycle*span*.28*motion;}
 if(data.x>.5&&data.x<1.5){p.x+=(sin(clock*.6+data.y*18.)*.12+sin(clock*.23+data.y*7.)*.1)*extent.x*motion;size*=1.+sin(clock*.4+data.y*11.)*.08*motion;}
 if(data.x>5.5&&data.x<6.5){float cycle=fract(clock*.42+data.y);p.x+=cycle*span*.035*motion;p.y+=cycle*span*.14*motion;size*=1.-cycle*.65;}
 if(data.x>6.5&&data.x<7.5){float progress=mix(.45,wave,motion);p.z+=progress*depth*.9;p.y*=1.-progress*.75;p.x+=sin(data.y*27.+clock*2.)*span*.015*motion;}
 if(data.x>7.5){p.z+=attack*span*.10*motion;}
 vec4 center=modelViewMatrix*vec4(p,1.);
 if(data.x>3.5&&data.x<4.5){center=modelViewMatrix*vec4(p+vec3(position.x*size.x,0.,position.y*size.y),1.);}
 else{center.xy+=position.xy*size;}
 gl_Position=projectionMatrix*center;
}`;
export const particleFragment = `
precision highp float;
uniform float strength;uniform float clock;uniform float attack;uniform float flare;uniform float motion;uniform float wave;uniform float watch;uniform float retreat;
varying vec2 vUv;varying vec4 vData;
${noise}
void main(){
 vec2 p=vUv*2.-1.;float kind=vData.x,seed=vData.y;
 float lit=smoothstep(vData.z-.8,vData.z+.8,strength);
 vec3 col=vec3(1.);float a=0.;
 if(kind<.5||kind>3.5&&kind<6.5)lit*=mix(.12,1.,smoothstep(0.,6.,strength));
 if(kind<.5||kind>2.5&&kind<3.5||kind>7.5){
  float beacon=step(2.5,kind)*(1.-step(3.5,kind));
  if(beacon>.5)lit=max(smoothstep(6.4,8.1,strength),flare);
  if(kind>7.5)lit=attack;
  float t=clock*motion;
  float flick=1.+motion*(.10*sin(t*11.+seed*27.)+.07*sin(t*17.+seed*5.));
  float bend=sin(vUv.y*8.-t*5.+seed*24.)*.16*vUv.y+sin(vUv.y*19.-t*7.+seed*7.)*.07;
  float taper=max(.07,(1.-vUv.y)*.72);
  float body=exp(-pow((p.x+bend)/(taper*flick),2.)*1.8)*smoothstep(0.,.14,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));
  float tongue=exp(-pow((p.x-bend*.8+.16)/(taper*.5),2.)*2.)*(1.-smoothstep(.38,.95,vUv.y));
  float core=exp(-pow(p.x*4.,2.)-pow((vUv.y-.18)*6.,2.));
  a=(body*.9+tongue*.32+core*.7)*lit;
  col=mix(vec3(2.7,.20,.008),vec3(4.,1.6,.28),clamp(core+body*(1.-vUv.y)*.5,0.,1.));
  col*=1.+beacon*flare*.5;
 }else if(kind<1.5){
  vec2 q=p; q.x+=sin(q.y*4.+clock*.36*motion+seed*21.)*.12;
  float cloud=noise(vUv*4.+vec2(-clock*.14*motion,seed*29.));
  float shape=exp(-dot(q,q)*2.7)*( .4+cloud*.75);
  float puff=watch*exp(-pow((retreat-seed*.65-.12)*7.,2.));
  a=shape*(lit*.55*smoothstep(0.,4.,strength)+puff*.7);
  col=mix(vec3(.045,.027,.026),vec3(.095,.09,.10),vUv.y);
  col+=vec3(.45,.07,.008)*pow(1.-vUv.y,3.)*lit;
 }else if(kind<2.5){
  lit=smoothstep(6.7,12.,strength);
  a=exp(-pow(p.x+p.y*.48,2.)*120.-p.y*p.y*5.)*lit*.45;col=vec3(.48,.65,.8);
 }else if(kind<4.5){
  a=exp(-dot(p,p)*3.8)*lit*.22;col=vec3(1.8,.32,.025);
 }else if(kind<5.5){
  a=exp(-dot(p,p)*4.6)*max(lit,flare*vData.w)*.26;col=vec3(1.5,.20,.008);
 }else if(kind<6.5){
  a=exp(-dot(p,p)*9.)*lit*(.5+.5*sin(seed*31.+clock*7.*motion));col=vec3(3.,.85,.06);
 }else{
  float clouds=noise(vUv*5.+vec2(-clock*.3*motion,seed*23.));
  a=exp(-dot(p,p)*1.8)*sin(wave*3.14159265)*(.22+clouds*.30);
  col=mix(vec3(.13,.34,.53),vec3(.68,.89,1.),clouds);
 }
 gl_FragColor=vec4(col,clamp(a,0.,.94));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const waveFragment = `varying vec2 vUv;uniform float wave;uniform float reduced;uniform float clock;
${noise}
void main(){
 float distance=1.-vUv.y,front=mix(wave,.55,reduced);
 float band=exp(-pow((distance-front)*21.,2.));
 float frost=smoothstep(distance-.02,distance+.03,front);
 float edge=smoothstep(0.,.06,vUv.x)*(1.-smoothstep(.94,1.,vUv.x));
 float grain=noise(vUv*vec2(55.,90.));
 float fade=smoothstep(0.,.1,wave)*(1.-smoothstep(.84,1.,wave));
 vec3 col=mix(vec3(.25,.52,.72),vec3(.80,.95,1.),band);
 gl_FragColor=vec4(col,(band*.85+frost*(.21+grain*.26))*edge*fade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

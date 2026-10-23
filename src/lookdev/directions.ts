import * as THREE from "three";

export type Look = "A" | "B" | "C";
export type Quality = "High" | "Balanced";
export type Pose = "World x20" | "Regional" | "Close" | "Essos" | "Free flight";
/** Chosen B calibration, carried back from three regional game review rounds.
 * Coordinates describe this synthetic study, never production geography. */
export const groundedRealism = {
  moor: "#879933", frost: "#bdc9bb", pasture: "#618537", cereal: "#c49e4d",
  vines: "#4b642d", valley: "#748b43", woodland: "#344c24",
  parcelSize: [3.2, 3.8] as const, parcelBlend: 0.88, frostStrength: 0.22,
  moorStrength: 0.66, valleyStrength: 0.72, crownWidth: 1.15,
  crownShade: [0.70, 1.20] as const, seaSpecular: 0.30, foamStrength: 0.55,
  hazeLimit: 0.00168,
};
export interface Direction {
  grounding?: typeof groundedRealism;
  name: string; subtitle: string; grass: string; north: string; dry: string;
  rock: string; sand: string; snow: string; sea: string; shallow: string;
  sky: string; horizon: string; sun: string; sunPower: number; ambient: number;
  exposure: number; fog: number; photo: number; foliage: string;
}
export const directions: Record<Look, Direction> = {
  A: { name:"Painterly realism", subtitle:"A living atlas · luminous valleys, quiet seas", grass:"#738a43",north:"#587563",dry:"#b7a563",rock:"#93978d",sand:"#d5c28f",snow:"#e4ebdf",sea:"#194b5d",shallow:"#65a89d",sky:"#a3c2c6",horizon:"#d9d9bf",sun:"#fff0cf",sunPower:2.5,ambient:1.75,exposure:1.05,fog:0.0025,photo:0.10,foliage:"#436038" },
  B: { grounding:groundedRealism, name:"Grounded realism", subtitle:"Stone, salt and living forest · natural afternoon",grass:"#748b46",north:"#67774b",dry:"#af9c61",rock:"#858786",sand:"#bdb38e",snow:"#d6dedb",sea:"#103c50",shallow:"#558f87",sky:"#92b1bd",horizon:"#d7d8ce",sun:"#ffedce",sunPower:3.1,ambient:1.2,exposure:1.0,fog:groundedRealism.hazeLimit,photo:0.92,foliage:"#344b34" },
  C: { name:"Series mood", subtitle:"The cold North, the golden South · weather over the strait",grass:"#73734a",north:"#3d5754",dry:"#b59b56",rock:"#697675",sand:"#b9ac82",snow:"#d6e0dc",sea:"#183c46",shallow:"#527b77",sky:"#607984",horizon:"#bdc3bc",sun:"#ffd49b",sunPower:2.8,ambient:1.0,exposure:0.94,fog:0.0055,photo:0.65,foliage:"#344b40" },
};
export const hash = (x: number, z: number): number => {
  const n = Math.sin(x*127.1+z*311.7)*43758.5453123; return n-Math.floor(n);
};
export function noise(x: number, z: number): number {
  const ix=Math.floor(x),iz=Math.floor(z); let fx=x-ix,fz=z-iz;fx=fx*fx*(3-2*fx);fz=fz*fz*(3-2*fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),fx),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),fx),fz);
}
export const riverX = (z:number):number => -5+2.4*Math.sin(z*0.14)+0.9*Math.sin(z*0.38);
export const westCoast = (z:number):number => 14+3.2*Math.sin(z*0.115)+1.3*Math.sin(z*0.36);
export const eastCoast = (z:number):number => 37+3.1*Math.sin(z*0.13+1.8)+Math.sin(z*0.46);
export function heightAt(x:number,z:number):number {
  const east=x>26;
  const shore=east ? x-eastCoast(z) : Math.min(westCoast(z)-x,26-z+2*Math.sin(x*0.19));
  const n=noise(x*0.13,z*0.13),detail=noise(x*0.65,z*0.65);
  const peak=(px:number,pz:number,r:number,h:number):number => h*Math.exp(-((x-px)**2+(z-pz)**2)/r);
  const ridge=Math.max(0.0,1-Math.abs(noise(x*0.19,z*0.19)*2-1));
  const mountains=east ? peak(66,-26,180,9)+peak(58,-42,90,6) : peak(-22,-29,130,13)+peak(-13,-38,75,11)+peak(-28,-12,95,6);
  const relief=0.5+n*1.9+detail*0.12+mountains*(0.48+ridge*ridge*0.73)+(noise(x*1.2,z*1.2)-.5)*mountains*.075;
  const coast=THREE.MathUtils.smoothstep(shore,-1.2,5.3);
  let h=THREE.MathUtils.lerp(-2.7,relief,coast);
  if(!east && z>-30) {
    const river=Math.abs(x-riverX(z));
    h=Math.min(h,THREE.MathUtils.lerp(-0.28,h,THREE.MathUtils.smoothstep(river,0.52,1.12)));
  }
  // Flat inhabited terraces are blended into the same continuous terrain.
  for(const [sx,sz,r] of [[-12,7,3.7],[-8,16,4.7],[47,5,7.1]]) {
    const d=Math.hypot(x-sx,z-sz),k=1-THREE.MathUtils.smoothstep(d,r,r+1.6);
    h=THREE.MathUtils.lerp(h,sx>26 ? 1.75 : 1.3,k);
  }
  return h;
}
/** Identical analytic geography for water depth, shore foam and terrain shading. */
export const geographyGLSL = `
float ldHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float ldNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(ldHash(i),ldHash(i+vec2(1,0)),f.x),mix(ldHash(i+vec2(0,1)),ldHash(i+vec2(1)),f.x),f.y);}
float ldWest(float z){return 14.0+3.2*sin(z*.115)+1.3*sin(z*.36);}
float ldEast(float z){return 37.0+3.1*sin(z*.13+1.8)+sin(z*.46);}
float ldRiver(float z){return -5.0+2.4*sin(z*.14)+.9*sin(z*.38);}
float ldShore(vec2 p){return p.x>26.0?p.x-ldEast(p.y):min(ldWest(p.y)-p.x,26.0-p.y+2.0*sin(p.x*.19));}
float ldPeak(vec2 p,vec2 centre,float r,float h){return h*exp(-dot(p-centre,p-centre)/r);}
float ldHeight(vec2 p){
 bool east=p.x>26.0;float mountains=east?ldPeak(p,vec2(66,-26),180.0,9.0)+ldPeak(p,vec2(58,-42),90.0,6.0):ldPeak(p,vec2(-22,-29),130.0,13.0)+ldPeak(p,vec2(-13,-38),75.0,11.0)+ldPeak(p,vec2(-28,-12),95.0,6.0);
 float ridge=max(0.0,1.0-abs(ldNoise(p*.19)*2.0-1.0));
 float relief=.5+ldNoise(p*.13)*1.9+ldNoise(p*.65)*.12+mountains*(.48+ridge*ridge*.73)+(ldNoise(p*1.2)-.5)*mountains*.075;
 float h=mix(-2.7,relief,smoothstep(-1.2,5.3,ldShore(p)));
 if(!east&&p.y> -30.0)h=min(h,mix(-.28,h,smoothstep(.52,1.12,abs(p.x-ldRiver(p.y)))));
 float k=1.0-smoothstep(3.7,5.3,length(p-vec2(-12,7)));h=mix(h,1.3,k);
 k=1.0-smoothstep(4.7,6.3,length(p-vec2(-8,16)));h=mix(h,1.3,k);
 k=1.0-smoothstep(7.1,8.7,length(p-vec2(47,5)));return mix(h,1.75,k);
}`;

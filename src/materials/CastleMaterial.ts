import * as THREE from "three";
import AssetMaterials from "./AssetMaterials";

export interface CastleSurfaces { castle?: { albedo: THREE.DataArrayTexture; roughness: THREE.DataArrayTexture; normal: THREE.DataArrayTexture } }

// The existing ambientCG masonry and timber maps stay owned by AssetMaterials.
// Surface tags keep roofs, timber and window glow in a single castle draw.
export default class CastleMaterial extends THREE.MeshStandardMaterial {
  private worldSurfaces?: CastleSurfaces;
  private dusk = { value: 0 };
  private winter = { value: 0 };
  private timber: THREE.MeshStandardMaterial;
  private woodNormal = { value: null as THREE.Texture | null };
  private woodRoughness = { value: null as THREE.Texture | null };
  private woodReady = { value: 0 };

  constructor(assets?: AssetMaterials) {
    super({ color: "#ffffff", roughness: 0.86, vertexColors: true });
    this.timber = new THREE.MeshStandardMaterial();
    assets?.register(this, "stone");
    assets?.register(this.timber, "wood");
    this.onBeforeCompile = (shader) => {
      if (this.worldSurfaces?.castle) {
        const surfaces = this.worldSurfaces.castle;
        Object.assign(shader.uniforms, {
          lookCastleAlbedo: { value: surfaces.albedo },
          lookCastleRoughness: { value: surfaces.roughness },
          lookCastleNormal: { value: surfaces.normal }
        });
        shader.fragmentShader = `uniform highp sampler2DArray lookCastleAlbedo;
          uniform highp sampler2DArray lookCastleRoughness;
          uniform highp sampler2DArray lookCastleNormal;
` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          if (vCastleSurface.x < 1.5) {
            float layer = step(0.5,vCastleSurface.x);
            vec2 lookUv = vCastleUv * vec2(3.0,4.0);
            vec3 photo = texture(lookCastleAlbedo,vec3(lookUv,layer)).rgb;
            float grain = clamp(dot(photo,vec3(0.2126,0.7152,0.0722))*3.0,0.65,1.35);
            diffuseColor.rgb *= mix(vec3(1.22,1.12,0.91),vec3(1.35,0.91,0.65),layer)*grain;
          }`);
        shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          if (vCastleSurface.x < 1.5) roughnessFactor = clamp(texture(lookCastleRoughness,vec3(vCastleUv*vec2(3.0,4.0),step(0.5,vCastleSurface.x))).r,0.72,1.0);`);
        shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
          if (vCastleSurface.x < 1.5) {
            vec2 xy = texture(lookCastleNormal,vec3(vCastleUv*vec2(3.0,4.0),step(0.5,vCastleSurface.x))).rg*2.0-1.0;
            float bump = (xy.x+xy.y)*0.00035;
            vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
            vec3 r1=cross(q1,normal),r2=cross(normal,q0);
            float det=dot(q0,r1);
            normal=normalize(abs(det)*normal-sign(det)*(dFdx(bump)*r1+dFdy(bump)*r2));
          }`);
      }
      shader.uniforms.castleDusk = this.dusk;
      shader.uniforms.castleWinter = this.winter;
      shader.uniforms.castleWoodNormal = this.woodNormal;
      shader.uniforms.castleWoodRoughness = this.woodRoughness;
      shader.uniforms.castleWoodReady = this.woodReady;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        attribute vec3 castleSurface;
        attribute float castleSkirt;
        attribute float instanceCastleDepth;
        varying vec3 vCastleSurface;
        varying vec2 vCastleUv;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vCastleSurface = castleSurface;
          vCastleUv = uv;
          transformed.y -= castleSkirt * instanceCastleDepth;`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        varying vec3 vCastleSurface;
        varying vec2 vCastleUv;
        uniform float castleDusk;
        uniform float castleWinter;
        uniform float castleWoodReady;
        uniform sampler2D castleWoodNormal;
        uniform sampler2D castleWoodRoughness;
        float castleRelief(vec2 uv) {
          vec2 grid = uv * vec2(19.0,28.0);
          grid.x += mod(floor(grid.y),2.0) * 0.5;
          vec2 joint = abs(fract(grid) - 0.5);
          vec2 pixel = max(fwidth(grid),vec2(0.005));
          float mortar = max(smoothstep(0.43-pixel.x,0.49,joint.x),smoothstep(0.40-pixel.y,0.48,joint.y));
          float grain = sin(uv.x*627.0 + sin(uv.y*183.0)) * sin(uv.y*539.0);
          return (grain*0.0002 - mortar*0.0012) * (1.0-smoothstep(0.25,0.8,max(pixel.x,pixel.y)));
        }`)
        .replace("#include <color_fragment>", `#include <color_fragment>
          float roof = step(0.5, vCastleSurface.x) * (1.0 - step(2.5, vCastleSurface.x));
          float wood = step(1.5, vCastleSurface.x) * (1.0 - step(2.5, vCastleSurface.x));
          float roofScale = vCastleUv.y * 16.0;
          float roofPixel = max(fwidth(roofScale), 0.015);
          float courses = smoothstep(0.88 - roofPixel, 1.0, fract(roofScale)) * (1.0 - smoothstep(0.3, 0.9, roofPixel));
          diffuseColor.rgb *= 1.0 - roof * courses * 0.12;
          // Staggered stone courses, independent of controller and asset loading.
          vec2 masonry = vCastleUv * vec2(19.0, 28.0);
          masonry.x += mod(floor(masonry.y), 2.0) * 0.5;
          vec2 cell = floor(masonry);
          vec2 pixel = max(fwidth(masonry), vec2(0.01));
          vec2 joint = abs(fract(masonry) - 0.5);
          float mortar = max(smoothstep(0.46 - pixel.x,0.5,joint.x),smoothstep(0.43 - pixel.y,0.5,joint.y));
          float detail = 1.0 - smoothstep(0.22,0.75,max(pixel.x,pixel.y));
          float stoneTone = fract(sin(dot(cell,vec2(127.1,311.7))) * 43758.5453);
          float masonryShade = mix(0.82,1.12,stoneTone) * (1.0 - mortar * 0.15);
          diffuseColor.rgb *= mix(1.0,masonryShade,detail * (1.0 - step(0.5,vCastleSurface.x)));
          float weathering = sin(vCastleUv.x * 97.0 + sin(vCastleUv.x * 39.0)) * 0.5 + 0.5;
          float damp = (1.0-smoothstep(0.0,0.21,vCastleUv.y)) * weathering;
          diffuseColor.rgb *= 1.0 - damp * 0.15 * (1.0-step(0.5,vCastleSurface.x));
          // Tag 7 vegetation keeps its painted colour without rock seams.
          if (vCastleSurface.x > 5.5 && vCastleSurface.x < 6.5) {
            // New Vale rock: broken vertical seams and fine mineral variation,
            // rather than the broad continuous rings of the older sea stacks.
            float mineral = sin(vCastleUv.x*157.0+sin(vCastleUv.y*67.0))*sin(vCastleUv.y*131.0);
            float fissure = abs(sin(vCastleUv.x*43.0+sin(vCastleUv.y*17.0)*0.32));
            diffuseColor.rgb *= 0.91 + mineral*0.035 - smoothstep(0.92,1.0,fissure)*0.075;
          } else if (vCastleSurface.x > 4.5 && vCastleSurface.x < 5.5) {
            float strata = sin(vCastleUv.y*104.0+sin(vCastleUv.x*28.0))*0.5+0.5;
            diffuseColor.rgb *= 0.79 + strata*0.18;
          }
          float snow = castleWinter * vCastleSurface.z;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.79, 0.87, 0.9), snow * 0.88);`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, max(0.55, roughnessFactor * 0.86), roof);
          if (wood > 0.5 && castleWoodReady > 0.5) {
            roughnessFactor = texture2D(castleWoodRoughness, vCastleUv * vec2(2.0, 3.0)).g;
          }
          if (vCastleSurface.x > 3.5 && vCastleSurface.x < 4.5) { roughnessFactor = 0.28; }
          if (vCastleSurface.x > 4.5) { roughnessFactor = 0.94; }`)
        .replace("#include <normal_fragment_maps>", `
          #ifdef USE_NORMALMAP
            if (vCastleSurface.x < 1.5) {
              #include <normal_fragment_maps>
            } else if (wood > 0.5 && castleWoodReady > 0.5) {
              vec3 grain = texture2D(castleWoodNormal, vCastleUv * vec2(2.0, 3.0)).xyz * 2.0 - 1.0;
              grain.xy *= 0.12;
              normal = normalize(tbn * grain);
            }
          #endif
          if (vCastleSurface.x < 0.5) {
            float height = castleRelief(vCastleUv);
            vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
            vec3 r1 = cross(q1,normal), r2 = cross(normal,q0);
            float determinant = dot(q0,r1);
            normal = normalize(abs(determinant)*normal - sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2));
          }`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.49, 0.16) * vCastleSurface.y * castleDusk * 0.85;`);
    };
    this.customProgramCacheKey = () => `castle-surfaces-v7:${!!this.worldSurfaces?.castle}`;
  }

  setSurfaces(surfaces?: CastleSurfaces): void { this.worldSurfaces = surfaces; this.needsUpdate = true; }

  setSeason(dusk: boolean, winter: boolean, full: boolean): void {
    this.dusk.value = dusk && full ? 1 : 0;
    this.winter.value = winter && full ? 1 : 0;
    this.woodNormal.value = this.timber.normalMap;
    this.woodRoughness.value = this.timber.roughnessMap;
    this.woodReady.value = this.timber.normalMap ? 1 : 0;
  }

  dispose(): void {
    this.woodNormal.value = this.woodRoughness.value = null;
    this.timber.dispose();
    super.dispose();
  }
}

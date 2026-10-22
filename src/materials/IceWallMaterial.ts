import * as THREE from "three";

// Layered blue ice with a solid silhouette. No expensive transmission pass;
// the near-opaque skin reveals depth through colour, strata and glancing sheen.
export default class IceWallMaterial extends THREE.MeshStandardMaterial {
  private detail = { value: 1 };

  constructor() {
    super({ color: "#ffffff", vertexColors: true, roughness: 0.34, metalness: 0.03, emissive: "#8ecde9", emissiveIntensity: 0.045 });
    this.onBeforeCompile = shader => {
      shader.uniforms.iceWallDetail = this.detail;
      shader.vertexShader = "varying vec3 iceWallPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        iceWallPosition = position;
        #ifdef USE_INSTANCING
          iceWallPosition = (instanceMatrix * vec4(position,1.0)).xyz;
        #endif
      `);
      shader.fragmentShader = "varying vec3 iceWallPosition;\nuniform float iceWallDetail;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float phase = iceWallPosition.y * 44.0 + sin(iceWallPosition.x * 9.0) * 0.6;
        float strata = sin(phase) * (1.0 - smoothstep(0.35, 1.5, fwidth(phase)));
        diffuseColor.rgb *= 0.94 + strata * 0.055;
        float crack = pow(max(0.0, sin(iceWallPosition.x * 47.0 + sin(iceWallPosition.y * 9.0) * 0.7)),32.0);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.25,0.46,0.57),crack * 0.20 * iceWallDetail);
        float sparkle = 0.025;
        float glancing = pow(1.0 - abs(dot(normalize(vNormal),normalize(vViewPosition))),3.0);
        diffuseColor.rgb += vec3(0.28,0.43,0.5) * sparkle * glancing * iceWallDetail;
      `);
    };
    this.customProgramCacheKey = () => "layered-ice-wall-v3";
  }

  setDetail(full: boolean): void { this.detail.value = full ? 1 : 0; }
}

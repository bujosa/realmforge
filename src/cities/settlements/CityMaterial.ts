import CastleMaterial from "../../materials/CastleMaterial";
import AssetMaterials from "../../materials/AssetMaterials";

// The castle surface shader (masonry, roof courses, timber maps, dusk windows,
// winter snow, foundation skirt) plus per-instance kit inputs for the global
// kit pool (realism/kits/pool):
// - cityWall multiplies plaster/stone, cityRoof multiplies roofs;
// - cityKit.x is the instance's option mask: a part tagged with kitShape.y is
//   drawn only when all its bits are present (others collapse to a point);
// - cityKit.y scales roof height above the eave (kitShape.x), with the
//   matching normal correction, so one geometry serves low terracotta and
//   steep northern roofs; mask bit 32 renders surface 0 as lime plaster;
// - cityKit.z scales the baked winter snow.
// Non-instanced silhouettes/landmarks compile without those attributes.
export default class CityMaterial extends CastleMaterial {
  constructor(assets?: AssetMaterials) {
    super(assets);
    const castle = this.onBeforeCompile;
    this.onBeforeCompile = (shader, renderer) => {
      castle(shader, renderer);
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        #ifdef USE_INSTANCING
          attribute vec3 cityWall;
          attribute vec3 cityRoof;
          attribute vec3 cityKit;
          attribute vec2 kitShape;
        #endif`)
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
          #ifdef USE_INSTANCING
            // y' = eave + (y - eave) * pitch → n' ∝ (nx * pitch, ny, nz * pitch).
            if (kitShape.x > 0.0 || (castleSurface.x > 0.5 && castleSurface.x < 1.5)) objectNormal = normalize(vec3(objectNormal.x * cityKit.y, objectNormal.y, objectNormal.z * cityKit.y));
          #endif`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          #ifdef USE_INSTANCING
            transformed.y += kitShape.x * (cityKit.y - 1.0);
          #endif`)
        .replace("#include <color_vertex>", `#include <color_vertex>
          #if defined( USE_INSTANCING ) && defined( USE_COLOR )
            float cityRoofSurface = step(0.5, castleSurface.x) * (1.0 - step(1.5, castleSurface.x));
            float cityWallSurface = 1.0 - step(0.5, castleSurface.x);
            vColor.rgb *= mix(vec3(1.0), cityRoof, cityRoofSurface) * mix(vec3(1.0), cityWall, cityWallSurface);
          #endif`)
        .replace("#include <project_vertex>", `#ifdef USE_INSTANCING
            vCastleSurface.z *= cityKit.z;
            int kitMask = int(cityKit.x + 0.5);
            // Lime plaster: one masonry cell, so no mortar lines or relief.
            if ((kitMask & 32) != 0 && castleSurface.x < 0.5) vCastleUv = vec2(0.5 / 19.0, 0.3);
            int kitPart = int(kitShape.y + 0.5);
            // Optional part absent from this instance: degenerate, no fragments.
            if ((kitPart & kitMask) != kitPart) transformed = vec3(0.0);
          #endif
          #include <project_vertex>`);
    };
    const baseKey = this.customProgramCacheKey;
    this.customProgramCacheKey = () => `city-surfaces-v2:${baseKey()}`;
  }

  /** Cities answer the public season on every World tier (cheap uniforms),
   * unlike the castle sculpts, which keep their High-only full detail. */
  setSeason(dusk: boolean, winter: boolean, full: boolean): void {
    super.setSeason(dusk && full, winter, true);
  }
}

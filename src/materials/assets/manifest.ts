// Imported only after a rendered High frame. Webpack emits every file into dist;
// URLs honour publicPath in the production Docker image as well as local builds.
import woodColor from "./files/wood-color.webp";
import woodNormal from "./files/wood-normalgl.webp";
import woodRoughness from "./files/wood-roughness.webp";
import paperNormal from "./files/paper-normalgl.webp";
import paperRoughness from "./files/paper-roughness.webp";
import stoneNormal from "./files/stone-normalgl.webp";
import stoneRoughness from "./files/stone-roughness.webp";
import metalNormal from "./files/metal-normalgl.webp";
import metalRoughness from "./files/metal-roughness.webp";
import castle from "./files/castle-kit.glb?url";

export const surfaces = {
  wood: { color: woodColor, normal: woodNormal, roughness: woodRoughness },
  paper: { normal: paperNormal, roughness: paperRoughness },
  stone: { normal: stoneNormal, roughness: stoneRoughness },
  metal: { normal: metalNormal, roughness: metalRoughness }
};
export { castle };

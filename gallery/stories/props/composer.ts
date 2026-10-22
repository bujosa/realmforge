import * as THREE from "three";
import { registerStories } from "../../registry";
import { shape } from "../../../src/props/ComposedShapes";
import { DRAWABLE_VARIANTS } from "../../../src/props/ComposedVariants";
import { titleCase } from "../../../src/presets/demo";
for(const variant of DRAWABLE_VARIANTS) registerStories({
  id:`props/composed-${variant}`,title:`${titleCase(variant)} · composer module`,category:"Props",description:"Original production composer fallback shape. Normalized footprint and height; host scales by physical w × h × d. Ten utility modules include original joinery and open silhouettes, with a 1,500-triangle ceiling per refined module. The higher-detail physical kit is available under Cities & seats.",
  controls: {
    wall: { type: "colour", label: "Body tint", default: "#b9aa8a" },
    roof: { type: "colour", label: "Roof tint", default: "#586558" },
  },
  build({ values }) {
    const geometry = shape(variant).clone(), colours = geometry.getAttribute("color"), roofs = geometry.getAttribute("roofPart");
    const body = new THREE.Color(String(values.wall)), roof = new THREE.Color(String(values.roof));
    for (let i = 0; i < colours.count; i++) {
      const tint = roofs.getX(i) ? roof : body;
      colours.setXYZ(i, colours.getX(i) * tint.r, colours.getY(i) * tint.g, colours.getZ(i) * tint.b);
    }
    return { object: new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })) };
  },
});

import * as THREE from "three";
import { registerStories } from "../registry";
import { worldMiniatureColor, worldMiniatureGeometry } from "../../src/pieces/miniatures";
import { companyGeometry } from "../../src/pieces/WorldCompanies";
import { demoHouses, demoColors, titleCase } from "../../src/presets/demo";

for (const type of ["footman", "knight", "siege-engine", "ship", "dragon"]) {
  registerStories({
    id: `pieces/${type}`, title: titleCase(type), category: "Pieces",
    description: "Current production sculpt, all ten demo colors. A reference for comparison with the next army system. Original dimensions are preserved.",
    controls: {
      house: { type: "select", label: "House", default: "all", options: ["all", ...demoHouses] },
      detailed: { type: "boolean", label: "Detailed geometry", default: true },
      colour: { type: "colour", label: "Paint tint", default: "#b3261e" },
    },
    build({ values }) {
      const group = new THREE.Group();
      const houses = values.house === "all" ? demoHouses : [String(values.house)];
      houses.forEach((house, index) => {
        const color = worldMiniatureColor(house, houses.length === 1 ? String(values.colour) : demoColors[house]);
        const mesh = new THREE.Mesh(worldMiniatureGeometry(type, house, color, Boolean(values.detailed)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
        mesh.position.x = (index - (houses.length - 1) / 2) * (type === "dragon" ? 1.7 : 1.2);
        group.add(mesh);
      });
      return { object: group };
    },
  });
}
for (const type of ["footman", "knight", "siege-engine"]) registerStories({
  id: `pieces/company-${type}`, title: `Current company · ${titleCase(type)}`, category: "Pieces",
  controls: { detailed: { type: "boolean", label: "Detailed geometry", default: true } },
  build({ values }) { return { object: new THREE.Mesh(companyGeometry(type, Boolean(values.detailed)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })) }; },
});

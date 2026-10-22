import * as THREE from "three";
import { registerStories } from "../registry";
import { worldMiniatureColor, worldMiniatureGeometry } from "../../src/pieces/miniatures";

const houses = ["stark", "lannister", "baratheon", "greyjoy", "tyrell", "martell"];
const fallback: Record<string, string> = {
  stark: "#d8d8d8", lannister: "#b3261e", baratheon: "#e0b31c", greyjoy: "#1c1c1c", tyrell: "#2e7d32", martell: "#e66b16",
};

for (const type of ["footman", "knight", "siege-engine", "ship"]) {
  registerStories({
    id: `pieces/${type}`,
    title: type,
    category: "Pieces (current)",
    build() {
      const group = new THREE.Group();
      houses.forEach((house, index) => {
        const color = worldMiniatureColor(house, fallback[house]);
        const geometry = worldMiniatureGeometry(type, house, color, true);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
        mesh.position.x = (index - (houses.length - 1) / 2) * 1.2;
        group.add(mesh);
      });
      return {
        object: group,
        dispose() {
          group.traverse(child => {
            if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
          });
        },
      };
    },
  });
}

import * as THREE from "three";
import { registerStories } from "../../registry";
import { castleGeometry } from "../../../src/castles/castles";
import { natureGeometry } from "../../../src/nature/nature";
import { livestockGeometry } from "../../../src/nature/livestock";
import { companyGeometry } from "../../../src/pieces/WorldCompanies";
import { worldMiniatureGeometry } from "../../../src/pieces/miniatures";
import { cityStudy } from "../../cityStudy";
import { mesh } from "../../story-kit";
registerStories({ id: "scale/production", title: "Production scale lineup", category: "Scale",
  description: "Unmodified relative object sizes at 50 m/u: board castle, complete physical city, current company, ship, tree and sheep. Foundations share Y=0. See docs/scale.md for source citations. City is the complete isolated recipe on synthetic flat ground.",
  build() {
    const group = new THREE.Group();
    const city = cityStudy("kings-landing", "mid");
    const objects = [mesh(castleGeometry("stronghold", "north"), true), city.object, mesh(companyGeometry("footman", true)), mesh(worldMiniatureGeometry("ship", "neutral", "#c8ba99", true)), mesh(natureGeometry("tree-oak")), mesh(livestockGeometry())];
    let x = 0;
    objects.forEach((object, i) => {
      const bounds = new THREE.Box3().setFromObject(object); const width = bounds.max.x - bounds.min.x;
      object.position.x = x - bounds.min.x; x += width + 0.7; group.add(object);
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 80;
      const context = canvas.getContext("2d")!; context.fillStyle = "#f4e6ca"; context.font = "30px system-ui"; context.textAlign = "center"; context.fillText(["Castle", "Great city", "Company", "Ship", "Tree", "Sheep"][i], 256, 48);
      const map = new THREE.CanvasTexture(canvas); const label = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
      label.position.set(object.position.x + (bounds.max.x + bounds.min.x) / 2, 0.02, 0.8); label.scale.set(1.2, 0.19, 1); group.add(label);
    });
    return { object: group, dispose() { city.dispose?.(); group.traverse(child => { if (child instanceof THREE.Sprite) { child.material.map?.dispose(); child.material.dispose(); } }); } };
  },
});

import * as THREE from "three";
import { armyTypes } from "../../../src/armies";
import { registerStories } from "../../registry";
import { houses, terrains, names, lab, swatch, label, select, toggle } from "./support";

for (const type of armyTypes) for (const distance of ["near", "far"] as const) {
  registerStories({
    id: `armies/${type}-${distance}`, category: "Armies", title: `${names[type]} · ${distance}`,
    build(ctx) {
      const compact = matchMedia("(max-width:600px)").matches;
      const view = lab(ctx, `${names[type]} / ${distance === "near" ? "material study" : "strategic view"}`, "Six heraldic palettes. Four surfaces. Contrasting edges keep black and white readable; each company carries its identity on cloth and shields.");
      const selected = new THREE.Group(); view.object.add(selected);
      let houseFilter = compact ? "greyjoy" : "All houses";
      let motion = true;
      const rebuild = (): void => {
        while (view.batch.units.length) view.batch.units[0].remove();
        selected.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
          const material = child.material as THREE.MeshBasicMaterial; material.map?.dispose(); material.dispose();
        } }); selected.clear();
        const palette = houseFilter === "All houses" ? houses : houses.filter(h => h.id === houseFilter);
        const columns = palette.length === 1 ? 2 : 6;
        for (let t = 0; t < terrains.length; t++) for (let h = 0; h < palette.length; h++) {
          const house = palette[h], terrain = terrains[t];
          const index = t * palette.length + h;
          const rows = Math.ceil(terrains.length * palette.length / columns);
          const x = (index % columns - (columns - 1) / 2) * 2.12, z = (Math.floor(index / columns) - (rows - 1) / 2) * 2.3;
          swatch(selected, x, z, terrain.color, 1.95, 2.12);
          selected.add(label(`${house.name} / ${terrain.id}`, x, 0.06, z + 0.91, 1.42, terrain.id === "snow" || terrain.id === "sand" ? "#25352f" : "#eee5cd"));
          view.batch.add({ type, house: house.id, color: house.color, position: { x, z }, heading: Math.PI + 0.22, scale: distance === "far" ? 0.48 : type === "dragon" ? 0.78 : 0.94, lod: distance }).setState("idle");
        }
        view.frame();
      };
      select(view.controls, "House", ["All houses", ...houses.map(h => h.id)], houseFilter, value => { houseFilter = value; rebuild(); });
      toggle(view.controls, "Wind & idle", true, value => { motion = value; view.batch.setPaused(!value); });
      toggle(view.controls, "Reduced motion", false, value => view.batch.setMotionScale(value ? 0 : 1));
      rebuild();
      view.tick = () => { if (!motion) view.batch.setPaused(true); };
      return view;
    },
  });
}

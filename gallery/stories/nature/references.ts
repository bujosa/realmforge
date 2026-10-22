import { registerStories } from "../../registry";
import { natureGeometry } from "../../../src/nature/nature";
import { livestockGeometry } from "../../../src/nature/livestock";
import { titleCase } from "../../../src/presets/demo";
import { mesh } from "../../story-kit";
for (const kind of ["tree-pine", "tree-oak", "tree-birch", "cliff", "mountain-rock", "river-bank"]) registerStories({
  id: `nature/${kind}`, title: titleCase(kind), category: "Nature", controls: { foliage: { type: "colour", label: "Foliage", default: "#40563d" } },
  build: ({ values }) => ({ object: mesh(natureGeometry(kind, String(values.foliage))) }),
});
registerStories({ id: "nature/sheep", title: "Sheep · production livestock", category: "Nature", description: "Original neutral livestock sculpt. About 1.3 m tall at 50 metres per scene unit.", build: () => ({ object: mesh(livestockGeometry()) }) });

import { registerStories } from "../registry";
import { physicalRecipes } from "../../src/presets/physicalCities";
import { cityLayouts } from "../../src/presets/cityLayouts";
import { buildCity } from "../../src/cities/settlements/City";
import type { CityId } from "../../src/cities/settlements/types";
import { cityStudy } from "../cityStudy";

for (const recipe of physicalRecipes) registerStories({
  id: `cities/full-${recipe.id}`, title: `${recipe.name} · complete city`, category: "Cities & seats",
  description: "Full production city recipe on a synthetic flat region, with a straight QA shoreline. Houses retain their physical metre dimensions. This is an isolated recipe study; actual game coastlines produce different layouts.",
  controls: {
    lod: { type: "select", label: "LOD", default: "mid", options: ["near", "mid", "far"] },
    tier: { type: "select", label: "Quality tier", default: "balanced", options: ["high", "balanced"] },
  },
  build: ({ values }) => cityStudy(recipe.id, String(values.lod), values.tier as "high" | "balanced"),
});
for (const id of Object.keys(cityLayouts) as CityId[]) registerStories({
  id: `cities/board-${id}`, title: `${cityLayouts[id].name} · board city`, category: "Cities & seats",
  description: "Original board-scale city recipe, including its keep. Synthetic flat ground isolates the authored layout.",
  controls: { lod: { type: "select", label: "LOD", default: "near", options: ["near", "mid", "far"] } },
  build({ values }) {
    const handle = buildCity(id, { tier: "high", heightAt: () => 0, embedKeep: true, detail: values.lod as "near" | "mid" | "far" });
    return { object: handle.root, dispose: () => handle.dispose() };
  },
});

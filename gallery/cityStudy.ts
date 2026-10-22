import * as THREE from "three";
import PhysicalCity from "../src/cities/settlements/PhysicalCity";
import PhysicalMaterial from "../src/cities/settlements/PhysicalMaterial";
import { physicalKitVariants } from "../src/cities/settlements/PhysicalKit";
import { physicalRecipes } from "../src/presets/physicalCities";
import KitPool from "../src/core/KitPool";
import type { StoryInstance } from "./registry";

/** Stable synthetic site: same recipe and dimensions, no map/streaming dependency. */
export function cityStudy(id: string, lod = "mid", tier: "high" | "balanced" = "balanced"): StoryInstance {
  const recipe = physicalRecipes.find(recipe => recipe.id === id);
  if (!recipe) throw new Error(`Unknown city recipe ${id}`);
  const material = new PhysicalMaterial();
  const pool = new KitPool(physicalKitVariants, false, undefined, material);
  const radius = recipe.radius / 50;
  const coastDistance = recipe.centre === "keep" ? 0 : recipe.centre.coast[1] / 50;
  const regionRadius = radius + coastDistance;
  const boundary: [number, number][] = [[-regionRadius, -regionRadius], [regionRadius, -regionRadius], [regionRadius, regionRadius], [-regionRadius, regionRadius]];
  const coastal = recipe.id !== "winterfell";
  const shore = radius * 0.65 + (recipe.centre === "keep" ? 0 : recipe.centre.coast[0] / 50);
  const city = new PhysicalCity({ recipe, host: recipe.hosts[0], tier, pool, boundary, reserves: [],
    castle: { x: 0, z: 0, hw: 0.3, hd: 0.3 },
    heightAt: () => 0, water: (_x, z) => coastal && z > shore,
    shore: (_x, z) => coastal ? (shore - z) * 50 : 10000,
  });
  const deadline = performance.now() + 15000;
  while (city.pending()) { city.advance(performance.now() + 10); if (performance.now() > deadline) { city.dispose(); pool.dispose(); throw new Error(`City build exceeded 15 s: ${id}`); } }
  // Fix the requested detail for the study instead of coupling it to the gallery eye.
  const rings = { near: lod === "near" ? 1e8 : 0, mid: lod === "far" ? 0 : 1e8, far: 1e8, hide: 1e9, triangles: 1e9 };
  const studyCamera = new THREE.PerspectiveCamera(35); studyCamera.position.set(0, 1, 0);
  city.update(studyCamera, rings, performance.now()); pool.flush();
  return { object: pool.group, update: () => { material.setClock(performance.now()); }, dispose: () => { city.dispose(); pool.dispose(); } };
}

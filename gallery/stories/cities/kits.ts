import * as THREE from "three";
import { registerStories } from "../../registry";
import KitPool from "../../../src/core/KitPool";
import PhysicalMaterial from "../../../src/cities/settlements/PhysicalMaterial";
import { houseLotInstance, physicalKitVariants, type HouseFamily } from "../../../src/cities/settlements/PhysicalKit";
import { modularCastle } from "../../../src/castles/castleKit";
import AssetMaterials from "../../../src/materials/AssetMaterials";
import CastleMaterial from "../../../src/materials/CastleMaterial";
for (const family of ["gable-steep", "gable-low", "flat-dome", "turf-long", "tower-house", "hall", "court"] as HouseFamily[]) registerStories({
  id: `cities/house-${family}`, title: `House kit · ${family}`, category: "Cities & seats",
  controls: { lod: { type: "select", label: "LOD", default: "near", options: ["near", "mid"] }, height: { type: "number", label: "Height (metres)", default: 7, min: 3, max: 18, step: 1 } },
  build({ values }) {
    const material = new PhysicalMaterial(); const pool = new KitPool(physicalKitVariants, false, undefined, material);
    const lot = houseLotInstance({ family, x: 0, y: 0, z: 0, yaw: 0, w: 10, d: 12, h: Number(values.height), foundation: 0 });
    const level = values.lod as "near" | "mid";
    pool.setPlace("study", { [level]: new Map([[lot.variant, [lot.instance]]]) }, level, undefined); pool.flush();
    return { object: pool.group, dispose: () => pool.dispose() };
  },
});
registerStories({ id: "castles/modular-kit", title: "Modular castle · Kenney CC0", category: "Castles",
  description: "Kenney Castle Kit modules, loaded over the original procedural fallback. The model and its CC0 license are included. Optional map/model loading never blocks the first frame.",
  build() {
    const object = new THREE.Group(); const material = new CastleMaterial();
    const mesh = new THREE.Mesh(modularCastle(true, 0), material); object.add(mesh);
    const assets = new AssetMaterials(() => undefined, kit => { if (kit) { const old = mesh.geometry; mesh.geometry = modularCastle(true, 0, kit); old.dispose(); object.userData.kitLoaded = true; } });
    assets.setQuality(true); assets.prepare(); assets.afterPaint();
    return { object, ready: () => Boolean(object.userData.kitLoaded), dispose: () => assets.dispose() };
  },
});

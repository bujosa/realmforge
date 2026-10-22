import * as THREE from "three";
import { registerStories } from "../../registry";
import { titleCase } from "../../../src/presets/demo";
import { WallIceMaterial, wallGeometry } from "../../../src/cities/WallArt";
import { wallPath } from "../../../src/cities/WallProfile";
import AssetMaterials from "../../../src/materials/AssetMaterials";
for (const surface of ["stone", "wood", "metal", "paper"] as const) registerStories({
  id: `materials/${surface}`, title: `CC0 ${titleCase(surface)}`, category: "Materials", description: "ambientCG CC0 surface maps. Procedural fallback remains visible while the maps load.",
  build() {
    const material = new THREE.MeshStandardMaterial({ color: surface === "wood" ? "#c8a87f" : "#c4c8be", roughness: 0.8 });
    const assets = new AssetMaterials(() => undefined, () => undefined); assets.register(material, surface); assets.setQuality(true); assets.prepare();
    return { object: new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 24), material), ready: () => assets.programsReady(), dispose: () => assets.dispose() };
  },
});
registerStories({ id: "materials/ice-wall", title: "Ice wall · 213 metres", category: "Materials", build() {
  const edges = [{ a: { x: -5, z: 0 }, b: { x: 5, z: 0 } }];
  return { object: new THREE.Mesh(wallGeometry(wallPath(edges, 4.26, () => 0), () => 0, new THREE.Vector3(), 1), new WallIceMaterial()) };
} });

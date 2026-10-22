import { SITES } from "../../src/presets/islandSites";
import * as THREE from "three";
import { registerStories, type Control } from "../registry";
import { castleGeometry } from "../../src/castles/castles";
import { castlePalettes, castleStyle, type CastleStyle } from "../../src/castles/castleStyles";
import CastleMaterial from "../../src/materials/CastleMaterial";
import { HeroMaterial } from "../../src/cities/ComplexMaterial";
import { complexGeometry, heroGeometry } from "../../src/cities/ComplexGeometry";
import { planComplex, type ComplexGround } from "../../src/cities/ComplexPlan";
import { planIslandSeat, planIronIslandSeats } from "../../src/cities/IronIslandSeats";
import { castleSettlementGeometry, type CastleSettlementKind } from "../../src/cities/CastleSettlement";
import { harborGeometry } from "../../src/cities/HarborGeometry";
import { natureGeometry } from "../../src/nature/nature";
import { livestockGeometry } from "../../src/nature/livestock";
import { resourceGeometry } from "../../src/props/ResourceProps";
import { castleBanner } from "../../src/castles/castleBanner";
import { companyGeometry } from "../../src/pieces/WorldCompanies";
import { worldMiniatureGeometry } from "../../src/pieces/miniatures";
import { demoHouses, namedSeats, titleCase } from "../../src/presets/demo";
import { WallIceMaterial, wallGeometry } from "../../src/cities/WallArt";
import { wallPath } from "../../src/cities/WallProfile";
import AssetMaterials from "../../src/materials/AssetMaterials";
import CastleLife from "../../src/castles/CastleLife";
import { cityStudy } from "../cityStudy";

const styles = Object.keys(castlePalettes) as CastleStyle[];
const detail: Control = { type: "boolean", label: "Detailed geometry", default: true };
const styleControl = (style: string): Control => ({ type: "select", label: "Architecture", default: style, options: styles });
const mesh = (geometry: THREE.BufferGeometry, castle = false): THREE.Mesh => new THREE.Mesh(geometry, castle ? new CastleMaterial() : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
function finish<T>(steps: Generator<void, T, void>): T { let step = steps.next(); while (!step.done) step = steps.next(); return step.value; }
export function groundFor(kind: string): ComplexGround {
  // Island recipe expects sea-level stacks. All other seats use a deterministic flat QA site.
  return { height: () => kind === "pyke" ? 3.1 : 0, wet: (x, z) => kind === "pyke" && (z > 130 || x > 200), reserved: () => false, own: () => true };
}
export function seatObject(kind: string, style: CastleStyle, detailed: boolean, seed = 1): THREE.Group {
  const plan = planComplex({ id: `${kind}-${seed}`, kind, level: 2, style, seaward: [0, 1] }, groundFor(kind));
  if (!plan) throw new Error(`No QA plan for ${kind}`);
  const group = new THREE.Group();
  const geometry = finish(complexGeometry(plan, detailed));
  group.add(mesh(geometry, true));
  const hero = finish(heroGeometry(plan, detailed));
  if (hero) group.add(new THREE.Mesh(hero, new HeroMaterial()));
  return group;
}
for (const style of styles) registerStories({
  id: `castles/style-${style}`, title: `${titleCase(style)} · castle style`, category: "Castles",
  controls: { style: styleControl(style), detailed: detail, variant: { type: "number", label: "Variant", default: 0, min: 0, max: 7, step: 1 }, level: { type: "select", label: "Level", default: "2", options: ["1", "2"] } },
  build({ values }) { return { object: mesh(castleGeometry(Number(values.level) === 1 ? "castle" : "stronghold", values.style as CastleStyle, Number(values.variant), Boolean(values.detailed), undefined, Number(values.level)), true) }; },
});
for (const kind of namedSeats) {
  registerStories({
    id: `castles/${kind}`, title: titleCase(kind), category: "Castles", description: "Original procedural board-scale landmark. The ground cuts the foundation skirt at its authored zero plane.",
    controls: { style: styleControl(castleStyle(kind)), detailed: detail },
    build({ values }) { return { object: mesh(castleGeometry(kind, values.style as CastleStyle, 0, Boolean(values.detailed)), true) }; },
  });
  if (kind !== "iron-bank") registerStories({
    id: `cities/${kind}`, title: `${titleCase(kind)} · physical seat`, category: "Cities & seats",
    description: "Metre-scale castle complex on an isolated QA terrain callback. Hero geography is included. This view excludes the game's streamed surrounding city.",
    controls: { style: styleControl(castleStyle(kind)), lod: { type: "select", label: "LOD", default: "near", options: ["near", "far"] }, seed: { type: "number", label: "Seed", default: 1, min: 1, max: 999, step: 1 } },
    build({ values }) { return { object: seatObject(kind, values.style as CastleStyle, values.lod === "near", Number(values.seed)) }; },
  });
}
for (const kind of ["vale-hamlet", "vale-croft", "village-house"] as CastleSettlementKind[]) registerStories({
  id: `cities/${kind}`, title: titleCase(kind), category: "Cities & seats", controls: { detailed: detail },
  build({ values }) { return { object: mesh(castleSettlementGeometry(kind, Boolean(values.detailed)), true) }; },
});
registerStories({ id: "cities/island-seats", title: "Island seats · six scenery recipes", category: "Cities & seats", build() {
  const plan = planIronIslandSeats({ x: 194.36363636363603, y: 617.818181818182 }, groundFor("islands"));
  if (!plan) throw new Error("Island QA plan missing");
  return { object: mesh(finish(complexGeometry(plan, true)), true) };
} });
registerStories({ id: "cities/harbor", title: "Harbor · timber & stone", category: "Cities & seats", build: () => ({ object: mesh(harborGeometry()) }) });
for (const kind of ["tree-pine", "tree-oak", "tree-birch", "cliff", "mountain-rock", "river-bank"]) registerStories({
  id: `nature/${kind}`, title: titleCase(kind), category: "Nature", controls: { foliage: { type: "colour", label: "Foliage", default: "#40563d" } },
  build: ({ values }) => ({ object: mesh(natureGeometry(kind, String(values.foliage))) }),
});
registerStories({ id: "nature/sheep", title: "Sheep · production livestock", category: "Nature", description: "Original neutral livestock sculpt. About 1.3 m tall at 50 metres per scene unit.", build: () => ({ object: mesh(livestockGeometry()) }) });
for (const kind of ["barrel", "crown"] as const) registerStories({ id: `props/${kind}`, title: titleCase(kind), category: "Props", build: () => ({ object: mesh(resourceGeometry(kind)) }) });
registerStories({ id: "props/castle-life", title: "Castle life · torches & smoke", category: "Props", build({ camera }) {
  const object = new THREE.Group(); object.add(mesh(castleGeometry("stronghold", "north"), true));
  const life = new CastleLife(object);
  life.update([{ kind: "stronghold", anchor: new THREE.Vector3(), scale: 1, torches: [new THREE.Vector3(-0.05, 0.15, 0.22), new THREE.Vector3(0.05, 0.15, 0.22)], chimney: new THREE.Vector3(0, 0.38, -0.02) }], true, true);
  return { object, update: (_dt, t) => { life.render(t * 1000, false, camera); }, dispose: () => life.dispose() };
} });
registerStories({ id: "heraldry/banner", title: "Injectable banner", category: "Heraldry", controls: { house: { type: "select", label: "Demo identity", default: "neutral", options: demoHouses }, colour: { type: "colour", label: "Cloth", default: "#a73b31" } }, build: ({ values }) => ({ object: mesh(castleBanner(String(values.house), String(values.colour))) }) });
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

for (const site of SITES) registerStories({
  id: `cities/island-${site.id}`, title: `${titleCase(site.id)} · island seat`, category: "Cities & seats", controls: { detailed: detail },
  build({ values }) { return { object: mesh(finish(complexGeometry(planIslandSeat(site.id, site.towers, site.radius, groundFor("islands")), Boolean(values.detailed))), true) }; },
});

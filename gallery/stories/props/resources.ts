import * as THREE from "three";
import { registerStories } from "../../registry";
import { castleGeometry } from "../../../src/castles/castles";
import { resourceGeometry } from "../../../src/props/ResourceProps";
import { titleCase } from "../../../src/presets/demo";
import CastleLife from "../../../src/castles/CastleLife";
import { mesh } from "../../story-kit";
for (const kind of ["barrel", "crown"] as const) registerStories({ id: `props/${kind}`, title: titleCase(kind), category: "Props", build: () => ({ object: mesh(resourceGeometry(kind)) }) });
registerStories({ id: "props/castle-life", title: "Castle life · torches & smoke", category: "Props", build({ camera }) {
  const object = new THREE.Group(); object.add(mesh(castleGeometry("stronghold", "north"), true));
  const life = new CastleLife(object);
  life.update([{ kind: "stronghold", anchor: new THREE.Vector3(), scale: 1, torches: [new THREE.Vector3(-0.05, 0.15, 0.22), new THREE.Vector3(0.05, 0.15, 0.22)], chimney: new THREE.Vector3(0, 0.38, -0.02) }], true, true);
  return { object, update: (_dt, t) => { life.render(t * 1000, false, camera); }, dispose: () => life.dispose() };
} });

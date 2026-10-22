import { registerStories } from "../../registry";
import { castleGeometry } from "../../../src/castles/castles";
import { castleStyle, type CastleStyle } from "../../../src/castles/castleStyles";
import { namedSeats, titleCase } from "../../../src/presets/demo";
import { detail, styleControl, mesh, seatObject } from "../../story-kit";
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

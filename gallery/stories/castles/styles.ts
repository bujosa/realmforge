import { registerStories } from "../../registry";
import { castleGeometry } from "../../../src/castles/castles";
import { type CastleStyle } from "../../../src/castles/castleStyles";
import { titleCase } from "../../../src/presets/demo";
import { styles, detail, styleControl, mesh } from "../../story-kit";
for (const style of styles) registerStories({
  id: `castles/style-${style}`, title: `${titleCase(style)} · castle style`, category: "Castles",
  controls: { style: styleControl(style), detailed: detail, variant: { type: "number", label: "Variant", default: 0, min: 0, max: 7, step: 1 }, level: { type: "select", label: "Level", default: "2", options: ["1", "2"] } },
  build({ values }) { return { object: mesh(castleGeometry(Number(values.level) === 1 ? "castle" : "stronghold", values.style as CastleStyle, Number(values.variant), Boolean(values.detailed), undefined, Number(values.level)), true) }; },
});

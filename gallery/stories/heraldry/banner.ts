import { registerStories } from "../../registry";
import { castleBanner } from "../../../src/castles/castleBanner";
import { demoHouses } from "../../../src/presets/demo";
import { mesh } from "../../story-kit";
registerStories({ id: "heraldry/banner", title: "Injectable banner", category: "Heraldry", controls: { house: { type: "select", label: "Demo identity", default: "neutral", options: demoHouses }, colour: { type: "colour", label: "Cloth", default: "#a73b31" } }, build: ({ values }) => ({ object: mesh(castleBanner(String(values.house), String(values.colour))) }) });

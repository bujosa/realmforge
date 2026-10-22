import { SITES } from "../../../src/presets/islandSites";
import { registerStories } from "../../registry";
import { complexGeometry } from "../../../src/cities/ComplexGeometry";
import { planIslandSeat, planIslandSeats } from "../../../src/cities/IslandSeats";
import { castleSettlementGeometry, type CastleSettlementKind } from "../../../src/cities/CastleSettlement";
import { harborGeometry } from "../../../src/cities/HarborGeometry";
import { titleCase } from "../../../src/presets/demo";
import { detail, mesh, finish, groundFor } from "../../story-kit";
for (const kind of ["vale-hamlet", "vale-croft", "village-house"] as CastleSettlementKind[]) registerStories({
  id: `cities/${kind}`, title: titleCase(kind), category: "Cities & seats", controls: { detailed: detail },
  build({ values }) { return { object: mesh(castleSettlementGeometry(kind, Boolean(values.detailed)), true) }; },
});
registerStories({ id: "cities/island-seats", title: "Island seats · six scenery recipes", category: "Cities & seats", build() {
  const plan = planIslandSeats({ x: 194.36363636363603, y: 617.818181818182 }, groundFor("islands"));
  if (!plan) throw new Error("Island QA plan missing");
  return { object: mesh(finish(complexGeometry(plan, true)), true) };
} });
registerStories({ id: "cities/harbor", title: "Harbor · timber & stone", category: "Cities & seats", build: () => ({ object: mesh(harborGeometry()) }) });
for (const site of SITES) registerStories({
  id: `cities/island-${site.id}`, title: `${titleCase(site.id)} · island seat`, category: "Cities & seats", controls: { detailed: detail },
  build({ values }) { return { object: mesh(finish(complexGeometry(planIslandSeat(site.id, site.towers, site.radius, groundFor("islands")), Boolean(values.detailed))), true) }; },
});

import * as THREE from "three";
import { armyTypes, armyStates, type ArmyState, type ArmyType, type ArmyUnit } from "../../../src/armies";
import { worldMiniatureGeometry } from "../../../src/pieces/miniatures";
import { registerStories } from "../../registry";
import { houses, names, lab, swatch, label, select, toggle } from "./support";

registerStories({
  id: "armies/state-player", title: "State player", category: "Armies",
  build(ctx) {
    const view = lab(ctx, "The living company", "Inspect the silhouette, choose a pose, then play. Movement is explicitly driven by the host; pause freezes the whole company and reduced motion keeps a static pose.");
    let type: ArmyType = "knight", house = "greyjoy", state: ArmyState = "idle", table = false, speed = 1;
    let unit: ArmyUnit;
    swatch(view.object, 0, 0, "#687a52", 2.9, 2.7);
    const create = (): void => {
      unit?.remove(); const preset = houses.find(h => h.id === house)!;
      unit = view.batch.add({ type, house, color: preset.color, heading: Math.PI + 0.3, plinth: table, lod: "near", seed: 17 });
      unit.setState(state); view.frame();
    };
    select(view.controls, "Unit", armyTypes, type, value => { type = value as ArmyType; create(); });
    select(view.controls, "House", houses.map(h => h.id), house, value => { house = value; create(); });
    select(view.controls, "State", armyStates, state, value => { state = value as ArmyState; unit.setState(state); });
    const play = document.createElement("button"); play.textContent = "Pause"; play.setAttribute("aria-label", "Play or pause");
    play.onclick = () => { view.batch.setPaused(!view.batch.paused); play.textContent = view.batch.paused ? "Play" : "Pause"; }; view.controls.append(play);
    const speedLabel = document.createElement("label"); speedLabel.textContent = "Speed";
    const slider = document.createElement("input"); slider.type = "range"; slider.min = "0.25"; slider.max = "2"; slider.step = "0.25"; slider.value = "1"; slider.setAttribute("aria-label", "Speed"); slider.oninput = () => { speed = Number(slider.value); }; speedLabel.append(slider); view.controls.append(speedLabel);
    toggle(view.controls, "Reduced motion", false, value => view.batch.setMotionScale(value ? 0 : 1));
    toggle(view.controls, "Table plinth", false, value => { table = value; create(); });
    create();
    // Scale host delta, not the shader alone: gait and transitions stay in sync.
    const update = view.update!.bind(view);
    view.update = (delta, elapsed) => update(delta * speed, elapsed);
    const qa = (window as unknown as { __armyQA: Record<string, unknown> }).__armyQA;
    qa.setUnit = (nextType: ArmyType, nextHouse: string, nextState: ArmyState) => {
      type = nextType; house = nextHouse; state = nextState; create();
      for (const input of view.controls.querySelectorAll("select")) {
        const title = input.getAttribute("aria-label"); input.value = title === "Unit" ? type : title === "House" ? house : state;
      }
    };
    return view;
  },
}, {
  id: "armies/battle", title: "Battle · 10 second loop", category: "Armies",
  build(ctx) {
    const view = lab(ctx, "The clash at the ford", "A ten-second encounter: advance, charge, shield wall, clash, retreat, victory. The galley rows past the battlefield; standards carry the story at every distance.");
    swatch(view.object, 0, -0.2, "#687a52", 7.6, 6.5);
    swatch(view.object, -3.15, 0, "#406d7b", 1.3, 6.4);
    const winners: ArmyUnit[] = [], losers: ArmyUnit[] = [];
    for (let i = 0; i < 3; i++) {
      winners.push(view.batch.add({ type: i === 2 ? "knight" : "footman", house: "stark", color: "#d8d8d8", position: { x: -1.4 + i * 1.15, z: 2.2 }, scale: 0.75 }));
      losers.push(view.batch.add({ type: i === 2 ? "knight" : "footman", house: "greyjoy", color: "#1c1c1c", position: { x: -1.4 + i * 1.15, z: -2.2 }, heading: Math.PI, scale: 0.75 }));
    }
    const siege = view.batch.add({ type: "siege-engine", house: "stark", color: "#d8d8d8", position: { x: 1.8, z: 2.2 }, scale: 0.7 });
    const ship = view.batch.add({ type: "ship", house: "greyjoy", color: "#1c1c1c", position: { x: -3.15, z: 2.3 }, scale: 0.7 });
    let time = 0, phase = -1;
    view.tick = delta => {
      if (view.batch.paused || view.batch.motionScale === 0) return;
      time = (time + delta) % 10;
      const next = time < 2.8 ? 0 : time < 4 ? 1 : time < 6 ? 2 : time < 8 ? 3 : 4;
      if (next === phase) return; phase = next;
      for (let i = 0; i < 3; i++) {
        const x = -1.4 + i * 1.15;
        if (phase === 0) {
          winners[i].setState("march", { path: [{ x, z: 2.2 }, { x, z: 0.9 }], duration: 2.8 });
          losers[i].setState("march", { path: [{ x, z: -2.2 }, { x, z: -0.9 }], duration: 2.8 });
        } else if (phase === 1) {
          winners[i].setState(i === 2 ? "charge" : "attack", { path: [{ x, z: 0.9 }, { x, z: 0.38 }], duration: 1.2 });
          losers[i].setState("defend");
        } else if (phase === 2) { winners[i].setState("attack"); losers[i].setState(i === 1 ? "wounded" : "defend"); }
        else if (phase === 3) { winners[i].setState("victory"); losers[i].setState("rout", { path: [{ x, z: -0.9 }, { x, z: -2.5 }], duration: 1.9 }); }
        else { winners[i].setState("victory"); losers[i].setState("destroyed"); }
      }
      siege.setState(phase === 2 ? "attack" : phase >= 3 ? "victory" : "idle");
      if (phase === 0) ship.setState("march", { path: [{ x: -3.15, z: 2.4 }, { x: -3.15, z: -2.4 }], duration: 8 });
    };
    toggle(view.controls, "Pause", false, value => view.batch.setPaused(value));
    toggle(view.controls, "Reduced motion", false, value => view.batch.setMotionScale(value ? 0 : 1));
    view.footer.textContent = "00–03 ADVANCE · 03–04 CHARGE\n04–06 CLASH · 06–10 RETREAT & VICTORY";
    return view;
  },
});

for (const detail of ["high", "balanced"] as const) registerStories({
  id: `armies/board-${detail}`, title: `120 companies · ${detail}`, category: "Armies",
  build(ctx) {
    const view = lab(ctx, "The campaign board", "120 mixed companies, shared materials and two LOD pools per type. The HUD counts army geometry separately from the gallery floor and labels. All companies are explicitly idling.", detail);
    swatch(view.object, 0, 0, "#687a52", 20, 17);
    for (let i = 0; i < 120; i++) {
      const house = houses[i % houses.length];
      view.batch.add({ type: armyTypes[i % armyTypes.length], house: house.id, color: house.color, position: { x: (i % 12 - 5.5) * 1.55, z: (Math.floor(i / 12) - 4.5) * 1.55 }, scale: 0.82, heading: Math.PI + (i % 3 - 1) * 0.18, lod: "near", seed: i + 3 });
    }
    toggle(view.controls, "Pause", false, value => view.batch.setPaused(value));
    toggle(view.controls, "Reduced motion", false, value => view.batch.setMotionScale(value ? 0 : 1));
    toggle(view.controls, "Automatic far LOD", false, value => { for (const unit of view.batch.units) unit.lod = value ? "auto" : "near"; });
    return view;
  },
});

registerStories({
  id: "armies/before-after", title: "Before / after · same scale", category: "Armies",
  build(ctx) {
    const view = lab(ctx, "From marker to company", "Current World sculpts on the left. New companies on the right. Both use the same numeric world scale: the new formation spends its silhouette on soldiers and heraldry rather than a round plinth.");
    const compact = matchMedia("(max-width:600px)").matches;
    const types = compact ? ["footman", "knight"] as const : armyTypes;
    types.forEach((type, i) => {
      const z = (i - (types.length - 1) / 2) * 2.05;
      swatch(view.object, -1.15, z, "#687a52", 2, 1.9); swatch(view.object, 1.15, z, "#687a52", 2, 1.9);
      const geometry = worldMiniatureGeometry(type, "greyjoy", "#1c1c1c", true);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); mesh.position.set(-1.15, 0, z); mesh.rotation.y = Math.PI + 0.2; view.object.add(mesh);
      view.batch.add({ type, house: "greyjoy", color: "#1c1c1c", position: { x: 1.15, z }, heading: Math.PI + 0.2, lod: "near", scale: 1 });
      view.object.add(label(names[type], 0, 0.05, z + 0.8, 1.2));
    });
    view.controls.textContent = "CURRENT / LEFT                         COMPANY V2 / RIGHT";
    toggle(view.controls, "Reduced motion", false, value => view.batch.setMotionScale(value ? 0 : 1));
    return view;
  },
});

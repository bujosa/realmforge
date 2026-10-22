import * as THREE from "three";
import { castleGeometry } from "../../../src/castles/castles";
import CastleMaterial from "../../../src/materials/CastleMaterial";
import { armyTypes } from "../../../src/armies";
import { registerStories } from "../../registry";
import { houses, lab, swatch, toggle } from "./support";

registerStories({
  id: "armies/world-scale", title: "World x1 · castle & company scale", category: "Armies / comparison",
  description: "World camera reference: 38° vertical FOV, 20° polar tilt. Proposed footprint: 64 CSS px at 1440×900; 56 CSS px at 390×844. Castle keeps its authored scale; armies use a strategic presentation scale. This is a synthetic scale study, not an integrated game screenshot.",
  build(ctx) {
    const view = lab(ctx, "World presentation scale", "Compare the footprint with authored castle geometry at the World x1 camera angle. Strategic scaling is separate from physical metres.");
    const compact = matchMedia("(max-width:600px)").matches;
    const savedFov = ctx.camera.fov;
    ctx.camera.fov = 38; ctx.camera.updateProjectionMatrix();
    swatch(view.object, 0, 0, "#687a52", 5, compact ? 8 : 4);
    const castle = new THREE.Mesh(castleGeometry("stronghold", "north"), new CastleMaterial());
    castle.scale.setScalar(5); castle.position.set(compact ? 0 : -1.2, 0, compact ? -1.6 : 0); view.object.add(castle);
    const units = armyTypes.map((type, i) => {
      const house = houses[i % 3];
      return view.batch.add({ type, house: house.id, color: house.color, position: { x: compact ? (i % 2 - .5) * 1.7 : .4 + (i % 2) * 1.1, z: compact ? .5 + Math.floor(i / 2) * 1.25 : (Math.floor(i / 2) - 1) * 1.2 }, lod: "far", heading: Math.PI });
    });
    // The display is enlarged 5× uniformly to inspect the original 0.5 u castle.
    // Company scale is then solved from its XZ footprint, never from its banner.
    let cameraSet = false;
    const corner = new THREE.Vector3(), matrix = new THREE.Matrix4();
    const pixelBounds = (): { type: string; width: number; height: number; scale: number }[] => units.map(unit => {
      const mesh = unit.pool.mesh, box = mesh.geometry.boundingBox!;
      mesh.getMatrixAt(unit.slot, matrix); matrix.premultiply(mesh.matrixWorld);
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const x of [box.min.x, box.max.x]) for (const y of [0, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        corner.set(x, y, z).applyMatrix4(matrix).project(ctx.camera);
        const px = (corner.x + 1) * ctx.renderer.domElement.clientWidth / 2;
        const py = (1 - corner.y) * ctx.renderer.domElement.clientHeight / 2;
        left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
      return { type: unit.type, width: right - left, height: bottom - top, scale: unit.scale / 5 };
    });
    view.tick = () => {
      if (cameraSet) return; cameraSet = true;
      const target = new THREE.Box3().setFromObject(view.object).getCenter(new THREE.Vector3());
      const distance = compact ? 16 : 13;
      ctx.camera.position.copy(target).add(new THREE.Vector3(0, Math.cos(Math.PI / 9), Math.sin(Math.PI / 9)).multiplyScalar(distance));
      ctx.camera.lookAt(target); ctx.camera.updateMatrixWorld(true);
      const height = ctx.renderer.domElement.clientHeight;
      const targetPx = compact ? 56 : 64;
      const density = height / (distance * 2 * Math.tan(38 * Math.PI / 360));
      for (const unit of units) {
        const box = unit.pool.mesh.geometry.boundingBox!;
        const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
        unit.scale = targetPx / (density * footprint);
      }
      view.footer.textContent = `38° FOV · 20° POLAR\nTARGET ${targetPx} CSS px FOOTPRINT\nCASTLE: AUTHORED SCALE × 5`;
    };
    toggle(view.controls, "Reduced motion", false, value => view.batch.setMotionScale(value ? 0 : 1));
    const qa = (window as unknown as { __armyQA: Record<string, unknown> }).__armyQA;
    qa.pixelBounds = pixelBounds;
    const dispose = view.dispose!.bind(view);
    view.dispose = () => { ctx.camera.fov = savedFov; ctx.camera.updateProjectionMatrix(); dispose(); };
    return view;
  },
});

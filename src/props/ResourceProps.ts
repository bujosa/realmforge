import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ResourceSnapshot } from "../core/contracts";
import { CastlePlacement } from "../core/contracts";
import { paintGeometry } from "../core/sculpt";
import { finishGeometry } from "../core/finish";

export function resourceGeometry(kind: "barrel" | "crown"): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, color: string): void => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part != geometry) geometry.dispose();
    part.deleteAttribute("uv");
    parts.push(paintGeometry(part, color));
  };
  if (kind == "barrel") {
    add(new THREE.LatheGeometry([
      new THREE.Vector2(0.038, 0.003), new THREE.Vector2(0.047, 0.025),
      new THREE.Vector2(0.051, 0.06), new THREE.Vector2(0.047, 0.095), new THREE.Vector2(0.038, 0.117)
    ], 16), "#b7874c");
    // Individual dark seams read as wooden staves at close range.
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      add(new THREE.BoxGeometry(0.0015, 0.08, 0.003).rotateY(angle).translate(Math.sin(angle) * 0.049, 0.06, Math.cos(angle) * 0.049), "#76512f");
    }
    [0.027, 0.093].forEach(y => add(new THREE.TorusGeometry(0.048, 0.004, 4, 16).rotateX(Math.PI / 2).translate(0, y, 0), "#82908f"));
    [0.003, 0.117].forEach(y => add(new THREE.CylinderGeometry(0.038, 0.038, 0.005, 16).translate(0, y, 0), "#c49c62"));
  } else {
    add(new THREE.CylinderGeometry(0.067, 0.075, 0.024, 12).translate(0, 0.012, 0), "#777b73");
    [0.038, 0.057].forEach(y => add(new THREE.TorusGeometry(0.047, 0.006, 5, 16).rotateX(Math.PI / 2).translate(0, y, 0), "#e0b956"));
    const prong = new THREE.Shape();
    prong.moveTo(-0.018, 0.038); prong.lineTo(-0.014, 0.075);
    prong.lineTo(0, 0.115); prong.lineTo(0.014, 0.075); prong.lineTo(0.018, 0.038); prong.closePath();
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      add(new THREE.ExtrudeGeometry(prong, { depth: 0.006, bevelEnabled: false }).translate(0, 0, 0.044).rotateY(angle), "#d5a940");
      add(new THREE.SphereGeometry(0.007, 6, 4).translate(0, 0.071, 0.048).rotateY(angle), i % 2 ? "#a7473b" : "#7dada5");
    }
  }
  const merged = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!merged) throw new Error(`Could not assemble ${kind}`);
  return finishGeometry(merged);
}

// Two cached, bounded draws. These props share the existing castle footprint;
// they never participate in placement, collision, picking or game rules.
export default class ResourceProps {
  private barrels = new THREE.InstancedMesh(resourceGeometry("barrel"), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.12 }), 96);
  private crowns = new THREE.InstancedMesh(resourceGeometry("crown"), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.65 }), 96);
  private signature = "";
  private enabled = true;
  private object = new THREE.Object3D();

  constructor(private group: THREE.Group) {
    [this.barrels, this.crowns].forEach(mesh => {
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
      group.add(mesh);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.barrels.visible = enabled && this.barrels.count > 0;
    this.crowns.visible = enabled && this.crowns.count > 0;
  }

  update(snapshot: ResourceSnapshot, castles: Map<string, CastlePlacement>, detail: boolean): void {
    const entries = snapshot.regions.filter(entry => entry.visible && !entry.region.isBlocked && castles.has(entry.region.id));
    const signature = `${detail}:` + entries.map(entry => {
      const castle = castles.get(entry.region.id) as CastlePlacement;
      return `${entry.region.id}:${entry.supplyIcons}:${entry.crownIcons}:${castle.kind}:${castle.scale}:${castle.anchor.x}:${castle.anchor.y}:${castle.anchor.z}`;
    }).join("|");
    if (signature == this.signature) return;
    this.signature = signature;
    this.barrels.count = this.crowns.count = 0;
    if (detail) entries.forEach(entry => {
      const castle = castles.get(entry.region.id) as CastlePlacement;
      const display = castle.resourceDisplay;
      if (!display) return;
      // One ornament denotes the resource type; the repeated label symbols give
      // its exact value. Small ledges cannot safely fit piles of full-size props.
      const place = (mesh: THREE.InstancedMesh, value: number, point: THREE.Vector3, scale: number): void => {
        if (value <= 0 || mesh.count >= 96) return;
        this.object.position.copy(point);
        this.object.rotation.set(0, 0, 0);
        this.object.scale.setScalar(castle.scale * scale);
        this.object.updateMatrix();
        mesh.setMatrixAt(mesh.count++, this.object.matrix);
      };
      place(this.barrels, entry.supplyIcons, display.supply, 0.2);
      place(this.crowns, entry.crownIcons, display.power, 0.14);
    });
    [this.barrels, this.crowns].forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; mesh.boundingSphere = null; });
    this.setEnabled(this.enabled);
  }

  dispose(): void {
    [this.barrels, this.crowns].forEach(mesh => { this.group.remove(mesh); mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
  }
}

import * as THREE from "three";
import { CastlePlacement } from "../core/contracts";

// Two bounded instanced draws, active only near the castles in High. No point
// lights, shadows, timers or independently scheduled frames per building.
export default class CastleLife {
  private flameMaterial = new THREE.MeshBasicMaterial({ color: "#ffc87b", toneMapped: false });
  private smokeMaterial = new THREE.MeshBasicMaterial({ color: "#bcb5ae", transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide });
  private flames = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), this.flameMaterial, 64);
  private smoke = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), this.smokeMaterial, 96);
  private placements: CastlePlacement[] = [];
  private object = new THREE.Object3D();
  private full = true;
  private dusk = false;

  constructor(private group: THREE.Group) {
    [this.flames, this.smoke].forEach(mesh => {
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);
    });
  }

  update(placements: CastlePlacement[], full: boolean, dusk: boolean): void {
    this.placements = placements;
    this.full = full;
    this.dusk = dusk;
  }

  render(now: number, reduced: boolean, camera?: THREE.PerspectiveCamera): boolean {
    this.flames.count = this.smoke.count = 0;
    if (this.full && !reduced && camera) {
      this.placements.forEach((castle, index) => {
        if (camera.position.distanceTo(castle.anchor) > 8) { return; }
        if (this.dusk) {
          castle.torches.forEach((torch, side) => {
            if (this.flames.count >= 64) { return; }
            this.object.position.copy(torch);
            const pulse = 0.9 + Math.sin(now * 0.009 + index * 3 + side) * 0.1;
            this.object.rotation.set(0, 0, 0);
            this.object.scale.set(0.009, 0.025 * pulse, 0.009).multiplyScalar(castle.scale);
            this.object.updateMatrix();
            this.flames.setMatrixAt(this.flames.count++, this.object.matrix);
          });
        }
        if (!castle.chimney) { return; }
        for (let i = 0; i < 3 && this.smoke.count < 96; i++) {
          const age = ((now / 6000 + i / 3 + index * 0.17) % 1);
          this.object.position.copy(castle.chimney).add(new THREE.Vector3(age * 0.08 * castle.scale, age * 0.17 * castle.scale, -0.025 * castle.scale));
          this.object.quaternion.copy(camera.quaternion);
          this.object.scale.setScalar((0.006 + Math.sin(age * Math.PI) * 0.018) * castle.scale);
          this.object.updateMatrix();
          this.smoke.setMatrixAt(this.smoke.count++, this.object.matrix);
        }
      });
    }
    [this.flames, this.smoke].forEach(mesh => {
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = mesh.visible;
    });
    return this.flames.visible || this.smoke.visible;
  }

  dispose(): void {
    [this.flames, this.smoke].forEach(mesh => { this.group.remove(mesh); mesh.dispose(); mesh.geometry.dispose(); });
    this.flameMaterial.dispose();
    this.smokeMaterial.dispose();
    this.placements = [];
  }
}

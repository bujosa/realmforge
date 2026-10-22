import * as THREE from "three";

/** Static broad phase for walking. Split instanced batches for local raycasts only; no GPU resources. */
export class WalkSurfaceIndex {
  private cells = new Map<string, THREE.Mesh[]>();
  private large: THREE.Mesh[] = [];
  private cellSize = 1;
  constructor(object: THREE.Object3D, cellSize: number) {
    this.cellSize = Math.max(0.05, cellSize);
    const matrix = new THREE.Matrix4();
    const add = (mesh: THREE.Mesh): void => {
      const box = new THREE.Box3().setFromObject(mesh);
      const x0 = Math.floor(box.min.x / this.cellSize), x1 = Math.floor(box.max.x / this.cellSize);
      const z0 = Math.floor(box.min.z / this.cellSize), z1 = Math.floor(box.max.z / this.cellSize);
      if ((x1-x0+1)*(z1-z0+1)>64) { this.large.push(mesh); return; }
      for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++) {
        const key=`${x},${z}`, cell=this.cells.get(key);
        if(cell)cell.push(mesh);else this.cells.set(key,[mesh]);
      }
    };
    object.updateMatrixWorld(true);
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh) || child.userData.nonSolid || !child.visible) return;
      if (child instanceof THREE.InstancedMesh) {
        for(let i=0;i<child.count;i++) {
          child.getMatrixAt(i,matrix);
          const proxy = new THREE.Mesh(child.geometry,child.material);
          proxy.matrixAutoUpdate=false;proxy.matrixWorld.multiplyMatrices(child.matrixWorld,matrix);
          // setFromObject updates matrixWorld, so keep the local matrix identical for this unattached proxy.
          proxy.matrix.copy(proxy.matrixWorld);add(proxy);
        }
      } else add(child);
    });
  }
  near(position: THREE.Vector3): THREE.Mesh[] {
    const x=Math.floor(position.x/this.cellSize),z=Math.floor(position.z/this.cellSize);
    const nearby=new Set(this.large);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const mesh of this.cells.get(`${x+dx},${z+dz}`)??[])nearby.add(mesh);
    return [...nearby];
  }
}

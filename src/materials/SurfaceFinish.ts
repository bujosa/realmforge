import * as THREE from "three";

interface SurfaceMaterial extends THREE.MeshStandardMaterial {
  normalMap: THREE.Texture | null;
  normalScale: THREE.Vector2;
  roughness: number;
  metalness: number;
  needsUpdate: boolean;
}

function normalTexture(wood: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create tabletop surface detail");
  }
  const data = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const index = (y * 128 + x) * 4;
      const grain = wood ? Math.sin(x * 0.58 + Math.sin(y * 0.12) * 0.7) : Math.sin(x * 2.7) * Math.cos(y * 2.3);
      data.data[index] = 128 + grain * (wood ? 18 : 9);
      data.data[index + 1] = 128 + Math.sin(y * (wood ? 0.16 : 2.2) + x * 0.1) * (wood ? 5 : 9);
      data.data[index + 2] = 254;
      data.data[index + 3] = 255;
    }
  }
  context.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = "";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = wood ? 3 : 7;
  texture.repeat.y = wood ? 5 : 10;
  return texture;
}

// Two tiny procedural normal maps; keep the established painted-miniature
// materials and AgX grading. No environment downloads or postprocessing passes.
export default class SurfaceFinish {
  private wood = normalTexture(true);
  private paper = normalTexture(false);
  private table: SurfaceMaterial;
  private map: SurfaceMaterial;

  constructor(table: THREE.Mesh, map: THREE.Mesh, private assetMapsActive: () => boolean = () => false) {
    this.table = table.material as SurfaceMaterial;
    this.map = map.material as SurfaceMaterial;
    this.table.roughness = 0.64;
    this.table.metalness = 0.04;
    this.table.normalScale = new THREE.Vector2(0.16, 0.16);
    this.map.normalScale = new THREE.Vector2(0.075, 0.075);
    this.map.roughness = 0.92;
    this.setQuality(true);
  }

  setQuality(high: boolean): void {
    // Loaded CC0 PBR maps (AssetMaterials) take precedence over the procedural fallback.
    if (high && this.assetMapsActive()) {
      return;
    }
    const wood = high ? this.wood : null;
    const paper = high ? this.paper : null;
    if (this.table.normalMap != wood || this.map.normalMap != paper) {
      this.table.normalMap = wood;
      this.map.normalMap = paper;
      this.table.normalScale = new THREE.Vector2(0.16, 0.16);
      this.map.normalScale = new THREE.Vector2(0.075, 0.075);
      this.table.needsUpdate = this.map.needsUpdate = true;
    }
  }

  dispose(): void {
    this.wood.dispose();
    this.paper.dispose();
  }
}

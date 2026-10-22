import * as THREE from "three";
import { paintSigil } from "./index";
import { sigilIdentity } from "./sources";

const houses = ["stark", "lannister", "baratheon", "greyjoy", "tyrell", "martell", "arryn", "targaryen", "bolton", "neutral"];
const cell = 256, size = 1024, inset = 16;

// One mipmapped POT atlas, white silhouettes for multiplication by the existing
// house palette. Caller owns this atlas and must dispose it with its scene.
export class SigilAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly canvas: HTMLCanvasElement;

  constructor(maxAnisotropy = 4) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = size;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable for sigil atlas");
    houses.forEach((house, index) => paintSigil(context, house, (index % 4 + 0.5) * cell, (Math.floor(index / 4) + 0.5) * cell, cell - inset * 2, "#ffffff", true));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  }

  // UVs exclude the gutter; resolve the alternate palette on access, even after a UI swap.
  uv(house: string): { u0: number; v0: number; u1: number; v1: number } {
    const index = houses.indexOf(sigilIdentity(house));
    const x = index % 4 * cell, y = Math.floor(index / 4) * cell;
    return { u0: (x + inset) / size, v0: 1 - (y + cell - inset) / size, u1: (x + cell - inset) / size, v1: 1 - (y + inset) / size };
  }

  dispose(): void {
    this.texture.dispose();
    this.canvas.width = this.canvas.height = 1;
  }
}

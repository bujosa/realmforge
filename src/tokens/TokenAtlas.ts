import * as THREE from "three";

/**
 * One texture for every token face, so each token kind is a single
 * instanced draw. Faces come from textures the scene already chose from the
 * viewer-filtered snapshot (house backs for hidden orders), so the atlas can
 * never hold more information than the 2D board shows.
 *
 * Cells are 128 px (a 48 px token at DPR 2 is 96 px). The atlas starts at
 * 1024² (64 cells) and doubles once to 2048² (256 cells) when full; past
 * that the oldest unused cell is recycled.
 */
export const ATLAS_CELL = 128;
/** Inset of each face inside its cell, in cell pixels (mip bleed guard). */
export const ATLAS_GUTTER = 3;
const CELL = ATLAS_CELL;
const GUTTER = ATLAS_GUTTER;

export interface AtlasCell { u: number; v: number; ready: boolean }

type Source = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export default class TokenAtlas {
  readonly texture: THREE.CanvasTexture;
  private canvas = document.createElement("canvas");
  private context: CanvasRenderingContext2D;
  private cells = new Map<THREE.Texture, { index: number; ready: boolean; used: number; version: number }>();
  private size = 1024;
  private frame = 0;
  private disposed = false;

  constructor(private maxSize = 2048) {
    this.canvas.width = this.canvas.height = this.size;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Could not create the token atlas");
    this.context = context;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.name = "strategic-token-atlas";
  }

  /** Cells per row (a uniform of the token shader). */
  get grid(): number {
    return this.size / CELL;
  }

  /** Read-only diagnostics; preserves the cell/grid API used by World ×20. */
  get stats(): { size: number; cells: number; capacity: number; rgbaBytes: number } {
    return { size: this.size, cells: this.cells.size, capacity: this.grid * this.grid, rgbaBytes: this.size * this.size * 4 };
  }

  beginFrame(): void {
    this.frame++;
  }

  /** Pin visible references before allocation so LRU cannot evict a later instance. */
  reserve(faces: (THREE.Texture | null | undefined)[]): void {
    faces.forEach(face => {
      const entry = face && this.cells.get(face);
      if (entry) entry.used = this.frame;
    });
    faces.forEach(face => this.cell(face));
  }

  /** Atlas cell of a face texture; draws it once its image has loaded. */
  cell(face: THREE.Texture | null | undefined): AtlasCell {
    if (!face || (face as THREE.Texture & { userData?: { realmFaceReady?: boolean } }).userData?.realmFaceReady === false || this.disposed) return { u: 0, v: 0, ready: false };
    let entry = this.cells.get(face);
    if (!entry) {
      const index = this.allocate();
      if (index == null) return { u: 0, v: 0, ready: false };
      entry = { index, ready: false, used: this.frame, version: -1 };
      this.cells.set(face, entry);
    }
    entry.used = this.frame;
    const version = (face as THREE.Texture & { version: number }).version;
    if (!entry.ready || entry.version != version) {
      entry.ready = this.paint(face, entry.index);
      entry.version = version;
    }
    const grid = this.grid;
    return { u: (entry.index % grid) / grid, v: Math.floor(entry.index / grid) / grid, ready: entry.ready };
  }

  private allocate(): number | null {
    const capacity = this.grid * this.grid;
    if (this.cells.size < capacity) return this.cells.size;
    if (this.size < this.maxSize) {
      this.grow();
      return this.cells.size;
    }
    // Full: recycle the least recently used face.
    let oldest: THREE.Texture | undefined;
    this.cells.forEach((entry, texture) => {
      if (entry.used < this.frame && (!oldest || entry.used < (this.cells.get(oldest)?.used ?? Infinity))) oldest = texture;
    });
    // Never replace a face already referenced by an instance in this frame.
    if (!oldest) return null;
    const index = oldest ? this.cells.get(oldest)?.index ?? 0 : 0;
    if (oldest) this.cells.delete(oldest);
    return index;
  }

  private grow(): void {
    const previous = this.grid;
    const copy = document.createElement("canvas");
    copy.width = copy.height = this.size;
    copy.getContext("2d")?.drawImage(this.canvas, 0, 0);
    this.size *= 2;
    this.canvas.width = this.canvas.height = this.size;
    // Re-seat every cell at its new row/column.
    this.cells.forEach(entry => {
      const x = (entry.index % previous) * CELL, y = Math.floor(entry.index / previous) * CELL;
      const grid = this.grid;
      this.context.drawImage(copy, x, y, CELL, CELL, (entry.index % grid) * CELL, Math.floor(entry.index / grid) * CELL, CELL, CELL);
    });
    // A resized canvas needs a new GPU allocation.
    this.texture.dispose();
    this.texture.needsUpdate = true;
  }

  private paint(face: THREE.Texture, index: number): boolean {
    const image = face.image as Source | undefined;
    if (!image) return false;
    if (image instanceof HTMLImageElement && (!image.complete || !image.naturalWidth)) return false;
    const grid = this.grid;
    const x = (index % grid) * CELL, y = Math.floor(index / grid) * CELL;
    this.context.clearRect(x, y, CELL, CELL);
    try {
      // The face texture was authored for a flipped (WebGL) upload; the atlas
      // keeps canvas orientation (flipY false) and samples rows top-down.
      this.context.drawImage(image as CanvasImageSource, x + GUTTER, y + GUTTER, CELL - GUTTER * 2, CELL - GUTTER * 2);
    } catch {
      return false;
    }
    this.texture.needsUpdate = true;
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.cells.clear();
    this.texture.dispose();
  }
}

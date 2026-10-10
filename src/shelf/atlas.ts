import * as THREE from 'three';
import { loadImage } from '../art/loadImage';
import { pickArtwork } from '../art/pick';
import type { Album } from '../core/types';
import { ATLAS, ATLAS_CAPACITY, atlasCell } from './layout';

/**
 * Atlas de lombadas (2048 × 2048): uma textura para a estante inteira, então uma coleção
 * grande custa poucas draw calls. Refeito quando a coleção ou a arte muda.
 */
export class SpineAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private drawn = new Map<string, string>();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = ATLAS.size;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  /** Desenha só as células cuja arte mudou. `index` é a ordem de entrada na coleção. */
  async update(albums: Album[]): Promise<void> {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    let changed = false;
    await Promise.all(
      albums.slice(0, ATLAS_CAPACITY).map(async (album, index) => {
        const spine = pickArtwork(album, 'spine');
        const key = `${index}:${spine?.url ?? ''}`;
        if (this.drawn.get(album.id) === key) return;
        const cell = atlasCell(index);
        ctx.fillStyle = '#2a2a2e';
        ctx.fillRect(cell.x, cell.y, ATLAS.cellW, ATLAS.cellH);
        if (spine) {
          try {
            const img = await loadImage(spine.url);
            ctx.save();
            if (img.height > img.width) {
              // Lombada vertical: gira para caber na célula horizontal.
              ctx.translate(cell.x + ATLAS.cellW / 2, cell.y + ATLAS.cellH / 2);
              ctx.rotate(-Math.PI / 2);
              ctx.drawImage(img, -ATLAS.cellH / 2, -ATLAS.cellW / 2, ATLAS.cellH, ATLAS.cellW);
            } else {
              ctx.drawImage(img, cell.x, cell.y, ATLAS.cellW, ATLAS.cellH);
            }
            ctx.restore();
          } catch {
            this.drawText(ctx, cell, `${album.artist} · ${album.title}`);
          }
        } else {
          this.drawText(ctx, cell, `${album.artist} · ${album.title}`);
        }
        this.drawn.set(album.id, key);
        changed = true;
      }),
    );
    if (changed) this.texture.needsUpdate = true;
  }

  private drawText(ctx: CanvasRenderingContext2D, cell: { x: number; y: number }, text: string) {
    ctx.fillStyle = '#e8e4dc';
    ctx.font = `600 15px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 60), cell.x + 10, cell.y + ATLAS.cellH / 2 + 1, ATLAS.cellW - 20);
  }

  dispose() {
    this.texture.dispose();
  }
}

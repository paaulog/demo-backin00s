import type { Album } from '../core/types';
import { normalizeKey } from '../core/text';
import type { ShelfSort } from '../store/store';

/** Torre vertical: caixas deitadas, lombada para fora, 16 por coluna. */
export const ROWS_PER_COLUMN = 16;
export const SLOT_HEIGHT = 11;
export const COLUMN_GAP = 138;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function byArtist(a: Album, b: Album): number {
  return collator.compare(normalizeKey(a.artist), normalizeKey(b.artist)) || (a.year ?? 9999) - (b.year ?? 9999) || collator.compare(a.title, b.title);
}

/** Ordem da estante (RF13). Sem gênero ou sem ano vai para o fim. */
export function sortAlbums(albums: Album[], sort: ShelfSort): Album[] {
  const list = [...albums];
  if (sort === 'artist') return list.sort(byArtist);
  if (sort === 'year') {
    return list.sort((a, b) => (a.year ?? Number.MAX_SAFE_INTEGER) - (b.year ?? Number.MAX_SAFE_INTEGER) || byArtist(a, b));
  }
  return list.sort((a, b) => {
    const ga = normalizeKey(a.genre) || '￿';
    const gb = normalizeKey(b.genre) || '￿';
    return collator.compare(ga, gb) || byArtist(a, b);
  });
}

export interface Slot {
  albumId: string;
  index: number;
  column: number;
  row: number;
  x: number;
  y: number;
}

/** Posição de cada álbum na torre; colunas extras quando passa da altura (RF12). */
export function shelfSlots(ordered: Album[]): Slot[] {
  const columns = Math.max(1, Math.ceil(ordered.length / ROWS_PER_COLUMN));
  return ordered.map((album, index) => {
    const column = Math.floor(index / ROWS_PER_COLUMN);
    const row = index % ROWS_PER_COLUMN;
    return {
      albumId: album.id,
      index,
      column,
      row,
      x: (column - (columns - 1) / 2) * COLUMN_GAP,
      // De cima para baixo, como se lê uma estante.
      y: ((ROWS_PER_COLUMN - 1) / 2 - row) * SLOT_HEIGHT,
    };
  });
}

/** Célula do atlas de lombadas (2048 × 2048, 4 colunas × 73 linhas de 512 × 28 px). */
export const ATLAS = { size: 2048, cellW: 512, cellH: 28 } as const;
export const ATLAS_CAPACITY = Math.floor(ATLAS.size / ATLAS.cellW) * Math.floor(ATLAS.size / ATLAS.cellH);

export function atlasCell(index: number): { x: number; y: number; u0: number; v0: number; du: number; dv: number } {
  const cols = ATLAS.size / ATLAS.cellW;
  const i = index % ATLAS_CAPACITY;
  const x = (i % cols) * ATLAS.cellW;
  const y = Math.floor(i / cols) * ATLAS.cellH;
  // UV com origem embaixo (flipY do three).
  return { x, y, u0: x / ATLAS.size, v0: 1 - (y + ATLAS.cellH) / ATLAS.size, du: ATLAS.cellW / ATLAS.size, dv: ATLAS.cellH / ATLAS.size };
}

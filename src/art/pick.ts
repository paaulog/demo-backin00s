import type { Album, Artwork, ArtworkOrigin, ArtworkType } from '../core/types';

/** Upload vence tudo; depois arte embutida, Cover Art Archive e, por último, a gerada. */
export const ORIGIN_PRIORITY: Record<ArtworkOrigin, number> = { upload: 0, embedded: 1, caa: 2, generated: 3 };

/** Todas as imagens de um tipo da melhor origem disponível, na ordem do índice. */
export function artworkOf(album: Album | null | undefined, type: ArtworkType): Artwork[] {
  if (!album) return [];
  const ofType = album.artwork.filter((a) => a.type === type);
  if (!ofType.length) return [];
  const best = Math.min(...ofType.map((a) => ORIGIN_PRIORITY[a.origin]));
  return ofType.filter((a) => ORIGIN_PRIORITY[a.origin] === best).sort((a, b) => a.index - b.index);
}

export function pickArtwork(album: Album | null | undefined, type: ArtworkType): Artwork | null {
  return artworkOf(album, type)[0] ?? null;
}

/**
 * Páginas do encarte na ordem de folhear: capa, páginas internas e contracapa do encarte.
 * Sem páginas internas, entra a página de créditos gerada.
 */
export function bookletPages(album: Album | null | undefined): Artwork[] {
  if (!album) return [];
  const pages: Artwork[] = [];
  const front = pickArtwork(album, 'front');
  if (front) pages.push(front);
  pages.push(...artworkOf(album, 'booklet'));
  return pages;
}

/** Tudo que o visualizador em tela cheia mostra (RF09): encarte, contracapa e disco. */
export function galleryOf(album: Album | null | undefined): Artwork[] {
  const back = pickArtwork(album, 'back');
  const medium = pickArtwork(album, 'medium');
  return [...bookletPages(album), ...(back ? [back] : []), ...(medium ? [medium] : [])];
}

import type { Album, Artwork, Palette } from '../core/types';
import { remoteCache } from '../persist/persist';
import { useApp } from '../store/store';
import { caaToArtwork, chooseCandidate } from './caa';
import { generateArtwork, missingTypes } from './generate';
import { loadImage } from './loadImage';
import { DEFAULT_PALETTE, paletteFromImage, paletteFromSeed } from './palette';
import { pickArtwork } from './pick';
import { getRelease, remoteEnabled, searchRelease } from './remote';

const palettes = new Map<string, Palette>();

export function paletteOf(albumId: string): Palette | null {
  return palettes.get(albumId) ?? null;
}

function latest(albumId: string): Album | undefined {
  return useApp.getState().albums.find((a) => a.id === albumId);
}

function addArtwork(albumId: string, artwork: Artwork[], patch: Partial<Album> = {}): void {
  const album = latest(albumId);
  if (!album || !artwork.length) {
    if (album && Object.keys(patch).length) useApp.getState().updateAlbum(albumId, patch);
    return;
  }
  useApp.getState().updateAlbum(albumId, { ...patch, artwork: [...album.artwork, ...artwork] });
}

async function computePalette(album: Album): Promise<Palette> {
  const front = pickArtwork(album, 'front');
  if (!front) return paletteFromSeed(`${album.artist}|${album.title}`);
  try {
    return paletteFromImage(await loadImage(front.url));
  } catch {
    return DEFAULT_PALETTE;
  }
}

/** Busca MBID e arte no MusicBrainz e Cover Art Archive, com cache local de 30 dias. */
async function resolveRemote(album: Album): Promise<void> {
  if (!remoteEnabled()) return;
  const cached = await remoteCache.get(album.id);
  if (cached) {
    if (cached.images?.length) {
      const art = cached.images.map((i) => ({ type: i.type as Artwork['type'], url: i.url, origin: 'caa' as const, index: i.index }));
      addArtwork(album.id, art, { mbid: cached.mbid ?? undefined, year: album.year ?? cached.year, label: album.label ?? cached.label });
    }
    return;
  }
  const visible = album.tracks.filter((t) => t.number !== 0).length;
  let mbid = album.mbid ?? null;
  if (!mbid) {
    const candidates = await searchRelease(album.artist, album.title, visible);
    mbid = chooseCandidate(candidates, visible, album.tracks.length)?.id ?? null;
  }
  if (!mbid) {
    await remoteCache.set(album.id, { mbid: null, checkedAt: Date.now() });
    return;
  }
  const details = await getRelease(mbid);
  const art = caaToArtwork(details.images);
  await remoteCache.set(album.id, {
    mbid,
    checkedAt: Date.now(),
    year: details.release.year,
    label: details.release.label,
    images: art.map((a) => ({ type: a.type, url: a.url, small: a.url, index: a.index })),
  });
  addArtwork(album.id, art, {
    mbid,
    year: album.year ?? details.release.year,
    label: album.label ?? details.release.label,
  });
}

/**
 * Pipeline de arte de um álbum recém-importado: paleta, arte gerada para o que faltar
 * (para a caixa nunca ficar vazia) e, em paralelo, a arte remota que tem prioridade maior.
 */
export async function processAlbumArt(album: Album): Promise<void> {
  const palette = await computePalette(album);
  palettes.set(album.id, palette);
  try {
    const generated = await generateArtwork(album, palette, missingTypes(album));
    addArtwork(album.id, generated);
  } catch (error) {
    console.warn('Arte gerada falhou', error);
  }
  try {
    await resolveRemote(latest(album.id) ?? album);
    // Capa remota nova muda a paleta e a lombada/contracapa geradas ficam como reserva.
    const updated = latest(album.id);
    const front = pickArtwork(updated, 'front');
    if (updated && front?.origin === 'caa' && !pickArtwork(album, 'front')) {
      palettes.set(album.id, await computePalette(updated));
    }
  } catch (error) {
    // Identificação remota nunca bloqueia tocar.
    console.info('Identificação remota indisponível', error);
  }
}

/** Upload do usuário: prioridade sobre tudo, só na sessão. */
export function uploadArtwork(albumId: string, type: Artwork['type'], file: File): void {
  const album = latest(albumId);
  if (!album || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) return;
  const index = album.artwork.filter((a) => a.type === type && a.origin === 'upload').length;
  addArtwork(albumId, [{ type, url: URL.createObjectURL(file), origin: 'upload', index }]);
}

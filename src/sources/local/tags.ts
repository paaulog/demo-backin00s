import type { ArtworkType } from '../../core/types';
import { safeText } from '../../core/text';
import type { ParsedFile, RawPicture } from './grouping';

/** Subconjunto do `IAudioMetadata` do music-metadata que usamos, para testar sem o parser. */
export interface MetadataLike {
  common: {
    title?: string;
    artist?: string;
    albumartist?: string;
    album?: string;
    year?: number;
    genre?: string[];
    label?: string[];
    track: { no: number | null };
    disk: { no: number | null };
    musicbrainz_albumid?: string;
    picture?: { type?: string; format: string; data: Uint8Array }[];
  };
  format: { duration?: number };
  native?: Record<string, { id: string; value: unknown }[]>;
}

const TRACK_TAG_IDS = new Set(['TRCK', 'TRK', 'TRACKNUMBER', 'trkn', 'WM/TrackNumber', 'Track']);

/**
 * O music-metadata devolve `track.no = null` para a tag "0" (achado da S0).
 * A faixa oculta depende do 0 explícito, então lemos a tag nativa.
 */
export function trackNumberOf(meta: MetadataLike): number | undefined {
  if (typeof meta.common.track.no === 'number') return meta.common.track.no;
  for (const tags of Object.values(meta.native ?? {})) {
    for (const tag of tags) {
      if (!TRACK_TAG_IDS.has(tag.id)) continue;
      const raw = typeof tag.value === 'object' && tag.value !== null && 'no' in tag.value ? (tag.value as { no: unknown }).no : tag.value;
      const n = Number.parseInt(String(raw).split('/')[0] ?? '', 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return undefined;
}

/** Mapeia o tipo de imagem ID3/Vorbis/MP4 para o `ArtworkType` da caixa. */
export function mapPictureType(type: string | undefined): ArtworkType | null {
  const t = (type ?? '').toLowerCase();
  if (t.includes('front') || t === 'cover') return 'front';
  if (t.includes('back')) return 'back';
  if (t.includes('leaflet') || t.includes('booklet')) return 'booklet';
  if (t.includes('media') || t.includes('medium')) return 'medium';
  if (t.includes('tray')) return 'tray';
  if (t.includes('spine')) return 'spine';
  return null;
}

/** Imagem solta na pasta do álbum, pelo nome (cover.jpg, back.png, encarte-01.jpg...). */
export function imageTypeFromName(name: string): ArtworkType | null {
  const n = name.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  if (/(^|[^a-z])(front|cover|folder|capa|frente)([^a-z]|$)/.test(n)) return 'front';
  if (/(^|[^a-z])(back|contracapa|verso|traseira|inlay)([^a-z]|$)/.test(n)) return 'back';
  if (/(booklet|encarte|leaflet|livreto)/.test(n)) return 'booklet';
  if (/(^|[^a-z])(cd|disc|disco|medium|label)([^a-z]|$)/.test(n)) return 'medium';
  if (/(spine|lombada)/.test(n)) return 'spine';
  if (/(^|[^a-z])tray([^a-z]|$)/.test(n)) return 'tray';
  return null;
}

export function toParsedFile(
  meta: MetadataLike,
  file: { fileIndex: number; name: string; relativePath: string },
): ParsedFile {
  const c = meta.common;
  const pictures: RawPicture[] = [];
  const list = c.picture ?? [];
  list.forEach((p, i) => {
    // Imagem sem tipo útil: a primeira vira capa, as outras são ignoradas.
    const type = mapPictureType(p.type) ?? (i === 0 ? 'front' : null);
    if (type && p.data.length > 0 && p.data.length < 20 * 1024 * 1024) {
      pictures.push({ type, mime: p.format.startsWith('image/') ? p.format : `image/${p.format || 'jpeg'}`, data: p.data });
    }
  });
  const disk = c.disk.no;
  return {
    fileIndex: file.fileIndex,
    name: safeText(file.name),
    relativePath: file.relativePath,
    title: safeText(c.title) || undefined,
    artist: safeText(c.artist) || undefined,
    albumArtist: safeText(c.albumartist) || undefined,
    album: safeText(c.album) || undefined,
    year: typeof c.year === 'number' ? c.year : undefined,
    genre: safeText(c.genre?.[0], 60) || undefined,
    label: safeText(c.label?.[0], 80) || undefined,
    trackNo: trackNumberOf(meta),
    diskNo: typeof disk === 'number' && disk > 0 ? disk : undefined,
    mbAlbumId: c.musicbrainz_albumid,
    duration: meta.format.duration && Number.isFinite(meta.format.duration) ? meta.format.duration : undefined,
    pictures,
  };
}

import type { ArtworkType } from '../../core/types';
import { normalizeKey, safeText } from '../../core/text';

/** Uma imagem lida de tag ou da pasta, antes de virar blob: URL. */
export interface RawPicture {
  type: ArtworkType;
  mime: string;
  data: Uint8Array;
}

/** Resultado da leitura de um arquivo de áudio (worker), sem o File em si. */
export interface ParsedFile {
  /** Índice do arquivo na importação; vira o `sourceRef` da faixa. */
  fileIndex: number;
  name: string;
  /** Caminho relativo dentro da pasta escolhida (webkitRelativePath), ou só o nome. */
  relativePath: string;
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  year?: number;
  genre?: string;
  label?: string;
  /** 0 = faixa oculta. `undefined` = sem tag de faixa. */
  trackNo?: number;
  diskNo?: number;
  mbAlbumId?: string;
  duration?: number;
  pictures: RawPicture[];
  error?: string;
}

export interface AlbumGroup {
  key: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  label?: string;
  mbid?: string;
  /** Faixas já ordenadas por disco, faixa e nome do arquivo. */
  files: ParsedFile[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function folderOf(relativePath: string): string {
  const parts = relativePath.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

function lastSegment(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, { value: string; n: number }>();
  for (const v of values) {
    if (!v) continue;
    const k = normalizeKey(v);
    const entry = counts.get(k) ?? { value: v, n: 0 };
    entry.n += 1;
    counts.set(k, entry);
  }
  let best: { value: string; n: number } | undefined;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  return best?.value;
}

/** Chave de agrupamento: artista do álbum (ou artista) + álbum das tags; sem tags, a pasta. */
export function groupKey(file: ParsedFile): string {
  if (file.album) {
    return `tag:${normalizeKey(file.albumArtist ?? file.artist)}|${normalizeKey(file.album)}`;
  }
  return `dir:${folderOf(file.relativePath) || '(soltos)'}`;
}

export function compareFiles(a: ParsedFile, b: ParsedFile): number {
  const disc = (a.diskNo ?? 1) - (b.diskNo ?? 1);
  if (disc !== 0) return disc;
  const ta = a.trackNo ?? Number.POSITIVE_INFINITY;
  const tb = b.trackNo ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function groupFiles(files: ParsedFile[]): AlbumGroup[] {
  const groups = new Map<string, ParsedFile[]>();
  for (const f of files) {
    if (f.error) continue;
    const key = groupKey(f);
    const list = groups.get(key) ?? [];
    list.push(f);
    groups.set(key, list);
  }

  const result: AlbumGroup[] = [];
  for (const [key, list] of groups) {
    list.sort(compareFiles);
    const albumTitle = mostCommon(list.map((f) => f.album));
    const albumArtist = mostCommon(list.map((f) => f.albumArtist));
    const artists = new Set(list.map((f) => normalizeKey(f.artist)).filter(Boolean));
    const artist =
      albumArtist ?? (artists.size > 1 ? 'Vários artistas' : mostCommon(list.map((f) => f.artist)) ?? 'Artista desconhecido');
    const folder = lastSegment(folderOf(list[0]?.relativePath ?? ''));
    const mbid = list.map((f) => f.mbAlbumId).find((id) => id && UUID.test(id));
    const years = list.map((f) => f.year).filter((y): y is number => typeof y === 'number' && y > 1800 && y < 2200);
    result.push({
      key,
      title: safeText(albumTitle ?? (folder || 'Sem título')),
      artist: safeText(artist),
      year: years.length ? Math.min(...years) : undefined,
      genre: mostCommon(list.map((f) => f.genre)),
      label: mostCommon(list.map((f) => f.label)),
      mbid: mbid?.toLowerCase(),
      files: list,
    });
  }
  return result.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
}

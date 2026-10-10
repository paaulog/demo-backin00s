import { normalizeKey } from './text';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AlbumIdInput {
  mbid?: string;
  artist: string;
  title: string;
  year?: number;
}

/**
 * `Album.id` estável entre sessões: MBID quando as tags trazem, senão SHA-256 de
 * artista, álbum e ano normalizados. Variações de caixa, acento e pontuação dão o mesmo id.
 */
export async function albumIdFor(input: AlbumIdInput): Promise<string> {
  if (input.mbid && UUID.test(input.mbid)) return `mb:${input.mbid.toLowerCase()}`;
  const basis = [normalizeKey(input.artist), normalizeKey(input.title), input.year ? String(input.year) : ''].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `h:${hex}`;
}

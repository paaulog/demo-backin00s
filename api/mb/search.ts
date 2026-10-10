import { badRequest, json, preflight } from '../_lib/http';
import { luceneEscape, mbFetch, toCandidate, type MbSearchRelease } from '../_lib/musicbrainz';

const MAX_LEN = 200;

/** GET /api/mb/search?artist=&album=&tracks= → candidatos com score. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const artist = (url.searchParams.get('artist') ?? '').trim();
  const album = (url.searchParams.get('album') ?? '').trim();
  const tracksRaw = url.searchParams.get('tracks');
  if (!artist || !album || artist.length > MAX_LEN || album.length > MAX_LEN) {
    return badRequest(request, 'artist e album são obrigatórios (até 200 caracteres)');
  }
  const tracks = tracksRaw === null ? null : Number(tracksRaw);
  if (tracks !== null && (!Number.isInteger(tracks) || tracks < 1 || tracks > 200)) {
    return badRequest(request, 'tracks deve ser inteiro de 1 a 200');
  }

  const query = `release:"${luceneEscape(album)}" AND artist:"${luceneEscape(artist)}"`;
  const res = await mbFetch(`/release/?query=${encodeURIComponent(query)}&fmt=json&limit=10`);
  if (res.status === 503) return json(request, { error: 'MusicBrainz ocupado' }, { status: 503 });
  if (!res.ok) return json(request, { error: `MusicBrainz respondeu ${res.status}` }, { status: 502 });
  const data = (await res.json()) as { releases?: MbSearchRelease[] };
  const candidates = (data.releases ?? []).map(toCandidate);
  return json(request, { candidates, requestedTracks: tracks }, { cacheSeconds: 7 * 24 * 3600 });
}

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

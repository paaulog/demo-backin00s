import { badRequest, json, preflight, UUID } from '../../_lib/http';
import { mbFetch } from '../../_lib/musicbrainz';

interface MbRelease {
  id: string;
  title: string;
  date?: string;
  'artist-credit'?: { name: string; joinphrase?: string }[];
  'label-info'?: { label?: { name?: string } }[];
  'release-group'?: { id: string };
  media?: { position: number; tracks?: { position: number; number: string; title: string; length: number | null }[] }[];
}

export interface CaaImage {
  types: string[];
  front: boolean;
  back: boolean;
  image: string;
  thumbnails: Record<string, string>;
}

async function caaImages(kind: 'release' | 'release-group', mbid: string): Promise<CaaImage[]> {
  const res = await fetch(`https://coverartarchive.org/${kind}/${mbid}/`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`CAA respondeu ${res.status}`);
  const data = (await res.json()) as { images?: CaaImage[] };
  return data.images ?? [];
}

/** Força https: o CAA às vezes devolve URLs http:// nas miniaturas. */
function https(url: string | undefined): string | undefined {
  return url?.replace(/^http:\/\//, 'https://');
}

/** GET /api/mb/release/:mbid → detalhes do release e lista de arte do CAA. */
export async function GET(request: Request): Promise<Response> {
  const mbid = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';
  if (!UUID.test(mbid)) return badRequest(request, 'MBID inválido');

  const res = await mbFetch(`/release/${mbid}?inc=recordings+labels+artist-credits+release-groups&fmt=json`);
  if (res.status === 404) return json(request, { error: 'Release não encontrado' }, { status: 404 });
  if (res.status === 503) return json(request, { error: 'MusicBrainz ocupado' }, { status: 503 });
  if (!res.ok) return json(request, { error: `MusicBrainz respondeu ${res.status}` }, { status: 502 });
  const r = (await res.json()) as MbRelease;

  let images: CaaImage[];
  let imagesFrom: 'release' | 'release-group' | null = null;
  try {
    images = await caaImages('release', mbid);
    if (images.length) imagesFrom = 'release';
    else if (r['release-group']?.id) {
      // Release-group só para a capa, como no techspec.
      images = (await caaImages('release-group', r['release-group'].id)).filter((img) => img.front);
      if (images.length) imagesFrom = 'release-group';
    }
  } catch {
    images = [];
  }

  const year = r.date ? Number.parseInt(r.date.slice(0, 4), 10) : undefined;
  const body = {
    release: {
      id: r.id,
      title: r.title,
      artist: (r['artist-credit'] ?? []).map((c) => `${c.name}${c.joinphrase ?? ''}`).join(''),
      year: Number.isFinite(year) ? year : undefined,
      label: r['label-info']?.[0]?.label?.name,
      releaseGroupId: r['release-group']?.id,
      tracks: (r.media ?? []).flatMap((m) =>
        (m.tracks ?? []).map((t) => ({ disc: m.position, position: t.position, title: t.title, length: t.length })),
      ),
    },
    imagesFrom,
    images: images.map((img) => ({
      types: img.types,
      front: img.front,
      back: img.back,
      image: https(img.image),
      large: https(img.thumbnails['1200'] ?? img.thumbnails.large ?? img.image),
      small: https(img.thumbnails['250'] ?? img.thumbnails.small ?? img.image),
    })),
  };
  return json(request, body, { cacheSeconds: 30 * 24 * 3600 });
}

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

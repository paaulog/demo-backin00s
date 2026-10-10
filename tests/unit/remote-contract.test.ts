// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxyImage, checkUrl } from '../../api/img';
import { GET as releaseRoute } from '../../api/mb/release/[mbid]';
import { GET as searchRoute } from '../../api/mb/search';
import { mbFetch, resetQueue } from '../../api/_lib/musicbrainz';
import { caaToArtwork, chooseCandidate, type RemoteImage } from '../../src/art/caa';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/remote/${name}`, import.meta.url), 'utf8')) as unknown;
const ORIGIN = 'https://paaulog.github.io';
const MBID = '1d3b7c4e-1111-4a2b-9c3d-0123456789ab';

function req(path: string, origin = ORIGIN) {
  return new Request(`https://api.example.test${path}`, { headers: { origin } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let calls: { url: string; init?: RequestInit }[];

beforeEach(() => {
  resetQueue();
  calls = [];
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 200 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(routes: Record<string, () => Response>) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    for (const [prefix, make] of Object.entries(routes)) if (url.startsWith(prefix)) return make();
    return new Response('not found', { status: 404 });
  });
}

describe('/api/mb/search', () => {
  it('normaliza candidatos, manda User-Agent com contato e libera CORS para o Pages', async () => {
    stubFetch({ 'https://musicbrainz.org/ws/2/release/': () => jsonResponse(fixture('mb-search.json')) });
    const res = await searchRoute(req('/api/mb/search?artist=Chico%20Science&album=Da%20Lama%20ao%20Caos&tracks=13'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('cache-control')).toContain('s-maxage=604800');
    const body = (await res.json()) as { candidates: { id: string; artist: string; trackCount: number; year: number; label: string }[] };
    expect(body.candidates[0]).toMatchObject({ id: MBID, artist: 'Chico Science & Nação Zumbi', trackCount: 13, year: 1994, label: 'Chaos' });
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('user-agent')).toMatch(/^BackIn00s\/\S+ \( .+ \)$/);
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('release:"Da Lama ao Caos" AND artist:"Chico Science"');
  });

  it('não libera CORS para outra origem', async () => {
    stubFetch({ 'https://musicbrainz.org': () => jsonResponse(fixture('mb-search.json')) });
    const res = await searchRoute(req('/api/mb/search?artist=a&album=b', 'https://evil.example'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('valida parâmetros', async () => {
    stubFetch({});
    expect((await searchRoute(req('/api/mb/search?artist=a'))).status).toBe(400);
    expect((await searchRoute(req(`/api/mb/search?artist=${'a'.repeat(201)}&album=b`))).status).toBe(400);
    expect((await searchRoute(req('/api/mb/search?artist=a&album=b&tracks=0'))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('repassa 503 do MusicBrainz sem cache', async () => {
    stubFetch({ 'https://musicbrainz.org': () => new Response('', { status: 503 }) });
    const res = await searchRoute(req('/api/mb/search?artist=a&album=b'));
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('/api/mb/release/:mbid', () => {
  it('junta release do MB e imagens do CAA em https', async () => {
    stubFetch({
      [`https://musicbrainz.org/ws/2/release/${MBID}`]: () => jsonResponse(fixture('mb-release.json')),
      [`https://coverartarchive.org/release/${MBID}/`]: () => jsonResponse(fixture('caa-release.json')),
    });
    const res = await releaseRoute(req(`/api/mb/release/${MBID}`));
    const body = (await res.json()) as { release: { year: number; tracks: unknown[] }; imagesFrom: string; images: RemoteImage[] };
    expect(res.headers.get('cache-control')).toContain('s-maxage=2592000');
    expect(body.release.year).toBe(1994);
    expect(body.release.tracks).toHaveLength(2);
    expect(body.imagesFrom).toBe('release');
    expect(body.images[0]?.large).toBe(`https://coverartarchive.org/release/${MBID}/100-1200.jpg`);
    expect(body.images.every((i) => i.image?.startsWith('https://'))).toBe(true);
  });

  it('sem arte no release usa só a capa do release-group', async () => {
    const rg = '9f8e7d6c-2222-4b3a-8d4c-abcdef012345';
    const caa = fixture('caa-release.json') as { images: unknown[] };
    stubFetch({
      [`https://musicbrainz.org/ws/2/release/${MBID}`]: () => jsonResponse(fixture('mb-release.json')),
      [`https://coverartarchive.org/release/${MBID}/`]: () => new Response('', { status: 404 }),
      [`https://coverartarchive.org/release-group/${rg}/`]: () => jsonResponse(caa),
    });
    const body = (await (await releaseRoute(req(`/api/mb/release/${MBID}`))).json()) as { imagesFrom: string; images: RemoteImage[] };
    expect(body.imagesFrom).toBe('release-group');
    expect(body.images).toHaveLength(1);
    expect(body.images[0]?.front).toBe(true);
  });

  it('rejeita MBID que não é UUID', async () => {
    stubFetch({});
    expect((await releaseRoute(req('/api/mb/release/../../etc'))).status).toBe(400);
  });
});

describe('fila do MusicBrainz', () => {
  it('espaça as chamadas em pelo menos 1,1 s', async () => {
    const times: number[] = [];
    const fetcher = (async () => {
      times.push(Date.now());
      return new Response('{}');
    }) as unknown as typeof fetch;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    await Promise.all([mbFetch('/a', fetcher, sleep), mbFetch('/b', fetcher, sleep), mbFetch('/c', fetcher, sleep)]);
    expect(times).toHaveLength(3);
    expect((times[1] ?? 0) - (times[0] ?? 0)).toBeGreaterThanOrEqual(1100);
    expect((times[2] ?? 0) - (times[1] ?? 0)).toBeGreaterThanOrEqual(1100);
  });
});

describe('/api/img', () => {
  const image = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg', 'content-length': '3' } });

  it('aceita só https em hosts da allowlist', () => {
    expect(checkUrl('https://coverartarchive.org/release/x/front')).not.toBeNull();
    expect(checkUrl('https://ia800.us.archive.org/1/x.jpg')).not.toBeNull();
    expect(checkUrl('http://coverartarchive.org/x')).toBeNull();
    expect(checkUrl('https://evil.example/x')).toBeNull();
    expect(checkUrl('https://archive.org.evil.example/x')).toBeNull();
    expect(checkUrl('https://169.254.169.254/latest')).toBeNull();
    expect(checkUrl('https://user:pw@archive.org/x')).toBeNull();
  });

  it('segue redirect permitido e devolve a imagem com CORS', async () => {
    const fetcher = (async (url: string) => {
      if (url.startsWith('https://coverartarchive.org')) return new Response(null, { status: 307, headers: { location: 'https://ia800.us.archive.org/x.jpg' } });
      return image();
    }) as unknown as typeof fetch;
    const res = await proxyImage(req(`/api/img?url=${encodeURIComponent('https://coverartarchive.org/release/x/front')}`), fetcher);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('bloqueia redirect para fora da allowlist (SSRF)', async () => {
    const fetcher = (async () => new Response(null, { status: 302, headers: { location: 'https://10.0.0.1/admin' } })) as unknown as typeof fetch;
    const res = await proxyImage(req(`/api/img?url=${encodeURIComponent('https://coverartarchive.org/x')}`), fetcher);
    expect(res.status).toBe(400);
  });

  it('recusa resposta que não é imagem ou grande demais', async () => {
    const html = (async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    expect((await proxyImage(req(`/api/img?url=${encodeURIComponent('https://archive.org/x')}`), html)).status).toBe(400);
    const big = (async () => new Response('x', { headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) } })) as unknown as typeof fetch;
    expect((await proxyImage(req(`/api/img?url=${encodeURIComponent('https://archive.org/x')}`), big)).status).toBe(400);
  });
});

describe('cliente: identificação e mapeamento', () => {
  it('aceita só score ≥ 90 com a mesma contagem de faixas', () => {
    const c = (score: number, trackCount: number) => ({ id: `${score}-${trackCount}`, score, title: '', artist: '', trackCount });
    expect(chooseCandidate([c(100, 12), c(95, 13)], 13)?.id).toBe('95-13');
    expect(chooseCandidate([c(89, 13)], 13)).toBeNull();
    expect(chooseCandidate([c(92, 14)], 13, 14)?.id).toBe('92-14');
  });

  it('mapeia tipos do CAA, ignora os que a caixa não usa e indexa o encarte', () => {
    const caa = fixture('caa-release.json') as { images: (RemoteImage & { thumbnails: Record<string, string> })[] };
    const images: RemoteImage[] = caa.images.map((i) => ({ ...i, image: i.image?.replace('http:', 'https:'), large: i.thumbnails['1200']?.replace('http:', 'https:') }));
    const art = caaToArtwork(images);
    expect(art.map((a) => `${a.type}:${a.index}`)).toEqual(['front:0', 'back:0', 'booklet:0', 'booklet:1', 'medium:0']);
    expect(art.every((a) => a.origin === 'caa' && a.url.startsWith('https://'))).toBe(true);
  });
});

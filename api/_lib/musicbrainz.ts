/**
 * Cliente do MusicBrainz para as funções: User-Agent com contato e fila de 1 req/s.
 * A fila vale por instância; o cache de CDN das rotas absorve o grosso das chamadas.
 */

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MIN_INTERVAL_MS = 1100;
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;

export function userAgent(): string {
  const contact = process.env.MB_CONTACT || 'https://github.com/paaulog/demo-backin00s';
  return `BackIn00s/0.1 ( ${contact} )`;
}

type Fetcher = typeof fetch;

export function mbFetch(path: string, fetcher: Fetcher = fetch, sleep = defaultSleep): Promise<Response> {
  const run = async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return fetcher(`${MB_BASE}${path}`, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' } });
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Só para testes. */
export function resetQueue(): void {
  chain = Promise.resolve();
  lastCall = 0;
}

/** Escapa caracteres especiais do Lucene usado pela busca do MusicBrainz. */
export function luceneEscape(value: string): string {
  return value.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');
}

export interface MbSearchRelease {
  id: string;
  score: number;
  title: string;
  date?: string;
  'track-count'?: number;
  'artist-credit'?: { name: string; joinphrase?: string }[];
  'label-info'?: { label?: { name?: string } }[];
  'release-group'?: { id: string };
}

export interface Candidate {
  id: string;
  releaseGroupId?: string;
  score: number;
  title: string;
  artist: string;
  trackCount: number;
  year?: number;
  label?: string;
}

export function toCandidate(r: MbSearchRelease): Candidate {
  const year = r.date ? Number.parseInt(r.date.slice(0, 4), 10) : undefined;
  return {
    id: r.id,
    releaseGroupId: r['release-group']?.id,
    score: r.score,
    title: r.title,
    artist: (r['artist-credit'] ?? []).map((c) => `${c.name}${c.joinphrase ?? ''}`).join(''),
    trackCount: r['track-count'] ?? 0,
    year: Number.isFinite(year) ? year : undefined,
    label: r['label-info']?.[0]?.label?.name,
  };
}

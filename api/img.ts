import { badRequest, corsHeaders, preflight } from './_lib/http';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** Allowlist verificada em cada salto de redirect (o CAA responde 307 para archive.org). */
export function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // IP literal nunca: evita SSRF para endereços internos.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || h === 'localhost') return false;
  return h === 'coverartarchive.org' || h === 'archive.org' || h.endsWith('.archive.org');
}

export function checkUrl(raw: string | null): URL | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    return isAllowedHost(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/img?url= → proxy de imagem com CORS, só para o caso de o CAA não liberar CORS
 * para texturas WebGL (decisão da S0).
 */
export async function proxyImage(request: Request, fetcher: typeof fetch): Promise<Response> {
  let target = checkUrl(new URL(request.url).searchParams.get('url'));
  if (!target) return badRequest(request, 'URL fora da allowlist');

  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    res = await fetcher(target.toString(), { redirect: 'manual', headers: { Accept: 'image/*' } });
    if (res.status < 300 || res.status >= 400) break;
    const next = checkUrl(res.headers.get('location') ? new URL(res.headers.get('location') ?? '', target).toString() : null);
    if (!next) return badRequest(request, 'Redirect para host fora da allowlist');
    target = next;
    res = null;
  }
  if (!res) return badRequest(request, 'Redirects demais');
  if (!res.ok) return new Response(null, { status: res.status === 404 ? 404 : 502, headers: corsHeaders(request) });

  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return badRequest(request, 'Resposta não é imagem');
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > MAX_BYTES) return badRequest(request, 'Imagem grande demais');

  const reader = res.body?.getReader();
  if (!reader) return new Response(null, { status: 502, headers: corsHeaders(request) });
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return badRequest(request, 'Imagem grande demais');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(request),
    },
  });
}

export function GET(request: Request): Promise<Response> {
  return proxyImage(request, fetch);
}

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

/** Utilitários comuns das funções (Vercel, runtime Node com Web Request/Response). */

const DEFAULT_ORIGINS = ['https://paaulog.github.io', 'http://localhost:5173', 'http://localhost:4173'];

export function allowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGIN;
  return env ? env.split(',').map((o) => o.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

export function json(request: Request, body: unknown, init: { status?: number; cacheSeconds?: number } = {}): Response {
  const status = init.status ?? 200;
  const cache =
    status === 200 && init.cacheSeconds
      ? `public, max-age=3600, s-maxage=${init.cacheSeconds}, stale-while-revalidate=86400`
      : 'no-store';
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, ...corsHeaders(request) },
  });
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function badRequest(request: Request, message: string): Response {
  return json(request, { error: message }, { status: 400 });
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

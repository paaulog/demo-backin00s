# S6. Arte remota

**Objetivo:** a caixa nunca fica vazia: arte do usuário, do MusicBrainz/Cover Art Archive ou gerada.
**RFs:** RF09 (conteúdo do encarte).

## Contratos

- Funções na Vercel (`api/`, runtime Node com `Request`/`Response`), todas GET com CORS restrito a `ALLOWED_ORIGIN` (padrão: `https://paaulog.github.io` e localhost):
  - `GET /api/mb/search?artist=&album=&tracks=` → `{ candidates: Candidate[] }`, cache de CDN de 7 dias.
  - `GET /api/mb/release/:mbid` → `{ release, imagesFrom, images }`, cache de 30 dias. Sem arte no release, usa a capa do release-group.
  - `GET /api/img?url=` → proxy de imagem, 30 dias. Allowlist (`coverartarchive.org`, `archive.org`, `*.archive.org`) conferida em cada redirect, sem IP literal, só `https`, só `image/*`, máximo 8 MB.
- Cliente: `src/art/remote.ts`, `src/art/caa.ts`, `src/art/pipeline.ts`, `src/art/generate.ts`, `src/art/pick.ts`.

## Regras

- Identificação: MBID das tags; senão busca com score ≥ 90 e mesma contagem de faixas (visíveis ou com a oculta).
- Prioridade por tipo: upload > embutida > CAA > gerada (`pickArtwork`). O encarte usa todas as páginas da melhor origem.
- Geração em `OffscreenCanvas` (com fallback para `<canvas>`) a 10 px/mm: contracapa como inlay inteiro de 151 × 118 mm com as lombadas, lombada 118 × 6,5 mm, label do disco com furo transparente e página de créditos.
- Paleta: histograma de 4 bits por canal sobre a capa reduzida a 48 × 48. **Desvio do techspec:** troquei o node-vibrant por esta função (mesma interface `Palette`, sem dependência nova).
- CORS do CAA: a imagem é carregada direto com `crossOrigin="anonymous"`; se falhar, o `loadImage` tenta pelo `/api/img` e passa a usar o proxy na sessão. Assim o código funciona com qualquer resultado da S0.
- Cache local (IndexedDB) do MBID e das URLs do CAA por 30 dias. Arte embutida e uploads **não** persistem (decisão do techspec mantida; questão em aberto registrada abaixo).
- Identificação remota nunca bloqueia tocar.

## Testes

`remote-contract.test.ts` (rotas, User-Agent, CORS, validação, 503, release-group, fila de 1,1 s, SSRF do proxy) e `art.test.ts` (prioridade, encarte, paleta, o que gerar).

**Fixtures:** `tests/fixtures/remote/*.json` foram montadas a partir do formato documentado das APIs, não gravadas: o MusicBrainz e o CAA não respondem a partir do ambiente onde o código foi escrito. Regravar com respostas reais é pendência desta spec.

## Questão em aberto

Lembrar arte embutida e uploads entre visitas, ou só durante a sessão? Hoje: só sessão.

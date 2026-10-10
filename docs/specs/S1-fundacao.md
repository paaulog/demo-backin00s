# S1. Fundação

**Objetivo:** esqueleto publicado com CI rodando.
**RFs:** RF18.

## Decisões desta spec

- **Host:** front no GitHub Pages (`/demo-backin00s/`), funções `/api` numa Vercel separada. Responde à questão em aberto "confirmar Vercel como host" (decisão do Paulo, 10/10/2026).
- **CSP:** o Pages não permite cabeçalhos, então a política vai numa `<meta http-equiv>` gerada no build. `connect-src` e `img-src` liberam só `self`, `blob:`, Cover Art Archive, archive.org e a origem de `VITE_API_BASE`.
- **TypeScript 6.0.3**, como recomendado no techspec. Confirmado: `typescript-eslint` 8.71.1 exige `typescript <6.1.0`.
- **CI:** GitHub Actions roda lint, typecheck, unidade, build e E2E nos três motores; o deploy do Pages só acontece na `main` com tudo verde.
- **Um PR por spec:** não foi possível nesta sessão (API do GitHub sem token válido). Cada spec entra como um commit na `main`.

## Contratos

`src/core/types.ts` (`Album`, `Track`, `Artwork`, `MusicSource`, `PlaybackHandle`, `Theme`, `Palette`) e `src/store/store.ts` com as fatias coleção, player, tema e cena.

## Critérios de aceite

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam.
- Layout com área do canvas, área de controles e área reservada ao player do YouTube.
- Botão de doação com `target="_blank"` e `rel="noopener noreferrer"` (teste de componente).
- Variáveis: `VITE_API_BASE` e `VITE_DONATE_URL` no front (variáveis do repositório no Actions); `MB_CONTACT` e `JAMENDO_CLIENT_ID` na Vercel.

## Fora de escopo

Preview por PR (o Pages só publica a `main`; a Vercel tem preview só para as funções).

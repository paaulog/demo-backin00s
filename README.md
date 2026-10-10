# Back in 00s · player nostálgico de CDs

Player web que trata cada álbum como um CD físico: a caixa aparece em 3D, você tira o plástico, abre, tira o disco, coloca para tocar e folheia o encarte. Áudio local nunca sai do navegador.

- Demo: https://paaulog.github.io/demo-backin00s/
- Spike S0: https://paaulog.github.io/demo-backin00s/spike.html
- Specs do SDD: [`docs/specs`](docs/specs)

## Rodar localmente

```bash
npm ci
npm run dev        # http://localhost:5173/demo-backin00s/
npm test           # unidade (Vitest)
npx playwright install && npm run e2e
```

`npm run fixtures` regenera o álbum de demonstração em `public/demo` (requer Python 3.12+, numpy, Pillow e ffmpeg). Todo o áudio é sintetizado no script.

## Variáveis

| Onde | Variável | Uso |
|---|---|---|
| Actions (variável do repositório) | `API_BASE` | Origem das funções na Vercel, ex.: `https://demo-backin00s-api.vercel.app` |
| Actions (variável do repositório) | `DONATE_URL` | Link do botão de doação |
| Vercel | `MB_CONTACT` | Contato no User-Agent do MusicBrainz |
| Vercel | `ALLOWED_ORIGIN` | Origem do front liberada no CORS (padrão `https://paaulog.github.io`) |

## Arquitetura

SPA estática (React 19 + React Three Fiber + Vite) no GitHub Pages. As funções em `api/` rodam na Vercel e só tocam metadados (MusicBrainz e proxy de imagem do Cover Art Archive). Detalhes no PRD e no techspec.

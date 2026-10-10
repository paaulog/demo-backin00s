# S0. Spike

**Objetivo:** medir os três riscos técnicos antes de investir na caixa 3D.
**RFs:** nenhum (pré-requisito de S4 e S6).
**Entrega:** página `spike.html`, publicada junto com a demo, sem React, que mede e gera um JSON.

## Testes

| # | Risco | Como mede | Decisão gerada |
|---|---|---|---|
| 1 | `transmission` em GPU integrada | Caixa 142 × 125 × 10 mm com `MeshPhysicalMaterial` (`transmission: 1`, `ior: 1.59`), ambiente `RoomEnvironment` (substitui o HDRI, sem arquivo externo) e bloom; 6 s girando. Repete com `opacity: 0.25`. | ≥ 55 fps: transmission nos níveis médio e alto. 30 a 55: só no alto. < 30: opacity fora do alto |
| 2 | CORS do MusicBrainz e do CAA | `fetch` na busca do MB, `fetch` no JSON do CAA e upload real da capa `front-250` como textura WebGL (segue o 307) | Textura ok: CAA direto. Falha: proxy `/api/img` |
| 3 | `music-metadata` com `parseBlob` | MP3 do álbum de demonstração e FLAC curto gerado em `scripts/make_fixtures.py` | Falha no Safari: ler tags na thread principal ou só pelo nome do arquivo |

## Critérios de aceite

- A página roda em Chrome, Firefox e Safari e produz o JSON.
- Os resultados de cada navegador ficam em `docs/specs/S0-resultados.md`.

## Fora de escopo

Medir postprocessing SSAO; o techspec só exige bloom leve na spike.

## Achado já registrado

No Node, `music-metadata` 12.1.0 devolve `track.no = null` para a tag `TRCK=0/4`. A faixa oculta (S3) precisa ler a tag nativa (`TRCK`, `TRACKNUMBER`, `trkn`) para reconhecer o número 0.

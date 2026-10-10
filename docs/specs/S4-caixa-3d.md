# S4. Caixa 3D

**Objetivo:** a caixa de CD em 3D realista, nas medidas reais, recebendo a arte do álbum.
**RFs:** RF06.

## Desvio do techspec

O techspec pede um `.glb` modelado no Blender com Draco e texturas de desgaste em KTX2. Não havia Blender no ambiente de desenvolvimento, então **o modelo é gerado em código** (`src/box/JewelCase.tsx`), com as mesmas partes nomeadas (`lid`, `base`, `tray`, `rosette`, `disc`, `booklet_page_*`, `inlay`, `shrinkwrap`, `top_sticker`), a mesma escala (1 unidade = 1 mm) e o pivô da tampa no eixo da dobradiça. Trocar por um `.glb` depois mantém os nomes, a máquina e a aplicação de arte. A variante "usada" hoje só amarela o plástico e aumenta a rugosidade para álbuns anteriores a 2000; riscos e trinca em KTX2 ficam para quando houver o modelo.

## Contratos

- `src/box/dimensions.ts`: medidas (142 × 125 × 10 mm, disco de 120 mm com furo de 15 mm, encarte de 120 mm, inlay 151 × 118 mm com lombadas de 6,5 mm), `inlayRegions()` e `coverCrop()`.
- `src/box/materials.ts`: materiais por nível de qualidade.

## Materiais

| Peça | Material | Nível alto | Médio e baixo |
|---|---|---|---|
| Tampa, base | `MeshPhysicalMaterial` | `transmission` 1, `ior` 1,59, clearcoat | `opacity` 0,18 a 0,22 |
| Bandeja | `MeshStandardMaterial` preto | igual | igual |
| Disco (dados) | `MeshPhysicalMaterial` metal 1, `iridescence` 1 | igual | igual |
| Label, encarte, inlay | `MeshPhysicalMaterial` com a arte, clearcoat leve | igual | igual |
| Plástico | `MeshPhysicalMaterial` transparente com normal map amassado gerado em canvas | igual | igual |

`transmission` fica só no nível alto até a S0 medir GPU integrada (regra da spike: ≥ 55 fps libera o médio).

## Interação

Arrastar gira (`@use-gesture/react`), com inclinação limitada a ±0,7 rad para a caixa nunca sumir. Roda e pinça aproximam (260 a 900 mm). Setas giram e `+`/`-` aproximam com o foco na cena.

## Arte

Capa 120 × 120 mm recortada sem esticar; inlay dividido em painel de 138 mm e duas lombadas de 6,5 mm pelas UVs; lombada própria (`spine`) substitui as do inlay quando existe; label do disco usa `medium` ou, sem ele, a capa.

## Testes

`uv-layout.test.ts` (regiões do inlay, encaixe da capa, recorte). Screenshot da caixa fechada: em `tests/e2e/visual.spec.ts` (S11).

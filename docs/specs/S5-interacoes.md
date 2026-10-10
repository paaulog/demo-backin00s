# S5. Interações da caixa

**Objetivo:** o ritual completo de abrir o CD, guiado por uma máquina de estados.
**RFs:** RF07 a RF11.

## Contrato

`boxMachine` (`src/box/machine.ts`, XState 5), paralela com duas regiões:

| Evento | De | Para | Guarda / efeito |
|---|---|---|---|
| `PULL` | estante | fechada | guarda `albumId` e `shrinkwrapRemoved` lido do IndexedDB |
| `UNWRAP` | fechada | fechada | só embrulhada; persiste a flag (RF10) |
| `OPEN` | fechada | aberta | exige plástico removido (RF07) |
| `CLOSE` | aberta | fechada | encarte fechado (o disco está na bandeja por definição) |
| `TAKE_DISC` | aberta | disco na mão | encarte fechado (RF08) |
| `INSERT_DISC` | disco na mão | tocando | carrega a fila e toca |
| `EJECT` | tocando | disco na mão | pausa mantendo a posição; encarte fechado |
| `RETURN_DISC` | disco na mão | aberta | |
| `SHELVE` | fechada | estante | |
| `OPEN_BOOKLET` | aberta ou tocando | encarte aberto | região paralela: a música segue (RF09) |
| `CLOSE_BOOKLET` | encarte aberto | encarte fechado | |
| `PRIMARY` (Enter) | qualquer | ação contextual | tirar plástico → abrir → tirar disco → tocar → abrir encarte |
| `BACK` (Esc) | qualquer | um passo atrás | fecha o encarte antes de ejetar |

Ações (`persistUnwrap`, `startPlayback`, `pausePlayback`, `sfx`) são injetadas por `provide` em `boxActor.ts`; a máquina não conhece React, player nem IndexedDB.

## Cena

Animações com `@react-spring/three` reagindo só ao estado: dobradiça (−112°), plástico e adesivo saindo, disco indo para a mão e para o aparelho, encarte saindo da tampa para leitura com folhas que giram na lombada, disco girando com aceleração e parada suave (RF11). `prefers-reduced-motion` torna tudo instantâneo e para a rotação do disco.

Cliques usam o raycasting do R3F nas partes nomeadas. Cada ação aceita no estado atual também aparece como botão HTML sobre a cena (`SceneActions`). O encarte abre em tela cheia 2D na resolução da imagem (`BookletViewer`).

**Simplificação:** as páginas giram rígidas, sem curvatura por bones ou morph targets.

## Testes

- Unidade: `box-machine.test.ts` cobre todas as transições, guardas, a região paralela, Enter e Esc.
- E2E: `flow.spec.ts` roda "carregar pasta, tirar plástico, abrir, tirar disco, tocar, folhear encarte" nos três motores, também só com teclado, e verifica que nenhuma requisição carrega corpo (RF16).

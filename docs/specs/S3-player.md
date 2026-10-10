# S3. Player

**Objetivo:** tocar o álbum como um aparelho de CD, com a lógica fora do React.
**RFs:** RF01, RF02, RF04, RF05.

## Contratos

- `PlayerEngine` (`src/player/PlayerEngine.ts`): `load(album, {autoplay, trackId})`, `play`, `pause`, `toggle`, `next`, `prev`, `seek`, `selectTrack`, `setShuffle`, `setRepeat`, `cycleRepeat`, `stop`, `subscribe(snapshot => …)`.
- `AudioBackend`: interface do elemento de áudio. `HtmlAudioBackend` usa dois `HTMLAudioElement` alternados (pré-carga da próxima faixa). Os testes usam um backend falso.
- `PlayerSnapshot` (`src/store/store.ts`): o que a UI e a cena leem. `displayTime` é negativo na faixa oculta.

## Regras

| Regra | Comportamento |
|---|---|
| Ordem | Ordem do álbum por padrão |
| Shuffle | Fisher-Yates numa cópia dos índices, com a faixa atual na posição 0; desligar volta à ordem do álbum sem trocar a faixa |
| Repeat | `off` → para no fim e volta à faixa 1 parada; `album` → recomeça (reembaralha se shuffle); `track` → repete a faixa, "próxima" ainda avança |
| Voltar | Mais de 3 s decorridos reinicia a faixa; até 3 s vai para a anterior |
| Faixa oculta | `number = 0` fica fora da fila visível. Na faixa 1 com até 3 s, "voltar" entra nela; o visor conta de -duração até 0:00; ao terminar, segue para a faixa 1. Com shuffle não existe "antes da faixa 1" |
| Erro | Erro do elemento ou da fonte marca a faixa como indisponível (aviso no visor e na lista) e pula na mesma direção; sem faixas tocáveis, para com "Nenhuma faixa disponível" |
| Autoplay bloqueado | `NotAllowedError` vira "Aperte play para começar" |
| Visor | SVG próprio de sete segmentos (sem fonte de terceiros), atualizado a 4 Hz pelo engine |
| Media Session | Título, artista, álbum, capa; play, pause, próxima, anterior, seek e stop |

## Critérios de aceite

Testes de unidade cobrem todas as regras da tabela (21 casos em `player-engine.test.ts`) e o visor (`display.test.tsx`).

## Fora de escopo

Gapless real; detecção automática de pregap no áudio; marcar manualmente um arquivo como pregap (fica para depois; hoje só pela tag 0).

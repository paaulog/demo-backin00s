# S8. Temas e sons

**Objetivo:** o visual acompanha o gênero do álbum tocando, e a caixa faz barulho de caixa.
**RFs:** RF17.

## Decisões (questões em aberto do PRD, propostas minhas)

- **Lista inicial de temas:** neutro (obrigatório), rock, eletrônica, MPB e samba, jazz e blues, hip-hop e rap, pop, erudita. Cada `Theme` é dado puro em `src/theme/themes.ts`.
- **Tabela de sinônimos:** `src/theme/genre.ts`, com chaves normalizadas; aceita gêneros compostos ("Rock; Pop", "Indie/Folk") e palavra-chave contida ("Brazilian Rock"). Sem correspondência, tema neutro tingido com a paleta da capa.
- **Origem dos efeitos:** sintetizados no código em `AudioBuffer` (`src/sfx/sfx.ts`), sem arquivo de terceiros. Isso responde "gravar ou usar banco CC0" com uma terceira opção; trocar por gravações é só substituir as receitas.

## Regras

- O tema segue o álbum em reprodução; sem nada tocando, o álbum em primeiro plano.
- Transição de 600 ms nas cores da interface e na luz da cena; instantânea com `prefers-reduced-motion`.
- Efeitos num `GainNode` próprio, com liga/desliga e volume separados da música (painel Ajustes).

Testes: `shelf-theme.test.ts` (sinônimos, fallback com paleta) e `finish.spec.ts` (o CD de demonstração, gênero Electronic, troca para o tema Eletrônica).

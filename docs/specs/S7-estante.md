# S7. Estante

**Objetivo:** a coleção numa torre de CDs com lombadas para fora.
**RFs:** RF12, RF13, RF14.

- Torre vertical de 16 caixas por coluna; colunas extras quando a coleção passa disso (`shelfSlots`).
- Dois `InstancedMesh` (corpos e lombadas), até 292 instâncias. As lombadas leem um atlas 2048 × 2048 (células de 512 × 28 px) por um atributo `spineUv` por instância injetado no shader (`onBeforeCompile`).
- Lombada vem da arte `spine` (upload, embutida, CAA) ou da gerada na S6. O atlas redesenha só as células que mudaram.
- Ordenar por artista, gênero ou ano (`sortAlbums`, sem ano ou sem gênero no fim) anima as instâncias até a nova posição.
- Clique na lombada chama `pullAlbum`: a instância some, a estante recua para o fundo e a caixa completa voa até o primeiro plano. **Simplificação:** a caixa parte da posição da torre, não da lombada exata.
- Teclado e leitor de tela: lista "Estante" no painel, na mesma ordem da torre; foco ou hover destacam a lombada (ela sai alguns milímetros para fora); Enter puxa o CD.

Testes: `shelf-theme.test.ts` (ordenação, colunas, atlas) e `finish.spec.ts` (ordenar e puxar outro CD).

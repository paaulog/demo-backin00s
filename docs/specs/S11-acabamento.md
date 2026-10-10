# S11. Acabamento

**Objetivo:** requisitos não funcionais.

| Área | Implementação | Verificação |
|---|---|---|
| Desempenho | `PerformanceMonitor` do drei desce e sobe entre alto, médio e baixo; `dpr` até 2 (1 no baixo); bloom só no alto; a cena 3D é carregada sob demanda | Bundle inicial: 101 kB gzip (meta < 500 kB). A cena vem num chunk separado. **60 fps em GPU integrada ainda não medido** (depende da spike S0) |
| Fallback 2D | `hasWebGL()` antes de montar; `webglcontextlost` troca para `Fallback2D` (capa em CSS 3D, galeria do encarte, mesmos botões). `?no3d` força o fallback | `finish.spec.ts` roda o fluxo inteiro sem WebGL |
| Acessibilidade | `aria-live` para faixa e estado da caixa; botões HTML para cada ação 3D; Enter/Esc/setas na cena; contraste dos textos secundários e do botão principal revisado | axe sem violações sérias ou críticas (`finish.spec.ts`) |
| Visual | Screenshots da caixa fechada, aberta e do encarte, com movimento reduzido | `finish.spec.ts`, só Chromium. As baselines nascem no primeiro CI (`--update-snapshots=missing`) e precisam ser baixadas do artefato e commitadas para passarem a comparar |
| Privacidade | Áudio só como `blob:`; CSP em meta tag; nenhuma requisição com corpo | `flow.spec.ts` |

## Fora desta entrega

- **S9 (YouTube)** e **S10 (Jamendo)** não foram feitas. A S10 continua bloqueada pelos termos da API; a S9 é opcional e ficou para uma próxima rodada.

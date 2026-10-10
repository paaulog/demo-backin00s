# S2. Arquivos locais

**Objetivo:** transformar uma pasta ou arquivos soltos em álbuns, sem nenhum byte de áudio sair do navegador.
**RFs:** RF03 (fonte local), RF15, RF16.

## Contratos

- `LocalSource implements MusicSource` (`src/sources/local/LocalSource.ts`): `resolve(track)` devolve um `PlaybackHandle` com `blob:` URL; `dispose(albumId?)` esquece os `File` e revoga as URLs de arte. `pagehide` chama `dispose()`.
- `ImportItem { file: File; relativePath: string }`: formato único para `<input webkitdirectory>`, `<input multiple>` e drag-and-drop (`collect.ts`).
- `ParsedFile` e `AlbumGroup` (`grouping.ts`): saída do worker e do agrupamento, puros e testáveis.
- `albumIdFor()` (`src/core/albumId.ts`): `mb:<mbid>` ou `h:<sha256(artista|álbum|ano normalizados)>`.

## Regras

- Tags lidas num Web Worker (`metadata.worker.ts`) com `music-metadata` `parseBlob`, em lotes de 8 (configurável). Imagens embutidas voltam como `ArrayBuffer` transferido.
- Agrupamento: `albumartist` ou `artist` + `album`, normalizados (minúsculas, sem acento, sem pontuação). Sem tag de álbum, a pasta (`webkitRelativePath`). Ordem: disco, faixa, nome do arquivo com comparação numérica.
- Faixa 0: o `music-metadata` devolve `null` para `TRCK=0`, então `trackNumberOf` lê a tag nativa (achado da S0).
- Imagens soltas na pasta entram como arte de origem `upload` pelo nome (`cover`, `folder`, `capa`, `back`, `encarte`, `cd`, `lombada`...). Uma imagem única sem nome reconhecível vira capa.
- `canPlayType` na importação: faixa com formato não suportado fica marcada como indisponível e gera aviso.
- Metadados passam por `safeText` (sem caracteres de controle, máximo de 200 caracteres) e só são exibidos como texto. Uma regra do ESLint proíbe `innerHTML`.
- Limite de 2000 arquivos de áudio por importação.

## Álbum de demonstração

`public/demo` traz cinco MP3 sintetizados por `scripts/make_fixtures.py` (faixa oculta, capa e contracapa embutidas). O botão "Tocar o CD de demonstração" baixa esses arquivos do próprio site e passa pelo mesmo caminho da importação.

## Critérios de aceite

- Testes de unidade: variações de tag, estabilidade do hash, arquivo sem tags, faixa 0, tipos de imagem, lotes, formato não suportado, revogação.
- E2E: carregar a pasta de fixtures cria o álbum com as faixas na ordem (ver S5).

## Fora de escopo

`showDirectoryPicker()` (só Chrome e Edge); AcoustID.

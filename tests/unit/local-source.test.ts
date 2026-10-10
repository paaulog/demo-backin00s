import { describe, expect, it } from 'vitest';
import { albumIdFor } from '../../src/core/albumId';
import { safeText } from '../../src/core/text';
import { groupFiles, type ParsedFile } from '../../src/sources/local/grouping';
import { LocalSource } from '../../src/sources/local/LocalSource';
import { imageTypeFromName, mapPictureType, toParsedFile, trackNumberOf, type MetadataLike } from '../../src/sources/local/tags';

function pf(partial: Partial<ParsedFile> & { name: string }): ParsedFile {
  return { fileIndex: 0, relativePath: partial.name, pictures: [], ...partial };
}

function meta(partial: Partial<MetadataLike['common']> = {}, native?: MetadataLike['native']): MetadataLike {
  return { common: { track: { no: null }, disk: { no: null }, ...partial }, format: { duration: 10 }, native };
}

describe('agrupamento de arquivos em álbuns', () => {
  it('agrupa por albumartist + álbum, ignorando caixa e acento', () => {
    const groups = groupFiles([
      pf({ name: 'a.mp3', fileIndex: 0, album: 'Acústico MTV', albumArtist: 'Cássia Eller', trackNo: 2 }),
      pf({ name: 'b.mp3', fileIndex: 1, album: 'acustico mtv', albumArtist: 'CASSIA ELLER', trackNo: 1 }),
      pf({ name: 'c.mp3', fileIndex: 2, album: 'Outro', albumArtist: 'Cássia Eller', trackNo: 1 }),
    ]);
    expect(groups).toHaveLength(2);
    const acustico = groups.find((g) => g.title.toLowerCase().startsWith('ac'));
    expect(acustico?.files.map((f) => f.fileIndex)).toEqual([1, 0]);
  });

  it('usa artist quando não há albumartist', () => {
    const groups = groupFiles([
      pf({ name: '1.mp3', album: 'Da Lama ao Caos', artist: 'Chico Science', trackNo: 1 }),
      pf({ name: '2.mp3', album: 'Da Lama ao Caos', artist: 'Chico Science', trackNo: 2 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.artist).toBe('Chico Science');
  });

  it('sem tags agrupa pela pasta e usa o nome da pasta como título', () => {
    const groups = groupFiles([
      pf({ name: '02 b.mp3', relativePath: 'Minha Coleção/Disco X/02 b.mp3', fileIndex: 1 }),
      pf({ name: '01 a.mp3', relativePath: 'Minha Coleção/Disco X/01 a.mp3', fileIndex: 0 }),
      pf({ name: 'z.mp3', relativePath: 'Minha Coleção/Disco Y/z.mp3', fileIndex: 2 }),
    ]);
    expect(groups).toHaveLength(2);
    const x = groups.find((g) => g.title === 'Disco X');
    expect(x?.files.map((f) => f.name)).toEqual(['01 a.mp3', '02 b.mp3']);
    expect(x?.artist).toBe('Artista desconhecido');
  });

  it('ordena por disco, faixa e nome, com a faixa oculta (0) primeiro', () => {
    const groups = groupFiles([
      pf({ name: 'd2t1.mp3', album: 'A', artist: 'X', diskNo: 2, trackNo: 1 }),
      pf({ name: 'd1t2.mp3', album: 'A', artist: 'X', diskNo: 1, trackNo: 2 }),
      pf({ name: 'pregap.mp3', album: 'A', artist: 'X', diskNo: 1, trackNo: 0 }),
      pf({ name: 'b-sem-numero.mp3', album: 'A', artist: 'X' }),
      pf({ name: 'a-sem-numero.mp3', album: 'A', artist: 'X' }),
    ]);
    expect(groups[0]?.files.map((f) => f.name)).toEqual(['pregap.mp3', 'd1t2.mp3', 'a-sem-numero.mp3', 'b-sem-numero.mp3', 'd2t1.mp3']);
  });

  it('descarta arquivos com erro de leitura', () => {
    expect(groupFiles([pf({ name: 'x.mp3', error: 'corrompido' })])).toHaveLength(0);
  });
});

describe('Album.id', () => {
  it('é estável com variações de caixa, acento, pontuação e espaços', async () => {
    const a = await albumIdFor({ artist: 'Os Mutantes', title: 'A Divina Comédia ou Ando Meio Desligado', year: 1970 });
    const b = await albumIdFor({ artist: '  os  mutantes ', title: 'a divina comedia, ou ando meio desligado!', year: 1970 });
    expect(a).toBe(b);
    expect(a).toMatch(/^h:[0-9a-f]{64}$/);
  });

  it('muda com o ano', async () => {
    const a = await albumIdFor({ artist: 'X', title: 'Y', year: 2000 });
    const b = await albumIdFor({ artist: 'X', title: 'Y', year: 2001 });
    expect(a).not.toBe(b);
  });

  it('usa o MBID quando existe', async () => {
    const id = await albumIdFor({ mbid: 'B1A9C0E9-D987-4042-AE91-78D6A3267D69', artist: 'X', title: 'Y' });
    expect(id).toBe('mb:b1a9c0e9-d987-4042-ae91-78d6a3267d69');
  });
});

describe('leitura de tags', () => {
  it('reconhece faixa 0 pela tag nativa (music-metadata devolve null)', () => {
    expect(trackNumberOf(meta({}, { 'ID3v2.3': [{ id: 'TRCK', value: '0/4' }] }))).toBe(0);
    expect(trackNumberOf(meta({}, { vorbis: [{ id: 'TRACKNUMBER', value: '0' }] }))).toBe(0);
    expect(trackNumberOf(meta({ track: { no: 3 } }))).toBe(3);
    expect(trackNumberOf(meta())).toBeUndefined();
  });

  it('mapeia tipos de imagem e nomes de arquivo', () => {
    expect(mapPictureType('Cover (front)')).toBe('front');
    expect(mapPictureType('Cover (back)')).toBe('back');
    expect(mapPictureType('Leaflet page')).toBe('booklet');
    expect(mapPictureType('Media (e.g. label side of CD)')).toBe('medium');
    expect(mapPictureType('Other')).toBeNull();
    expect(imageTypeFromName('folder.jpg')).toBe('front');
    expect(imageTypeFromName('Capa.png')).toBe('front');
    expect(imageTypeFromName('back.jpg')).toBe('back');
    expect(imageTypeFromName('encarte-02.jpg')).toBe('booklet');
    expect(imageTypeFromName('cd.jpg')).toBe('medium');
    expect(imageTypeFromName('foto-da-banda.jpg')).toBeNull();
  });

  it('trata metadados como dados não confiáveis', () => {
    const parsed = toParsedFile(meta({ title: `<img src=x onerror=alert(1)>\u0000${'a'.repeat(500)}` }), {
      fileIndex: 0,
      name: 'x.mp3',
      relativePath: 'x.mp3',
    });
    expect(parsed.title?.length).toBeLessThanOrEqual(200);
    expect(parsed.title).not.toContain('\u0000');
    expect(safeText(['a', 'b'])).toBe('a, b');
  });

  it('primeira imagem sem tipo vira capa', () => {
    const parsed = toParsedFile(meta({ picture: [{ type: 'Other', format: 'image/png', data: new Uint8Array([1, 2]) }] }), {
      fileIndex: 0,
      name: 'x.mp3',
      relativePath: 'x.mp3',
    });
    expect(parsed.pictures[0]?.type).toBe('front');
  });
});

describe('LocalSource', () => {
  it('importa, marca formato não suportado e resolve blob: URLs', async () => {
    const source = new LocalSource(async (items) =>
      items.map((i) =>
        pf({ name: i.file.name, fileIndex: i.fileIndex, relativePath: i.relativePath, album: 'Álbum', artist: 'Banda', trackNo: i.fileIndex + 1 }),
      ),
    );
    const warnings: string[] = [];
    const albums = await source.importItems(
      [
        { file: new File(['x'], '01.mp3', { type: 'audio/mpeg' }), relativePath: 'A/01.mp3' },
        { file: new File(['y'], '02.wma'), relativePath: 'A/02.wma' },
        { file: new File(['img'], 'cover.jpg', { type: 'image/jpeg' }), relativePath: 'A/cover.jpg' },
        { file: new File(['txt'], 'notas.txt'), relativePath: 'A/notas.txt' },
      ],
      { canPlay: (mime) => mime === 'audio/mpeg', onWarning: (m) => warnings.push(m) },
    );
    expect(albums).toHaveLength(1);
    const album = albums[0]!;
    expect(album.tracks.map((t) => t.unavailable ?? false)).toEqual([false, true]);
    expect(warnings.some((w) => w.includes('02.wma'))).toBe(true);
    expect(album.artwork).toEqual([expect.objectContaining({ type: 'front', origin: 'upload' })]);
    const handle = await source.resolve(album.tracks[0]!);
    expect(handle.url.startsWith('blob:')).toBe(true);
    handle.release();
    source.dispose(album.id);
    await expect(source.resolve(album.tracks[0]!)).rejects.toThrow();
  });

  it('processa em lotes do tamanho configurado', async () => {
    const sizes: number[] = [];
    const source = new LocalSource(async (items) => {
      sizes.push(items.length);
      return items.map((i) => pf({ name: i.file.name, fileIndex: i.fileIndex, album: 'A', artist: 'B' }));
    });
    const files = Array.from({ length: 7 }, (_, i) => ({ file: new File(['x'], `${i}.mp3`), relativePath: `${i}.mp3` }));
    await source.importItems(files, { batchSize: 3, canPlay: () => true });
    expect(sizes).toEqual([3, 3, 1]);
  });
});

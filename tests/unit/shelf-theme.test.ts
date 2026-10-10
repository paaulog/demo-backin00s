import { describe, expect, it } from 'vitest';
import type { Album } from '../../src/core/types';
import { atlasCell, ATLAS_CAPACITY, ROWS_PER_COLUMN, shelfSlots, sortAlbums } from '../../src/shelf/layout';
import { resolveTheme, themeIdForGenre } from '../../src/theme/genre';
import { THEMES } from '../../src/theme/themes';

const album = (id: string, artist: string, year?: number, genre?: string): Album => ({ id, title: id, artist, year, genre, tracks: [], artwork: [], source: 'local' });
const list = [album('a', 'Zé Ramalho', 1978, 'MPB'), album('b', 'Ácido', 2001, 'Rock'), album('c', 'Banda', undefined, undefined), album('d', 'Banda', 1999, 'Electronic')];

describe('estante (S7)', () => {
  it('ordena por artista ignorando acento', () => {
    expect(sortAlbums(list, 'artist').map((a) => a.id)).toEqual(['b', 'd', 'c', 'a']);
  });
  it('ordena por ano com os sem ano no fim', () => {
    expect(sortAlbums(list, 'year').map((a) => a.id)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('ordena por gênero com os sem gênero no fim', () => {
    expect(sortAlbums(list, 'genre').map((a) => a.id)).toEqual(['d', 'a', 'b', 'c']);
  });
  it('abre coluna nova quando passa da altura da torre', () => {
    const many = Array.from({ length: ROWS_PER_COLUMN + 1 }, (_, i) => album(String(i), 'x'));
    const slots = shelfSlots(many);
    expect(slots[0]?.column).toBe(0);
    expect(slots[ROWS_PER_COLUMN]?.column).toBe(1);
    expect(slots[0]?.y).toBeGreaterThan(slots[1]?.y ?? 0);
    expect(slots[0]?.x).toBeLessThan(slots[ROWS_PER_COLUMN]?.x ?? 0);
  });
  it('células do atlas não se sobrepõem e cabem em 2048 px', () => {
    expect(ATLAS_CAPACITY).toBe(4 * 73);
    const last = atlasCell(ATLAS_CAPACITY - 1);
    expect(last.x + 512).toBeLessThanOrEqual(2048);
    expect(last.y + 28).toBeLessThanOrEqual(2048);
    expect(atlasCell(1).x).toBe(512);
    expect(atlasCell(4).y).toBe(28);
  });
});

describe('temas por gênero (S8)', () => {
  it('normaliza sinônimos', () => {
    expect(themeIdForGenre('Hard Rock')).toBe('rock');
    expect(themeIdForGenre('Eletrônica')).toBe('electronic');
    expect(themeIdForGenre('Bossa Nova')).toBe('mpb');
    expect(themeIdForGenre('Hip-Hop')).toBe('hiphop');
    expect(themeIdForGenre('R&B')).toBe('jazz');
    expect(themeIdForGenre('Indie/Folk')).toBe('rock');
    expect(themeIdForGenre('Brazilian Rock')).toBe('rock');
    expect(themeIdForGenre('Polka')).toBeNull();
    expect(themeIdForGenre(undefined)).toBeNull();
  });
  it('sem correspondência usa o neutro tingido com a paleta', () => {
    const t = resolveTheme('Polka', { dominant: '#000000', vibrant: '#ff0000', muted: '#888888', dark: '#111111', light: '#eeeeee' });
    expect(t.id).toBe('neutral');
    expect(t.accent).toBe('#ff0000');
    expect(resolveTheme(null, null)).toBe(THEMES.neutral);
    expect(resolveTheme('Rock', null)).toBe(THEMES.rock);
  });
});

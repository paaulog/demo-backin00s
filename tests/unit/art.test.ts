import { describe, expect, it } from 'vitest';
import { missingTypes } from '../../src/art/generate';
import { DEFAULT_PALETTE, paletteFromPixels, paletteFromSeed } from '../../src/art/palette';
import { artworkOf, bookletPages, galleryOf, pickArtwork } from '../../src/art/pick';
import type { Album, Artwork } from '../../src/core/types';

const art = (type: Artwork['type'], origin: Artwork['origin'], index = 0): Artwork => ({ type, origin, index, url: `${origin}:${type}:${index}` });
const album = (artwork: Artwork[]): Album => ({ id: 'a', title: 'T', artist: 'A', tracks: [], artwork, source: 'local' });

describe('prioridade de arte', () => {
  it('upload > embutida > CAA > gerada, por tipo', () => {
    const a = album([art('front', 'generated'), art('front', 'caa'), art('front', 'embedded'), art('back', 'generated'), art('back', 'caa')]);
    expect(pickArtwork(a, 'front')?.origin).toBe('embedded');
    expect(pickArtwork(a, 'back')?.origin).toBe('caa');
    const withUpload = album([...a.artwork, art('front', 'upload')]);
    expect(pickArtwork(withUpload, 'front')?.origin).toBe('upload');
  });

  it('encarte usa todas as páginas da melhor origem, em ordem', () => {
    const a = album([art('front', 'caa'), art('booklet', 'caa', 1), art('booklet', 'caa', 0), art('booklet', 'generated')]);
    expect(artworkOf(a, 'booklet').map((x) => x.index)).toEqual([0, 1]);
    expect(bookletPages(a).map((x) => x.type)).toEqual(['front', 'booklet', 'booklet']);
  });

  it('galeria inclui contracapa e disco', () => {
    const a = album([art('front', 'caa'), art('back', 'generated'), art('medium', 'generated')]);
    expect(galleryOf(a).map((x) => x.type)).toEqual(['front', 'back', 'medium']);
  });

  it('gera só o que falta', () => {
    expect(missingTypes(album([art('front', 'embedded'), art('back', 'caa')]))).toEqual(['spine', 'medium', 'booklet']);
    expect(missingTypes(album([art('front', 'generated')]))).toEqual(['back', 'spine', 'medium', 'booklet']);
  });
});

describe('paleta', () => {
  it('extrai cor dominante e vibrante', () => {
    const px = new Uint8ClampedArray(4 * 100);
    for (let i = 0; i < 100; i++) {
      const red = i < 30;
      px.set(red ? [230, 30, 40, 255] : [40, 40, 50, 255], i * 4);
    }
    const p = paletteFromPixels(px);
    expect(p.dominant).toMatch(/^#2/);
    expect(p.vibrant).toBe('#e61e28');
  });

  it('imagem vazia usa a padrão; seed é determinístico', () => {
    expect(paletteFromPixels(new Uint8ClampedArray(0))).toEqual(DEFAULT_PALETTE);
    expect(paletteFromSeed('x')).toEqual(paletteFromSeed('x'));
  });
});

import { describe, expect, it } from 'vitest';
import { CASE, COVER_CENTER, coverCrop, INLAY, INLAY_BACK_WIDTH, inlayRegions } from '../../src/box/dimensions';

describe('layout de UV da arte (S4)', () => {
  it('inlay 151 mm com lombadas de 6,5 mm', () => {
    const r = inlayRegions();
    expect(r.leftSpine.u1 * INLAY.width).toBeCloseTo(6.5);
    expect((r.back.u1 - r.back.u0) * INLAY.width).toBeCloseTo(138);
    expect((1 - r.rightSpine.u0) * INLAY.width).toBeCloseTo(6.5);
    expect(INLAY_BACK_WIDTH).toBe(138);
  });

  it('a capa de 120 mm cabe na tampa à direita da dobradiça', () => {
    expect(COVER_CENTER.x - 60).toBeGreaterThanOrEqual(-CASE.width / 2);
    expect(COVER_CENTER.x + 60).toBeLessThanOrEqual(CASE.width / 2);
  });

  it('recorta sem esticar', () => {
    expect(coverCrop(1, 1)).toEqual({ u0: 0, u1: 1, v0: 0, v1: 1 });
    const wide = coverCrop(2, 1);
    expect(wide.u1 - wide.u0).toBeCloseTo(0.5);
    const tall = coverCrop(0.5, 1);
    expect(tall.v1 - tall.v0).toBeCloseTo(0.5);
    const inlay = coverCrop(1510 / 1180, 151 / 118);
    expect(inlay.u1 - inlay.u0).toBeCloseTo(1);
  });
});

/**
 * Medidas do jewel case padrão em milímetros (1 unidade da cena = 1 mm).
 * Fonte: PRD, seção Modelo 3D da caixa de CD.
 */
export const CASE = { width: 142, height: 125, depth: 10 } as const;
export const DISC = { radius: 60, hole: 7.5, thickness: 1.2, labelInner: 17 } as const;
export const BOOKLET = { size: 120 } as const;
export const INLAY = { width: 151, height: 118, spine: 6.5 } as const;

/** Faixa da dobradiça à esquerda da tampa; a capa fica à direita dela. */
export const HINGE_STRIP = 16;

/** Centro da capa (encarte) na face da tampa, em mm, relativo ao centro da caixa. */
export const COVER_CENTER = {
  x: -CASE.width / 2 + HINGE_STRIP + BOOKLET.size / 2,
  y: 0,
} as const;

export interface UvRange {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Regiões do inlay (151 × 118 mm, dobrado em U) em coordenadas UV da imagem `back`.
 * A arte é recortada por estas medidas, sem esticar.
 */
export function inlayRegions(): { leftSpine: UvRange; back: UvRange; rightSpine: UvRange } {
  const s = INLAY.spine / INLAY.width;
  return {
    leftSpine: { u0: 0, u1: s, v0: 0, v1: 1 },
    back: { u0: s, u1: 1 - s, v0: 0, v1: 1 },
    rightSpine: { u0: 1 - s, u1: 1, v0: 0, v1: 1 },
  };
}

/** Largura do painel traseiro visível do inlay, em mm. */
export const INLAY_BACK_WIDTH = INLAY.width - 2 * INLAY.spine;

/**
 * Recorte "cover" de uma imagem de proporção qualquer para uma área de proporção `targetAspect`
 * (largura/altura): centraliza e corta o excesso em vez de esticar.
 */
export function coverCrop(imageAspect: number, targetAspect: number): UvRange {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0) return { u0: 0, u1: 1, v0: 0, v1: 1 };
  if (imageAspect > targetAspect) {
    const w = targetAspect / imageAspect;
    return { u0: (1 - w) / 2, u1: (1 + w) / 2, v0: 0, v1: 1 };
  }
  const h = imageAspect / targetAspect;
  return { u0: 0, u1: 1, v0: (1 - h) / 2, v1: (1 + h) / 2 };
}

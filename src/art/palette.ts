import type { Palette } from '../core/types';

type RGB = [number, number, number];

const hex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function hsv([r, g, b]: RGB): { s: number; v: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return { s: max === 0 ? 0 : (max - min) / max, v: max };
}

/**
 * Paleta simples por histograma (4 bits por canal). O techspec citava node-vibrant; troquei
 * por isto para não somar dependência por cinco cores. Mesma interface `Palette`.
 */
export function paletteFromPixels(data: Uint8ClampedArray): Palette {
  const bins = new Map<number, { n: number; sum: RGB }>();
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 128) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { n: 0, sum: [0, 0, 0] };
    bin.n++;
    bin.sum[0] += r;
    bin.sum[1] += g;
    bin.sum[2] += b;
    bins.set(key, bin);
  }
  const colors = [...bins.values()]
    .map((b) => ({ n: b.n, c: [b.sum[0] / b.n, b.sum[1] / b.n, b.sum[2] / b.n] as RGB }))
    .sort((a, b) => b.n - a.n);
  if (!colors.length) return DEFAULT_PALETTE;
  const top = colors.slice(0, 24);
  const score = (f: (c: RGB) => number) => top.reduce((best, x) => (f(x.c) * Math.sqrt(x.n) > f(best.c) * Math.sqrt(best.n) ? x : best)).c;
  const dominant = top[0]?.c ?? [128, 128, 128];
  const vibrant = score((c) => {
    const { s, v } = hsv(c);
    return s * (v > 0.35 ? 1 : 0.2);
  });
  const muted = score((c) => {
    const { s, v } = hsv(c);
    return (1 - Math.abs(s - 0.3)) * (v > 0.3 && v < 0.85 ? 1 : 0.3);
  });
  const dark = score((c) => 1 - hsv(c).v);
  const light = score((c) => hsv(c).v * (1 - hsv(c).s * 0.5));
  return { dominant: hex(dominant), vibrant: hex(vibrant), muted: hex(muted), dark: hex(dark), light: hex(light) };
}

export const DEFAULT_PALETTE: Palette = {
  dominant: '#3a3f58',
  vibrant: '#e0605a',
  muted: '#8a8fa8',
  dark: '#1c1e2b',
  light: '#f1ede6',
};

export function paletteFromImage(img: HTMLImageElement): Palette {
  try {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_PALETTE;
    ctx.drawImage(img, 0, 0, size, size);
    return paletteFromPixels(ctx.getImageData(0, 0, size, size).data);
  } catch {
    // Canvas "tainted" (imagem sem CORS): segue com a paleta padrão.
    return DEFAULT_PALETTE;
  }
}

/** Paleta determinística a partir de um texto, para álbuns sem capa. */
export function paletteFromSeed(seed: string): Palette {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const hsl = (s: number, l: number, dh = 0) => hslToHex((hue + dh) % 360, s, l);
  return { dominant: hsl(0.45, 0.32), vibrant: hsl(0.7, 0.55, 30), muted: hsl(0.25, 0.55), dark: hsl(0.4, 0.14), light: hsl(0.3, 0.92) };
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return hex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

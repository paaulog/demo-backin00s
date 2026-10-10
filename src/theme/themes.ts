import type { Palette, Theme, ThemeId } from '../core/types';

const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * Lista inicial de temas (questão em aberto do PRD, proposta minha).
 * Exemplos do PRD: rock com madeira escura e luz quente; eletrônica com metal e luz fria;
 * MPB e samba com tons terrosos.
 */
export const THEMES: Record<ThemeId, Theme> = {
  neutral: {
    id: 'neutral',
    label: 'Neutro',
    background: '#eceae6',
    surface: '#ffffff',
    text: '#1d1d1f',
    accent: '#3a6df0',
    lightColor: '#ffffff',
    lightIntensity: 1,
    shelf: { color: '#d8d4cc', roughness: 0.6, metalness: 0 },
    fontFamily: SANS,
  },
  rock: {
    id: 'rock',
    label: 'Rock',
    background: '#2a1f1a',
    surface: '#3a2b23',
    text: '#f3e9df',
    accent: '#e0703a',
    lightColor: '#ffcf9e',
    lightIntensity: 1.1,
    shelf: { color: '#4a2e1f', roughness: 0.75, metalness: 0 },
    fontFamily: SANS,
  },
  electronic: {
    id: 'electronic',
    label: 'Eletrônica',
    background: '#10141c',
    surface: '#1a2130',
    text: '#e5f0ff',
    accent: '#38d6ff',
    lightColor: '#b8dcff',
    lightIntensity: 1.2,
    shelf: { color: '#8a929e', roughness: 0.25, metalness: 0.9 },
    fontFamily: SANS,
  },
  mpb: {
    id: 'mpb',
    label: 'MPB e samba',
    background: '#e9dcc8',
    surface: '#f5ecdf',
    text: '#3b2a1c',
    accent: '#b5562b',
    lightColor: '#ffe2b8',
    lightIntensity: 1,
    shelf: { color: '#a8714a', roughness: 0.7, metalness: 0 },
    fontFamily: SANS,
  },
  jazz: {
    id: 'jazz',
    label: 'Jazz e blues',
    background: '#1c2230',
    surface: '#262e40',
    text: '#efe6d2',
    accent: '#d9a441',
    lightColor: '#ffd9a0',
    lightIntensity: 0.95,
    shelf: { color: '#3b2a22', roughness: 0.5, metalness: 0.1 },
    fontFamily: SANS,
  },
  hiphop: {
    id: 'hiphop',
    label: 'Hip-hop e rap',
    background: '#1b1b1b',
    surface: '#2a2a2a',
    text: '#f5f5f5',
    accent: '#f2c230',
    lightColor: '#fff2cc',
    lightIntensity: 1.05,
    shelf: { color: '#2d2d2d', roughness: 0.4, metalness: 0.4 },
    fontFamily: SANS,
  },
  pop: {
    id: 'pop',
    label: 'Pop',
    background: '#f6e8ef',
    surface: '#fff6fa',
    text: '#2b1b24',
    accent: '#e0447a',
    lightColor: '#fff0f6',
    lightIntensity: 1.05,
    shelf: { color: '#f0f0f0', roughness: 0.3, metalness: 0 },
    fontFamily: SANS,
  },
  classical: {
    id: 'classical',
    label: 'Erudita',
    background: '#f1ede4',
    surface: '#faf8f3',
    text: '#2a2620',
    accent: '#7a5c2e',
    lightColor: '#fff8ea',
    lightIntensity: 0.95,
    shelf: { color: '#6b4b32', roughness: 0.55, metalness: 0 },
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
};

/**
 * Tema neutro tingido com a paleta da capa, para quando o gênero não mapeia.
 */
export function neutralFromPalette(palette: Palette | null): Theme {
  if (!palette) return THEMES.neutral;
  return {
    ...THEMES.neutral,
    background: mix(palette.light, '#f2f2f2', 0.55),
    surface: '#ffffff',
    accent: palette.vibrant,
    lightColor: mix(palette.light, '#ffffff', 0.6),
    shelf: { ...THEMES.neutral.shelf, color: mix(palette.muted, '#d8d4cc', 0.5) },
  };
}

/** Mistura duas cores hex; `t` é o peso da segunda. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v * (1 - t) + (pb[i] ?? 0) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}

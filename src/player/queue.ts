import type { Track } from '../core/types';

export type Rng = () => number;

/** Faixas visíveis na ordem do álbum (sem a faixa oculta). */
export function visibleTracks(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.number !== 0);
}

/** A faixa oculta só existe antes da primeira faixa do primeiro disco. */
export function hiddenTrack(tracks: Track[]): Track | null {
  return tracks.find((t) => t.number === 0 && t.disc === 1) ?? null;
}

/** Fisher-Yates sobre uma cópia dos índices, com `keepFirst` (a faixa atual) na posição 0. */
export function shuffledOrder(length: number, keepFirst: number | null, rng: Rng = Math.random): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j] as number, rest[i] as number];
  }
  return keepFirst === null || keepFirst < 0 || keepFirst >= length ? rest : [keepFirst, ...rest];
}

export function albumOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

/** Limite do "voltar": com mais de 3 s decorridos, reinicia a faixa, como no aparelho de CD. */
export const RESTART_THRESHOLD_S = 3;

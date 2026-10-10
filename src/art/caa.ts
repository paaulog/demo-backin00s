import type { Artwork, ArtworkType } from '../core/types';

/** Imagem como a função /api/mb/release devolve (já normalizada a partir do CAA). */
export interface RemoteImage {
  types: string[];
  front: boolean;
  back: boolean;
  image?: string;
  large?: string;
  small?: string;
}

const CAA_TYPES: [string, ArtworkType][] = [
  ['front', 'front'],
  ['back', 'back'],
  ['booklet', 'booklet'],
  ['medium', 'medium'],
  ['tray', 'tray'],
  ['spine', 'spine'],
];

/** Mapeia os tipos do CAA (Front, Back, Booklet, Medium, Tray, Spine) para `ArtworkType`. */
export function caaTypeOf(img: RemoteImage): ArtworkType | null {
  if (img.front) return 'front';
  if (img.back) return 'back';
  const types = img.types.map((t) => t.toLowerCase());
  for (const [caa, mine] of CAA_TYPES) if (types.includes(caa)) return mine;
  return null;
}

export function caaToArtwork(images: RemoteImage[]): Artwork[] {
  const counters = new Map<ArtworkType, number>();
  const out: Artwork[] = [];
  for (const img of images) {
    const type = caaTypeOf(img);
    const url = img.large ?? img.image;
    if (!type || !url || !/^https:\/\//.test(url)) continue;
    const index = counters.get(type) ?? 0;
    counters.set(type, index + 1);
    out.push({ type, url, origin: 'caa', index });
  }
  return out;
}

export interface Candidate {
  id: string;
  releaseGroupId?: string;
  score: number;
  title: string;
  artist: string;
  trackCount: number;
  year?: number;
  label?: string;
}

/** Score ≥ 90 e mesma contagem de faixas (visíveis, ou com a oculta). Senão, sem MBID. */
export function chooseCandidate(candidates: Candidate[], visibleCount: number, totalCount = visibleCount): Candidate | null {
  const ok = candidates.filter((c) => c.score >= 90 && (c.trackCount === visibleCount || c.trackCount === totalCount));
  ok.sort((a, b) => b.score - a.score);
  return ok[0] ?? null;
}

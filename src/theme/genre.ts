import type { Palette, Theme, ThemeId } from '../core/types';
import { normalizeKey } from '../core/text';
import { neutralFromPalette, THEMES } from './themes';

/**
 * Tabela de sinônimos de gênero (questão em aberto do PRD; proposta minha, a validar).
 * Chaves normalizadas: minúsculas, sem acento, sem pontuação.
 */
const SYNONYMS: [ThemeId, string[]][] = [
  ['rock', ['rock', 'hard rock', 'classic rock', 'punk', 'punk rock', 'grunge', 'metal', 'heavy metal', 'alternative', 'alternative rock', 'indie rock', 'indie', 'emo', 'post rock', 'rock nacional', 'brock']],
  ['electronic', ['electronic', 'electronica', 'eletronica', 'eletronico', 'techno', 'house', 'trance', 'edm', 'drum and bass', 'dnb', 'ambient', 'idm', 'synthpop', 'synth pop', 'electro', 'dubstep', 'downtempo', 'trip hop']],
  ['mpb', ['mpb', 'samba', 'bossa nova', 'bossa', 'pagode', 'forro', 'axe', 'tropicalia', 'choro', 'baiao', 'frevo', 'manguebeat', 'mangue beat', 'brazilian', 'musica popular brasileira', 'sertanejo', 'latin', 'latina']],
  ['jazz', ['jazz', 'blues', 'soul', 'funk', 'rnb', 'r and b', 'r b', 'gospel', 'swing', 'bebop', 'fusion', 'smooth jazz']],
  ['hiphop', ['hip hop', 'hiphop', 'rap', 'trap', 'grime', 'funk carioca', 'baile funk', 'rap nacional']],
  ['pop', ['pop', 'dance', 'dance pop', 'k pop', 'kpop', 'j pop', 'teen pop', 'europop', 'disco']],
  ['classical', ['classical', 'classica', 'classico', 'erudita', 'erudito', 'orchestral', 'opera', 'baroque', 'barroco', 'chamber', 'soundtrack', 'trilha sonora']],
];

const LOOKUP = new Map<string, ThemeId>();
for (const [id, words] of SYNONYMS) for (const w of words) LOOKUP.set(normalizeKey(w), id);

/** Resolve o tema do gênero; sem correspondência, `null`. Aceita "Rock; Pop" e "Indie/Rock". */
export function themeIdForGenre(genre: string | undefined | null): ThemeId | null {
  if (!genre) return null;
  const whole = LOOKUP.get(normalizeKey(genre));
  if (whole) return whole;
  for (const part of genre.split(/[;,/|]+/)) {
    const id = LOOKUP.get(normalizeKey(part));
    if (id) return id;
  }
  // Última tentativa: palavra-chave contida ("Brazilian Rock" → rock).
  const key = normalizeKey(genre);
  for (const [word, id] of LOOKUP) if (word.length > 3 && ` ${key} `.includes(` ${word} `)) return id;
  return null;
}

/** Tema final: o do gênero, ou o neutro tingido com a paleta da capa. */
export function resolveTheme(genre: string | undefined | null, palette: Palette | null): Theme {
  const id = themeIdForGenre(genre);
  return id ? THEMES[id] : neutralFromPalette(palette);
}

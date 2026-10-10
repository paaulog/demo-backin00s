/** Limite de tamanho para qualquer texto vindo de metadados (dado não confiável). */
export const MAX_TEXT = 200;

/**
 * Limpa texto de metadados: remove caracteres de controle, normaliza espaços e corta no limite.
 * O resultado só deve ir para a UI como texto (textContent, nunca innerHTML).
 */
export function safeText(value: unknown, max = MAX_TEXT): string {
  if (value === null || value === undefined) return '';
  const raw = Array.isArray(value) ? value.join(', ') : String(value);
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** Chave de comparação: minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalizeKey(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const sign = seconds < 0 ? '-' : '';
  // No pregap o visor conta até 0:00, então o valor negativo arredonda para cima em módulo.
  const total = seconds < 0 ? Math.ceil(Math.abs(seconds)) : Math.floor(seconds);
  return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

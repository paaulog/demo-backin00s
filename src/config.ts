/** Configuração vinda do build (variáveis VITE_*). */
export const config = {
  /** Origem das funções serverless na Vercel, sem barra final. Vazio = sem identificação remota. */
  apiBase: (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, ''),
  donateUrl: import.meta.env.VITE_DONATE_URL ?? 'https://github.com/sponsors/paaulog',
  baseUrl: import.meta.env.BASE_URL,
} as const;

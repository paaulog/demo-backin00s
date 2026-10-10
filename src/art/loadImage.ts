import { config } from '../config';

/**
 * Carrega uma imagem com CORS liberado para canvas e WebGL. Se a imagem remota falhar
 * (CAA sem CORS, decisão da S0), tenta pelo proxy /api/img e lembra a escolha.
 */
let useProxy = false;

export function proxied(url: string): string {
  if (!config.apiBase || !/^https:\/\/([a-z0-9-]+\.)*(coverartarchive|archive)\.org\//i.test(url)) return url;
  return `${config.apiBase}/api/img?url=${encodeURIComponent(url)}`;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${src.slice(0, 80)}`));
    img.src = src;
  });
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const remote = /^https:/.test(url);
  if (remote && useProxy) return load(proxied(url));
  try {
    return await load(url);
  } catch (error) {
    if (!remote || proxied(url) === url) throw error;
    const img = await load(proxied(url));
    useProxy = true;
    return img;
  }
}

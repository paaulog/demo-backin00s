import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { loadImage } from '../art/loadImage';

const cache = new Map<string, Promise<THREE.Texture>>();

/** Textura de uma arte (blob: ou https:), com CORS, cache por URL e espaço de cor sRGB. */
export function loadArtTexture(url: string): Promise<THREE.Texture> {
  let p = cache.get(url);
  if (!p) {
    p = loadImage(url).then((img) => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      return tex;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export function useArtTexture(url: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    if (!url) {
      setTex(null);
      return;
    }
    loadArtTexture(url)
      .then((t) => alive && setTex(t))
      .catch(() => alive && setTex(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return tex;
}

/** Normal map de plástico amassado, gerado em canvas (sem arquivo externo). */
let crinkle: THREE.CanvasTexture | null = null;
export function crinkleNormal(): THREE.Texture {
  if (crinkle) return crinkle;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    // Altura: soma de "vincos" lineares aleatórios determinísticos.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI;
      const off = rnd() * size;
      const amp = 0.4 + rnd();
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const d = x * ca + y * sa - off;
          h[y * size + x] = (h[y * size + x] ?? 0) + amp * Math.exp(-(d * d) / 18);
        }
    }
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const dx = (h[y * size + ((x + 1) % size)] ?? 0) - (h[i] ?? 0);
        const dy = (h[((y + 1) % size) * size + x] ?? 0) - (h[i] ?? 0);
        const n = new THREE.Vector3(-dx, -dy, 1).normalize();
        img.data[i * 4] = (n.x * 0.5 + 0.5) * 255;
        img.data[i * 4 + 1] = (n.y * 0.5 + 0.5) * 255;
        img.data[i * 4 + 2] = (n.z * 0.5 + 0.5) * 255;
        img.data[i * 4 + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }
  crinkle = new THREE.CanvasTexture(c);
  crinkle.wrapS = crinkle.wrapT = THREE.RepeatWrapping;
  crinkle.repeat.set(2, 2);
  return crinkle;
}

/** Textura de texto simples (adesivo do topo). */
export function textTexture(text: string, w = 512, h = 96, bg = '#d9262f', fg = '#ffffff'): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = `600 ${Math.round(h * 0.38)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let t = text;
    while (t.length > 3 && ctx.measureText(t).width > w - 24) t = `${t.slice(0, -2)}…`;
    ctx.fillText(t, w / 2, h / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

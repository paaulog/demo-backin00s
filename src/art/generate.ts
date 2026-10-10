import type { Album, Artwork, ArtworkType, Palette } from '../core/types';
import { formatTime, safeText } from '../core/text';
import { mix } from '../theme/themes';

/** 10 px por mm: as medidas reais do jewel case viram a resolução da arte gerada. */
export const PX_PER_MM = 10;
export const SIZES = {
  front: { w: 1200, h: 1200 },
  booklet: { w: 1200, h: 1200 },
  // Inlay completo: 151 × 118 mm, com as duas lombadas de 6,5 mm nas pontas.
  back: { w: 1510, h: 1180 },
  spine: { w: 1180, h: 65 },
  medium: { w: 1200, h: 1200 },
} as const;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function makeCanvas(w: number, h: number): { canvas: AnyCanvas; ctx: Ctx } {
  const canvas: AnyCanvas =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('Canvas 2D indisponível');
  return { canvas, ctx };
}

async function toUrl(canvas: AnyCanvas): Promise<string> {
  const blob =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: 'image/png' })
      : await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falhou'))), 'image/png'));
  return URL.createObjectURL(blob);
}

/** Corta texto para caber na largura, com reticências. */
function fit(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function textColorOn(bg: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const lum = (0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0)) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#f6f4ef';
}

function visibleTracks(album: Album) {
  return album.tracks.filter((t) => t.number !== 0);
}

function drawFront(ctx: Ctx, album: Album, p: Palette): void {
  const { w, h } = SIZES.front;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.dark);
  g.addColorStop(1, p.vibrant);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = mix(p.light, p.vibrant, 0.3);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.64, 90 + i * 55, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 92px ${SANS}`;
  ctx.fillText(fit(ctx, album.title, w - 160), 80, 170);
  ctx.font = `500 52px ${SANS}`;
  ctx.fillStyle = p.light;
  ctx.fillText(fit(ctx, album.artist, w - 160), 84, 245);
}

function drawBack(ctx: Ctx, album: Album, p: Palette, spineLabel: string): void {
  const { w, h } = SIZES.back;
  const spine = 65;
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = mix(p.dark, p.vibrant, 0.18);
  ctx.fillRect(spine, 0, w - spine * 2, h);
  // Lombadas: texto girado, lido de cima para baixo como nos CDs.
  ctx.fillStyle = p.vibrant;
  ctx.fillRect(0, 0, spine, h);
  ctx.fillRect(w - spine, 0, spine, h);
  for (const x of [spine / 2, w - spine / 2]) {
    ctx.save();
    ctx.translate(x, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = textColorOn(p.vibrant);
    ctx.font = `600 30px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, spineLabel, h - 80), 0, 2);
    ctx.restore();
  }
  const tracks = visibleTracks(album);
  const top = 150;
  const rowH = Math.min(58, (h - top - 170) / Math.max(1, tracks.length));
  ctx.fillStyle = p.light;
  ctx.font = `700 48px ${SANS}`;
  ctx.fillText(fit(ctx, album.title, w - 400), 160, 110);
  ctx.font = `${Math.max(20, Math.round(rowH * 0.55))}px ${SANS}`;
  tracks.forEach((t, i) => {
    const y = top + 40 + i * rowH;
    ctx.fillStyle = mix(p.light, p.vibrant, 0.4);
    ctx.fillText(String(t.number).padStart(2, '0'), 160, y);
    ctx.fillStyle = '#f2f0ea';
    ctx.fillText(fit(ctx, t.title, w - 560), 240, y);
    if (t.duration) {
      ctx.textAlign = 'right';
      ctx.fillText(formatTime(t.duration), w - 160, y);
      ctx.textAlign = 'left';
    }
  });
  ctx.fillStyle = mix(p.light, p.dark, 0.45);
  ctx.font = `22px ${SANS}`;
  const footer = [album.label, album.year ? String(album.year) : '', 'Contracapa gerada a partir dos metadados'].filter(Boolean).join(' · ');
  ctx.fillText(fit(ctx, footer, w - 320), 160, h - 70);
}

function drawSpine(ctx: Ctx, p: Palette, label: string): void {
  const { w, h } = SIZES.spine;
  ctx.fillStyle = p.vibrant;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = textColorOn(p.vibrant);
  ctx.font = `600 32px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(fit(ctx, label, w - 60), w / 2, h / 2 + 2);
}

function drawMedium(ctx: Ctx, album: Album, p: Palette): void {
  const { w } = SIZES.medium;
  const c = w / 2;
  ctx.clearRect(0, 0, w, w);
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fillStyle = mix(p.light, '#ffffff', 0.4);
  ctx.fill();
  const g = ctx.createRadialGradient(c, c, 160, c, c, c);
  g.addColorStop(0, mix(p.vibrant, '#ffffff', 0.15));
  g.addColorStop(1, p.vibrant);
  ctx.beginPath();
  ctx.arc(c, c, c * 0.98, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Área transparente central (anel de empilhamento e furo de 15 mm em 120 mm).
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(c, c, c * (34 / 120), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = textColorOn(p.vibrant);
  ctx.textAlign = 'center';
  ctx.font = `700 56px ${SANS}`;
  ctx.fillText(fit(ctx, album.title, w * 0.6), c, c - 260);
  ctx.font = `500 38px ${SANS}`;
  ctx.fillText(fit(ctx, album.artist, w * 0.6), c, c - 200);
  ctx.font = `24px ${SANS}`;
  ctx.fillText('COMPACT DISC · DIGITAL AUDIO', c, c + 300);
}

function drawCredits(ctx: Ctx, album: Album, p: Palette): void {
  const { w, h } = SIZES.booklet;
  ctx.fillStyle = mix(p.light, '#ffffff', 0.5);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.dark;
  ctx.font = `700 54px ${SANS}`;
  ctx.fillText(fit(ctx, album.title, w - 200), 100, 150);
  ctx.font = `500 34px ${SANS}`;
  ctx.fillStyle = mix(p.dark, p.vibrant, 0.4);
  ctx.fillText(fit(ctx, album.artist, w - 200), 100, 205);
  ctx.fillStyle = p.dark;
  ctx.font = `26px ${SANS}`;
  const tracks = visibleTracks(album);
  const lineH = Math.min(46, 700 / Math.max(1, tracks.length));
  tracks.forEach((t, i) => {
    const line = `${t.number}. ${t.title}${t.artist && t.artist !== album.artist ? ` (${t.artist})` : ''}`;
    ctx.fillText(fit(ctx, line, w - 200), 100, 290 + i * lineH);
  });
  const facts = [
    album.label ? `Selo: ${album.label}` : '',
    album.year ? `Lançamento: ${album.year}` : '',
    album.genre ? `Gênero: ${album.genre}` : '',
  ].filter(Boolean);
  ctx.font = `24px ${SANS}`;
  ctx.fillStyle = mix(p.dark, p.light, 0.3);
  facts.forEach((f, i) => ctx.fillText(f, 100, h - 200 + i * 36));
  ctx.font = `20px ${SANS}`;
  ctx.fillText('Página de créditos gerada a partir dos metadados.', 100, h - 70);
}

/** Tipos que a caixa precisa. O que faltar é desenhado com a paleta da capa. */
export const REQUIRED: ArtworkType[] = ['front', 'back', 'spine', 'medium', 'booklet'];

export function missingTypes(album: Album): ArtworkType[] {
  const present = new Set(album.artwork.filter((a) => a.origin !== 'generated').map((a) => a.type));
  const generated = new Set(album.artwork.filter((a) => a.origin === 'generated').map((a) => a.type));
  return REQUIRED.filter((t) => !present.has(t) && !generated.has(t));
}

export async function generateArtwork(album: Album, palette: Palette, types: ArtworkType[] = missingTypes(album)): Promise<Artwork[]> {
  const spineLabel = safeText(`${album.artist}  ·  ${album.title}`, 120);
  const out: Artwork[] = [];
  for (const type of types) {
    if (type === 'tray') continue;
    const size = SIZES[type];
    const { canvas, ctx } = makeCanvas(size.w, size.h);
    if (type === 'front') drawFront(ctx, album, palette);
    else if (type === 'back') drawBack(ctx, album, palette, spineLabel);
    else if (type === 'spine') drawSpine(ctx, palette, spineLabel);
    else if (type === 'medium') drawMedium(ctx, album, palette);
    else drawCredits(ctx, album, palette);
    out.push({ type, url: await toUrl(canvas), origin: 'generated', index: 0, width: size.w, height: size.h });
  }
  return out;
}

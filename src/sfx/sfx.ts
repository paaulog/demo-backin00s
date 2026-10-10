import { useApp } from '../store/store';

/**
 * Efeitos da caixa e do aparelho, sintetizados em `AudioBuffer` no próprio código
 * ("gravação própria": nenhum arquivo de terceiros). GainNode separado da música,
 * com volume e liga/desliga próprios (S8).
 */
export type SfxName = 'unwrap' | 'open' | 'close' | 'take' | 'insert' | 'eject' | 'return' | 'page' | 'pull';

let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
const buffers = new Map<SfxName, AudioBuffer>();

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctor) return null;
  ctx = new Ctor();
  gain = ctx.createGain();
  gain.connect(ctx.destination);
  return ctx;
}

type Shape = (t: number, i: number, rate: number) => number;

function render(ac: AudioContext, seconds: number, shape: Shape): AudioBuffer {
  const rate = ac.sampleRate;
  const buf = ac.createBuffer(1, Math.floor(seconds * rate), rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = shape(i / rate, i, rate);
  return buf;
}

/** Ruído determinístico, para os sons serem sempre iguais. */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function click(t: number, i: number, freq: number, decay: number): number {
  return (Math.sin(2 * Math.PI * freq * t) * 0.5 + noise(i) * 0.5) * Math.exp(-t * decay);
}

const RECIPES: Record<SfxName, (ac: AudioContext) => AudioBuffer> = {
  // Plástico rasgando: rajadas de ruído com envelope irregular.
  unwrap: (ac) => render(ac, 0.7, (t, i) => noise(i) * 0.35 * (0.4 + 0.6 * Math.abs(Math.sin(t * 38))) * Math.exp(-t * 2.5)),
  // Tampa: estalo da dobradiça e batida curta.
  open: (ac) => render(ac, 0.25, (t, i) => click(t, i, 1800, 45) * 0.6 + (t > 0.06 ? click(t - 0.06, i, 900, 60) * 0.4 : 0)),
  close: (ac) => render(ac, 0.2, (t, i) => click(t, i, 700, 50) * 0.8),
  // Disco saindo do pino: "tic" agudo dos dentes do rosette.
  take: (ac) => render(ac, 0.15, (t, i) => click(t, i, 3200, 70) * 0.5),
  return: (ac) => render(ac, 0.15, (t, i) => click(t, i, 2600, 80) * 0.5),
  // Bandeja do aparelho: motor curto e trava.
  insert: (ac) => render(ac, 0.6, (t, i) => (Math.sin(2 * Math.PI * (90 + t * 40) * t) * 0.25 + noise(i) * 0.05) * (t < 0.45 ? 1 : Math.exp(-(t - 0.45) * 40)) + (t > 0.45 ? click(t - 0.45, i, 1200, 60) * 0.5 : 0)),
  eject: (ac) => render(ac, 0.5, (t, i) => click(t, i, 1000, 50) * 0.5 + Math.sin(2 * Math.PI * (130 - t * 40) * t) * 0.2 * Math.exp(-t * 4)),
  page: (ac) => render(ac, 0.3, (t, i) => noise(i) * 0.2 * Math.sin(Math.PI * Math.min(1, t / 0.3)) ** 2),
  pull: (ac) => render(ac, 0.3, (t, i) => noise(i) * 0.12 * Math.exp(-t * 8) + click(t, i, 500, 40) * 0.2),
};

export function playSfx(name: SfxName): void {
  const { sfxEnabled, sfxVolume } = useApp.getState();
  if (!sfxEnabled || sfxVolume <= 0) return;
  const ac = context();
  if (!ac || !gain) return;
  if (ac.state === 'suspended') void ac.resume();
  let buffer = buffers.get(name);
  if (!buffer) {
    buffer = RECIPES[name](ac);
    buffers.set(name, buffer);
  }
  gain.gain.value = sfxVolume;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(gain);
  src.start();
}

import { memo } from 'react';
import type { RepeatMode } from '../store/store';

/** Segmentos acesos por dígito: a b c d e f g. */
const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

const W = 18;
const H = 32;
const T = 3.2;

/** Polígonos dos sete segmentos, com pontas chanfradas, num dígito de W × H. */
const SEGMENTS: Record<string, string> = {
  a: hSeg(0),
  g: hSeg(H / 2),
  d: hSeg(H),
  f: vSeg(0, 0),
  b: vSeg(W, 0),
  e: vSeg(0, H / 2),
  c: vSeg(W, H / 2),
};

function hSeg(y: number): string {
  const h = T / 2;
  return `${T},${y} ${h + T / 2},${y - h} ${W - h - T / 2},${y - h} ${W - T},${y} ${W - h - T / 2},${y + h} ${h + T / 2},${y + h}`;
}

function vSeg(x: number, y0: number): string {
  const h = T / 2;
  const y1 = y0 + H / 2;
  return `${x},${y0 + T} ${x + h},${y0 + T + h} ${x + h},${y1 - T - h} ${x},${y1 - T} ${x - h},${y1 - T - h} ${x - h},${y0 + T + h}`;
}

function Digit({ char, x }: { char: string; x: number }) {
  const lit = DIGITS[char] ?? '';
  return (
    <g transform={`translate(${x} 2) skewX(-6)`}>
      {Object.entries(SEGMENTS).map(([name, points]) => (
        <polygon key={name} points={points} fill="currentColor" opacity={lit.includes(name) ? 1 : 0.08} />
      ))}
    </g>
  );
}

function timeChars(seconds: number): { sign: string; digits: string } {
  const negative = seconds < 0;
  const total = negative ? Math.ceil(Math.abs(seconds)) : Math.floor(Math.max(0, seconds));
  const m = Math.min(99, Math.floor(total / 60));
  const s = total % 60;
  return { sign: negative ? '-' : ' ', digits: `${String(m).padStart(2, ' ')}${String(s).padStart(2, '0')}` };
}

export interface DisplayProps {
  trackNumber: number;
  time: number;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  message: string | null;
  hasAlbum: boolean;
}

/**
 * Visor em estilo de aparelho de som, desenhado aqui (sem fonte ou marca de terceiros, RF04).
 * Recebe valores já amostrados a 4 Hz pelo engine.
 */
export const Display = memo(function Display({ trackNumber, time, playing, shuffle, repeat, message, hasAlbum }: DisplayProps) {
  const { sign, digits } = timeChars(time);
  const track = hasAlbum ? String(trackNumber).padStart(2, '0').slice(-2) : '--';
  const step = W + 8;
  const label = hasAlbum ? `Faixa ${trackNumber}, ${sign === '-' ? 'menos ' : ''}${Math.floor(Math.abs(time) / 60)} minutos e ${Math.floor(Math.abs(time)) % 60} segundos` : 'Sem disco';
  return (
    <div className="display" data-testid="display">
      <svg width={step * 2 + 4} height={H + 6} viewBox={`-2 0 ${step * 2 + 4} ${H + 6}`} aria-hidden="true">
        {[...track].map((c, i) => (
          <Digit key={i} char={c} x={i * step + 2} />
        ))}
      </svg>
      <svg width={step * 5 + 14} height={H + 6} viewBox={`-2 0 ${step * 5 + 14} ${H + 6}`} aria-hidden="true">
        <Digit char={sign} x={2} />
        <Digit char={digits[0] ?? ' '} x={step + 2} />
        <Digit char={digits[1] ?? '0'} x={step * 2 + 2} />
        <circle cx={step * 3 + 1} cy={H * 0.32 + 2} r={1.8} fill="currentColor" />
        <circle cx={step * 3 - 1} cy={H * 0.72 + 2} r={1.8} fill="currentColor" />
        <Digit char={digits[2] ?? '0'} x={step * 3 + 8} />
        <Digit char={digits[3] ?? '0'} x={step * 4 + 8} />
      </svg>
      <div className="flags" aria-hidden="true">
        <span className={playing ? 'on' : ''}>PLAY</span>
        <span className={shuffle ? 'on' : ''}>SHUF</span>
        <span className={repeat !== 'off' ? 'on' : ''}>{repeat === 'track' ? 'REP 1' : 'REP'}</span>
      </div>
      <span className="sr-only" data-testid="display-label">{label}</span>
      {message && <span className="msg">{message}</span>}
    </div>
  );
});

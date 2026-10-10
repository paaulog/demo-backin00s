import { beforeEach, describe, expect, it } from 'vitest';
import type { Album, MusicSource, PlaybackHandle, Track } from '../../src/core/types';
import { PlayerEngine, type AudioBackend } from '../../src/player/PlayerEngine';
import { shuffledOrder } from '../../src/player/queue';

class FakeBackend implements AudioBackend {
  url: string | null = null;
  preloadedUrl: string | null = null;
  currentTime = 0;
  duration = Number.NaN;
  playing = false;
  failPlay: DOMException | null = null;
  handlers!: Parameters<AudioBackend['setHandlers']>[0];
  load(url: string) {
    this.url = url;
    this.currentTime = 0;
    this.duration = 30;
  }
  preload(url: string | null) {
    this.preloadedUrl = url;
  }
  async play() {
    if (this.failPlay) throw this.failPlay;
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  seek(s: number) {
    this.currentTime = s;
  }
  setHandlers(h: Parameters<AudioBackend['setHandlers']>[0]) {
    this.handlers = h;
  }
  destroy() {}
}

class FakeSource implements MusicSource {
  readonly kind = 'local' as const;
  released: string[] = [];
  failing = new Set<string>();
  async resolve(track: Track): Promise<PlaybackHandle> {
    if (this.failing.has(track.id)) throw new Error('sumiu');
    const url = `blob:${track.id}`;
    return { kind: 'media-url', url, release: () => this.released.push(url) };
  }
  dispose() {}
}

function track(n: number, extra: Partial<Track> = {}): Track {
  return { id: `t${n}`, albumId: 'a', number: n, disc: 1, title: `T${n}`, artist: 'X', duration: 30, source: 'local', sourceRef: `r${n}`, ...extra };
}

function album(tracks: Track[]): Album {
  return { id: 'a', title: 'A', artist: 'X', tracks, artwork: [], source: 'local' };
}

/** RNG determinístico para os testes de shuffle. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

let backend: FakeBackend;
let source: FakeSource;
let engine: PlayerEngine;
let unavailable: string[];

const noTimers = { setInterval: () => 1, clearInterval: () => undefined };

beforeEach(() => {
  backend = new FakeBackend();
  source = new FakeSource();
  unavailable = [];
  engine = new PlayerEngine({ backend, sources: { local: source }, ...noTimers, onUnavailable: (id) => unavailable.push(id) });
});

describe('fila na ordem do álbum', () => {
  it('toca na ordem e para no fim, voltando à faixa 1', async () => {
    await engine.load(album([track(1), track(2), track(3)]), { autoplay: true });
    expect(engine.snapshot().trackId).toBe('t1');
    expect(backend.preloadedUrl).toBe('blob:t2');
    backend.handlers.ended();
    await flush();
    expect(engine.snapshot().trackId).toBe('t2');
    expect(engine.snapshot().isPlaying).toBe(true);
    backend.handlers.ended();
    await flush();
    backend.handlers.ended();
    await flush();
    expect(engine.snapshot()).toMatchObject({ trackId: 't1', isPlaying: false });
  });

  it('repeat álbum volta ao início tocando', async () => {
    await engine.load(album([track(1), track(2)]), { autoplay: true, trackId: 't2' });
    engine.setRepeat('album');
    backend.handlers.ended();
    await flush();
    expect(engine.snapshot()).toMatchObject({ trackId: 't1', isPlaying: true });
  });

  it('repeat faixa repete a mesma faixa, mas "próxima" avança', async () => {
    await engine.load(album([track(1), track(2)]), { autoplay: true });
    engine.setRepeat('track');
    backend.currentTime = 29;
    backend.handlers.ended();
    await flush();
    expect(engine.snapshot().trackId).toBe('t1');
    expect(backend.currentTime).toBe(0);
    await engine.next();
    expect(engine.snapshot().trackId).toBe('t2');
  });

  it('cycleRepeat percorre off, álbum, faixa', () => {
    expect(engine.snapshot().repeat).toBe('off');
    engine.cycleRepeat();
    expect(engine.snapshot().repeat).toBe('album');
    engine.cycleRepeat();
    expect(engine.snapshot().repeat).toBe('track');
    engine.cycleRepeat();
    expect(engine.snapshot().repeat).toBe('off');
  });

  it('libera a blob: URL da faixa anterior', async () => {
    await engine.load(album([track(1), track(2), track(3)]), { autoplay: true });
    await engine.selectTrack('t3');
    expect(source.released).toContain('blob:t1');
  });
});

describe('voltar', () => {
  it('com mais de 3 s reinicia a faixa', async () => {
    await engine.load(album([track(1), track(2)]), { autoplay: true, trackId: 't2' });
    backend.currentTime = 3.5;
    await engine.prev();
    expect(engine.snapshot().trackId).toBe('t2');
    expect(backend.currentTime).toBe(0);
  });

  it('com até 3 s vai para a faixa anterior', async () => {
    await engine.load(album([track(1), track(2)]), { autoplay: true, trackId: 't2' });
    backend.currentTime = 2.9;
    await engine.prev();
    expect(engine.snapshot().trackId).toBe('t1');
  });

  it('na faixa 1 sem pregap só reinicia', async () => {
    await engine.load(album([track(1), track(2)]), { autoplay: true });
    backend.currentTime = 1;
    await engine.prev();
    expect(engine.snapshot().trackId).toBe('t1');
    expect(backend.currentTime).toBe(0);
  });
});

describe('faixa oculta (pregap)', () => {
  const withHidden = () => album([track(0, { duration: 9 }), track(1), track(2)]);

  it('fica fora da fila visível', async () => {
    await engine.load(withHidden());
    expect(engine.queue.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(engine.snapshot().trackId).toBe('t1');
  });

  it('"voltar" em 0:00 da faixa 1 entra nela com tempo negativo', async () => {
    await engine.load(withHidden(), { autoplay: true });
    await engine.prev();
    const snap = engine.snapshot();
    expect(snap).toMatchObject({ trackId: 't0', trackNumber: 0 });
    backend.duration = 9;
    backend.currentTime = 2;
    expect(engine.snapshot().displayTime).toBe(-7);
  });

  it('ao terminar, segue para a faixa 1 tocando', async () => {
    await engine.load(withHidden(), { autoplay: true });
    await engine.prev();
    backend.handlers.ended();
    await flush();
    expect(engine.snapshot()).toMatchObject({ trackId: 't1', trackNumber: 1, isPlaying: true });
  });

  it('"próxima" na faixa oculta vai para a faixa 1', async () => {
    await engine.load(withHidden(), { autoplay: true });
    await engine.prev();
    await engine.next();
    expect(engine.snapshot().trackId).toBe('t1');
  });

  it('com shuffle não existe "antes da faixa 1"', async () => {
    engine.setShuffle(true);
    await engine.load(withHidden(), { autoplay: true, trackId: 't1' });
    await engine.prev();
    expect(engine.snapshot().trackNumber).not.toBe(0);
  });
});

describe('shuffle', () => {
  it('Fisher-Yates mantém a faixa atual primeiro e não repete índices', () => {
    const order = shuffledOrder(6, 3, seq(0.1, 0.9, 0.5, 0.3, 0.7));
    expect(order[0]).toBe(3);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ligar no meio mantém a faixa atual e desligar volta à ordem do álbum', async () => {
    engine = new PlayerEngine({ backend, sources: { local: source }, rng: seq(0.2, 0.8, 0.4), ...noTimers });
    await engine.load(album([track(1), track(2), track(3), track(4)]), { autoplay: true, trackId: 't3' });
    engine.setShuffle(true);
    expect(engine.queue[0]?.id).toBe('t3');
    expect(engine.snapshot().trackId).toBe('t3');
    engine.setShuffle(false);
    expect(engine.queue.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(engine.snapshot().trackId).toBe('t3');
  });
});

describe('erros', () => {
  it('erro de arquivo marca a faixa como indisponível e pula', async () => {
    await engine.load(album([track(1), track(2), track(3)]), { autoplay: true });
    backend.handlers.error('Arquivo corrompido');
    await flush();
    expect(unavailable).toEqual(['t1']);
    expect(engine.snapshot()).toMatchObject({ trackId: 't2', isPlaying: true, message: null });
  });

  it('fonte que falha ao resolver é pulada', async () => {
    source.failing.add('t1');
    await engine.load(album([track(1), track(2)]), { autoplay: true });
    expect(engine.snapshot().trackId).toBe('t2');
    expect(unavailable).toEqual(['t1']);
  });

  it('faixa já marcada como indisponível na importação é pulada', async () => {
    await engine.load(album([track(1, { unavailable: true }), track(2)]), { autoplay: true });
    expect(engine.snapshot().trackId).toBe('t2');
  });

  it('nenhuma faixa disponível para sem laço infinito', async () => {
    await engine.load(album([track(1, { unavailable: true }), track(2, { unavailable: true })]), { autoplay: true });
    expect(engine.snapshot()).toMatchObject({ isPlaying: false, message: 'Nenhuma faixa disponível' });
  });

  it('autoplay bloqueado pede para apertar play', async () => {
    backend.failPlay = new DOMException('bloqueado', 'NotAllowedError');
    await engine.load(album([track(1)]), { autoplay: true });
    expect(engine.snapshot()).toMatchObject({ isPlaying: false, message: 'Aperte play para começar' });
  });
});

describe('busca', () => {
  it('limita a posição à duração', async () => {
    await engine.load(album([track(1)]));
    engine.seek(999);
    expect(backend.currentTime).toBeLessThan(30);
    engine.seek(-5);
    expect(backend.currentTime).toBe(0);
  });
});

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

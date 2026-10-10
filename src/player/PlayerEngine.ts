import type { Album, MusicSource, PlaybackHandle, SourceKind, Track } from '../core/types';
import type { PlayerSnapshot, RepeatMode } from '../store/store';
import { albumOrder, hiddenTrack, RESTART_THRESHOLD_S, shuffledOrder, visibleTracks, type Rng } from './queue';

/** O que o engine precisa de um elemento de áudio. Implementado por `HtmlAudioBackend`. */
export interface AudioBackend {
  /** Troca a faixa atual; reaproveita o elemento pré-carregado quando a URL bate. */
  load(url: string): void;
  /** Pré-carrega a próxima faixa no segundo elemento. `null` limpa. */
  preload(url: string | null): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  readonly currentTime: number;
  /** NaN enquanto desconhecida. */
  readonly duration: number;
  setHandlers(handlers: { ended(): void; error(message: string): void; durationchange(): void }): void;
  destroy(): void;
}

export interface PlayerEngineOptions {
  backend: AudioBackend;
  sources: Partial<Record<SourceKind, MusicSource>>;
  rng?: Rng;
  /** 4 Hz por padrão; injetável nos testes. */
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
  onUnavailable?(trackId: string, reason: string): void;
}

type Listener = (snapshot: PlayerSnapshot) => void;

/**
 * Fila, fonte e tempo, sem React. A UI e a cena só leem o snapshot e chamam os métodos.
 */
export class PlayerEngine {
  private album: Album | null = null;
  private tracks: Track[] = [];
  private hidden: Track | null = null;
  private order: number[] = [];
  private pos = 0;
  private inHidden = false;
  private playing = false;
  private loaded = false;
  private shuffle = false;
  private repeat: RepeatMode = 'off';
  private message: string | null = null;
  private unavailable = new Set<string>();
  private current: { trackId: string; handle: PlaybackHandle } | null = null;
  private preloaded: { trackId: string; handle: PlaybackHandle } | null = null;
  private loadToken = 0;
  private listeners = new Set<Listener>();
  private ticker: unknown = null;
  private readonly rng: Rng;

  constructor(private readonly opts: PlayerEngineOptions) {
    this.rng = opts.rng ?? Math.random;
    opts.backend.setHandlers({
      ended: () => void this.handleEnded(),
      error: (message) => void this.handleError(message),
      durationchange: () => this.emit(),
    });
  }

  // ---------- leitura ----------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  currentTrack(): Track | null {
    if (this.inHidden) return this.hidden;
    const index = this.order[this.pos];
    return index === undefined ? null : (this.tracks[index] ?? null);
  }

  get queue(): readonly Track[] {
    return this.order.map((i) => this.tracks[i]).filter((t): t is Track => Boolean(t));
  }

  snapshot(): PlayerSnapshot {
    const track = this.currentTrack();
    const elapsed = this.loaded ? this.opts.backend.currentTime : 0;
    const backendDuration = this.opts.backend.duration;
    const duration = Number.isFinite(backendDuration) && backendDuration > 0 ? backendDuration : (track?.duration ?? 0);
    return {
      albumId: this.album?.id ?? null,
      trackId: track?.id ?? null,
      trackNumber: this.inHidden ? 0 : (track?.number ?? 0),
      // Na faixa oculta o visor conta de -duração até 0:00, como no CD.
      displayTime: this.inHidden ? elapsed - duration : elapsed,
      elapsed,
      duration,
      isPlaying: this.playing,
      shuffle: this.shuffle,
      repeat: this.repeat,
      message: this.message,
    };
  }

  // ---------- comandos ----------

  async load(album: Album, options: { autoplay?: boolean; trackId?: string } = {}): Promise<void> {
    this.releaseAll();
    this.album = album;
    this.tracks = visibleTracks(album.tracks);
    this.hidden = hiddenTrack(album.tracks);
    this.unavailable = new Set(album.tracks.filter((t) => t.unavailable).map((t) => t.id));
    this.inHidden = false;
    this.message = null;
    const start = Math.max(0, this.tracks.findIndex((t) => t.id === options.trackId));
    this.order = this.shuffle ? shuffledOrder(this.tracks.length, start, this.rng) : albumOrder(this.tracks.length);
    this.pos = this.shuffle ? 0 : start;
    await this.startCurrent(options.autoplay ?? false);
  }

  async play(): Promise<void> {
    if (!this.album) return;
    if (!this.loaded) {
      await this.startCurrent(true);
      return;
    }
    await this.safePlay();
  }

  pause(): void {
    this.opts.backend.pause();
    this.setPlaying(false);
  }

  async toggle(): Promise<void> {
    if (this.playing) this.pause();
    else await this.play();
  }

  async next(): Promise<void> {
    if (!this.album) return;
    if (this.inHidden) {
      this.inHidden = false;
      this.pos = 0;
    } else {
      this.pos = this.pos < this.order.length - 1 ? this.pos + 1 : 0;
    }
    await this.startCurrent(this.playing, 0, 1);
  }

  async prev(): Promise<void> {
    if (!this.album) return;
    const elapsed = this.opts.backend.currentTime;
    if (elapsed > RESTART_THRESHOLD_S || this.inHidden) {
      this.seek(0);
      return;
    }
    if (this.pos > 0) {
      this.pos -= 1;
      await this.startCurrent(this.playing, 0, -1);
      return;
    }
    // "Voltar" no começo da faixa 1 entra no pregap (RF05). Com shuffle não existe "antes da 1".
    if (this.hidden && !this.shuffle && !this.unavailable.has(this.hidden.id)) {
      this.inHidden = true;
      await this.startCurrent(this.playing);
      return;
    }
    this.seek(0);
  }

  seek(seconds: number): void {
    if (!this.loaded) return;
    const duration = this.snapshot().duration;
    const clamped = Math.max(0, duration > 0 ? Math.min(seconds, duration - 0.05) : seconds);
    this.opts.backend.seek(clamped);
    this.emit();
  }

  async selectTrack(trackId: string): Promise<void> {
    const index = this.tracks.findIndex((t) => t.id === trackId);
    if (index < 0) return;
    this.inHidden = false;
    if (this.shuffle) {
      this.order = shuffledOrder(this.tracks.length, index, this.rng);
      this.pos = 0;
    } else {
      this.pos = index;
    }
    await this.startCurrent(true);
  }

  setShuffle(on: boolean): void {
    if (on === this.shuffle) return;
    this.shuffle = on;
    const currentIndex = this.inHidden ? null : (this.order[this.pos] ?? null);
    if (on) {
      this.order = shuffledOrder(this.tracks.length, currentIndex, this.rng);
      this.pos = 0;
    } else {
      this.order = albumOrder(this.tracks.length);
      this.pos = currentIndex ?? 0;
    }
    void this.preloadNext();
    this.emit();
  }

  setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
    this.emit();
  }

  cycleRepeat(): void {
    this.setRepeat(this.repeat === 'off' ? 'album' : this.repeat === 'album' ? 'track' : 'off');
  }

  /** Para e volta ao começo da faixa 1, como o botão stop do aparelho. */
  stop(): void {
    this.opts.backend.pause();
    this.setPlaying(false);
    this.inHidden = false;
    this.pos = 0;
    void this.startCurrent(false);
  }

  destroy(): void {
    this.stopTicker();
    this.releaseAll();
    this.opts.backend.destroy();
    this.listeners.clear();
  }

  // ---------- interno ----------

  private async handleEnded(): Promise<void> {
    if (this.inHidden) {
      this.inHidden = false;
      this.pos = 0;
      await this.startCurrent(true);
      return;
    }
    if (this.repeat === 'track') {
      this.opts.backend.seek(0);
      await this.safePlay();
      return;
    }
    if (this.pos < this.order.length - 1) {
      this.pos += 1;
      await this.startCurrent(true, 0, 1);
      return;
    }
    if (this.repeat === 'album') {
      if (this.shuffle) this.order = shuffledOrder(this.tracks.length, null, this.rng);
      this.pos = 0;
      await this.startCurrent(true, 0, 1);
      return;
    }
    this.stop();
  }

  private async handleError(reason: string): Promise<void> {
    const track = this.currentTrack();
    if (!track) return;
    this.markUnavailable(track, reason || 'Erro ao tocar');
    await this.skipAfterFailure();
  }

  private markUnavailable(track: Track, reason: string): void {
    this.unavailable.add(track.id);
    this.message = `Faixa ${track.number} indisponível`;
    this.opts.onUnavailable?.(track.id, reason);
  }

  private async skipAfterFailure(): Promise<void> {
    if (this.inHidden) {
      this.inHidden = false;
      this.pos = 0;
    } else if (this.pos < this.order.length - 1) {
      this.pos += 1;
    } else {
      this.pos = 0;
    }
    await this.startCurrent(this.playing, 0, 1);
  }

  /**
   * Carrega a faixa atual. Faixa indisponível é pulada na direção `step`; `attempt`
   * evita laço infinito quando nenhuma faixa toca.
   */
  private async startCurrent(autoplay: boolean, attempt = 0, step: 1 | -1 = 1): Promise<void> {
    const token = ++this.loadToken;
    const track = this.currentTrack();
    if (!track) {
      this.loaded = false;
      this.setPlaying(false);
      return;
    }
    if (this.unavailable.has(track.id)) {
      if (attempt >= this.tracks.length) {
        this.loaded = false;
        this.message = 'Nenhuma faixa disponível';
        this.setPlaying(false);
        return;
      }
      if (this.inHidden) {
        this.inHidden = false;
        this.pos = 0;
      } else {
        this.pos = (this.pos + step + this.order.length) % this.order.length;
      }
      await this.startCurrent(autoplay, attempt + 1, step);
      return;
    }

    let handle: PlaybackHandle;
    try {
      handle = this.preloaded?.trackId === track.id ? this.preloaded.handle : await this.resolve(track);
      if (this.preloaded?.trackId === track.id) this.preloaded = null;
    } catch (error) {
      if (token !== this.loadToken) return;
      this.markUnavailable(track, error instanceof Error ? error.message : 'Fonte indisponível');
      await this.startCurrent(autoplay, attempt + 1, step);
      return;
    }
    if (token !== this.loadToken) {
      handle.release();
      return;
    }
    const previous = this.current;
    this.current = { trackId: track.id, handle };
    this.opts.backend.load(handle.url);
    this.loaded = true;
    previous?.handle.release();
    if (autoplay) await this.safePlay();
    else this.setPlaying(false);
    void this.preloadNext();
    this.emit();
  }

  private async safePlay(): Promise<void> {
    try {
      await this.opts.backend.play();
      this.setPlaying(true);
    } catch (error) {
      // NotAllowedError = autoplay bloqueado; o usuário precisa apertar play.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.message = 'Aperte play para começar';
        this.setPlaying(false);
        return;
      }
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await this.handleError(error instanceof Error ? error.message : 'Erro ao tocar');
    }
  }

  private async preloadNext(): Promise<void> {
    const nextIndex = this.inHidden ? this.order[0] : this.order[this.pos + 1];
    const next = nextIndex === undefined ? null : this.tracks[nextIndex];
    if (!next || this.unavailable.has(next.id)) {
      this.dropPreload();
      this.opts.backend.preload(null);
      return;
    }
    if (this.preloaded?.trackId === next.id) return;
    this.dropPreload();
    try {
      const handle = await this.resolve(next);
      this.preloaded = { trackId: next.id, handle };
      this.opts.backend.preload(handle.url);
    } catch {
      // A falha aparece de verdade quando a faixa for tocada.
    }
  }

  private dropPreload(): void {
    this.preloaded?.handle.release();
    this.preloaded = null;
  }

  private resolve(track: Track): Promise<PlaybackHandle> {
    const source = this.opts.sources[track.source];
    if (!source) return Promise.reject(new Error(`Fonte ${track.source} não configurada`));
    return source.resolve(track);
  }

  private releaseAll(): void {
    this.loadToken++;
    this.opts.backend.pause();
    this.current?.handle.release();
    this.current = null;
    this.dropPreload();
    this.loaded = false;
    this.setPlaying(false);
  }

  private setPlaying(on: boolean): void {
    this.playing = on;
    if (on) {
      this.message = null;
      this.startTicker();
    } else {
      this.stopTicker();
    }
    this.emit();
  }

  private startTicker(): void {
    if (this.ticker !== null) return;
    const set = this.opts.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
    this.ticker = set(() => this.emit(), 250);
  }

  private stopTicker(): void {
    if (this.ticker === null) return;
    const clear = this.opts.clearInterval ?? ((id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>));
    clear(this.ticker);
    this.ticker = null;
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

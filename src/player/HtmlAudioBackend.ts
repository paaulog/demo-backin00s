import type { AudioBackend } from './PlayerEngine';

/**
 * Dois <audio> alternados: enquanto um toca, o outro carrega a próxima faixa.
 * Não é gapless; só encurta a pausa entre faixas.
 */
export class HtmlAudioBackend implements AudioBackend {
  private active: HTMLAudioElement;
  private standby: HTMLAudioElement;
  private handlers: Parameters<AudioBackend['setHandlers']>[0] | null = null;

  constructor() {
    this.active = this.create();
    this.standby = this.create();
  }

  /** O elemento ativo, para ligar efeitos do Web Audio no futuro. */
  get element(): HTMLAudioElement {
    return this.active;
  }

  private create(): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'auto';
    el.addEventListener('ended', () => {
      if (el === this.active) this.handlers?.ended();
    });
    el.addEventListener('error', () => {
      if (el !== this.active || !el.getAttribute('src')) return;
      const code = el.error?.code;
      const reason = code === 4 ? 'Formato não suportado' : code === 3 ? 'Arquivo corrompido' : 'Erro ao carregar';
      this.handlers?.error(reason);
    });
    el.addEventListener('durationchange', () => {
      if (el === this.active) this.handlers?.durationchange();
    });
    return el;
  }

  setHandlers(handlers: Parameters<AudioBackend['setHandlers']>[0]): void {
    this.handlers = handlers;
  }

  load(url: string): void {
    this.active.pause();
    if (this.standby.getAttribute('src') === url) {
      const old = this.active;
      this.active = this.standby;
      this.standby = old;
      this.active.currentTime = 0;
      this.clear(this.standby);
      return;
    }
    this.active.src = url;
    this.active.load();
  }

  preload(url: string | null): void {
    if (url === null) {
      this.clear(this.standby);
      return;
    }
    if (this.standby.getAttribute('src') === url) return;
    this.standby.src = url;
    this.standby.load();
  }

  play(): Promise<void> {
    return this.active.play();
  }

  pause(): void {
    this.active.pause();
  }

  seek(seconds: number): void {
    if (Number.isFinite(seconds)) this.active.currentTime = seconds;
  }

  get currentTime(): number {
    return this.active.currentTime || 0;
  }

  get duration(): number {
    return this.active.duration;
  }

  destroy(): void {
    this.clear(this.active);
    this.clear(this.standby);
  }

  private clear(el: HTMLAudioElement): void {
    el.pause();
    el.removeAttribute('src');
    el.load();
  }
}

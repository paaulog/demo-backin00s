import { albumIdFor } from '../../core/albumId';
import { safeText } from '../../core/text';
import type { Album, Artwork, ArtworkType, MusicSource, PlaybackHandle, Track } from '../../core/types';
import { folderOf, groupFiles, type ParsedFile } from './grouping';
import type { WorkerRequest, WorkerResponse } from './metadata.worker';
import { imageTypeFromName } from './tags';

export interface ImportItem {
  file: File;
  /** Caminho relativo (webkitRelativePath ou caminho do drag-and-drop). */
  relativePath: string;
}

export interface ImportOptions {
  /** Arquivos por mensagem ao worker. Limita memória em pastas grandes. */
  batchSize?: number;
  /** Máximo de arquivos de áudio aceitos numa importação. */
  maxFiles?: number;
  onProgress?(done: number, total: number): void;
  onWarning?(message: string): void;
  /** Injetável nos testes; no navegador, testa com um <audio>. */
  canPlay?(mime: string): boolean;
}

export const AUDIO_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  wav: 'audio/wav',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  wma: 'audio/x-ms-wma',
  webm: 'audio/webm',
};

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m?.[1]?.toLowerCase() ?? '';
}

function browserCanPlay(mime: string): boolean {
  if (typeof document === 'undefined') return true;
  return document.createElement('audio').canPlayType(mime) !== '';
}

/**
 * Fonte de arquivos locais. Os File ficam só na memória da aba: nenhum byte de áudio sai
 * do navegador (RF16), e as URLs blob: são revogadas ao descartar.
 */
export class LocalSource implements MusicSource {
  readonly kind = 'local' as const;
  private files = new Map<string, File>();
  private albumRefs = new Map<string, Set<string>>();
  private artworkUrls = new Map<string, string[]>();
  private sessionCounter = 0;
  private worker: Worker | null = null;
  private requestId = 0;

  /** `parse` é injetável para testar o agrupamento sem Web Worker. */
  constructor(private readonly parse?: (items: WorkerRequest['items']) => Promise<ParsedFile[]>) {}

  async resolve(track: Track): Promise<PlaybackHandle> {
    const file = this.files.get(track.sourceRef);
    if (!file) throw new Error('Arquivo não está mais disponível nesta sessão');
    const url = URL.createObjectURL(file);
    let released = false;
    return {
      kind: 'media-url',
      url,
      release: () => {
        if (released) return;
        released = true;
        URL.revokeObjectURL(url);
      },
    };
  }

  dispose(albumId?: string): void {
    const ids = albumId ? [albumId] : [...this.albumRefs.keys()];
    for (const id of ids) {
      for (const ref of this.albumRefs.get(id) ?? []) this.files.delete(ref);
      for (const url of this.artworkUrls.get(id) ?? []) URL.revokeObjectURL(url);
      this.albumRefs.delete(id);
      this.artworkUrls.delete(id);
    }
    if (!albumId) {
      this.worker?.terminate();
      this.worker = null;
    }
  }

  /** Lê tags no worker, agrupa em álbuns e devolve os álbuns prontos para a coleção. */
  async importItems(items: ImportItem[], options: ImportOptions = {}): Promise<Album[]> {
    const batchSize = Math.max(1, options.batchSize ?? 8);
    const maxFiles = options.maxFiles ?? 2000;
    const canPlay = options.canPlay ?? browserCanPlay;
    const warn = options.onWarning ?? (() => undefined);
    const session = ++this.sessionCounter;

    const audio: { fileIndex: number; item: ImportItem }[] = [];
    const images: ImportItem[] = [];
    items.forEach((item, i) => {
      const ext = extOf(item.file.name);
      if (AUDIO_EXT[ext] || item.file.type.startsWith('audio/')) audio.push({ fileIndex: i, item });
      else if (IMAGE_EXT.has(ext) && item.file.size < 20 * 1024 * 1024) images.push(item);
    });
    if (audio.length > maxFiles) {
      warn(`Só os primeiros ${maxFiles} arquivos de áudio foram importados.`);
      audio.length = maxFiles;
    }
    if (!audio.length) {
      warn('Nenhum arquivo de áudio encontrado.');
      return [];
    }

    const parsed: ParsedFile[] = [];
    for (let i = 0; i < audio.length; i += batchSize) {
      const batch = audio.slice(i, i + batchSize);
      const results = await this.parseBatch(
        batch.map(({ fileIndex, item }) => ({ fileIndex, file: item.file, relativePath: item.relativePath })),
      );
      parsed.push(...results);
      options.onProgress?.(Math.min(i + batchSize, audio.length), audio.length);
    }
    for (const p of parsed) if (p.error) warn(`Não foi possível ler ${p.name}: ${p.error}`);

    const byIndex = new Map(audio.map(({ fileIndex, item }) => [fileIndex, item.file]));
    const albums: Album[] = [];
    for (const group of groupFiles(parsed)) {
      const id = await albumIdFor({ mbid: group.mbid, artist: group.artist, title: group.title, year: group.year });
      const refs = this.albumRefs.get(id) ?? new Set<string>();
      const tracks: Track[] = group.files.map((f, order) => {
        const ref = `local:${session}:${f.fileIndex}`;
        const file = byIndex.get(f.fileIndex);
        if (file) this.files.set(ref, file);
        refs.add(ref);
        const mime = AUDIO_EXT[extOf(f.name)] ?? file?.type ?? '';
        const playable = mime ? canPlay(mime) : false;
        if (!playable) warn(`${f.name}: formato não suportado por este navegador.`);
        return {
          id: `${id}:${f.diskNo ?? 1}:${f.trackNo ?? 'x'}:${order}`,
          albumId: id,
          number: f.trackNo ?? order + 1,
          disc: f.diskNo ?? 1,
          title: f.title ?? safeText(f.name.replace(/\.[^.]+$/, '')),
          artist: f.artist ?? group.artist,
          duration: f.duration ?? 0,
          source: 'local',
          sourceRef: ref,
          unavailable: !playable || undefined,
          unavailableReason: playable ? undefined : 'Formato não suportado',
        } satisfies Track;
      });
      this.albumRefs.set(id, refs);
      const folders = new Set(group.files.map((f) => folderOf(f.relativePath)));
      const artwork = this.buildArtwork(id, group.files, images.filter((img) => folders.has(folderOf(img.relativePath))));
      albums.push({
        id,
        mbid: group.mbid,
        title: group.title,
        artist: group.artist,
        year: group.year,
        genre: group.genre,
        label: group.label,
        tracks,
        artwork,
        source: 'local',
      });
    }
    return albums;
  }

  private buildArtwork(albumId: string, files: ParsedFile[], folderImages: ImportItem[]): Artwork[] {
    const urls = this.artworkUrls.get(albumId) ?? [];
    const artwork: Artwork[] = [];
    const counters = new Map<ArtworkType, number>();
    const seen = new Set<string>();
    const add = (type: ArtworkType, blob: Blob, origin: Artwork['origin']) => {
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const index = counters.get(type) ?? 0;
      counters.set(type, index + 1);
      artwork.push({ type, url, origin, index });
    };

    // Imagens soltas na pasta são arquivos escolhidos pelo usuário: mesma prioridade de upload.
    const sortedImages = [...folderImages].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
    for (const img of sortedImages) {
      const type = imageTypeFromName(img.file.name) ?? (sortedImages.length === 1 ? 'front' : null);
      if (type) add(type, img.file, 'upload');
    }
    for (const f of files) {
      for (const p of f.pictures) {
        // A mesma capa costuma vir repetida em todas as faixas.
        const key = `${p.type}:${p.data.length}:${p.data[0] ?? 0}:${p.data[p.data.length - 1] ?? 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        add(p.type, new Blob([p.data as BlobPart], { type: p.mime }), 'embedded');
      }
    }
    this.artworkUrls.set(albumId, urls);
    return artwork;
  }

  private getWorker(): Worker {
    this.worker ??= new Worker(new URL('./metadata.worker.ts', import.meta.url), { type: 'module' });
    return this.worker;
  }

  private parseBatch(items: WorkerRequest['items']): Promise<ParsedFile[]> {
    if (this.parse) return this.parse(items);
    const worker = this.getWorker();
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        resolve(event.data.results);
      };
      const onError = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(event.message || 'Falha no worker de metadados'));
      };
      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      const request: WorkerRequest = { id, items };
      worker.postMessage(request);
    });
  }
}

export const localSource = new LocalSource();

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => localSource.dispose());
}

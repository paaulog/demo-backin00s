/**
 * Contratos entre módulos (techspec, seção Modelo de dados).
 * Mudou um tipo aqui, atualize a spec correspondente em docs/specs antes do código.
 */

export type SourceKind = 'local' | 'youtube' | 'jamendo';

/** Tipos de arte, alinhados aos tipos do Cover Art Archive que a caixa usa. */
export type ArtworkType = 'front' | 'back' | 'booklet' | 'medium' | 'tray' | 'spine';

export type ArtworkOrigin = 'upload' | 'embedded' | 'caa' | 'generated';

export interface Artwork {
  type: ArtworkType;
  /** blob: (sessão) ou https: (remota). */
  url: string;
  origin: ArtworkOrigin;
  /** Ordem dentro do tipo, usada nas páginas do encarte. */
  index: number;
  width?: number;
  height?: number;
}

export interface Track {
  id: string;
  albumId: string;
  /** 0 = faixa oculta (pregap), fora da tracklist visível. */
  number: number;
  disc: number;
  title: string;
  artist: string;
  /** Duração em segundos; 0 quando ainda desconhecida. */
  duration: number;
  source: SourceKind;
  /** Referência válida só durante a sessão (ex.: índice do File no LocalSource). */
  sourceRef: string;
  unavailable?: boolean;
  unavailableReason?: string;
}

export interface Album {
  /** MBID ou SHA-256 de artista, álbum e ano normalizados. Estável entre sessões. */
  id: string;
  mbid?: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  label?: string;
  tracks: Track[];
  artwork: Artwork[];
  source: SourceKind;
}

/** Algo que o player consegue tocar. Para arquivo local, um blob: URL. */
export interface PlaybackHandle {
  kind: 'media-url';
  url: string;
  /** Revoga a URL ou libera o recurso. Idempotente. */
  release(): void;
}

/**
 * Toda fonte implementa esta interface; o player só conhece ela (RF03).
 * Spotify entraria depois como mais um adapter, sem mudar o núcleo.
 */
export interface MusicSource {
  readonly kind: SourceKind;
  resolve(track: Track): Promise<PlaybackHandle>;
  /** Libera tudo que a fonte guarda (ex.: ao remover o álbum ou fechar a aba). */
  dispose(albumId?: string): void;
}

export type ThemeId =
  | 'neutral'
  | 'rock'
  | 'electronic'
  | 'mpb'
  | 'jazz'
  | 'hiphop'
  | 'pop'
  | 'classical';

/** Tema é dado puro: a cena e a UI consomem, nenhum tema tem código próprio. */
export interface Theme {
  id: ThemeId;
  label: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  lightColor: string;
  lightIntensity: number;
  shelf: { color: string; roughness: number; metalness: number };
  fontFamily: string;
}

/** Paleta extraída da capa, usada no tema neutro e na arte gerada. */
export interface Palette {
  dominant: string;
  vibrant: string;
  muted: string;
  dark: string;
  light: string;
}

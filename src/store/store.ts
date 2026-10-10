import { create } from 'zustand';
import type { Album, Palette, Theme } from '../core/types';
import { THEMES } from '../theme/themes';

export type RepeatMode = 'off' | 'track' | 'album';

export interface PlayerSnapshot {
  albumId: string | null;
  trackId: string | null;
  /** Número exibido no visor; 0 na faixa oculta. */
  trackNumber: number;
  /** Segundos. Negativo durante a faixa oculta (conta até 0:00). */
  displayTime: number;
  elapsed: number;
  duration: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  message: string | null;
}

export const EMPTY_PLAYER: PlayerSnapshot = {
  albumId: null,
  trackId: null,
  trackNumber: 0,
  displayTime: 0,
  elapsed: 0,
  duration: 0,
  isPlaying: false,
  shuffle: false,
  repeat: 'off',
  message: null,
};

export type QualityLevel = 'high' | 'medium' | 'low';
export type ShelfSort = 'artist' | 'genre' | 'year';

interface CollectionSlice {
  albums: Album[];
  currentAlbumId: string | null;
  importing: { done: number; total: number } | null;
  warnings: string[];
  shelfSort: ShelfSort;
  addAlbums(albums: Album[]): void;
  updateAlbum(id: string, patch: Partial<Album>): void;
  selectAlbum(id: string | null): void;
  setImporting(progress: { done: number; total: number } | null): void;
  pushWarning(message: string): void;
  clearWarnings(): void;
  setShelfSort(sort: ShelfSort): void;
}

interface PlayerSlice {
  player: PlayerSnapshot;
  setPlayer(snapshot: Partial<PlayerSnapshot>): void;
}

interface ThemeSlice {
  theme: Theme;
  coverPalette: Palette | null;
  setTheme(theme: Theme, palette: Palette | null): void;
}

interface SceneSlice {
  quality: QualityLevel;
  webglFailed: boolean;
  bookletPage: number;
  bookletFullscreen: boolean;
  sfxEnabled: boolean;
  sfxVolume: number;
  announcement: string;
  setQuality(level: QualityLevel): void;
  setWebglFailed(failed: boolean): void;
  setBookletPage(page: number): void;
  setBookletFullscreen(open: boolean): void;
  setSfx(enabled: boolean, volume?: number): void;
  announce(text: string): void;
}

export type AppState = CollectionSlice & PlayerSlice & ThemeSlice & SceneSlice;

export const useApp = create<AppState>()((set) => ({
  albums: [],
  currentAlbumId: null,
  importing: null,
  warnings: [],
  shelfSort: 'artist',
  addAlbums: (incoming) =>
    set((s) => {
      const byId = new Map(s.albums.map((a) => [a.id, a]));
      for (const album of incoming) {
        const existing = byId.get(album.id);
        // Mesmo álbum importado de novo: mantém a arte que já existe e soma faixas novas.
        if (existing) {
          const known = new Set(existing.tracks.map((t) => t.id));
          byId.set(album.id, {
            ...existing,
            tracks: [...existing.tracks, ...album.tracks.filter((t) => !known.has(t.id))],
            artwork: existing.artwork.length ? existing.artwork : album.artwork,
          });
        } else {
          byId.set(album.id, album);
        }
      }
      return { albums: [...byId.values()] };
    }),
  updateAlbum: (id, patch) =>
    set((s) => ({ albums: s.albums.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
  selectAlbum: (id) => set({ currentAlbumId: id, bookletPage: 0 }),
  setImporting: (importing) => set({ importing }),
  pushWarning: (message) => set((s) => ({ warnings: [...s.warnings.slice(-4), message] })),
  clearWarnings: () => set({ warnings: [] }),
  setShelfSort: (shelfSort) => set({ shelfSort }),

  player: EMPTY_PLAYER,
  setPlayer: (snapshot) => set((s) => ({ player: { ...s.player, ...snapshot } })),

  theme: THEMES.neutral,
  coverPalette: null,
  setTheme: (theme, coverPalette) => set({ theme, coverPalette }),

  quality: 'medium',
  webglFailed: false,
  bookletPage: 0,
  bookletFullscreen: false,
  sfxEnabled: true,
  sfxVolume: 0.5,
  announcement: '',
  setQuality: (quality) => set({ quality }),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
  setBookletPage: (bookletPage) => set({ bookletPage }),
  setBookletFullscreen: (bookletFullscreen) => set({ bookletFullscreen }),
  setSfx: (sfxEnabled, volume) => set((s) => ({ sfxEnabled, sfxVolume: volume ?? s.sfxVolume })),
  announce: (announcement) => set({ announcement }),
}));

export function currentAlbum(state: AppState): Album | null {
  return state.albums.find((a) => a.id === state.currentAlbumId) ?? null;
}
